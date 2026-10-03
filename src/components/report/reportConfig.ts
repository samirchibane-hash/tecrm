import { endOfMonth, format, max, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { KpiKey, KpiSource } from "@/components/dashboard/AccountCard";
import type { Status } from "@/components/StatusPill";

// Earliest date we have reliable GHL data (the GHL sync start).
export const MIN_DATE = startOfDay(new Date(2026, 1, 12));

// KPIs that have a per-day series to chart.
export const CHARTABLE_KEYS = new Set<KpiKey>([
  "totalSpend", "totalClicks", "totalImpressions", "totalReach",
  "avgCTR", "avgCPC", "avgCPM",
  "webApptTotal", "apptTotal",
  "ghlLeads", "ghlAppointments", "ghlCostPerLead", "ghlCostPerAppt",
]);

// Every client-facing number names where it came from (design rule #5).
export const SOURCE_LABEL: Record<KpiSource, string> = {
  meta: "Meta Ads",
  ghl: "GoHighLevel",
  blended: "Meta Ads ÷ GoHighLevel",
};

// ─── Reporting periods ───────────────────────────────────────────────────────

export type PeriodPreset = { value: string; short: string; label: string; range: DateRange };

/** "Sep 1 – 30, 2026", "Aug 28 – Sep 3, 2026", or "All time". */
export function formatRange(range: DateRange | undefined): string {
  if (!range?.from) return "All time";
  const { from, to } = range;
  if (!to || +to === +from) return format(from, "MMM d, yyyy");
  if (from.getFullYear() !== to.getFullYear()) return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
  if (from.getMonth() === to.getMonth()) return `${format(from, "MMM d")} – ${format(to, "d, yyyy")}`;
  return `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
}

/** The preset periods, computed against today and clamped to MIN_DATE. */
export function reportPresets(today = new Date()): PeriodPreset[] {
  const yesterday = startOfDay(subDays(today, 1));
  const lastMonth = subMonths(today, 1);
  return [
    { value: "7d", short: "7D", label: "Last 7 days", range: { from: max([startOfDay(subDays(today, 7)), MIN_DATE]), to: yesterday } },
    { value: "14d", short: "14D", label: "Last 14 days", range: { from: max([startOfDay(subDays(today, 14)), MIN_DATE]), to: yesterday } },
    { value: "30d", short: "30D", label: "Last 30 days", range: { from: max([startOfDay(subDays(today, 29)), MIN_DATE]), to: yesterday } },
    { value: "mtd", short: "MTD", label: "Month to date", range: { from: max([startOfMonth(today), MIN_DATE]), to: startOfDay(today) } },
    { value: "last-month", short: "Last month", label: "Last month", range: { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) } },
  ].filter((p) => p.range.to! >= MIN_DATE);
}

// ─── Appointment outcomes ────────────────────────────────────────────────────

export const APPT_STATUSES = [
  { value: "sold", label: "Sold", status: "success" },
  { value: "follow_up", label: "Follow up", status: "info" },
  { value: "sat_unqualified", label: "Sat — unqualified", status: "warning" },
  { value: "out_of_area", label: "Out of area", status: "warning" },
  { value: "cancelled", label: "Cancelled", status: "danger" },
] as const satisfies readonly { value: string; label: string; status: Status }[];

export type ApptStatus = (typeof APPT_STATUSES)[number]["value"];

export function apptStatusMeta(value: string | null | undefined) {
  return APPT_STATUSES.find((s) => s.value === value);
}

// ─── Change log ──────────────────────────────────────────────────────────────

export const CATEGORY_LABEL: Record<string, string> = {
  budget_change: "Budget",
  creative_swap: "Creative",
  audience_update: "Audience",
  bid_change: "Bidding",
  status_change: "Status",
  other: "Update",
};

// Chart annotation markers. Theme-aware series tokens, never raw hex.
export const CATEGORY_CHART_COLOR: Record<string, string> = {
  budget_change: "hsl(var(--chart-1))",
  creative_swap: "hsl(var(--chart-3))",
  audience_update: "hsl(var(--chart-2))",
  bid_change: "hsl(var(--chart-4))",
  status_change: "hsl(var(--chart-5))",
  other: "hsl(var(--muted-foreground))",
};

export const CREATIVE_STATUS: Record<string, { label: string; status: Status }> = {
  assigned: { label: "In production", status: "neutral" },
  reviewing: { label: "In review", status: "info" },
  approved: { label: "Approved", status: "warning" },
  launched: { label: "Launched", status: "success" },
};
