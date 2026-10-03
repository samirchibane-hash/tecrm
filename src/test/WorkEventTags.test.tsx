import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkEventTags } from "@/components/claude-log/WorkEventTags";
import type { WorkEvent } from "@/components/claude-log/workStream";

const event = (overrides: Partial<WorkEvent>): WorkEvent => ({
  id: "ops:1",
  occurredAt: "2026-10-02T15:00:00Z",
  source: "ops",
  accountIds: ["acct-tar"],
  links: [{ accountId: "acct-tar", matchedBy: null }],
  writer: "Samir",
  title: "Sent the weekly recap",
  detail: null,
  outcome: "client_email_sent",
  href: null,
  repo: null,
  sha: null,
  claudeCoauthored: false,
  files: [],
  additions: null,
  deletions: null,
  ...overrides,
});

describe("WorkEventTags", () => {
  it("tags an ops outcome with its source, outcome, client, and writer", () => {
    render(
      <WorkEventTags
        event={event({})}
        accountName={(id) => (id === "acct-tar" ? "Tarheel Pure Water" : undefined)}
      />,
    );
    expect(screen.getByText("Ops")).toBeInTheDocument();
    expect(screen.getByText("Email sent")).toBeInTheDocument();
    expect(screen.getByText("Tarheel Pure Water")).toBeInTheDocument();
    expect(screen.getByText("Samir")).toBeInTheDocument();
    expect(screen.queryByText("Agency")).not.toBeInTheDocument();
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
  });

  it("tags a commit with GitHub and leaves an unresolved client unnamed", () => {
    render(
      <WorkEventTags
        event={event({
          source: "github",
          outcome: null,
          repo: "o/tecrm",
          writer: "Samir",
          accountIds: ["acct-missing"],
          links: [{ accountId: "acct-missing", matchedBy: "path" }],
        })}
        accountName={() => undefined}
      />,
    );
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("tecrm")).toBeInTheDocument();
    expect(screen.getByText("Samir")).toBeInTheDocument();
    expect(screen.queryByText("Agency")).not.toBeInTheDocument();
  });

  it("tags unlinked work as Agency", () => {
    render(
      <WorkEventTags
        event={event({ source: "github", outcome: null, accountIds: [], links: [], repo: "o/tecrm" })}
        accountName={() => undefined}
      />,
    );
    expect(screen.getByText("Agency")).toBeInTheDocument();
  });
});
