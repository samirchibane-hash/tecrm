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

const arm = (variant: string, views: number, leads: number): SplitArm => ({
  variant,
  headline: null,
  weight: 50,
  views,
  leads,
  cvr: views > 0 ? leads / views : null,
  interval: null,
  booked: null,
  bookedRate: null,
  status: "needs_traffic",
  chanceBest: null,
  apptChanceBest: null,
  lift: null,
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
    expect(arms.find((a) => a.variant === "b")!.views).toBe(200);
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

  it("counts an arm's leads the way the card does, not the way the page does", () => {
    // The real case: meridian-1 arm B recorded two opt-ins on the page, but only
    // one reached GoHighLevel carrying both lp_page and lp_variant. The arm
    // reports that one, so it agrees with the card above it.
    const b = board({
      links,
      tests,
      portfolio: [account("a1", "Kinetico", [adTo("one", "https://k.co/lp-1", 500, 5, 250)])],
      variantDays: [
        { url: "https://k.co/lp-1", variant: "b", day: "2026-09-18", views: 11, leads: 1 },
        { url: "https://k.co/lp-1", variant: "b", day: "2026-09-19", views: 8, leads: 1 },
      ],
      variantBookings: [attributed("https://k.co/lp-1", "b", 1, 1)],
    });
    const armB = b.rows[0].runningTest!.arms.find((a) => a.variant === "b")!;
    expect(armB.views).toBe(19);
    expect(armB.leads).toBe(1);
    expect(armB.booked).toBe(1);
    expect(armB.cvr).toBeCloseTo(1 / 19);
    expect(armB.bookedRate).toBe(1);
    // And the card's own figure is the same number.
    expect(b.rows[0].verifiedLeads).toBe(1);
  });

  it("leaves an arm with no attributed lead unrated rather than at zero", () => {
    const b = board({
      links,
      tests,
      variantDays: [{ url: "https://k.co/lp-1", variant: "a", day: "2026-09-16", views: 300, leads: 9 }],
    });
    const armA = b.rows[0].runningTest!.arms.find((a) => a.variant === "a")!;
    // The page saw nine opt-ins; none carried a page and variant.
    expect(armA.views).toBe(300);
    expect(armA.leads).toBeNull();
    expect(armA.cvr).toBeNull();
    expect(armA.status).toBe("not_tracked");
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
  it("Meridian 1: D 4 leads vs C 2 on ~80 views each is a lean, not a winner, and C is not a loser", () => {
    const { arms, decided, leader } = scoreArms([arm("c", 79, 2), arm("d", 80, 4)]);
    expect(leader!.variant).toBe("d");
    expect(decided).toBe(false);
    const d = arms.find((a) => a.variant === "d")!;
    const c = arms.find((a) => a.variant === "c")!;
    expect(d.chanceBest!).toBeGreaterThan(0.7);
    expect(d.chanceBest!).toBeLessThan(0.9);
    expect(d.status).not.toBe("winner");
    expect(c.status).not.toBe("losing");
    expect(d.lift).toBeCloseTo(4 / 80 / (2 / 79) - 1);
  });

  it("calls a winner and a loser once the gap is sure and both arms clear the floor", () => {
    const { arms, decided } = scoreArms([arm("a", 1000, 30), arm("b", 1000, 90)]);
    expect(arms.find((a) => a.variant === "b")!.status).toBe("winner");
    expect(arms.find((a) => a.variant === "a")!.status).toBe("losing");
    expect(decided).toBe(true);
  });

  it("never crowns an arm under the view floor, however lopsided", () => {
    const { arms, decided } = scoreArms([arm("a", MIN_ARM_VIEWS - 1, 0), arm("b", MIN_ARM_VIEWS - 1, 20)]);
    expect(arms.find((a) => a.variant === "b")!.status).toBe("leading");
    expect(decided).toBe(false);
  });

  it("Tarheel: D with 4 leads / 3 appts vs C's 2 / 1 is named ahead, not hidden", () => {
    const a = (v: string, views: number, leads: number, booked: number) => ({ ...arm(v, views, leads), booked });
    const { arms, decided } = scoreArms([a("c", 107, 2, 1), a("d", 134, 4, 3)]);
    const d = arms.find((x) => x.variant === "d")!;
    expect(d.status).toBe("leading");
    expect(d.chanceBest!).toBeGreaterThan(0.6);
    expect(d.apptChanceBest!).toBeGreaterThan(0.7);
    expect(decided).toBe(false);
  });

  it("names no arm on a coin flip", () => {
    const { arms, decided } = scoreArms([arm("a", 500, 50), arm("b", 500, 50)]);
    expect(arms.every((a) => a.status === "even")).toBe(true);
    expect(decided).toBe(false);
  });

  it("gives the same chance to win on every render", () => {
    const one = scoreArms([arm("c", 79, 2), arm("d", 80, 4)]).arms.map((a) => a.chanceBest);
    const two = scoreArms([arm("c", 79, 2), arm("d", 80, 4)]).arms.map((a) => a.chanceBest);
    expect(one).toEqual(two);
  });
});

describe("split test call estimate", () => {
  const links = [link("Kinetico", "https://k.co/lp-1", "LP 1")];
  const tests: SplitTestRecord[] = [{
    id: "t1", url: "https://k.co/lp-1", name: "c vs d", status: "running",
    weights: { c: 50, d: 50 }, started_at: "2026-10-01T00:00:00Z", stopped_at: null, winner_variant: null,
  }];
  const days = (variant: string, perDay: number): VariantDayRecord[] =>
    Array.from({ length: 7 }, (_, i) => ({ url: "https://k.co/lp-1", variant, day: `2026-10-0${i + 1}`, views: perDay, leads: 0 }));

  it("tracks every test against the same view budget, at this week's pace, ignoring retired arms", () => {
    const b = board({
      links,
      tests,
      variantDays: [...days("c", 11), ...days("d", 11), ...days("a", 1)],
      variantBookings: [
        { ...attributed("https://k.co/lp-1", "c", 2), day: "2026-10-03" },
        { ...attributed("https://k.co/lp-1", "d", 4, 1), day: "2026-10-03" },
      ],
    });
    const t = b.rows[0].runningTest!;
    expect(t.arms.map((a) => a.variant)).toEqual(["c", "d"]);
    expect(t.control).toBe("c");
    expect(t.leader).toBe("d");
    // 77 views an arm against the 500 budget, at 11 a day.
    expect(t.callIn!.viewsLeft).toBe(500 - 77);
    expect(t.callIn!.days).toBe(Math.ceil((500 - 77) / 11));
    expect(t.callIn!.done).toBe(false);
  });
});

describe("appointments per page", () => {
  it("counts the water tests booked by the page's attributed leads, with lead → appt", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1")],
      portfolio: [account("a1", "Kinetico", [adTo("one", "https://k.co/lp-1", 900, 20, 450)])],
      variantBookings: [attributed("https://k.co/lp-1", "a", 6, 2), attributed("https://k.co/lp-1", "b", 4, 1)],
    });
    expect(b.rows[0].verifiedBooked).toBe(3);
    expect(b.rows[0].bookedRate).toBeCloseTo(3 / 10);
    expect(b.booked).toBe(3);
    expect(b.bookedRate).toBeCloseTo(3 / 10);
  });

  it("keeps a real zero as zero for a client that sends attribution", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1")],
      portfolio: [account("a1", "Kinetico", [adTo("one", "https://k.co/lp-1", 900, 20, 450)])],
      variantBookings: [attributed("https://k.co/lp-1", "a", 5, 0)],
    });
    expect(b.rows[0].verifiedBooked).toBe(0);
    expect(b.rows[0].bookedRate).toBe(0);
  });

  it("reads appointments as not tracked when the client sends no attribution", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1")],
      portfolio: [account("a1", "Kinetico", [adTo("one", "https://k.co/lp-1", 900, 20, 450)])],
    });
    expect(b.rows[0].verifiedBooked).toBeNull();
    expect(b.rows[0].bookedRate).toBeNull();
    expect(b.bookedRate).toBeNull();
  });
});

describe("split-test router copy", () => {
  it("shows the live control arm's headline when the router itself has none", () => {
    const b = board({
      links: [link("Kinetico", "https://k.co/lp-1", "LP 1")],
      versions: [
        { url: "https://k.co/lp-1", version: 2, variant: "b", page_headline: "Authority", valid_from: "2026-09-24", valid_to: null },
        { url: "https://k.co/lp-1", version: 1, variant: "a", page_headline: "Problem", valid_from: "2026-09-24", valid_to: null },
      ],
    });
    expect(b.rows[0].headline).toBe("Problem");
  });
});
