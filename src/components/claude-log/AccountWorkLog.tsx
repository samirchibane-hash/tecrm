import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, GitCommitHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { repoShortName, useClaudeLog } from "./useClaudeLog";

const SHOWN = 5;

/** A client's slice of the Claude Log, for the account page. */
export function AccountWorkLog({ accountId }: { accountId: string }) {
  const { data: commits = [], isLoading, isError } = useClaudeLog(accountId || undefined);
  const logHref = `/claude-log?client=${accountId}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <GitCommitHorizontal className="h-4 w-4 text-muted-foreground" />
            Recent work
            {commits.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {commits.length}
              </span>
            )}
          </CardTitle>
          {commits.length > 0 && (
            <Link
              to={logHref}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Claude Log <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !accountId ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        ) : isError ? (
          <p className="text-xs text-danger">Couldn't load linked commits.</p>
        ) : commits.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No commits linked to this client since Sep 1. Links come from the rules in{" "}
            <Link to="/settings/integrations" className="underline underline-offset-2 hover:text-foreground">
              Settings → Integrations
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {commits.slice(0, SHOWN).map((c) => (
              <li key={`${c.repo}@${c.sha}`} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground" title={c.subject}>{c.subject}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{repoShortName(c.repo)}</p>
                </div>
                <time dateTime={c.committed_at} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {format(new Date(c.committed_at), "MMM d")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
