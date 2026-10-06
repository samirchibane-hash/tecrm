import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AccountSummary {
  id: string;
  account_name: string;
  target_cpl: number | null;
  target_cpa: number | null;
}

/**
 * Every CRM account with its cost targets.
 *
 * One definition because the cache key is shared: when screens each selected
 * their own columns under `["all-accounts"]`, whichever loaded first decided
 * what the others got, and a screen that needed targets could silently receive
 * rows without them (verdicts then fell back to account averages).
 */
export function useAllAccounts() {
  return useQuery({
    queryKey: ["all-accounts"],
    queryFn: async (): Promise<AccountSummary[]> => {
      const { data, error } = await supabase.from("accounts").select("id, account_name, target_cpl, target_cpa");
      if (error) throw error;
      return data ?? [];
    },
  });
}
