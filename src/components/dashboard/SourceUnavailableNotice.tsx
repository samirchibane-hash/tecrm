import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shown when one upstream feed is down but the rest of the report is still live.
 * Names the feed and what is still trustworthy, so a partially-populated report
 * is never mistaken for a complete one (design rule #5).
 */
export function SourceUnavailableNotice({
  source,
  stillLive,
  message,
  onRetry,
  retrying = false,
  className,
}: {
  source: string;
  /** What's still trustworthy. Omit when the notice covers a whole self-contained panel. */
  stillLive?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <Alert className={cn("border-warning/40 bg-warning/10", className)}>
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-sm">{source} data unavailable</AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground">
        <span>
          {source}-sourced metrics below read “—” until the connection is restored.
          {stillLive && <> {stillLive} is unaffected and still live.</>}
        </span>
        {message && (
          <span className="mt-1 block break-words font-mono text-[11px] text-muted-foreground/80">
            {message}
          </span>
        )}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-7 gap-1.5 text-xs"
            onClick={onRetry}
            disabled={retrying}
          >
            <RefreshCw className={cn("h-3 w-3", retrying && "animate-spin")} />
            {retrying ? "Retrying…" : "Retry"}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
