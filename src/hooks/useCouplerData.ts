import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdRow {
  "Account: Account name": string;
  "Campaign: Campaign Id": string;
  "Campaign: Campaign name": string;
  "Clicks: CTR": number;
  "Cost: Amount spend": number;
  "Cost: CPC": number;
  "Cost: CPM": number;
  "Performance: Clicks": number;
  "Performance: Frequency": number;
  "Performance: Impressions": number;
  "Performance: Reach": number;
  "Report: Date": string;
}

async function fetchCouplerData(): Promise<AdRow[]> {
  const { data, error } = await supabase.functions.invoke("coupler-proxy");
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : data.data ?? data.results ?? [];
}

export function useCouplerData() {
  return useQuery({
    queryKey: ["coupler-fb-ads"],
    queryFn: fetchCouplerData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
