import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COUPLER_URL =
  "https://app.coupler.io/export/w/8c3caa8c-40bc-44c5-945a-f5a126bebb31.json?access_token=f4b13e2fad555ddc856d402c6db84de9c95c52f31235183c52113cfb444a";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const res = await fetch(COUPLER_URL);
    if (!res.ok) {
      throw new Error(`Coupler.io returned ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Coupler proxy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
