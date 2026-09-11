import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "@/integrations/supabase/SupabaseContext";

// Shape returned by the meta-creative-performance edge function.
export interface CreativeResult {
  type: string;          // Meta action type, e.g. offsite_conversion.fb_pixel_lead
  label: string;         // "Website leads"
  count: number;
  costPer: number | null; // null when there were no results, never $0
  source: "meta" | "actions"; // "actions" = Meta left Results empty (instant forms)
}

export interface LiveAd {
  id: string;
  name: string;
  createdTime: string;
  campaign: string | null;
  adset: string | null;
  optimizationGoal: string | null;
  format: "video" | "image";
  thumbnailUrl: string | null;
  adsManagerUrl: string;
  delivered: boolean;
  spend: number;
  impressions: number;
  linkCtr: number | null;
  result: CreativeResult | null;
}

export interface CreativePerformance {
  adAccount: { id: string; name: string; currency: string } | null;
  period: { since: string; until: string } | null;
  accountSpend: number | null;
  ads: LiveAd[];
  fetchedAt: string;
}

export type CreativePeriod = "last_7d" | "last_30d" | "this_month" | "last_month" | "maximum";

// Meta's own presets, so the numbers line up with the same range in Ads Manager.
export const CREATIVE_PERIODS: { value: CreativePeriod; label: string }[] = [
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "maximum", label: "Lifetime" },
];

export class CreativePerformanceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export function useCreativePerformance(accountId: string, period: CreativePeriod) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ["meta-creative-performance", accountId, period],
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    retry: (count, error) => !(error instanceof CreativePerformanceError && error.code === "META_NO_ACCESS") && count < 2,
    queryFn: async (): Promise<CreativePerformance> => {
      const { data, error } = await supabase.functions.invoke("meta-creative-performance", {
        body: { accountId, preset: period },
      });
      if (error) {
        // Non-2xx: the function's JSON { error, code } is stashed in `context`.
        let message = error.message;
        let code = "ERROR";
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (body?.error) message = body.error as string;
          if (body?.code) code = body.code as string;
        } catch { /* body wasn't JSON */ }
        throw new CreativePerformanceError(message, code);
      }
      return data as CreativePerformance;
    },
  });
}
