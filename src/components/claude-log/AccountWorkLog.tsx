import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, GitCommitHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkStream } from "./useClaudeLog";
import { WorkEventTags } from "./WorkEventTags";

const SHOWN = 5;

/** A client's slice of the shared work stream, on the account Operations tab. */
export function AccountWorkLog({ accountId, accountName }: { accountId: string; accountName: string }) {
  const { data: events = [], isLoading, isError } = useWorkStream(accountId || undefined, { enabled: !!accountId });
  const logHref = `/claude-log?client=${accountId}`;
  const nameFor = (id: string) => (id === accountId ? accountName : undefined);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <GitCommitHorizontal className="h-4 w-4 text-muted-foreground" />
            Recent work
            {events.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {events.length}
              </span>
            )}
          </CardTitle>
          {events.length > 0 && (
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
          <p className="text-xs text-danger">Couldn't load recent work.</p>
        ) : events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No GitHub pushes or ops outcomes for this client since Sep 1. Commit links come from the rules in{" "}
            <Link to="/settings/integrations" className="underline underline-offset-2 hover:text-foreground">
              Settings → Integrations
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {events.slice(0, SHOWN).map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground" title={event.title}>{event.title}</p>
                  <div className="mt-1">
                    <WorkEventTags event={event} accountName={nameFor} />
                  </div>
                </div>
                <time dateTime={event.occurredAt} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {format(new Date(event.occurredAt), "MMM d")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
