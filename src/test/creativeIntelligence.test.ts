import { describe, expect, it } from "vitest";
import { poissonCdf, poissonSf, twoProportionPValue, wilsonInterval } from "@/lib/stats";
import { normalizePageUrl } from "@/lib/urls";
import { detectAngle, detectOffer, labelCreative } from "@/components/creative-performance/labels";
import { computeBenchmark, judge, scoreAds, targetFor } from "@/components/creative-performance/verdicts";
import { breakdown } from "@/components/creative-performance/breakdowns";
import { matchGhlByAdName } from "@/components/creative-performance/ghl";
import { analyzeLandingPages, funnelSteps } from "@/components/funnel/funnelMath";
import {
  analyzePortfolioFunnel,
  headlineKey,
  resolveCopyVersion,
  type FunnelPageCopy,
  type FunnelPageVersion,
} from "@/components/funnel/portfolioFunnel";
import type { PortfolioAccount } from "@/components/creative-performance/useCreativePerformance";
import { makeAd } from "./fixtures";

describe("stats", () => {
  it("computes Poisson tails", () => {
    expect(poissonCdf(0, 2)).toBeCloseTo(Math.exp(-2));
    expect(poissonCdf(3, 12)).toBeCloseTo(0.00229, 4);
    expect(poissonSf(0, 5)).toBe(1);
    expect(poissonSf(27, 7.8)).toBeLessThan(1e-6);
    // large lambdas don't underflow to nonsense
    expect(poissonCdf(900, 1000)).toBeGreaterThan(0.0005);
    expect(poissonCdf(900, 1000)).toBeLessThan(0.002);
  });

  it("gives a Wilson interval that stays inside 0–1 at the edges", () => {
    const zero = wilsonInterval(0, 40)!;
    expect(zero.low).toBe(0);
    expect(zero.high).toBeGreaterThan(0.05);
    const i = wilsonInterval(25, 182)!;
    expect(i.low).toBeLessThan(25 / 182);
    expect(i.high).toBeGreaterThan(25 / 182);
    expect(wilsonInterval(0, 0)).toBeNull();
  });

  it("tests two proportions", () => {
    expect(twoProportionPValue(25, 182, 3, 201)!).toBeLessThan(0.001);
    expect(twoProportionPValue(14, 144, 12, 120)!).toBeGreaterThan(0.5);
    expect(twoProportionPValue(1, 0, 1, 10)).toBeNull();
  });
});

describe("normalizePageUrl", () => {
  it("drops scheme, www, case, query and trailing slash", () => {
    expect(normalizePageUrl("https://www.Test.KineticoTV.co/Meridian-1/?utm_source=fb#x")).toBe("test.kineticotv.co/meridian-1");
  });
});

describe("offer detection", () => {
  it("reads the real Kinetico SW Idaho copy as financing (price per day beats the free test CTA)", () => {
    expect(detectOffer("#1 Water Solutions Provider in Idaho: Get a FREE Water Test\n✅ From $2/day!\n✅ 1-Day Installation")).toBe("financing");
  });

  it("reads Kinetico Utah's ad names", () => {
    expect(detectOffer("IMG0120-v2 - 6mo 0% - LP")).toBe("financing");
    expect(detectOffer("Soft water for $3,495 installed")).toBe("retail_price");
  });

  it("puts a free RO system ahead of everything it's bundled with", () => {
    expect(detectOffer("Get a FREE reverse osmosis system + free water test with any softener")).toBe("free_ro");
    expect(detectOffer("FREE RO with purchase — from $1/day")).toBe("free_ro");
  });

  it("doesn't mistake discounts or monthly figures for a system price", () => {
    expect(detectOffer("Save $500 today")).toBe("discount");
    expect(detectOffer("$1,000 off any system")).toBe("discount");
    expect(detectOffer("Only $49/mo")).toBe("financing");
    expect(detectOffer("100% satisfaction")).toBe("none");
  });

  it("reads deferred payments as financing, not as the free test the page also offers", () => {
    // Real landing page copy: HQWA OKC, True Water Broadway, Kinetico UT LP1.
    expect(detectOffer("pay nothing for 3 months: 0 payments, 0 interest\nEnter your zip for a FREE water test"))
      .toBe("financing");
    expect(detectOffer("We fix it at every tap — no payments and no interest for 6 months. Get a FREE in-home water test"))
      .toBe("financing");
    // A free test with no payment terms is still a free test.
    expect(detectOffer("Enter your zip code for a FREE water test — takes 60 seconds")).toBe("free_test");
  });

  it("falls back to the free water test, then to none", () => {
    expect(detectOffer("Book your FREE in-home water analysis now.")).toBe("free_test");
    expect(detectOffer("Idaho homeowners! Want cleaner water?")).toBe("none");
  });
});

