import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { GradedValue } from "@/components/dashboard/CostVsTarget";
import { costStatus, rateStatus } from "@/components/dashboard/portfolioBenchmark";
import { formatCount, formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreativeName, CreativeThumbnail, Dash } from "./CreativeBits";
import { deliveryStatusText } from "./adStatus";
import { BODY_FOLD, COPY_NOUN, HEADLINE_FOLD, splitAtFold, type CopyRow } from "./copyRows";
import type { Benchmark } from "./verdicts";

/** The portfolio's own figures on one lead source: what each line of copy is graded against. */
export type CopyBars = { cpl: Benchmark | null; linkCtr: number | null; clickToLead: number | null };

const vsAvg = (value: string, avg: string) => `${value} vs ${avg} portfolio avg`;

function Metric({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div title={title}>
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/**
 * The words, shown the way the feed shows them: what a homeowner reads before
 * the headline truncates (~40 characters) or the primary text folds behind
 * "See more" (~125) is full contrast, the rest is quieter.
 */
function CopyText({ row }: { row: CopyRow }) {
  const [open, setOpen] = useState(false);
  if (row.catchAll) return <p className="text-sm italic text-muted-foreground">{row.text}</p>;

  if (row.kind === "headline") {
    const { shown, hidden } = splitAtFold(row.text, HEADLINE_FOLD);
    return (
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-snug text-foreground">
          {shown}
          {hidden && <span className="text-muted-foreground">{hidden}</span>}
        </p>
        {hidden && (
          <p className="mt-0.5 text-[11px] text-warning" title={`Headlines over ${HEADLINE_FOLD} characters cut off in the feed`}>
            {row.text.length} characters: may cut off in the feed
          </p>
        )}
      </div>
    );
  }

  // Line 1 is the hook: it has to stand alone before "See more", so it reads bold.
  const { shown, hidden } = splitAtFold(row.text, BODY_FOLD);
  const nl = shown.indexOf("\n");
  const hook = nl === -1 ? shown : shown.slice(0, nl);
  const rest = nl === -1 ? "" : shown.slice(nl);
  const long = row.text.length > 220 || row.text.split("\n").length > 4;
  return (
    <div className="min-w-0">
      <p className={cn("whitespace-pre-line text-sm leading-relaxed text-foreground", !open && long && "line-clamp-4")}>
        <span className="font-semibold">{hook}</span>
        {rest}
        {hidden && <span className="text-muted-foreground">{hidden}</span>}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? "Show less" : "Show full text"}
        </button>
      )}
    </div>
  );
}

