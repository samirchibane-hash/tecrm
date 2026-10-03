import { Link } from "react-router-dom";
import { StatusPill } from "@/components/StatusPill";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { repoShortName } from "./useClaudeLog";
import { outcomeLabel, sourceLabel, type WorkEvent } from "./workStream";

const MATCHED_BY: Record<string, string> = {
  repo: "whole repo belongs to this client",
  path: "touched this client's folder",
  keyword: "client named in the subject",
};

/**
 * Source and client on every work event. Words carry the meaning; the pills
 * are the shared neutral status style.
 */
export function WorkEventTags({
  event,
  accountName,
  linkClients = false,
}: {
  event: WorkEvent;
  accountName: (id: string) => string | undefined;
  linkClients?: boolean;
}) {
  const sourceLinks = event.links.length
    ? event.links
    : event.accountIds.map((accountId) => ({ accountId, matchedBy: null }));
  const clients = sourceLinks
    .map((link) => ({ ...link, name: accountName(link.accountId) }))
    .filter((link): link is { accountId: string; matchedBy: string | null; name: string } => !!link.name);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <StatusPill status="neutral">{sourceLabel(event.source)}</StatusPill>
      {event.outcome && <StatusPill status="neutral">{outcomeLabel(event.outcome)}</StatusPill>}
      {event.repo && (
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{repoShortName(event.repo)}</span>
      )}
      {clients.length === 0 && event.accountIds.length === 0 && <StatusPill status="neutral">Agency</StatusPill>}
      {clients.map((c) => {
        if (!linkClients) {
          return <StatusPill key={c.accountId} status="neutral">{c.name}</StatusPill>;
        }
        const link = (
          <Link
            to={`/account/${encodeURIComponent(c.name)}`}
            className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {c.name}
          </Link>
        );
        if (!c.matchedBy) return <span key={c.accountId} className="contents">{link}</span>;
        return (
          <Tooltip key={c.accountId}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent className="text-xs">Linked: {MATCHED_BY[c.matchedBy] ?? c.matchedBy}</TooltipContent>
          </Tooltip>
        );
      })}
      {event.writer && <span title="Closed by">{event.writer}</span>}
    </div>
  );
}
