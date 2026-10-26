import { KILL_REVIEW_FIXTURE } from "./fixtureData";
import { inKillReviewScope } from "./rules";
import type { CreativeKillReviewRow, KillReviewAccount } from "./types";

export type KillRunMeta = {
  runDate: string;
  curSince: string;
  curUntil: string;
  prevSince: string;
  prevUntil: string;
};

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function actKeys(act: string): string[] {
  const trimmed = act.trim();
  const numeric = trimmed.replace(/^act_/, "");
  return [norm(trimmed), norm(numeric), norm(`act_${numeric}`)];
}

/**
 * Preview source. Reads the bundled fixture, never Meta and never
 * creative_kill_reviews (that migration is not applied).
 * Hidden Performance accounts drop out. account_id is filled when an
 * account matches the Meta act or the client name.
 */
export function loadKillReviews(args: {
  runDate: string;
  hiddenAccounts: string[];
  accounts: KillReviewAccount[];
}): CreativeKillReviewRow[] {
  const hidden = new Set(args.hiddenAccounts.map(norm));
  const byAct = new Map<string, KillReviewAccount>();
  const byName = new Map<string, KillReviewAccount>();
  for (const account of args.accounts) {
    byName.set(norm(account.account_name), account);
    if (account.fb_ad_account_id) {
      for (const key of actKeys(account.fb_ad_account_id)) byAct.set(key, account);
    }
  }

  return KILL_REVIEW_FIXTURE.filter((row) => row.run_date === args.runDate).flatMap((row) => {
    if (!inKillReviewScope(row)) return [];
    const account = actKeys(row.act).map((key) => byAct.get(key)).find(Boolean) ?? byName.get(norm(row.client_name));
    const names = [row.client_name, account?.account_name].filter((name): name is string => !!name);
    if (names.some((name) => hidden.has(norm(name)))) return [];
    return [{ ...row, account_id: account?.id ?? row.account_id }];
  });
}

export function killReviewRuns(): KillRunMeta[] {
  const seen = new Map<string, KillRunMeta>();
  for (const row of KILL_REVIEW_FIXTURE) {
    if (seen.has(row.run_date)) continue;
    seen.set(row.run_date, {
      runDate: row.run_date,
      curSince: row.cur_since,
      curUntil: row.cur_until,
      prevSince: row.prev_since,
      prevUntil: row.prev_until,
    });
  }
  return [...seen.values()].sort((a, b) => b.runDate.localeCompare(a.runDate));
}
