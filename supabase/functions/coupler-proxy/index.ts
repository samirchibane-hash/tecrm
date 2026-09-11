import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminRequest, unauthorizedResponse } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-report-token",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIELDS = "account_name,campaign_id,campaign_name,spend,clicks,impressions,reach,cpc,cpm,ctr,frequency,date_start,date_stop";

// Raised when Meta rejects the access token itself (expired / revoked / wrong
// scope). This is a global problem, not a single-account one, so it must be
// surfaced clearly rather than silently zeroing the dashboard.
class MetaAuthError extends Error {}

function zeroRow(accountName: string, date: string) {
  return {
    "Account: Account name": accountName,
    "Campaign: Campaign Id": "",
    "Campaign: Campaign name": "",
    "Clicks: CTR": 0,
    "Cost: Amount spend": 0,
    "Cost: CPC": 0,
    "Cost: CPM": 0,
    "Performance: Clicks": 0,
    "Performance: Frequency": 0,
    "Performance: Impressions": 0,
    "Performance: Reach": 0,
    "Report: Date": date,
    "Report: End date": date,
    "Conversions: Website Appointments Scheduled - Total": null,
    "Conversions: Website Appointments Scheduled - Unique": null,
    "Conversions: Website Appointments Scheduled - Value": null,
    "Conversions: Website Appointments Scheduled - Cost": null,
    "Conversions: Website Appointments Scheduled - Unique Cost": null,
    "Conversions: Appointments Scheduled - Total": null,
    "Conversions: Appointments Scheduled - Unique": null,
    "Conversions: Appointments Scheduled - Value": null,
    "Conversions: Appointments Scheduled - Cost": null,
    "Conversions: Appointments Scheduled - Unique Cost": null,
    "Conversions: Leads - Total": null,
    "Conversions: Leads - Unique": null,
    "Conversions: Leads - Value": null,
    "Conversions: Leads - Cost": null,
    "Conversions: Leads - Unique Cost": null,
    "Conversions: All On-Facebook Leads - Total": null,
    "Conversions: All On-Facebook Leads - Unique": null,
    "Conversions: All On-Facebook Leads - Value": null,
    "Conversions: All On-Facebook Leads - Cost": null,
    "Conversions: All On-Facebook Leads - Unique Cost": null,
  };
}

