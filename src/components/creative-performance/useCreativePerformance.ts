import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "@/integrations/supabase/SupabaseContext";
import type { MetaPreset } from "@/lib/periods";

// Shapes returned by the meta-creative-performance edge function.

export interface CreativeResult {
  type: string;          // Meta action type, e.g. offsite_conversion.fb_pixel_lead
  label: string;         // "Website leads"
  count: number;
  costPer: number | null; // null when there were no results, never $0
  source: "meta" | "actions"; // "actions" = Meta left Results empty (instant forms)
}

/** What the ad says and where it sends people. */
export interface AdCopy {
  headlines: string[];
  bodies: string[];       // primary texts
  descriptions: string[];
  destinationUrls: string[]; // real pages only; instant-form placeholders are dropped
  cta: string | null;
  leadForm: boolean;
}

/** Website leads come from the pixel's Lead event, form leads from instant forms. Never compared directly. */
export type LeadChannel = "website" | "form";

export interface CreativeAd {
  id: string;
  name: string;
  status: string;         // Meta effective_status: ACTIVE, PAUSED, ADSET_PAUSED, …
  live: boolean;
  createdTime: string | null;
  campaign: string | null;
  adset: string | null;
  adsetId: string | null;
  optimizationGoal: string | null;
  format: "video" | "image";
  thumbnailUrl: string | null;
  adsManagerUrl: string;
  delivered: boolean;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number | null;
  linkClicks: number;
  linkCtr: number | null;
  cpm: number | null;
  landingPageViews: number;
  webLeads: number;
  formLeads: number;
  leadChannel: LeadChannel;
  /** 3-second video plays; null for images. */
  videoPlays: number | null;
  /** ThruPlays (15s or complete); null for images. */
  thruplays: number | null;
  result: CreativeResult | null;
  /** Meta Schedule conversions; null when the account doesn't track them. */
  appointments: number | null;
  costPerAppointment: number | null; // null when there were none, never $0
  copy: AdCopy;
}

/** One text of an ad that rotates several (Meta's title_asset / body_asset breakdown). */
export interface AssetRow {
  adId: string;
  text: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  webLeads: number;
  formLeads: number;
  appointments: number | null;
}

/**
 * One ad's numbers for one day. Requested only when a caller needs to attribute
 * performance to a window narrower than the reporting period — splitting a
 * landing page's figures at a copy change is the reason this exists.
 */
export interface DailyAdRow {
  adId: string;
  date: string; // YYYY-MM-DD, in the ad account's timezone
  spend: number;
  linkClicks: number;
  landingPageViews: number;
  webLeads: number;
}

export interface AccountCreatives {
  adAccount: { id: string; name: string; currency: string } | null;
  period: { since: string; until: string } | null;
  accountSpend: number | null;
  /** Meta saw a Schedule event in the last 90 days; otherwise appointments aren't reported. */
  appointmentsTracked: boolean;
  ads: CreativeAd[];
  /** Null when not requested; each list is null when Meta refused that breakdown. */
  assets: { headlines: AssetRow[] | null; bodies: AssetRow[] | null } | null;
  /** Per-ad, per-day rows. Null unless the caller asked for them. */
  daily: DailyAdRow[] | null;
}

export interface CreativePerformance extends AccountCreatives {
  fetchedAt: string;
}

export interface PortfolioAccount extends Partial<AccountCreatives> {
  accountId: string;
  accountName: string;
  /** Meta couldn't read this one account; its creatives are unknown, not absent. */
  error: { code: string; message: string } | null;
}

export interface PortfolioPerformance {
  accounts: PortfolioAccount[];
  fetchedAt: string;
}

export type CreativePreset = MetaPreset;
export type CreativeRange = { preset: CreativePreset } | { since: string; until: string };

export class CreativePerformanceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

async function invoke<T>(supabase: ReturnType<typeof useSupabase>, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("meta-creative-performance", { body });
  if (error) {
    // Non-2xx: the function's JSON { error, code } is stashed in `context`.
    let message = error.message;
    let code = "ERROR";
    try {
      const res = await (error as { context?: Response }).context?.json();
      if (res?.error) message = res.error as string;
      if (res?.code) code = res.code as string;
    } catch { /* body wasn't JSON */ }
    throw new CreativePerformanceError(message, code);
  }
  return data as T;
}

const noRetryOnAccess = (count: number, error: unknown) =>
  !(error instanceof CreativePerformanceError && (error.code === "META_NO_ACCESS" || error.code === "BAD_REQUEST")) && count < 2;

/** One account's ads, with asset breakdowns. Shared by the Performance and Funnel tabs (same cache). */
export function useCreativePerformance(accountId: string, range: CreativeRange) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ["meta-creative-performance", accountId, range],
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnAccess,
    // v: 2 = every ad that delivered in the period, not just live ones.
    queryFn: () => invoke<CreativePerformance>(supabase, { accountId, ...range, v: 2 }),
  });
}

/** Every Meta-linked account at once, for the cross-client board. */
export function usePortfolioCreatives(range: CreativeRange, enabled = true) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ["meta-creative-performance", "all", range],
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnAccess,
    // daily: the funnel board splits each page's figures at its copy changes,
    // which needs day-level rows — the period total can't be cut at a boundary.
    queryFn: () => invoke<PortfolioPerformance>(supabase, { scope: "all", ...range, daily: true }),
  });
}
