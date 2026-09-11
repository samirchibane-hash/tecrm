import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "@/integrations/supabase/SupabaseContext";

/**
 * Every GHL conversion for one account (joined on tecrm_id). Same key and shape
 * as AccountCard and ClientReport use, so the account page's KPI tiles and its
 * per-creative CRM counts share one request.
 */
export function useAccountGhlConversions(accountId: string) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ["ghl-conversions", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.from("ghl_conversions").select("*").eq("tecrm_id", accountId);
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });
}
