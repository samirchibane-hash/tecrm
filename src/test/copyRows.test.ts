import { describe, expect, it } from "vitest";
import { buildCopyRows, copySortValue, pooledClickToLead, splitAtFold } from "@/components/creative-performance/copyRows";
import { makeAd } from "./fixtures";

const noAssets = { headlines: [], bodies: [] };
const bar = { costPer: 40, source: "portfolio" as const };

describe("buildCopyRows", () => {
  it("pools the same words across ads and clients, keeping line breaks for display", () => {
    const body = "Hard water ruining your skin?\n\n✅ Free in-home test";
    const rows = buildCopyRows(
      "body",
      [
        { ad: makeAd({ id: "a", spend: 120, linkClicks: 40, webLeads: 4, copy: { bodies: [body] } }), accountId: "t", accountName: "Tarheel" },
        { ad: makeAd({ id: "b", spend: 80, linkClicks: 20, webLeads: 1, live: false, copy: { bodies: [body.replace("\n\n", "\n")] } }), accountId: "h", accountName: "HQWA" },
        { ad: makeAd({ id: "c", spend: 50, linkClicks: 10, webLeads: 2, copy: { bodies: ["Something else"] } }), accountId: "h", accountName: "HQWA" },
      ],
      noAssets,
      bar,
    );
    expect(rows).toHaveLength(2);
    const top = rows[0];
    expect(top.text).toBe(body);
    expect(top.ads.map((r) => r.ad.id)).toEqual(["a", "b"]);
    expect(top.clients.map((c) => c.name)).toEqual(["Tarheel", "HQWA"]);
    expect(top).toMatchObject({ spend: 200, results: 5, live: 1 });
    expect(top.clickToLead).toBeCloseTo((5 / 60) * 100);
  });

  it("credits a rotating ad per text from Meta's asset rows", () => {
    const ad = makeAd({ id: "rt", spend: 300, webLeads: 9, copy: { headlines: ["Check Zip Code", "Free Water Test"] } });
    const rows = buildCopyRows(
      "headline",
      [{ ad, accountId: "k", accountName: "Kinetico" }],
      {
        headlines: [
          { adId: "rt", text: "Check Zip Code", spend: 200, impressions: 1000, linkClicks: 30, webLeads: 8, formLeads: 0, appointments: null },
          { adId: "rt", text: "Free Water Test", spend: 100, impressions: 500, linkClicks: 10, webLeads: 1, formLeads: 0, appointments: null },
        ],
        bodies: [],
      },
      bar,
    );
    expect(rows.map((r) => [r.text, r.results, r.fromAssets])).toEqual([
      ["Check Zip Code", 8, true],
      ["Free Water Test", 1, true],
    ]);
  });

  it("judges a text on the portfolio bar, not on a raw ratio", () => {
    const mk = (id: string, spend: number, leads: number) =>
      ({ ad: makeAd({ id, spend, webLeads: leads, copy: { headlines: [id] } }), accountId: "x", accountName: "X" });
    const rows = buildCopyRows("headline", [mk("cheap", 400, 25), mk("early", 30, 1), mk("dear", 500, 0)], noAssets, bar);
    const verdict = Object.fromEntries(rows.map((r) => [r.text, r.verdict]));
    expect(verdict).toEqual({ cheap: "winner", early: "learning", dear: "waster" });
  });
});

describe("copy helpers", () => {
  it("sorts a text with spend and no leads as the dearest, and unknowns last", () => {
    const [row] = buildCopyRows("headline", [{ ad: makeAd({ id: "z", spend: 60, copy: { headlines: ["Z"] } }), accountId: "x", accountName: "X" }], noAssets, bar);
    expect(copySortValue(row, "costPer")).toBe(Infinity);
    expect(copySortValue(row, "clickToLead")).toBeNull();
  });

  it("pools click → lead over clicks, not as an average of rates", () => {
    expect(pooledClickToLead([{ results: 1, linkClicks: 10 }, { results: 9, linkClicks: 90 }])).toBeCloseTo(10);
    expect(pooledClickToLead([])).toBeNull();
  });

  it("folds text on a word boundary", () => {
    expect(splitAtFold("Short", 40)).toEqual({ shown: "Short", hidden: "" });
    const { shown, hidden } = splitAtFold("Check Your Zip Code for a FREE In-Home Water Assessment", 40);
    expect(shown).toBe("Check Your Zip Code for a FREE In-Home");
    expect(shown + hidden).toBe("Check Your Zip Code for a FREE In-Home Water Assessment");
  });
});
