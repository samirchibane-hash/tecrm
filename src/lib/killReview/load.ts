import { KILL_REVIEW_FIXTURE } from "./fixtureData";
import { inKillReviewScope, isInternalAdAccount } from "./rules";
import type { CreativeKillReviewRow, KillReviewAccount } from "./types";

export type KillRunMeta = {
  runDate: string;
  curSince: string;
  curUntil: string;
  prevSince: string;
  prevUntil: string;
};

/** A published row. Runs before 2026-10-29 omit campaign, business, and CPC. */
export type KillReviewInput = Omit<CreativeKillReviewRow, "campaign_id" | "campaign_name" | "business_id" | "cpc" | "account_id"> &
  Partial<Pick<CreativeKillReviewRow, "campaign_id" | "campaign_name" | "business_id" | "cpc" | "account_id">>;

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function actKeys(act: string): string[] {
  const trimmed = act.trim();
  const numeric = trimmed.replace(/^act_/, "");
  return [norm(trimmed), norm(numeric), norm(`act_${numeric}`)];
}

/** Fills the columns a pre-10/29 row does not carry. Does not derive CPC. */
export function normalizeKillReviewRow(raw: KillReviewInput): CreativeKillReviewRow {
  const cpc = raw.cpc == null || !Number.isFinite(raw.cpc) ? null : raw.cpc;
  return {
    ...raw,
    account_id: blankToNull(raw.account_id),
    campaign_id: blankToNull(raw.campaign_id),
    campaign_name: blankToNull(raw.campaign_name),
    business_id: blankToNull(raw.business_id),
    cpc,
  };
}

/**
 * Preview source. Reads the bundled fixture, never Meta and never
 * creative_kill_reviews (that migration is not applied).
 *
 * account_id wins over the Meta act and the client name, both for which
 * account the row belongs to and for the hidden-account check. The internal
 * ad account is dropped by its Meta id on the row and on the linked account.
 */
export function loadKillReviews(args: {
  runDate: string;
  hiddenAccounts: string[];
  accounts: KillReviewAccount[];
  rows?: readonly KillReviewInput[];
}): CreativeKillReviewRow[] {
  const hidden = new Set(args.hiddenAccounts.map(norm));
  const byId = new Map(args.accounts.map((account) => [account.id, account]));
  const byAct = new Map<string, KillReviewAccount>();
  const byName = new Map<string, KillReviewAccount>();
  for (const account of args.accounts) {
    byName.set(norm(account.account_name), account);
    if (account.fb_ad_account_id) {
      for (const key of actKeys(account.fb_ad_account_id)) byAct.set(key, account);
    }
  }

  const source = args.rows ?? KILL_REVIEW_FIXTURE;
  return source.filter((row) => row.run_date === args.runDate).flatMap((raw) => {
    const row = normalizeKillReviewRow(raw);
    if (!inKillReviewScope(row)) return [];

    const linked = row.account_id ? byId.get(row.account_id) : undefined;
    const byActMatch = actKeys(row.act).map((key) => byAct.get(key)).find(Boolean);
    const byNameMatch = byName.get(norm(row.client_name));
    const account = linked ?? byActMatch ?? byNameMatch;
    if (isInternalAdAccount(account?.fb_ad_account_id)) return [];

    if (linked) {
      if (hidden.has(norm(linked.account_name))) return [];
      return [{ ...row, account_id: linked.id }];
    }

    const names = [row.client_name, account?.account_name].filter((name): name is string => !!name);
    if (names.some((name) => hidden.has(norm(name)))) return [];
    return [{ ...row, account_id: row.account_id ?? account?.id ?? null }];
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
