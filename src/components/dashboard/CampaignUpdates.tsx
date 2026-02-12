import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "budget_change", label: "Budget Change" },
  { value: "creative_swap", label: "Creative Swap" },
  { value: "audience_update", label: "Audience Update" },
  { value: "bid_change", label: "Bid Change" },
  { value: "status_change", label: "Status Change" },
  { value: "other", label: "Other" },
] as const;

const categoryColors: Record<string, string> = {
  budget_change: "bg-blue-100 text-blue-800",
  creative_swap: "bg-purple-100 text-purple-800",
  audience_update: "bg-green-100 text-green-800",
  bid_change: "bg-orange-100 text-orange-800",
  status_change: "bg-red-100 text-red-800",
  other: "bg-muted text-muted-foreground",
};

interface CampaignUpdatesProps {
  accountName: string;
  campaigns: string[];
}

export function CampaignUpdates({ accountName, campaigns }: CampaignUpdatesProps) {
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [showForm, setShowForm] = useState(false);

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

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ClipboardList className="h-4 w-4" /> Change Log
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="space-y-3 rounded-xl border border-border p-4">
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
          <p className="text-sm text-muted-foreground text-center py-6">No updates logged</p>
        )}

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {updates.map((update) => (
            <div key={update.id} className="group rounded-xl border border-border/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={categoryColors[update.category] ?? categoryColors.other}>
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
      </CardContent>
    </Card>
  );
}
