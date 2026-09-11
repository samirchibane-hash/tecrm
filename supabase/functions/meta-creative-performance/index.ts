import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminRequest, unauthorizedResponse } from "../_shared/admin-auth.ts";

// Creative performance read straight from the Meta Graph API (nothing stored).
// Admin-only.
//
// One account ({ accountId }) or every linked account ({ scope: "all" }), for a
// Meta date preset or an explicit { since, until }. Returns every ad that
// delivered in the period, live or paused (a paused ad can still be the period's
// biggest waste of money), plus live ads that haven't delivered yet. Each ad
// carries its copy (headlines, primary texts, destination URL), the funnel steps
// Meta sees (impressions → link clicks → landing page views → leads → schedules)
// and, for video, 3-second plays and ThruPlays.
//
// Leads are reported by source and never summed silently: website leads are the
// pixel's Lead event, form leads are instant-form submissions. Results / Cost per
// result are Meta's own (the ad set's optimization event); Meta leaves them empty
// for instant-form ads, so those fall back to the form-lead count.
//
// Appointments are Meta's `schedule_total` conversions, only reported when the
// account tracks them (Meta saw one in the last 90 days), so a funnel that never
// sends a Schedule event reads "not tracked" instead of "0 appointments".
//
// With `detail` (default for one account), the response also carries Meta's
// title_asset / body_asset breakdowns, so ads that rotate several headlines or
// primary texts can be scored per text rather than per ad.

const GRAPH = "https://graph.facebook.com/v25.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRESETS = new Set(["last_7d", "last_14d", "last_30d", "this_month", "last_month", "maximum"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGES = 25;

// Raw Graph JSON; fields are read defensively.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Graph = Record<string, any>;

type Range = { preset: string } | { since: string; until: string };

class MetaError extends Error {
  constructor(public code: "META_AUTH" | "META_NO_ACCESS" | "META_ERROR", message: string) {
    super(message);
  }
}

async function graph(path: string, params: Record<string, string>, token: string): Promise<Graph> {
  const url = path.startsWith("https://") ? new URL(path) : new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", token);

  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body;

  const err = body.error ?? {};
  // 190 = the token itself is dead. 200/10 = the token is fine but can't read
  // this ad account (e.g. it isn't assigned to the system user).
  if (err.code === 190) {
    throw new MetaError("META_AUTH", "Meta access token is invalid or expired. Update META_ACCESS_TOKEN in Supabase → Edge Functions → Secrets.");
  }
  if (err.code === 200 || err.code === 10) {
    throw new MetaError("META_NO_ACCESS", "The Meta token can't read this ad account. Assign the ad account to the system user in Meta Business Settings.");
  }
  throw new MetaError("META_ERROR", `Meta API error: ${err.message ?? res.status}`);
}

/** Every page of a list edge. */
async function graphAll(path: string, params: Record<string, string>, token: string): Promise<Graph[]> {
  const first = await graph(path, params, token);
  const rows: Graph[] = [...(first.data ?? [])];
  let next = first.paging?.next;
  for (let i = 0; next && i < MAX_PAGES; i++) {
    const page = await graph(next, {}, token);
    rows.push(...(page.data ?? []));
    next = page.paging?.next;
  }
  return rows;
}

const rangeParams = (r: Range): Record<string, string> =>
  "preset" in r ? { date_preset: r.preset } : { time_range: JSON.stringify({ since: r.since, until: r.until }) };

const nestedInsights = (r: Range, fields: string) =>
  "preset" in r
    ? `insights.date_preset(${r.preset}){${fields}}`
    : `insights.time_range(${JSON.stringify({ since: r.since, until: r.until })}){${fields}}`;

const RESULT_LABELS: Record<string, string> = {
  "offsite_conversion.fb_pixel_lead": "Website leads",
  "schedule_website": "Website schedules",
  "offsite_conversion.fb_pixel_schedule": "Website schedules",
  "onsite_conversion.lead_grouped": "Form leads",
  "lead": "Leads",
  "offsite_conversion.fb_pixel_complete_registration": "Registrations",
  "link_click": "Link clicks",
  "landing_page_view": "Landing page views",
  "reach": "Reach",
  "impressions": "Impressions",
};

