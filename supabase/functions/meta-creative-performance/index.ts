import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminRequest, unauthorizedResponse } from "../_shared/admin-auth.ts";

// Live creative performance for one CRM account, read straight from the Meta
// Graph API (no storage): every ad whose effective status is ACTIVE, with its
// creative thumbnail, spend and Meta's own "Results" / "Cost per result" for
// the requested date preset. Admin-only.
//
// Results are what Ads Manager shows: the ad set's optimization event, counted
// with the account's attribution setting. Meta leaves `results` empty for
// instant-form (LEAD_GENERATION) ads, so those fall back to the form-lead
// action count, and the response says which source each number came from.

const GRAPH = "https://graph.facebook.com/v25.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRESETS = new Set(["last_7d", "last_30d", "this_month", "last_month", "maximum"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Raw Graph JSON; fields are read defensively.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Graph = Record<string, any>;

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
const GOAL_FALLBACK: Record<string, string> = {
  LEAD_GENERATION: "onsite_conversion.lead_grouped",
  QUALITY_LEAD: "onsite_conversion.lead_grouped",
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

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
    const count = num((ins.actions ?? []).find((a: Graph) => a.action_type === fallback)?.value) ?? 0;
    return { type: fallback, label: resultLabel(fallback), count, costPer: count > 0 ? spend / count : null, source: "actions" as const };
  }
  return null; // Meta reports no result for this goal; the UI says so rather than showing 0.
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!(await isAdminRequest(req))) return unauthorizedResponse(corsHeaders);

  try {
    const { accountId, preset = "last_30d" } = await req.json().catch(() => ({}));
    if (!UUID_RE.test(accountId ?? "")) return json({ error: "accountId must be a CRM account UUID", code: "BAD_REQUEST" }, 400);
    if (!PRESETS.has(preset)) return json({ error: `preset must be one of ${[...PRESETS].join(", ")}`, code: "BAD_REQUEST" }, 400);

    const token = Deno.env.get("META_ACCESS_TOKEN");
    if (!token) throw new MetaError("META_AUTH", "META_ACCESS_TOKEN is not set");

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: account, error } = await db.from("accounts").select("fb_ad_account_id").eq("id", accountId).maybeSingle();
    if (error) throw new Error(`accounts: ${error.message}`);
    if (!account) return json({ error: "Account not found", code: "NOT_FOUND" }, 404);

    // Not an error: the account simply isn't linked to Meta yet.
    const actId = account.fb_ad_account_id as string | null;
    if (!actId) return json({ adAccount: null, period: null, accountSpend: null, ads: [], fetchedAt: new Date().toISOString() });

    const [meta, firstPage] = await Promise.all([
      graph(actId, { fields: `name,currency,insights.date_preset(${preset}){spend,date_start,date_stop}` }, token),
      graph(`${actId}/ads`, {
        fields: [
          "id,name,effective_status,created_time",
          "campaign{name}",
          "adset{name,optimization_goal}",
          "creative.thumbnail_width(320).thumbnail_height(320){id,object_type,video_id,thumbnail_url}",
          `insights.date_preset(${preset}){spend,impressions,inline_link_click_ctr,results,cost_per_result,actions,date_start,date_stop}`,
        ].join(","),
        filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]),
        limit: "100",
      }, token),
    ]);

    const rawAds: Graph[] = [...(firstPage.data ?? [])];
    for (let next = firstPage.paging?.next; next; ) {
      const page = await graph(next, {}, token);
      rawAds.push(...(page.data ?? []));
      next = page.paging?.next;
    }

    const actNumber = actId.replace(/^act_/, "");
    const ads = rawAds.map((ad) => {
      const ins: Graph | undefined = ad.insights?.data?.[0];
      const spend = num(ins?.spend) ?? 0;
      return {
        id: ad.id as string,
        name: ad.name as string,
        createdTime: ad.created_time as string,
        campaign: ad.campaign?.name ?? null,
        adset: ad.adset?.name ?? null,
        optimizationGoal: ad.adset?.optimization_goal ?? null,
        format: ad.creative?.video_id || ad.creative?.object_type === "VIDEO" ? "video" : "image",
        thumbnailUrl: ad.creative?.thumbnail_url ?? null,
        adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${actNumber}&selected_ad_ids=${ad.id}`,
        // Meta returns no insights row when an ad had no impressions in the period.
        delivered: !!ins,
        spend,
        impressions: num(ins?.impressions) ?? 0,
        linkCtr: num(ins?.inline_link_click_ctr),
        result: ins ? summarizeResult(ins, ad.adset?.optimization_goal, spend) : null,
      };
    });

    const accountInsights: Graph | undefined = meta.insights?.data?.[0];
    return json({
      adAccount: { id: actId, name: meta.name ?? actId, currency: meta.currency ?? "USD" },
      period: accountInsights ? { since: accountInsights.date_start, until: accountInsights.date_stop } : null,
      accountSpend: num(accountInsights?.spend) ?? 0,
      ads,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const code = error instanceof MetaError ? error.code : "ERROR";
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("meta-creative-performance error:", code, msg);
    return json({ error: msg, code }, code === "META_NO_ACCESS" ? 403 : 502);
  }
});