describe("angle detection", () => {
  it("uses the earliest mention: the hook", () => {
    expect(detectAngle("Tired of itchy skin and flat hair? Idaho water often contains chlorine")).toBe("skin_hair");
    expect(detectAngle("Chlorine and PFAS are in your water. Protect your family's skin")).toBe("contaminants");
  });

  it("doesn't read 'book your spot' as a hard-water angle", () => {
    expect(detectAngle("Book your spot today")).toBe("none");
  });

  it("prefers an angle named in the ad set or ad name", () => {
    const l = labelCreative({
      name: "IMG009 - b",
      adset: "IMG1009 - Hair Angle - M&F30+",
      copy: { headlines: [], bodies: ["Protect your family from PFAS"], descriptions: [], destinationUrls: [], cta: null, leadForm: false },
    });
    expect(l.angle).toBe("skin_hair");
  });

  it("lets a manual label win, and ignores unknown keys", () => {
    const ad = { name: "x", adset: null, copy: { headlines: ["From $2/day"], bodies: [], descriptions: [], destinationUrls: [], cta: null, leadForm: false } };
    expect(labelCreative(ad, { offer: "free_ro", angle: null })).toMatchObject({ offer: "free_ro", offerSource: "manual", angleSource: "detected" });
    expect(labelCreative(ad, { offer: "bogus", angle: null })).toMatchObject({ offer: "financing", offerSource: "detected" });
  });
});

// Kinetico SW Idaho, website-lead ads, Aug 12 – Sep 10 2026.
const kinetico = [
  makeAd({ id: "1006-v2", spend: 745.11, webLeads: 25, landingPageViews: 182, linkClicks: 205, impressions: 20000 }),
  makeAd({ id: "IMG009-b", spend: 697.15, webLeads: 12, landingPageViews: 120, linkClicks: 135, impressions: 18000 }),
  makeAd({ id: "1004-v3", spend: 641.6, webLeads: 14, landingPageViews: 144, linkClicks: 160, impressions: 17000 }),
  makeAd({ id: "1005-v2", spend: 456.7, webLeads: 3, landingPageViews: 201, linkClicks: 230, impressions: 15000 }),
  makeAd({ id: "1005-v3", spend: 298.54, webLeads: 3, landingPageViews: 81, linkClicks: 90, impressions: 9000 }),
  makeAd({ id: "1004-v6", spend: 80.36, webLeads: 0, landingPageViews: 27, linkClicks: 30, impressions: 3000 }),
  makeAd({ id: "1005-v1", spend: 4.62, webLeads: 0 }),
];

