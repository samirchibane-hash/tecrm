import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ClipboardList,
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
  ImagePlus,
  ExternalLink,
  X,
  Image as ImageIcon,
  CalendarDays,
  SquareArrowOutUpRight,
  Trophy,
  Zap,
  Sparkles,
  ChevronUp,
  Link2,
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
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
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
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
          updates: updates.slice(0, 10).map((u) => ({
            date: new Date(u.created_at).toLocaleDateString(),
            title: (u as any).title || u.category,
            details: u.details,
          })),
          dateLabel: dateRange?.from
            ? `${dateRange.from.toLocaleDateString()} – ${dateRange.to?.toLocaleDateString() ?? ""}`
            : "All time",
        },
      });
      if (error) throw error;
      setAiSuggestions(data.suggestions ?? []);
    } catch {
      toast.error("Failed to get AI suggestions");
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const [showForm, setShowForm] = useState(false);
  // selectedLogOption format: "ParentLabel||SubOption" or "CampaignName||" when no sub-option
  const [selectedLogOption, setSelectedLogOption] = useState("");
  const [details, setDetails] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const campaigns = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r["Campaign: Campaign name"]));
    return Array.from(set).sort();
  }, [rows]);

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


  const { data: updates = [] } = useQuery({
    queryKey: ["campaign-updates", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_updates")
        .select("*")
        .eq("account_name", accountName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch creatives for this account
  const { data: creatives = [] } = useQuery({
    queryKey: ["creatives", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creatives")
        .select("*")
        .eq("account_name", accountName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Merge updates + creatives into a unified timeline
  type TimelineItem =
    | { type: "update"; date: string; data: (typeof updates)[number] }
    | { type: "creative-batch"; date: string; batchName: string; items: (typeof creatives) };

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = updates.map((u) => ({
      type: "update" as const,
      date: u.created_at,
      data: u,
    }));

    // Group creatives by batch_name, sort by latest created_at in each batch
    const batchMap: Record<string, typeof creatives> = {};
    creatives.forEach((c) => {
      const key = c.batch_name || "Ungrouped";
      if (!batchMap[key]) batchMap[key] = [];
      batchMap[key].push(c);
    });
    Object.entries(batchMap).forEach(([batchName, batchItems]) => {
      const sortDate = batchItems.reduce((latest, c) => c.created_at > latest ? c.created_at : latest, batchItems[0]?.created_at ?? "");
      items.push({ type: "creative-batch", date: sortDate, batchName, items: batchItems });
    });

    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  }, [updates, creatives]);

  const filteredTimeline = useMemo(() => {
    if (!dateRange?.from) return timeline;
    const from = dateRange.from.getTime();
    const to = dateRange.to ? dateRange.to.getTime() + 86400000 - 1 : Infinity;
    return timeline.filter((item) => {
      const t = new Date(item.date).getTime();
      return t >= from && t <= to;
    });
  }, [timeline, dateRange]);

  const totalLogCount = filteredTimeline.length;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const addUpdate = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of imageFiles) {
        const ext = file.name.split(".").pop();
        const path = `${accountName}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("changelog-attachments")
          .upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("changelog-attachments")
          .getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }

      // Parse "ParentLabel||SubOption" into campaign_name and title
      const sepIdx = selectedLogOption.indexOf("||");
      const campaignName = sepIdx >= 0 ? selectedLogOption.slice(0, sepIdx) : selectedLogOption;
      const titleValue = sepIdx >= 0 ? selectedLogOption.slice(sepIdx + 2) : "";

      const { error } = await supabase.from("campaign_updates").insert({
        account_name: accountName,
        campaign_name: campaignName,
        category: "other" as any,
        title: titleValue,
        details: details || null,
        link_url: linkUrl || null,
        image_url: uploadedUrls.length > 0 ? uploadedUrls.join(",") : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-updates", accountName] });
      setSelectedLogOption("");
      setDetails("");
      setLinkUrl("");
      setImageFiles([]);
      setImagePreviews([]);
      setShowForm(false);
      setUploading(false);
      toast.success("Update logged");
    },
    onError: () => { setUploading(false); toast.error("Failed to log update"); },
  });

  const deleteUpdate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_updates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-updates", accountName] });
      toast.success("Update deleted");
    },
  });

  // Account Links
  const [linksOpen, setLinksOpen] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const { data: accountLinks = [] } = useQuery({
    queryKey: ["account-links", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_links")
        .select("*")
        .eq("account_name", accountName)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("account_links").insert({
        account_name: accountName,
        label: newLinkLabel.trim(),
        url: newLinkUrl.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-links", accountName] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-links", accountName] });
    },
  });

  const displayedKpis = ALL_KPIS.filter((k) => visibleKpis.includes(k.key));

  return (
    <Card className="border-border/60 transition-all">
      <CardContent className="p-6 space-y-4">
        {/* Header + KPIs */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{accountName}</h2>
            <RouterLink
              to={`/report/${encodeURIComponent(accountName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Open client report"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
            </RouterLink>
          </div>
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
                      width={160}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
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

        {/* Links */}
        <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-muted-foreground hover:text-foreground">
                {linksOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Link2 className="h-4 w-4" />
                Links {accountLinks.length > 0 && `(${accountLinks.length})`}
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); setLinksOpen(true); setShowLinkForm((v) => !v); }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>

          <CollapsibleContent className="pt-2 space-y-2">
            {showLinkForm && (
              <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                <Input
                  placeholder="Label (e.g. Facebook LP)"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  className="h-7 text-xs flex-1"
                />
                <Input
                  placeholder="https://..."
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="h-7 text-xs flex-1"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!newLinkLabel.trim() || !newLinkUrl.trim() || addLink.isPending}
                  onClick={() => addLink.mutate()}
                >
                  Save
                </Button>
              </div>
            )}

            {accountLinks.length === 0 && !showLinkForm && (
              <p className="text-xs text-muted-foreground text-center py-2">No links added yet</p>
            )}

            <div className="flex flex-wrap gap-2">
              {accountLinks.map((link) => (
                <div key={link.id} className="group flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {link.label}
                  </a>
                  <button
                    onClick={() => deleteLink.mutate(link.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Expandable Change Log */}
        <Collapsible open={logOpen} onOpenChange={setLogOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-muted-foreground hover:text-foreground">
                {logOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <ClipboardList className="h-4 w-4" />
                Change Log ({totalLogCount})
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setLogOpen(true);
                setShowForm(!showForm);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>

          <CollapsibleContent className="pt-3 space-y-3">
            {showForm && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                {/* Single grouped dropdown: change log options from settings + raw ad campaigns as fallback */}
                <Select value={selectedLogOption} onValueChange={setSelectedLogOption}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign & change type" />
                  </SelectTrigger>
                  <SelectContent>
                    {changeLogOptions.map((opt) => (
                      <SelectGroup key={opt.label}>
                        <SelectLabel>{opt.label}</SelectLabel>
                        {opt.sub_options.length > 0
                          ? opt.sub_options.map((sub) => (
                              <SelectItem key={`${opt.label}||${sub}`} value={`${opt.label}||${sub}`}>
                                {sub}
                              </SelectItem>
                            ))
                          : (
                              <SelectItem value={`${opt.label}||`}>{opt.label}</SelectItem>
                            )
                        }
                      </SelectGroup>
                    ))}
                    {/* Fallback: ad campaigns not already covered by change_log_options labels */}
                    {(() => {
                      const coveredLabels = new Set(changeLogOptions.map((o) => o.label));
                      const extra = campaigns.filter((c) => !coveredLabels.has(c));
                      if (extra.length === 0) return null;
                      return (
                        <SelectGroup>
                          <SelectLabel>Ad Campaigns</SelectLabel>
                          {extra.map((c) => (
                            <SelectItem key={`${c}||`} value={`${c}||`}>{c}</SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })()}
                  </SelectContent>
                </Select>
                <Textarea placeholder="What changed? (details)" value={details} onChange={(e) => setDetails(e.target.value)} rows={2} />
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 w-full cursor-pointer" onChange={handleImageSelect} />
                    <Button type="button" variant="outline" size="sm" className="gap-1.5">
                      <ImagePlus className="h-3.5 w-3.5" /> Images
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Input placeholder="Link URL (optional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                {imagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                        <img src={src} alt="Preview" className="w-full h-full object-cover" />
                        <button className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5" onClick={() => removeImage(i)}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => addUpdate.mutate()}
                  disabled={!selectedLogOption || (!details.trim() && !imageFiles.length && !linkUrl.trim()) || addUpdate.isPending || uploading}
                >
                  {uploading ? "Uploading…" : "Log Update"}
                </Button>
              </div>
            )}

            {filteredTimeline.length === 0 && !showForm && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {dateRange?.from ? "No updates in this date range" : "No updates logged"}
              </p>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredTimeline.map((item) => {
                if (item.type === "update") {
                  const update = item.data;
                  return (
                    <div key={update.id} className="group rounded-lg border border-border/60 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={`text-xs ${categoryColors[update.category] ?? categoryColors.other}`}>
                            {(update as any).title || CATEGORIES.find((c) => c.value === update.category)?.label || update.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{update.campaign_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(update.created_at).toLocaleDateString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteUpdate.mutate(update.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {update.details && <p className="text-sm text-foreground">{update.details}</p>}
                      {(update as any).image_url && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {((update as any).image_url as string).split(",").map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="Attachment" className="max-w-[120px] rounded-md border border-border hover:opacity-80 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      )}
                      {(update as any).link_url && (
                        <a href={(update as any).link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                          <ExternalLink className="h-3 w-3" /> {(update as any).link_url}
                        </a>
                      )}
                    </div>
                  );
                }

                // Creative batch entry
                const { batchName, items: batchItems } = item;
                const links = batchItems.filter((c) => c.file_type === "link");
                const images = batchItems.filter((c) => c.file_type !== "link");

                return (
                  <div key={`creative-${batchName}`} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs">
                          <ImageIcon className="h-3 w-3 mr-1" /> Creative
                        </Badge>
                        <span className="text-xs font-medium text-foreground">{batchName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                    {links.length > 0 && (
                      <div className="space-y-0.5">
                        {links.map((l) => (
                          <a key={l.id} href={l.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" /> {l.file_name}
                          </a>
                        ))}
                      </div>
                    )}
                    {images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {images.map((img) => (
                          <a key={img.id} href={img.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <img
                              src={img.file_url}
                              alt={img.file_name}
                              className="h-16 rounded-md border border-border hover:opacity-80 transition-opacity"
                              loading="lazy"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
