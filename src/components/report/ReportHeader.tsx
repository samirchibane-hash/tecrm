import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MIN_DATE, formatRange, type PeriodPreset } from "./reportConfig";

export type ReportSection = { id: string; label: string };

export function ReportHeader({
  accountName,
  presets,
  presetValue,
  range,
  onPreset,
  onCustomRange,
  sections,
}: {
  accountName: string;
  presets: PeriodPreset[];
  /** The selected preset's value, or "custom". */
  presetValue: string;
  range: DateRange | undefined;
  onPreset: (preset: PeriodPreset) => void;
  onCustomRange: (range: DateRange) => void;
  sections: ReportSection[];
}) {
  const preset = presets.find((p) => p.value === presetValue);
  const periodLine = preset ? `${preset.label} · ${formatRange(range)}` : formatRange(range);

  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-5 pt-6 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pt-8">
          <div className="min-w-0 space-y-1.5">
            <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <img src="/Treat Engine Logo .png" alt="Treat Engine" className="h-4 w-auto" />
              <span aria-hidden>·</span>
              Performance report
            </p>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-4xl">{accountName}</h1>
            <p className="text-sm text-muted-foreground">{periodLine}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Reporting period"
              value={presetValue}
              onChange={(v) => {
                const next = presets.find((p) => p.value === v);
                if (next) onPreset(next);
              }}
              options={presets.map((p) => ({ value: p.value, label: p.short, title: p.label }))}
              className="[&>button]:h-8 [&>button]:px-3 [&>button]:text-[13px]"
            />
            <CustomRangeButton active={presetValue === "custom"} range={range} onApply={onCustomRange} />
          </div>
        </div>
      </header>

      <nav aria-label="Report sections" className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex max-w-5xl gap-6 overflow-x-auto px-4 sm:px-8">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex h-11 shrink-0 items-center border-b-2 border-transparent text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}

function CustomRangeButton({
  active,
  range,
  onApply,
}: {
  active: boolean;
  range: DateRange | undefined;
  onApply: (range: DateRange) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange | undefined>();

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setPending(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5 rounded-lg text-[13px]", active && "border-primary/50 text-primary")}
          aria-pressed={active}
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
          Custom
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm">
          <span className="font-medium text-foreground">Choose dates</span>
          <span className="text-xs text-muted-foreground">
            {pending?.from ? formatRange(pending) : `Current: ${formatRange(range)}`}
          </span>
        </div>
        <Calendar
          mode="range"
          fromDate={MIN_DATE}
          toDate={new Date()}
          selected={pending}
          onSelect={(r) => {
            setPending(r);
            if (r?.from && r.to) {
              onApply(r);
              setOpen(false);
            }
          }}
          numberOfMonths={isMobile ? 1 : 2}
          className="p-3"
        />
      </PopoverContent>
    </Popover>
  );
}