function CopyCard({
  row,
  rank,
  leadNoun,
  showAccount,
  bars,
}: {
  row: CopyRow;
  rank: number;
  leadNoun: string;
  showAccount: boolean;
  bars: CopyBars;
}) {
  const [adsOpen, setAdsOpen] = useState(false);
  const paused = row.live === 0;
  const cost = row.costPer !== null ? formatUsd(row.costPer, { decimals: true }) : null;
  return (
    <li
      className={cn(
        "flex flex-col gap-3 p-4 transition-[opacity,filter]",
        // Copy no live ad is running anymore dims like a paused ad, so what's
        // still on air stands out when scanning.
        paused && "bg-muted/40 opacity-60 hover:opacity-100 focus-within:opacity-100",
      )}
    >
      <div className="flex gap-3">
        <span className="w-5 shrink-0 pt-0.5 text-right text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden>
          {rank}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <CopyText row={row} />
              <p className="text-xs text-muted-foreground">
                {row.ads.length} {row.ads.length === 1 ? "ad" : "ads"}
                {paused ? " · none live" : row.live < row.ads.length ? ` · ${row.live} live` : " · live"}
                {showAccount && row.clients.length > 0 && (
                  <>
                    {" · "}
                    {row.clients.length > 2
                      ? `${row.clients.length} clients`
                      : row.clients.map((c, i) => (
                          <span key={c.id}>
                            {i > 0 && ", "}
                            <Link
                              to={`/account/${encodeURIComponent(c.name)}?tab=performance`}
                              className="rounded-sm font-medium text-foreground/80 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {c.name}
                            </Link>
                          </span>
                        ))}
                  </>
                )}
                {row.fromAssets && (
                  <span title="Part of these numbers comes from Meta's per-text breakdown of ads that rotate several texts">
                    {" · "}split by Meta
                  </span>
                )}
              </p>
            </div>
            <div className="w-full shrink-0 sm:w-36 sm:text-right">
              <p className="text-base font-semibold tabular-nums text-foreground">{formatUsd(row.spend, { decimals: true })}</p>
              <div
                className="mt-1 h-1 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${Math.round(row.share * 100)}% of spend`}
              >
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, row.share * 100)}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{Math.round(row.share * 100)}% of spend</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label={leadNoun} value={formatCount(row.results)} />
            <Metric
              label="Cost / lead"
              value={
                cost ? (
                  <GradedValue
                    text={cost}
                    status={bars.cpl ? costStatus(row.costPer!, bars.cpl.costPer) : null}
                    title={bars.cpl ? vsAvg(cost, formatUsd(bars.cpl.costPer, { decimals: true })) : undefined}
                  />
                ) : (
                  <Dash title="No leads in this period" />
                )
              }
            />
            {/* Always in its slot so the columns line up down the list; unknown reads as a dash, never 0. */}
            <Metric
              label="Appts"
              value={
                row.appointments !== null ? formatCount(row.appointments) : <Dash title="Not tracked: an account running this copy doesn't send Schedule events" />
              }
              title="Meta Schedule events credited to ads running this copy"
            />
            <Metric
              label="Link CTR"
              value={
                row.ctr !== null ? (
                  <GradedValue
                    text={formatPercent(row.ctr)}
                    status={rateStatus(row.ctr, bars.linkCtr)}
                    title={bars.linkCtr !== null ? vsAvg(formatPercent(row.ctr), formatPercent(bars.linkCtr)) : undefined}
                  />
                ) : (
                  <Dash title="No impressions" />
                )
              }
            />
            <Metric
              label="Click → lead"
              value={
                row.clickToLead !== null ? (
                  <GradedValue
                    text={formatPercent(row.clickToLead, 1)}
                    status={rateStatus(row.clickToLead, bars.clickToLead)}
                    title={`Leads ÷ link clicks: does the promise hold up past the click${
                      bars.clickToLead !== null ? ` · ${vsAvg(formatPercent(row.clickToLead, 1), formatPercent(bars.clickToLead, 1))}` : ""
                    }`}
                  />
                ) : (
                  <Dash title="No link clicks" />
                )
              }
            />
          </dl>

          {row.ads.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setAdsOpen((o) => !o)}
                aria-expanded={adsOpen}
                className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", adsOpen && "rotate-180")} aria-hidden />
                {adsOpen ? "Hide" : "Show"} the {row.ads.length === 1 ? "ad" : `${row.ads.length} ads`} running this {COPY_NOUN[row.kind].one}
              </button>
              {adsOpen && (
                <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border/60">
                  {row.ads.map(({ ad, accountId, accountName }) => (
                    <li key={`${accountId}-${ad.id}`} className="flex items-center gap-3 px-3 py-2">
                      <CreativeThumbnail ad={ad} size="sm" />
                      <div className="min-w-0 flex-1 text-sm">
                        <CreativeName
                          ad={ad}
                          sub={
                            <>
                              {showAccount && <>{accountName} · </>}
                              {ad.live ? (ad.format === "video" ? "Video" : "Image") : deliveryStatusText(ad.status)}
                              {ad.adset && <> · {ad.adset}</>}
                            </>
                          }
                        />
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums">
                        <p className="font-medium text-foreground">{formatUsd(ad.spend, { decimals: true })}</p>
                        <p className="text-muted-foreground">
                          {formatCount(ad.leadChannel === "form" ? ad.formLeads : ad.webLeads)} leads
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** Every headline or primary text in the period, one row per distinct line of copy. */
export function CopyList({
  rows,
  leadNoun,
  showAccount,
  bars,
}: {
  rows: CopyRow[];
  leadNoun: string;
  showAccount: boolean;
  bars: CopyBars;
}) {
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
      {rows.map((r, i) => (
        <CopyCard key={r.key} row={r} rank={i + 1} leadNoun={leadNoun} showAccount={showAccount} bars={bars} />
      ))}
    </ul>
  );
}
