import { describe, expect, it } from "vitest";
import { untrackedKpis } from "@/lib/kpis";
import { parseMetaUnavailable, type AdRow } from "@/hooks/useCouplerData";

const row = (overrides: Partial<AdRow>): AdRow =>
  ({
    "Cost: Amount spend": 100,
    "Conversions: Website Appointments Scheduled - Total": null,
    "Conversions: Appointments Scheduled - Total": null,
    "Conversions: Leads - Total": null,
    "Conversions: All On-Facebook Leads - Total": null,
    ...overrides,
  }) as AdRow;

describe("untrackedKpis", () => {
  it("marks appointment KPIs untracked when the proxy left them null on every row", () => {
    const untracked = untrackedKpis([
      row({ "Conversions: Leads - Total": 3 }),
      row({ "Conversions: Leads - Total": 0 }),
    ]);
    expect(untracked.has("apptTotal")).toBe(true);
    expect(untracked.has("apptCost")).toBe(true);
    expect(untracked.has("webApptTotal")).toBe(true);
    expect(untracked.has("leadsTotal")).toBe(false);
  });

  it("treats a tracked event with zero this period as tracked, so it reads 0 not 'Not tracked'", () => {
    const untracked = untrackedKpis([row({ "Conversions: Appointments Scheduled - Total": 0 })]);
    expect(untracked.has("apptTotal")).toBe(false);
  });

  it("claims nothing when there are no rows", () => {
    expect(untrackedKpis([]).size).toBe(0);
  });
});

describe("parseMetaUnavailable", () => {
  it("reads the proxy's header", () => {
    expect(parseMetaUnavailable('[{"id":"act_1","code":"META_NO_ACCESS"}]')).toEqual([{ id: "act_1", code: "META_NO_ACCESS" }]);
  });

  it("ignores a missing or malformed header", () => {
    expect(parseMetaUnavailable(null)).toEqual([]);
    expect(parseMetaUnavailable("not json")).toEqual([]);
    expect(parseMetaUnavailable('{"id":"act_1"}')).toEqual([]);
  });
});
