import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// What a landing page reports about itself: which split-test arm a visitor was
// shown, and whether they converted.
//
// This exists because Meta cannot answer it. Meta attributes a landing page
// view and a lead to the *ad* that sent the visitor, not to the arm the page
// chose to show them, so an ad pointing at one URL that splits its own traffic
// looks like a single destination. The conversion rate of an arm can therefore
// only be counted by the page itself.
//
// Public by necessity — it is called from a client's landing page — so it is
// written to be dull: no PII, no reads, inserts only, and everything it is told
// is validated before it reaches a table. The session id is an opaque random
// string the page generates; it exists only to keep a refresh from counting
// twice, and a unique index makes that guarantee rather than trusting the page.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VARIANT_RE = /^[a-z]$/;
const EVENTS = new Set(["view", "lead"]);
const MAX_LEN = 200;

/** Same normalization the dashboard keys pages by, so a page matches whatever it calls itself. */
function normalizeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

const str = (v: unknown, max = MAX_LEN): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 && s.length <= max ? s : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    const url = str(body.url, 500);
    const variant = str(body.variant, 1);
    const event = str(body.event, 10);
    const session = str(body.session, 64);
    const adName = str(body.ad_name);

    if (!url || !variant || !event || !session) return json({ error: "url, variant, event and session are required" }, 400);
    if (!VARIANT_RE.test(variant)) return json({ error: "variant must be a single lowercase letter" }, 400);
    if (!EVENTS.has(event)) return json({ error: "event must be view or lead" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // The page names itself by URL; only a page the CRM already knows is
    // accepted, so this can't be used to write rows for anything else.
    const key = normalizeUrl(url);
    const { data: links, error: linkError } = await db
      .from("account_links")
      .select("id, url")
      .eq("source", "funnel_repo");
    if (linkError) throw new Error(`account_links: ${linkError.message}`);

    const link = (links ?? []).find((l) => normalizeUrl(l.url) === key);
    if (!link) return json({ error: "Unknown page" }, 404);

    const { error } = await db.from("funnel_variant_events").insert({
      account_link_id: link.id,
      variant,
      event,
      session_id: session,
      ad_name: adName,
    });

    // 23505 = the unique index did its job: this session already reported this
    // event for this arm. A refresh is not a second view.
    if (error && error.code !== "23505") throw new Error(`insert: ${error.message}`);

    return json({ ok: true, counted: !error });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("funnel-track error:", msg);
    return json({ error: msg }, 500);
  }
});
