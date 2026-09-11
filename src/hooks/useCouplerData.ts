import { useMemo } from "react";
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

/** An ad account the proxy couldn't read, so its Meta metrics are unknown, not zero. */
export interface MetaUnavailableAccount {
  id: string; // act_…
  code: "META_NO_ACCESS" | "META_AUTH" | "META_ERROR";
}

interface CouplerResult {
  rows: AdRow[];
  unavailable: MetaUnavailableAccount[];
}

export function parseMetaUnavailable(header: string | null | undefined): MetaUnavailableAccount[] {
  if (!header) return [];
  try {
    const parsed = JSON.parse(header);
    return Array.isArray(parsed) ? parsed.filter((a) => typeof a?.id === "string") : [];
  } catch {
    return [];
  }
}

// Signed in, the proxy returns every account; on a report page the scoped
// client's x-report-token limits it to that one account.
async function fetchCouplerData(supabase: SupabaseClient<Database>): Promise<CouplerResult> {
  const { data, error, response } = await supabase.functions.invoke("coupler-proxy");
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
  return {
    rows: Array.isArray(data) ? data : data.data ?? data.results ?? [],
    // Accounts that failed while others succeeded; they'd otherwise read as $0.
    unavailable: parseMetaUnavailable(response?.headers.get("x-meta-unavailable")),
  };
}

const selectRows = (r: CouplerResult) => r.rows;
const selectUnavailable = (r: CouplerResult) => r.unavailable;

function useCouplerQuery<T>(select: (r: CouplerResult) => T) {
  const supabase = useSupabase();
  const scope = useSupabaseScope();
  return useQuery({
    queryKey: ["coupler-fb-ads", scope],
    queryFn: () => fetchCouplerData(supabase),
    select,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useCouplerData() {
  return useCouplerQuery(selectRows);
}

/** Ad accounts Meta refused in the last fetch (shares useCouplerData's request). */
export function useMetaUnavailable(): MetaUnavailableAccount[] {
  return useCouplerQuery(selectUnavailable).data ?? [];
}

/** CRM account names whose ad account Meta refused, keyed to why. Empty when all loaded. */
export function useMetaGapAccounts(): Map<string, MetaUnavailableAccount> {
  const supabase = useSupabase();
  const unavailable = useMetaUnavailable();
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-fb-ad-ids"],
    enabled: unavailable.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("account_name, fb_ad_account_id")
        .not("fb_ad_account_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });
  return useMemo(() => {
    const byId = new Map(unavailable.map((u) => [u.id, u]));
    return new Map(accounts.flatMap((a) => {
      const gap = a.fb_ad_account_id ? byId.get(a.fb_ad_account_id) : undefined;
      return gap ? [[a.account_name, gap] as const] : [];
    }));
  }, [accounts, unavailable]);
}

export function metaUnavailableReason(code: MetaUnavailableAccount["code"]): string {
  if (code === "META_NO_ACCESS") return "Meta token can't read this ad account. Assign it to the system user in Meta Business Settings.";
  if (code === "META_AUTH") return "Meta access token is invalid or expired.";
  return "Meta returned an error for this ad account.";
}
