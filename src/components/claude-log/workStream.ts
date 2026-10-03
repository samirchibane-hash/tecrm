/**
 * One work stream for Recent work and /claude-log.
 *
 * A pushed commit is a finished Claude Log item, so those two sources are one
 * `github` event — not two rows. Ops outcomes are `ops` plus an `outcome`.
 * The database view `client_work_events` is the same shape; these helpers
 * slice and label it.
 */

export const WORK_SOURCES = ["github", "ops"] as const;
export type WorkSource = (typeof WORK_SOURCES)[number];

export const OPS_OUTCOMES = [
  "client_email_sent",
  "ghl_update",
  "a2p_filed",
  "campaign_live",
  "checklist_stage",
] as const;
export type OpsOutcome = (typeof OPS_OUTCOMES)[number];

export const SOURCE_LABEL: Record<WorkSource, string> = {
  github: "GitHub",
  ops: "Ops",
};

export const OUTCOME_LABEL: Record<OpsOutcome, string> = {
  client_email_sent: "Email sent",
  ghl_update: "GHL update",
  a2p_filed: "A2P filed",
  campaign_live: "Campaign live",
  checklist_stage: "Checklist",
};

export type WorkEvent = {
  id: string;
  occurredAt: string;
  source: WorkSource;
  /** Clients this event belongs to. Empty means agency work, no client. */
  accountIds: string[];
  /** How each client was linked. matchedBy is null for ops outcomes. */
  links: { accountId: string; matchedBy: string | null }[];
  /** Person who closed the work. Never invented from a co-author trailer. */
  writer: string | null;
  title: string;
  detail: string | null;
  /** Set only when source is ops. */
  outcome: OpsOutcome | null;
  href: string | null;
  repo: string | null;
  sha: string | null;
  claudeCoauthored: boolean;
  files: string[];
  additions: number | null;
  deletions: number | null;
};

/** Row of public.client_work_events. */
export type WorkEventRow = {
  id: string | null;
  occurred_at: string | null;
  source: string | null;
  writer: string | null;
  title: string | null;
  detail: string | null;
  outcome: string | null;
  href: string | null;
  account_ids: string[] | null;
  links?: unknown;
  repo: string | null;
  sha: string | null;
  claude_coauthored: boolean | null;
  files: string[] | null;
  additions: number | null;
  deletions: number | null;
};

function parseLinks(value: unknown): { accountId: string; matchedBy: string | null }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((link) => {
    if (!link || typeof link !== "object") return [];
    const record = link as { account_id?: unknown; matched_by?: unknown };
    if (typeof record.account_id !== "string" || !record.account_id) return [];
    return [{
      accountId: record.account_id,
      matchedBy: typeof record.matched_by === "string" ? record.matched_by : null,
    }];
  });
}

export function isOpsOutcome(value: string | null | undefined): value is OpsOutcome {
  return !!value && (OPS_OUTCOMES as readonly string[]).includes(value);
}

export function sourceLabel(source: WorkSource): string {
  return SOURCE_LABEL[source];
}

export function outcomeLabel(outcome: OpsOutcome): string {
  return OUTCOME_LABEL[outcome];
}

/**
 * Map one view row. Drops a row that isn't a github event or a known ops
 * outcome — an unknown value is not rendered as a finished event.
 * A Claude co-author flag does not become the writer.
 */
export function rowToWorkEvent(row: WorkEventRow): WorkEvent | null {
  if (!row.id || !row.occurred_at || !row.title) return null;
  if (row.source !== "github" && row.source !== "ops") return null;
  if (row.source === "ops" && !isOpsOutcome(row.outcome)) return null;

  const parsedLinks = parseLinks(row.links);
  const links = parsedLinks.length
    ? parsedLinks
    : (row.account_ids ?? []).map((accountId) => ({ accountId, matchedBy: null }));

  return {
    id: row.id,
    occurredAt: row.occurred_at,
    source: row.source,
    accountIds: row.account_ids ?? links.map((link) => link.accountId),
    links,
    writer: row.writer?.trim() || null,
    title: row.title,
    detail: row.detail,
    outcome: row.source === "ops" && isOpsOutcome(row.outcome) ? row.outcome : null,
    href: row.href,
    repo: row.repo,
    sha: row.sha,
    claudeCoauthored: row.source === "github" && !!row.claude_coauthored,
    files: row.files ?? [],
    additions: row.additions,
    deletions: row.deletions,
  };
}

/** Per-client slice. Agency events (no account) are not included. */
export function sliceForClient(events: WorkEvent[], accountId: string): WorkEvent[] {
  if (!accountId) return [];
  return events.filter((event) => event.accountIds.includes(accountId));
}

const ALL = "all";
const AGENCY = "agency";

/** Client, repo, and text filters for the company firehose. Preserves order. */
export function filterWorkEvents(
  events: WorkEvent[],
  filter: { client: string; repo: string; query: string },
): WorkEvent[] {
  const needle = filter.query.trim().toLowerCase();
  return events.filter((event) => {
    if (filter.repo !== ALL && event.repo !== filter.repo) return false;
    if (filter.client === AGENCY && event.accountIds.length > 0) return false;
    if (filter.client !== ALL && filter.client !== AGENCY && !event.accountIds.includes(filter.client)) return false;
    if (needle && !`${event.title}\n${event.detail ?? ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });
}
