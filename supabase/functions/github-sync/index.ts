import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminRequest, unauthorizedResponse } from "../_shared/admin-auth.ts";

// Mirrors commits from every repo the GitHub token can see into the Claude Log,
// starting 2026-09-01, then re-links them to CRM accounts from
// github_client_rules. Read-only against GitHub.
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
    const counts = { repos: repos.length, active_repos: active.length, new_commits: fetched, unchanged: skipped, links: links ?? 0 };
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
