import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FUNNEL_SITE_COLUMNS = "id, root_dir, domain, ghl_inbound_webhook_url, meta_dataset_id, meta_access_token";

export type FunnelSiteRow = {
  id: string;
  root_dir: string;
  domain: string;
  ghl_inbound_webhook_url: string | null;
  meta_dataset_id: string | null;
  meta_access_token: string | null;
};

/** Funnel sites linked to one account. Shared by the Funnel tab's page list and credential fields. */
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
