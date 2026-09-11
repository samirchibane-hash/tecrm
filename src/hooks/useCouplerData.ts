import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { useSupabase, useSupabaseScope } from "@/integrations/supabase/SupabaseContext";

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
  "Report: End date": string;
  "Conversions: Website Appointments Scheduled - Total": number | null;
  "Conversions: Website Appointments Scheduled - Unique": number | null;
  "Conversions: Website Appointments Scheduled - Value": number | null;
  "Conversions: Website Appointments Scheduled - Cost": number | null;
  "Conversions: Website Appointments Scheduled - Unique Cost": number | null;
  "Conversions: Appointments Scheduled - Total": number | null;
  "Conversions: Appointments Scheduled - Unique": number | null;
  "Conversions: Appointments Scheduled - Value": number | null;
  "Conversions: Appointments Scheduled - Cost": number | null;
  "Conversions: Appointments Scheduled - Unique Cost": number | null;
  "Conversions: Leads - Total": number | null;
  "Conversions: Leads - Unique": number | null;
  "Conversions: Leads - Value": number | null;
  "Conversions: Leads - Cost": number | null;
  "Conversions: Leads - Unique Cost": number | null;
  "Conversions: All On-Facebook Leads - Total": number | null;
  "Conversions: All On-Facebook Leads - Unique": number | null;
  "Conversions: All On-Facebook Leads - Value": number | null;
  "Conversions: All On-Facebook Leads - Cost": number | null;
  "Conversions: All On-Facebook Leads - Unique Cost": number | null;
}

// Signed in, the proxy returns every account; on a report page the scoped
// client's x-report-token limits it to that one account.
async function fetchCouplerData(supabase: SupabaseClient<Database>): Promise<AdRow[]> {
  const { data, error } = await supabase.functions.invoke("coupler-proxy");
  if (error) {
    // On a non-2xx, supabase-js gives a generic message and stashes the real
    // Response in `context`. Pull the function's JSON error so the dashboard
    // can show something actionable (e.g. "Meta token expired…").
    let message = error.message;
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error as string;
    } catch { /* body wasn't JSON */ }
    throw new Error(message);
  }
  return Array.isArray(data) ? data : data.data ?? data.results ?? [];
}

export function useCouplerData() {
  const supabase = useSupabase();
  const scope = useSupabaseScope();
  return useQuery({
    queryKey: ["coupler-fb-ads", scope],
    queryFn: () => fetchCouplerData(supabase),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
