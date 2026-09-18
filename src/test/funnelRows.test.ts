import { describe, expect, it } from "vitest";
import {
  MIN_ARM_VIEWS,
  buildFunnelsBoard,
  isEntryPage,
  scoreArms,
  type SplitArm,
} from "@/components/funnels/funnelRows";
import { analyzePortfolioFunnel, type FunnelPageCopy, type FunnelPageVersion } from "@/components/funnel/portfolioFunnel";
import type { PortfolioAccount } from "@/components/creative-performance/useCreativePerformance";
import type { SplitTestRecord, VariantDayRecord } from "@/components/funnels/useFunnelsData";
import { makeAd } from "./fixtures";

const link = (account: string, url: string, label: string, headline: string | null = null): FunnelPageCopy => ({
  account_name: account,
  url,
  label,
  page_title: null,
  page_headline: headline,
  page_subhead: null,
  page_cta: null,
  copy_synced_at: "2026-09-17T00:00:00Z",
});

const adTo = (id: string, url: string, spend: number, leads: number, lpv: number) =>
  makeAd({ id, spend, webLeads: leads, landingPageViews: lpv, linkClicks: lpv + 10, copy: { destinationUrls: [url] } });

const account = (id: string, name: string, ads: ReturnType<typeof adTo>[]): PortfolioAccount => ({
  accountId: id,
  accountName: name,
  ads,
  error: null,
});

const arm = (variant: string, views: number, leads: number): SplitArm => ({
  variant,
  headline: null,
  weight: 50,
  views,
  leads,
  cvr: views > 0 ? leads / views : null,
  interval: null,
  status: "needs_traffic",
  pValue: null,
});

function board(opts: {
  links: FunnelPageCopy[];
  portfolio?: PortfolioAccount[];
  versions?: FunnelPageVersion[];
  tests?: SplitTestRecord[];
  variantDays?: VariantDayRecord[];
  hidden?: string[];
}) {
  const portfolio = opts.portfolio ?? [];
  const accounts = [{ id: "a1", account_name: "Kinetico", target_cpl: 50 }];
  const funnel = analyzePortfolioFunnel(portfolio, accounts, opts.links, opts.hidden ?? [], undefined, opts.versions ?? []);
  return buildFunnelsBoard({
    links: opts.links,
    pages: funnel.pages,
    portfolio,
    versions: opts.versions ?? [],
    tests: opts.tests ?? [],
    variantDays: opts.variantDays ?? [],
    hidden: opts.hidden ?? [],
  });
}

describe("entry pages", () => {
  it("keeps landing pages and drops the funnel's own steps", () => {
    expect(isEntryPage("https://k.co/meridian-1")).toBe(true);
    expect(isEntryPage("https://k.co/schedule")).toBe(false);
    expect(isEntryPage("https://k.co/thank-you")).toBe(false);
    expect(isEntryPage("https://k.co/booking")).toBe(false);
  });
});

