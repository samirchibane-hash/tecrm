import { describe, expect, it } from "vitest";
import { countThreshold, describeCount, passesCount } from "@/components/creative-performance/countThreshold";

describe("count filter", () => {
  it("is off when set to any, blank or invalid", () => {
    expect(countThreshold({ op: "any", count: "5" })).toBeNull();
    expect(countThreshold({ op: "gt", count: "" })).toBeNull();
    expect(countThreshold({ op: "gt", count: "abc" })).toBeNull();
    expect(passesCount(null, { op: "gt", count: "" })).toBe(true);
  });

  it("compares strictly", () => {
    expect(passesCount(5, { op: "gt", count: "5" })).toBe(false);
    expect(passesCount(6, { op: "gt", count: "5" })).toBe(true);
    expect(passesCount(5, { op: "lt", count: "5" })).toBe(false);
    expect(passesCount(0, { op: "lt", count: "1" })).toBe(true);
  });

  it("never passes an unknown count while active", () => {
    expect(passesCount(null, { op: "lt", count: "1" })).toBe(false);
    expect(passesCount(null, { op: "gt", count: "0" })).toBe(false);
  });

  it("describes the active filter", () => {
    expect(describeCount({ op: "lt", count: "3" }, "appts")).toBe("fewer than 3 appts");
    expect(describeCount({ op: "any", count: "3" }, "appts")).toBeNull();
  });
});

describe("amount filters (spend)", () => {
  it("describes a spend threshold in dollars with 'less than'", () => {
    expect(describeCount({ op: "lt", count: "500" }, "spend", true)).toBe("less than $500 spend");
    expect(describeCount({ op: "gt", count: "1200" }, "spend", true)).toBe("more than $1,200 spend");
  });
  it("treats an idle page's $0 as a real amount", () => {
    expect(passesCount(0, { op: "lt", count: "100" })).toBe(true);
    expect(passesCount(0, { op: "gt", count: "100" })).toBe(false);
  });
});
