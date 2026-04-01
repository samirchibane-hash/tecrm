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

    const { searchTerms, country = "US", adType = "ALL", limit = 20 } = await req.json();
    if (!searchTerms) throw new Error("searchTerms is required");

    // Start actor run
    const runRes = await fetch(
      "https://api.apify.com/v2/acts/apify~facebook-ads-library-scraper/runs?token=" + apifyToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerms: [searchTerms],
          country,
          adType,
          maxResults: limit,
        }),
      }
    );

    if (!runRes.ok) {
      const err = await runRes.text();
      throw new Error(`Apify start error ${runRes.status}: ${err}`);
    }

    const runData = await runRes.json();
    const runId = runData.data?.id;
    if (!runId) throw new Error("No run ID returned from Apify");

    // Poll for completion (max 60s)
    let status = "RUNNING";
    let attempts = 0;
    while (status === "RUNNING" || status === "READY") {
      await new Promise((r) => setTimeout(r, 3000));
      attempts++;
      if (attempts > 20) throw new Error("Apify run timed out");

      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      const statusData = await statusRes.json();
      status = statusData.data?.status;
    }

    if (status !== "SUCCEEDED") throw new Error(`Apify run ended with status: ${status}`);

    // Fetch results
    const datasetId = runData.data?.defaultDatasetId;
    const resultsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=${limit}`
    );

    if (!resultsRes.ok) throw new Error(`Apify results error ${resultsRes.status}`);

    const results = await resultsRes.json();

    return new Response(JSON.stringify({ success: true, ads: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("apify-competitor error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
