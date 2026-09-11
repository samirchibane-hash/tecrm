import { describe, expect, it } from "vitest";
import {
  customerStatus,
  monthlyBuckets,
  mrrSummary,
  periodStart,
  summarize,
  REVENUE_DATA_START,
  type Payment,
  type Subscription,
} from "@/components/revenue/revenueMath";

const pay = (paid_at: string, amount: number, amount_refunded = 0): Payment => ({
  id: `pi_${paid_at}_${amount}`,
  customer_id: "cus_1",
  invoice_id: null,
  description: null,
  amount,
  amount_refunded,
  paid_at,
  disputed: false,
});

const sub = (status: string, mrr_cents: number, collection_paused = false): Subscription => ({
  id: `sub_${status}_${mrr_cents}`,
  customer_id: "cus_1",
  status,
  mrr_cents,
  collection_paused,
});

describe("periodStart", () => {
  const now = new Date(2026, 8, 10); // Sep 10, 2026

  it("never starts before the payment mirror", () => {
    expect(periodStart("all", now)).toEqual(REVENUE_DATA_START);
  });

  it("aligns rolling periods to month starts", () => {
    expect(periodStart("12m", now)).toEqual(new Date(2025, 9, 1));
    expect(periodStart("3m", now)).toEqual(new Date(2026, 6, 1));
    expect(periodStart("ytd", now)).toEqual(new Date(2026, 0, 1));
  });
});

describe("monthlyBuckets", () => {
  const now = new Date(2026, 8, 10);
  const start = new Date(2026, 6, 1);

  it("keeps empty months as a real $0 and marks only the current month partial", () => {
    const buckets = monthlyBuckets([pay("2026-07-15T12:00:00Z", 99700)], start, now);
    expect(buckets.map((b) => b.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(buckets.map((b) => b.net)).toEqual([99700, 0, 0]);
    expect(buckets.map((b) => b.partial)).toEqual([false, false, true]);
  });

  it("nets refunds against the month of the original payment", () => {
    const [jul] = monthlyBuckets([pay("2026-07-15T12:00:00Z", 100000, 25000)], start, now);
    expect(jul).toMatchObject({ gross: 100000, refunded: 25000, net: 75000, payments: 1 });
  });

  it("ignores payments outside the period", () => {
    const buckets = monthlyBuckets([pay("2026-05-15T12:00:00Z", 50000)], start, now);
    expect(buckets.every((b) => b.payments === 0)).toBe(true);
  });
});

describe("summarize", () => {
  it("averages complete months only, so the running month doesn't drag it down", () => {
    const now = new Date(2026, 8, 10);
    const payments = [pay("2026-07-10T12:00:00Z", 100000), pay("2026-08-10T12:00:00Z", 50000), pay("2026-09-02T12:00:00Z", 1000)];
    const s = summarize(monthlyBuckets(payments, new Date(2026, 6, 1), now), payments);
    expect(s.net).toBe(151000);
    expect(s.completeMonths).toBe(2);
    expect(s.avgMonthly).toBe(75000);
  });

  it("has no average when no month is complete yet", () => {
    const now = new Date(2026, 8, 10);
    const s = summarize(monthlyBuckets([], new Date(2026, 8, 1), now), []);
    expect(s.avgMonthly).toBeNull();
  });
});

describe("mrrSummary", () => {
  it("counts only subscriptions that are actually collecting", () => {
    const m = mrrSummary([
      sub("active", 99700),
      sub("past_due", 29700),
      sub("active", 150000, true), // paused collection
      sub("trialing", 9700),
      sub("canceled", 50000),
    ]);
    expect(m.mrr).toBe(129400);
    expect(m.collecting).toBe(2);
    expect(m.pastDue).toBe(1);
    expect(m.paused).toBe(1);
    expect(m.pausedMrr).toBe(150000);
    expect(m.trialing).toBe(1);
  });
});

describe("customerStatus", () => {
  it("surfaces past due over active, and paused over trial", () => {
    expect(customerStatus([sub("active", 1), sub("past_due", 1)])).toBe("past_due");
    expect(customerStatus([sub("active", 1, true), sub("trialing", 1)])).toBe("paused");
    expect(customerStatus([sub("canceled", 1)])).toBe("ended");
    expect(customerStatus([])).toBe("ended");
  });
});
