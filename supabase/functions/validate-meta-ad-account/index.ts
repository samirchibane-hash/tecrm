import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ad_account_id } = await req.json();
    if (!ad_account_id) {
      return new Response(JSON.stringify({ error: "ad_account_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("META_ACCESS_TOKEN");
    if (!token) throw new Error("META_ACCESS_TOKEN is not set");

    // Normalize — accept with or without act_ prefix
    const normalized = ad_account_id.toString().replace(/^act_/, "");
    const accountId = `act_${normalized}`;

    const url = new URL(`https://graph.facebook.com/v21.0/${accountId}`);
    url.searchParams.set("fields", "name,currency,timezone_name,account_status,business");
    url.searchParams.set("access_token", token);

    const res = await fetch(url.toString());
    const json = await res.json();

    if (!res.ok || json.error) {
      return new Response(
        JSON.stringify({ error: json.error?.message ?? "Invalid ad account ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // account_status: 1=Active, 2=Disabled, 3=Unsettled, 7=PendingRiskReview, 9=InGracePeriod, 100=PendingClosure, 101=Closed, 201=AnyActiveCampaign
    const statusMap: Record<number, string> = {
      1: "Active",
      2: "Disabled",
      3: "Unsettled",
      7: "Pending Review",
      9: "In Grace Period",
      100: "Pending Closure",
      101: "Closed",
    };

    return new Response(
      JSON.stringify({
        id: accountId,
        name: json.name,
        currency: json.currency,
        timezone: json.timezone_name,
        status: statusMap[json.account_status] ?? "Unknown",
        status_code: json.account_status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
