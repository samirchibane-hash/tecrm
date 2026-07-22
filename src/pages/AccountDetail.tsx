import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCouplerData } from "@/hooks/useCouplerData";
import { useSettings } from "@/hooks/useSettings";
import { ALL_KPIS, type KpiKey } from "@/components/dashboard/AccountCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChartContainer } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  UserCircle2,
  Link2,
  ExternalLink,
  ClipboardList,
  CheckCircle2,
  SquareArrowOutUpRight,
  Phone,
  CalendarDays,
  Circle,
  ListTodo,
  Copy,
  Image as ImageIcon,
  Layers,
  FolderOpen,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, subDays, startOfMonth, endOfMonth, subMonths, max, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const MIN_DATE = startOfDay(new Date(2026, 1, 12));

const CHARTABLE_KEYS = new Set<KpiKey>([
  "totalSpend", "totalClicks", "totalImpressions", "totalReach",
  "avgCTR", "avgCPC", "avgCPM",
  "webApptTotal", "apptTotal", "leadsTotal", "fbLeadsTotal",
  "ghlLeads", "ghlAppointments", "ghlCostPerLead", "ghlCostPerAppt",
]);

// Annotations are secondary to the metric, so they share one recessive colour and
// distinguish task vs. creative brief by icon + label — never by colour alone.
const ANNOTATION_COLOR = "hsl(var(--muted-foreground))";

type ChartAnnotationItem = {
  kind: "task" | "brief";
  label: string;
  detail: string | null;
};

type ChartAnnotation = {
  date: string;
  items: ChartAnnotationItem[];
};

const ANNOTATION_ICON = { task: ListTodo, brief: ClipboardList } as const;

// ─── Inline area chart (with task / creative-brief annotations) ──────────────

