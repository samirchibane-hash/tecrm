import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** The two kinds of free-text option lists stored in `creative_options`. */
export type OptionType = "ad_angle" | "offer_type";

/** Insert a new value into a `creative_options` list and refresh its query. */
export function useAddCreativeOption() {
  const queryClient = useQueryClient();
  return async (type: OptionType, value: string) => {
    const { error } = await supabase.from("creative_options").insert({ type, value });
    if (!error) queryClient.invalidateQueries({ queryKey: ["creative-options", type] });
  };
}
