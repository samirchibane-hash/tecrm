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

export type KpiKey = "totalSpend" | "totalClicks" | "totalImpressions" | "totalReach" | "avgCTR" | "avgCPC";

export const ALL_KPIS: { key: KpiKey; label: string; icon: typeof DollarSign; format: (v: number) => string }[] = [
  { key: "totalSpend", label: "Spend", icon: DollarSign, format: (v) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: "totalClicks", label: "Clicks", icon: MousePointerClick, format: (v) => v.toLocaleString() },
  { key: "totalImpressions", label: "Impressions", icon: Eye, format: (v) => v.toLocaleString() },
  { key: "totalReach", label: "Reach", icon: Users, format: (v) => v.toLocaleString() },
  { key: "avgCTR", label: "Avg CTR", icon: TrendingUp, format: (v) => `${v.toFixed(2)}%` },
  { key: "avgCPC", label: "Avg CPC", icon: BarChart3, format: (v) => `$${v.toFixed(2)}` },
];

interface AccountCardProps {
  accountName: string;
  rows: AdRow[];
  visibleKpis: KpiKey[];
}

export function AccountCard({ accountName, rows, visibleKpis }: AccountCardProps) {
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const campaigns = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r["Campaign: Campaign name"]));
    return Array.from(set).sort();
  }, [rows]);

  const kpis = useMemo(() => {
    if (rows.length === 0)
      return { totalSpend: 0, totalClicks: 0, totalImpressions: 0, totalReach: 0, avgCTR: 0, avgCPC: 0 };
    const totalSpend = rows.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
    const totalClicks = rows.reduce((s, r) => s + (r["Performance: Clicks"] ?? 0), 0);
    const totalImpressions = rows.reduce((s, r) => s + (r["Performance: Impressions"] ?? 0), 0);
    const totalReach = rows.reduce((s, r) => s + (r["Performance: Reach"] ?? 0), 0);
    const avgCTR = rows.reduce((s, r) => s + (r["Clicks: CTR"] ?? 0), 0) / rows.length;
    const avgCPC = rows.reduce((s, r) => s + (r["Cost: CPC"] ?? 0), 0) / rows.length;
    return { totalSpend, totalClicks, totalImpressions, totalReach, avgCTR, avgCPC };
  }, [rows]);

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

  const addUpdate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campaign_updates").insert({
        account_name: accountName,
        campaign_name: selectedCampaign,
        category: category as any,
        title,
        details: details || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-updates", accountName] });
      setSelectedCampaign("");
      setCategory("other");
      setTitle("");
      setDetails("");
      setShowForm(false);
      toast.success("Update logged");
    },
    onError: () => toast.error("Failed to log update"),
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
            <p className="text-xs text-muted-foreground">{campaigns.length} campaigns</p>
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
                <Input placeholder="Title (e.g. Increased budget to $500/day)" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea placeholder="Additional details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} rows={2} />
                <Button
                  size="sm"
                  onClick={() => addUpdate.mutate()}
                  disabled={!selectedCampaign || !title.trim() || addUpdate.isPending}
                >
                  Log Update
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
                  <p className="text-sm font-medium text-foreground">{update.title}</p>
                  {update.details && <p className="text-xs text-muted-foreground">{update.details}</p>}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
