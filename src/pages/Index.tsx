import { useMemo, useState } from "react";
import { useCouplerData } from "@/hooks/useCouplerData";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, CalendarDays, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AccountCard, ALL_KPIS, type KpiKey } from "@/components/dashboard/AccountCard";
import type { AdRow } from "@/hooks/useCouplerData";
import type { DateRange } from "react-day-picker";

const Index = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useCouplerData();

  const [visibleKpis, setVisibleKpis] = useState<KpiKey[]>([
    "totalSpend", "totalClicks", "totalImpressions", "avgCTR",
  ]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!dateRange?.from) return data;
    return data.filter((row) => {
      const d = new Date(row["Report: Date"]);
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      return true;
    });
  }, [data, dateRange]);

  const accountGroups = useMemo(() => {
    if (filteredData.length === 0) return [];
    const map: Record<string, AdRow[]> = {};
    filteredData.forEach((row) => {
      const name = row["Account: Account name"];
      if (!map[name]) map[name] = [];
      map[name].push(row);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => {
        const spendA = a.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
        const spendB = b.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
        return spendB - spendA;
      });
  }, [filteredData]);

  const toggleKpi = (key: KpiKey) => {
    setVisibleKpis((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
      : format(dateRange.from, "MMM d, yyyy")
    : "All time";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Ad Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">Campaign performance &amp; change logs</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-xs">{dateLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 space-y-2">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    className={cn("pointer-events-auto")}
                  />
                  {dateRange?.from && (
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateRange(undefined)}>
                      Clear dates
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* KPI Selector */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="text-xs">KPIs ({visibleKpis.length})</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Visible KPIs</p>
                  {ALL_KPIS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`kpi-${key}`}
                        checked={visibleKpis.includes(key)}
                        onCheckedChange={() => toggleKpi(key)}
                      />
                      <Label htmlFor={`kpi-${key}`} className="text-sm cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-medium">Failed to load data</p>
            <p className="max-w-md text-sm text-muted-foreground">{(error as Error).message}</p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        )}

        {/* Account Cards */}
        {accountGroups.length > 0 && (
          <div className="space-y-4">
            {accountGroups.map(([name, rows]) => (
              <AccountCard
                key={name}
                accountName={name}
                rows={rows}
                visibleKpis={visibleKpis}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
