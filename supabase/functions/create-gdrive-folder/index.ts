import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PARENT_FOLDER_ID = "1tYtKZdKn7pFhZOW4WU84zivqVargxw4c";
const SUB_FOLDERS = ["Video Ads", "Image Ads", "Brand & Systems"];

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN")!,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? "Failed to get access token");
  return data.access_token;
}

async function createFolder(
  accessToken: string,
  name: string,
  parentId: string
): Promise<{ id: string; webViewLink: string }> {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to create folder");
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client_id, client_name } = await req.json();
    if (!client_id || !client_name) {
      return new Response(JSON.stringify({ error: "client_id and client_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();

    const mainFolder = await createFolder(accessToken, client_name, PARENT_FOLDER_ID);
    await Promise.all(SUB_FOLDERS.map((name) => createFolder(accessToken, name, mainFolder.id)));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } = await supabase
      .from("clients")
      .update({ gdrive_folder_url: mainFolder.webViewLink })
      .eq("id", client_id);

    if (updateError) throw new Error(updateError.message);

    return new Response(
      JSON.stringify({ folder_url: mainFolder.webViewLink }),
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
