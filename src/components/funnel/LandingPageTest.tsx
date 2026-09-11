import { ExternalLink, FlaskConical } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill, type Status } from "@/components/StatusPill";
import { Dash } from "@/components/creative-performance/CreativeBits";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCount, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MIN_PAGE_VIEWS, type PageStatus, type PageTest } from "./funnelMath";

const STATUS: Record<PageStatus, { status: Status; label: string; help: string }> = {
  winner: { status: "success", label: "Winner", help: "Converts better than every other page, at 95% confidence" },
  leading: { status: "info", label: "Leading", help: "Highest conversion rate, but not yet significantly ahead of every page" },
  only_page: { status: "neutral", label: "Only page", help: "The only page getting traffic: nothing to compare against" },
  undecided: { status: "neutral", label: "Too close to call", help: "Not significantly different from the leader yet" },
  behind: { status: "danger", label: "Behind", help: "Converts worse than the leader, at 95% confidence" },
  needs_traffic: { status: "neutral", label: "Needs traffic", help: `Fewer than ${MIN_PAGE_VIEWS} page views: too few to test` },
  unreliable: { status: "warning", label: "Check tracking", help: "More leads than page views: Meta is undercounting views here, so no rate is shown" },
  no_traffic: { status: "neutral", label: "No ad traffic", help: "Live in the funnel, but no ad in this period sent people here" },
};

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

