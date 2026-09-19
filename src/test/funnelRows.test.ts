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
import type { SplitTestRecord, VariantBookingRecord, VariantDayRecord } from "@/components/funnels/useFunnelsData";
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

const arm = (variant: string, views: number, optIns: number): SplitArm => ({
  variant,
  headline: null,
  weight: 50,
  views,
  optIns,
  crmLeads: null,
  cvr: views > 0 ? optIns / views : null,
  interval: null,
  booked: null,
  bookedRate: null,
  status: "needs_traffic",
  pValue: null,
});

function board(opts: {
  links: FunnelPageCopy[];
  portfolio?: PortfolioAccount[];
  versions?: FunnelPageVersion[];
  tests?: SplitTestRecord[];
  variantDays?: VariantDayRecord[];
  variantBookings?: VariantBookingRecord[];
  unattributedLeads?: number;
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
    variantBookings: opts.variantBookings ?? [],
    unattributedLeads: opts.unattributedLeads ?? 0,
    hidden: opts.hidden ?? [],
  });
}

/** An attributed lead: GHL saw both lp_page (→ url) and lp_variant. */
const attributed = (url: string, variant: string, leads: number, booked = 0): VariantBookingRecord =>
  ({ url, variant, day: "2026-09-18", leads, booked });

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
    // Meta counted 22 leads on these ads. None carry an lp_page/lp_variant, so
    // the board claims no measurement at all rather than reporting the pixel.
    expect(b.rows[0].verifiedLeads).toBeNull();
    expect(b.leads).toBe(0);
  });

  it("counts only leads carrying an lp_page and lp_variant", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1", "Soft water")],
      portfolio: [account("a1", "Kinetico", [adTo("dear", "https://k.co/lp-1", 900, 20, 450)])],
      variantBookings: [attributed("https://k.co/lp-1", "a", 2), attributed("https://k.co/lp-1", "b", 1)],
    });
    // Meta claimed 20; three leads were proved to come from this page.
    expect(b.rows[0].verifiedLeads).toBe(3);
    expect(b.leads).toBe(3);
    expect(b.cvr).toBeCloseTo(3 / 450);
  });

  it("reads a client with no attribution as not tracked, never as zero", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1"), link("Kinetico", "https://k.co/lp-2", "LP 2")],
      portfolio: [account("a1", "Kinetico", [
        adTo("one", "https://k.co/lp-1", 500, 5, 250),
        adTo("two", "https://k.co/lp-2", 500, 5, 250),
      ])],
      unattributedLeads: 9,
    });
    expect(b.rows.every((r) => r.verifiedLeads === null)).toBe(true);
    expect(b.rows.every((r) => r.verifiedCvr === null)).toBe(true);
    // The leads exist; they just belong to no page. Reported, never counted.
    expect(b.unattributedLeads).toBe(9);
    expect(b.leads).toBe(0);
  });

  it("keeps a real zero once the client is sending attribution", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1"), link("Kinetico", "https://k.co/lp-2", "LP 2")],
      portfolio: [account("a1", "Kinetico", [
        adTo("one", "https://k.co/lp-1", 500, 5, 250),
        adTo("two", "https://k.co/lp-2", 500, 5, 250),
      ])],
      variantBookings: [attributed("https://k.co/lp-1", "a", 4)],
    });
    const [one, two] = b.rows;
    expect(one.verifiedLeads).toBe(4);
    // Same client, attribution proven to work, no lead on this page: a real 0.
    expect(two.verifiedLeads).toBe(0);
    expect(two.verifiedCvr).toBe(0);
  });

  it("rates attributed leads only against the views of measured pages", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1"), link("Other", "https://o.co/lp-1", "LP 1")],
      portfolio: [
        account("a1", "Kinetico", [adTo("one", "https://k.co/lp-1", 500, 5, 100)]),
        account("a2", "Other", [adTo("two", "https://o.co/lp-1", 500, 5, 900)]),
      ],
      variantBookings: [attributed("https://k.co/lp-1", "a", 10)],
    });
    // Only Kinetico is measured. Dividing by all 1,000 views would report 1%.
    expect(b.cvr).toBeCloseTo(10 / 100);
    expect(b.measuredLpv).toBe(100);
  });

  it("reports no lead count at all for a page with no ad traffic", () => {
    const b = board({ links: [link("Kinetico", "https://k.co/lp-1", "LP 1")] });
    expect(b.rows[0].verifiedLeads).toBeNull();
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
    expect(arms.find((a) => a.variant === "b")!.optIns).toBe(30);
  });
});

