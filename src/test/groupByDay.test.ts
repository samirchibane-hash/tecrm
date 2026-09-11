import { describe, expect, it } from "vitest";
import { groupByDay } from "@/components/claude-log/groupByDay";
import type { LogCommit } from "@/components/claude-log/useClaudeLog";

const commit = (committed_at: string, repo: string, accountIds: string[] = []): LogCommit => ({
  repo,
  sha: `${repo}-${committed_at}`,
  committed_at,
  author_name: "Samir",
  subject: "Change",
  body: null,
  claude_coauthored: true,
  files: [],
  additions: 1,
  deletions: 0,
  html_url: null,
  source: "github",
  links: accountIds.map((account_id) => ({ account_id, matched_by: "path" })),
});

describe("groupByDay", () => {
  it("groups newest-first commits by local day with a repo and client digest", () => {
    const days = groupByDay([
      commit("2026-09-10T20:00:00", "o/temetamanager", ["acct-kin"]),
      commit("2026-09-10T15:00:00", "o/temetamanager", ["acct-kin"]),
      commit("2026-09-10T09:00:00", "o/tecrm"),
      commit("2026-09-09T14:00:00", "o/temetamanager", ["acct-tar"]),
    ]);
    expect(days.map((d) => d.key)).toEqual(["2026-09-10", "2026-09-09"]);
    expect(days[0].commits).toHaveLength(3);
    expect(days[0].repos).toEqual(["temetamanager", "tecrm"]); // most active first
    expect(days[0].accountIds).toEqual(["acct-kin"]); // de-duplicated
    expect(days[1].accountIds).toEqual(["acct-tar"]);
  });

  it("returns nothing for no commits", () => {
    expect(groupByDay([])).toEqual([]);
  });
});
