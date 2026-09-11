import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LOG_SINCE = "2026-09-01T00:00:00Z";

export type LogCommit = {
  repo: string;
  sha: string;
  committed_at: string;
  author_name: string | null;
  subject: string;
  body: string | null;
  claude_coauthored: boolean;
  files: string[];
  additions: number | null;
  deletions: number | null;
  html_url: string | null;
  source: string;
  links: { account_id: string; matched_by: string }[];
};

const COMMIT_COLUMNS =
  "repo, sha, committed_at, author_name, subject, body, claude_coauthored, files, additions, deletions, html_url, source";

/**
 * Commits since LOG_SINCE with the CRM accounts each one is linked to, newest
 * first. With `accountId`, only that account's commits (an inner join on the
 * link table), for per-client views.
 */
export function useClaudeLog(accountId?: string) {
  return useQuery({
    queryKey: ["claude-log", accountId ?? "all"],
    queryFn: async () => {
      const embed = accountId
        ? "github_commit_accounts!inner(account_id, matched_by)"
        : "github_commit_accounts(account_id, matched_by)";
      let query = supabase
        .from("github_commits")
        .select(`${COMMIT_COLUMNS}, ${embed}`)
        .gte("committed_at", LOG_SINCE)
        .order("committed_at", { ascending: false })
        .limit(2000);
      if (accountId) query = query.eq("github_commit_accounts.account_id", accountId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(({ github_commit_accounts, ...c }) => ({
        ...c,
        links: github_commit_accounts ?? [],
      })) as LogCommit[];
    },
    staleTime: 60_000,
  });
}

export function useGitHubTokenStatus() {
  return useQuery({
    queryKey: ["github-token-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("github_token_status");
      if (error) throw error;
      return data as { configured: boolean; updated_at: string | null };
    },
  });
}

export const repoShortName = (repo: string) => repo.split("/")[1] ?? repo;