describe("funnels board", () => {
  it("lists a built page that has never had ad traffic, rather than omitting it", () => {
    const b = board({ links: [link("Kinetico", "https://k.co/lp-1", "LP 1", "Soft water")] });
    expect(b.rows).toHaveLength(1);
    expect(b.rows[0].perf).toBeNull();
    expect(b.idle).toBe(1);
    expect(b.withTraffic).toBe(0);
  });

  it("leaves booking pages out of the list entirely", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1"), link("Kinetico", "https://k.co/schedule", "Schedule")],
    });
    expect(b.rows.map((r) => r.label)).toEqual(["LP 1"]);
  });

  it("joins a page to its performance and the ads feeding it, dearest first", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1", "Soft water")],
      portfolio: [account("a1", "Kinetico", [
        adTo("cheap", "https://k.co/lp-1", 100, 2, 50),
        adTo("dear", "https://k.co/lp-1", 900, 20, 450),
      ])],
    });
    const row = b.rows[0];
    expect(row.perf?.spend).toBe(1000);
    expect(row.ads.map((a) => a.id)).toEqual(["dear", "cheap"]);
    expect(b.withTraffic).toBe(1);
    expect(b.cvr).toBeCloseTo(22 / 500);
  });

  it("hides a client that's hidden from the dashboard", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1"), link("Other", "https://o.co/lp-1", "LP 1")],
      hidden: ["Other"],
    });
    expect(b.rows.map((r) => r.accountName)).toEqual(["Kinetico"]);
    expect(b.clients).toBe(1);
  });

  it("carries the copy history newest first and names the live version", () => {
    const versions: FunnelPageVersion[] = [
      { url: "https://k.co/lp-1", version: 1, variant: "a", page_headline: "Old", valid_from: "2026-08-01T00:00:00Z", valid_to: "2026-09-10T00:00:00Z" },
      { url: "https://k.co/lp-1", version: 2, variant: "a", page_headline: "New", valid_from: "2026-09-10T00:00:00Z", valid_to: null },
    ];
    const b = board({ links: [link("Kinetico", "https://k.co/lp-1", "LP 1", "New")], versions });
    expect(b.rows[0].versions.map((v) => v.version)).toEqual([2, 1]);
    expect(b.rows[0].versions[0].live).toBe(true);
    expect(b.rows[0].liveVersion).toBe(2);
  });

  it("separates a running test from one that already stopped", () => {
    const tests: SplitTestRecord[] = [
      { id: "t1", url: "https://k.co/lp-1", name: "Headline B", status: "running", weights: { a: 50, b: 50 }, started_at: "2026-09-15T00:00:00Z", stopped_at: null, winner_variant: null },
      { id: "t0", url: "https://k.co/lp-1", name: "Old test", status: "stopped", weights: { a: 50, b: 50 }, started_at: "2026-08-01T00:00:00Z", stopped_at: "2026-08-20T00:00:00Z", winner_variant: "a" },
    ];
    const b = board({ links: [link("Kinetico", "https://k.co/lp-1", "LP 1")], tests });
    expect(b.rows[0].runningTest?.id).toBe("t1");
    expect(b.rows[0].pastTests.map((t) => t.id)).toEqual(["t0"]);
    expect(b.runningTests).toBe(1);
  });

  it("counts only the days inside a test's own window", () => {
    const tests: SplitTestRecord[] = [
      { id: "t1", url: "https://k.co/lp-1", name: null, status: "running", weights: { a: 50, b: 50 }, started_at: "2026-09-15T00:00:00Z", stopped_at: null, winner_variant: null },
    ];
    const variantDays: VariantDayRecord[] = [
      { url: "https://k.co/lp-1", variant: "a", day: "2026-09-14", views: 999, leads: 999 }, // before the test
      { url: "https://k.co/lp-1", variant: "a", day: "2026-09-16", views: 200, leads: 10 },
      { url: "https://k.co/lp-1", variant: "b", day: "2026-09-16", views: 200, leads: 30 },
    ];
    const b = board({ links: [link("Kinetico", "https://k.co/lp-1", "LP 1")], tests, variantDays });
    const arms = b.rows[0].runningTest!.arms;
    expect(arms.find((a) => a.variant === "a")!.views).toBe(200);
    expect(arms.find((a) => a.variant === "b")!.leads).toBe(30);
  });
});

describe("split test arms", () => {
  it("calls no leader until two arms clear the view floor", () => {
    const { arms, decided } = scoreArms([arm("a", MIN_ARM_VIEWS - 1, 0), arm("b", MIN_ARM_VIEWS - 1, 20)]);
    expect(arms.every((a) => a.status === "needs_traffic")).toBe(true);
    expect(decided).toBe(false);
  });

  it("names the leader and marks a beaten arm behind at 95%", () => {
    const { arms, decided } = scoreArms([arm("a", 1000, 30), arm("b", 1000, 90)]);
    expect(arms.find((a) => a.variant === "b")!.status).toBe("leader");
    expect(arms.find((a) => a.variant === "a")!.status).toBe("behind");
    expect(decided).toBe(true);
  });

  it("leaves two close arms undecided rather than crowning one", () => {
    const { arms, decided } = scoreArms([arm("a", 500, 50), arm("b", 500, 54)]);
    expect(arms.find((a) => a.variant === "b")!.status).toBe("leader");
    expect(arms.find((a) => a.variant === "a")!.status).toBe("even");
    expect(decided).toBe(false);
  });
});
