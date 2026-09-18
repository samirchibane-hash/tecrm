import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminRequest, unauthorizedResponse } from "../_shared/admin-auth.ts";

// Mirrors commits from every repo the GitHub token can see into the Claude Log,
// starting 2026-09-01, then re-links them to CRM accounts from
// github_client_rules. Then lists every funnel page in each funnel_sites folder
// into that client's Funnel Pages (account_links). Read-only against GitHub.
//
// Runs hourly from pg_cron (x-cron-secret header, checked against Vault) or on
// demand by a signed-in admin. The token is set in Settings → Integrations and
// read here through get_github_token() (service role only).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SINCE = "2026-09-01T00:00:00Z";

// Raw GitHub API JSON; fields are read defensively with optional chaining.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GitHubObject = Record<string, any>;

class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gh(path: string, token: string): Promise<{ body: GitHubObject; next: string | null }> {
  const res = await fetch(path.startsWith("https://") ? path : `https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tecrm-github-sync",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new GitHubError(res.status, `GitHub ${path}: ${body.message ?? res.status}`);
  const next = res.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  return { body, next };
}

async function ghAll(path: string, token: string): Promise<GitHubObject[]> {
  const out: GitHubObject[] = [];
  let url: string | null = path;
  while (url) {
    const { body, next } = await gh(url, token);
    out.push(...(body as GitHubObject[]));
    url = next;
  }
  return out;
}

// Small worker pool so per-commit detail calls don't fan out unbounded.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

const TRAILER = /^(co-authored-by|signed-off-by|reviewed-by|change-id):/i;

function parseMessage(message: string) {
  const [subject, ...rest] = message.split("\n");
  const body = rest.filter((line) => !TRAILER.test(line.trim())).join("\n").trim();
  return {
    subject: subject.trim() || "(no message)",
    body: body || null,
    claude_coauthored: /co-authored-by:\s*claude/i.test(message),
  };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–" };

function decodeEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  });
}

/** Inner HTML → the words a visitor reads: <br> and <em>/<span> disappear, spacing collapses. */
function plainText(inner: string): string | null {
  const text = decodeEntities(inner.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function pageTitle(html: string): string | null {
  const raw = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  return raw ? plainText(raw) : null;
}

/** The text of the first element carrying `cls`, whatever tag it is. */
function byClass(html: string, cls: string): string | null {
  const open = new RegExp(`<(\\w+)[^>]*\\bclass="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, "i").exec(html);
  if (!open) return null;
  const tag = open[1];
  const rest = html.slice(open.index + open[0].length);
  const close = new RegExp(`</${tag}\\s*>`, "i").exec(rest);
  return plainText(close ? rest.slice(0, close.index) : rest.slice(0, 600));
}

/**
 * What the page promises above the fold: the hero headline, the hero subhead,
 * and the form card's offer line. These are what a landing page test is really
 * testing, so the Funnel scorecard shows them next to the conversion rate.
 * Offer and angle aren't derived here — the dashboard detects them from this
 * copy with the same taxonomy it uses for ad creative.
 */
function heroCopy(html: string): { headline: string | null; subhead: string | null; cta: string | null } {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  const offer = [byClass(html, "form-card-headline"), byClass(html, "form-card-sub")].filter(Boolean).join(" ");
  return {
    headline: h1 ? plainText(h1) : null,
    subhead: byClass(html, "hero-subhead"),
    cta: offer || null,
  };
}

// "broadway-1" → "Broadway 1", "dfw-schedule" → "DFW Schedule"
function pageLabel(slug: string): string {
  return slug.split(/[-_]+/).filter(Boolean)
    .map((w) => (/^[a-z]{1,3}$/i.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

// Every dist/<site>/<page>/index.html on the default branch (what Vercel
// serves) becomes a Funnel Pages link. Root index.html files are only
// redirects to LP1, so they're skipped.
async function syncFunnelPages(db: ReturnType<typeof createClient>, token: string, repos: GitHubObject[]) {
  const { data: sites, error } = await db.from("funnel_sites").select("id, repo, root_dir, domain");
  if (error) throw new Error(`funnel_sites: ${error.message}`);

  const { data: known } = await db.from("account_links")
    .select("repo, repo_path, blob_sha, page_title, page_headline, page_subhead, page_cta, copy_synced_at")
    .eq("source", "funnel_repo");
  const seen = new Map((known ?? []).map((k) => [`${k.repo}:${k.repo_path}`, k]));

  const totals = { sites: sites?.length ?? 0, pages: 0, added: 0, adopted: 0, removed: 0 };
  const trees = new Map<string, GitHubObject[]>();

  for (const site of sites ?? []) {
    if (!trees.has(site.repo)) {
      const branch = repos.find((r) => r.full_name.toLowerCase() === site.repo.toLowerCase())?.default_branch;
      if (!branch) throw new Error(`funnel pages: token can't see ${site.repo}`);
      const { body } = await gh(`/repos/${site.repo}/git/trees/${branch}?recursive=1`, token);
      // A partial tree would read as deleted pages, so refuse it outright.
      if (body.truncated) throw new Error(`funnel pages: ${site.repo} tree is truncated`);
      trees.set(site.repo, body.tree ?? []);
    }

    const prefix = `${site.root_dir}/`;
    const entries = trees.get(site.repo)!.filter((e) =>
      e.type === "blob" && e.path.startsWith(prefix) && /^[^/]+\/index\.html$/.test(e.path.slice(prefix.length)));

    const pages = await mapLimit(entries, 5, async (e) => {
      const slug = e.path.slice(prefix.length).split("/")[0];
      const prev = seen.get(`${site.repo}:${e.path}`);
      // Unchanged pages keep the copy the run that read them extracted, along
      // with that run's timestamp. A null copy_synced_at means the page has
      // never been parsed for its headline, so it's re-read once.
      let read = {
        page_title: prev?.page_title ?? null,
        page_headline: prev?.page_headline ?? null,
        page_subhead: prev?.page_subhead ?? null,
        page_cta: prev?.page_cta ?? null,
        copy_synced_at: prev?.copy_synced_at ?? null,
      };
      if (!prev || prev.blob_sha !== e.sha || !prev.copy_synced_at) {
        const { body } = await gh(`/repos/${site.repo}/git/blobs/${e.sha}`, token);
        const bytes = Uint8Array.from(atob(String(body.content ?? "").replace(/\n/g, "")), (c) => c.charCodeAt(0));
        const html = new TextDecoder().decode(bytes);
        const hero = heroCopy(html);
        read = {
          page_title: pageTitle(html),
          page_headline: hero.headline,
          page_subhead: hero.subhead,
          page_cta: hero.cta,
          copy_synced_at: new Date().toISOString(),
        };
      }
      return {
        repo_path: e.path,
        url: `https://${site.domain}/${slug}`,
        label: pageLabel(slug),
        blob_sha: e.sha,
        ...read,
      };
    });

    const { data: result, error: syncError } = await db.rpc("sync_funnel_pages", { p_site_id: site.id, p_pages: pages });
    if (syncError) throw new Error(`sync_funnel_pages ${site.root_dir}: ${syncError.message}`);
    totals.pages += pages.length;
    totals.added += result?.added ?? 0;
    totals.adopted += result?.adopted ?? 0;
    totals.removed += result?.removed ?? 0;
  }
  return totals;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const cronSecret = req.headers.get("x-cron-secret");
  const viaCron = cronSecret
    ? (await db.rpc("verify_cron_secret", { secret: cronSecret })).data === true
    : false;
  if (!viaCron && !(await isAdminRequest(req))) return unauthorizedResponse(corsHeaders);

  const runStart = new Date().toISOString();
  const { data: run } = await db.from("github_sync_runs").insert({ started_at: runStart }).select("id").single();

  try {
    const { data: token } = await db.rpc("get_github_token");
    if (!token) throw new Error("GitHub is not connected — add a token in Settings → Integrations");

    const repos = await ghAll("/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member", token);
    const { error: repoError } = await db.from("github_repos").upsert(repos.map((r) => ({
      full_name: r.full_name,
      html_url: r.html_url,
      description: r.description,
      is_private: r.private,
      default_branch: r.default_branch,
      pushed_at: r.pushed_at,
      archived: !!r.archived,
      synced_at: runStart,
    })), { onConflict: "full_name" });
    if (repoError) throw new Error(`github_repos upsert: ${repoError.message}`);

    // Only repos pushed since the cutoff can hold commits in range.
    const active = repos.filter((r) => r.pushed_at && r.pushed_at >= SINCE);
    let fetched = 0;
    let skipped = 0;

    for (const repo of active) {
      let commits: GitHubObject[];
      try {
        // Default branch only: the log records what shipped.
        commits = await ghAll(`/repos/${repo.full_name}/commits?since=${SINCE}&per_page=100`, token);
      } catch (e) {
        if (e instanceof GitHubError && e.status === 409) continue; // empty repo
        throw e;
      }

      // Detail calls (files + stats) only for commits we don't already hold
      // from the API. Locally seeded rows are refreshed once.
      const { data: known } = await db.from("github_commits")
        .select("sha").eq("repo", repo.full_name).eq("source", "github");
      const knownShas = new Set((known ?? []).map((k) => k.sha));
      const fresh = commits.filter((c) => !knownShas.has(c.sha));
      skipped += commits.length - fresh.length;

      const rows = await mapLimit(fresh, 5, async (c) => {
        const { body: detail } = await gh(`/repos/${repo.full_name}/commits/${c.sha}`, token);
        return {
          repo: repo.full_name,
          sha: c.sha,
          committed_at: c.commit?.author?.date ?? c.commit?.committer?.date,
          author_name: c.commit?.author?.name ?? null,
          author_login: c.author?.login ?? null,
          ...parseMessage(c.commit?.message ?? ""),
          files: (detail.files ?? []).map((f: GitHubObject) => f.filename),
          additions: detail.stats?.additions ?? null,
          deletions: detail.stats?.deletions ?? null,
          html_url: c.html_url,
          source: "github",
          synced_at: runStart,
        };
      });
      if (rows.length) {
        const { error } = await db.from("github_commits").upsert(rows, { onConflict: "repo,sha" });
        if (error) throw new Error(`github_commits upsert: ${error.message}`);
      }
      fetched += rows.length;
    }

    const { data: links } = await db.rpc("link_github_commits");
    const funnel_pages = await syncFunnelPages(db, token, repos);
    const counts = { repos: repos.length, active_repos: active.length, new_commits: fetched, unchanged: skipped, links: links ?? 0, funnel_pages };
    if (run) await db.from("github_sync_runs").update({ finished_at: new Date().toISOString(), ok: true, counts }).eq("id", run.id);

    return new Response(JSON.stringify({ ok: true, counts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("github-sync error:", msg);
    if (run) await db.from("github_sync_runs").update({ finished_at: new Date().toISOString(), ok: false, error: msg }).eq("id", run.id);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
