import { format } from "date-fns";
import { repoShortName } from "./useClaudeLog";
import type { WorkEvent } from "./workStream";

export type LogDay = {
  key: string; // yyyy-MM-dd, local time
  label: string; // "Wed, Sep 10"
  events: WorkEvent[];
  repos: string[]; // short names, by github-event count
  accountIds: string[];
};

/** Work events → one group per local calendar day, newest first, with a digest. */
export function groupByDay(events: WorkEvent[]): LogDay[] {
  const days = new Map<string, LogDay>();
  const sorted = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  for (const event of sorted) {
    const d = new Date(event.occurredAt);
    const key = format(d, "yyyy-MM-dd");
    let day = days.get(key);
    if (!day) {
      day = { key, label: format(d, "EEE, MMM d"), events: [], repos: [], accountIds: [] };
      days.set(key, day);
    }
    day.events.push(event);
  }
  for (const day of days.values()) {
    const repoCounts = new Map<string, number>();
    for (const event of day.events) {
      if (!event.repo) continue;
      const name = repoShortName(event.repo);
      repoCounts.set(name, (repoCounts.get(name) ?? 0) + 1);
    }
    day.repos = [...repoCounts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
    day.accountIds = [...new Set(day.events.flatMap((event) => event.accountIds))];
  }
  return [...days.values()];
}
