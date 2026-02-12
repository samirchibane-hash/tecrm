import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Link,
  ImagePlus,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { AdRow } from "@/hooks/useCouplerData";

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
  | "ghlLeads" | "ghlAppointments";

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
];

interface AccountCardProps {
  accountName: string;
  rows: AdRow[];
  visibleKpis: KpiKey[];
  dateRange?: { from?: Date; to?: Date };
}

export function AccountCard({ accountName, rows, visibleKpis, dateRange }: AccountCardProps) {
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);

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

  // Fetch GHL conversions matched by tecrm_id (first 8 chars of account UUID)
  const accountIdPrefix = account?.id?.slice(0, 8) ?? "";
  const { data: ghlConversionsRaw = [] } = useQuery({
    queryKey: ["ghl-conversions", accountIdPrefix],
    queryFn: async () => {
      if (!accountIdPrefix) return [];
      const { data, error } = await supabase
        .from("ghl_conversions")
        .select("*")
        .eq("tecrm_id", accountIdPrefix);
      if (error) throw error;
      return data;
    },
    enabled: !!accountIdPrefix,
  });

  // Filter GHL conversions by date range using created_on field
  const ghlConversions = useMemo(() => {
    if (!dateRange?.from) return ghlConversionsRaw;
    return ghlConversionsRaw.filter((c) => {
      const d = new Date(c.created_on);
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > new Date(dateRange.to.getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [ghlConversionsRaw, dateRange]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [details, setDetails] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
      ghlLeads: 0, ghlAppointments: 0,
    };
    if (rows.length === 0) return { ...empty, ghlLeads: ghlConversions.filter(c => c.type === 'lead').length, ghlAppointments: ghlConversions.filter(c => c.type === 'appointment').length };

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

    const ghlLeads = ghlConversions.filter(c => c.type === 'lead').length;
    const ghlAppointments = ghlConversions.filter(c => c.type === 'appointment').length;

    return {
      totalSpend, totalClicks, totalImpressions, totalReach, avgCTR, avgCPC, avgCPM,
      webApptTotal, webApptCost: webApptTotal > 0 ? webApptCost / webApptTotal : 0,
      apptTotal, apptCost: apptTotal > 0 ? apptCost / apptTotal : 0,
      leadsTotal, leadsCost: leadsTotal > 0 ? leadsCost / leadsTotal : 0,
      fbLeadsTotal, fbLeadsCost: fbLeadsTotal > 0 ? fbLeadsCost / fbLeadsTotal : 0,
      ghlLeads, ghlAppointments,
    };
  }, [rows, ghlConversions]);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const addUpdate = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let image_url: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${accountName}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("changelog-attachments")
          .upload(path, imageFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("changelog-attachments")
          .getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const { error } = await supabase.from("campaign_updates").insert({
        account_name: accountName,
        campaign_name: selectedCampaign,
        category: category as any,
        title: "",
        details: details || null,
        link_url: linkUrl || null,
        image_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-updates", accountName] });
      setSelectedCampaign("");
      setCategory("other");
      setDetails("");
      setLinkUrl("");
      setImageFile(null);
      setImagePreview(null);
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

  const displayedKpis = ALL_KPIS.filter((k) => visibleKpis.includes(k.key));

  return (
    <Card className="border-border/60 transition-all">
      <CardContent className="p-6 space-y-4">
        {/* Header + KPIs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{accountName}</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{campaigns.length} campaigns</p>
              {account?.id && (
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                  {account.id.slice(0, 8)}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {displayedKpis.map(({ key, label, icon: Icon, format }) => (
              <div key={key} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{format(kpis[key])}</span>
                <span className="hidden sm:inline text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expandable Change Log */}
        <Collapsible open={logOpen} onOpenChange={setLogOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-muted-foreground hover:text-foreground">
                {logOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <ClipboardList className="h-4 w-4" />
                Change Log ({updates.length})
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                    <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
                    <SelectContent>
                      {campaigns.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea placeholder="What changed? (details)" value={details} onChange={(e) => setDetails(e.target.value)} rows={2} />
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 w-full cursor-pointer" onChange={handleImageSelect} />
                    <Button type="button" variant="outline" size="sm" className="gap-1.5">
                      <ImagePlus className="h-3.5 w-3.5" /> Image
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Input placeholder="Link URL (optional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                {imagePreview && (
                  <div className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => addUpdate.mutate()}
                  disabled={!selectedCampaign || (!details.trim() && !imageFile && !linkUrl.trim()) || addUpdate.isPending || uploading}
                >
                  {uploading ? "Uploading…" : "Log Update"}
                </Button>
              </div>
            )}

            {updates.length === 0 && !showForm && (
              <p className="text-sm text-muted-foreground text-center py-4">No updates logged</p>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {updates.map((update) => (
                <div key={update.id} className="group rounded-lg border border-border/60 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-xs ${categoryColors[update.category] ?? categoryColors.other}`}>
                        {CATEGORIES.find((c) => c.value === update.category)?.label ?? update.category}
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
                    <img src={(update as any).image_url} alt="Attachment" className="mt-1 max-w-[200px] rounded-md border border-border" />
                  )}
                  {(update as any).link_url && (
                    <a href={(update as any).link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                      <ExternalLink className="h-3 w-3" /> {(update as any).link_url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
