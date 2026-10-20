import { describe, expect, it } from "vitest";
import { apptTotals } from "@/components/creative-performance/apptTotals";

describe("apptTotals", () => {
  it("costs appointments over tracked rows only", () => {
    const t = apptTotals([
      { spend: 300, appointments: 2 },
      { spend: 100, appointments: 1 },
      { spend: 500, appointments: null }, // account doesn't track Schedule
    ]);
    expect(t).toEqual({ tracked: 2, untracked: 1, appointments: 3, costPerAppt: 400 / 3 });
  });

  it("reads zero appointments as zero with no cost, not $0", () => {
    expect(apptTotals([{ spend: 250, appointments: 0 }])).toEqual({ tracked: 1, untracked: 0, appointments: 0, costPerAppt: null });
  });

  it("reports nothing tracked when every row is unknown", () => {
    expect(apptTotals([{ spend: 250, appointments: null }]).tracked).toBe(0);
    expect(apptTotals([]).tracked).toBe(0);
  });
});
