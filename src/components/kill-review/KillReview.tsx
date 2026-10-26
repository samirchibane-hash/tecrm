import { useEffect, useMemo, useState } from "react";
import { Ban, CircleDollarSign, Flag } from "lucide-react";
import { toast } from "sonner";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { KillReviewCard } from "@/components/kill-review/KillReviewCard";
import { formatKillMoney, formatKillRange } from "@/lib/killReview/format";
import type { KillRunMeta } from "@/lib/killReview/load";
import {
  copyReply,
  filterKillReviews,
  killReviewTotals,
  sortKillReviews,
  type KillSort,
  type KillVerdictFilter,
} from "@/lib/killReview/rules";
import type { CreativeKillReviewRow } from "@/lib/killReview/types";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

export function KillReview({
  run,
  runs,
  onRunDate,
  rows,
  error,
}: {
  run: KillRunMeta;
  runs: KillRunMeta[];
  onRunDate: (runDate: string) => void;
  /** Null while account visibility is still loading. An empty array is a real empty run. */
  rows: CreativeKillReviewRow[] | null;
  error?: string | null;
}) {
  const [client, setClient] = useState("all");
  const [verdict, setVerdict] = useState<KillVerdictFilter>("all");
  const [sort, setSort] = useState<KillSort>("spend");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setClient("all");
    setVerdict("all");
    setSelected(new Set());
  }, [run.runDate]);

  const clients = useMemo(() => {
    const names = new Set((rows ?? []).map((row) => row.client_name));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const clientRows = useMemo(
    () => (rows == null ? [] : filterKillReviews(rows, { client, verdict: "all" })),
    [rows, client],
  );
  const visible = useMemo(
    () => sortKillReviews(filterKillReviews(clientRows, { client: "all", verdict }), sort),
    [clientRows, verdict, sort],
  );
  const totals = useMemo(() => killReviewTotals(clientRows), [clientRows]);
  const reply = copyReply(visible.filter((row) => selected.has(row.n)).map((row) => row.n));
  const curRange = formatKillRange(run.curSince, run.curUntil);
  const filtered = client !== "all" || verdict !== "all";

  const toggle = (n: number, on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(n);
      else next.delete(n);
      return next;
    });
  };

  const onCopy = async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      toast.success("Reply copied");
    } catch {
      toast.error("Couldn't copy the reply");
    }
  };

  return (
    <section aria-labelledby="kill-review-heading" className="space-y-4">
      <div>
        <h2 id="kill-review-heading" className="text-lg font-semibold tracking-tight text-foreground">
          Kill review
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Website ads for Yan's Monday and Thursday turn-off check. Leads are the website pixel. Schedule is the Meta pixel, not GoHighLevel. The last 14 days end the day before the run.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Preview of the bundled Oct 22 and Oct 26 runs. Nothing here pauses an ad.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-border bg-card px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="sticky top-12 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-background/95 px-1 py-2 backdrop-blur md:top-0">
        <div role="radiogroup" aria-label="Run date" className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {runs.map((item) => {
            const on = item.runDate === run.runDate;
            const label = formatKillRange(item.runDate, item.runDate);
            return (
              <button
                key={item.runDate}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onRunDate(item.runDate)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <Select value={client} onValueChange={setClient} disabled={rows == null}>
          <SelectTrigger aria-label="Client" className="h-9 w-[12.5rem] text-xs">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={verdict} onValueChange={(value) => setVerdict(value as KillVerdictFilter)} disabled={rows == null}>
          <SelectTrigger aria-label="Verdict" className="h-9 w-[9.5rem] text-xs">
            <SelectValue placeholder="All verdicts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verdicts</SelectItem>
            <SelectItem value="turn_off">Turn off</SelectItem>
            <SelectItem value="watch">Watch</SelectItem>
            <SelectItem value="keep">Keep</SelectItem>
            <SelectItem value="none">No verdict</SelectItem>
          </SelectContent>
        </Select>

        <div role="radiogroup" aria-label="Sort" className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {(
            [
              ["spend", "Spend"],
              ["cpl", "CPL"],
            ] as const
          ).map(([value, label]) => {
            const on = sort === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSort(value)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {reply && (
            <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
              {reply}
            </span>
          )}
          {selected.size > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          )}
          <Button type="button" size="sm" onClick={onCopy} disabled={!reply}>
            Copy reply
          </Button>
        </div>
      </div>

      {rows == null ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiStatCard
              label="Flagged"
              value={formatCount(totals.flagged)}
              icon={Flag}
              detail={client === "all" ? "Website pixel · this run" : client}
            />
            <KpiStatCard
              label="Spend at risk"
              value={formatKillMoney(totals.spendAtRisk)}
              icon={CircleDollarSign}
              detail={`Last 14 days · ${curRange}`}
            />
            <KpiStatCard
              label="Spend on turn-offs"
              value={totals.turnOffSpend == null ? "" : formatKillMoney(totals.turnOffSpend)}
              icon={Ban}
              unavailable={totals.turnOffSpend == null}
              unavailableReason="No verdicts on this run"
              detail={
                totals.turnOffCount == null
                  ? undefined
                  : `${formatCount(totals.turnOffCount)} recommended · last 14 days`
              }
            />
          </div>

          {totals.turnOffSpend == null && (
            <p className="text-sm text-muted-foreground">
              No verdicts on this run yet. The flags are the rules; the call is still open.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            {filtered
              ? `Showing ${formatCount(visible.length)} of ${formatCount(rows.length)}`
              : `${formatCount(visible.length)} flagged`}
            {" · "}
            numbers stay put when you sort or filter
          </p>

          {visible.length === 0 ? (
            <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              {rows.length === 0 ? "No flagged website ads in this run." : "Nothing in this run matches these filters."}
            </p>
          ) : (
            <ol className="space-y-3">
              {visible.map((row) => (
                <li key={`${row.run_date}-${row.ad_id}`}>
                  <KillReviewCard
                    row={row}
                    selected={selected.has(row.n)}
                    onSelectedChange={(on) => toggle(row.n, on)}
                  />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-label="Loading kill review" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  );
}
