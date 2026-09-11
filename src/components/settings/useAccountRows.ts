import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Every CRM account with its id, alphabetical — for settings pickers and flag upserts. */
export function useAccountRows() {
  return useQuery({
    queryKey: ["accounts-list-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, account_name").order("account_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
