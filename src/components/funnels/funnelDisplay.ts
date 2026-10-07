import type { FunnelRow } from "./funnelRows";

export const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const ATTRIBUTED =
  "GoHighLevel contacts carrying this page's lp_page and an lp_variant, from the ad's UTM parameters";

export type HistoryEvent =
  | { kind: "copy"; at: string; key: string; version: FunnelRow["versions"][number] }
  | { kind: "test"; at: string; key: string; test: FunnelRow["pastTests"][number] };

/** Everything that changed on the page, newest first: copy versions and split tests on one timeline. */
export function historyEvents(row: FunnelRow): HistoryEvent[] {
  const tests = [...(row.runningTest ? [row.runningTest] : []), ...row.pastTests];
  return [
    ...row.versions.map((v): HistoryEvent => ({ kind: "copy", at: v.from, key: `v-${v.version}-${v.variant}`, version: v })),
    ...tests.map((t): HistoryEvent => ({ kind: "test", at: t.startedAt, key: `t-${t.id}`, test: t })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}
