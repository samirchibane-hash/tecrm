import { useState } from "react";
import { format } from "date-fns";
import { ChevronRight, ExternalLink, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WorkEventTags } from "./WorkEventTags";
import type { WorkEvent } from "./workStream";

const MAX_FILES = 12;

export function CommitRow({
  event,
  accountName,
}: {
  event: WorkEvent;
  accountName: (id: string) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!event.detail || event.files.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <li className="group">
        <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
          <CollapsibleTrigger
            disabled={!hasDetail}
            className="mt-0.5 shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-0"
            aria-label={open ? "Hide summary" : "Show summary"}
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          </CollapsibleTrigger>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-foreground">{event.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <WorkEventTags event={event} accountName={accountName} linkClients />
              {event.claudeCoauthored && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" aria-hidden /> Claude
                </span>
              )}
              {event.source === "github" && (event.additions != null || event.deletions != null) && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  +{formatCount(event.additions ?? 0)} −{formatCount(event.deletions ?? 0)}
                </span>
              )}
            </div>
          </div>

          <time
            dateTime={event.occurredAt}
            className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground"
            title={format(new Date(event.occurredAt), "PPpp")}
          >
            {format(new Date(event.occurredAt), "h:mm a")}
          </time>
        </div>

        <CollapsibleContent>
          <div className="space-y-3 pb-4 pl-11 pr-4 sm:pr-5">
            {event.detail && (
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{event.detail}</p>
            )}
            {event.files.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {event.files.length} file{event.files.length === 1 ? "" : "s"} changed
                </p>
                <ul className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  {event.files.slice(0, MAX_FILES).map((f) => (
                    <li key={f} className="truncate">{f}</li>
                  ))}
                  {event.files.length > MAX_FILES && <li>…and {event.files.length - MAX_FILES} more</li>}
                </ul>
              </div>
            )}
            {event.href && event.sha && (
              <a
                href={event.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <span className="font-mono">{event.sha.slice(0, 7)}</span> on GitHub <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}
