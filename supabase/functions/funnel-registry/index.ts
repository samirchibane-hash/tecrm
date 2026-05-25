import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Octokit } from "npm:@octokit/rest@20.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REGISTRY_PATH = "clients/registry.json";

async function getOctokit() {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN secret not configured");
  return new Octokit({ auth: token });
}

function getRepo() {
  const owner = Deno.env.get("GITHUB_OWNER");
  const repo = Deno.env.get("GITHUB_REPO");
  if (!owner || !repo) throw new Error("GITHUB_OWNER or GITHUB_REPO not configured");
  return { owner, repo };
}

// deno-lint-ignore no-explicit-any
async function readRegistry(octokit: Octokit): Promise<any[]> {
  const { owner, repo } = getRepo();
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: REGISTRY_PATH });
    if ("content" in data) {
      const content = atob(data.content.replace(/\n/g, ""));
      return JSON.parse(content);
    }
    return [];
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, entry } = body;

    const octokit = await getOctokit();
    const { owner, repo } = getRepo();

    if (action === "get") {
      const registry = await readRegistry(octokit);
      return new Response(JSON.stringify({ registry }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "patch") {
      if (!entry) throw new Error("Missing entry in request body");

      const existing = await readRegistry(octokit);
      const updated = existing.filter((e: { slug: string }) => e.slug !== entry.slug);
      updated.push(entry);
      const newContent = JSON.stringify(updated, null, 2);

      // Get current file SHA (needed for update)
      let fileSha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: REGISTRY_PATH });
        if ("sha" in data) fileSha = data.sha;
      } catch {
        // File doesn't exist yet — create it
      }

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: REGISTRY_PATH,
        message: `chore: update client registry — add ${entry.name}`,
        content: btoa(newContent),
        ...(fileSha ? { sha: fileSha } : {}),
      });

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
