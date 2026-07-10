import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCouplerData } from "@/hooks/useCouplerData";
import { NewBriefDialog } from "@/components/creatives/NewBriefDialog";
import { RequestDetailSheet } from "@/components/creatives/RequestDetailSheet";
import { type CreativeRequest } from "@/components/creatives/types";
import { TaskList } from "@/components/dashboard/TaskList";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  RefreshCw,
  CalendarDays,
  Settings,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Clock,
  Film,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import type { AdRow } from "@/hooks/useCouplerData";
import type { DateRange } from "react-day-picker";

// ─── KPI helpers ─────────────────────────────────────────────────────────────
const CPL_TARGET = 40;
const APPT_TARGET = 200;

function getCostStatus(value: number, target: number): "green" | "orange" | "red" | null {
  if (value <= 0) return null;
  if (value <= target) return "green";
  if (value <= target * 1.25) return "orange";
  return "red";
}

const STATUS_TEXT: Record<string, string> = {
  green: "text-green-700 dark:text-green-400",
  orange: "text-orange-700 dark:text-orange-400",
  red: "text-red-700 dark:text-red-400",
};

function pctDelta(curr: number, prev: number): { pct: string; up: boolean; flat: boolean } | null {
  if (prev <= 0 || curr < 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return { pct: "0%", up: false, flat: true };
  return { pct: Math.abs(pct).toFixed(0) + "%", up: pct > 0, flat: false };
}

// ─── Component ───────────────────────────────────────────────────────────────
const Index = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useCouplerData();
  const { settings } = useSettings();

  const { data: newClients } = useQuery({
    queryKey: ["new_clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, business_name, service, plan, submitted_at, account_id")
        .is("account_id", null)
        .order("submitted_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  // All accounts (for UUID → name mapping used in GHL join)
  const { data: dbAccounts = [] } = useQuery({
    queryKey: ["all-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, account_name");
      return data ?? [];
    },
  });

  const accountIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    dbAccounts.forEach((a) => { map[a.account_name] = a.id; });
    return map;
  }, [dbAccounts]);

  // Most recent change log date per account
  const { data: lastChanges = [] } = useQuery({
    queryKey: ["last-changes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_updates")
        .select("account_name, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const lastChangeMap = useMemo(() => {
    const map: Record<string, string> = {};
    lastChanges.forEach((r) => {
      if (!map[r.account_name]) map[r.account_name] = r.created_at;
    });
    return map;
  }, [lastChanges]);

  // ─── Date range ────────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: startOfDay(new Date()),
  });
  const [presetLabel, setPresetLabel] = useState<string>("Month to Date");
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);

  // GHL conversions — fetch a window covering current + previous period so deltas work.
  // Date range is in the query key so this refetches when the picker changes.
  const ghlFetchFrom = useMemo(() => {
    if (!dateRange?.from) return startOfDay(subDays(new Date(), 180));
    const periodMs =
      ((dateRange.to ?? dateRange.from).getTime() - dateRange.from.getTime()) + 86400000;
    return new Date(dateRange.from.getTime() - periodMs);
  }, [dateRange]);

  const { data: allGhlConversions = [] } = useQuery({
    queryKey: ["all-ghl-conversions", format(ghlFetchFrom, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase
        .from("ghl_conversions")
        .select("*")
        .gte("created_on", format(ghlFetchFrom, "yyyy-MM-dd"));
      return data ?? [];
    },
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!dateRange?.from) return data;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? startOfDay(dateRange.to) : from;
    return data.filter((row) => {
      const [y, m, d] = row["Report: Date"].split("-").map(Number);
      const rowDate = new Date(y, m - 1, d);
      return rowDate >= from && rowDate <= to;
    });
  }, [data, dateRange]);

  const prevDateRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return undefined;
    const periodMs = dateRange.to.getTime() - dateRange.from.getTime() + 86400000;
    return {
      from: new Date(dateRange.from.getTime() - periodMs),
      to: new Date(dateRange.from.getTime() - 86400000),
    };
  }, [dateRange]);

  const prevGroupMap = useMemo(() => {
    if (!data || !prevDateRange?.from) return {} as Record<string, AdRow[]>;
    const from = startOfDay(prevDateRange.from);
    const to = startOfDay(prevDateRange.to!);
    const map: Record<string, AdRow[]> = {};
    data
      .filter((row) => {
        const [y, m, d] = row["Report: Date"].split("-").map(Number);
        const rowDate = new Date(y, m - 1, d);
        return rowDate >= from && rowDate <= to;
      })
      .forEach((row) => {
        const name = row["Account: Account name"];
        if (!map[name]) map[name] = [];
        map[name].push(row);
      });
    return map;
  }, [data, prevDateRange]);

  const accountGroups = useMemo(() => {
    const map: Record<string, AdRow[]> = {};
    filteredData.forEach((row) => {
      const name = row["Account: Account name"];
      if (!map[name]) map[name] = [];
      map[name].push(row);
    });
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

  // ─── Table rows ────────────────────────────────────────────────────────────
  const tableRows = useMemo(() => {
    return accountGroups.map(([name, rows]) => {
      const accountId = accountIdMap[name];

      const filterGhl = (from?: Date, to?: Date) =>
        allGhlConversions.filter((c) => {
          if (c.tecrm_id !== accountId) return false;
          if (!from) return true;
          const [y, m, d] = c.created_on.split("-").map(Number);
          const dateVal = new Date(y, m - 1, d);
          if (dateVal < from) return false;
          if (to && dateVal > new Date(to.getTime() + 86400000 - 1)) return false;
          return true;
        });

      const ghl = filterGhl(dateRange?.from, dateRange?.to);
      const prevGhl = prevDateRange?.from
        ? filterGhl(prevDateRange.from, prevDateRange.to)
        : [];

      const totalSpend = rows.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
      const prevSpend = (prevGroupMap[name] ?? []).reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);

      const ghlLeads = ghl.filter((c) =>
        c.type?.toLowerCase() === "lead" || c.type?.toLowerCase() === "water test"
      ).length;
      const ghlAppointments = ghl.filter((c) =>
        c.type?.toLowerCase() === "appointment" || c.type?.toLowerCase() === "water test"
      ).length;
      const ghlCostPerLead = ghlLeads > 0 ? totalSpend / ghlLeads : 0;
      const ghlCostPerAppt = ghlAppointments > 0 ? totalSpend / ghlAppointments : 0;
      const prevGhlLeads = prevGhl.filter((c) =>
        c.type?.toLowerCase() === "lead" || c.type?.toLowerCase() === "water test"
      ).length;
      const prevGhlAppointments = prevGhl.filter((c) =>
        c.type?.toLowerCase() === "appointment" || c.type?.toLowerCase() === "water test"
      ).length;
      const prevGhlCostPerLead = prevGhlLeads > 0 ? prevSpend / prevGhlLeads : 0;
      const prevGhlCostPerAppt = prevGhlAppointments > 0 ? prevSpend / prevGhlAppointments : 0;

      return {
        name,
        totalSpend, prevSpend,
        ghlLeads, prevGhlLeads,
        ghlCostPerLead, prevGhlCostPerLead,
        ghlAppointments, prevGhlAppointments,
        ghlCostPerAppt, prevGhlCostPerAppt,
        lastChange: lastChangeMap[name] ?? null,
      };
    });
  }, [accountGroups, accountIdMap, allGhlConversions, dateRange, prevDateRange, prevGroupMap, lastChangeMap]);

  const dateRangeStr = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "MM/dd")} – ${format(dateRange.to, "MM/dd/yyyy")}`
      : format(dateRange.from, "MM/dd/yyyy")
    : null;
  const dateLabel = presetLabel && dateRangeStr
    ? `${presetLabel} (${dateRangeStr})`
    : dateRangeStr ?? "All time";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10 sm:px-6 lg:px-8">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <img
              src="/Treat Engine Logo .png"
              alt="Treat Engine"
              className="h-8 sm:h-10 w-auto"
            />
            <p className="mt-1 text-sm text-muted-foreground">Campaign performance overview</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/creatives"><ImageIcon className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings"><Settings className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>

        {/* ── New Clients ──────────────────────────────────────────────────── */}
        {newClients && newClients.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">New Clients</h2>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{newClients.length}</span>
            </div>
            <div className="space-y-2">
              {newClients.map((client) => (
                <Link
                  key={client.id}
                  to={`/onboarding/${client.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {client.business_name ?? client.full_name}
                      </p>
                      {!client.business_name && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          Awaiting onboarding
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {client.service}
                      {client.submitted_at && (
                        <span className="ml-2">· {formatDistanceToNow(new Date(client.submitted_at), { addSuffix: true })}</span>
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {isError && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-medium">Failed to load data</p>
            <p className="max-w-md text-sm text-muted-foreground">{(error as Error).message}</p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        )}

        {/* ── Accounts Table ────────────────────────────────────────────────── */}
        {tableRows.length > 0 && (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/60">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Account Performance</h2>
                {prevDateRange && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    vs {format(prevDateRange.from, "MMM d")} – {format(prevDateRange.to, "MMM d, yyyy")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 max-w-[180px]">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs truncate">{dateLabel}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className={cn("p-1.5", showCustomCalendar ? "w-auto" : "w-48")} align="end">
                    <div className="flex flex-col gap-0.5">
                      {[
                        { label: "Today", range: { from: startOfDay(new Date()), to: startOfDay(new Date()) } },
                        { label: "Yesterday", range: { from: startOfDay(subDays(new Date(), 1)), to: startOfDay(subDays(new Date(), 1)) } },
                        { label: "Month to Date", range: { from: startOfMonth(new Date()), to: startOfDay(new Date()) } },
                        { label: "Last 7 days", range: { from: startOfDay(subDays(new Date(), 7)), to: startOfDay(subDays(new Date(), 1)) } },
                        { label: "Last 14 days", range: { from: startOfDay(subDays(new Date(), 14)), to: startOfDay(subDays(new Date(), 1)) } },
                        { label: "Last 28 days", range: { from: startOfDay(subDays(new Date(), 28)), to: startOfDay(subDays(new Date(), 1)) } },
                        { label: "Last month", range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
                      ].map((preset) => (
                        <Button
                          key={preset.label}
                          variant="ghost"
                          size="sm"
                          className="justify-start text-xs h-10 rounded-sm"
                          onClick={() => {
                            setDateRange(preset.range);
                            setPresetLabel(preset.label);
                            setShowCustomCalendar(false);
                          }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start text-xs h-10 rounded-sm"
                        onClick={() => { setPresetLabel(""); setShowCustomCalendar((v) => !v); }}
                      >
                        Custom…
                      </Button>
                      {dateRange?.from && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-start text-xs h-10 rounded-sm text-muted-foreground"
                          onClick={() => { setDateRange(undefined); setPresetLabel(""); setShowCustomCalendar(false); }}
                        >
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
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Account
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Spend
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      GHL Leads
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      CPL
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      GHL Appts
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      CPA
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Last Change
                    </th>
                    <th className="py-3 px-4 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    const cplStatus = getCostStatus(row.ghlCostPerLead, CPL_TARGET);
                    const cpaStatus = getCostStatus(row.ghlCostPerAppt, APPT_TARGET);
                    const spendDelta = pctDelta(row.totalSpend, row.prevSpend);
                    const leadsDelta = pctDelta(row.ghlLeads, row.prevGhlLeads);
                    const apptsDelta = pctDelta(row.ghlAppointments, row.prevGhlAppointments);
                    const cplDelta = pctDelta(row.ghlCostPerLead, row.prevGhlCostPerLead);
                    const cpaDelta = pctDelta(row.ghlCostPerAppt, row.prevGhlCostPerAppt);
                    const isLast = i === tableRows.length - 1;
                    return (
                      <tr
                        key={row.name}
                        onClick={() => navigate(`/account/${encodeURIComponent(row.name)}`)}
                        className={`group cursor-pointer hover:bg-muted/30 transition-colors ${!isLast ? "border-b border-border/40" : ""}`}
                      >
                        {/* Account */}
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {row.name}
                          </span>
                        </td>

                        {/* Spend */}
                        <td className="py-3.5 px-4 text-right tabular-nums">
                          <span className="font-semibold text-foreground">
                            ${row.totalSpend.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </span>
                          {spendDelta && (
                            <span className={`ml-1.5 text-[11px] ${spendDelta.flat ? "text-muted-foreground" : "text-muted-foreground"}`}>
                              {spendDelta.flat ? "→" : spendDelta.up ? "↑" : "↓"}{spendDelta.pct}
                            </span>
                          )}
                        </td>

                        {/* Leads */}
                        <td className="py-3.5 px-4 text-right tabular-nums">
                          {(row.ghlLeads > 0 || row.prevGhlLeads > 0) ? (
                            <>
                              <span className="font-medium text-foreground">{row.ghlLeads}</span>
                              {leadsDelta && (
                                <span className={`ml-1.5 text-[11px] ${leadsDelta.flat ? "text-muted-foreground" : leadsDelta.up ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                  {leadsDelta.flat ? "→" : leadsDelta.up ? "↑" : "↓"}{leadsDelta.pct}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>

                        {/* CPL */}
                        <td className="py-3.5 px-4 text-right tabular-nums">
                          {row.ghlCostPerLead > 0 ? (
                            <>
                              <span className={`font-semibold ${cplStatus ? STATUS_TEXT[cplStatus] : "text-foreground"}`}>
                                ${row.ghlCostPerLead.toFixed(0)}
                              </span>
                              {cplDelta && (
                                <span className={`ml-1.5 text-[11px] ${cplDelta.flat ? "text-muted-foreground" : cplDelta.up ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                                  {cplDelta.flat ? "→" : cplDelta.up ? "↑" : "↓"}{cplDelta.pct}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>

                        {/* Appts */}
                        <td className="py-3.5 px-4 text-right tabular-nums">
                          {(row.ghlAppointments > 0 || row.prevGhlAppointments > 0) ? (
                            <>
                              <span className="font-medium text-foreground">{row.ghlAppointments}</span>
                              {apptsDelta && (
                                <span className={`ml-1.5 text-[11px] ${apptsDelta.flat ? "text-muted-foreground" : apptsDelta.up ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                  {apptsDelta.flat ? "→" : apptsDelta.up ? "↑" : "↓"}{apptsDelta.pct}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>

                        {/* CPA */}
                        <td className="py-3.5 px-4 text-right tabular-nums">
                          {row.ghlCostPerAppt > 0 ? (
                            <>
                              <span className={`font-semibold ${cpaStatus ? STATUS_TEXT[cpaStatus] : "text-foreground"}`}>
                                ${row.ghlCostPerAppt.toFixed(0)}
                              </span>
                              {cpaDelta && (
                                <span className={`ml-1.5 text-[11px] ${cpaDelta.flat ? "text-muted-foreground" : cpaDelta.up ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                                  {cpaDelta.flat ? "→" : cpaDelta.up ? "↑" : "↓"}{cpaDelta.pct}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>

                        {/* Last Change */}
                        <td className="py-3.5 px-4 text-right">
                          {row.lastChange ? (
                            <span
                              className="text-xs text-muted-foreground"
                              title={new Date(row.lastChange).toLocaleString()}
                            >
                              {formatDistanceToNow(new Date(row.lastChange), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>

                        {/* Arrow */}
                        <td className="py-3.5 px-4">
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Creative Requests ─────────────────────────────────────────────── */}
        <CreativeRequestsSection />

        {/* ── Task List ─────────────────────────────────────────────────────── */}
        <div className="mt-8">
          <TaskList accounts={dbAccounts} changeLogOptions={settings.change_log_options} />
        </div>
      </div>
    </div>
  );
};

// ── Creative Requests dashboard section ──────────────────────────────────────

const REQ_STATUS_BADGE: Record<string, string> = {
  requested: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  in_review: "bg-orange-100 text-orange-800",
};
const REQ_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  in_progress: "In Progress",
  in_review: "In Review",
};

function CreativeRequestsSection() {
  const [briefOpen, setBriefOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CreativeRequest | null>(null);

  const { data: openRequests = [], isLoading } = useQuery({
    queryKey: ["dashboard-creative-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_requests")
        .select("*")
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as CreativeRequest[];
    },
  });

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Creative Requests</h2>
          {!isLoading && openRequests.length > 0 && (
            <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
              {openRequests.length} open
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/creatives?tab=requests"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setBriefOpen(true)}
          >
            + New Brief
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && openRequests.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No open creative requests</p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 gap-1.5 text-xs"
            onClick={() => setBriefOpen(true)}
          >
            + Create a brief
          </Button>
        </div>
      )}

      {!isLoading && openRequests.length > 0 && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          {openRequests.map((req, i) => {
            const isVideo = req.ad_type === "video_ads";
            const isLast = i === openRequests.length - 1;
            return (
              <div
                key={req.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group cursor-pointer",
                  !isLast && "border-b border-border/40"
                )}
                onClick={() => setSelectedRequest(req)}
              >
                <div className={cn("shrink-0 rounded-lg p-1.5", isVideo ? "bg-violet-50" : "bg-sky-50")}>
                  {isVideo
                    ? <Film className="h-3.5 w-3.5 text-violet-600" />
                    : <ImageIcon className="h-3.5 w-3.5 text-sky-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{req.account_name}</span>
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
                      REQ_STATUS_BADGE[req.status] ?? "bg-muted text-muted-foreground"
                    )}>
                      {REQ_STATUS_LABEL[req.status] ?? req.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {req.template_name} · {req.ad_angle} · {req.offer_type}
                    {req.assigned_to && <span className="text-muted-foreground/60"> — {req.assigned_to}</span>}
                  </p>
                </div>
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">{format(new Date(req.created_at), "MMM d")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      <RequestDetailSheet
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onRequestChange={(updated) => setSelectedRequest(updated)}
      />
      <NewBriefDialog open={briefOpen} onOpenChange={setBriefOpen} />
    </div>
  );
}

export default Index;
