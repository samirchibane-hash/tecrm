import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  ChevronDown,
  DollarSign,
  MousePointerClick,
  Eye,
  Users,
  TrendingUp,
  BarChart3,
  CalendarCheck,
  UserCheck,
  Target,
  PhoneCall,
  X,
  SquareArrowOutUpRight,
  Trophy,
  Zap,
  Sparkles,
  ChevronUp,
  Phone,
  Settings,
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import type { AdRow } from "@/hooks/useCouplerData";
import type { ChangeLogOption } from "@/hooks/useSettings";


const CPL_TARGET = 40;
const APPT_TARGET = 200;

const COST_TARGETS: Partial<Record<KpiKey, number>> = {
  leadsCost: CPL_TARGET,
  fbLeadsCost: CPL_TARGET,
  ghlCostPerLead: CPL_TARGET,
  apptCost: APPT_TARGET,
  webApptCost: APPT_TARGET,
  ghlCostPerAppt: APPT_TARGET,
};

function getCostStatus(value: number, target: number): "green" | "orange" | "red" | null {
  if (value <= 0) return null;
  if (value <= target) return "green";
  if (value <= target * 1.25) return "orange";
  return "red";
}

const STATUS_PILL: Record<string, string> = {
  green: "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/50",
  orange: "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/50",
  red: "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/50",
};

const STATUS_TEXT: Record<string, string> = {
  green: "text-green-700 dark:text-green-400",
  orange: "text-orange-700 dark:text-orange-400",
  red: "text-red-700 dark:text-red-400",
};

const LOWER_IS_BETTER_KEYS = new Set<KpiKey>([
  "ghlCostPerLead", "ghlCostPerAppt", "leadsCost", "fbLeadsCost",
  "apptCost", "webApptCost", "avgCPC", "avgCPM",
]);

