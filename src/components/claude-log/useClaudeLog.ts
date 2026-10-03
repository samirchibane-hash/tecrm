import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rowToWorkEvent, sliceForClient, type WorkEvent } from "./workStream";

export const LOG_SINCE = "2026-09-01T00:00:00Z";

/**
 * The shared work stream since LOG_SINCE, newest first. With `accountId`,
 * only that client's events — the Recent work slice. /claude-log omits it
 * and filters in the page.
 */
export function useWorkStream(accountId?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["claude-log", accountId ?? "all"],
    enabled: opts?.enabled ?? true,
    queryFn: async (): Promise<WorkEvent[]> => {
      let query = supabase
        .from("client_work_events")
        .select("*")
        .gte("occurred_at", LOG_SINCE)
        .order("occurred_at", { ascending: false })
        .limit(2000);
      if (accountId) query = query.contains("account_ids", [accountId]);

      const { data, error } = await query;
      if (error) throw error;
      const events = (data ?? []).flatMap((row) => {
        const event = rowToWorkEvent(row);
        return event ? [event] : [];
      });
      return accountId ? sliceForClient(events, accountId) : events;
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
