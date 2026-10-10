import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { render, screen } from "@testing-library/react";
import { AccountTasksCard } from "@/components/account/AccountTasksCard";
import type { AccountTask } from "@/components/account/queries";
import { TaskCompletionMeta } from "@/components/tasks/TaskCompletionMeta";
import {
  categoryLeaf,
  completerName,
  completionMeta,
  completionWrite,
  firstName,
  formatCompletionDate,
  personNameFromUser,
  rosterNameForEmail,
} from "@/lib/taskCompletion";

const now = new Date("2026-10-09T12:00:00.000Z");

describe("firstName", () => {
  it("keeps a bare first name", () => {
    expect(firstName("Yan")).toBe("Yan");
    expect(firstName("  Miu  ")).toBe("Miu");
  });

  it("drops the role after the name", () => {
    expect(firstName("Tommy - CSM")).toBe("Tommy");
    expect(firstName("Amy- Image Designer")).toBe("Amy");
    expect(firstName("Jimmy — CSM")).toBe("Jimmy");
    expect(firstName("David Chen")).toBe("David");
  });

  it("treats a blank, an email, and a model name as unknown", () => {
    expect(firstName(null)).toBeNull();
    expect(firstName("")).toBeNull();
    expect(firstName("   ")).toBeNull();
    expect(firstName("samir@example.com")).toBeNull();
    expect(firstName("Claude")).toBeNull();
    expect(firstName("bot")).toBeNull();
  });
});

describe("personNameFromUser", () => {
  it("reads a profile display name and ignores the email", () => {
    expect(personNameFromUser({ user_metadata: { full_name: "Tommy - CSM" } })).toBe("Tommy - CSM");
    expect(personNameFromUser({ user_metadata: { email: "tommy@example.com" } })).toBeNull();
    expect(personNameFromUser({ user_metadata: { name: "Claude" } })).toBeNull();
    expect(personNameFromUser(null)).toBeNull();
  });
});

describe("completionMeta", () => {
  const iso = "2026-10-07T12:00:00.000Z";
  const day = format(new Date(iso), "MMM d");

  it("joins the day and the first name", () => {
    expect(completionMeta({ completed: true, completedAt: iso, completedBy: "Tommy - CSM", now })).toBe(`${day} · Tommy`);
  });

  it("shows whichever part is known", () => {
    expect(completionMeta({ completed: true, completedAt: iso, completedBy: null, now })).toBe(day);
    expect(completionMeta({ completed: true, completedAt: null, completedBy: "Amy- Image Designer", now })).toBe("Amy");
  });

  it("adds the category leaf when the row does not already show the chip", () => {
    expect(completionMeta({ completed: true, completedAt: iso, completedBy: "Tommy - CSM", category: "GHL", now })).toBe(`${day} · Tommy · GHL`);
    expect(completionMeta({ completed: true, completedAt: iso, completedBy: "Tommy - CSM", category: "CRM › GHL", now })).toBe(`${day} · Tommy · GHL`);
    expect(categoryLeaf("Meta Ads")).toBe("Meta Ads");
    expect(completionMeta({ completed: true, completedAt: null, completedBy: null, category: "GHL", now })).toBe("GHL");
  });

  it("shows nothing for an open task or an unknown stamp", () => {
    expect(completionMeta({ completed: false, completedAt: iso, completedBy: "Tommy", category: "GHL", now })).toBeNull();
    expect(completionMeta({ completed: true, completedAt: null, completedBy: null, now })).toBeNull();
    expect(completionMeta({ completed: true, completedAt: null, completedBy: "claude", now })).toBeNull();
  });

  it("keeps the year when the finish was in another year", () => {
    const older = "2024-05-18T12:00:00.000Z";
    expect(formatCompletionDate(older, now)).toBe(format(new Date(older), "MMM d, yyyy"));
    expect(formatCompletionDate(iso, now)).toBe(format(new Date(iso), "MMM d"));
    expect(formatCompletionDate("not-a-date", now)).toBeNull();
  });
});

