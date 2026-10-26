import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { KillReview } from "@/components/kill-review/KillReview";
import { killReviewRuns, loadKillReviews } from "@/lib/killReview/load";
import type { KillReviewAccount } from "@/lib/killReview/types";

const RUN_PARAM = "run";

/**
 * Team-only tab on Creatives. The route sits behind AuthGate. Data is the
 * bundled fixture until creative_kill_reviews is applied and Yan publishes into it.
 */
export function KillReviewTab({
  accounts,
  hiddenAccounts,
  settingsLoading,
  settingsError,
}: {
  accounts: KillReviewAccount[];
  hiddenAccounts: string[];
  settingsLoading: boolean;
  settingsError: boolean;
}) {
  const runs = useMemo(() => killReviewRuns(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(RUN_PARAM);
  const run = runs.find((item) => item.runDate === requested) ?? runs[0];

  const rows = useMemo(() => {
    if (settingsLoading || !run) return null;
    return loadKillReviews({
      runDate: run.runDate,
      hiddenAccounts,
      accounts,
    });
  }, [settingsLoading, run, hiddenAccounts, accounts]);

  if (!run) {
    return (
      <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No kill-review runs are bundled.
      </p>
    );
  }

  return (
    <KillReview
      run={run}
      runs={runs}
      onRunDate={(runDate) => {
        const next = new URLSearchParams(searchParams);
        next.set(RUN_PARAM, runDate);
        setSearchParams(next, { replace: true });
      }}
      rows={rows}
      error={settingsError ? "Couldn't read which accounts are hidden, so this list may include one." : null}
    />
  );
}
