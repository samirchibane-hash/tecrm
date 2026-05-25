import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="npm:@types/nunjucks"
import nunjucks from "npm:nunjucks@3.2.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let TEMPLATES: Record<string, string> | null = null;

async function getTemplates(): Promise<Record<string, string>> {
  if (TEMPLATES) return TEMPLATES;
  const token = Deno.env.get("GITHUB_TOKEN");
  const owner = Deno.env.get("GITHUB_OWNER") || "samirchibane-hash";
  const repo = Deno.env.get("GITHUB_REPO") || "tecrm";
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/main/supabase/functions/funnel-generate/templates`;
  const headers: Record<string, string> = token ? { Authorization: `token ${token}` } : {};
  const [lp1, lp2, cal] = await Promise.all([
    fetch(`${base}/landing-page-1.html`, { headers }).then(r => r.text()),
    fetch(`${base}/landing-page-2.html`, { headers }).then(r => r.text()),
    fetch(`${base}/calendar.html`, { headers }).then(r => r.text()),
  ]);
  TEMPLATES = { "landing-1": lp1, "landing-2": lp2, "schedule": cal };
  return TEMPLATES;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pageType, config } = await req.json();
    const templates = await getTemplates();
    const template = templates[pageType];
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