describe("verdicts", () => {
  it("benchmarks against the target when set, else the account average", () => {
    expect(computeBenchmark(kinetico, "leads", 40)).toEqual({ costPer: 40, source: "target" });
    const avg = computeBenchmark(kinetico, "leads", null)!;
    expect(avg.source).toBe("average");
    expect(avg.costPer).toBeCloseTo(2924.08 / 57, 1);
  });

  it("flags the $457 / 3-lead video as a money waster and never judges a $4.62 ad", () => {
    const s = scoreAds(kinetico, "leads", 40);
    const byId = Object.fromEntries(s.scored.map((x) => [x.ad.id, x]));
    expect(byId["1005-v2"].verdict).toBe("waster");
    expect(byId["1005-v2"].excessSpend).toBeCloseTo(456.7 - 3 * 40);
    expect(byId["1005-v1"].verdict).toBe("learning");
    expect(byId["1006-v2"].verdict).toBe("winner"); // 25 leads where $40 buys 18.6: p ≈ 0.08, and $29.80 is 25% under
    expect(byId["1004-v3"].verdict).toBe("on_par"); // $45.83: dearer, but 14 vs 16 expected is noise
    expect(byId["IMG009-b"].verdict).toBe("on_par"); // $58: 12 vs 17.4 expected, p ≈ 0.12 — not yet a cut
    expect(s.wasters[0].ad.id).toBe("1005-v2"); // biggest excess first
  });

  it("calls zero results a waster only after ~2.3× the benchmark in spend", () => {
    expect(judge({ spend: 80, results: 0 }, { costPer: 40, source: "target" }, "leads").verdict).toBe("learning");
    expect(judge({ spend: 95, results: 0 }, { costPer: 40, source: "target" }, "leads").verdict).toBe("waster");
  });

  it("crowns a clear winner and reports what it saved", () => {
    const j = judge({ spend: 296, results: 27 }, { costPer: 40, source: "target" }, "leads");
    expect(j.verdict).toBe("winner");
    expect(j.savings).toBeCloseTo(27 * 40 - 296);
  });

  it("reads 3 leads on $24 as an early read, not a winner to scale", () => {
    const j = judge({ spend: 23.81, results: 3 }, { costPer: 40, source: "target" }, "leads");
    expect(j.verdict).toBe("learning");
    expect(j.reason).toMatch(/^Early read/);
  });

  it("withholds verdicts when no ad recorded a result after real spend (a tracking gap, not bad ads)", () => {
    const broken = [makeAd({ id: "a", spend: 300 }), makeAd({ id: "b", spend: 160 })];
    const s = scoreAds(broken, "appointments", 100);
    expect(s.trackingGap).toBe(true);
    expect(s.wasters).toHaveLength(0);
    expect(s.scored.every((x) => x.verdict === "unscored")).toBe(true);
  });

  it("never mixes lead sources: a form ad is judged on form leads", () => {
    const form = makeAd({ id: "RT-109", spend: 296, formLeads: 27, webLeads: 0, leadChannel: "form" });
    expect(scoreAds([form], "leads", 40).scored[0].results).toBe(27);
  });

  it("judges instant forms against their own average, never the website CPL target", () => {
    expect(targetFor("form", "leads", { cpl: 40, cpa: 200 })).toBeNull();
    expect(targetFor("website", "leads", { cpl: 40, cpa: 200 })).toBe(40);
    expect(targetFor("form", "appointments", { cpl: 40, cpa: 200 })).toBe(200);
  });

  it("flags fatigue from frequency", () => {
    const tired = makeAd({ id: "t", spend: 200, webLeads: 5, frequency: 3.4 });
    expect(scoreAds([tired], "leads", 40).fatigued.map((x) => x.ad.id)).toEqual(["t"]);
  });
});

describe("breakdowns", () => {
  const ctx = { metric: "leads" as const, labels: new Map(), assets: null, pageLabel: (k: string) => k };

  it("groups by offer and shares spend", () => {
    const ads = [
      makeAd({ id: "a", spend: 300, webLeads: 10, copy: { bodies: ["From $2/day! Free water test"] } }),
      makeAd({ id: "b", spend: 100, webLeads: 1, copy: { bodies: ["Book your FREE water test"] } }),
    ];
    const rows = breakdown("offer", ads, ctx, { costPer: 40, source: "target" }, false);
    expect(rows.map((r) => r.key)).toEqual(["financing", "free_test"]);
    expect(rows[0].share).toBeCloseTo(0.75);
    expect(rows[0].costPer).toBeCloseTo(30);
  });

  it("splits rotating headlines with Meta's asset rows instead of crediting one text", () => {
    const ad = makeAd({ id: "rt", spend: 296, formLeads: 27, leadChannel: "form", copy: { headlines: ["A", "B"] } });
    const assets = {
      headlines: [
        { adId: "rt", text: "A", spend: 200, impressions: 1, linkClicks: 1, webLeads: 0, formLeads: 20, appointments: null },
        { adId: "rt", text: "B", spend: 96, impressions: 1, linkClicks: 1, webLeads: 0, formLeads: 7, appointments: null },
      ],
      bodies: null,
    };
    const rows = breakdown("headline", [ad], { ...ctx, assets }, { costPer: 40, source: "target" }, false);
    expect(rows.map((r) => [r.label, r.results])).toEqual([["A", 20], ["B", 7]]);
    expect(rows.every((r) => r.fromAssets)).toBe(true);
  });

  it("puts an unsplit rotating ad in a catch-all row, last", () => {
    const rows = breakdown(
      "headline",
      [makeAd({ id: "x", spend: 50, copy: { headlines: ["A", "B"] } }), makeAd({ id: "y", spend: 10, copy: { headlines: ["C"] } })],
      ctx,
      null,
      false,
    );
    expect(rows[rows.length - 1]).toMatchObject({ catchAll: true, spend: 50 });
  });
});