function KpiAreaChart({ data, label, formatValue, annotations = [] }: {
  data: { date: string; value: number }[];
  label: string;
  formatValue: (v: number) => string;
  annotations?: ChartAnnotation[];
}) {
  const gradId = `grad-acct-${label.replace(/\s+/g, "")}`;

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
      <Card className="border-border/50 bg-card shadow-sm">
        <CardContent className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-border/50 bg-card shadow-sm">
      <CardContent className="px-4 pb-3 pt-4">
        <ChartContainer config={{ value: { label, color: "hsl(var(--chart-1))" } }} className="h-[200px] w-full">
          <AreaChart data={mergedData} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
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
              tickFormatter={(v) => { const p = v.split("-"); return `${parseInt(p[1])}/${parseInt(p[2])}`; }}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatValue} width={60} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
              content={({ active, payload, label: hoverDate }) => {
                if (!active) return null;
                const val = payload?.[0]?.value as number | null | undefined;
                const dayAnn = annotations.find((a) => a.date === hoverDate);
                if (val == null && !dayAnn) return null;
                return (
                  <div className="rounded-lg border border-border bg-background p-2.5 shadow-md text-xs min-w-[160px] max-w-[240px]">
                    <p className="text-muted-foreground mb-1">{hoverDate}</p>
                    {val != null && <p className="font-semibold mb-1">{formatValue(val)} <span className="font-normal text-muted-foreground">{label}</span></p>}
                    {dayAnn && (
                      <div className={cn("space-y-1", val != null && "mt-1.5 pt-1.5 border-t border-border")}>
                        {dayAnn.items.map((item, i) => {
                          const Icon = ANNOTATION_ICON[item.kind];
                          return (
                            <div key={i} className="flex items-start gap-1.5">
                              <Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="text-muted-foreground leading-tight">
                                <span className="font-medium text-foreground">{item.label}</span>
                                {item.detail ? ` — ${item.detail.slice(0, 70)}${item.detail.length > 70 ? "…" : ""}` : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {annotations.map((ann) => (
              <ReferenceLine
                key={ann.date}
                x={ann.date}
                stroke={ANNOTATION_COLOR}
                strokeDasharray="3 3"
                strokeWidth={1.5}
                strokeOpacity={0.5}
                label={({ viewBox }: { viewBox?: { x?: number; y?: number } }) => {
                  const x = viewBox?.x;
                  const y = (viewBox?.y ?? 0) + 8;
                  if (x == null) return <g />;
                  return (
                    <g>
                      <circle cx={x} cy={y} r={5} fill={ANNOTATION_COLOR} stroke="hsl(var(--background))" strokeWidth={2} />
                      {ann.items.length > 1 && (
                        <text x={x} y={y + 3.5} textAnchor="middle" fontSize={7} fill="hsl(var(--background))" fontWeight="bold">{ann.items.length}</text>
                      )}
                    </g>
                  );
                }}
              />
            ))}
            <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} fill={`url(#${gradId})`} connectNulls dot={false} />
          </AreaChart>
        </ChartContainer>
        {annotations.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
            <span className="font-medium">Markers</span>
            <span className="flex items-center gap-1"><ListTodo className="h-3 w-3" /> Task completed</span>
            <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" /> Creative brief</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── KPI stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, isActive, onClick }: {
  label: string; value: string; icon: React.ElementType; isActive?: boolean; onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "border-border/50 bg-card shadow-sm transition-all",
        onClick && "cursor-pointer hover:shadow-md",
        isActive && "ring-2 ring-primary border-primary/30",
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", isActive ? "bg-primary" : "bg-primary/10")}>
            <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-primary")} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold tracking-tight text-foreground leading-tight">{value}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Task types ───────────────────────────────────────────────────────────────

type Task = {
  id: string; title: string; account_name: string | null;
  priority: string; completed: boolean; stage: string; due_date: string | null;
  created_at: string; updated_at: string;
};

// ─── Creative briefs (requests) ───────────────────────────────────────────────

type CreativeRequest = {
  id: string; account_name: string; template_name: string; ad_angle: string;
  offer_type: string; ad_type: string; status: string; notes: string | null;
  assigned_to: string | null; gdrive_folder_url: string | null;
  created_at: string; updated_at: string;
};

const BRIEF_STATUS_LABEL: Record<string, string> = {
  assigned: "Assigned", reviewing: "Reviewing", approved: "Approved", launched: "Launched",
};
const BRIEF_STATUS_BADGE: Record<string, string> = {
  assigned: "bg-slate-100 text-slate-700", reviewing: "bg-blue-100 text-blue-800",
  approved: "bg-amber-100 text-amber-800", launched: "bg-emerald-100 text-emerald-800",
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500", medium: "bg-amber-500", low: "bg-sky-500",
};

const AccountDetail = () => {
  const { accountName } = useParams<{ accountName: string }>();
  const decodedName = decodeURIComponent(accountName ?? "");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: couplerData } = useCouplerData();
  const { settings } = useSettings();

  // ─── Account (stable UUID) ────────────────────────────────────────────────
  const { data: account } = useQuery({
    queryKey: ["account", decodedName],
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("accounts")
        .select("id, account_name, gdrive_folder_url")
        .eq("account_name", decodedName)
        .maybeSingle();
      if (existing) return existing;
      const { data: inserted, error } = await supabase
        .from("accounts")
        .insert({ account_name: decodedName })
        .select("id, account_name, gdrive_folder_url")
        .single();
      if (error) throw error;
      return inserted;
    },
    staleTime: Infinity,
  });
  const accountId = account?.id ?? "";

  // ─── Linked onboarding client ─────────────────────────────────────────────
  const { data: linkedClient } = useQuery({
    queryKey: ["linked-client", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("account_id", accountId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Date range (for KPIs / chart) ──────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: max([startOfMonth(new Date()), MIN_DATE]),
    to: startOfDay(new Date()),
  });
  const [presetLabel, setPresetLabel] = useState("Month to Date");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState<KpiKey>("totalSpend");

  // ─── Filtered ad data ─────────────────────────────────────────────────────
  const filteredAdData = useMemo(() => {
    if (!couplerData) return [];
    const rows = couplerData.filter((r) => r["Account: Account name"] === decodedName);
    if (!dateRange?.from) return rows;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? startOfDay(dateRange.to) : from;
    return rows.filter((r) => {
      const [y, m, d] = r["Report: Date"].split("-").map(Number);
      const rowDate = new Date(y, m - 1, d);
      return rowDate >= from && rowDate <= to;
    });
  }, [couplerData, decodedName, dateRange]);

  // ─── GHL conversions ──────────────────────────────────────────────────────
  const { data: ghlRaw = [] } = useQuery({
    queryKey: ["ghl-conversions", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.from("ghl_conversions").select("*").eq("tecrm_id", accountId);
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

  // ─── KPI calculations ─────────────────────────────────────────────────────
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
    const totalRevenue = ghlConversions.filter((c) => c.appointment_status === "sold").reduce((sum, c) => sum + (c.deal_value ?? 0), 0);
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

  // ─── Chart series data ────────────────────────────────────────────────────
  const chartSeriesData = useMemo(() => {
    const adByDate: Record<string, { spend: number; clicks: number; impressions: number; reach: number; ctr_sum: number; cpc_sum: number; cpm_sum: number; count: number; webApptTotal: number; apptTotal: number; leadsTotal: number; fbLeadsTotal: number }> = {};
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
        case "totalSpend": value = d.spend; break;
        case "totalClicks": value = d.clicks; break;
        case "totalImpressions": value = d.impressions; break;
        case "totalReach": value = d.reach; break;
        case "avgCTR": value = d.count > 0 ? d.ctr_sum / d.count : 0; break;
        case "avgCPC": value = d.count > 0 ? d.cpc_sum / d.count : 0; break;
        case "avgCPM": value = d.count > 0 ? d.cpm_sum / d.count : 0; break;
        case "webApptTotal": value = d.webApptTotal; break;
        case "apptTotal": value = d.apptTotal; break;
        case "leadsTotal": value = d.leadsTotal; break;
        case "fbLeadsTotal": value = d.fbLeadsTotal; break;
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
      ghlCostPerLead: [...new Set([...adDates, ...ghlDates])].sort().map((date) => ({ date, value: (ghlByDate[date]?.leads ?? 0) > 0 ? +((adByDate[date]?.spend ?? 0) / ghlByDate[date].leads).toFixed(2) : 0 })),
      ghlCostPerAppt: [...new Set([...adDates, ...ghlDates])].sort().map((date) => ({ date, value: (ghlByDate[date]?.appts ?? 0) > 0 ? +((adByDate[date]?.spend ?? 0) / ghlByDate[date].appts).toFixed(2) : 0 })),
    } as Partial<Record<KpiKey, { date: string; value: number }[]>>;
  }, [filteredAdData, ghlConversions]);

  // ─── Account tasks ────────────────────────────────────────────────────────
  const { data: accountTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ["tasks", decodedName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*").eq("account_name", decodedName)
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const activeTaskCount = accountTasks.filter((t) => !t.completed).length;
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return;
    await supabase.from("tasks").insert({ title: newTaskTitle.trim(), priority: newTaskPriority, account_name: decodedName, due_date: newTaskDueDate || null });
    setNewTaskTitle(""); setNewTaskPriority("medium"); setNewTaskDueDate(""); setIsAddingTask(false);
    refetchTasks();
  }

  async function handleToggleTask(task: Task) {
    const completed = !task.completed;
    await supabase
      .from("tasks")
      .update({ completed, stage: completed ? "launched" : "assigned" })
      .eq("id", task.id);
    refetchTasks();
  }

  async function handleDeleteTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    refetchTasks();
  }

  // ─── KPI meta ─────────────────────────────────────────────────────────────
  const enabledKpis = ALL_KPIS.filter((k) => settings.enabled_kpis.includes(k.key));
  const selectedKpi = ALL_KPIS.find((k) => k.key === selectedChart);

  const dateRangeStr = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "MM/dd")} – ${format(dateRange.to, "MM/dd/yy")}`
      : format(dateRange.from, "MM/dd/yy")
    : null;
  const dateLabel = presetLabel && dateRangeStr ? `${presetLabel} (${dateRangeStr})` : dateRangeStr ?? "All time";

  // ─── Creatives ────────────────────────────────────────────────────────────
  type Creative = { id: string; account_name: string; batch_name: string | null; file_name: string; file_url: string; file_type: string; launch_date: string | null; created_at: string };

  const { data: clientCreatives = [] } = useQuery({
    queryKey: ["creatives", decodedName],
    queryFn: async () => {
      const { data, error } = await supabase.from("creatives").select("*").eq("account_name", decodedName).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Creative[];
    },
  });

  // Creative briefs (requests)
  const { data: creativeRequests = [] } = useQuery({
    queryKey: ["creative-requests", decodedName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_requests")
        .select("*")
        .eq("account_name", decodedName)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as CreativeRequest[];
    },
  });

  // ─── Chart annotations: completed tasks + creative briefs ─────────────────
  // A task marks the chart on the day it was completed (the day the change landed);
  // a brief marks the day its status last moved.
  const chartAnnotations = useMemo((): ChartAnnotation[] => {
    const inRange = (d: Date) => {
      if (dateRange?.from && d < startOfDay(dateRange.from)) return false;
      if (dateRange?.to && d > startOfDay(dateRange.to)) return false;
      return true;
    };
    const grouped: Record<string, ChartAnnotationItem[]> = {};
    const push = (at: string, item: ChartAnnotationItem) => {
      const d = new Date(at);
      if (!inRange(startOfDay(d))) return;
      const date = format(d, "yyyy-MM-dd");
      (grouped[date] ??= []).push(item);
    };

    accountTasks
      .filter((t) => t.completed)
      .forEach((t) => push(t.updated_at, { kind: "task", label: t.title, detail: "Task completed" }));
    creativeRequests.forEach((req) =>
      push(req.updated_at, {
        kind: "brief",
        label: req.template_name,
        detail: BRIEF_STATUS_LABEL[req.status] ?? req.status,
      }),
    );

    return Object.entries(grouped)
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [accountTasks, creativeRequests, dateRange]);

  // Also fetch template meta rows (stored under any account) for type/link info
  const { data: allCreatives = [] } = useQuery({
    queryKey: ["creatives"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creatives").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data as Creative[];
    },
  });

  const creativeBatches = useMemo(() => {
    const myBatchNames = new Set(
      clientCreatives.filter((c) => c.file_type !== "template_type").map((c) => c.batch_name || "Uncategorized")
    );
    const map: Record<string, Creative[]> = {};
    allCreatives.forEach((c) => {
      const key = c.batch_name || "Uncategorized";
      if (!myBatchNames.has(key)) return;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return Object.entries(map).map(([name, items]) => {
      const previewImage = items.find((i) => i.file_type === "image")?.file_url ?? null;
      const typeMeta = items.find((i) => i.file_type === "template_type");
      const templateType: "image" | "video" | null = typeMeta && (typeMeta.file_name === "image" || typeMeta.file_name === "video") ? typeMeta.file_name as "image" | "video" : null;
      const templateLink = typeMeta?.file_url ?? "";
      const myLink = clientCreatives.find((c) => c.batch_name === name && c.file_type === "link")?.file_url ?? null;
      return { name, previewImage, templateType, templateLink, myLink };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [allCreatives, clientCreatives, decodedName]);

  // ─── POC ──────────────────────────────────────────────────────────────────
  const [pocName, setPocName] = useState("");
  const [pocEmail, setPocEmail] = useState("");
  const [savingPoc, setSavingPoc] = useState(false);
  const [deletingPocId, setDeletingPocId] = useState<string | null>(null);

  const { data: pocs = [], isLoading: pocsLoading } = useQuery({
    queryKey: ["account-poc", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await (supabase as any)
        .from("account_poc")
        .select("id, name, email")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; email: string }[];
    },
    enabled: !!accountId,
  });

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const canAddPoc = pocName.trim().length > 0 && isValidEmail(pocEmail.trim());

  const handleAddPoc = async () => {
    if (!canAddPoc || savingPoc) return;
    setSavingPoc(true);
    const { data, error } = await (supabase as any)
      .from("account_poc")
      .insert({ account_id: accountId, name: pocName.trim(), email: pocEmail.trim() })
      .select("id, name, email")
      .single();
    if (error) {
      toast.error("Failed to add contact");
    } else {
      queryClient.setQueryData(["account-poc", accountId], (prev: any[]) => [...(prev ?? []), data]);
      setPocName("");
      setPocEmail("");
      toast.success("Contact added");
    }
    setSavingPoc(false);
  };

  const handleDeletePoc = async (id: string) => {
    setDeletingPocId(id);
    const { error } = await (supabase as any).from("account_poc").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove contact");
    } else {
      queryClient.setQueryData(["account-poc", accountId], (prev: any[]) =>
        (prev ?? []).filter((p: any) => p.id !== id)
      );
    }
    setDeletingPocId(null);
  };

  // ─── Account Links ────────────────────────────────────────────────────────
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);

  const { data: accountLinks = [] } = useQuery({
    queryKey: ["account-links", decodedName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_links")
        .select("*")
        .eq("account_name", decodedName)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("account_links").insert({
        account_name: decodedName,
        label: newLinkLabel.trim(),
        url: newLinkUrl.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-links", decodedName] });
      setNewLinkLabel("");
      setNewLinkUrl("");
      setShowLinkForm(false);
      toast.success("Link saved");
    },
    onError: () => toast.error("Failed to save link"),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account-links", decodedName] }),
  });

  const [driveUrlInput, setDriveUrlInput] = useState((account as any)?.gdrive_folder_url ?? "");
  const [driveSaving, setDriveSaving] = useState(false);
  const [drivePopoverOpen, setDrivePopoverOpen] = useState(false);

  useEffect(() => {
    setDriveUrlInput((account as any)?.gdrive_folder_url ?? "");
  }, [(account as any)?.gdrive_folder_url]);

  async function saveDriveUrl(onSuccess?: () => void) {
    if (!accountId) return;
    setDriveSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({ gdrive_folder_url: driveUrlInput || null })
      .eq("id", accountId);
    if (error) toast.error("Failed to save Drive folder");
    else {
      queryClient.invalidateQueries({ queryKey: ["account", decodedName] });
      toast.success("Drive folder saved");
      onSuccess?.();
    }
    setDriveSaving(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10 sm:px-6 lg:px-8">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/")}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{decodedName}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-xs text-muted-foreground">Client management</p>
                {account?.id && (
                  <>
                    <span className="text-xs text-muted-foreground/40">·</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(account.id); toast.success("TECRM ID copied"); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors font-mono"
                      title="Copy TECRM ID"
                    >
                      {account.id.slice(0, 8)}…
                      <Copy className="h-2.5 w-2.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(account as any)?.gdrive_folder_url ? (
              <a
                href={(account as any).gdrive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-emerald-600 hover:border-emerald-300/70 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Drive
              </a>
            ) : (
              <Popover open={drivePopoverOpen} onOpenChange={setDrivePopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-md border border-dashed border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40 transition-colors">
                    <Plus className="h-3 w-3" />
                    Add Drive
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={6} className="w-80 p-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Google Drive folder</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Paste the client's shared folder URL</p>
                    </div>
                    <Input
                      autoFocus
                      value={driveUrlInput}
                      onChange={(e) => setDriveUrlInput(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/…"
                      className="text-xs h-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && driveUrlInput.trim() && !driveSaving)
                          saveDriveUrl(() => setDrivePopoverOpen(false));
                      }}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { setDrivePopoverOpen(false); setDriveUrlInput(""); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!driveUrlInput.trim() || driveSaving}
                        onClick={() => saveDriveUrl(() => setDrivePopoverOpen(false))}
                      >
                        {driveSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <RouterLink
              to={`/report/${encodeURIComponent(decodedName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
              Client Report
            </RouterLink>
            <RouterLink
              to={`/cc-report/${encodeURIComponent(decodedName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-sky-600 hover:bg-muted/50 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              CC Report
            </RouterLink>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <Tabs defaultValue="profile">
          <TabsList className="mb-6">
            <TabsTrigger value="profile">Overview</TabsTrigger>
            <TabsTrigger value="creatives">
              Creatives
              {creativeBatches.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {creativeBatches.length}
                </span>
              )}
            </TabsTrigger>
            {linkedClient && (
              <TabsTrigger value="client-profile">Client Profile</TabsTrigger>
            )}
          </TabsList>

          {/* ── Overview Tab ────────────────────────────────────────────────── */}
          <TabsContent value="profile" className="space-y-6">

            {/* ── KPIs + Chart (annotated with tasks / creative briefs) ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Metrics</h2>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
                      {dateLabel}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1.5" align="end">
                    <div className="flex flex-col gap-0.5">
                      {[
                        { label: "Last 7 days", range: { from: max([startOfDay(subDays(new Date(), 7)), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                        { label: "Last 30 days", range: { from: max([startOfDay(subDays(new Date(), 29)), MIN_DATE]), to: startOfDay(subDays(new Date(), 1)) } },
                        { label: "Last month", range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
                        { label: "Month to Date", range: { from: max([startOfMonth(new Date()), MIN_DATE]), to: startOfDay(new Date()) } },
                        { label: "All time", range: { from: undefined, to: undefined } },
                      ].map((p) => (
                        <Button key={p.label} variant={presetLabel === p.label ? "secondary" : "ghost"} size="sm" className="justify-start text-xs h-8 rounded-sm"
                          onClick={() => { setDateRange(p.range.from ? p.range as DateRange : undefined); setPresetLabel(p.label); setDatePickerOpen(false); }}>
                          {p.label}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {enabledKpis.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {enabledKpis.map(({ key, label, icon, format: fmt }) => (
                      <StatCard key={key} label={label} value={fmt(kpis[key])} icon={icon}
                        isActive={selectedChart === key}
                        onClick={CHARTABLE_KEYS.has(key) ? () => setSelectedChart(key) : undefined}
                      />
                    ))}
                  </div>
                  {selectedKpi && CHARTABLE_KEYS.has(selectedChart) && (
                    <div className="mt-3">
                      <KpiAreaChart
                        data={chartSeriesData[selectedChart] ?? []}
                        label={selectedKpi.label}
                        formatValue={selectedKpi.format}
                        annotations={chartAnnotations}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4">No KPIs enabled — configure them in Settings.</p>
              )}
            </section>

            {/* ── Creative Briefs ── */}
            {creativeRequests.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Creative Briefs
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {creativeRequests.length}
                  </span>
                </h2>
                <div className="space-y-2">
                  {creativeRequests.map((req) => (
                    <div key={req.id} className="rounded-xl border border-border/60 bg-card p-3 flex flex-col gap-2 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BRIEF_STATUS_BADGE[req.status] ?? "bg-slate-100 text-slate-700")}>
                          {BRIEF_STATUS_LABEL[req.status] ?? req.status}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", req.ad_type === "image_ads" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800")}>
                          {req.ad_type === "image_ads" ? <ImageIcon className="inline h-3 w-3 mr-0.5" /> : <Film className="inline h-3 w-3 mr-0.5" />}
                          {req.ad_type === "image_ads" ? "Image" : "Video"}
                        </span>
                        <span className="text-sm font-medium text-foreground">{req.template_name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{format(new Date(req.updated_at), "MMM d, yyyy")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{req.ad_angle} · {req.offer_type}</p>
                      {req.notes && <p className="text-xs text-foreground/80 whitespace-pre-wrap">{req.notes}</p>}
                      {req.gdrive_folder_url && (
                        <a href={req.gdrive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> View creative folder
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Tasks ── */}
            <section>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Tasks</span>
                    {activeTaskCount > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{activeTaskCount}</span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-border/40">
                  {accountTasks.length === 0 && !isAddingTask && (
                    <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>
                  )}
                  {accountTasks.map((task) => {
                    const dotColor = PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium;
                    const dueDateInfo = task.due_date ? (() => {
                      const d = new Date(task.due_date + "T00:00:00");
                      if (isToday(d)) return { label: "Today", cls: "text-amber-600" };
                      if (isPast(new Date(task.due_date + "T23:59:59"))) return { label: format(d, "MMM d"), cls: "text-red-600" };
                      return { label: format(d, "MMM d"), cls: "text-muted-foreground" };
                    })() : null;
                    return (
                      <div key={task.id} className={cn("group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors", task.completed && "opacity-55")}>
                        <button onClick={() => handleToggleTask(task)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                          {task.completed ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
                        </button>
                        <span className={cn("flex-1 text-sm min-w-0 truncate", task.completed ? "line-through text-muted-foreground" : "text-foreground")}>
                          {task.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 text-xs">
                          <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", dotColor)} title={task.priority} />
                          {dueDateInfo && <span className={cn("text-[11px] tabular-nums", dueDateInfo.cls)}>{dueDateInfo.label}</span>}
                        </div>
                        <button onClick={() => handleDeleteTask(task.id)} className="shrink-0 text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {isAddingTask && (
                    <div className="px-4 py-3 space-y-2.5 bg-muted/20">
                      <Input
                        autoFocus
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); if (e.key === "Escape") { setIsAddingTask(false); setNewTaskTitle(""); } }}
                        placeholder="Task title…"
                        className="h-8 text-sm"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          {(["low", "medium", "high"] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => setNewTaskPriority(p)}
                              className={cn("text-xs px-2 py-0.5 rounded border transition-colors capitalize", newTaskPriority === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="text-xs h-7 px-2 rounded border border-border bg-background text-foreground" />
                        <div className="ml-auto flex gap-1.5">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); }}>Cancel</Button>
                          <Button size="sm" className="h-7 text-xs" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>Add</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {!isAddingTask && (
                  <button onClick={() => setIsAddingTask(true)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/40">
                    <Plus className="h-3.5 w-3.5" />
                    Add task
                  </button>
                )}
              </div>
            </section>

            {/* ── Funnel Pages ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Funnel Pages
                    {accountLinks.length > 0 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {accountLinks.length}
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowLinkForm((v) => !v)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Link
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showLinkForm && (
                  <div className="flex items-end gap-2 rounded-xl border border-border p-3 bg-muted/20">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Label</Label>
                        <Input placeholder="e.g. Landing Page" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">URL</Label>
                        <Input placeholder="https://..." value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" className="h-8" disabled={!newLinkLabel.trim() || !newLinkUrl.trim() || addLink.isPending} onClick={() => addLink.mutate()}>Save</Button>
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => { setShowLinkForm(false); setNewLinkLabel(""); setNewLinkUrl(""); }}>Cancel</Button>
                    </div>
                  </div>
                )}
                {accountLinks.length === 0 && !showLinkForm ? (
                  <p className="text-sm text-muted-foreground py-2">No funnel pages added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {accountLinks.map((link) => (
                      <div key={link.id} className="group flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{link.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { navigator.clipboard.writeText(link.url); toast.success("Link copied"); }}
                            className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            title="Copy link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            onClick={() => deleteLink.mutate(link.id)}
                            className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Google Drive ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  Google Drive
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(account as any)?.gdrive_folder_url && (
                  <a
                    href={(account as any).gdrive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    Open Client Folder
                  </a>
                )}
                <div className="flex gap-2 items-center">
                  <Input
                    value={driveUrlInput}
                    onChange={(e) => setDriveUrlInput(e.target.value)}
                    placeholder="Paste Google Drive folder URL…"
                    className="text-xs h-8"
                  />
                  <Button
                    size="sm"
                    className="h-8 shrink-0"
                    disabled={driveSaving || driveUrlInput === ((account as any)?.gdrive_folder_url ?? "")}
                    onClick={saveDriveUrl}
                  >
                    {driveSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Points of Contact ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                  Points of Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pocsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : pocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No contacts added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {pocs.map((poc) => (
                      <div key={poc.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/60 bg-muted/20">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{poc.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{poc.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{poc.email}</p>
                        </div>
                        <button onClick={() => handleDeletePoc(poc.id)} disabled={deletingPocId === poc.id} className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          {deletingPocId === poc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-2 border-t border-border/50 space-y-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Add Contact</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="poc-name" className="text-xs text-muted-foreground mb-1 block">Name</Label>
                      <Input id="poc-name" placeholder="Jane Smith" value={pocName} onChange={(e) => setPocName(e.target.value)} className="h-9 text-sm" onKeyDown={(e) => e.key === "Enter" && canAddPoc && !savingPoc && handleAddPoc()} />
                    </div>
                    <div>
                      <Label htmlFor="poc-email" className="text-xs text-muted-foreground mb-1 block">Email</Label>
                      <Input id="poc-email" type="email" placeholder="jane@company.com" value={pocEmail} onChange={(e) => setPocEmail(e.target.value)} className="h-9 text-sm" onKeyDown={(e) => e.key === "Enter" && canAddPoc && !savingPoc && handleAddPoc()} />
                    </div>
                  </div>
                  <Button onClick={handleAddPoc} disabled={!canAddPoc || savingPoc || !accountId} size="sm" className="gap-1.5">
                    {savingPoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add Contact
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Creatives Tab ───────────────────────────────────────────────── */}
          <TabsContent value="creatives">
            {creativeBatches.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <Layers className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No creative templates produced for this client yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {creativeBatches.map(({ name, previewImage, templateType, templateLink, myLink }) => (
                  <div key={name} className="rounded-xl border border-border/60 bg-card overflow-hidden flex flex-col shadow-sm">
                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                      {previewImage ? (
                        <img src={previewImage} alt={name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/25" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-snug">{name}</p>
                          {templateType && (
                            <span className={cn(
                              "inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              templateType === "video" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"
                            )}>
                              {templateType === "video" ? "Video" : "Image"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 mt-auto">
                        {myLink && (
                          <a
                            href={myLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs text-foreground hover:bg-muted/60 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                            Open in Drive
                          </a>
                        )}
                        {templateLink && (
                          <a
                            href={templateLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            Template source
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Client Profile Tab ──────────────────────────────────────────── */}
          {linkedClient && (
            <TabsContent value="client-profile" className="space-y-5">

              {(() => {
                const c = linkedClient as any;
                const bh = c.business_hours as Record<string, { open: string; close: string; status: string }> | null;
                const DAY_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
                const amountFormatted = c.amount_paid ? `$${(c.amount_paid / 100).toLocaleString()}` : null;

                function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
                  return (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{title}</h3>
                      <div className="rounded-xl border border-border bg-card p-4 space-y-3">{children}</div>
                    </div>
                  );
                }
                function Field({ label, value }: { label: string; value: React.ReactNode }) {
                  if (!value && value !== 0) return null;
                  return (
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
                      <span className="text-sm font-medium text-foreground">{value}</span>
                    </div>
                  );
                }

                return (
                  <>
                    <ProfileSection title="Business">
                      <Field label="Business Name" value={c.business_name} />
                      <Field label="Legal Name" value={c.legal_business_name} />
                      <Field label="Business Type" value={c.business_type} />
                      <Field label="EIN" value={c.ein} />
                      <Field label="Location" value={c.city && c.state ? `${c.city}, ${c.state}` : null} />
                      <Field label="Service Area" value={c.service_area} />
                      {c.website_url && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                          <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">Website</span>
                          <a href={c.website_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                            {c.website_url}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      <Field label="Business Phone" value={c.business_phone} />
                      <Field label="Business Email" value={c.business_email} />
                    </ProfileSection>

                    <ProfileSection title="Owner / Point of Contact">
                      <Field label="Owner Name" value={c.owner_name} />
                      <Field label="Owner Email" value={c.owner_email} />
                      <Field label="Owner Cell" value={c.owner_cell} />
                    </ProfileSection>

                    <ProfileSection title="Service & Budget">
                      <Field label="Service" value={c.service} />
                      <Field label="Plan" value={c.plan} />
                      <Field label="Ad Budget" value={c.ad_budget} />
                      <Field label="Amount Paid" value={amountFormatted} />
                      {c.brands && c.brands.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                          <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">Brands</span>
                          <div className="flex flex-wrap gap-1.5">
                            {c.brands.map((b: string) => (
                              <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </ProfileSection>

                    {c.offers && c.offers.length > 0 && (
                      <ProfileSection title="Offers">
                        <ul className="space-y-2">
                          {c.offers.map((offer: string, i: number) => (
                            <li key={i} className="text-sm text-foreground">• {offer}</li>
                          ))}
                        </ul>
                      </ProfileSection>
                    )}

                    {bh && (
                      <ProfileSection title="Business Hours">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {DAY_ORDER.map((day) => {
                            const h = bh[day];
                            if (!h) return null;
                            const closed = h.status === "closed";
                            return (
                              <div key={day} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground w-24">{day}</span>
                                {closed ? (
                                  <span className="text-muted-foreground italic text-xs">Closed</span>
                                ) : (
                                  <span className="font-medium">{h.open} – {h.close}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ProfileSection>
                    )}

                    {c.additional_notes && (
                      <ProfileSection title="Additional Notes">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{c.additional_notes}</p>
                      </ProfileSection>
                    )}

                    <ProfileSection title="Social & Ads">
                      <Field label="Has Facebook" value={c.has_facebook ? "Yes" : "No"} />
                      {c.facebook_url && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                          <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">Facebook URL</span>
                          <a href={c.facebook_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                            {c.facebook_url}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </ProfileSection>

                    <div className="text-xs text-muted-foreground pt-1">
                      Submitted {c.submitted_at ? format(new Date(c.submitted_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                      {amountFormatted && <span className="ml-3 text-green-600 font-medium">{amountFormatted}</span>}
                    </div>
                  </>
                );
              })()}

            </TabsContent>
          )}

        </Tabs>
      </div>
    </div>
  );
};

export default AccountDetail;
