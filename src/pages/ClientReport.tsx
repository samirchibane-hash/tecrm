import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCouplerData } from "@/hooks/useCouplerData";
import { supabase } from "@/integrations/supabase/client";
import { ALL_KPIS, type KpiKey } from "@/components/dashboard/AccountCard";
import { useSettings } from "@/hooks/useSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { CalendarDays, Image as ImageIcon, ExternalLink, ChevronLeft } from "lucide-react";
import { format, startOfDay, subDays, startOfMonth, endOfMonth, subMonths, max } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "budget_change", label: "Budget Change" },
  { value: "creative_swap", label: "Creative Swap" },
  { value: "audience_update", label: "Audience Update" },
  { value: "bid_change", label: "Bid Change" },
  { value: "status_change", label: "Status Change" },
  { value: "other", label: "Other" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  budget_change: "bg-blue-100 text-blue-800",
  creative_swap: "bg-purple-100 text-purple-800",
  audience_update: "bg-green-100 text-green-800",
  bid_change: "bg-orange-100 text-orange-800",
  status_change: "bg-red-100 text-red-800",
  other: "bg-slate-100 text-slate-700",
};

// SVG-compatible colors for chart annotation dots
const CATEGORY_SVG_COLORS: Record<string, string> = {
  budget_change: "#3b82f6",
  creative_swap: "#a855f7",
  audience_update: "#22c55e",
  bid_change: "#f97316",
  status_change: "#ef4444",
  other: "#94a3b8",
};

// ─── Appointment outcome statuses ──────────────────────────────────────────────

const APPT_STATUSES = [
  { value: "cancelled",      label: "Cancelled",         color: "bg-red-100 text-red-800" },
  { value: "out_of_area",    label: "Out of Area",       color: "bg-orange-100 text-orange-800" },
  { value: "sat_unqualified",label: "Sat — Unqualified", color: "bg-yellow-100 text-yellow-800" },
  { value: "follow_up",      label: "Follow Up",         color: "bg-blue-100 text-blue-800" },
  { value: "sold",           label: "Sold",              color: "bg-green-100 text-green-800" },
] as const;

type ApptStatus = (typeof APPT_STATUSES)[number]["value"];

// ─── Earliest date we have reliable GHL data ──────────────────────────────────

const MIN_DATE = startOfDay(new Date(2026, 1, 12)); // Feb 12, 2026 — GHL sync start

// ─── Which KPIs support time-series charts ─────────────────────────────────────

const CHARTABLE_KEYS = new Set<KpiKey>([
  "totalSpend", "totalClicks", "totalImpressions", "totalReach",
  "avgCTR", "avgCPC", "avgCPM",
  "webApptTotal", "apptTotal", "leadsTotal", "fbLeadsTotal",
  "ghlLeads", "ghlAppointments", "ghlCostPerLead", "ghlCostPerAppt",
]);

// ─── Chart annotation type ─────────────────────────────────────────────────────

type ChartAnnotation = {
  date: string;
  updates: { category: string; campaign_name: string; details: string | null }[];
};

// ─── Generic KPI area chart ────────────────────────────────────────────────────

