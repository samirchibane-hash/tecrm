import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SyncSource = "stripe" | "github";

export const SYNC_SOURCES = {
  stripe: { table: "stripe_sync_runs", fn: "stripe-sync", label: "Stripe" },
  github: { table: "github_sync_runs", fn: "github-sync", label: "GitHub" },
} as const;

export type SyncRun = {
  id: number;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  error: string | null;
  counts: Record<string, number> | null;
};

/**
 * The latest sync attempt plus the latest successful one. Freshness is the
 * last *successful* run — a failed run after it doesn't make the data newer.
 */
export function useSyncRuns(source: SyncSource) {
  const { table } = SYNC_SOURCES[source];
  return useQuery({
    queryKey: ["sync-runs", source],
    queryFn: async () => {
      const [latest, lastOk] = await Promise.all([
        supabase.from(table).select("*").order("id", { ascending: false }).limit(1).maybeSingle(),
        supabase.from(table).select("*").eq("ok", true).order("id", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (latest.error) throw latest.error;
      if (lastOk.error) throw lastOk.error;
      return { latest: latest.data as SyncRun | null, lastOk: lastOk.data as SyncRun | null };
    },
    refetchInterval: 60_000,
  });
}

/** Run a sync on demand, then refresh everything that reads its tables. */
export function useRunSync(source: SyncSource, invalidate: string[][] = []) {
  const queryClient = useQueryClient();
  const { fn, label } = SYNC_SOURCES[source];
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(fn);
      // A non-2xx leaves `data` null and puts the reason in the response body.
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
      if (data && data.ok === false) throw new Error(data.error ?? `${label} sync failed`);
      return data;
    },
    onSuccess: () => toast.success(`${label} synced`),
    onError: (err: Error) => toast.error(`${label} sync failed: ${err.message}`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-runs", source] });
      for (const key of invalidate) queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