describe("rosterNameForEmail", () => {
  const roster = ["Mohammed", "Samir", "Sam", "Amy"];

  it("matches the longest roster first name at the start of the mailbox", () => {
    expect(rosterNameForEmail("samirchibane94@gmail.com", roster)).toBe("Samir");
    expect(rosterNameForEmail("Amy-designer@example.com", roster)).toBe("Amy");
  });

  it("prefers a profile display name over the roster", () => {
    expect(completerName({ profileName: "Tommy - CSM", email: "samirchibane94@gmail.com", roster })).toBe("Tommy - CSM");
    expect(completerName({ profileName: null, email: "samirchibane94@gmail.com", roster })).toBe("Samir");
    expect(completerName({ profileName: null, email: "unknown@example.com", roster })).toBeNull();
  });
});

describe("completionWrite", () => {
  const at = new Date("2026-10-09T15:04:00.000Z");

  it("stamps the moment and keeps the display name when marking done", () => {
    expect(completionWrite(true, "Amy- Image Designer", at)).toEqual({
      completed: true,
      completed_at: at.toISOString(),
      completed_by: "Amy- Image Designer",
    });
  });

  it("stores no person when the name is unknown", () => {
    expect(completionWrite(true, null, at).completed_by).toBeNull();
    expect(completionWrite(true, "bot", at).completed_by).toBeNull();
    expect(completionWrite(true, "samir@example.com", at).completed_by).toBeNull();
  });

  it("clears the stamp when the task is reopened", () => {
    expect(completionWrite(false, "Tommy - CSM", at)).toEqual({
      completed: false,
      completed_at: null,
      completed_by: null,
    });
  });
});

const finished = (overrides: Partial<AccountTask> = {}): AccountTask => ({
  id: "1",
  title: "Instant forms live",
  account_name: "Culligan Rochester",
  priority: "medium",
  completed: true,
  stage: "launched",
  due_date: null,
  created_at: "2026-10-07T12:00:00.000Z",
  updated_at: "2026-10-07T12:00:00.000Z",
  completed_at: "2026-10-07T12:00:00.000Z",
  completed_by: "Tommy - CSM",
  category: null,
  ...overrides,
});

describe("AccountTasksCard", () => {
  it("shows the finish line and does not repeat the client", () => {
    render(<AccountTasksCard accountName="Culligan Rochester" tasks={[finished()]} onChange={() => {}} />);
    const line = screen.getByText(/Tommy/);
    expect(line).toHaveTextContent("Tommy");
    expect(line).not.toHaveTextContent("CSM");
    expect(screen.queryByText("Culligan Rochester")).not.toBeInTheDocument();
  });

  it("puts the category on the finish line, since this list has no category chip", () => {
    render(
      <AccountTasksCard
        accountName="Culligan Rochester"
        tasks={[finished({ category: "CRM › GHL" })]}
        onChange={() => {}}
      />,
    );
    const line = screen.getByText(/Tommy/);
    expect(line).toHaveTextContent("GHL");
    expect(line).not.toHaveTextContent("CRM");
    expect(screen.queryByText("Culligan Rochester")).not.toBeInTheDocument();
  });

  it("shows nothing extra when a finished task has no stamp", () => {
    render(
      <AccountTasksCard
        accountName="Culligan Rochester"
        tasks={[finished({ completed_at: null, completed_by: null })]}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText(/Tommy/)).not.toBeInTheDocument();
    expect(screen.getByText("Instant forms live")).toBeInTheDocument();
  });
});

describe("TaskCompletionMeta", () => {
  it("renders the muted line and nothing when the stamp is unknown", () => {
    const { rerender } = render(
      <TaskCompletionMeta completed completedAt="2026-10-07T12:00:00.000Z" completedBy="Tommy - CSM" />,
    );
    const line = screen.getByText(/Tommy/);
    expect(line).toHaveTextContent("Tommy");
    expect(line).not.toHaveTextContent("CSM");
    expect(line.className).toContain("text-muted-foreground");

    rerender(<TaskCompletionMeta completed completedAt={null} completedBy={null} />);
    expect(screen.queryByText(/Tommy/)).not.toBeInTheDocument();
  });
});
