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
    const apifyToken = Deno.env.get("APIFY_API_TOKEN");
    if (!apifyToken) throw new Error("APIFY_API_TOKEN not configured");

    const { action, searchTerms, country = "US", adType = "ALL", limit = 20, runId, datasetId } = await req.json();

    // ACTION: poll — check run status and return results if done
    if (action === "poll") {
      if (!runId) throw new Error("runId is required for poll");
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const statusData = await statusRes.json();
      const status = statusData.data?.status;

      if (status === "RUNNING" || status === "READY" || status === "ABORTING") {
        return new Response(JSON.stringify({ status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (status !== "SUCCEEDED") throw new Error(`Apify run ended with status: ${status}`);

      const resultsRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=${limit}`
      );
      if (!resultsRes.ok) throw new Error(`Apify results error ${resultsRes.status}`);
      const ads = await resultsRes.json();

      return new Response(JSON.stringify({ status: "SUCCEEDED", ads }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: start — kick off the actor run
    if (!searchTerms) throw new Error("searchTerms is required");
    const fbUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=${adType === "ALL" ? "all" : adType.toLowerCase()}&country=${country}&q=${encodeURIComponent(searchTerms)}`;

    const runRes = await fetch(
      "https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs?token=" + apifyToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUrls: [{ url: fbUrl }], maxResults: limit }),
      }
    );

    if (!runRes.ok) {
      const err = await runRes.text();
      throw new Error(`Apify start error ${runRes.status}: ${err}`);
    }

    const runData = await runRes.json();
    const newRunId = runData.data?.id;
    const newDatasetId = runData.data?.defaultDatasetId;
    if (!newRunId) throw new Error("No run ID returned from Apify");

    return new Response(JSON.stringify({ status: "RUNNING", runId: newRunId, datasetId: newDatasetId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("apify-competitor error:", msg);
    // Return 200 so the client can read the error body
    return new Response(JSON.stringify({ error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
