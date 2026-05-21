import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIELDS = "account_name,campaign_id,campaign_name,spend,clicks,impressions,reach,cpc,cpm,ctr,frequency,date_start,date_stop";

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
    if (!res.ok) throw new Error(`Meta API error for ${accountId}: ${res.status} ${await res.text()}`);
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

    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("fb_ad_account_id")
      .not("fb_ad_account_id", "is", null);

    if (error) throw new Error(`Failed to load accounts: ${error.message}`);

    const adAccountIds = (accounts ?? [])
      .map((a) => a.fb_ad_account_id as string)
      .filter(Boolean);

    if (adAccountIds.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(
      adAccountIds.map((id) => fetchAccountInsights(id, token))
    );

    return new Response(JSON.stringify(results.flat()), {
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
