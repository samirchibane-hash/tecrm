import { endOfMonth, format, parseISO, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";

/** Meta's own date presets, so a period means the same days here as in Ads Manager. */
export type MetaPreset = "last_7d" | "last_14d" | "last_30d" | "this_month" | "last_month" | "maximum";

export const ACCOUNT_PERIODS: { value: MetaPreset; label: string }[] = [
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "this_month", label: "Month to date" },
  { value: "last_month", label: "Last month" },
  { value: "maximum", label: "All time" },
];

/**
 * The calendar days a Meta preset covers, for the surfaces that filter daily
 * rows themselves (KPI tiles, GHL counts). "Last N days" ends yesterday and
 * "this month" includes today, as in Ads Manager. `undefined` = all time.
 */
export function presetDateRange(preset: MetaPreset, now = new Date()): DateRange | undefined {
  const today = startOfDay(now);
  switch (preset) {
    case "last_7d": return { from: subDays(today, 7), to: subDays(today, 1) };
    case "last_14d": return { from: subDays(today, 14), to: subDays(today, 1) };
    case "last_30d": return { from: subDays(today, 30), to: subDays(today, 1) };
    case "this_month": return { from: startOfMonth(today), to: today };
    case "last_month": return { from: startOfMonth(subMonths(today, 1)), to: startOfDay(endOfMonth(subMonths(today, 1))) };
    case "maximum": return undefined;
  }
}

/** "Aug 12 – Sep 10, 2026" from Meta's YYYY-MM-DD bounds. */
export function periodText(since: string, until: string): string {
  const a = parseISO(since);
  const b = parseISO(until);
  return a.getFullYear() === b.getFullYear()
    ? `${format(a, "MMM d")} – ${format(b, "MMM d, yyyy")}`
    : `${format(a, "MMM d, yyyy")} – ${format(b, "MMM d, yyyy")}`;
}

/**
 * What the period control should read: the preset's name with the days it
 * resolved to, e.g. "Month to Date (09/01 – 09/19)". A custom range has no
 * preset name and shows the dates alone; no range at all is all time.
 */
export function periodLabel(range: DateRange | undefined, presetName: string): string {
  if (!range?.from) return "All time";
  const dates = range.to
    ? `${format(range.from, "MM/dd")} – ${format(range.to, "MM/dd/yyyy")}`
    : format(range.from, "MM/dd/yyyy");
  return presetName ? `${presetName} (${dates})` : dates;
}

/**
 * The picker's calendar range as the bounds the Meta query takes, so a screen
 * reads Meta for exactly the days it is showing. Structurally a `CreativeRange`
 * — spelled out here so this module stays free of component imports.
 */
export function toCreativeRange(
  range: DateRange | undefined,
): { preset: MetaPreset } | { since: string; until: string } {
  if (!range?.from) return { preset: "maximum" };
  return { since: format(range.from, "yyyy-MM-dd"), until: format(range.to ?? range.from, "yyyy-MM-dd") };
}
