import { describe, expect, it } from "vitest";
import { groupByDay } from "@/components/claude-log/groupByDay";
import type { WorkEvent } from "@/components/claude-log/workStream";

const event = (
  occurredAt: string,
  repo: string | null,
  accountIds: string[] = [],
  source: WorkEvent["source"] = "github",
): WorkEvent => ({
  id: `${source}-${repo ?? "ops"}-${occurredAt}`,
  occurredAt,
  source,
  accountIds,
  writer: "Samir",
  title: "Change",
  detail: null,
  outcome: source === "ops" ? "checklist_stage" : null,
  href: null,
  repo,
  sha: repo ? "abc" : null,
  claudeCoauthored: source === "github",
  files: [],
  additions: source === "github" ? 1 : null,
  deletions: source === "github" ? 0 : null,
  links: accountIds.map((accountId) => ({ accountId, matchedBy: source === "github" ? "path" : null })),
});

describe("groupByDay", () => {
  it("groups newest-first events by local day with a repo and client digest", () => {
    const days = groupByDay([
      event("2026-09-10T20:00:00", "o/temetamanager", ["acct-kin"]),
      event("2026-09-10T15:00:00", "o/temetamanager", ["acct-kin"]),
      event("2026-09-10T09:00:00", "o/tecrm"),
      event("2026-09-09T14:00:00", "o/temetamanager", ["acct-tar"]),
    ]);
    expect(days.map((d) => d.key)).toEqual(["2026-09-10", "2026-09-09"]);
    expect(days[0].events).toHaveLength(3);
    expect(days[0].repos).toEqual(["temetamanager", "tecrm"]); // most active first
    expect(days[0].accountIds).toEqual(["acct-kin"]); // de-duplicated
    expect(days[1].accountIds).toEqual(["acct-tar"]);
  });

  it("counts repos from github events only, and still lists the ops event", () => {
    const days = groupByDay([
      event("2026-09-10T20:00:00", "o/tecrm", ["acct-tar"]),
      event("2026-09-10T18:00:00", null, ["acct-tar"], "ops"),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].events).toHaveLength(2);
    expect(days[0].repos).toEqual(["tecrm"]);
    expect(days[0].accountIds).toEqual(["acct-tar"]);
  });

  it("returns nothing for no events", () => {
    expect(groupByDay([])).toEqual([]);
  });
});
