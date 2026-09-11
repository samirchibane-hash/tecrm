import { describe, expect, it } from "vitest";
import { poissonCdf, poissonSf, twoProportionPValue, wilsonInterval } from "@/lib/stats";
import { normalizePageUrl } from "@/lib/urls";
import { detectAngle, detectOffer, labelCreative } from "@/components/creative-performance/labels";
import { computeBenchmark, judge, scoreAds, targetFor } from "@/components/creative-performance/verdicts";
import { breakdown } from "@/components/creative-performance/breakdowns";
import { matchGhlByAdName } from "@/components/creative-performance/ghl";
import { analyzeLandingPages, funnelSteps } from "@/components/funnel/funnelMath";
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
