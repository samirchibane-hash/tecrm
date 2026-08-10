import type { KpiKey } from "@/components/dashboard/AccountCard";

/**
 * Decide which KPI the single adaptive chart plots.
 *
 * The user's pick wins whenever its feed is live. When it is not — a disabled
 * Meta API key, say — the chart falls through to the first enabled KPI that is
 * still backed by live data (GHL Leads / GHL Appts in practice) rather than
 * rendering an empty axis. Returns `undefined` only when nothing is chartable.
 *
 * Deliberately pure and derived per render: nothing is written back to state, so
 * restoring the feed snaps the chart back to whatever the user had selected.
 */
export function resolveChartKpi(
  selected: KpiKey,
  enabled: readonly KpiKey[],
  isChartable: (key: KpiKey) => boolean,
): KpiKey | undefined {
  if (isChartable(selected)) return selected;
  return enabled.find(isChartable);
}
