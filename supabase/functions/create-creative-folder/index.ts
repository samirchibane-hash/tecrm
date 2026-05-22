import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function findChildFolder(
  accessToken: string,
  parentId: string,
  name: string
): Promise<string | null> {
  const q = `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to search Drive folders");
  return data.files?.[0]?.id ?? null;
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
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to create Drive folder");
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request_id, account_name, ad_type, folder_name } = await req.json();

    if (!request_id || !account_name || !ad_type || !folder_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the account's top-level Drive folder
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("gdrive_folder_url")
      .eq("account_name", account_name)
      .maybeSingle();

    if (accountError) throw new Error(accountError.message);
    if (!account?.gdrive_folder_url) {
      throw new Error(
        "This client doesn't have a Drive folder yet. Create one from their account page first."
      );
    }

    const clientFolderId = extractFolderId(account.gdrive_folder_url);
    if (!clientFolderId) {
      throw new Error("Could not parse the client's Drive folder URL.");
    }

    const accessToken = await getAccessToken();

    // Find the Image Ads or Video Ads subfolder inside the client folder
    const subFolderName = ad_type === "image_ads" ? "Image Ads" : "Video Ads";
    let subFolderId = await findChildFolder(accessToken, clientFolderId, subFolderName);

    // Create it if it doesn't exist (shouldn't happen normally, but safe fallback)
    if (!subFolderId) {
      const created = await createFolder(accessToken, subFolderName, clientFolderId);
      subFolderId = created.id;
    }

    // Create the brief folder inside Image Ads / Video Ads
    const briefFolder = await createFolder(accessToken, folder_name, subFolderId);

    // Persist the URL back to the creative request
    const { error: updateError } = await supabase
      .from("creative_requests")
      .update({
        gdrive_folder_url: briefFolder.webViewLink,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    if (updateError) throw new Error(updateError.message);

    return new Response(
      JSON.stringify({ folder_url: briefFolder.webViewLink }),
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
