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

/**
 * One muted line for a finished task: "Oct 7 · Tommy".
 * Either part alone is enough. Nothing, when both are unknown.
 * The client name is not included here — mixed lists already show it.
 */
export function completionMeta(input: {
  completed: boolean;
  completedAt: string | null | undefined;
  completedBy: string | null | undefined;
  now?: Date;
}): string | null {
  if (!input.completed) return null;
  const parts = [
    formatCompletionDate(input.completedAt, input.now),
    firstName(input.completedBy),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}
