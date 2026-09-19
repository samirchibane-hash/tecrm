import { useCallback, useMemo, useState } from "react";
import { startOfDay, startOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import { periodLabel, toCreativeRange } from "@/lib/periods";

/** Every screen opens on the month so far, and says so in the same words. */
const MONTH_TO_DATE = {
  range: (): DateRange => ({ from: startOfMonth(new Date()), to: startOfDay(new Date()) }),
  name: "Month to Date",
};

/**
 * The reporting period behind `DashboardPeriodPicker`, shared by every screen
 * that shows one.
 *
 * It exists so Performance and Funnels cannot drift: the same control has to
 * open on the same days, mean the same days, carry the same label and resolve
 * to the same Meta query on both, and that only holds if one place decides all
 * four. That includes the starting period — hence no argument here.
 */
export function useDashboardPeriod() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(MONTH_TO_DATE.range);
  const [presetName, setPresetName] = useState<string>(MONTH_TO_DATE.name);

  const onChange = useCallback((range: DateRange | undefined, name: string) => {
    setDateRange(range);
    setPresetName(name);
  }, []);

  const label = useMemo(() => periodLabel(dateRange, presetName), [dateRange, presetName]);
  const creativeRange = useMemo(() => toCreativeRange(dateRange), [dateRange]);

  return { dateRange, setDateRange, presetName, label, creativeRange, onChange };
}
