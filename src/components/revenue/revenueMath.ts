import { addMonths, format, isBefore, startOfMonth, startOfYear, subMonths } from "date-fns";

// Pure revenue math, kept out of the components so it can be tested directly.
// All amounts are Stripe cents.

/** The Stripe payment mirror starts here; nothing earlier is reportable. */
export const REVENUE_DATA_START = new Date(2024, 6, 1); // Jul 1, 2024

export type Payment = {
  id: string;
  customer_id: string | null;
  invoice_id: string | null;
  description: string | null;
  amount: number;
  amount_refunded: number;
  paid_at: string;
  disputed: boolean;
};

export type Subscription = {
  id: string;
  customer_id: string;
  status: string;
  mrr_cents: number;
  collection_paused: boolean;
};

export type PeriodKey = "all" | "ytd" | "12m" | "3m";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "Since Jul 2024" },
  { key: "12m", label: "Last 12 months" },
  { key: "ytd", label: "Year to date" },
  { key: "3m", label: "Last 3 months" },
];

/** Month-aligned period start, never earlier than the data itself. */
export function periodStart(key: PeriodKey, now = new Date()): Date {
  const start =
    key === "ytd" ? startOfYear(now)
    : key === "12m" ? startOfMonth(subMonths(now, 11))
    : key === "3m" ? startOfMonth(subMonths(now, 2))
    : REVENUE_DATA_START;
  return isBefore(start, REVENUE_DATA_START) ? REVENUE_DATA_START : start;
}

export const net = (p: Payment) => p.amount - p.amount_refunded;

export type MonthBucket = {
  key: string; // yyyy-MM
  label: string; // "Jul ’24"
  net: number;
  gross: number;
  refunded: number;
  payments: number;
  partial: boolean; // the current, still-running month
};

/**
 * One bucket per calendar month from `start` through the current month.
 * Months with no payments are a real $0 here — the mirror is complete from
 * REVENUE_DATA_START — so they're kept rather than skipped.
 */
export function monthlyBuckets(payments: Payment[], start: Date, now = new Date()): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>();
  const current = format(now, "yyyy-MM");
  for (let m = startOfMonth(start); !isBefore(now, m); m = addMonths(m, 1)) {
    const key = format(m, "yyyy-MM");
    buckets.set(key, { key, label: format(m, "MMM ’yy"), net: 0, gross: 0, refunded: 0, payments: 0, partial: key === current });
  }
  for (const p of payments) {
    const b = buckets.get(format(new Date(p.paid_at), "yyyy-MM"));
    if (!b) continue;
    b.gross += p.amount;
    b.refunded += p.amount_refunded;
    b.net += net(p);
    b.payments += 1;
  }
  return [...buckets.values()];
}

export type RevenueSummary = {
  net: number;
  gross: number;
  refunded: number;
  refundedCount: number;
  payments: number;
  /** Average net per complete month; null when the period has none yet. */
  avgMonthly: number | null;
  completeMonths: number;
};

export function summarize(buckets: MonthBucket[], payments: Payment[]): RevenueSummary {
  const complete = buckets.filter((b) => !b.partial);
  const sum = (xs: MonthBucket[], f: (b: MonthBucket) => number) => xs.reduce((s, b) => s + f(b), 0);
  const keys = new Set(buckets.map((b) => b.key));
  const inPeriod = payments.filter((p) => keys.has(format(new Date(p.paid_at), "yyyy-MM")));
  return {
    net: sum(buckets, (b) => b.net),
    gross: sum(buckets, (b) => b.gross),
    refunded: sum(buckets, (b) => b.refunded),
    refundedCount: inPeriod.filter((p) => p.amount_refunded > 0).length,
    payments: sum(buckets, (b) => b.payments),
    avgMonthly: complete.length ? Math.round(sum(complete, (b) => b.net) / complete.length) : null,
    completeMonths: complete.length,
  };
}

/** MRR counts only subscriptions actually collecting: active or past due, not paused. */
export function mrrSummary(subs: Subscription[]) {
  const collecting = subs.filter((s) => (s.status === "active" || s.status === "past_due") && !s.collection_paused);
  const paused = subs.filter((s) => (s.status === "active" || s.status === "past_due") && s.collection_paused);
  return {
    mrr: collecting.reduce((s, x) => s + x.mrr_cents, 0),
    collecting: collecting.length,
    pastDue: collecting.filter((s) => s.status === "past_due").length,
    paused: paused.length,
    pausedMrr: paused.reduce((s, x) => s + x.mrr_cents, 0),
    trialing: subs.filter((s) => s.status === "trialing").length,
  };
}

export type CustomerStatus = "active" | "past_due" | "paused" | "trialing" | "ended";

/** One label per customer, from the most operationally urgent of their subscriptions. */
export function customerStatus(subs: Subscription[]): CustomerStatus {
  const live = (s: Subscription) => s.status === "active" || s.status === "past_due";
  if (subs.some((s) => s.status === "past_due" && !s.collection_paused)) return "past_due";
  if (subs.some((s) => live(s) && !s.collection_paused)) return "active";
  if (subs.some((s) => live(s) && s.collection_paused)) return "paused";
  if (subs.some((s) => s.status === "trialing")) return "trialing";
  return "ended";
}