describe("GHL matching", () => {
  it("counts leads and appts per ad name within the period, with coverage", () => {
    const m = matchGhlByAdName(
      [
        { type: "lead", created_on: "2026-09-02", "Ad Name": "RT-109" },
        { type: "Water test", created_on: "2026-09-03", "Ad Name": " rt-109 " },
        { type: "lead", created_on: "2026-09-04", "Ad Name": null },
        { type: "lead", created_on: "2026-07-01", "Ad Name": "RT-109" },
      ],
      "2026-08-12",
      "2026-09-10",
    );
    expect(m.byName.get("rt-109")).toEqual({ leads: 2, appts: 1 });
    expect(m).toMatchObject({ total: 3, withAdName: 2 });
  });
});

describe("funnel", () => {
  const page = (id: string, url: string, lpv: number, leads: number, spend = 100) =>
    makeAd({ id, spend, landingPageViews: lpv, webLeads: leads, linkClicks: lpv + 10, copy: { destinationUrls: [url] } });

  it("computes step rates and leaves appointments untracked as null", () => {
    const steps = funnelSteps([page("a", "https://x.co/a", 100, 10)], false);
    expect(steps.find((s) => s.key === "leads")!.rate).toBeCloseTo(0.1);
    expect(steps.find((s) => s.key === "appointments")!.value).toBeNull();
  });

  it("names a winner only when the gap is significant, and lists idle pages", () => {
    const rows = analyzeLandingPages(
      [page("a", "https://x.co/lp-1?utm=1", 400, 60), page("b", "https://x.co/lp-2", 380, 15)],
      [
        { url: "https://x.co/lp-1", label: "LP 1", page_title: null },
        { url: "https://x.co/lp-3", label: "LP 3", page_title: null },
        { url: "https://x.co/schedule", label: "Schedule", page_title: null },
      ],
      false,
    );
    expect(rows.map((r) => [r.label, r.status])).toEqual([["LP 1", "winner"], ["/lp-2", "behind"], ["LP 3", "no_traffic"]]);
  });

  it("calls a close race undecided and estimates the traffic still needed", () => {
    const rows = analyzeLandingPages([page("a", "https://x.co/1", 144, 14), page("b", "https://x.co/2", 120, 12)], [], false);
    expect(rows.map((r) => r.status).sort()).toEqual(["leading", "undecided"]);
    expect(rows.find((r) => r.status === "undecided")!.viewsNeeded).toBeGreaterThan(1000);
  });

  it("refuses to compute a rate when leads exceed page views", () => {
    const rows = analyzeLandingPages([page("a", "https://x.co/1", 7, 27)], [], false);
    expect(rows[0]).toMatchObject({ status: "unreliable", cvr: null });
  });

  it("marks a lone page as the only page, not a winner", () => {
    expect(analyzeLandingPages([page("a", "https://x.co/1", 500, 40)], [], false)[0].status).toBe("only_page");
  });
});

