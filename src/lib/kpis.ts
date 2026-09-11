import type { KpiKey } from "@/components/dashboard/AccountCard";
import type { AdRow } from "@/hooks/useCouplerData";

// Meta conversion KPIs and the proxy column each one is built from.
const CONVERSION_FIELD: Partial<Record<KpiKey, keyof AdRow>> = {
  webApptTotal: "Conversions: Website Appointments Scheduled - Total",
  webApptCost: "Conversions: Website Appointments Scheduled - Total",
  apptTotal: "Conversions: Appointments Scheduled - Total",
  apptCost: "Conversions: Appointments Scheduled - Total",
  leadsTotal: "Conversions: Leads - Total",
  leadsCost: "Conversions: Leads - Total",
  fbLeadsTotal: "Conversions: All On-Facebook Leads - Total",
  fbLeadsCost: "Conversions: All On-Facebook Leads - Total",
};

export const NOT_TRACKED_REASON = "Not tracked: this client's funnel doesn't send the event to Meta";

/**
 * Conversion KPIs this account doesn't track. coupler-proxy leaves a column
 * null for every row when Meta never saw the event in its 90-day window (e.g.
 * a funnel with no Schedule event), so these must read "Not tracked", not 0.
 * With no rows at all nothing is claimed either way.
 */
export function untrackedKpis(rows: readonly AdRow[]): Set<KpiKey> {
  const out = new Set<KpiKey>();
  if (rows.length === 0) return out;
  for (const [key, field] of Object.entries(CONVERSION_FIELD) as [KpiKey, keyof AdRow][]) {
    if (rows.every((r) => r[field] === null || r[field] === undefined)) out.add(key);
  }
  return out;
}

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
