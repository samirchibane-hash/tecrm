import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** A split test as stored, with the page it runs on. */
export interface SplitTestRecord {
  id: string;
  url: string;
  name: string | null;
  status: string;
  weights: Record<string, number>;
  started_at: string;
  stopped_at: string | null;
  winner_variant: string | null;
}

/** One arm's views and leads for one day, as the page reported them. */
export interface VariantDayRecord {
  url: string;
  variant: string;
  day: string;
  views: number;
  leads: number;
}

const urlOf = (link: unknown): string => {
  const l = link as { url: string } | { url: string }[] | null;
  if (!l) return "";
  return Array.isArray(l) ? l[0]?.url ?? "" : l.url;
};

/** Every split test ever run, newest first. */
export function useFunnelSplitTests() {
  return useQuery({
    queryKey: ["funnel-split-tests"],
    queryFn: async (): Promise<SplitTestRecord[]> => {
      const { data, error } = await supabase
        .from("funnel_split_tests")
        .select("id, name, status, weights, started_at, stopped_at, winner_variant, account_links!inner(url)")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        url: urlOf(r.account_links),
        name: r.name,
        status: r.status,
        weights: (r.weights ?? {}) as Record<string, number>,
        started_at: r.started_at,
        stopped_at: r.stopped_at,
        winner_variant: r.winner_variant,
      }));
    },
  });
}

/**
 * Per-arm views and leads by day, from our own page events.
 *
 * These are deliberately not Meta's numbers: Meta attributes a view to the ad,
 * not to the arm the visitor actually saw, so it cannot split a test. The two
 * sources will never agree exactly and are never added together.
 */
export function useVariantDaily(since: string | undefined, until?: string) {
  return useQuery({
    queryKey: ["funnel-variant-daily", since ?? "all", until ?? "now"],
    queryFn: async (): Promise<VariantDayRecord[]> => {
      let q = supabase
        .from("funnel_variant_daily")
        .select("variant, day, views, leads, account_links!inner(url)");
      if (since) q = q.gte("day", since);
      if (until) q = q.lte("day", until);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        url: urlOf(r.account_links),
        variant: r.variant as string,
        day: r.day as string,
        views: Number(r.views ?? 0),
        leads: Number(r.leads ?? 0),
      }));
    },
  });
}

/** One arm's booked appointments for one day, as GoHighLevel recorded them. */
export interface VariantBookingRecord {
  url: string;
  variant: string;
  day: string;
  leads: number;
  booked: number;
}

/**
 * Per-arm attributed leads and booked appointments by day, from GHL conversions.
 *
 * The page can report a view and an opt-in because both happen on the page.
 * The booking does not — it happens on the GHL calendar, minutes or days later
 * — so an arm's booked count can only come from GHL, which learns the arm from
 * the contact's lp_variant field. Views and leads still come from
 * `useVariantDaily`; these two sources measure different steps and are never
 * added together.
 */
export function useVariantBookings(since: string | undefined, until?: string) {
  return useQuery({
    queryKey: ["ghl-variant-bookings", since ?? "all", until ?? "now"],
    queryFn: async (): Promise<VariantBookingRecord[]> => {
      let q = supabase
        .from("ghl_conversion_variant_daily")
        .select("url, variant, day, leads, booked");
      if (since) q = q.gte("day", since);
      if (until) q = q.lte("day", until);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        url: (r.url as string) ?? "",
        variant: r.variant as string,
        day: r.day as string,
        leads: Number(r.leads ?? 0),
        booked: Number(r.booked ?? 0),
      }));
    },
  });
}
