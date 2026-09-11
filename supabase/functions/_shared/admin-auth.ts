import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// True when the request carries a signed-in user's JWT whose email is on the
// admin_users allowlist (public.is_admin()). The public anon key is itself a
// valid JWT, so `verify_jwt` alone lets anyone in — this is the real check.
export async function isAdminRequest(req: Request): Promise<boolean> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

export function unauthorizedResponse(corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