async function fetchAccountInsights(accountId: string, token: string) {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  const url = new URL(`https://graph.facebook.com/v21.0/${accountId}/insights`);
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since, until: today }));
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", token);

  const rows: unknown[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      const body = await res.text();
      let code: number | undefined;
      let type: string | undefined;
      try { const j = JSON.parse(body); code = j.error?.code; type = j.error?.type; } catch { /* non-JSON */ }
      // Meta signals a bad token with HTTP 401 or error code 190 / OAuthException.
      if (res.status === 401 || code === 190 || type === "OAuthException") {
        throw new MetaAuthError(
          "Meta access token is invalid or expired. Update META_ACCESS_TOKEN in Supabase → Edge Functions → Secrets."
        );
      }
      throw new Error(`Meta API error for ${accountId}: ${res.status} ${body}`);
    }
    const json = await res.json();
    rows.push(...(json.data ?? []));
    nextUrl = json.paging?.next ?? null;
  }

  if (rows.length === 0) {
    const nameRes = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}?fields=name&access_token=${token}`
    );
    const nameJson = nameRes.ok ? await nameRes.json() : {};
    return [zeroRow(nameJson.name ?? accountId, today)];
  }

  return rows.map((r: any) => ({
    "Account: Account name": r.account_name ?? "",
    "Campaign: Campaign Id": r.campaign_id ?? "",
    "Campaign: Campaign name": r.campaign_name ?? "",
    "Clicks: CTR": parseFloat(r.ctr) || 0,
    "Cost: Amount spend": parseFloat(r.spend) || 0,
    "Cost: CPC": parseFloat(r.cpc) || 0,
    "Cost: CPM": parseFloat(r.cpm) || 0,
    "Performance: Clicks": parseInt(r.clicks) || 0,
    "Performance: Frequency": parseFloat(r.frequency) || 0,
    "Performance: Impressions": parseInt(r.impressions) || 0,
    "Performance: Reach": parseInt(r.reach) || 0,
    "Report: Date": r.date_start ?? "",
    "Report: End date": r.date_stop ?? "",
    "Conversions: Website Appointments Scheduled - Total": null,
    "Conversions: Website Appointments Scheduled - Unique": null,
    "Conversions: Website Appointments Scheduled - Value": null,
    "Conversions: Website Appointments Scheduled - Cost": null,
    "Conversions: Website Appointments Scheduled - Unique Cost": null,
    "Conversions: Appointments Scheduled - Total": null,
    "Conversions: Appointments Scheduled - Unique": null,
    "Conversions: Appointments Scheduled - Value": null,
    "Conversions: Appointments Scheduled - Cost": null,
    "Conversions: Appointments Scheduled - Unique Cost": null,
    "Conversions: Leads - Total": null,
    "Conversions: Leads - Unique": null,
    "Conversions: Leads - Value": null,
    "Conversions: Leads - Cost": null,
    "Conversions: Leads - Unique Cost": null,
    "Conversions: All On-Facebook Leads - Total": null,
    "Conversions: All On-Facebook Leads - Unique": null,
    "Conversions: All On-Facebook Leads - Value": null,
    "Conversions: All On-Facebook Leads - Cost": null,
    "Conversions: All On-Facebook Leads - Unique Cost": null,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("META_ACCESS_TOKEN");
    if (!token) throw new Error("META_ACCESS_TOKEN is not set");

    // Pull ad account IDs dynamically from the accounts table
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let accountsQuery = supabase
      .from("accounts")
      .select("fb_ad_account_id")
      .not("fb_ad_account_id", "is", null);

    // Signed-in admins get every account. A client report page instead sends its
    // report token, which unlocks exactly one account's ad data.
    if (!(await isAdminRequest(req))) {
      const reportToken = req.headers.get("x-report-token") ?? "";
      if (!UUID_RE.test(reportToken)) return unauthorizedResponse(corsHeaders);
      accountsQuery = accountsQuery.eq("report_token", reportToken);
    }

    const { data: accounts, error } = await accountsQuery;

    if (error) throw new Error(`Failed to load accounts: ${error.message}`);

    const adAccountIds = (accounts ?? [])
      .map((a) => a.fb_ad_account_id as string)
      .filter(Boolean);

    if (adAccountIds.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch every account independently so one failing account can't blank the
    // whole dashboard. Partial data beats no data; a total failure is surfaced.
    const settled = await Promise.allSettled(
      adAccountIds.map((id) => fetchAccountInsights(id, token))
    );

    const rows = settled
      .filter((s): s is PromiseFulfilledResult<unknown[]> => s.status === "fulfilled")
      .flatMap((s) => s.value);
    const failures = settled
      .filter((s): s is PromiseRejectedResult => s.status === "rejected")
      .map((s) => s.reason);

    if (failures.length > 0) {
      console.error("coupler-proxy account failures:", failures.map((e) => (e instanceof Error ? e.message : String(e))));
    }

    // A bad token (or every account failing) means the numbers would be wrong,
    // not zero — return an error the UI can show instead of misleading data.
    const authError = failures.find((e) => e instanceof MetaAuthError) as MetaAuthError | undefined;
    if (rows.length === 0 && failures.length > 0) {
      const first = failures[0];
      const msg = authError?.message ?? (first instanceof Error ? first.message : "Meta request failed");
      return new Response(JSON.stringify({ error: msg, code: authError ? "META_AUTH" : "META_ERROR" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(rows), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Meta proxy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
