import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { endOfMonth, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const presets = () => [
  { label: "Today", range: { from: startOfDay(new Date()), to: startOfDay(new Date()) } },
  { label: "Yesterday", range: { from: startOfDay(subDays(new Date(), 1)), to: startOfDay(subDays(new Date(), 1)) } },
  { label: "Month to Date", range: { from: startOfMonth(new Date()), to: startOfDay(new Date()) } },
  { label: "Last 7 days", range: { from: startOfDay(subDays(new Date(), 7)), to: startOfDay(subDays(new Date(), 1)) } },
  { label: "Last 14 days", range: { from: startOfDay(subDays(new Date(), 14)), to: startOfDay(subDays(new Date(), 1)) } },
  { label: "Last 28 days", range: { from: startOfDay(subDays(new Date(), 28)), to: startOfDay(subDays(new Date(), 1)) } },
  { label: "Last month", range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
];

/** The Performance page's one period control: presets, a custom range, or all time. */
export function DashboardPeriodPicker({
  dateRange,
  label,
  onChange,
}: {
  dateRange: DateRange | undefined;
  label: string;
  onChange: (range: DateRange | undefined, presetLabel: string) => void;
}) {
  const [custom, setCustom] = useState(false);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[240px] gap-2" aria-label={`Report period: ${label}`}>
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-1.5", custom ? "w-auto" : "w-48")} align="end">
        <div className="flex flex-col gap-0.5">
          {presets().map((p) => (
            <Button key={p.label} variant="ghost" size="sm" className="h-10 justify-start rounded-sm text-xs" onClick={() => { onChange(p.range, p.label); setCustom(false); }}>
              {p.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="h-10 justify-start rounded-sm text-xs" onClick={() => setCustom((v) => !v)}>
            Custom…
          </Button>
          {dateRange?.from && (
            <Button variant="ghost" size="sm" className="h-10 justify-start rounded-sm text-xs text-muted-foreground" onClick={() => { onChange(undefined, ""); setCustom(false); }}>
              Clear
            </Button>
          )}
          {custom && (
            <div className="mt-1 border-t border-border pt-2">
              <Calendar mode="range" selected={dateRange} onSelect={(r) => onChange(r, "")} numberOfMonths={1} className="pointer-events-auto p-0" />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
