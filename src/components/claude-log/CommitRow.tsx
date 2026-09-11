import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ChevronRight, ExternalLink, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { repoShortName, type LogCommit } from "./useClaudeLog";

const MATCHED_BY: Record<string, string> = {
  repo: "whole repo belongs to this client",
  path: "touched this client's folder",
  keyword: "client named in the subject",
};
const MAX_FILES = 12;

export function CommitRow({
  commit,
  accountName,
}: {
  commit: LogCommit;
  accountName: (id: string) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!commit.body || commit.files.length > 0;

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
            <p className="text-sm font-medium leading-snug text-foreground">{commit.subject}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{repoShortName(commit.repo)}</span>
              {commit.links.map((l) => {
                const name = accountName(l.account_id);
                return name ? (
                  <Tooltip key={l.account_id}>
                    <TooltipTrigger asChild>
                      <Link
                        to={`/account/${encodeURIComponent(name)}`}
                        className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {name}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Linked: {MATCHED_BY[l.matched_by] ?? l.matched_by}</TooltipContent>
                  </Tooltip>
                ) : null;
              })}
              {commit.claude_coauthored && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" aria-hidden /> Claude
                </span>
              )}
              {(commit.additions != null || commit.deletions != null) && (
                <span className="tabular-nums">
                  +{formatCount(commit.additions ?? 0)} −{formatCount(commit.deletions ?? 0)}
                </span>
              )}
            </div>
          </div>

          <time
            dateTime={commit.committed_at}
            className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground"
            title={format(new Date(commit.committed_at), "PPpp")}
          >
            {format(new Date(commit.committed_at), "h:mm a")}
          </time>
        </div>

        <CollapsibleContent>
          <div className="space-y-3 pb-4 pl-11 pr-4 sm:pr-5">
            {commit.body && (
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{commit.body}</p>
            )}
            {commit.files.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {commit.files.length} file{commit.files.length === 1 ? "" : "s"} changed
                </p>
                <ul className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  {commit.files.slice(0, MAX_FILES).map((f) => (
                    <li key={f} className="truncate">{f}</li>
                  ))}
                  {commit.files.length > MAX_FILES && <li>…and {commit.files.length - MAX_FILES} more</li>}
                </ul>
              </div>
            )}
            {commit.html_url && (
              <a
                href={commit.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <span className="font-mono">{commit.sha.slice(0, 7)}</span> on GitHub <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}
