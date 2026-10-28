import { useMemo, useState } from "react";
import { ChevronRight, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dash } from "@/components/creative-performance/CreativeBits";
import { MIN_GROUP_VIEWS } from "@/components/funnel/portfolioFunnel";
import type { FunnelRow } from "./funnelRows";
import { FunnelPageCard } from "./FunnelPageCard";
import { buildTemplateBoard, type TemplateGroup } from "./templateRows";
import { useFunnelTemplates } from "./useFunnelsData";

const POOLED =
  "Attributed leads ÷ page views across this template's measured pages. It pools different markets and offers, so read it as a lead for the next test, not a verdict.";

/** A labelled figure, the same shape as the page cards' so both tabs read alike. */
function Stat({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="min-w-0 text-right" title={title}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/** The template's section order drawn as a tiny page: hero on top, CTA blocks in the accent. */
function TemplateWireframe({ sections }: { sections: string[] }) {
  const order = sections.join(" → ");
  return (
    <div
      className="flex w-10 shrink-0 flex-col gap-[3px] rounded-md border border-border bg-background p-1"
      title={order}
    >
      <span className="sr-only">Sections: {order}</span>
      {sections.map((s, i) => (
        <span
          key={`${s}-${i}`}
          aria-hidden
          className={cn(
            "block rounded-[2px]",
            s === "hero" ? "h-4 bg-primary/25" : /cta/.test(s) ? "h-1.5 bg-primary/50" : "h-1.5 bg-muted-foreground/20",
          )}
        />
      ))}
    </div>
  );
}

/** A client on a template: a dot that carries the status, plus the word for it. */
function ClientChip({ name, status }: { name: string; status: "live" | "built" }) {
  return (
    <span
      className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] text-foreground"
      title={status === "live" ? `${name}: live, had ad traffic in this period` : `${name}: built, no ad traffic in this period`}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status === "live" ? "bg-success" : "bg-muted-foreground/40")} />
      <span className="truncate">{name}</span>
      <span className="sr-only">{status === "live" ? "(live)" : "(built)"}</span>
    </span>
  );
}