// "actions:offsite_conversion.fb_pixel_lead" → "offsite_conversion.fb_pixel_lead"
function resultType(indicator: string): string {
  return indicator.includes(":") ? indicator.slice(indicator.indexOf(":") + 1) : indicator;
}

function resultLabel(type: string): string {
  if (RESULT_LABELS[type]) return RESULT_LABELS[type];
  if (type.startsWith("offsite_conversion.custom.")) return "Custom conversions";
  return type.replace(/^offsite_conversion\.(fb_pixel_)?/, "").replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// Goals Meta doesn't fill `results` for, mapped to the action Ads Manager counts.
const FORM_GOALS = new Set(["LEAD_GENERATION", "QUALITY_LEAD"]);
const GOAL_FALLBACK: Record<string, string> = {
  LEAD_GENERATION: "onsite_conversion.lead_grouped",
  QUALITY_LEAD: "onsite_conversion.lead_grouped",
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const actionCount = (ins: Graph | undefined, type: string) =>
  num((ins?.actions ?? []).find((a: Graph) => a.action_type === type)?.value) ?? 0;
const scheduleCount = (ins: Graph | undefined) =>
  num((ins?.conversions ?? []).find((c: Graph) => c.action_type === "schedule_total")?.value) ?? 0;

function summarizeResult(ins: Graph, goal: string | undefined, spend: number) {
  const metaResult = ins.results?.[0];
  if (metaResult?.indicator) {
    const type = resultType(metaResult.indicator);
    // Meta sends the indicator with no `values` when the count is zero.
    const count = num(metaResult.values?.[0]?.value) ?? 0;
    const metaCost = num(ins.cost_per_result?.[0]?.values?.[0]?.value);
    return { type, label: resultLabel(type), count, costPer: count > 0 ? metaCost ?? spend / count : null, source: "meta" as const };
  }

  const fallback = goal ? GOAL_FALLBACK[goal] : undefined;
  if (fallback) {
    const count = actionCount(ins, fallback);
    return { type: fallback, label: resultLabel(fallback), count, costPer: count > 0 ? spend / count : null, source: "actions" as const };
  }
  return null; // Meta reports no result for this goal; the UI says so rather than showing 0.
}

const uniqText = (xs: unknown[]): string[] =>
  [...new Set(xs.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))];

// Instant-form ads carry a placeholder link, not a page anyone lands on.
const isRealDestination = (u: string) => /^https?:\/\//i.test(u) && !/^https?:\/\/(www\.)?(fb\.me|facebook\.com|m\.facebook\.com)\b/i.test(u);

/** The words and destination an ad shows, from whichever creative shape it uses. */
function extractCopy(creative: Graph | undefined) {
  const oss = creative?.object_story_spec ?? {};
  const link = oss.link_data ?? {};
  const video = oss.video_data ?? {};
  const afs = creative?.asset_feed_spec ?? {};
  const texts = (xs: Graph[] | undefined) => (xs ?? []).map((x) => x?.text);

  const destinationUrls = uniqText([
    link.link,
    link.call_to_action?.value?.link,
    video.call_to_action?.value?.link,
    ...(afs.link_urls ?? []).map((u: Graph) => u?.website_url),
  ]).filter(isRealDestination);

  const leadFormId =
    link.call_to_action?.value?.lead_gen_form_id ??
    video.call_to_action?.value?.lead_gen_form_id ??
    (afs.call_to_actions ?? []).find((c: Graph) => c?.value?.lead_gen_form_id)?.value?.lead_gen_form_id ??
    null;

  return {
    headlines: uniqText([link.name, video.title, ...texts(afs.titles), creative?.title]),
    bodies: uniqText([link.message, video.message, ...texts(afs.bodies), creative?.body]),
    descriptions: uniqText([link.description, video.link_description, ...texts(afs.descriptions)]),
    destinationUrls,
    cta: link.call_to_action?.type ?? video.call_to_action?.type ?? afs.call_to_action_types?.[0] ?? creative?.call_to_action_type ?? null,
    leadForm: !!leadFormId,
  };
}

const AD_FIELDS = [
  "id,name,effective_status,created_time",
  "campaign{name}",
  "adset{id,name,optimization_goal}",
  "creative.thumbnail_width(320).thumbnail_height(320){id,object_type,video_id,thumbnail_url,title,body,call_to_action_type,object_story_spec,asset_feed_spec}",
].join(",");

const INSIGHT_FIELDS = [
  "ad_id,ad_name,adset_id,adset_name,campaign_name",
  "spend,impressions,reach,frequency,inline_link_clicks,inline_link_click_ctr,cpm",
  "actions,conversions,results,cost_per_result,video_thruplay_watched_actions",
  "date_start,date_stop",
].join(",");

const DELIVERED = JSON.stringify([{ field: "impressions", operator: "GREATER_THAN", value: 0 }]);

/** Per-text rows of a title_asset / body_asset breakdown, merged across placement variants. */
function assetRows(rows: Graph[] | null, key: "title_asset" | "body_asset", appointmentsTracked: boolean) {
  if (!rows) return null;
  const merged = new Map<string, Graph>();
  for (const r of rows) {
    const text = typeof r[key]?.text === "string" ? r[key].text.trim() : "";
    if (!text || !r.ad_id) continue;
    const k = `${r.ad_id} ${text}`;
    const m = merged.get(k) ?? { adId: r.ad_id, text, spend: 0, impressions: 0, linkClicks: 0, webLeads: 0, formLeads: 0, appointments: appointmentsTracked ? 0 : null };
    m.spend += num(r.spend) ?? 0;
    m.impressions += num(r.impressions) ?? 0;
    m.linkClicks += num(r.inline_link_clicks) ?? actionCount(r, "link_click");
    m.webLeads += actionCount(r, "offsite_conversion.fb_pixel_lead");
    m.formLeads += actionCount(r, "onsite_conversion.lead_grouped");
    if (appointmentsTracked) m.appointments += scheduleCount(r);
    merged.set(k, m);
  }
  return [...merged.values()];
}

async function loadAccount(actId: string, range: Range, detail: boolean, token: string) {
  // Asset breakdowns only exist for ads that rotate assets; if Meta refuses the
  // breakdown the report still works, scored per ad instead of per text.
  const optional = (p: Promise<Graph[]>) =>
    p.catch((e) => {
      if (e instanceof MetaError && e.code !== "META_ERROR") throw e;
      console.warn("meta-creative-performance: asset breakdown unavailable", actId, e?.message);
      return null;
    });
  const breakdown = (b: string) =>
    graphAll(`${actId}/insights`, {
      level: "ad",
      ...rangeParams(range),
      breakdowns: b,
      fields: "ad_id,spend,impressions,inline_link_clicks,actions,conversions",
      filtering: DELIVERED,
      limit: "500",
    }, token);

  const [meta, tracking, insightRows, liveAds, titleRows, bodyRows] = await Promise.all([
    graph(actId, { fields: `name,currency,${nestedInsights(range, "spend,date_start,date_stop")}` }, token),
    graph(`${actId}/insights`, { date_preset: "last_90d", fields: "conversions" }, token),
    graphAll(`${actId}/insights`, { level: "ad", ...rangeParams(range), fields: INSIGHT_FIELDS, filtering: DELIVERED, limit: "500" }, token),
    graphAll(`${actId}/ads`, {
      fields: AD_FIELDS,
      filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]),
      limit: "100",
    }, token),
    detail ? optional(breakdown("title_asset")) : Promise.resolve(null),
    detail ? optional(breakdown("body_asset")) : Promise.resolve(null),
  ]);

  // Creative details for ads that delivered in the period but aren't live now.
  const adsById = new Map<string, Graph>(liveAds.map((a) => [a.id, a]));
  const missing = [...new Set(insightRows.map((r) => r.ad_id as string))].filter((id) => id && !adsById.has(id));
  for (let i = 0; i < missing.length; i += 50) {
    try {
      const batch = await graph("", { ids: missing.slice(i, i + 50).join(","), fields: AD_FIELDS }, token);
      for (const [id, ad] of Object.entries(batch)) adsById.set(id, ad as Graph);
    } catch (e) {
      if (e instanceof MetaError && e.code !== "META_ERROR") throw e;
      // A deleted ad can fail the whole batch; those rows keep their insights-only names.
      console.warn("meta-creative-performance: creative lookup failed", actId, (e as Error).message);
    }
  }

  const appointmentsTracked = scheduleCount(tracking.data?.[0]) > 0;
  const insightsByAd = new Map<string, Graph>(insightRows.map((r) => [r.ad_id, r]));
  const adIds = [...new Set([...insightsByAd.keys(), ...liveAds.map((a) => a.id as string)])];
  const actNumber = actId.replace(/^act_/, "");

  const ads = adIds.map((id) => {
    const ad = adsById.get(id) ?? {};
    const ins = insightsByAd.get(id);
    const spend = num(ins?.spend) ?? 0;
    const impressions = num(ins?.impressions) ?? 0;
    const goal: string | undefined = ad.adset?.optimization_goal;
    const copy = extractCopy(ad.creative);
    const webLeads = actionCount(ins, "offsite_conversion.fb_pixel_lead");
    const formLeads = actionCount(ins, "onsite_conversion.lead_grouped");
    const isVideo = !!(ad.creative?.video_id || ad.creative?.object_type === "VIDEO");
    const videoPlays = isVideo && ins ? actionCount(ins, "video_view") : null;
    const thruplays = isVideo && ins ? num(ins.video_thruplay_watched_actions?.[0]?.value) ?? 0 : null;
    const appointments = appointmentsTracked && ins ? scheduleCount(ins) : null;
    const status: string = ad.effective_status ?? "UNKNOWN";
    const leadChannel = copy.leadForm || (goal && FORM_GOALS.has(goal)) || (formLeads > 0 && webLeads === 0) ? "form" : "website";

    return {
      id,
      name: (ad.name ?? ins?.ad_name ?? id) as string,
      status,
      live: status === "ACTIVE",
      createdTime: (ad.created_time ?? null) as string | null,
      campaign: ad.campaign?.name ?? ins?.campaign_name ?? null,
      adset: ad.adset?.name ?? ins?.adset_name ?? null,
      adsetId: ad.adset?.id ?? ins?.adset_id ?? null,
      optimizationGoal: goal ?? null,
      format: isVideo ? "video" : "image",
      thumbnailUrl: ad.creative?.thumbnail_url ?? null,
      adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${actNumber}&selected_ad_ids=${id}`,
      // Meta returns no insights row when an ad had no impressions in the period.
      delivered: !!ins,
      spend,
      impressions,
      reach: num(ins?.reach) ?? 0,
      frequency: num(ins?.frequency),
      linkClicks: num(ins?.inline_link_clicks) ?? actionCount(ins, "link_click"),
      linkCtr: num(ins?.inline_link_click_ctr),
      cpm: num(ins?.cpm),
      landingPageViews: actionCount(ins, "landing_page_view"),
      webLeads,
      formLeads,
      leadChannel,
      videoPlays,
      thruplays,
      result: ins ? summarizeResult(ins, goal, spend) : null,
      appointments,
      costPerAppointment: appointments ? spend / appointments : null,
      copy,
    };
  });

  const accountInsights: Graph | undefined = meta.insights?.data?.[0];
  const anyRow = insightRows[0];
  const period = accountInsights
    ? { since: accountInsights.date_start, until: accountInsights.date_stop }
    : anyRow ? { since: anyRow.date_start, until: anyRow.date_stop } : "since" in range ? { since: range.since, until: range.until } : null;

  return {
    adAccount: { id: actId, name: meta.name ?? actId, currency: meta.currency ?? "USD" },
    period,
    accountSpend: num(accountInsights?.spend) ?? 0,
    appointmentsTracked,
    ads,
    assets: detail
      ? { headlines: assetRows(titleRows, "title_asset", appointmentsTracked), bodies: assetRows(bodyRows, "body_asset", appointmentsTracked) }
      : null,
  };
}

function parseRange(body: Graph): Range | string {
  if (body.since || body.until) {
    if (!DATE_RE.test(body.since ?? "") || !DATE_RE.test(body.until ?? "")) return "since and until must be YYYY-MM-DD";
    if (body.since > body.until) return "since must not be after until";
    return { since: body.since, until: body.until };
  }
  const preset = body.preset ?? "last_30d";
  if (!PRESETS.has(preset)) return `preset must be one of ${[...PRESETS].join(", ")}`;
  return { preset };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!(await isAdminRequest(req))) return unauthorizedResponse(corsHeaders);

  try {
    const body = await req.json().catch(() => ({}));
    const range = parseRange(body);
    if (typeof range === "string") return json({ error: range, code: "BAD_REQUEST" }, 400);

    const token = Deno.env.get("META_ACCESS_TOKEN");
    if (!token) throw new MetaError("META_AUTH", "META_ACCESS_TOKEN is not set");
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Every linked account (Performance dashboard) ──────────────────────────
    if (body.scope === "all") {
      const { data: accounts, error } = await db
        .from("accounts")
        .select("id, account_name, fb_ad_account_id")
        .not("fb_ad_account_id", "is", null);
      if (error) throw new Error(`accounts: ${error.message}`);

      const detail = body.detail === true;
      const results = await Promise.all((accounts ?? []).map(async (a) => {
        try {
          return { accountId: a.id, accountName: a.account_name, ...(await loadAccount(a.fb_ad_account_id, range, detail, token)), error: null };
        } catch (e) {
          const code = e instanceof MetaError ? e.code : "ERROR";
          return { accountId: a.id, accountName: a.account_name, error: { code, message: e instanceof Error ? e.message : "Unknown error" } };
        }
      }));
      // A dead token fails every account the same way: report it once, as an error.
      if (results.length > 0 && results.every((r) => r.error?.code === "META_AUTH")) {
        throw new MetaError("META_AUTH", results[0].error!.message);
      }
      return json({ accounts: results, fetchedAt: new Date().toISOString() });
    }

    // ── One account (account page) ────────────────────────────────────────────
    const { accountId } = body;
    if (!UUID_RE.test(accountId ?? "")) return json({ error: "accountId must be a CRM account UUID", code: "BAD_REQUEST" }, 400);

    const { data: account, error } = await db.from("accounts").select("fb_ad_account_id").eq("id", accountId).maybeSingle();
    if (error) throw new Error(`accounts: ${error.message}`);
    if (!account) return json({ error: "Account not found", code: "NOT_FOUND" }, 404);

    // Not an error: the account simply isn't linked to Meta yet.
    const actId = account.fb_ad_account_id as string | null;
    if (!actId) {
      return json({ adAccount: null, period: null, accountSpend: null, appointmentsTracked: false, ads: [], assets: null, fetchedAt: new Date().toISOString() });
    }

    const result = await loadAccount(actId, range, body.detail !== false, token);
    // Callers before v2 (the old "Live creative performance" card) expect live ads only.
    if (body.v !== 2) result.ads = result.ads.filter((a) => a.live);
    return json({ ...result, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const code = error instanceof MetaError ? error.code : "ERROR";
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("meta-creative-performance error:", code, msg);
    return json({ error: msg, code }, code === "META_NO_ACCESS" ? 403 : 502);
  }
});
