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

/**
 * Every client's synced funnel pages at once, for the cross-client Funnel
 * scorecard. Only `funnel_repo` rows: a hand-added link is a link, not a page
 * the sync has read the headline off.
 */
export function useFunnelRepoLinks() {
  return useQuery({
    queryKey: ["funnel-repo-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_links")
        .select("account_name, url, label, page_title, page_headline, page_subhead, page_cta, copy_synced_at")
        .eq("source", "funnel_repo")
        .order("account_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Every copy version each funnel page has shown, so the scorecard can say which
 * version earned a number instead of crediting whatever copy is live today.
 * Joined back to the page's URL, which is how the board keys pages.
 */
export function useFunnelPageVersions() {
  return useQuery({
    queryKey: ["funnel-page-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnel_page_copy_versions")
        .select("version, page_headline, valid_from, valid_to, account_links!inner(url)")
        .order("valid_from", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const link = row.account_links as unknown as { url: string } | { url: string }[];
        return {
          url: Array.isArray(link) ? link[0]?.url ?? "" : link.url,
          version: row.version,
          page_headline: row.page_headline,
          valid_from: row.valid_from,
          valid_to: row.valid_to,
        };
      });
    },
  });
}
