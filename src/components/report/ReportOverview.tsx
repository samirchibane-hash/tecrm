import { useState } from "react";
import { ALL_KPIS, dependsOnMeta, type KpiKey } from "@/components/dashboard/AccountCard";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { Skeleton } from "@/components/ui/skeleton";
import { kpiChange, type KpiSeries } from "@/lib/accountKpis";
import { formatCount, formatUsd } from "@/lib/format";
import { resolveChartKpi } from "@/lib/kpis";
import { KpiAreaChart } from "./KpiAreaChart";
import { CHARTABLE_KEYS, SOURCE_LABEL } from "./reportConfig";
import type { ChartAnnotation } from "./timeline";

type Kpis = Record<KpiKey, number>;

export function ReportOverview({
  enabledKeys,
  kpis,
  priorKpis,
  coverage,
  compare,
  series,
  annotations,
  rangeLabel,
  adLoading,
  ghlLoading,
  ghlUnmapped,
  metaDown,
  metaError,
  onRetryMeta,
  retryingMeta,
  untracked,
}: {
  enabledKeys: KpiKey[];
  kpis: Kpis;
  priorKpis: Kpis | null;
  coverage: Record<"meta" | "ghl" | "blended", boolean>;
  compare: { short: string; dates: string } | null;
  series: KpiSeries;
  annotations: ChartAnnotation[];
  rangeLabel: string;
  adLoading: boolean;
  ghlLoading: boolean;
  /** No GoHighLevel rows exist for this account at all: not connected, not zero. */
  ghlUnmapped: boolean;
  metaDown: boolean;
  metaError: unknown;
  onRetryMeta: () => void;
  retryingMeta: boolean;
  untracked: Set<KpiKey>;
}) {
  const [selected, setSelected] = useState<KpiKey>("ghlLeads");

  const reasonUnavailable = (key: KpiKey): string | undefined => {
    if (metaDown && dependsOnMeta(key)) return "Meta Ads disconnected";
    if (ghlUnmapped && ALL_KPIS.find((k) => k.key === key)?.source !== "meta") return "GoHighLevel not connected";
    if (untracked.has(key)) return "Not tracked yet";
    return undefined;
  };

  // A KPI is charted only while a live feed backs it; otherwise fall through to
  // the first enabled one that is live. Derived, so reconnecting restores the pick.
  const isChartable = (key: KpiKey) => CHARTABLE_KEYS.has(key) && !reasonUnavailable(key);
  const activeKey = resolveChartKpi(selected, enabledKeys, isChartable);
  const activeKpi = ALL_KPIS.find((k) => k.key === activeKey);
  const tiles = ALL_KPIS.filter((k) => enabledKeys.includes(k.key));

  return (
    <section id="overview" aria-labelledby="overview-h" className="scroll-mt-16 space-y-5">
      <h2 id="overview-h" className="text-[22px] font-semibold tracking-tight text-foreground">Overview</h2>

      <ReportSummary
        kpis={kpis}
        loading={adLoading || ghlLoading}
        metaDown={metaDown}
        ghlUnmapped={ghlUnmapped}
        rangeLabel={rangeLabel}
      />

      {metaDown && (
        <SourceUnavailableNotice
          source="Meta Ads"
          stillLive="GoHighLevel (leads, appointments, revenue)"
          message={(metaError as Error | null)?.message}
          onRetry={onRetryMeta}
          retrying={retryingMeta}
        />
      )}

      {adLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <>
          {tiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {tiles.map(({ key, label, icon, format, source }) => {
                const reason = reasonUnavailable(key);
                const change = priorKpis && coverage[source] ? kpiChange(key, kpis, priorKpis) : null;
                return (
                  <KpiStatCard
                    key={key}
                    label={label}
                    value={format(kpis[key])}
                    icon={icon}
                    size="comfortable"
                    loading={source !== "meta" && ghlLoading}
                    change={change}
                    changeLabel={compare?.short}
                    changeTitle={compare?.dates}
                    detail={SOURCE_LABEL[source]}
                    unavailable={!!reason}
                    unavailableReason={reason}
                    isActive={activeKey === key}
                    onClick={isChartable(key) ? () => setSelected(key) : undefined}
                  />
                );
              })}
            </div>
          )}
          {activeKpi && activeKey && (
            <KpiAreaChart
              data={series[activeKey] ?? []}
              title={`${activeKpi.label} per day`}
              caption={`${SOURCE_LABEL[activeKpi.source]} · ${rangeLabel}`}
              formatValue={activeKpi.format}
              annotations={annotations}
            />
          )}
          {tiles.length > 0 && (
            <p className="text-xs text-muted-foreground">Select a metric to chart it.</p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The period in one sentence. Each clause appears only when its source is live
 * and loaded, so it never states a number the tiles would show as unavailable.
 */
function ReportSummary({
  kpis,
  loading,
  metaDown,
  ghlUnmapped,
  rangeLabel,
}: {
  kpis: Kpis;
  loading: boolean;
  metaDown: boolean;
  ghlUnmapped: boolean;
  rangeLabel: string;
}) {
  if (loading) return <Skeleton className="h-7 w-full max-w-xl rounded-md" aria-label="Loading summary" />;

  const spend = <strong className="font-semibold">{formatUsd(kpis.totalSpend)}</strong>;
  const leads = kpis.ghlLeads;
  const appts = kpis.ghlAppointments;
  const leadText = <strong className="font-semibold">{formatCount(leads)} lead{leads === 1 ? "" : "s"}</strong>;
  const apptText = <strong className="font-semibold">{formatCount(appts)} appointment{appts === 1 ? "" : "s"}</strong>;

  let sentence: React.ReactNode = null;
  if (ghlUnmapped && !metaDown) {
    sentence = <>We spent {spend} on Meta ads. Leads and appointments will show here once GoHighLevel is connected.</>;
  } else if (ghlUnmapped) {
    sentence = null;
  } else if (metaDown) {
    sentence = <>{leadText} reached GoHighLevel and {apptText} were booked.</>;
  } else if (leads === 0) {
    sentence = <>We spent {spend} on Meta ads. No leads have reached GoHighLevel for this period yet.</>;
  } else {
    sentence = (
      <>
        We spent {spend} on Meta ads, bringing in {leadText} at{" "}
        <strong className="font-semibold">{formatUsd(kpis.ghlCostPerLead, { decimals: true })} each</strong> and{" "}
        {apptText}.
      </>
    );
  }
  if (!sentence) return null;

  return (
    <p className="max-w-3xl text-[17px] leading-7 text-foreground sm:text-lg">
      {sentence} <span className="text-muted-foreground">({rangeLabel})</span>
    </p>
  );
}
