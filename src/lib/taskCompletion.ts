import { format } from "date-fns";

// Model names are not a person. Same rejection the ops stream uses for a writer.
const NOT_A_PERSON = new Set(["grok", "claude", "chatgpt", "assistant", "bot"]);

/**
 * The given name in a display name. Roles ride after the name:
 * "Tommy - CSM" and "Amy- Image Designer" both yield the first name.
 * An email, a blank, or a model name is unknown.
 */
export function firstName(displayName: string | null | undefined): string | null {
  if (!displayName) return null;
  const trimmed = displayName.trim();
  if (!trimmed || trimmed.includes("@")) return null;
  const match = trimmed.match(/^\p{L}+/u);
  const name = match?.[0] ?? null;
  if (!name || NOT_A_PERSON.has(name.toLowerCase())) return null;
  return name;
}

/** Auth profile name, when the session actually has one. The email is not a name. */
export function personNameFromUser(
  user: { user_metadata?: unknown } | null | undefined,
): string | null {
  const meta = user?.user_metadata;
  if (!meta || typeof meta !== "object") return null;
  const record = meta as Record<string, unknown>;
  for (const key of ["full_name", "name", "display_name"]) {
    const value = record[key];
    if (typeof value === "string" && firstName(value)) return value.trim();
  }
  return null;
}

/** Calendar day the task was finished. Same year drops the year so the line stays short. */
export function formatCompletionDate(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const sameYear = d.getFullYear() === now.getFullYear();
  return format(d, sameYear ? "MMM d" : "MMM d, yyyy");
}

export type CompletionStamp = {
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
};

/** Fields to write when a task is marked done or reopened. The raw display name is kept. */
export function completionWrite(
  completed: boolean,
  displayName: string | null,
  at = new Date(),
): CompletionStamp {
  if (!completed) return { completed: false, completed_at: null, completed_by: null };
  const name = displayName?.trim() || null;
  return {
    completed: true,
    completed_at: at.toISOString(),
    completed_by: name && firstName(name) ? name : null,
  };
}

// Same separator tasks.category uses for "Category › Sub-option" (shared.tsx CAT_SEP).
const CAT_SEP = " › ";

/** The category label a row shows. A sub-option path keeps the leaf, matching the category chip. */
export function categoryLeaf(category: string | null | undefined): string | null {
  if (!category) return null;
  const [top, ...rest] = category.split(CAT_SEP);
  const leaf = (rest.length > 0 ? rest.join(CAT_SEP) : top).trim();
  return leaf || null;
}

/**
 * Longest team-roster first name that the email's local part starts with.
 * samirchibane94@… matches Samir ahead of Sam. No separator is required, because
 * the admin address is the first name plus the rest of the mailbox.
 */
export function rosterNameForEmail(email: string | null | undefined, names: readonly string[]): string | null {
  const local = email?.split("@")[0]?.toLowerCase() ?? "";
  if (!local) return null;
  let best: string | null = null;
  for (const name of names) {
    const given = firstName(name);
    if (!given || given.length < 2) continue;
    if (!local.startsWith(given.toLowerCase())) continue;
    if (!best || given.length > best.length) best = given;
  }
  return best;
}

/** Profile display name when the session has one, otherwise the roster match. */
export function completerName(input: {
  profileName: string | null;
  email: string | null | undefined;
  roster: readonly string[];
}): string | null {
  if (input.profileName && firstName(input.profileName)) return input.profileName.trim();
  return rosterNameForEmail(input.email, input.roster);
}

/**
 * One muted line for a finished task: "Oct 7 · Tommy · GHL".
 * Pass category only when that row does not already show the category chip.
 * The client name is not included — mixed lists already show it.
 */
/** First name of a bot assignee, when completed_by was left empty. Human assignees are not used. */
export function botAssigneeFirstName(
  assignee: string | null | undefined,
  botNames: readonly string[] | undefined,
): string | null {
  if (!assignee || !botNames?.includes(assignee)) return null;
  return firstName(assignee);
}

export function completionMeta(input: {
  completed: boolean;
  completedAt: string | null | undefined;
  completedBy: string | null | undefined;
  /** Task assignee. Used only when it is one of botNames and completed_by is empty. */
  assignee?: string | null;
  botNames?: readonly string[];
  category?: string | null;
  now?: Date;
}): string | null {
  if (!input.completed) return null;
  const parts = [
    formatCompletionDate(input.completedAt, input.now),
    firstName(input.completedBy) ?? botAssigneeFirstName(input.assignee, input.botNames),
    categoryLeaf(input.category),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}
