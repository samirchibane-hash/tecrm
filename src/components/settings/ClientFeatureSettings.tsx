import { Phone } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAccountRows } from "./useAccountRows";

export function ClientFeatureSettings() {
  const queryClient = useQueryClient();
  const { data: accountRows = [], isLoading } = useAccountRows();

  // Account feature flags (call center enabled per account)
  const { data: featureRows = [] } = useQuery({
    queryKey: ["account-features-all"],
    queryFn: async () => {
      const { data } = await supabase.from("account_features").select("account_id, call_center_enabled");
      return data ?? [];
    },
  });
  const featureMap: Record<string, boolean> = Object.fromEntries(
    featureRows.map((r) => [r.account_id, r.call_center_enabled]),
  );

  const toggleCallCenter = useMutation({
    mutationFn: async ({ accountId, enabled }: { accountId: string; enabled: boolean }) => {
      const { error } = await supabase.from("account_features").upsert(
        { account_id: accountId, call_center_enabled: enabled, updated_at: new Date().toISOString() },
        { onConflict: "account_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-features-all"] });
      queryClient.invalidateQueries({ queryKey: ["account-features"] });
    },
    onError: () => toast.error("Failed to update client features"),
  });

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <p className="pb-2 text-sm text-muted-foreground">
          The Call Center Dashboard is a VIP-only offering. Only enable it for clients who have the service active.
        </p>
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        {!isLoading && accountRows.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No accounts found</p>
        )}
        {accountRows.map((row) => {
          const enabled = featureMap[row.id] ?? false;
          return (
            <div key={row.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <Label htmlFor={`cc-${row.id}`} className="block truncate font-medium">{row.account_name}</Label>
                  <p className="text-xs text-muted-foreground">Call Center Dashboard</p>
                </div>
                {enabled && (
                  <Badge variant="secondary" className="shrink-0 bg-primary/10 px-1.5 py-0 text-[10px] text-primary">
                    VIP
                  </Badge>
                )}
              </div>
              <Switch
                id={`cc-${row.id}`}
                checked={enabled}
                onCheckedChange={(val) => toggleCallCenter.mutate({ accountId: row.id, enabled: val })}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
