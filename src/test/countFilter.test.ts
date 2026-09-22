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
