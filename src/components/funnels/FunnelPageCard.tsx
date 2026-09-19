import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ExternalLink, FlaskConical, History, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount, formatUsd } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { Dash, VerdictPill } from "@/components/creative-performance/CreativeBits";
import { ANGLE_LABEL, OFFER_LABEL } from "@/components/creative-performance/labels";
import { MIN_ARM_VIEWS, type FunnelRow, type SplitArm, type SplitTest } from "./funnelRows";

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

const ATTRIBUTED =
  "GoHighLevel contacts carrying this page's lp_page and an lp_variant, from the ad's UTM parameters";
const NOT_TRACKED =
  "Not tracked: this client's GHL sub-account hasn't sent an attributed lead, so its lead count is unknown rather than zero. Map the lp_page and lp_variant contact custom fields to start counting.";
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const ARM_STATUS: Record<SplitArm["status"], { status: "success" | "danger" | "neutral"; label: string; help: string }> = {
  leader: { status: "success", label: "Ahead", help: "Converting best of the arms with enough traffic to compare" },
  behind: { status: "danger", label: "Behind", help: "Converting worse than the leading arm, at 95% confidence" },
  even: { status: "neutral", label: "Too close to call", help: "Not separated from the leading arm yet" },
  needs_traffic: { status: "neutral", label: "Needs traffic", help: `Under ${MIN_ARM_VIEWS} views on this arm: too few to read` },
};

