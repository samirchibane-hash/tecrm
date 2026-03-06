import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCouplerData } from "@/hooks/useCouplerData";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, CalendarDays, SlidersHorizontal, Settings, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format, startOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { AccountCard, ALL_KPIS, type KpiKey } from "@/components/dashboard/AccountCard";
import { useSettings } from "@/hooks/useSettings";
import type { AdRow } from "@/hooks/useCouplerData";
import type { DateRange } from "react-day-picker";

const Index = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useCouplerData();
  const { settings, updateSettings } = useSettings();

  const enabledKpis = settings.enabled_kpis;
  const availableKpis = ALL_KPIS.filter((k) => enabledKpis.includes(k.key));
  const visibleKpis = settings.visible_kpis.filter((k) => enabledKpis.includes(k));

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 7)),
    to: startOfDay(subDays(new Date(), 1)),
  });
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!dateRange?.from) return data;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? startOfDay(dateRange.to) : from;
    return data.filter((row) => {
      // Parse YYYY-MM-DD as local date to avoid UTC timezone shift
      const [y, m, d] = row["Report: Date"].split("-").map(Number);
      const rowDate = new Date(y, m - 1, d);
      return rowDate >= from && rowDate <= to;
    });
  }, [data, dateRange]);

  const accountGroups = useMemo(() => {
    // Build map from filtered ad data
    const map: Record<string, AdRow[]> = {};
    filteredData.forEach((row) => {
      const name = row["Account: Account name"];
      if (!map[name]) map[name] = [];
      map[name].push(row);
    });
    // Also include all accounts from the full dataset so GHL-only data still shows
    if (data) {
      data.forEach((row) => {
        const name = row["Account: Account name"];
        if (!map[name]) map[name] = [];
      });
    }
    if (Object.keys(map).length === 0) return [];
    const hiddenAccounts = settings.hidden_accounts ?? [];
    return Object.entries(map)
      .filter(([name]) => !hiddenAccounts.includes(name))
      .sort(([, a], [, b]) => {
        const spendA = a.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
        const spendB = b.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
        return spendB - spendA;
      });
  }, [filteredData, data, settings.hidden_accounts]);

  const toggleKpi = (key: KpiKey) => {
    const next = visibleKpis.includes(key)
      ? visibleKpis.filter((k) => k !== key)
      : [...visibleKpis, key];
    updateSettings({ visible_kpis: next });
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
              <PopoverContent className="w-48 p-1.5" align="end">
                <div className="flex flex-col gap-0.5">
                  {[
                    { label: "Today", range: { from: startOfDay(new Date()), to: startOfDay(new Date()) } },
                    { label: "Yesterday", range: { from: startOfDay(subDays(new Date(), 1)), to: startOfDay(subDays(new Date(), 1)) } },
                    { label: "Last 7 days", range: { from: startOfDay(subDays(new Date(), 7)), to: startOfDay(subDays(new Date(), 1)) } },
                    { label: "Last 14 days", range: { from: startOfDay(subDays(new Date(), 14)), to: startOfDay(subDays(new Date(), 1)) } },
                    { label: "Last 28 days", range: { from: startOfDay(subDays(new Date(), 28)), to: startOfDay(subDays(new Date(), 1)) } },
                    { label: "Last month", range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="justify-start text-xs h-8 rounded-sm"
                      onClick={() => { setDateRange(preset.range); setShowCustomCalendar(false); }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start text-xs h-8 rounded-sm"
                    onClick={() => setShowCustomCalendar((v) => !v)}
                  >
                    Custom…
                  </Button>
                  {dateRange?.from && (
                    <Button variant="ghost" size="sm" className="justify-start text-xs h-8 rounded-sm text-muted-foreground" onClick={() => { setDateRange(undefined); setShowCustomCalendar(false); }}>
                      Clear
                    </Button>
                  )}
                  {showCustomCalendar && (
                    <div className="border-t border-border pt-2 mt-1">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={1}
                        className={cn("p-0 pointer-events-auto")}
                      />
                    </div>
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
                  {availableKpis.map(({ key, label }) => (
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

            <Button variant="ghost" size="sm" asChild>
              <Link to="/creatives"><ImageIcon className="h-4 w-4" /></Link>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings"><Settings className="h-4 w-4" /></Link>
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
                dateRange={dateRange}
                changeLogOptions={settings.change_log_options}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
