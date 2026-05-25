import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="npm:@types/nunjucks"
import nunjucks from "npm:nunjucks@3.2.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATES: Record<string, string> = {
  "landing-1": Deno.readTextFileSync(new URL("./templates/landing-page-1.html", import.meta.url)),
  "landing-2": Deno.readTextFileSync(new URL("./templates/landing-page-2.html", import.meta.url)),
  "schedule": Deno.readTextFileSync(new URL("./templates/calendar.html", import.meta.url)),
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pageType, config } = await req.json();

    const template = TEMPLATES[pageType];
    if (!template) throw new Error(`Unknown page type: ${pageType}`);

    const env = new nunjucks.Environment();
    const html = env.renderString(template, { config });

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("funnel-preview error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
