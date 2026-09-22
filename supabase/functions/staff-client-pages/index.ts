import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { destinationUrls, normalizePageUrl } from "../_shared/meta-destinations.ts";

// Each client's active landing pages and schedule page, for the public staff
// briefs page (/briefs/<token>). Authorized by the staff link token, not a CRM
// login: the token is checked against staff_share_links before anything is read.
//
// "Active" means a live Meta ad (effective_status ACTIVE) sends people there
// right now. The page is labelled from the client's synced funnel pages
// (account_links) when it's one of theirs, and listed by URL when it isn't.
// Schedule pages are the funnel pages whose path is a schedule page; they
// don't depend on Meta.
//
// Meta state is reported per client, never guessed: not_linked (no ad account
// in the CRM), no_access (token can't read it), error, or ok — so "no active
// pages" only ever means no live ads.

const GRAPH = "https://graph.facebook.com/v25.0";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGES = 10;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Graph = Record<string, any>;
type MetaStatus = "ok" | "not_linked" | "no_access" | "error";
type Page = { label: string; url: string };

class MetaError extends Error {
  constructor(public status: MetaStatus, message: string) {
    super(message);
  }
}

async function graph(url: URL, token: string): Promise<Graph> {
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body;
  const code = body.error?.code;
  // 200/10 = the token can't read this ad account (not assigned to the system user).
  throw new MetaError(code === 200 || code === 10 ? "no_access" : "error", body.error?.message ?? `HTTP ${res.status}`);
}

/** Destination URLs of every live ad in the account, with how many ads point at each. */
async function liveDestinations(actId: string, token: string): Promise<Map<string, { url: string; ads: number }>> {
  const url = new URL(`${GRAPH}/${actId}/ads`);
  url.searchParams.set("fields", "creative{object_story_spec,asset_feed_spec}");
  url.searchParams.set("filtering", JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]));
  url.searchParams.set("limit", "200");

  const byPage = new Map<string, { url: string; ads: number }>();
  let page = await graph(url, token);
  for (let i = 0; ; i++) {
    for (const ad of page.data ?? []) {
      for (const dest of destinationUrls(ad.creative)) {
        const key = normalizePageUrl(dest);
        const hit = byPage.get(key) ?? { url: dest.replace(/[?#].*$/, ""), ads: 0 };
        hit.ads += 1;
        byPage.set(key, hit);
      }
    }
    if (!page.paging?.next || i >= MAX_PAGES) break;
    page = await graph(new URL(page.paging.next), token);
  }
  return byPage;
}

// A bare domain is the site's home page (the funnel root redirects to its first
// landing page); anything else unregistered is shown by its address.
const fallbackLabel = (normalized: string) => (normalized.includes("/") ? normalized : "Home page");

const isSchedulePage = (url: string) => /(^|[/-])schedule$/.test(normalizePageUrl(url).split("/").slice(1).join("/"));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { token } = await req.json().catch(() => ({}));
    if (!UUID_RE.test(token ?? "")) return json({ error: "invalid_staff_link" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: link, error: linkErr } = await db
      .from("staff_share_links").select("scope").eq("scope", "creative_briefs").eq("token", token).maybeSingle();
    if (linkErr) throw new Error(`staff_share_links: ${linkErr.message}`);
    if (!link) return json({ error: "invalid_staff_link" }, 401);

    const [{ data: accounts, error: accErr }, { data: links, error: linksErr }] = await Promise.all([
      db.from("accounts").select("account_name, fb_ad_account_id"),
      db.from("account_links").select("account_name, label, url").eq("source", "funnel_repo"),
    ]);
    if (accErr) throw new Error(`accounts: ${accErr.message}`);
    if (linksErr) throw new Error(`account_links: ${linksErr.message}`);

    const metaToken = Deno.env.get("META_ACCESS_TOKEN");

    const clients = await Promise.all((accounts ?? []).map(async (a) => {
      const funnelPages = (links ?? []).filter((l) => l.account_name === a.account_name);
      const labelByUrl = new Map(funnelPages.map((l) => [normalizePageUrl(l.url), l.label as string]));
      const schedulePages: Page[] = funnelPages
        .filter((l) => isSchedulePage(l.url))
        .map((l) => ({ label: l.label, url: l.url }));

      let meta: MetaStatus = "ok";
      let metaMessage: string | null = null;
      let activePages: (Page & { ads: number })[] = [];

      if (!a.fb_ad_account_id) {
        meta = "not_linked";
      } else if (!metaToken) {
        meta = "error";
        metaMessage = "META_ACCESS_TOKEN is not set";
      } else {
        try {
          const dests = await liveDestinations(a.fb_ad_account_id, metaToken);
          activePages = [...dests.entries()]
            .map(([key, d]) => ({ label: labelByUrl.get(key) ?? fallbackLabel(key), url: d.url, ads: d.ads }))
            .sort((x, y) => y.ads - x.ads);
        } catch (e) {
          meta = e instanceof MetaError ? e.status : "error";
          metaMessage = e instanceof Error ? e.message : "Unknown error";
        }
      }

      return { accountName: a.account_name, meta, metaMessage, activePages, schedulePages };
    }));

    return json({ clients, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("staff-client-pages error:", msg);
    return json({ error: msg }, 500);
  }
});