describe("portfolio funnel", () => {
  const FREE_TEST = {
    page_headline: "Tired of Itchy Skin & Hard Water? Upgrade Your Home Today.",
    page_subhead: "Boise runs hard water year-round.",
    page_cta: "Enter your zip code for a FREE water test — takes 60 seconds",
  };
  const PRICE = {
    page_headline: "Get a Whole-Home Water Softener for Just $3,495.",
    page_subhead: "Soft water at every tap, installed in 1 day.",
    page_cta: "Claim your spot at $3,495 pricing",
  };

  const link = (account: string, url: string, label: string, copy: Partial<FunnelPageCopy> = {}): FunnelPageCopy => ({
    account_name: account,
    url,
    label,
    page_title: null,
    page_headline: null,
    page_subhead: null,
    page_cta: null,
    copy_synced_at: "2026-09-17T00:00:00Z",
    ...copy,
  });

  const adTo = (id: string, url: string, spend: number, leads: number, lpv: number) =>
    makeAd({ id, spend, webLeads: leads, landingPageViews: lpv, linkClicks: lpv + 20, copy: { destinationUrls: [url] } });

  const account = (id: string, name: string, ads: ReturnType<typeof adTo>[]): PortfolioAccount => ({
    accountId: id,
    accountName: name,
    ads,
    error: null,
  });

  const version = (
    url: string,
    n: number,
    headline: string,
    valid_from: string,
    valid_to: string | null = null,
  ): FunnelPageVersion => ({ url, version: n, page_headline: headline, valid_from, valid_to });

  describe("copy versions", () => {
    const V1 = version("https://k.co/lp-1", 1, "Old promise", "2026-08-01T00:00:00Z", "2026-09-10T00:00:00Z");
    const V2 = version("https://k.co/lp-1", 2, "New promise", "2026-09-10T00:00:00Z");

    it("reports one version when the whole period ran on it", () => {
      const r = resolveCopyVersion([V1, V2], "2026-09-11", "2026-09-17");
      expect(r).toMatchObject({ version: 2, spanned: 1, previousHeadline: null });
    });

    it("flags a period that straddles a rewrite, and names what it used to say", () => {
      const r = resolveCopyVersion([V1, V2], "2026-09-01", "2026-09-17");
      expect(r).toMatchObject({ version: 2, spanned: 2, previousHeadline: "Old promise" });
    });

    it("reports the old version for a period that ended before the rewrite", () => {
      const r = resolveCopyVersion([V1, V2], "2026-08-05", "2026-08-20");
      expect(r).toMatchObject({ version: 1, spanned: 1 });
    });

    it("counts a version opened on the final day of the period as spanned", () => {
      const r = resolveCopyVersion([V1, V2], "2026-09-01", "2026-09-10");
      expect(r.spanned).toBe(2);
    });

    it("claims nothing for a page with no history rather than inventing v1", () => {
      expect(resolveCopyVersion([], "2026-09-01", "2026-09-17"))
        .toMatchObject({ version: null, spanned: 0 });
    });

    // The seeded v1 carries the day the sync first *read* the page, which is long
    // after it went live. Taking that literally would leave the period with no
    // overlapping version and credit the whole 30 days to the copy that replaced
    // it — the misattribution the whole feature exists to prevent.
    it("credits the period to v1 when the only history starts after the period ended", () => {
      const seededV1 = version("https://k.co/lp-1", 1, "Old promise", "2026-09-18T02:11:00Z", "2026-09-18T03:28:00Z");
      const newV2 = version("https://k.co/lp-1", 2, "New promise", "2026-09-18T03:28:00Z");
      const r = resolveCopyVersion([seededV1, newV2], "2026-08-19", "2026-09-17");
      expect(r.version).toBe(1);
      expect(r.spanned).toBe(1);
      expect(r.sinceIsFirstSeen).toBe(true);
    });

    it("marks a first-seen date as first-seen, and a genuine go-live as not", () => {
      expect(resolveCopyVersion([V1, V2], "2026-08-05", "2026-08-20").sinceIsFirstSeen).toBe(true);
      expect(resolveCopyVersion([V1, V2], "2026-09-11", "2026-09-17").sinceIsFirstSeen).toBe(false);
    });

    it("marks the page and its pooled headline when the period mixes versions", () => {
      const board = analyzePortfolioFunnel(
        [account("a1", "Kinetico", [adTo("x", "https://k.co/lp-1", 1000, 40, 1000)])],
        [{ id: "a1", account_name: "Kinetico", target_cpl: 50 }],
        [link("Kinetico", "https://k.co/lp-1", "LP 1", FREE_TEST)],
        [],
        { byAccount: new Map(), since: "2026-09-01", until: "2026-09-17" },
        [V1, V2],
      );
      expect(board.mixedCopyPages).toBe(1);
      expect(board.pages[0]).toMatchObject({ version: 2, spanned: 2 });
      expect(board.headlines[0].mixedPages).toBe(1);
    });

    it("leaves the board clean when no page changed inside the period", () => {
      const board = analyzePortfolioFunnel(
        [account("a1", "Kinetico", [adTo("x", "https://k.co/lp-1", 1000, 40, 1000)])],
        [{ id: "a1", account_name: "Kinetico", target_cpl: 50 }],
        [link("Kinetico", "https://k.co/lp-1", "LP 1", FREE_TEST)],
        [],
        { byAccount: new Map(), since: "2026-09-11", until: "2026-09-17" },
        [V1, V2],
      );
      expect(board.mixedCopyPages).toBe(0);
      expect(board.headlines[0].mixedPages).toBe(0);
      expect(board.pages[0].version).toBe(2);
    });
  });

  it("normalizes a headline so the same promise in two markets is one row", () => {
    expect(headlineKey("Tired of Itchy Skin, Hard Water Stains & Well Water Problems?"))
      .toBe(headlineKey("Tired of itchy skin, hard water stains and well water problems"));
    // The price is the promise, so it must not normalize away.
    expect(headlineKey("Softener for Just $3,495.")).not.toBe(headlineKey("Softener for Just $2,995."));
  });

  it("judges each page on its own client's CPL target and carries the page's headline", () => {
    const board = analyzePortfolioFunnel(
      [account("a1", "Kinetico", [
        adTo("win", "https://k.co/lp-1", 1000, 40, 1000),
        adTo("lose", "https://k.co/lp-2", 1000, 5, 1000),
      ])],
      [{ id: "a1", account_name: "Kinetico", target_cpl: 50 }],
      [link("Kinetico", "https://k.co/lp-1", "LP 1", FREE_TEST), link("Kinetico", "https://k.co/lp-2", "LP 2", PRICE)],
      [],
    );
    expect(board.winners.map((p) => p.label)).toEqual(["LP 1"]);
    expect(board.wasters.map((p) => p.label)).toEqual(["LP 2"]);
    expect(board.winners[0].headline).toBe(FREE_TEST.page_headline);
    expect(board.winners[0].offer).toBe("free_test");
    expect(board.wasters[0].offer).toBe("retail_price");
    expect(board.winners[0].cvr).toBeCloseTo(0.04);
    expect(board.savings).toBeGreaterThan(0);
    expect(board.excess).toBeGreaterThan(0);
  });

  it("pools a headline across clients and only calls one best when the gap is significant", () => {
    const board = analyzePortfolioFunnel(
      [
        account("a1", "Kinetico", [adTo("k1", "https://k.co/lp-1", 500, 60, 600), adTo("k2", "https://k.co/lp-2", 500, 12, 600)]),
        account("a2", "Tarheel", [adTo("t1", "https://t.co/lp-1", 500, 55, 600), adTo("t2", "https://t.co/lp-2", 500, 10, 600)]),
      ],
      [
        { id: "a1", account_name: "Kinetico", target_cpl: null },
        { id: "a2", account_name: "Tarheel", target_cpl: null },
      ],
      [
        link("Kinetico", "https://k.co/lp-1", "K 1", FREE_TEST),
        link("Kinetico", "https://k.co/lp-2", "K 2", PRICE),
        link("Tarheel", "https://t.co/lp-1", "T 1", FREE_TEST),
        link("Tarheel", "https://t.co/lp-2", "T 2", PRICE),
      ],
      [],
    );
    const [best, behind] = board.headlines;
    expect(best.label).toBe(FREE_TEST.page_headline);
    expect(best.status).toBe("best");
    expect(best.pages).toBe(2);
    expect(best.clients).toEqual(["Kinetico", "Tarheel"]);
    expect(best.lpv).toBe(1200);
    expect(behind.status).toBe("behind");
    expect(board.offers.map((o) => o.label)).toEqual(["Free water test", "Retail price"]);
  });

  it("leaves a thin headline unranked rather than crowning it", () => {
    const board = analyzePortfolioFunnel(
      [account("a1", "Kinetico", [adTo("k1", "https://k.co/lp-1", 500, 40, 600), adTo("k2", "https://k.co/lp-2", 50, 9, 20)])],
      [{ id: "a1", account_name: "Kinetico", target_cpl: null }],
      [link("Kinetico", "https://k.co/lp-1", "K 1", FREE_TEST), link("Kinetico", "https://k.co/lp-2", "K 2", PRICE)],
      [],
    );
    expect(board.headlines.find((g) => g.label === PRICE.page_headline)!.status).toBe("needs_traffic");
    expect(board.headlines.find((g) => g.label === FREE_TEST.page_headline)!.status).toBe("best");
  });

  it("ranks every page best to worst against each client's own benchmark", () => {
    const board = analyzePortfolioFunnel(
      [
        // Cheap market, $20 target: 25/lead is over, 10/lead is under.
        account("a1", "Kinetico", [
          adTo("cheap-good", "https://k.co/good", 1000, 100, 1200),
          adTo("cheap-bad", "https://k.co/bad", 1000, 40, 1200),
        ]),
        // Dear market, $100 target: 50/lead is under despite costing more than
        // either Kinetico page, which is the whole point of indexing.
        account("a2", "Tarheel", [
          adTo("dear-good", "https://t.co/good", 1000, 20, 1200),
          adTo("dead", "https://t.co/dead", 1000, 0, 1200),
        ]),
      ],
      [
        { id: "a1", account_name: "Kinetico", target_cpl: 20 },
        { id: "a2", account_name: "Tarheel", target_cpl: 100 },
      ],
      [],
      [],
    );
    expect(board.pages.map((p) => p.label)).toEqual(["/good", "/good", "/bad", "/dead"]);
    expect(board.pages.map((p) => p.accountName)).toEqual(["Kinetico", "Tarheel", "Kinetico", "Tarheel"]);
    // $10 vs a $20 target = half the benchmark; $50 vs $100 likewise.
    expect(board.pages[0].benchmarkIndex).toBeCloseTo(0.5);
    expect(board.pages[1].benchmarkIndex).toBeCloseTo(0.5);
    expect(board.pages[2].benchmarkIndex).toBeCloseTo(1.25);
    // Spent with nothing to show: no index, and last.
    expect(board.pages[3].benchmarkIndex).toBeNull();
  });

  it("ranks an unscorable page last rather than worst", () => {
    const board = analyzePortfolioFunnel(
      [
        account("a1", "Kinetico", [adTo("bad", "https://k.co/bad", 1000, 10, 1200)]),
        // Every page dry after real spend = tracking gap, not four bad pages.
        account("a2", "Tarheel", [
          adTo("t1", "https://t.co/1", 500, 0, 600),
          adTo("t2", "https://t.co/2", 500, 0, 600),
        ]),
      ],
      [
        { id: "a1", account_name: "Kinetico", target_cpl: 20 },
        { id: "a2", account_name: "Tarheel", target_cpl: 50 },
      ],
      [],
      [],
    );
    expect(board.pages[0].accountName).toBe("Kinetico");
    expect(board.pages.slice(1).every((p) => p.verdict === "unscored")).toBe(true);
  });

  it("counts pages whose copy isn't synced and keeps them out of the headline rollup", () => {
    const board = analyzePortfolioFunnel(
      [account("a1", "Kinetico", [adTo("k1", "https://k.co/lp-1", 500, 40, 600), adTo("k2", "https://k.co/lp-9", 500, 30, 600)])],
      [{ id: "a1", account_name: "Kinetico", target_cpl: null }],
      [link("Kinetico", "https://k.co/lp-1", "K 1", FREE_TEST)],
      [],
    );
    expect(board.unsynced).toBe(1);
    expect(board.pages).toHaveLength(2);
    expect(board.pages.find((p) => p.key === "k.co/lp-9")!.headline).toBeNull();
    expect(board.headlines).toHaveLength(1);
  });

  it("withholds verdicts and reports a tracking gap when no page recorded a lead", () => {
    const board = analyzePortfolioFunnel(
      [account("a1", "Kinetico", [adTo("k1", "https://k.co/lp-1", 500, 0, 600), adTo("k2", "https://k.co/lp-2", 500, 0, 600)])],
      [{ id: "a1", account_name: "Kinetico", target_cpl: 50 }],
      [link("Kinetico", "https://k.co/lp-1", "K 1", FREE_TEST)],
      [],
    );
    expect(board.gaps).toEqual([{ accountName: "Kinetico", spend: 1000 }]);
    expect(board.wasters).toHaveLength(0);
    expect(board.pages.every((p) => p.verdict === "unscored")).toBe(true);
  });

  it("skips hidden clients and reports the ones Meta refused", () => {
    const board = analyzePortfolioFunnel(
      [
        account("a1", "Kinetico", [adTo("k1", "https://k.co/lp-1", 500, 40, 600)]),
        { accountId: "a2", accountName: "Tarheel", error: { code: "META_NO_ACCESS", message: "no" } },
        account("a3", "Pure Viva", [adTo("p1", "https://p.co/lp-1", 500, 40, 600)]),
      ],
      [{ id: "a1", account_name: "Kinetico", target_cpl: null }],
      [],
      ["Pure Viva"],
    );
    expect(board.unreadable).toEqual(["Tarheel"]);
    expect(board.clients).toBe(1);
    expect(board.pages.map((p) => p.accountName)).toEqual(["Kinetico"]);
  });

  it("attributes a CRM lead by ad name, and infers it when the client has one page", () => {
    const ghl = (rows: { type: string; created_on: string; ad?: string }[]) => ({
      byAccount: new Map([["a1", rows.map((r) => ({ type: r.type, created_on: r.created_on, "Ad Name": r.ad ?? null }))]]),
      since: "2026-09-01",
      until: "2026-09-30",
    });

    // Two pages: only an ad-named lead can be placed, the loose one cannot.
    const two = analyzePortfolioFunnel(
      [account("a1", "Kinetico", [
        makeAd({ id: "k1", name: "AD-A", spend: 500, webLeads: 5, landingPageViews: 600, copy: { destinationUrls: ["https://k.co/1"] } }),
        makeAd({ id: "k2", name: "AD-B", spend: 500, webLeads: 5, landingPageViews: 600, copy: { destinationUrls: ["https://k.co/2"] } }),
      ])],
      [{ id: "a1", account_name: "Kinetico", target_cpl: 50 }],
      [],
      [],
      ghl([{ type: "lead", created_on: "2026-09-10", ad: "ad-a" }, { type: "lead", created_on: "2026-09-11" }]),
    );
    const a = two.pages.find((p) => p.key === "k.co/1")!;
    expect(a).toMatchObject({ crmLeads: 1, crmInferred: false });
    expect(two.pages.find((p) => p.key === "k.co/2")).toMatchObject({ crmLeads: 0 });
    // Never split across pages — it's reported as unallocated instead.
    expect(two.crmUnallocated).toBe(1);

    // One page: the same loose lead is placed there, flagged as inferred.
    const one = analyzePortfolioFunnel(
      [account("a1", "Kinetico", [adTo("k1", "https://k.co/1", 500, 5, 600)])],
      [{ id: "a1", account_name: "Kinetico", target_cpl: 50 }],
      [],
      [],
      ghl([{ type: "lead", created_on: "2026-09-11" }]),
    );
    expect(one.pages[0]).toMatchObject({ crmLeads: 1, crmInferred: true });
    expect(one.crmUnallocated).toBe(0);
    // CRM leads never touch the Meta lead count, the rate or the verdict.
    expect(one.pages[0].leads).toBe(5);
    expect(one.pages[0].cvr).toBeCloseTo(5 / 600);
  });

  it("counts a water test as a CRM lead and ignores rows outside the period", () => {
    const board = analyzePortfolioFunnel(
      [account("a1", "Kinetico", [adTo("k1", "https://k.co/1", 500, 5, 600)])],
      [{ id: "a1", account_name: "Kinetico", target_cpl: 50 }],
      [],
      [],
      {
        byAccount: new Map([["a1", [
          { type: "water test", created_on: "2026-09-10", "Ad Name": null },
          { type: "appointment", created_on: "2026-09-10", "Ad Name": null },  // not a lead
          { type: "lead", created_on: "2026-08-20", "Ad Name": null },          // before the period
        ]]]),
        since: "2026-09-01",
        until: "2026-09-30",
      },
    );
    expect(board.pages[0].crmLeads).toBe(1);
  });

  it("never reports a conversion rate above 100%", () => {
    const board = analyzePortfolioFunnel(
      [account("a1", "Kinetico", [adTo("k1", "https://k.co/lp-1", 500, 27, 7)])],
      [{ id: "a1", account_name: "Kinetico", target_cpl: null }],
      [],
      [],
    );
    expect(board.pages[0].cvr).toBeNull();
    expect(board.portfolioCvr).toBeNull();
  });
});
