import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Google OAuth ────────────────────────────────────────────────────────────

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

// ── Drive helpers ───────────────────────────────────────────────────────────

function extractFolderIdFromUrl(url: string): string | null {
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function findSubFolder(
  accessToken: string,
  parentId: string,
  name: string
): Promise<string | null> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
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
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to create folder");
  return data;
}

async function uploadFileToDrive(
  accessToken: string,
  parentFolderId: string,
  fileName: string,
  mimeType: string,
  fileBuffer: ArrayBuffer
): Promise<{ id: string; webViewLink: string }> {
  const metadata = JSON.stringify({ name: fileName, parents: [parentFolderId] });
  const boundary = "-------boundary-------";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`;
  const filePart = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

  const encoder = new TextEncoder();
  const metadataBytes = encoder.encode(metadataPart);
  const filePartBytes = encoder.encode(filePart);
  const closeBytes = encoder.encode(closeDelimiter);

  const body = new Uint8Array(
    metadataBytes.byteLength + filePartBytes.byteLength + fileBuffer.byteLength + closeBytes.byteLength
  );
  body.set(metadataBytes, 0);
  body.set(filePartBytes, metadataBytes.byteLength);
  body.set(new Uint8Array(fileBuffer), metadataBytes.byteLength + filePartBytes.byteLength);
  body.set(closeBytes, metadataBytes.byteLength + filePartBytes.byteLength + fileBuffer.byteLength);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary="${boundary}"`,
        "Content-Length": body.byteLength.toString(),
      },
      body,
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Failed to upload ${fileName}`);
  return data;
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      account_name,
      ad_type,         // 'image_ads' | 'video_ads'
      template_name,
      ad_angle,
      offer_type,
      notes,
      gdrive_parent_folder_url,
      files,           // Array<{ storage_path, file_name, mime_type, file_size, storage_url }>
    } = await req.json();

    if (!account_name || !ad_type || !template_name || !ad_angle || !offer_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!gdrive_parent_folder_url) {
      return new Response(
        JSON.stringify({ error: "Client has no Google Drive folder linked. Add one in the client profile." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parentFolderId = extractFolderIdFromUrl(gdrive_parent_folder_url);
    if (!parentFolderId) {
      return new Response(JSON.stringify({ error: "Could not parse Google Drive folder ID from URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const accessToken = await getAccessToken();

    // Find the Image Ads or Video Ads sub-folder within the client folder
    const adTypeFolderName = ad_type === "image_ads" ? "Image Ads" : "Video Ads";
    let adTypeFolderId = await findSubFolder(accessToken, parentFolderId, adTypeFolderName);

    // If the sub-folder doesn't exist yet, create it
    if (!adTypeFolderId) {
      const created = await createFolder(accessToken, adTypeFolderName, parentFolderId);
      adTypeFolderId = created.id;
    }

    // Create the batch sub-folder: "Template Name - Ad Angle - Offer Type"
    const batchFolderName = `${template_name} - ${ad_angle} - ${offer_type}`;
    const batchFolder = await createFolder(accessToken, batchFolderName, adTypeFolderId);

    // Create the batch record first
    const { data: batch, error: batchErr } = await supabase
      .from("creative_batches")
      .insert({
        account_name,
        ad_type,
        template_name,
        ad_angle,
        offer_type,
        notes: notes ?? null,
        gdrive_folder_id: batchFolder.id,
        gdrive_folder_url: batchFolder.webViewLink,
        file_count: files?.length ?? 0,
      })
      .select()
      .single();

    if (batchErr) throw new Error(batchErr.message);

    // Upload each file to Drive and record it
    const uploadResults = [];
    for (const file of (files ?? [])) {
      try {
        // Download file from Supabase Storage public URL
        const fileRes = await fetch(file.storage_url);
        if (!fileRes.ok) throw new Error(`Failed to fetch file: ${file.file_name}`);
        const fileBuffer = await fileRes.arrayBuffer();

        const driveFile = await uploadFileToDrive(
          accessToken,
          batchFolder.id,
          file.file_name,
          file.mime_type ?? "application/octet-stream",
          fileBuffer
        );

        const { error: uploadErr } = await supabase.from("creative_uploads").insert({
          batch_id: batch.id,
          file_name: file.file_name,
          storage_path: file.storage_path,
          storage_url: file.storage_url,
          gdrive_file_id: driveFile.id,
          gdrive_view_url: driveFile.webViewLink,
          mime_type: file.mime_type,
          file_size: file.file_size,
        });

        if (uploadErr) throw new Error(uploadErr.message);
        uploadResults.push({ file_name: file.file_name, success: true, gdrive_view_url: driveFile.webViewLink });
      } catch (fileErr) {
        uploadResults.push({
          file_name: file.file_name,
          success: false,
          error: fileErr instanceof Error ? fileErr.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        batch_id: batch.id,
        gdrive_folder_url: batchFolder.webViewLink,
        files: uploadResults,
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
