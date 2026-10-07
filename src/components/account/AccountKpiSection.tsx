import { useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { metaUnavailableReason, useCouplerData, useMetaUnavailable } from "@/hooks/useCouplerData";
import { useSettings } from "@/hooks/useSettings";
import { useAccountGhlConversions } from "@/hooks/useAccountGhlConversions";
import { ALL_KPIS, dependsOnMeta, type KpiKey } from "@/components/dashboard/AccountCard";
import {
  adRowsInRange,
  buildKpiSeries,
  comparisonLabel,
  computeAccountKpis,
  ghlRowsInRange,
  kpiChange,
  previousPeriod,
  priorCoverage,
} from "@/lib/accountKpis";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { usePortfolioAverages } from "@/hooks/usePortfolioAverages";
import { kpiVsPortfolio } from "@/lib/portfolioAverages";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { NOT_TRACKED_REASON, resolveChartKpi, untrackedKpis } from "@/lib/kpis";
import { KpiAreaChart, type ChartAnnotation, type ChartAnnotationItem } from "./KpiAreaChart";
import type { AccountBrief, AccountTask } from "./queries";

const CHARTABLE_KEYS = new Set<KpiKey>([
  "totalSpend", "totalClicks", "totalImpressions", "totalReach",
  "avgCTR", "avgCPC", "avgCPM",
  "webApptTotal", "apptTotal",
  "ghlLeads", "ghlAppointments", "ghlCostPerLead", "ghlCostPerAppt",
]);

const KPI_SOURCE_OF = Object.fromEntries(ALL_KPIS.map((k) => [k.key, k.source])) as Record<KpiKey, (typeof ALL_KPIS)[number]["source"]>;

const BRIEF_STATUS_LABEL: Record<string, string> = {
  assigned: "Assigned", reviewing: "Reviewing", approved: "Approved", launched: "Launched",
};

/**
 * The account's headline results (the KPIs chosen in Settings, from Meta and
 * GHL) and one KPI charted over time, marked with completed tasks and briefs.
 */
export function AccountKpiSection({
  accountId,
  accountName,
  fbAdAccountId,
  dateRange,
  rangeCaption,
  tasks,
  briefs,
}: {
  accountId: string;
  accountName: string;
  fbAdAccountId: string | null | undefined;
  dateRange: DateRange | undefined;
  rangeCaption: string;
  tasks: AccountTask[];
  briefs: AccountBrief[];
}) {
  // Meta outages degrade only Meta-derived KPIs — GHL metrics stay live.
  const { data: couplerData, isLoading: metaLoading, isError: metaFeedDown, error: metaError, refetch: refetchAds, isFetching: adFetching } = useCouplerData();
  const metaUnavailable = useMetaUnavailable();
  const { settings } = useSettings();
  const { data: ghlRaw = [], isLoading: ghlLoading } = useAccountGhlConversions(accountId);
  const [selectedChart, setSelectedChart] = useState<KpiKey>("totalSpend");
  // Every comparable KPI reads against the portfolio's own value for the same
  // period, the dashboard's bar, never a manual per-account target.
  const averages = usePortfolioAverages(dateRange);

  // Meta can be down for everyone, or unable to read just this client's ad account
  // while the rest load; either way this account's Meta metrics are unknown, not $0.
  const accountMetaGap = metaUnavailable.find((a) => a.id === fbAdAccountId);
  const metaDown = metaFeedDown || !!accountMetaGap;
  const metaDownMessage = accountMetaGap ? metaUnavailableReason(accountMetaGap.code) : (metaError as Error | null)?.message;

  const accountAdRows = useMemo(
    () => (couplerData ?? []).filter((r) => r["Account: Account name"] === accountName),
    [couplerData, accountName],
  );
  const filteredAdData = useMemo(() => adRowsInRange(accountAdRows, dateRange), [accountAdRows, dateRange]);

  // Conversion KPIs this client's funnel doesn't send to Meta read "Not tracked".
  const untracked = useMemo(() => untrackedKpis(filteredAdData), [filteredAdData]);

  const ghlConversions = useMemo(() => ghlRowsInRange(ghlRaw, dateRange), [ghlRaw, dateRange]);
  const kpis = useMemo(() => computeAccountKpis(filteredAdData, ghlConversions), [filteredAdData, ghlConversions]);
  const chartSeriesData = useMemo(() => buildKpiSeries(filteredAdData, ghlConversions), [filteredAdData, ghlConversions]);

  // The same number of days just before this period. A source that doesn't hold
  // those days (Meta's 90-day window, GHL before its first sync) gets no change
  // pill rather than a fake jump from zero.
  const prior = useMemo(() => previousPeriod(dateRange), [dateRange]);
  const coverage = useMemo(() => priorCoverage(prior, ghlRaw), [prior, ghlRaw]);
  const priorKpis = useMemo(
    () => (prior ? computeAccountKpis(adRowsInRange(accountAdRows, prior), ghlRowsInRange(ghlRaw, prior)) : null),
    [prior, accountAdRows, ghlRaw],
  );
  const compare = prior ? comparisonLabel(prior) : null;

  // A task marks the chart on the day it was completed (the day the change landed);
  // a brief marks the day its status last moved.
  const annotations = useMemo((): ChartAnnotation[] => {
    const inRange = (d: Date) => {
      if (dateRange?.from && d < startOfDay(dateRange.from)) return false;
      if (dateRange?.to && d > startOfDay(dateRange.to)) return false;
      return true;
    };
    const grouped: Record<string, ChartAnnotationItem[]> = {};
    const push = (at: string, item: ChartAnnotationItem) => {
      const d = new Date(at);
      if (!inRange(startOfDay(d))) return;
      (grouped[format(d, "yyyy-MM-dd")] ??= []).push(item);
    };
    tasks.filter((t) => t.completed).forEach((t) => push(t.updated_at, { kind: "task", label: t.title, detail: "Task completed" }));
    briefs.forEach((req) => push(req.updated_at, { kind: "brief", label: req.template_name, detail: BRIEF_STATUS_LABEL[req.status] ?? req.status }));
    return Object.entries(grouped).map(([date, items]) => ({ date, items })).sort((a, b) => a.date.localeCompare(b.date));
  }, [tasks, briefs, dateRange]);

  const enabledKpis = ALL_KPIS.filter((k) => settings.enabled_kpis.includes(k.key));
  // Chart only KPIs whose feed is live; when Meta is down the default (Spend)
  // falls through to the first enabled live KPI instead of charting nothing.
  const isChartable = (key: KpiKey) => CHARTABLE_KEYS.has(key) && !(metaDown && dependsOnMeta(key)) && !untracked.has(key);
  const activeChart = resolveChartKpi(selectedChart, enabledKpis.map((k) => k.key), isChartable);
  const selectedKpi = ALL_KPIS.find((k) => k.key === activeChart);

  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account results</h2>
      {enabledKpis.length > 0 ? (
        <>
          {metaDown && (
            <SourceUnavailableNotice
              className="mb-3"
              source="Meta Ads"
              stillLive="GoHighLevel (leads, appointments, revenue)"
              message={metaDownMessage}
              onRetry={() => refetchAds()}
              retrying={adFetching}
            />
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {enabledKpis.map(({ key, label, icon, format: fmt }) => {
              const metaGap = metaDown && dependsOnMeta(key);
              const unavailable = metaGap || untracked.has(key);
              const source = KPI_SOURCE_OF[key];
              const loading = (dependsOnMeta(key) && metaLoading) || (source !== "meta" && ghlLoading);
              const change = priorKpis && coverage[source] ? kpiChange(key, kpis, priorKpis) : null;
              const vsPortfolio = kpiVsPortfolio(key, kpis[key], averages);
              return (
                <KpiStatCard key={key} label={label} value={fmt(kpis[key])} icon={icon}
                  loading={loading}
                  change={change}
                  benchmark={vsPortfolio && { ...vsPortfolio, title: `${vsPortfolio.text}: ${fmt(averages!.values[key]!)} across ${averages!.clients} active ${averages!.clients === 1 ? "client" : "clients"}` }}
                  changeLabel={compare?.short}
                  changeTitle={compare?.dates}
                  unavailable={unavailable}
                  unavailableReason={metaGap ? (accountMetaGap ? "Meta can't read this ad account" : "Meta Ads disconnected") : unavailable ? NOT_TRACKED_REASON : undefined}
                  isActive={activeChart === key}
                  onClick={isChartable(key) ? () => setSelectedChart(key) : undefined}
                />
              );
            })}
          </div>
          {selectedKpi && activeChart && (
            <div className="mt-3">
              <KpiAreaChart
                data={chartSeriesData[activeChart] ?? []}
                label={selectedKpi.label}
                caption={rangeCaption}
                formatValue={selectedKpi.format}
                annotations={annotations}
              />
            </div>
          )}
        </>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">No KPIs enabled — configure them in Settings.</p>
      )}
    </section>
  );
}
