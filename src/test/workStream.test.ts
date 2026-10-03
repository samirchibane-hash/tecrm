import { describe, expect, it } from "vitest";
import {
  filterWorkEvents,
  rowToWorkEvent,
  sliceForClient,
  type WorkEvent,
  type WorkEventRow,
} from "@/components/claude-log/workStream";

const row = (overrides: Partial<WorkEventRow>): WorkEventRow => ({
  id: "github:o/tecrm:abc",
  occurred_at: "2026-09-10T15:00:00Z",
  source: "github",
  writer: "Samir",
  title: "Ship the funnel copy",
  detail: null,
  outcome: null,
  href: null,
  account_ids: ["acct-tar"],
  repo: "o/tecrm",
  sha: "abc",
  claude_coauthored: true,
  files: [],
  additions: 1,
  deletions: 0,
  ...overrides,
});

const event = (overrides: Partial<WorkEvent> & { id: string }): WorkEvent => {
  const mapped = rowToWorkEvent({
    id: overrides.id,
    occurred_at: overrides.occurredAt ?? "2026-09-10T15:00:00Z",
    source: overrides.source ?? "github",
    writer: overrides.writer === undefined ? "Samir" : overrides.writer,
    title: overrides.title ?? "Change",
    detail: overrides.detail ?? null,
    outcome: overrides.outcome ?? null,
    href: null,
    account_ids: overrides.accountIds ?? ["acct-tar"],
    repo: overrides.repo === undefined ? "o/tecrm" : overrides.repo,
    sha: "abc",
    claude_coauthored: false,
    files: [],
    additions: null,
    deletions: null,
  });
  if (!mapped) throw new Error(`fixture did not map: ${overrides.id}`);
  return mapped;
};

describe("rowToWorkEvent", () => {
  it("keeps the commit author as the writer when Claude co-authored", () => {
    const mapped = rowToWorkEvent(row({ writer: "Samir", claude_coauthored: true }));
    expect(mapped?.source).toBe("github");
    expect(mapped?.writer).toBe("Samir");
    expect(mapped?.outcome).toBeNull();
    expect(mapped?.claudeCoauthored).toBe(true);
  });

  it("does not invent a bot writer when the author is missing", () => {
    const mapped = rowToWorkEvent(row({ writer: "  ", claude_coauthored: true }));
    expect(mapped?.writer).toBeNull();
  });

  it("maps an ops outcome and leaves it off github rows", () => {
    const ops = rowToWorkEvent(row({
      id: "ops:1",
      source: "ops",
      outcome: "client_email_sent",
      writer: "Samir",
      title: "Sent the weekly recap",
      repo: null,
      sha: null,
      claude_coauthored: false,
      account_ids: ["acct-tar"],
    }));
    expect(ops).toMatchObject({
      source: "ops",
      outcome: "client_email_sent",
      writer: "Samir",
      accountIds: ["acct-tar"],
    });

    const stray = rowToWorkEvent(row({ outcome: "campaign_live" }));
    expect(stray?.source).toBe("github");
    expect(stray?.outcome).toBeNull();
  });

  it("drops an ops row whose outcome is not one of the five", () => {
    expect(rowToWorkEvent(row({ source: "ops", outcome: "chat" }))).toBeNull();
  });
});

describe("sliceForClient", () => {
  const stream = [
    event({ id: "g1", source: "github", accountIds: ["acct-tar"], title: "Push" }),
    event({ id: "g2", source: "github", accountIds: ["acct-tar", "acct-kin"], title: "Shared" }),
    event({ id: "o1", source: "ops", outcome: "a2p_filed", accountIds: ["acct-tar"], title: "Filed A2P", repo: null }),
    event({ id: "g3", source: "github", accountIds: ["acct-kin"], title: "Other client" }),
    event({ id: "g4", source: "github", accountIds: [], title: "Agency" }),
  ];

  it("returns that client's github pushes and ops outcomes as one list", () => {
    expect(sliceForClient(stream, "acct-tar").map((e) => e.id)).toEqual(["g1", "g2", "o1"]);
  });

  it("includes a commit in each client it is linked to", () => {
    expect(sliceForClient(stream, "acct-kin").map((e) => e.id)).toEqual(["g2", "g3"]);
  });

  it("leaves agency work off a client slice", () => {
    expect(sliceForClient(stream, "acct-tar").some((e) => e.accountIds.length === 0)).toBe(false);
  });

  it("returns nothing for an empty account id", () => {
    expect(sliceForClient(stream, "")).toEqual([]);
  });
});

describe("filterWorkEvents", () => {
  const stream = [
    event({ id: "g1", repo: "o/tecrm", accountIds: ["acct-tar"], title: "Funnel headline" }),
    event({ id: "o1", source: "ops", outcome: "ghl_update", repo: null, accountIds: ["acct-tar"], title: "Updated the pipeline", detail: "stage moved" }),
    event({ id: "g2", repo: "o/website", accountIds: [], title: "Agency chore" }),
  ];

  it("slices the firehose to one client, including ops", () => {
    const filtered = filterWorkEvents(stream, { client: "acct-tar", repo: "all", query: "" });
    expect(filtered.map((e) => e.id)).toEqual(["g1", "o1"]);
  });

  it("keeps only unlinked github events for agency work", () => {
    const filtered = filterWorkEvents(stream, { client: "agency", repo: "all", query: "" });
    expect(filtered.map((e) => e.id)).toEqual(["g2"]);
  });

  it("drops ops events when a repo is selected", () => {
    const filtered = filterWorkEvents(stream, { client: "all", repo: "o/tecrm", query: "" });
    expect(filtered.map((e) => e.id)).toEqual(["g1"]);
  });

  it("matches title and detail without reordering", () => {
    const filtered = filterWorkEvents(stream, { client: "all", repo: "all", query: "pipeline" });
    expect(filtered.map((e) => e.id)).toEqual(["o1"]);
    const both = filterWorkEvents(stream, { client: "all", repo: "all", query: "e" });
    expect(both.map((e) => e.id)).toEqual(["g1", "o1", "g2"]);
  });
});
