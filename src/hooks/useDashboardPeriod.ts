import { useCallback, useMemo, useState } from "react";
import { startOfDay, startOfMonth, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { periodLabel, toCreativeRange } from "@/lib/periods";

/** Where a screen's period control starts, named as the picker names it. */
export type PeriodDefault = "month_to_date" | "last_28d";

const DEFAULTS: Record<PeriodDefault, { range: DateRange; name: string }> = {
  month_to_date: {
    range: { from: startOfMonth(new Date()), to: startOfDay(new Date()) },
    name: "Month to Date",
  },
  last_28d: {
    range: { from: startOfDay(subDays(new Date(), 28)), to: startOfDay(subDays(new Date(), 1)) },
    name: "Last 28 days",
  },
};

/**
 * The reporting period behind `DashboardPeriodPicker`, shared by every screen
 * that shows one.
 *
 * It exists so Performance and Funnels cannot drift: the same control has to
 * mean the same days, carry the same label, and resolve to the same Meta query
 * on both, and that only holds if one place decides all three.
 */
export function useDashboardPeriod(initial: PeriodDefault = "month_to_date") {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULTS[initial].range);
  const [presetName, setPresetName] = useState<string>(DEFAULTS[initial].name);

  const onChange = useCallback((range: DateRange | undefined, name: string) => {
    setDateRange(range);
    setPresetName(name);
  }, []);

  const label = useMemo(() => periodLabel(dateRange, presetName), [dateRange, presetName]);
  const creativeRange = useMemo(() => toCreativeRange(dateRange), [dateRange]);

  return { dateRange, setDateRange, presetName, label, creativeRange, onChange };
}