/** A labelled figure. Kept tiny so a row of them reads as one line of facts. */
function Stat({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/**
 * A split test, arm by arm.
 *
 * Views come from the page's own beacon because Meta attributes a view to the
 * ad that sent it, not to the arm the visitor was shown, so it cannot split a
 * test. Leads are the attributed GoHighLevel contacts the rest of this screen
 * counts — one definition of a lead on the page, top to bottom.
 */
function SplitTestPanel({ test }: { test: SplitTest }) {
  return (
    <section className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <h4 className="text-xs font-semibold text-foreground">{test.name ?? "Split test"}</h4>
        <StatusPill status={test.running ? "info" : "neutral"}>{test.running ? "Running" : "Stopped"}</StatusPill>
        <span className="text-[11px] text-muted-foreground">
          {shortDate(test.startedAt)}
          {test.stoppedAt ? ` – ${shortDate(test.stoppedAt)}` : " – now"}
        </span>
        {test.winnerVariant && (
          <StatusPill status="success">Winner: {test.winnerVariant.toUpperCase()}</StatusPill>
        )}
      </header>

      <ul className="space-y-1.5">
        {test.arms.map((arm) => {
          const s = ARM_STATUS[arm.status];
          return (
            <li key={arm.variant} className="flex items-start gap-2">
              <span className="mt-px shrink-0 rounded bg-background px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                {arm.variant.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-foreground/90" title={arm.headline ?? undefined}>
                  {arm.headline ? `“${arm.headline}”` : "Copy not recorded for this arm"}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {formatCount(arm.views)} views ·{" "}
                  {arm.leads === null ? (
                    <span title="No lead on this arm carries both an lp_page and an lp_variant, so its count is unknown rather than zero">
                      leads not tracked
                    </span>
                  ) : (
                    <span title={ATTRIBUTED}>
                      {formatCount(arm.leads)} {arm.leads === 1 ? "lead" : "leads"}
                    </span>
                  )}
                  {/* Never render an unattributed arm as "0 booked": no lp_variant on
                      the lead means unknown, and a zero here would read as a page
                      that books nobody. */}
                  {arm.booked === null ? (
                    <span title="No booking data for this arm — its leads carry no lp_variant yet">
                      {" "}· booked not tracked
                    </span>
                  ) : (
                    <span
                      title={
                        arm.bookedRate === null
                          ? "Booked appointments from GoHighLevel"
                          : `${pct(arm.bookedRate)} of this arm's GHL leads booked`
                      }
                    >
                      {" "}· {formatCount(arm.booked)} booked
                      {arm.bookedRate !== null && <> ({pct(arm.bookedRate)})</>}
                    </span>
                  )}
                  {arm.weight !== null && <> · {arm.weight}% of traffic</>}
                </p>
              </div>
              <span title={s.help} className="shrink-0">
                <StatusPill status={s.status}>{s.label}</StatusPill>
              </span>
              <span
                className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground"
                title={
                  arm.cvr === null || !arm.interval
                    ? "Not enough views for a rate"
                    : `${pct(arm.cvr)}, 95% range ${pct(arm.interval.low)}–${pct(arm.interval.high)}`
                }
              >
                {arm.cvr === null ? <Dash title="No rate yet" /> : pct(arm.cvr)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {test.decided
          ? "An arm is ahead at 95% confidence — safe to call and roll out."
          : "No arm has separated yet."}{" "}
        Views come from the page, which is the only thing that knows which arm a visitor saw.
        Leads and booked count the same attributed GoHighLevel contacts as the figures above.
      </p>
    </section>
  );
}

/** Which ads are feeding this page, dearest first. */
function AdsPanel({ row }: { row: FunnelRow }) {
  if (row.ads.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        No ad sent traffic to this page in this period.
      </p>
    );
  }
  return (
    <section className="rounded-lg border border-border/60">
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <Megaphone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <h4 className="text-xs font-semibold text-foreground">
          {row.ads.length} {row.ads.length === 1 ? "ad" : "ads"} driving traffic
        </h4>
      </header>
      <ul className="divide-y divide-border/60">
        {row.ads.map((ad) => (
          <li key={ad.id} className="flex items-center gap-2 px-3 py-2">
            <StatusPill status={ad.live ? "success" : "neutral"}>{ad.live ? "Active" : "Off"}</StatusPill>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground" title={ad.name}>{ad.name}</p>
              {ad.adset && <p className="truncate text-[11px] text-muted-foreground" title={ad.adset}>{ad.adset}</p>}
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatUsd(ad.spend)} · {formatCount(ad.lpv)} views
            </span>
            {ad.adsManagerUrl && (
              <a
                href={ad.adsManagerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open ${ad.name} in Meta Ads Manager`}
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Every copy this page has shown, newest first. */
function VersionsPanel({ row }: { row: FunnelRow }) {
  if (row.versions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        No copy history yet — this page hasn't changed since version tracking started.
      </p>
    );
  }
  return (
    <section className="rounded-lg border border-border/60">
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <h4 className="text-xs font-semibold text-foreground">Copy history</h4>
      </header>
      <ul className="divide-y divide-border/60">
        {row.versions.map((v) => (
          <li key={`${v.version}-${v.variant}`} className="flex items-start gap-2 px-3 py-2">
            <span className="mt-px shrink-0">
              <StatusPill status={v.live ? "success" : "neutral"}>
                v{v.version}
                {v.variant !== "a" && ` · ${v.variant.toUpperCase()}`} · {v.live ? "Live" : "Off"}
              </StatusPill>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-foreground/90" title={v.headline ?? undefined}>
                {v.headline ? `“${v.headline}”` : "Copy not recorded"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {shortDate(v.from)} – {v.to ? shortDate(v.to) : "now"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One landing page: what it says, what it earned, and everything needed to
 * decide what to do about it. Collapsed it is a single scannable line; expanded
 * it carries the ads, the copy history and any split test.
 */
export function FunnelPageCard({ row }: { row: FunnelRow }) {
  const [open, setOpen] = useState(false);
  const perf = row.perf;
  const panelId = `funnel-${row.key.replace(/[^a-z0-9]+/gi, "-")}`;

  return (
    <article className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold text-foreground">{row.label}</span>
            <span className="truncate text-xs text-muted-foreground">{row.accountName}</span>
            {row.liveVersion !== null && (
              <StatusPill status="neutral">v{row.liveVersion}</StatusPill>
            )}
            {row.runningTest && <StatusPill status="info">Split test running</StatusPill>}
            {!perf && <StatusPill status="neutral">No ad traffic</StatusPill>}
            {perf && <VerdictPill verdict={perf.verdict} reason={perf.reason} />}
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-foreground/80" title={row.headline ?? undefined}>
            {row.headline ? `“${row.headline}”` : "Headline not synced"}
          </p>
          {row.offer && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <StatusPill status="info">{OFFER_LABEL[row.offer]}</StatusPill>
              {row.angle && row.angle !== "none" && <StatusPill status="neutral">{ANGLE_LABEL[row.angle]}</StatusPill>}
            </div>
          )}
        </div>

        <dl className="hidden shrink-0 grid-cols-4 gap-4 sm:grid" style={{ minWidth: 300 }}>
          <Stat label="Spend" value={perf ? formatUsd(perf.spend) : <Dash title="No ad traffic in this period" />} />
          <Stat label="Views" value={perf ? formatCount(perf.lpv) : <Dash title="No ad traffic in this period" />} />
          <Stat
            label="Leads"
            value={
              row.verifiedLeads === null
                ? <Dash title={perf ? NOT_TRACKED : "No ad traffic in this period"} />
                : formatCount(row.verifiedLeads)
            }
            title={row.verifiedLeads === null ? undefined : ATTRIBUTED}
          />
          <Stat
            label="Conv."
            value={row.verifiedCvr != null ? pct(row.verifiedCvr) : <Dash title="No conversion rate for this period" />}
            title={
              row.verifiedInterval
                ? `Attributed leads ÷ page views · 95% range ${pct(row.verifiedInterval.low)}–${pct(row.verifiedInterval.high)}`
                : undefined
            }
          />
        </dl>
      </button>

      {open && (
        <div id={panelId} className="space-y-3 border-t border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {row.url.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden />
            </a>
            <Link
              to={`/account/${encodeURIComponent(row.accountName)}?tab=funnel`}
              className="rounded-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open client
            </Link>
            {row.copySyncedAt && (
              <span className="text-muted-foreground">Copy read {shortDate(row.copySyncedAt)}</span>
            )}
          </div>

          {perf && (
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-card p-3 sm:grid-cols-4 lg:grid-cols-6">
              <Stat label="Spend" value={formatUsd(perf.spend)} />
              <Stat label="Link clicks" value={formatCount(perf.linkClicks)} />
              <Stat label="Page views" value={formatCount(perf.lpv)} />
              <Stat
                label="Attributed leads"
                value={row.verifiedLeads === null ? <Dash title={NOT_TRACKED} /> : formatCount(row.verifiedLeads)}
                title={row.verifiedLeads === null ? undefined : ATTRIBUTED}
              />
              <Stat
                label="Cost / lead"
                value={perf.costPer !== null ? formatUsd(perf.costPer) : <Dash title="No leads yet, so no cost per lead" />}
                title={perf.benchmark ? `Benchmark ${formatUsd(perf.benchmark.costPer)} (${perf.benchmark.source === "target" ? "CPL target" : "account average"})` : undefined}
              />
            </dl>
          )}

          {row.runningTest && <SplitTestPanel test={row.runningTest} />}
          {row.pastTests.map((t) => <SplitTestPanel key={t.id} test={t} />)}
          {!row.runningTest && row.pastTests.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              No split test has run on this page.
            </p>
          )}

          <AdsPanel row={row} />
          <VersionsPanel row={row} />
        </div>
      )}
    </article>
  );
}