function getDelta(current: number, prev: number): { pct: string; isUp: boolean } | null {
  if (prev <= 0 || current < 0) return null;
  const pct = ((current - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return null;
  const abs = Math.abs(pct);
  return { pct: (abs < 10 ? abs.toFixed(1) : Math.round(abs).toString()) + "%", isUp: pct > 0 };
}

function deltaClass(isUp: boolean, key: KpiKey): string {
  const good = LOWER_IS_BETTER_KEYS.has(key) ? !isUp : isUp;
  return good ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";
}

const CATEGORIES = [
  { value: "budget_change", label: "Budget Change" },
  { value: "creative_swap", label: "Creative Swap" },
  { value: "audience_update", label: "Audience Update" },
  { value: "bid_change", label: "Bid Change" },
  { value: "status_change", label: "Status Change" },
  { value: "other", label: "Other" },
] as const;

const categoryColors: Record<string, string> = {
  budget_change: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  creative_swap: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  audience_update: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  bid_change: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  status_change: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  other: "bg-muted text-muted-foreground",
};

const PALETTE: { badge: string; dot: string; label: string }[] = [
  { badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",     dot: "bg-blue-500",    label: "text-blue-700 dark:text-blue-400" },
  { badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", dot: "bg-emerald-500", label: "text-emerald-700 dark:text-emerald-400" },
  { badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300", dot: "bg-purple-500",  label: "text-purple-700 dark:text-purple-400" },
  { badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",  dot: "bg-amber-500",   label: "text-amber-700 dark:text-amber-400" },
  { badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",      dot: "bg-rose-500",    label: "text-rose-700 dark:text-rose-400" },
  { badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",      dot: "bg-cyan-500",    label: "text-cyan-700 dark:text-cyan-400" },
  { badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300", dot: "bg-orange-500", label: "text-orange-700 dark:text-orange-400" },
  { badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300", dot: "bg-indigo-500", label: "text-indigo-700 dark:text-indigo-400" },
  { badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",      dot: "bg-teal-500",    label: "text-teal-700 dark:text-teal-400" },
  { badge: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",      dot: "bg-pink-500",    label: "text-pink-700 dark:text-pink-400" },
];

export function getPalette(label: string, options: ChangeLogOption[]) {
  const idx = options.findIndex((o) => o.label === label);
  return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
}

export type KpiKey =
  | "totalSpend" | "totalClicks" | "totalImpressions" | "totalReach" | "avgCTR" | "avgCPC" | "avgCPM"
  | "webApptTotal" | "webApptCost" | "apptTotal" | "apptCost"
  | "leadsTotal" | "leadsCost" | "fbLeadsTotal" | "fbLeadsCost"
  | "ghlLeads" | "ghlAppointments" | "ghlCostPerLead" | "ghlCostPerAppt"
  | "soldCount" | "totalRevenue" | "adRoi";

export const ALL_KPIS: { key: KpiKey; label: string; icon: typeof DollarSign; format: (v: number) => string }[] = [
  { key: "totalSpend", label: "Spend", icon: DollarSign, format: (v) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: "totalClicks", label: "Clicks", icon: MousePointerClick, format: (v) => v.toLocaleString() },
  { key: "totalImpressions", label: "Impressions", icon: Eye, format: (v) => v.toLocaleString() },
  { key: "totalReach", label: "Reach", icon: Users, format: (v) => v.toLocaleString() },
  { key: "avgCTR", label: "Avg CTR", icon: TrendingUp, format: (v) => `${v.toFixed(2)}%` },
  { key: "avgCPC", label: "Avg CPC", icon: BarChart3, format: (v) => `$${v.toFixed(2)}` },
  { key: "avgCPM", label: "Avg CPM", icon: BarChart3, format: (v) => `$${v.toFixed(2)}` },
  { key: "webApptTotal", label: "Web Appts", icon: CalendarCheck, format: (v) => v.toLocaleString() },
  { key: "webApptCost", label: "Cost/Web Appt", icon: CalendarCheck, format: (v) => v > 0 ? `$${v.toFixed(2)}` : "–" },
  { key: "apptTotal", label: "Appts Scheduled", icon: PhoneCall, format: (v) => v.toLocaleString() },
  { key: "apptCost", label: "Cost/Appt", icon: PhoneCall, format: (v) => v > 0 ? `$${v.toFixed(2)}` : "–" },
  { key: "leadsTotal", label: "Leads", icon: UserCheck, format: (v) => v.toLocaleString() },
  { key: "leadsCost", label: "Cost/Lead", icon: UserCheck, format: (v) => v > 0 ? `$${v.toFixed(2)}` : "–" },
  { key: "fbLeadsTotal", label: "FB Leads", icon: Target, format: (v) => v.toLocaleString() },
  { key: "fbLeadsCost", label: "Cost/FB Lead", icon: Target, format: (v) => v > 0 ? `$${v.toFixed(2)}` : "–" },
  { key: "ghlLeads", label: "GHL Leads", icon: UserCheck, format: (v) => v.toLocaleString() },
  { key: "ghlAppointments", label: "GHL Appts", icon: CalendarCheck, format: (v) => v.toLocaleString() },
  { key: "ghlCostPerLead", label: "Cost/GHL Lead", icon: DollarSign, format: (v) => v > 0 ? `$${v.toFixed(2)}` : "–" },
  { key: "ghlCostPerAppt", label: "Cost/GHL Appt", icon: DollarSign, format: (v) => v > 0 ? `$${v.toFixed(2)}` : "–" },
  { key: "soldCount", label: "Deals Sold", icon: Trophy, format: (v) => v.toLocaleString() },
  { key: "totalRevenue", label: "Revenue", icon: DollarSign, format: (v) => v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "–" },
  { key: "adRoi", label: "ROAS", icon: Zap, format: (v) => v > 0 ? `${v.toFixed(1)}x` : "–" },
];

interface AccountCardProps {
  accountName: string;
  rows: AdRow[];
  prevRows?: AdRow[];
  prevDateRange?: { from?: Date; to?: Date };
  visibleKpis: KpiKey[];
  dateRange?: { from?: Date; to?: Date };
  changeLogOptions?: ChangeLogOption[];
}

export function AccountCard({ accountName, rows, prevRows = [], prevDateRange, visibleKpis, dateRange, changeLogOptions = [] }: AccountCardProps) {
  const isMobile = useIsMobile();
  const [activeAdChart, setActiveAdChart] = useState<"leads" | "appts" | null>(null);

  // Auto-upsert account row to ensure a stable UUID exists
  const { data: account } = useQuery({
    queryKey: ["account", accountName],
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("accounts")
        .select("id, account_name")
        .eq("account_name", accountName)
        .maybeSingle();
      if (existing) return existing;
      const { data: inserted, error } = await supabase
        .from("accounts")
        .insert({ account_name: accountName })
        .select("id, account_name")
        .single();
      if (error) throw error;
      return inserted;
    },
    staleTime: Infinity,
  });

  // Fetch GHL conversions matched by full account UUID as tecrm_id
  const accountId = account?.id ?? "";

  const { data: ghlConversionsRaw = [] } = useQuery({
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

  // Filter GHL conversions by date range using created_on field
  const ghlConversions = useMemo(() => {
    if (!dateRange?.from) return ghlConversionsRaw;
    return ghlConversionsRaw.filter((c) => {
      // created_on is a date-only field (YYYY-MM-DD); parse parts to avoid timezone shifts
      const [y, m, d] = c.created_on.split("-").map(Number);
      const dateVal = new Date(y, m - 1, d); // local midnight
      if (dateRange.from && dateVal < dateRange.from) return false;
      if (dateRange.to && dateVal > new Date(dateRange.to.getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [ghlConversionsRaw, dateRange]);

  const prevGhlConversions = useMemo(() => {
    if (!prevDateRange?.from) return [];
    return ghlConversionsRaw.filter((c) => {
      const [y, m, d] = c.created_on.split("-").map(Number);
      const dateVal = new Date(y, m - 1, d);
      if (prevDateRange.from && dateVal < prevDateRange.from) return false;
      if (prevDateRange.to && dateVal > new Date(prevDateRange.to.getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [ghlConversionsRaw, prevDateRange]);

  const prevKpis = useMemo((): Partial<Record<KpiKey, number>> | null => {
    if (prevRows.length === 0 && prevGhlConversions.length === 0) return null;
    const totalSpend = prevRows.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
    const totalClicks = prevRows.reduce((s, r) => s + (r["Performance: Clicks"] ?? 0), 0);
    const totalImpressions = prevRows.reduce((s, r) => s + (r["Performance: Impressions"] ?? 0), 0);
    const totalReach = prevRows.reduce((s, r) => s + (r["Performance: Reach"] ?? 0), 0);
    const avgCTR = prevRows.length > 0 ? prevRows.reduce((s, r) => s + (r["Clicks: CTR"] ?? 0), 0) / prevRows.length : 0;
    const avgCPC = prevRows.length > 0 ? prevRows.reduce((s, r) => s + (r["Cost: CPC"] ?? 0), 0) / prevRows.length : 0;
    const avgCPM = prevRows.length > 0 ? prevRows.reduce((s, r) => s + (r["Cost: CPM"] ?? 0), 0) / prevRows.length : 0;
    const webApptTotal = prevRows.reduce((s, r) => s + (r["Conversions: Website Appointments Scheduled - Total"] ?? 0), 0);
    const webApptCostRaw = prevRows.reduce((s, r) => s + (r["Conversions: Website Appointments Scheduled - Cost"] ?? 0), 0);
    const apptTotal = prevRows.reduce((s, r) => s + (r["Conversions: Appointments Scheduled - Total"] ?? 0), 0);
    const apptCostRaw = prevRows.reduce((s, r) => s + (r["Conversions: Appointments Scheduled - Cost"] ?? 0), 0);
    const leadsTotal = prevRows.reduce((s, r) => s + (r["Conversions: Leads - Total"] ?? 0), 0);
    const leadsCostRaw = prevRows.reduce((s, r) => s + (r["Conversions: Leads - Cost"] ?? 0), 0);
    const fbLeadsTotal = prevRows.reduce((s, r) => s + (r["Conversions: All On-Facebook Leads - Total"] ?? 0), 0);
    const fbLeadsCostRaw = prevRows.reduce((s, r) => s + (r["Conversions: All On-Facebook Leads - Cost"] ?? 0), 0);
    const ghlLeads = prevGhlConversions.filter(c => c.type?.toLowerCase() === 'lead' || c.type?.toLowerCase() === 'water test').length;
    const ghlAppointments = prevGhlConversions.filter(c => c.type?.toLowerCase() === 'appointment' || c.type?.toLowerCase() === 'water test').length;
    const soldCount = prevGhlConversions.filter(c => c.appointment_status === "sold").length;
    const totalRevenue = prevGhlConversions.filter(c => c.appointment_status === "sold").reduce((sum, c) => sum + (c.deal_value ?? 0), 0);
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
  }, [prevRows, prevGhlConversions]);

  const [aiSuggestions, setAiSuggestions] = useState<{ priority: string; suggestion: string }[] | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchAiSuggestions = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-suggestions", {
        body: {
          accountName,
          kpis,
          prevKpis,
          dateLabel: dateRange?.from
            ? `${dateRange.from.toLocaleDateString()} – ${dateRange.to?.toLocaleDateString() ?? ""}`
            : "All time",
        },
      });
      if (error) throw error;
      setAiSuggestions(data.suggestions ?? []);
    } catch {
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const kpis = useMemo(() => {
    const empty: Record<KpiKey, number> = {
      totalSpend: 0, totalClicks: 0, totalImpressions: 0, totalReach: 0,
      avgCTR: 0, avgCPC: 0, avgCPM: 0,
      webApptTotal: 0, webApptCost: 0, apptTotal: 0, apptCost: 0,
      leadsTotal: 0, leadsCost: 0, fbLeadsTotal: 0, fbLeadsCost: 0,
      ghlLeads: 0, ghlAppointments: 0, ghlCostPerLead: 0, ghlCostPerAppt: 0,
      soldCount: 0, totalRevenue: 0, adRoi: 0,
    };
    if (rows.length === 0) return { ...empty, ghlLeads: ghlConversions.filter(c => c.type?.toLowerCase() === 'lead' || c.type?.toLowerCase() === 'water test').length, ghlAppointments: ghlConversions.filter(c => c.type?.toLowerCase() === 'appointment' || c.type?.toLowerCase() === 'water test').length, ghlCostPerLead: 0, ghlCostPerAppt: 0 };

    const totalSpend = rows.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
    const totalClicks = rows.reduce((s, r) => s + (r["Performance: Clicks"] ?? 0), 0);
    const totalImpressions = rows.reduce((s, r) => s + (r["Performance: Impressions"] ?? 0), 0);
    const totalReach = rows.reduce((s, r) => s + (r["Performance: Reach"] ?? 0), 0);
    const avgCTR = rows.reduce((s, r) => s + (r["Clicks: CTR"] ?? 0), 0) / rows.length;
    const avgCPC = rows.reduce((s, r) => s + (r["Cost: CPC"] ?? 0), 0) / rows.length;
    const avgCPM = rows.reduce((s, r) => s + (r["Cost: CPM"] ?? 0), 0) / rows.length;

    const webApptTotal = rows.reduce((s, r) => s + (r["Conversions: Website Appointments Scheduled - Total"] ?? 0), 0);
    const webApptCost = rows.reduce((s, r) => s + (r["Conversions: Website Appointments Scheduled - Cost"] ?? 0), 0);
    const apptTotal = rows.reduce((s, r) => s + (r["Conversions: Appointments Scheduled - Total"] ?? 0), 0);
    const apptCost = rows.reduce((s, r) => s + (r["Conversions: Appointments Scheduled - Cost"] ?? 0), 0);
    const leadsTotal = rows.reduce((s, r) => s + (r["Conversions: Leads - Total"] ?? 0), 0);
    const leadsCost = rows.reduce((s, r) => s + (r["Conversions: Leads - Cost"] ?? 0), 0);
    const fbLeadsTotal = rows.reduce((s, r) => s + (r["Conversions: All On-Facebook Leads - Total"] ?? 0), 0);
    const fbLeadsCost = rows.reduce((s, r) => s + (r["Conversions: All On-Facebook Leads - Cost"] ?? 0), 0);

    const ghlLeads = ghlConversions.filter(c => c.type?.toLowerCase() === 'lead' || c.type?.toLowerCase() === 'water test').length;
    const ghlAppointments = ghlConversions.filter(c => c.type?.toLowerCase() === 'appointment' || c.type?.toLowerCase() === 'water test').length;

    const soldCount = ghlConversions.filter(c => c.appointment_status === "sold").length;
    const totalRevenue = ghlConversions
      .filter(c => c.appointment_status === "sold")
      .reduce((sum, c) => sum + (c.deal_value ?? 0), 0);

    return {
      totalSpend, totalClicks, totalImpressions, totalReach, avgCTR, avgCPC, avgCPM,
      webApptTotal, webApptCost: webApptTotal > 0 ? webApptCost / webApptTotal : 0,
      apptTotal, apptCost: apptTotal > 0 ? apptCost / apptTotal : 0,
      leadsTotal, leadsCost: leadsTotal > 0 ? leadsCost / leadsTotal : 0,
      fbLeadsTotal, fbLeadsCost: fbLeadsTotal > 0 ? fbLeadsCost / fbLeadsTotal : 0,
      ghlLeads, ghlAppointments,
      ghlCostPerLead: ghlLeads > 0 ? totalSpend / ghlLeads : 0,
      ghlCostPerAppt: ghlAppointments > 0 ? totalSpend / ghlAppointments : 0,
      soldCount, totalRevenue,
      adRoi: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    };
  }, [rows, ghlConversions]);

  // Group ghlConversions by Ad Name for the breakdown charts
  const leadsByAd = useMemo(() => {
    const map: Record<string, number> = {};
    ghlConversions
      .filter(c => c.type?.toLowerCase() === 'lead' || c.type?.toLowerCase() === 'water test')
      .forEach(c => {
        const name = c["Ad Name"] || "(No Ad Name)";
        map[name] = (map[name] ?? 0) + 1;
      });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [ghlConversions]);

  const apptsByAd = useMemo(() => {
    const map: Record<string, number> = {};
    ghlConversions
      .filter(c => c.type?.toLowerCase() === 'appointment' || c.type?.toLowerCase() === 'water test')
      .forEach(c => {
        const name = c["Ad Name"] || "(No Ad Name)";
        map[name] = (map[name] ?? 0) + 1;
      });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [ghlConversions]);


  const displayedKpis = ALL_KPIS.filter((k) => visibleKpis.includes(k.key));

  return (
    <Card className="border-border/60 transition-all">
      <CardContent className="p-6 space-y-4">
        {/* Header: account name + action buttons */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">{accountName}</h2>
            <RouterLink
              to={`/report/${encodeURIComponent(accountName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
              title="Open client report"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
            </RouterLink>
            <RouterLink
              to={`/cc-report/${encodeURIComponent(accountName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-sky-600 transition-colors shrink-0"
              title="Open call center report"
            >
              <Phone className="h-3.5 w-3.5" />
            </RouterLink>
          </div>
          <RouterLink
            to={`/account/${encodeURIComponent(accountName)}`}
            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          >
            <Settings className="h-3 w-3" />
            Manage
          </RouterLink>
        </div>

        {/* KPIs */}
        <div className="flex flex-col gap-2 items-start">
            {/* Spend */}
            {visibleKpis.includes("totalSpend") && (() => {
              const d = prevKpis ? getDelta(kpis.totalSpend, prevKpis.totalSpend ?? 0) : null;
              return (
                <div className="flex items-center gap-1.5 text-sm">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{ALL_KPIS.find(k => k.key === "totalSpend")!.format(kpis.totalSpend)}</span>
                  {d && <span className="text-xs text-muted-foreground">{d.isUp ? "↑" : "↓"}{d.pct}</span>}
                </div>
              );
            })()}

            {/* GHL Leads group — clickable */}
            {(visibleKpis.includes("ghlLeads") || visibleKpis.includes("ghlCostPerLead")) && (
              (() => {
                const leadsStatus = getCostStatus(kpis.ghlCostPerLead, CPL_TARGET);
                return (
                  <button
                    onClick={() => setActiveAdChart(prev => prev === "leads" ? null : "leads")}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors cursor-pointer ${activeAdChart === "leads" ? "border-primary/60 bg-primary/10" : leadsStatus ? STATUS_PILL[leadsStatus] : "border-border/60 bg-muted/30 hover:bg-muted/50"}`}
                  >
                    <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    {visibleKpis.includes("ghlLeads") && (() => {
                      const d = prevKpis ? getDelta(kpis.ghlLeads, prevKpis.ghlLeads ?? 0) : null;
                      return (
                        <span className="font-medium text-foreground">
                          {kpis.ghlLeads} <span className="text-xs text-muted-foreground">leads</span>
                          {d && <span className={`ml-1 text-xs ${deltaClass(d.isUp, "ghlLeads")}`}>{d.isUp ? "↑" : "↓"}{d.pct}</span>}
                        </span>
                      );
                    })()}
                    {visibleKpis.includes("ghlCostPerLead") && (() => {
                      const d = prevKpis ? getDelta(kpis.ghlCostPerLead, prevKpis.ghlCostPerLead ?? 0) : null;
                      return (
                        <span className="text-xs text-muted-foreground">
                          @ <span className={`font-medium ${leadsStatus ? STATUS_TEXT[leadsStatus] : "text-foreground"}`}>{kpis.ghlCostPerLead > 0 ? `$${kpis.ghlCostPerLead.toFixed(2)}` : "–"}</span>
                          {d && <span className={`ml-1 ${deltaClass(d.isUp, "ghlCostPerLead")}`}>{d.isUp ? "↑" : "↓"}{d.pct}</span>}
                        </span>
                      );
                    })()}
                  </button>
                );
              })()
            )}

            {/* GHL Appts group — clickable */}
            {(visibleKpis.includes("ghlAppointments") || visibleKpis.includes("ghlCostPerAppt")) && (
              (() => {
                const apptsStatus = getCostStatus(kpis.ghlCostPerAppt, APPT_TARGET);
                return (
                  <button
                    onClick={() => setActiveAdChart(prev => prev === "appts" ? null : "appts")}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors cursor-pointer ${activeAdChart === "appts" ? "border-primary/60 bg-primary/10" : apptsStatus ? STATUS_PILL[apptsStatus] : "border-border/60 bg-muted/30 hover:bg-muted/50"}`}
                  >
                    <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    {visibleKpis.includes("ghlAppointments") && (() => {
                      const d = prevKpis ? getDelta(kpis.ghlAppointments, prevKpis.ghlAppointments ?? 0) : null;
                      return (
                        <span className="font-medium text-foreground">
                          {kpis.ghlAppointments} <span className="text-xs text-muted-foreground">appts</span>
                          {d && <span className={`ml-1 text-xs ${deltaClass(d.isUp, "ghlAppointments")}`}>{d.isUp ? "↑" : "↓"}{d.pct}</span>}
                        </span>
                      );
                    })()}
                    {visibleKpis.includes("ghlCostPerAppt") && (() => {
                      const d = prevKpis ? getDelta(kpis.ghlCostPerAppt, prevKpis.ghlCostPerAppt ?? 0) : null;
                      return (
                        <span className="text-xs text-muted-foreground">
                          @ <span className={`font-medium ${apptsStatus ? STATUS_TEXT[apptsStatus] : "text-foreground"}`}>{kpis.ghlCostPerAppt > 0 ? `$${kpis.ghlCostPerAppt.toFixed(2)}` : "–"}</span>
                          {d && <span className={`ml-1 ${deltaClass(d.isUp, "ghlCostPerAppt")}`}>{d.isUp ? "↑" : "↓"}{d.pct}</span>}
                        </span>
                      );
                    })()}
                  </button>
                );
              })()
            )}

            {/* Remaining KPIs */}
            {displayedKpis
              .filter(({ key }) => !["totalSpend", "ghlLeads", "ghlCostPerLead", "ghlAppointments", "ghlCostPerAppt"].includes(key))
              .map(({ key, label, icon: Icon, format }) => {
                const target = COST_TARGETS[key];
                const status = target ? getCostStatus(kpis[key], target) : null;
                const d = prevKpis ? getDelta(kpis[key], prevKpis[key] ?? 0) : null;
                return (
                  <div key={key} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    <span className={`font-medium ${status ? STATUS_TEXT[status] : "text-foreground"}`}>{format(kpis[key])}</span>
                    {d && <span className={`text-xs ${deltaClass(d.isUp, key)}`}>{d.isUp ? "↑" : "↓"}{d.pct}</span>}
                    <span className="hidden sm:inline text-xs">{label}</span>
                  </div>
                );
              })}
          </div>

        {/* Ad Breakdown Chart Panel */}
        {activeAdChart && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {activeAdChart === "leads" ? "Leads by Ad" : "Appts by Ad"}
              </span>
              <button onClick={() => setActiveAdChart(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {(activeAdChart === "leads" ? leadsByAd : apptsByAd).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No data available</p>
            ) : (
              <div style={{ height: Math.max(120, (activeAdChart === "leads" ? leadsByAd : apptsByAd).length * 32) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={activeAdChart === "leads" ? leadsByAd : apptsByAd}
                    margin={{ top: 0, right: 36, left: 8, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={isMobile ? 90 : 160}
                      tick={{ fontSize: isMobile ? 10 : 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
                      formatter={(value) => [value, activeAdChart === "leads" ? "Leads" : "Appts"]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" label={{ position: "right", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* AI Suggestions */}
        <div>
          <button
            onClick={() => {
              if (aiSuggestions) {
                setAiOpen((v) => !v);
              } else {
                fetchAiSuggestions();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {aiLoading ? (
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-violet-500" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            )}
            <span>{aiLoading ? "Analyzing…" : aiSuggestions ? (aiOpen ? "Hide AI Insights" : "Show AI Insights") : "Get AI Insights"}</span>
            {aiSuggestions && !aiLoading && (
              aiOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {aiOpen && aiSuggestions && aiSuggestions.length > 0 && (
            <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Insights
              </p>
              {aiSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    s.priority === "high"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      : s.priority === "medium"
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  }`}>{s.priority}</span>
                  <p className="text-xs text-foreground leading-relaxed">{s.suggestion}</p>
                </div>
              ))}
              <button
                onClick={() => { setAiSuggestions(null); fetchAiSuggestions(); }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Refresh
              </button>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
