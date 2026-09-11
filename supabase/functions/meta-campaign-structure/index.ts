import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

// Deliberately excludes `business` — the shared META_ACCESS_TOKEN lacks
// business_management, and requesting it fails the whole call with (#100).
const ACCOUNT_FIELDS = "name,currency,timezone_name,account_status";

const CAMPAIGN_FIELDS = [
  "id", "name", "status", "effective_status", "objective", "buying_type",
  "daily_budget", "lifetime_budget", "bid_strategy", "special_ad_categories",
  "start_time", "stop_time", "created_time", "updated_time",
].join(",");

// Everything needed to reproduce an ad set by hand in Ads Manager.
const ADSET_FIELDS = [
  "id", "name", "status", "effective_status", "campaign_id",
  "daily_budget", "lifetime_budget", "budget_remaining",
  "bid_amount", "bid_strategy", "billing_event", "optimization_goal",
  "destination_type", "promoted_object", "attribution_spec",
  "start_time", "end_time", "targeting", "created_time", "updated_time",
].join(",");

const AD_FIELDS = "id,name,status,effective_status,adset_id,creative{id,name}";

// Raised when Meta rejects the access token itself (expired / revoked / wrong
// scope) rather than the specific object being requested.
class MetaAuthError extends Error {}

async function graphGet(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const body = await res.text();
  let json: any = {};
  try { json = JSON.parse(body); } catch { /* non-JSON */ }

  if (!res.ok || json.error) {
    const code = json.error?.code;
    const type = json.error?.type;
    if (res.status === 401 || code === 190 || type === "OAuthException") {
      throw new MetaAuthError(
        "Meta access token is invalid or expired. Update META_ACCESS_TOKEN in Supabase → Edge Functions → Secrets."
      );
    }
    throw new Error(json.error?.message ?? `Meta API error: ${res.status} ${body}`);
  }
  return json;
}

// Walks every page of an edge so a 26-ad-set campaign doesn't silently return 25.
async function graphGetAll(path: string, params: Record<string, string>, token: string) {
  const rows: any[] = [];
  let json = await graphGet(path, { ...params, limit: "200" }, token);
  rows.push(...(json.data ?? []));

  let next: string | null = json.paging?.next ?? null;
  while (next) {
    const res = await fetch(next);
    const body = await res.text();
    let page: any = {};
    try { page = JSON.parse(body); } catch { /* non-JSON */ }
    if (!res.ok || page.error) {
      throw new Error(page.error?.message ?? `Meta paging error: ${res.status} ${body}`);
    }
    rows.push(...(page.data ?? []));
    next = page.paging?.next ?? null;
  }
  return rows;
}

// Meta returns budgets as integer strings in the account's minor unit (cents for
// USD). Surface both so callers never have to guess which one they're holding.
function budget(raw: string | undefined | null) {
  if (raw === undefined || raw === null || raw === "") return null;
  const minor = parseInt(raw, 10);
  if (Number.isNaN(minor)) return null;
  return { minor_units: minor, amount: minor / 100 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("META_ACCESS_TOKEN");
    if (!token) throw new Error("META_ACCESS_TOKEN is not set");

    const { ad_account_id, campaign_name, campaign_id, include_ads = false } =
      await req.json();

    if (!ad_account_id) {
      return new Response(JSON.stringify({ error: "ad_account_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept with or without the act_ prefix.
    const accountId = `act_${ad_account_id.toString().replace(/^act_/, "")}`;

    const account = await graphGet(accountId, { fields: ACCOUNT_FIELDS }, token);

    let campaigns = await graphGetAll(`${accountId}/campaigns`, { fields: CAMPAIGN_FIELDS }, token);

    // Filter client-side: substring match survives the em-dash / hyphen and
    // spacing drift that real campaign names accumulate.
    if (campaign_id) {
      campaigns = campaigns.filter((c) => c.id === campaign_id.toString());
    } else if (campaign_name) {
      const needle = campaign_name.toString().toLowerCase().trim();
      campaigns = campaigns.filter((c) => (c.name ?? "").toLowerCase().includes(needle));
    }

    const detailed = await Promise.all(
      campaigns.map(async (c) => {
        const adsets = await graphGetAll(`${c.id}/adsets`, { fields: ADSET_FIELDS }, token);

        const shapedAdsets = await Promise.all(
          adsets.map(async (a) => {
            const shaped: Record<string, unknown> = {
              id: a.id,
              name: a.name,
              status: a.status,
              effective_status: a.effective_status,
              daily_budget: budget(a.daily_budget),
              lifetime_budget: budget(a.lifetime_budget),
              budget_remaining: budget(a.budget_remaining),
              bid_amount: budget(a.bid_amount),
              bid_strategy: a.bid_strategy ?? null,
              billing_event: a.billing_event ?? null,
              optimization_goal: a.optimization_goal ?? null,
              destination_type: a.destination_type ?? null,
              promoted_object: a.promoted_object ?? null,
              attribution_spec: a.attribution_spec ?? null,
              start_time: a.start_time ?? null,
              end_time: a.end_time ?? null,
              created_time: a.created_time ?? null,
              updated_time: a.updated_time ?? null,
              targeting: a.targeting ?? null,
            };
            if (include_ads) {
              shaped.ads = (await graphGetAll(`${a.id}/ads`, { fields: AD_FIELDS }, token))
                .map((ad) => ({
                  id: ad.id,
                  name: ad.name,
                  status: ad.status,
                  effective_status: ad.effective_status,
                  creative_id: ad.creative?.id ?? null,
                  creative_name: ad.creative?.name ?? null,
                }));
            }
            return shaped;
          })
        );

        return {
          id: c.id,
          name: c.name,
          status: c.status,
          effective_status: c.effective_status,
          objective: c.objective ?? null,
          buying_type: c.buying_type ?? null,
          bid_strategy: c.bid_strategy ?? null,
          special_ad_categories: c.special_ad_categories ?? [],
          daily_budget: budget(c.daily_budget),
          lifetime_budget: budget(c.lifetime_budget),
          start_time: c.start_time ?? null,
          stop_time: c.stop_time ?? null,
          created_time: c.created_time ?? null,
          adset_count: shapedAdsets.length,
          adsets: shapedAdsets,
        };
      })
    );

    return new Response(
      JSON.stringify({
        account: {
          id: accountId,
          name: account.name,
          currency: account.currency,
          timezone: account.timezone_name,
          account_status: account.account_status,
        },
        // Distinguishes "campaign exists but is empty" from "filter matched nothing".
        matched_campaigns: detailed.length,
        campaigns: detailed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const isAuth = error instanceof MetaAuthError;
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("meta-campaign-structure error:", msg);
    return new Response(
      JSON.stringify({ error: msg, code: isAuth ? "META_AUTH" : "META_ERROR" }),
      {
        status: isAuth ? 502 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
