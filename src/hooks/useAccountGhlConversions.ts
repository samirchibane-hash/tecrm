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

/**
 * Every account's GHL conversions since a date, for the cross-client funnel
 * scorecard. One request for the whole board rather than one per account.
 */
export function useAllGhlConversions(since: string) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ["ghl-conversions", "all", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ghl_conversions")
        .select("tecrm_id, type, created_on, \"Ad Name\"")
        .gte("created_on", since);
      if (error) throw error;
      return data;
    },
    enabled: !!since,
  });
}
