import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FUNNEL_SITE_COLUMNS = "id, root_dir, domain, ghl_inbound_webhook_url";

export type FunnelSiteRow = {
  id: string;
  root_dir: string;
  domain: string;
  ghl_inbound_webhook_url: string | null;
};

/** Funnel sites linked to one account. Shared by the Funnel tab's page list and webhook field. */
export function useFunnelSites(accountId: string) {
  return useQuery({
    queryKey: ["funnel-sites", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<FunnelSiteRow[]> => {
      const { data, error } = await supabase
        .from("funnel_sites")
        .select(FUNNEL_SITE_COLUMNS)
        .eq("account_id", accountId)
        .order("domain");
      if (error) throw error;
      return data ?? [];
    },
  });
}