describe("booked appointments per arm", () => {
  const tests: SplitTestRecord[] = [
    { id: "t1", url: "https://k.co/lp-1", name: null, status: "running", weights: { a: 50, b: 50 }, started_at: "2026-09-15T00:00:00Z", stopped_at: null, winner_variant: null },
  ];
  const links = [link("Kinetico", "https://k.co/lp-1", "LP 1")];

  it("reports an arm with no GHL attribution as unknown, not zero", () => {
    const b = board({ links, tests });
    // A zero here would read as "this arm books nobody", which is a different
    // claim from "we never learned which arm these leads came from".
    expect(b.rows[0].runningTest!.arms.every((a) => a.booked === null)).toBe(true);
  });

  it("keeps a real zero distinct from missing attribution", () => {
    const variantBookings: VariantBookingRecord[] = [
      { url: "https://k.co/lp-1", variant: "a", day: "2026-09-16", leads: 8, booked: 0 },
    ];
    const b = board({ links, tests, variantBookings });
    const arms = b.rows[0].runningTest!.arms;
    expect(arms.find((a) => a.variant === "a")!.booked).toBe(0);
    expect(arms.find((a) => a.variant === "a")!.bookedRate).toBe(0);
    expect(arms.find((a) => a.variant === "b")!.booked).toBeNull();
  });

  it("sums bookings per arm and rates them against GHL's own leads", () => {
    const variantBookings: VariantBookingRecord[] = [
      { url: "https://k.co/lp-1", variant: "a", day: "2026-09-16", leads: 6, booked: 3 },
      { url: "https://k.co/lp-1", variant: "a", day: "2026-09-17", leads: 4, booked: 1 },
      { url: "https://k.co/lp-1", variant: "b", day: "2026-09-16", leads: 5, booked: 4 },
    ];
    const b = board({ links, tests, variantBookings });
    const arms = b.rows[0].runningTest!.arms;
    expect(arms.find((a) => a.variant === "a")!.booked).toBe(4);
    expect(arms.find((a) => a.variant === "a")!.bookedRate).toBeCloseTo(0.4);
    expect(arms.find((a) => a.variant === "b")!.bookedRate).toBeCloseTo(0.8);
  });

  it("keeps the page's opt-ins and the CRM's leads apart on the same arm", () => {
    // The real case: meridian-1 arm B recorded two opt-ins on the page, but one
    // reached GoHighLevel with lp_variant and no lp_page, so only one can be
    // counted against this page. Reporting "2 leads" beside the card's "1 lead"
    // was the bug — the arm now carries both numbers under different names.
    const b = board({
      links,
      tests,
      variantDays: [
        { url: "https://k.co/lp-1", variant: "b", day: "2026-09-18", views: 11, leads: 1 },
        { url: "https://k.co/lp-1", variant: "b", day: "2026-09-19", views: 8, leads: 1 },
      ],
      variantBookings: [attributed("https://k.co/lp-1", "b", 1, 1)],
    });
    const armB = b.rows[0].runningTest!.arms.find((a) => a.variant === "b")!;
    expect(armB.views).toBe(19);
    expect(armB.optIns).toBe(2);
    expect(armB.crmLeads).toBe(1);
    expect(armB.booked).toBe(1);
    // The rate stays on the page's own numbers: views and opt-ins share a beacon.
    expect(armB.cvr).toBeCloseTo(2 / 19);
    // Booked is rated against the CRM's own leads, never against opt-ins.
    expect(armB.bookedRate).toBe(1);
  });

  it("ignores bookings from outside the test's window", () => {
    const variantBookings: VariantBookingRecord[] = [
      { url: "https://k.co/lp-1", variant: "a", day: "2026-09-14", leads: 99, booked: 99 },
      { url: "https://k.co/lp-1", variant: "a", day: "2026-09-16", leads: 2, booked: 1 },
    ];
    const b = board({ links, tests, variantBookings });
    expect(b.rows[0].runningTest!.arms.find((a) => a.variant === "a")!.booked).toBe(1);
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
