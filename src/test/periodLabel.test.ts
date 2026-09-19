import { describe, expect, it } from "vitest";
import { periodLabel, toCreativeRange } from "@/lib/periods";

const d = (iso: string) => new Date(`${iso}T00:00:00`);

describe("periodLabel", () => {
  it("names the preset and the days it resolved to", () => {
    expect(periodLabel({ from: d("2026-09-01"), to: d("2026-09-19") }, "Month to Date"))
      .toBe("Month to Date (09/01 – 09/19/2026)");
  });

  it("shows a custom range by its dates alone", () => {
    expect(periodLabel({ from: d("2026-09-01"), to: d("2026-09-19") }, "")).toBe("09/01 – 09/19/2026");
  });

  it("reads a single day without a range dash", () => {
    expect(periodLabel({ from: d("2026-09-19"), to: undefined }, "Yesterday")).toBe("Yesterday (09/19/2026)");
  });

  it("calls a cleared range all time, not an empty range", () => {
    expect(periodLabel(undefined, "")).toBe("All time");
    expect(periodLabel({ from: undefined, to: undefined }, "Last 7 days")).toBe("All time");
  });
});

describe("toCreativeRange", () => {
  it("passes the picker's days to Meta as bounds", () => {
    expect(toCreativeRange({ from: d("2026-09-01"), to: d("2026-09-19") }))
      .toEqual({ since: "2026-09-01", until: "2026-09-19" });
  });

  it("ends a half-open range on its own start, never today", () => {
    expect(toCreativeRange({ from: d("2026-09-19"), to: undefined }))
      .toEqual({ since: "2026-09-19", until: "2026-09-19" });
  });

  it("asks Meta for its maximum window when no range is set", () => {
    expect(toCreativeRange(undefined)).toEqual({ preset: "maximum" });
  });
});
