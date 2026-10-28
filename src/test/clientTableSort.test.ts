import { describe, expect, it } from "vitest";
import { sortClientRows, type ClientSortRow } from "@/components/dashboard/clientTableSort";

const row = (name: string, spend: number | null, leads: number, extra: Partial<ClientSortRow> = {}): ClientSortRow => ({
  name,
  spend,
  leads,
  appointments: 0,
  activeAds: null,
  dailyBudget: null,
  ...extra,
});

const rows = [
  row("Tarheel", 1000, 20), // CPL 50
  row("HQWA", 500, 0), // spent, no leads
  row("D'Orange", null, 5), // Meta can't read spend
  row("Kinetico", 300, 10), // CPL 30
];
const names = (xs: ClientSortRow[]) => xs.map((r) => r.name);
const sort = (key: Parameters<typeof sortClientRows>[2], dir: "asc" | "desc") =>
  names(sortClientRows(rows, (r) => r, key, dir));

describe("sortClientRows", () => {
  it("sorts spend highest first, unknown spend last both ways", () => {
    expect(sort("spend", "desc")).toEqual(["Tarheel", "HQWA", "Kinetico", "D'Orange"]);
    expect(sort("spend", "asc")).toEqual(["Kinetico", "HQWA", "Tarheel", "D'Orange"]);
  });

  it("puts spend with no leads as the dearest CPL, and unknown spend last", () => {
    expect(sort("cpl", "desc")).toEqual(["HQWA", "Tarheel", "Kinetico", "D'Orange"]);
    expect(sort("cpl", "asc")).toEqual(["Kinetico", "Tarheel", "HQWA", "D'Orange"]);
  });

  it("counts zero leads as a real zero", () => {
    expect(sort("leads", "asc")).toEqual(["HQWA", "D'Orange", "Kinetico", "Tarheel"]);
  });

  it("sorts names A to Z and back", () => {
    expect(sort("account", "asc")).toEqual(["D'Orange", "HQWA", "Kinetico", "Tarheel"]);
    expect(sort("account", "desc")).toEqual(["Tarheel", "Kinetico", "HQWA", "D'Orange"]);
  });
});