function KpiAreaChart({
  data,
  label,
  formatValue,
  annotations = [],
}: {
  data: { date: string; value: number }[];
  label: string;
  formatValue: (v: number) => string;
  annotations?: ChartAnnotation[];
}) {
  const chartConfig: ChartConfig = { value: { label, color: "hsl(var(--chart-1))" } };
  const gradId = `grad-${label.replace(/\s+/g, "")}`;

  // Merge annotation dates into the data array so ReferenceLine can anchor to them
  const mergedData = useMemo(() => {
    if (annotations.length === 0) return data;
    const dateSet = new Set(data.map((d) => d.date));
    const extras = annotations
      .filter((a) => !dateSet.has(a.date))
      .map((a) => ({ date: a.date, value: null as unknown as number }));
    if (extras.length === 0) return data;
    return [...data, ...extras].sort((a, b) => a.date.localeCompare(b.date));
  }, [data, annotations]);

  if (data.length === 0 && annotations.length === 0) {
    return (
      <Card className="border-border/50 bg-white shadow-sm">
        <CardContent className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-white shadow-sm">
      <CardContent className="px-4 pb-3 pt-4">
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <AreaChart data={mergedData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => {
                const parts = v.split("-");
                return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
              }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={formatValue}
              width={64}
            />
            <ChartTooltip
              content={({ active, payload, label: hoverDate }) => {
                if (!active) return null;
                const val = payload?.[0]?.value as number | null | undefined;
                const dayAnnotations = annotations.find((a) => a.date === hoverDate)?.updates ?? [];
                if (val == null && dayAnnotations.length === 0) return null;
                return (
                  <div className="rounded-lg border border-border bg-background p-2.5 shadow-md text-xs min-w-[180px] max-w-[260px]">
                    <p className="text-muted-foreground mb-1.5">{hoverDate}</p>
                    {val != null && (
                      <p className="font-semibold mb-1">
                        {formatValue(val)}{" "}
                        <span className="font-normal text-muted-foreground">{label}</span>
                      </p>
                    )}
                    {dayAnnotations.length > 0 && (
                      <div className={cn("space-y-1.5", val != null && "mt-1.5 pt-1.5 border-t border-border")}>
                        {dayAnnotations.map((u, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <div
                              className="mt-0.5 h-2 w-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CATEGORY_SVG_COLORS[u.category] ?? CATEGORY_SVG_COLORS.other }}
                            />
                            <span className="text-muted-foreground leading-tight">
                              <span className="font-medium text-foreground">{u.campaign_name}</span>
                              {u.details ? ` — ${u.details.slice(0, 80)}${u.details.length > 80 ? "…" : ""}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {/* Change log reference lines */}
            {annotations.map((ann) => {
              const primaryColor = CATEGORY_SVG_COLORS[ann.updates[0]?.category ?? "other"];
              const count = ann.updates.length;
              return (
                <ReferenceLine
                  key={ann.date}
                  x={ann.date}
                  stroke={primaryColor}
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                  label={({ viewBox }: { viewBox?: { x?: number; y?: number } }) => {
                    const x = viewBox?.x;
                    const y = (viewBox?.y ?? 0) + 8;
                    if (x == null) return <g />;
                    return (
                      <g>
                        <circle cx={x} cy={y} r={6} fill={primaryColor} stroke="white" strokeWidth={1.5} />
                        {count > 1 && (
                          <text x={x} y={y + 3.5} textAnchor="middle" fontSize={7} fill="white" fontWeight="bold">
                            {count}
                          </text>
                        )}
                      </g>
                    );
                  }}
                />
              );
            })}
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill={`url(#${gradId})`}
              connectNulls
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── KPI stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, isActive, onClick,
}: {
  label: string; value: string; icon: React.ElementType;
  isActive?: boolean; onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "border-border/50 bg-white shadow-sm transition-all",
        onClick && "cursor-pointer hover:shadow-md",
        isActive && "ring-2 ring-primary border-primary/30",
      )}
    >
      <CardContent className="p-5">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          isActive ? "bg-primary" : "bg-primary/10",
        )}>
          <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-primary")} />
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientReport() {
  const { accountName } = useParams<{ accountName: string }>();
  const decodedName = decodeURIComponent(accountName ?? "");

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: max([startOfMonth(new Date()), MIN_DATE]),
    to: startOfDay(subDays(new Date(), 1)),
  });
  const [presetLabel, setPresetLabel] = useState<string>("This month");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);

  // Hover-to-open date picker in sidebar
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  const handleDateHoverEnter = () => { clearTimeout(hoverTimeout.current); setDatePickerOpen(true); };
  const handleDateHoverLeave = () => { hoverTimeout.current = setTimeout(() => setDatePickerOpen(false), 300); };

  // ── Ad data ──────────────────────────────────────────────────────────────
  const { data: allData, isLoading: adLoading } = useCouplerData();

  const filteredAdData = useMemo(() => {
    if (!allData) return [];
    const rows = allData.filter((r) => r["Account: Account name"] === decodedName);
    if (!dateRange?.from) return rows;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? startOfDay(dateRange.to) : from;
    return rows.filter((r) => {
      const [y, m, d] = r["Report: Date"].split("-").map(Number);
      const rowDate = new Date(y, m - 1, d);
      return rowDate >= from && rowDate <= to;
    });
  }, [allData, decodedName, dateRange]);

  // ── Account UUID (for GHL) ────────────────────────────────────────────────
  const { data: account } = useQuery({
    queryKey: ["account", decodedName],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, account_name")
        .eq("account_name", decodedName)
        .maybeSingle();
      return data;
    },
    staleTime: Infinity,
  });

  // ── GHL conversions ───────────────────────────────────────────────────────
  const accountId = account?.id ?? "";
  const { data: ghlRaw = [] } = useQuery({
    queryKey: ["ghl-conversions", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("ghl_conversions")
        .select("*")
        .eq("tecrm_id", accountId);
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const ghlConversions = useMemo(() => {
    if (!dateRange?.from) return ghlRaw;
    return ghlRaw.filter((c) => {
      const [y, m, d] = c.created_on.split("-").map(Number);
      const dateVal = new Date(y, m - 1, d);
      if (dateRange.from && dateVal < dateRange.from) return false;
      if (dateRange.to && dateVal > new Date(dateRange.to.getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [ghlRaw, dateRange]);

  // ── Campaign updates ──────────────────────────────────────────────────────
  const { data: updates = [] } = useQuery({
    queryKey: ["campaign-updates", decodedName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_updates")
        .select("*")
        .eq("account_name", decodedName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Creatives ─────────────────────────────────────────────────────────────
  const { data: creatives = [] } = useQuery({
    queryKey: ["creatives", decodedName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creatives")
        .select("*")
        .eq("account_name", decodedName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Appointments + outcome status ─────────────────────────────────────────
  const queryClient = useQueryClient();

  const appointments = useMemo(
    () => ghlConversions.filter((c) => c.type?.toLowerCase() === "appointment" || c.type?.toLowerCase() === "water test"),
    [ghlConversions]
  );

  const { mutate: saveOutcome } = useMutation({
    mutationFn: async ({ ghl_contact_id, status }: { ghl_contact_id: string; status: ApptStatus | "" }) => {
      const { error } = await supabase
        .from("ghl_conversions")
        .update({ appointment_status: status || null } as any)
        .eq("ghl_contact_id", ghl_contact_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-conversions", accountId] });
      toast.success("Status saved");
    },
    onError: () => toast.error("Failed to save status"),
  });

  const [dealValueDraft, setDealValueDraft] = useState<Record<string, string>>({});

  const { mutate: saveDealValue } = useMutation({
    mutationFn: async ({ ghl_contact_id, deal_value }: { ghl_contact_id: string; deal_value: number | null }) => {
      const { error } = await supabase
        .from("ghl_conversions")
        .update({ deal_value })
        .eq("ghl_contact_id", ghl_contact_id);
      if (error) throw error;
    },
    onSuccess: (_, { ghl_contact_id }) => {
      setDealValueDraft((prev) => { const next = { ...prev }; delete next[ghl_contact_id]; return next; });
      queryClient.invalidateQueries({ queryKey: ["ghl-conversions", accountId] });
      toast.success("Deal value saved");
    },
    onError: () => toast.error("Failed to save deal value"),
  });

  // ── Settings (controls which KPIs are shown) ──────────────────────────────
  const { settings } = useSettings();
  const enabledKpis = ALL_KPIS.filter((k) => settings.enabled_kpis.includes(k.key));
  // ── Selected chart (driven by clicking a KPI card) ───────────────────────
  const [selectedChart, setSelectedChart] = useState<KpiKey>("totalSpend");
  const selectedKpi = ALL_KPIS.find((k) => k.key === selectedChart);

  // ── KPI calculations (full set matching AccountCard) ──────────────────────
  const kpis = useMemo((): Record<KpiKey, number> => {
    const totalSpend = filteredAdData.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
    const totalClicks = filteredAdData.reduce((s, r) => s + (r["Performance: Clicks"] ?? 0), 0);
    const totalImpressions = filteredAdData.reduce((s, r) => s + (r["Performance: Impressions"] ?? 0), 0);
    const totalReach = filteredAdData.reduce((s, r) => s + (r["Performance: Reach"] ?? 0), 0);
    const avgCTR = filteredAdData.length > 0 ? filteredAdData.reduce((s, r) => s + (r["Clicks: CTR"] ?? 0), 0) / filteredAdData.length : 0;
    const avgCPC = filteredAdData.length > 0 ? filteredAdData.reduce((s, r) => s + (r["Cost: CPC"] ?? 0), 0) / filteredAdData.length : 0;
    const avgCPM = filteredAdData.length > 0 ? filteredAdData.reduce((s, r) => s + (r["Cost: CPM"] ?? 0), 0) / filteredAdData.length : 0;

    const webApptTotal = filteredAdData.reduce((s, r) => s + (r["Conversions: Website Appointments Scheduled - Total"] ?? 0), 0);
    const webApptCostRaw = filteredAdData.reduce((s, r) => s + (r["Conversions: Website Appointments Scheduled - Cost"] ?? 0), 0);
    const apptTotal = filteredAdData.reduce((s, r) => s + (r["Conversions: Appointments Scheduled - Total"] ?? 0), 0);
    const apptCostRaw = filteredAdData.reduce((s, r) => s + (r["Conversions: Appointments Scheduled - Cost"] ?? 0), 0);
    const leadsTotal = filteredAdData.reduce((s, r) => s + (r["Conversions: Leads - Total"] ?? 0), 0);
    const leadsCostRaw = filteredAdData.reduce((s, r) => s + (r["Conversions: Leads - Cost"] ?? 0), 0);
    const fbLeadsTotal = filteredAdData.reduce((s, r) => s + (r["Conversions: All On-Facebook Leads - Total"] ?? 0), 0);
    const fbLeadsCostRaw = filteredAdData.reduce((s, r) => s + (r["Conversions: All On-Facebook Leads - Cost"] ?? 0), 0);

    const ghlLeads = ghlConversions.filter((c) => c.type?.toLowerCase() === "lead" || c.type?.toLowerCase() === "water test").length;
    const ghlAppointments = ghlConversions.filter((c) => c.type?.toLowerCase() === "appointment" || c.type?.toLowerCase() === "water test").length;

    const soldCount = ghlConversions.filter((c) => c.appointment_status === "sold").length;
    const totalRevenue = ghlConversions
      .filter((c) => c.appointment_status === "sold")
      .reduce((sum, c) => sum + (c.deal_value ?? 0), 0);

    return {
      totalSpend, totalClicks, totalImpressions, totalReach, avgCTR, avgCPC, avgCPM,
      webApptTotal, webApptCost: webApptTotal > 0 ? webApptCostRaw / webApptTotal : 0,
      apptTotal, apptCost: apptTotal > 0 ? apptCostRaw / apptTotal : 0,
      leadsTotal, leadsCost: leadsTotal > 0 ? leadsCostRaw / leadsTotal : 0,
      fbLeadsTotal, fbLeadsCost: fbLeadsTotal > 0 ? fbLeadsCostRaw / fbLeadsTotal : 0,
      ghlLeads, ghlAppointments,
      ghlCostPerLead: ghlLeads > 0 ? totalSpend / ghlLeads : 0,
      ghlCostPerAppt: ghlAppointments > 0 ? totalSpend / ghlAppointments : 0,
      soldCount, totalRevenue,
      adRoi: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    };
  }, [filteredAdData, ghlConversions]);

  // ── Chart series data (one series per chartable KPI) ─────────────────────
  const chartSeriesData = useMemo(() => {
    // Aggregate ad data by date
    const adByDate: Record<string, {
      spend: number; clicks: number; impressions: number; reach: number;
      ctr_sum: number; cpc_sum: number; cpm_sum: number; count: number;
      webApptTotal: number; apptTotal: number; leadsTotal: number; fbLeadsTotal: number;
    }> = {};
    filteredAdData.forEach((r) => {
      const date = r["Report: Date"];
      if (!date) return;
      if (!adByDate[date]) adByDate[date] = { spend: 0, clicks: 0, impressions: 0, reach: 0, ctr_sum: 0, cpc_sum: 0, cpm_sum: 0, count: 0, webApptTotal: 0, apptTotal: 0, leadsTotal: 0, fbLeadsTotal: 0 };
      const d = adByDate[date];
      d.spend += r["Cost: Amount spend"] ?? 0;
      d.clicks += r["Performance: Clicks"] ?? 0;
      d.impressions += r["Performance: Impressions"] ?? 0;
      d.reach += r["Performance: Reach"] ?? 0;
      d.ctr_sum += r["Clicks: CTR"] ?? 0;
      d.cpc_sum += r["Cost: CPC"] ?? 0;
      d.cpm_sum += r["Cost: CPM"] ?? 0;
      d.count += 1;
      d.webApptTotal += r["Conversions: Website Appointments Scheduled - Total"] ?? 0;
      d.apptTotal += r["Conversions: Appointments Scheduled - Total"] ?? 0;
      d.leadsTotal += r["Conversions: Leads - Total"] ?? 0;
      d.fbLeadsTotal += r["Conversions: All On-Facebook Leads - Total"] ?? 0;
    });

    // Aggregate GHL data by date
    const ghlByDate: Record<string, { leads: number; appts: number }> = {};
    ghlConversions.forEach((c) => {
      const date = c.created_on;
      if (!date) return;
      if (!ghlByDate[date]) ghlByDate[date] = { leads: 0, appts: 0 };
      if (c.type?.toLowerCase() === "lead" || c.type?.toLowerCase() === "water test") ghlByDate[date].leads += 1;
      if (c.type?.toLowerCase() === "appointment" || c.type?.toLowerCase() === "water test") ghlByDate[date].appts += 1;
    });

    const adDates = Object.keys(adByDate).sort();
    const ghlDates = Object.keys(ghlByDate).sort();

    const adSeries = (key: KpiKey) => adDates.map((date) => {
      const d = adByDate[date];
      let value = 0;
      switch (key) {
        case "totalSpend":      value = d.spend; break;
        case "totalClicks":     value = d.clicks; break;
        case "totalImpressions":value = d.impressions; break;
        case "totalReach":      value = d.reach; break;
        case "avgCTR":          value = d.count > 0 ? d.ctr_sum / d.count : 0; break;
        case "avgCPC":          value = d.count > 0 ? d.cpc_sum / d.count : 0; break;
        case "avgCPM":          value = d.count > 0 ? d.cpm_sum / d.count : 0; break;
        case "webApptTotal":    value = d.webApptTotal; break;
        case "apptTotal":       value = d.apptTotal; break;
        case "leadsTotal":      value = d.leadsTotal; break;
        case "fbLeadsTotal":    value = d.fbLeadsTotal; break;
      }
      return { date, value: +value.toFixed(3) };
    });

    return {
      totalSpend: adSeries("totalSpend"), totalClicks: adSeries("totalClicks"),
      totalImpressions: adSeries("totalImpressions"), totalReach: adSeries("totalReach"),
      avgCTR: adSeries("avgCTR"), avgCPC: adSeries("avgCPC"), avgCPM: adSeries("avgCPM"),
      webApptTotal: adSeries("webApptTotal"), apptTotal: adSeries("apptTotal"),
      leadsTotal: adSeries("leadsTotal"), fbLeadsTotal: adSeries("fbLeadsTotal"),
      ghlLeads: ghlDates.map((date) => ({ date, value: ghlByDate[date].leads })),
      ghlAppointments: ghlDates.map((date) => ({ date, value: ghlByDate[date].appts })),
      ghlCostPerLead: [...new Set([...adDates, ...ghlDates])].sort().map((date) => {
        const spend = adByDate[date]?.spend ?? 0;
        const leads = ghlByDate[date]?.leads ?? 0;
        return { date, value: leads > 0 ? +(spend / leads).toFixed(2) : 0 };
      }),
      ghlCostPerAppt: [...new Set([...adDates, ...ghlDates])].sort().map((date) => {
        const spend = adByDate[date]?.spend ?? 0;
        const appts = ghlByDate[date]?.appts ?? 0;
        return { date, value: appts > 0 ? +(spend / appts).toFixed(2) : 0 };
      }),
    } as Partial<Record<KpiKey, { date: string; value: number }[]>>;
  }, [filteredAdData, ghlConversions]);

  // ── Unified timeline ─────────────────────────────────────────────────────
  type TimelineItem =
    | { type: "update"; date: string; data: (typeof updates)[number] }
    | { type: "creative-batch"; date: string; batchName: string; items: typeof creatives };

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = updates.map((u) => ({ type: "update" as const, date: u.created_at, data: u }));
    const batchMap: Record<string, typeof creatives> = {};
    creatives.forEach((c) => {
      const key = c.batch_name || "Ungrouped";
      if (!batchMap[key]) batchMap[key] = [];
      batchMap[key].push(c);
    });
    Object.entries(batchMap).forEach(([batchName, batchItems]) => {
      const launchDate = batchItems.find((c) => c.launch_date)?.launch_date;
      const sortDate = launchDate ?? batchItems.reduce((latest, c) => (c.created_at > latest ? c.created_at : latest), batchItems[0]?.created_at ?? "");
      items.push({ type: "creative-batch", date: sortDate, batchName, items: batchItems });
    });
    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  }, [updates, creatives]);

  // ── Timeline filtered by active date range ────────────────────────────────
  const filteredTimeline = useMemo(() => {
    if (!dateRange?.from) return timeline;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? startOfDay(dateRange.to) : from;
    return timeline.filter((item) => {
      const d = startOfDay(new Date(item.date));
      return d >= from && d <= to;
    });
  }, [timeline, dateRange]);

  // ── Chart annotations from change log (updates + creative batches) ────────
  const chartAnnotations = useMemo<ChartAnnotation[]>(() => {
    const grouped: Record<string, ChartAnnotation["updates"]> = {};
    timeline.forEach((item) => {
      const date = format(new Date(item.date), "yyyy-MM-dd");
      if (dateRange?.from && new Date(date) < dateRange.from) return;
      if (dateRange?.to && new Date(date) > dateRange.to) return;
      if (!grouped[date]) grouped[date] = [];
      if (item.type === "update") {
        grouped[date].push({ category: item.data.category, campaign_name: item.data.campaign_name, details: item.data.details });
      } else {
        grouped[date].push({ category: "creative_swap", campaign_name: item.batchName, details: `${item.items.length} asset${item.items.length !== 1 ? "s" : ""}` });
      }
    });
    return Object.entries(grouped).map(([date, upds]) => ({ date, updates: upds }));
  }, [timeline, dateRange]);

  // ── Date label ────────────────────────────────────────────────────────────
  const dateRangeStr = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "MM/dd")} – ${format(dateRange.to, "MM/dd/yyyy")}`
      : format(dateRange.from, "MM/dd/yyyy")
    : null;

  const dateLabel = presetLabel && dateRangeStr
    ? `${presetLabel} (${dateRangeStr})`
    : dateRangeStr ?? "All time";

  const isLoading = adLoading;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-border/50 bg-white px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Performance Report</p>
          <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-foreground">{decodedName}</h1>
        </div>
      </div>

      {/* Mobile toolbar — date picker + section nav (hidden on md+) */}
      <div className="md:hidden sticky top-0 z-10 border-b border-border/50 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[{ href: "#kpi-metrics", label: "Metrics" }, { href: "#appointments", label: "Appts" }, { href: "#change-log", label: "Changes" }].map(({ href, label }) => (
              <a key={href} href={href} className="shrink-0 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                {label}
              </a>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className="shrink-0 flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate max-w-[100px]">{presetLabel || dateRangeStr || "All time"}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1.5" align="end">
              <div className="flex flex-col gap-0.5">
                {[
                  { label: "Last 7 days", range: { from: max([startOfDay(subDays(new Date(), 7)), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                  { label: "Last 14 days", range: { from: max([startOfDay(subDays(new Date(), 14)), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                  { label: "Last 30 days", range: { from: max([startOfDay(subDays(new Date(), 29)), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                  { label: "Last month", range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
                  { label: "This month", range: { from: max([startOfMonth(new Date()), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant={presetLabel === preset.label ? "secondary" : "ghost"}
                    size="sm"
                    className="justify-start text-xs h-10 rounded-sm"
                    onClick={() => { setDateRange(preset.range); setPresetLabel(preset.label); }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex gap-6 items-start">

          {/* Sidebar nav */}
          <aside className="w-48 shrink-0 hidden md:block self-start sticky top-8">
            <div>
              <nav className="rounded-xl border border-border/50 bg-white shadow-sm overflow-hidden">

                {/* Date range — hover to open */}
                <div className="border-b border-border/50">
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date Range</p>
                  <div
                    className="p-1.5"
                    onMouseEnter={handleDateHoverEnter}
                    onMouseLeave={handleDateHoverLeave}
                  >
                    <Popover
                      open={datePickerOpen}
                      onOpenChange={(open) => {
                        setDatePickerOpen(open);
                        if (!open) { setShowCustomCalendar(false); setPendingRange(undefined); }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button className="w-full flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs text-left text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate leading-tight">{dateLabel}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        align="start"
                        sideOffset={-1}
                        className={cn("p-0 overflow-hidden", showCustomCalendar ? "w-auto" : "w-48")}
                        onMouseEnter={handleDateHoverEnter}
                        onMouseLeave={handleDateHoverLeave}
                      >
                        {!showCustomCalendar ? (
                          <div className="flex flex-col gap-0.5 p-1.5">
                            {[
                              { label: "Last 7 days", range: { from: max([startOfDay(subDays(new Date(), 7)), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                              { label: "Last 14 days", range: { from: max([startOfDay(subDays(new Date(), 14)), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                              { label: "Last 30 days", range: { from: max([startOfDay(subDays(new Date(), 29)), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                              { label: "Last month", range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
                              { label: "This month", range: { from: max([startOfMonth(new Date()), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                            ].filter((p) => p.range.to >= MIN_DATE).map((preset) => (
                              <Button
                                key={preset.label}
                                variant={presetLabel === preset.label ? "secondary" : "ghost"}
                                size="sm"
                                className="justify-start text-xs h-8 rounded-sm"
                                onClick={() => { setDateRange(preset.range); setPresetLabel(preset.label); setDatePickerOpen(false); }}
                              >
                                {preset.label}
                              </Button>
                            ))}
                            <div className="my-1 h-px bg-border" />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start text-xs h-8 rounded-sm"
                              onClick={() => { setPresetLabel(""); setPendingRange(undefined); setShowCustomCalendar(true); }}
                            >
                              Custom range…
                            </Button>
                            {dateRange?.from && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start text-xs h-8 rounded-sm text-muted-foreground"
                                onClick={() => { setDateRange(undefined); setPresetLabel(""); setDatePickerOpen(false); }}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                              <button
                                onClick={() => setShowCustomCalendar(false)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" /> Presets
                              </button>
                              <div className="ml-auto flex items-center gap-1.5 text-sm font-medium">
                                <span className={cn("rounded-md px-2 py-0.5 text-xs", pendingRange?.from ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                                  {pendingRange?.from ? format(pendingRange.from, "MMM d, yyyy") : "Start date"}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className={cn("rounded-md px-2 py-0.5 text-xs", pendingRange?.to ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                                  {pendingRange?.to ? format(pendingRange.to, "MMM d, yyyy") : "End date"}
                                </span>
                              </div>
                            </div>
                            <Calendar
                              mode="range"
                              fromDate={MIN_DATE}
                              selected={pendingRange}
                              onSelect={(range) => {
                                setPendingRange(range);
                                if (range?.from && range?.to) {
                                  setDateRange(range);
                                  setTimeout(() => { setDatePickerOpen(false); setShowCustomCalendar(false); }, 400);
                                }
                              }}
                              numberOfMonths={2}
                              className="p-3"
                            />
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Section links */}
                <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
                <div className="flex flex-col p-1.5 pt-0 gap-0.5 pb-2">
                  {[
                    { href: "#kpi-metrics", label: "KPI Metrics" },
                    { href: "#appointments", label: "Appointments" },
                    { href: "#change-log", label: "Change Log" },
                  ].map(({ href, label }) => (
                    <a
                      key={href}
                      href={href}
                      className="rounded-md px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    >
                      {label}
                    </a>
                  ))}
                </div>

              </nav>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-8">
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : (
          <>
            {/* ── KPI Grid + inline chart ── */}
            {enabledKpis.length > 0 && (
              <section id="kpi-metrics">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Key Metrics</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {enabledKpis.map(({ key, label, icon, format: fmt }) => (
                    <StatCard
                      key={key}
                      label={label}
                      value={fmt(kpis[key])}
                      icon={icon}
                      isActive={selectedChart === key}
                      onClick={CHARTABLE_KEYS.has(key) ? () => setSelectedChart(key) : undefined}
                    />
                  ))}
                </div>
                {/* Single adaptive chart */}
                {selectedKpi && CHARTABLE_KEYS.has(selectedChart) && (
                  <div className="mt-5">
                    <KpiAreaChart
                      data={chartSeriesData[selectedChart] ?? []}
                      label={selectedKpi.label}
                      formatValue={selectedKpi.format}
                      annotations={chartAnnotations}
                    />
                  </div>
                )}
              </section>
            )}

            {/* ── Appointments ── */}
            {appointments.length > 0 && (
              <section id="appointments">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Appointments{" "}
                  <span className="ml-1 text-xs font-normal text-muted-foreground/70">({appointments.length})</span>
                </h2>
                <Card className="border-border/50 bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                  <div className="min-w-[560px] divide-y divide-border/60">
                    {/* Header row */}
                    <div className="grid grid-cols-[1fr_140px_1fr_180px] gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50">
                      <span>Contact</span>
                      <span>Created On</span>
                      <span>Ad Source</span>
                      <span>Outcome</span>
                    </div>

                    {appointments.map((appt) => {
                      const statusVal = ((appt as any).appointment_status ?? "") as ApptStatus | "";
                      const statusMeta = APPT_STATUSES.find((s) => s.value === statusVal);
                      const savedDealValue = (appt as any).deal_value as number | null ?? null;
                      const dealValueInput = dealValueDraft[appt.ghl_contact_id] ?? (savedDealValue != null ? String(savedDealValue) : "");

                      return (
                        <div
                          key={appt.ghl_contact_id}
                          className="grid grid-cols-[1fr_140px_1fr_180px] gap-4 px-4 py-3 items-start text-sm"
                        >
                          {/* Contact */}
                          <div className="pt-1">
                            <p className="font-medium text-foreground leading-tight">
                              {appt.contact_name ?? "—"}
                            </p>
                            {appt.contact_phone && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {String(appt.contact_phone)}
                              </p>
                            )}
                          </div>

                          {/* Created On */}
                          <span className="text-xs text-muted-foreground whitespace-nowrap pt-1.5">
                            {appt.created_on
                              ? format(new Date(appt.created_on + "T00:00:00"), "MMM d, yyyy")
                              : "—"}
                          </span>

                          {/* Ad source */}
                          <span className="text-xs text-muted-foreground truncate pt-1.5">
                            {appt["Ad Name"] ?? "—"}
                          </span>

                          {/* Outcome cell: status select + optional deal value input */}
                          <div className="flex flex-col gap-1.5">
                            <Select
                              value={statusVal}
                              onValueChange={(val) =>
                                saveOutcome({ ghl_contact_id: appt.ghl_contact_id, status: val as ApptStatus | "" })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Set outcome…">
                                  {statusMeta ? (
                                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", statusMeta.color)}>
                                      {statusMeta.label}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">Set outcome…</span>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {APPT_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", s.color)}>
                                      {s.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {statusVal === "sold" && (
                              <div className="relative flex items-center">
                                <span className="absolute left-2 text-xs text-muted-foreground pointer-events-none">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-7 w-full rounded-md border border-input bg-background pl-5 pr-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  placeholder="Deal value"
                                  value={dealValueInput}
                                  onChange={(e) =>
                                    setDealValueDraft((prev) => ({ ...prev, [appt.ghl_contact_id]: e.target.value }))
                                  }
                                  onBlur={(e) => {
                                    const raw = e.target.value.trim();
                                    const newVal = raw === "" ? null : parseFloat(raw);
                                    if (newVal === null || !isNaN(newVal)) {
                                      saveDealValue({ ghl_contact_id: appt.ghl_contact_id, deal_value: newVal });
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </Card>
              </section>
            )}

            {/* ── Change Log ── */}
            {filteredTimeline.length > 0 && (
              <section id="change-log">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Change Log <span className="ml-1 text-xs font-normal text-muted-foreground/70">({filteredTimeline.length})</span>
                </h2>
                <div className="relative space-y-0">
                  {/* vertical line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-4 pl-7">
                    {filteredTimeline.map((item) => {
                      if (item.type === "update") {
                        const u = item.data;
                        const categoryLabel = CATEGORIES.find((c) => c.value === u.category)?.label ?? u.category;
                        return (
                          <div key={u.id} className="relative">
                            {/* dot */}
                            <div className="absolute -left-[25px] top-[14px] h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                            <Card className="border-border/50 bg-white shadow-sm">
                              <CardContent className="p-4 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary" className={`text-xs ${CATEGORY_COLORS[u.category] ?? CATEGORY_COLORS.other}`}>
                                    {categoryLabel}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{u.campaign_name}</span>
                                  <span className="ml-auto text-xs text-muted-foreground">
                                    {format(new Date(u.created_at), "MMM d, yyyy")}
                                  </span>
                                </div>
                                {u.details && <p className="text-sm text-foreground">{u.details}</p>}
                                {(u as any).image_url && (
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    {((u as any).image_url as string).split(",").map((url: string, i: number) => (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                        <img src={url} alt="Attachment" className="max-w-[140px] rounded-lg border border-border hover:opacity-80 transition-opacity" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {(u as any).link_url && (
                                  <a
                                    href={(u as any).link_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" /> {(u as any).link_url}
                                  </a>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        );
                      }

                      // Creative batch
                      const { batchName, items: batchItems } = item;
                      const launchDate = batchItems.find((c) => c.launch_date)?.launch_date;
                      const links = batchItems.filter((c) => c.file_type === "link");
                      const images = batchItems.filter((c) => c.file_type !== "link");

                      return (
                        <div key={`creative-${batchName}`} className="relative">
                          <div className="absolute -left-[25px] top-[14px] h-2.5 w-2.5 rounded-full border-2 border-background bg-indigo-400" />
                          <Card className="border-border/50 bg-white shadow-sm">
                            <CardContent className="p-4 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 text-xs">
                                  <ImageIcon className="h-3 w-3 mr-1" /> Creative
                                </Badge>
                                <span className="text-sm font-medium text-foreground">{batchName}</span>
                                {launchDate && (
                                  <span className="ml-auto text-xs text-muted-foreground">
                                    {format(new Date(launchDate + "T00:00:00"), "MMM d, yyyy")}
                                  </span>
                                )}
                              </div>
                              {links.length > 0 && (
                                <div className="space-y-0.5 pt-1">
                                  {links.map((l) => (
                                    <a key={l.id} href={l.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                      <ExternalLink className="h-3 w-3" /> {l.file_name}
                                    </a>
                                  ))}
                                </div>
                              )}
                              {images.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                                  {images.map((img) => (
                                    <a key={img.id} href={img.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                      <img src={img.file_url} alt={img.file_name} className="h-20 rounded-lg border border-border hover:opacity-80 transition-opacity" loading="lazy" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {filteredAdData.length === 0 && filteredTimeline.length === 0 && (
              <div className="py-20 text-center text-muted-foreground">No data found for the selected period.</div>
            )}
          </>
        )}
          </div>{/* end main content */}
        </div>{/* end flex */}
      </div>{/* end body container */}

      {/* Footer */}
      <div className="mt-8 border-t border-border/40 bg-white px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">Generated by <span className="font-semibold text-foreground">TE Reports</span></p>
      </div>
    </div>
  );
}
