import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SYNC_SOURCES, useRunSync, useSyncRuns, type SyncSource } from "./useSyncRuns";

/** "Synced 12 min ago" with failure surfaced, plus an optional Sync now button. */
export function SyncStatus({
  source,
  invalidate,
  showButton = true,
  className,
}: {
  source: SyncSource;
  invalidate?: string[][];
  showButton?: boolean;
  className?: string;
}) {
  const { label } = SYNC_SOURCES[source];
  const { data, isLoading, isError } = useSyncRuns(source);
  const sync = useRunSync(source, invalidate);

  const latest = data?.latest;
  const lastOk = data?.lastOk;
  const failed = latest?.ok === false;
  const running = latest && latest.finished_at === null && Date.now() - new Date(latest.started_at).getTime() < 10 * 60_000;
  const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true });

  let text: React.ReactNode;
  if (isLoading) text = "Checking sync…";
  else if (isError) text = "Sync status unavailable";
  else if (sync.isPending || running) text = `Syncing ${label}…`;
  else if (!lastOk && failed) text = `${label} never synced`;
  else if (!lastOk) text = `${label} not synced yet`;
  else if (failed) text = `Last sync failed · data from ${ago(lastOk.finished_at ?? lastOk.started_at)}`;
  else text = `${label} · synced ${ago(lastOk.finished_at ?? lastOk.started_at)}`;

  const Icon = sync.isPending || running ? Loader2 : failed || isError ? AlertTriangle : CheckCircle2;

  const status = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        failed || isError ? "text-danger" : "text-muted-foreground",
        className,
      )}
      role="status"
    >
      {!isLoading && (
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            (sync.isPending || running) && "animate-spin",
            !failed && !isError && !(sync.isPending || running) && lastOk && "text-success",
          )}
          aria-hidden
        />
      )}
      {text}
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {failed && latest?.error ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {status}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{latest.error}</TooltipContent>
        </Tooltip>
      ) : (
        status
      )}
      {showButton && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => sync.mutate()}
          disabled={sync.isPending || !!running}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")} />
          Sync now
        </Button>
      )}
    </div>
  );
}
