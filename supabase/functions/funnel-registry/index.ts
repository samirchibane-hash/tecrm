import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, entry } = await req.json();
    const supabase = getSupabase();

    if (action === "get") {
      const { data, error } = await supabase
        .from("funnel_clients")
        .select("slug, name, domain, tecrm_id, created, pages")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Shape matches RegistryEntry type on the frontend
      const registry = (data ?? []).map((r) => ({
        slug: r.slug,
        name: r.name,
        domain: r.domain,
        tecrmId: r.tecrm_id,
        created: r.created,
        pages: r.pages,
      }));

      return new Response(JSON.stringify({ registry }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "patch") {
      if (!entry) throw new Error("Missing entry in request body");

      const { error } = await supabase
        .from("funnel_clients")
        .upsert({
          slug: entry.slug,
          name: entry.name,
          domain: entry.domain,
          tecrm_id: entry.tecrmId,
          created: entry.created,
          pages: entry.pages,
        }, { onConflict: "slug" });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("funnel-registry error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
