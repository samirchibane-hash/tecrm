import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adNameKey } from "./ghl";
import type { LabelOverride } from "./labels";

/** Hand-set offer / angle per ad name for one account (creative_labels). */
export function useCreativeLabels(accountId: string) {
  const queryClient = useQueryClient();
  const key = ["creative-labels", accountId];

  const query = useQuery({
    queryKey: key,
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase.from("creative_labels").select("ad_name, offer, angle").eq("account_id", accountId);
      if (error) throw error;
      return new Map<string, LabelOverride>((data ?? []).map((r) => [adNameKey(r.ad_name), { offer: r.offer, angle: r.angle }]));
    },
  });

  const save = useMutation({
    // offer / angle: a key to pin it, null to go back to detection.
    mutationFn: async ({ adName, offer, angle }: { adName: string; offer: string | null; angle: string | null }) => {
      if (offer === null && angle === null) {
        const { error } = await supabase.from("creative_labels").delete().eq("account_id", accountId).eq("ad_name", adName);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("creative_labels")
        .upsert({ account_id: accountId, ad_name: adName, offer, angle, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: () => toast.error("Couldn't save the label"),
  });

  return { overrides: query.data ?? new Map<string, LabelOverride>(), isLoading: query.isLoading, save };
}
