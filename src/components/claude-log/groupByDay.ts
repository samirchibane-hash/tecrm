import { format } from "date-fns";
import { repoShortName, type LogCommit } from "./useClaudeLog";

export type LogDay = {
  key: string; // yyyy-MM-dd, local time
  label: string; // "Wed, Sep 10"
  commits: LogCommit[];
  repos: string[]; // short names, by commit count
  accountIds: string[];
};

/** Commits → one group per local calendar day, newest first, with a digest. */
export function groupByDay(commits: LogCommit[]): LogDay[] {
  const days = new Map<string, LogDay>();
  const sorted = [...commits].sort((a, b) => b.committed_at.localeCompare(a.committed_at));
  for (const c of sorted) {
    const d = new Date(c.committed_at);
    const key = format(d, "yyyy-MM-dd");
    let day = days.get(key);
    if (!day) {
      day = { key, label: format(d, "EEE, MMM d"), commits: [], repos: [], accountIds: [] };
      days.set(key, day);
    }
    day.commits.push(c);
  }
  for (const day of days.values()) {
    const repoCounts = new Map<string, number>();
    for (const c of day.commits) repoCounts.set(repoShortName(c.repo), (repoCounts.get(repoShortName(c.repo)) ?? 0) + 1);
    day.repos = [...repoCounts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
    day.accountIds = [...new Set(day.commits.flatMap((c) => c.links.map((l) => l.account_id)))];
  }
  return [...days.values()];
}