/** A rate with its 95% interval on a scale shared by every row, so overlap is visible at a glance. */
function RateInterval({ page, scaleMax }: { page: PageTest; scaleMax: number }) {
  if (page.cvr === null || !page.interval) return <Dash title={STATUS[page.status].help} />;
  const x = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const label = `${pct(page.cvr)}, 95% range ${pct(page.interval.low)}–${pct(page.interval.high)}`;
  return (
    <div className="min-w-[120px]" title={label}>
      <p className="text-right text-sm tabular-nums text-foreground">{pct(page.cvr)}</p>
      <div className="relative mt-1 h-2 w-full rounded-full bg-muted" role="img" aria-label={label}>
        <div
          className="absolute top-0 h-full rounded-full opacity-35"
          style={{ left: x(page.interval.low), width: `calc(${x(page.interval.high)} - ${x(page.interval.low)})`, background: "hsl(var(--chart-1))" }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
          style={{ left: x(page.cvr), background: "hsl(var(--chart-1))" }}
        />
      </div>
    </div>
  );
}

function headline(pages: PageTest[]): string {
  const live = pages.filter((p) => p.status !== "no_traffic");
  const idle = pages.filter((p) => p.status === "no_traffic");
  const winner = pages.find((p) => p.status === "winner");
  const leader = pages.find((p) => p.status === "leading");
  const undecided = pages.filter((p) => p.status === "undecided");

  if (live.length === 0) return "No website ad sent traffic to a landing page in this period.";
  if (winner) {
    const runnerUp = live.find((p) => p !== winner && p.cvr !== null);
    return `${winner.label} wins: ${pct(winner.cvr!)} of visitors become leads${runnerUp ? ` vs ${pct(runnerUp.cvr!)} on ${runnerUp.label}` : ""}. Shift the ads on losing pages to it, then test a new challenger.`;
  }
  if (live.length === 1) {
    const only = live[0];
    return idle.length > 0
      ? `No split test is running: every website ad sends traffic to ${only.label}. ${idle.map((p) => p.label).join(", ")} ${idle.length === 1 ? "is" : "are"} live with no ads pointing at ${idle.length === 1 ? "it" : "them"}.`
      : `One landing page gets all website traffic (${only.label}). Build a variant with a different angle, offer or headline to start a test.`;
  }
  if (leader && undecided.length > 0) {
    const need = Math.max(...undecided.map((p) => p.viewsNeeded ?? 0));
    return `${leader.label} leads, but it's too close to call${need > 0 ? `: roughly ${formatCount(need)} more views per page before a difference this size is certain` : ""}.`;
  }
  if (leader) return `${leader.label} leads, and every other page with enough traffic is significantly behind it.`;
  return `No page has the ${MIN_PAGE_VIEWS}+ page views a fair comparison needs yet.`;
}

export function LandingPageTest({ pages, appointmentsTracked }: { pages: PageTest[]; appointmentsTracked: boolean }) {
  const isMobile = useIsMobile();
  const scaleMax = Math.max(0.05, ...pages.map((p) => p.interval?.high ?? 0));

  const pageCell = (p: PageTest) => (
    <div className="min-w-0">
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1 rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{p.label}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      </a>
      {p.title && <p className="truncate text-xs text-muted-foreground" title={p.title}>{p.title}</p>}
      <p className="truncate text-[11px] text-muted-foreground" title={p.adsets.join(", ")}>
        {p.adCount > 0 ? `${p.adCount} ${p.adCount === 1 ? "ad" : "ads"} · ${p.adsets.length} ad ${p.adsets.length === 1 ? "set" : "sets"}` : "No ads"}
      </p>
    </div>
  );
  const pill = (p: PageTest) => (
    <span title={STATUS[p.status].help}>
      <StatusPill status={STATUS[p.status].status}>{STATUS[p.status].label}</StatusPill>
    </span>
  );

  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm" aria-labelledby="lp-test-heading">
      <div>
        <h3 id="lp-test-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden />
          Landing page split test
        </h3>
        <p className="mt-1 text-sm text-foreground/90">{headline(pages)}</p>
      </div>

      {pages.length === 0 ? null : isMobile ? (
        <ul className="divide-y divide-border/60 rounded-md border border-border/50">
          {pages.map((p) => (
            <li key={p.key} className="space-y-2 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">{pageCell(p)}{pill(p)}</div>
              {p.status !== "no_traffic" && (
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-muted-foreground">Page views</dt><dd className="font-medium tabular-nums text-foreground">{formatCount(p.lpv)}</dd></div>
                  <div><dt className="text-muted-foreground">Leads</dt><dd className="font-medium tabular-nums text-foreground">{formatCount(p.leads)}</dd></div>
                  <div><dt className="text-muted-foreground">Cost / lead</dt><dd className="font-medium tabular-nums text-foreground">{p.costPerLead !== null ? formatUsd(p.costPerLead) : "—"}</dd></div>
                  <div className="col-span-3"><dt className="text-muted-foreground">Conversion</dt><dd><RateInterval page={p} scaleMax={scaleMax} /></dd></div>
                </dl>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-auto rounded-md border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Page</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right" title="Landing page views ÷ link clicks: people who waited for the page to load">Load rate</TableHead>
                <TableHead className="text-right">Page views</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="w-[180px] text-right" title="Website leads ÷ page views, with its 95% range">Conversion · 95% range</TableHead>
                <TableHead className="text-right">Cost / lead</TableHead>
                {appointmentsTracked && <TableHead className="text-right" title="Appointments ÷ leads">Booked</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p.key} className={cn(p.status === "no_traffic" && "text-muted-foreground")}>
                  <TableCell className="min-w-[200px] max-w-[300px] py-2">{pageCell(p)}</TableCell>
                  <TableCell className="py-2">{pill(p)}</TableCell>
                  {p.status === "no_traffic" ? (
                    <TableCell colSpan={appointmentsTracked ? 7 : 6} className="py-2 text-xs">
                      Live, but no ad sent traffic here in this period
                    </TableCell>
                  ) : (
                    <>
                      <TableCell className="py-2 text-right tabular-nums">{formatUsd(p.spend)}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{p.loadRate !== null ? `${Math.round(p.loadRate * 100)}%` : <Dash title="No link clicks" />}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{formatCount(p.lpv)}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{formatCount(p.leads)}</TableCell>
                      <TableCell className="py-2"><RateInterval page={p} scaleMax={scaleMax} /></TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{p.costPerLead !== null ? formatUsd(p.costPerLead, { decimals: true }) : <Dash title="No leads" />}</TableCell>
                      {appointmentsTracked && (
                        <TableCell className="py-2 text-right tabular-nums">{p.bookingRate !== null ? `${Math.round(p.bookingRate * 100)}%` : <Dash title="No leads to book" />}</TableCell>
                      )}
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Conversion is website leads ÷ landing page views, both from Meta, for the ads pointing at each page. The bar is the
        95% range the true rate likely sits in: when two pages' ranges overlap heavily, the test isn't decided. Pages are
        fed by different ads and audiences, not a random split, so for a clean test point one ad set at both pages.
      </p>
    </section>
  );
}
