import { describe, expect, it } from "vitest";
import { costSortValue, sortByKpi } from "@/lib/kpiSort";
import { adSortValue } from "@/components/creative-performance/adSort";
import type { CreativeAd } from "@/components/creative-performance/useCreativePerformance";

type Item = { id: string; v: number | null; spend: number };
const items: Item[] = [
  { id: "a", v: 3, spend: 10 },
  { id: "b", v: null, spend: 99 },
  { id: "c", v: 1, spend: 20 },
  { id: "d", v: Infinity, spend: 50 },
  { id: "e", v: 3, spend: 40 },
];
const ids = (xs: Item[]) => xs.map((x) => x.id).join("");
const bySpend = (a: Item, b: Item) => b.spend - a.spend;

describe("sortByKpi", () => {
  it("sorts ascending with spent-no-result after every priced row and unknown last", () => {
    expect(ids(sortByKpi(items, (x) => x.v, "asc", bySpend))).toBe("ceadb");
  });
  it("sorts descending with unknown still last", () => {
    expect(ids(sortByKpi(items, (x) => x.v, "desc", bySpend))).toBe("deacb");
  });
  it("does not mutate the input", () => {
    const copy = [...items];
    sortByKpi(items, (x) => x.v, "asc");
    expect(items).toEqual(copy);
  });
});

describe("costSortValue", () => {
  it("separates priced, spent-with-nothing and unknown", () => {
    expect(costSortValue(100, 4)).toBe(25);
    expect(costSortValue(100, 0)).toBe(Infinity);
    expect(costSortValue(0, 0)).toBeNull();
    expect(costSortValue(100, null)).toBeNull();
  });
});

describe("adSortValue", () => {
  const ad = (over: Partial<CreativeAd>) =>
    ({ spend: 200, delivered: true, format: "image", appointments: null, linkCtr: 1.2, frequency: 1.5, impressions: 1000, videoPlays: 0, ...over }) as CreativeAd;

  it("treats an ad's zero leads under a tracking gap as unknown", () => {
    expect(adSortValue({ ad: ad({}), results: 0, trackingGap: true }, "leads")).toBeNull();
    expect(adSortValue({ ad: ad({}), results: 0, trackingGap: true }, "costPer")).toBeNull();
    expect(adSortValue({ ad: ad({}), results: 0, trackingGap: false }, "costPer")).toBe(Infinity);
  });
  it("has no hook rate for image ads and no KPIs for undelivered ads except spend", () => {
    expect(adSortValue({ ad: ad({}), results: 2, trackingGap: false }, "hook")).toBeNull();
    expect(adSortValue({ ad: ad({ delivered: false, spend: 0 }), results: 0, trackingGap: false }, "linkCtr")).toBeNull();
    expect(adSortValue({ ad: ad({ delivered: false, spend: 0 }), results: 0, trackingGap: false }, "spend")).toBe(0);
  });
  it("leaves untracked appointments unknown, not zero", () => {
    expect(adSortValue({ ad: ad({ appointments: null }), results: 2, trackingGap: false }, "appts")).toBeNull();
    expect(adSortValue({ ad: ad({ appointments: 0 }), results: 2, trackingGap: false }, "appts")).toBe(0);
  });
});
