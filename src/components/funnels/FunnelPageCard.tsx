import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ExternalLink, History, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount, formatUsd } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RateVsAverage } from "@/components/dashboard/CostVsTarget";
import { rateStatus } from "@/components/dashboard/portfolioBenchmark";
import { StatusPill } from "@/components/StatusPill";
import { Dash } from "@/components/creative-performance/CreativeBits";
import type { FunnelRow } from "./funnelRows";
import { SplitTestPanel } from "./SplitTestPanel";
import { AdsSheet, HistorySheet } from "./FunnelSheets";
import { ATTRIBUTED, historyEvents, shortDate, verdictLine } from "./funnelDisplay";

const NOT_TRACKED =
  "Not tracked: this client's GHL sub-account hasn't sent an attributed lead, so its lead count is unknown rather than zero. Map the lp_page and lp_variant contact custom fields to start counting.";
const BOOKED =
  "Water tests booked in GoHighLevel by this page's attributed leads. Leads from the last few days may still book.";
const NO_TRAFFIC = "No ad traffic in this period";

/** A labelled figure. Kept tiny so a row of them reads as one line of facts. */
function Stat({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="min-w-0 text-right" title={title}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/**
 * One landing page. Collapsed it is a single scannable line, the funnel left to
 * right: spend → views → leads → appointments. Expanded it shows only what is
 * being decided right now, the running split test; the ads feeding the page and
 * everything it used to say open in side sheets, so the list stays a list.
 *
 * `showAccount` is off on a client's own page, where every card is that client.
 */
export function FunnelPageCard({
  row,
  showAccount = true,
  periodCaption,
  averages,
}: {
  row: FunnelRow;
  showAccount?: boolean;
  periodCaption?: string;
  /** Portfolio averages the rates are coloured against (the board's measured pages). */
  averages?: { cvr: number | null; bookedRate: number | null };
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<"ads" | "history" | null>(null);
  const perf = row.perf;
  const panelId = `funnel-${row.key.replace(/[^a-z0-9]+/gi, "-")}`;
  const unmeasured = perf ? NOT_TRACKED : NO_TRAFFIC;
  const historyCount = historyEvents(row).length;
  const lastTest = row.pastTests[0] ?? null;

  const leads = row.verifiedLeads === null ? <Dash title={unmeasured} /> : formatCount(row.verifiedLeads);
  const appts = row.verifiedBooked === null ? <Dash title={unmeasured} /> : formatCount(row.verifiedBooked);

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

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* The client is the title across the portfolio; on a client's own page every
                card is that client, so the page name leads there instead. */}
            <span className="truncate text-sm font-semibold text-foreground">{showAccount ? row.accountName : row.label}</span>
            {showAccount && <span className="truncate text-xs text-muted-foreground">{row.label}</span>}
            {row.runningTest && (() => {
              const v = verdictLine(row.runningTest);
              return v.signal ? <span title={v.detail}><StatusPill status={v.tone}>{v.short}</StatusPill></span> : null;
            })()}
            {!perf && <StatusPill status="neutral">No ad traffic</StatusPill>}
          </div>
          {/* Phones get the two numbers that matter as one line instead of the grid. */}
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground md:hidden">
            {perf ? formatUsd(perf.spend) : "No spend"} · {leads} leads · {appts} appts
          </p>
        </div>

        <dl className="hidden shrink-0 grid-cols-6 gap-4 md:grid" style={{ minWidth: 456 }}>
          <Stat label="Spend" value={perf ? formatUsd(perf.spend) : <Dash title={NO_TRAFFIC} />} />
          <Stat label="Views" value={perf ? formatCount(perf.lpv) : <Dash title={NO_TRAFFIC} />} />
          <Stat label="Leads" value={leads} title={row.verifiedLeads === null ? undefined : ATTRIBUTED} />
          <Stat
            label="Conv."
            value={
              row.verifiedCvr != null
                ? <RateVsAverage value={row.verifiedCvr} average={averages?.cvr ?? null} status={rateStatus(row.verifiedCvr, averages?.cvr ?? null)} label="Conversion" />
                : <Dash title="No conversion rate for this period" />
            }
          />
          <Stat label="Appts" value={appts} title={row.verifiedBooked === null ? undefined : BOOKED} />
          <Stat
            label="Lead → appt"
            value={
              row.bookedRate !== null
                ? <RateVsAverage value={row.bookedRate} average={averages?.bookedRate ?? null} status={rateStatus(row.bookedRate, averages?.bookedRate ?? null)} label="Lead → appt" />
                : <Dash title="No leads to book yet" />
            }
          />
        </dl>
      </button>

      {open && (
        <div id={panelId} className="space-y-3 border-t border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{row.url.replace(/^https?:\/\//, "")}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            </a>
            {showAccount && (
              <Link
                to={`/account/${encodeURIComponent(row.accountName)}?tab=performance`}
                className="rounded-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open client
              </Link>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setSheet("ads")}>
                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                Ads driving traffic
                <span className="tabular-nums text-muted-foreground">{row.ads.length}</span>
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setSheet("history")}>
                <History className="h-3.5 w-3.5" aria-hidden />
                Funnel history
                <span className="tabular-nums text-muted-foreground">{historyCount}</span>
              </Button>
            </div>
          </div>

          {row.runningTest ? (
            <SplitTestPanel test={row.runningTest} />
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">No split test running on this page.</p>
              <p className="mt-1">
                {perf ? "It has ad spend, so it should be testing something. " : ""}
                {lastTest
                  ? <>Last test ended {lastTest.stoppedAt ? shortDate(lastTest.stoppedAt) : "—"}; it&rsquo;s in Funnel history.</>
                  : "No test has run here yet."}
              </p>
            </div>
          )}
        </div>
      )}

      <AdsSheet row={row} open={sheet === "ads"} onOpenChange={(o) => setSheet(o ? "ads" : null)} periodCaption={periodCaption} />
      <HistorySheet row={row} open={sheet === "history"} onOpenChange={(o) => setSheet(o ? "history" : null)} />
    </article>
  );
}
