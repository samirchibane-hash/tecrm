import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** A client's funnel pages (synced from funnels/dist) and hand-added links. */
export function useAccountLinks(accountName: string) {
  return useQuery({
    queryKey: ["account-links", accountName],
    enabled: !!accountName,
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
}