function TemplateCard({
  group,
  scoped,
  defaultOpen,
  periodCaption,
  averages,
}: {
  group: TemplateGroup;
  scoped: boolean;
  defaultOpen: boolean;
  periodCaption: string;
  averages: { cvr: number | null; bookedRate: number | null };
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { template } = group;
  const panelId = `template-${template.key}`;
  const used = group.clients.length > 0;

  const conv =
    group.cvr !== null ? (
      `${(group.cvr * 100).toFixed(1)}%`
    ) : (
      <Dash
        title={
          group.views > 0
            ? `Needs traffic: ${formatCount(group.views)} measured views, the pooled rate shows from ${MIN_GROUP_VIEWS}`
            : "No measured traffic on this template in this period"
        }
      />
    );

  return (
    <article className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")}
          aria-hidden
        />
        <TemplateWireframe sections={template.sections} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold text-foreground">{template.name}</span>
            {template.status === "legacy" && <StatusPill status="neutral">Legacy</StatusPill>}
            {scoped && (
              group.liveClients > 0
                ? <StatusPill status="success">Live</StatusPill>
                : used ? <StatusPill status="neutral">Built, no traffic</StatusPill> : <StatusPill status="neutral">Not built</StatusPill>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
          {/* Phones get the coverage as one line instead of the grid. */}
          <p className="mt-1 text-xs tabular-nums text-muted-foreground md:hidden">
            {scoped
              ? `${group.pages} ${group.pages === 1 ? "page" : "pages"} · ${group.runningTests} ${group.runningTests === 1 ? "test" : "tests"} running`
              : `${group.liveClients} live · ${group.builtClients} built · ${group.runningTests} ${group.runningTests === 1 ? "test" : "tests"} running`}
          </p>
          {!scoped && used && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.clients.map((c) => <ClientChip key={c.accountName} name={c.accountName} status={c.status} />)}
            </div>
          )}
        </div>

        <dl className="hidden shrink-0 grid-cols-4 gap-4 md:grid" style={{ minWidth: 300 }}>
          {scoped ? (
            <Stat label="Pages" value={formatCount(group.pages)} />
          ) : (
            <Stat label="Live" value={formatCount(group.liveClients)} title="Clients with a page on this template that had ad traffic in this period" />
          )}
          {scoped ? (
            <Stat label="Live" value={formatCount(group.clients[0]?.pages.filter((p) => p.perf).length ?? 0)} title="Pages with ad traffic in this period" />
          ) : (
            <Stat label="Built" value={formatCount(group.builtClients)} title="Clients with a page on this template and no ad traffic in this period" />
          )}
          <Stat label="Tests" value={formatCount(group.runningTests)} title="Split tests running on this template's pages" />
          <Stat label="Conv." value={conv} title={group.cvr !== null ? `${POOLED} ${formatCount(group.leads)} leads ÷ ${formatCount(group.views)} views, ${group.measuredPages} ${group.measuredPages === 1 ? "page" : "pages"}.` : undefined} />
        </dl>
      </button>

      {open && (
        <div id={panelId} className="space-y-4 border-t border-border/60 bg-muted/20 px-4 py-3">
          {!used && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              {scoped ? "This client has no page on this template." : "No client has a page on this template."}
            </p>
          )}

          {group.clients.map((client) => (
            <section key={client.accountName} aria-label={`${client.accountName} on ${template.name}`} className="space-y-2">
              {!scoped && (
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs font-semibold text-foreground">{client.accountName}</h4>
                  <StatusPill status={client.status === "live" ? "success" : "neutral"}>{client.status === "live" ? "Live" : "Built"}</StatusPill>
                  {client.runningTests > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <FlaskConical className="h-3 w-3" aria-hidden />
                      {client.runningTests} {client.runningTests === 1 ? "test" : "tests"} running
                    </span>
                  )}
                </div>
              )}
              {client.pages.map((row: FunnelRow) => (
                <FunnelPageCard
                  key={row.key}
                  row={row}
                  showAccount={false}
                  periodCaption={periodCaption}
                  averages={averages}
                  previewTest
                />
              ))}
            </section>
          ))}

          {!scoped && group.notBuilt.length > 0 && (
            <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs">
              <p className="font-medium text-foreground">Not built yet for {group.notBuilt.length} {group.notBuilt.length === 1 ? "client" : "clients"}</p>
              <p className="mt-0.5 text-muted-foreground">{group.notBuilt.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * The Templates tab of the Funnels board: every landing-page template, which
 * clients run it (live = ad traffic this period, built = idle), and each
 * client's pages on it with their split-test variations.
 *
 * It groups the board's own rows, so every number matches the Pages tab. With
 * `scoped` (a client's account page) it shows that client's coverage only.
 */
export function TemplatesBoard({
  rows,
  scoped,
  periodCaption,
  averages,
}: {
  rows: FunnelRow[];
  scoped: boolean;
  periodCaption: string;
  averages: { cvr: number | null; bookedRate: number | null };
}) {
  const { data: templates, isLoading, isError, refetch, isFetching } = useFunnelTemplates();
  const board = useMemo(
    () => buildTemplateBoard(rows, templates ?? [], { minViews: MIN_GROUP_VIEWS }),
    [rows, templates],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border px-4 py-6 text-center text-sm">
        <p className="font-medium text-foreground">Couldn&rsquo;t load the template catalogue.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()} disabled={isFetching}>Try again</Button>
      </div>
    );
  }

  if (!templates?.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No templates in the catalogue yet. Add one to <code className="font-mono">funnel_templates</code> and the hourly sync will match pages to it.
      </p>
    );
  }

  const pages = rows.filter((r) => !r.armOf);
  const unsynced = pages.length > 0 && pages.every((r) => r.templateKey === null);
  // Open the template carrying the most live clients, so the tab lands on something.
  const firstOpen = [...board.groups].sort((a, b) => b.liveClients - a.liveClients || b.pages - a.pages)[0]?.template.key;

  return (
    <div className="space-y-2">
      {unsynced && (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Pages haven&rsquo;t been matched to a template yet. The hourly GitHub sync reads each page&rsquo;s sections and tags it on its next run.
        </p>
      )}
      {board.groups.map((g: TemplateGroup) => (
        <TemplateCard
          key={g.template.key}
          group={g}
          scoped={scoped}
          defaultOpen={g.template.key === firstOpen && g.clients.length > 0}
          periodCaption={periodCaption}
          averages={averages}
        />
      ))}
      {!unsynced && board.unmatched.length > 0 && (
        <p className="pt-1 text-xs text-muted-foreground">
          {board.unmatched.length} {board.unmatched.length === 1 ? "page doesn't" : "pages don't"} match a template:{" "}
          {board.unmatched.map((r) => (scoped ? r.label : `${r.accountName} ${r.label}`)).join(", ")}. A new layout needs its own row in{" "}
          <code className="font-mono">funnel_templates</code> and a rule in the sync.
        </p>
      )}
    </div>
  );
}

