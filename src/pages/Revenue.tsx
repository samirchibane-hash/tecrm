import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CalendarRange, CircleDollarSign, Repeat, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SyncStatus } from "@/components/sync/SyncStatus";
import { useSyncRuns } from "@/components/sync/useSyncRuns";
import { MonthlyRevenueChart } from "@/components/revenue/MonthlyRevenueChart";
import { CustomerRevenueTable } from "@/components/revenue/CustomerRevenueTable";
import { RecentPaymentsTable } from "@/components/revenue/RecentPaymentsTable";
import { useRevenueData } from "@/components/revenue/useRevenueData";
import {
  PERIODS,
  monthlyBuckets,
  mrrSummary,
  periodStart,
  summarize,
  type PeriodKey,
} from "@/components/revenue/revenueMath";
import { formatCount, formatUsd } from "@/lib/format";

export default function Revenue() {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const { data, isLoading, isError, error, refetch } = useRevenueData();
  const { data: runs } = useSyncRuns("stripe");

  const start = periodStart(period);
  const periodLabel = `${format(start, "MMM yyyy")} – today`;

  const view = useMemo(() => {
    if (!data) return null;
    const buckets = monthlyBuckets(data.payments, start);
    const inPeriod = data.payments.filter((p) => new Date(p.paid_at) >= start);
    return { buckets, inPeriod, summary: summarize(buckets, data.payments), mrr: mrrSummary(data.subscriptions) };
    // `start` is derived from `period`; depending on the key keeps the memo stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, period]);

  // Payments were added to the Stripe mirror after the first syncs. Until a
  // successful run has written them, an empty table means "not synced", not $0.
  const paymentsSynced = runs?.lastOk?.counts?.payments != null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="Revenue"
        description="What Treat Engine actually collected through Stripe, net of refunds."
        actions={<SyncStatus source="stripe" invalidate={[["revenue"]]} />}
      />

      <div className="mb-6 overflow-x-auto">
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => v && setPeriod(v as PeriodKey)}
          aria-label="Period"
          className="w-max justify-start rounded-lg border border-border bg-muted p-1"
        >
          {PERIODS.map((p) => (
            <ToggleGroupItem
              key={p.key}
              value={p.key}
              className="h-7 rounded-md px-3 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-10 text-center">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <div>
            <p className="text-sm font-medium text-foreground">Couldn't load revenue</p>
            <p className="mt-1 text-xs text-muted-foreground">{(error as Error)?.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : isLoading || !view ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiStatCard
              size="comfortable"
              icon={CircleDollarSign}
              label="Net collected"
              value={formatUsd(view.summary.net, { cents: true })}
              detail={`${formatCount(view.summary.payments)} payments · ${formatUsd(view.summary.gross, { cents: true })} gross`}
              unavailable={!paymentsSynced}
              unavailableReason="Payments not synced yet"
            />
            <KpiStatCard
              size="comfortable"
              icon={Repeat}
              label="MRR · now"
              value={formatUsd(view.mrr.mrr, { cents: true })}
              detail={[
                `${view.mrr.collecting} collecting`,
                view.mrr.paused ? `${view.mrr.paused} paused` : null,
                view.mrr.trialing ? `${view.mrr.trialing} trial` : null,
              ].filter(Boolean).join(" · ")}
            />
            <KpiStatCard
              size="comfortable"
              icon={CalendarRange}
              label="Avg per month"
              value={view.summary.avgMonthly != null ? formatUsd(view.summary.avgMonthly, { cents: true }) : "—"}
              detail={
                view.summary.completeMonths
                  ? `${view.summary.completeMonths} complete month${view.summary.completeMonths === 1 ? "" : "s"}`
                  : "No complete month yet"
              }
              unavailable={!paymentsSynced}
              unavailableReason="Payments not synced yet"
            />
            <KpiStatCard
              size="comfortable"
              icon={Undo2}
              label="Refunded"
              value={formatUsd(view.summary.refunded, { cents: true })}
              detail={`${formatCount(view.summary.refundedCount)} payment${view.summary.refundedCount === 1 ? "" : "s"} refunded`}
              unavailable={!paymentsSynced}
              unavailableReason="Payments not synced yet"
            />
          </div>

          <MonthlyRevenueChart buckets={view.buckets} periodLabel={periodLabel} />

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <CustomerRevenueTable
              payments={view.inPeriod}
              subscriptions={data.subscriptions}
              customers={data.customers}
              accounts={data.accounts}
              periodLabel={periodLabel}
            />
            <RecentPaymentsTable payments={view.inPeriod} customers={data.customers} periodLabel={periodLabel} />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Source: Stripe payments (checkout, invoices and one-off charges), grouped by the month the charge
            succeeded. Refunds are subtracted from the month of the original payment. Stripe fees are not deducted.
            MRR counts active and past-due subscriptions that are collecting. Paused subscriptions are excluded
            {view.mrr.pausedMrr ? ` (${formatUsd(view.mrr.pausedMrr, { cents: true })}/mo paused)` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
