import { OctagonX, TrendingUp, Repeat } from "lucide-react";
import { formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreativeName, CreativeThumbnail } from "./CreativeBits";
import { FATIGUE_FREQUENCY, METRIC_NOUN, type Metric, type ScoredAd, type Scorecard } from "./verdicts";

const SHOWN = 5;

function Column({
  title,
  icon: Icon,
  tone,
  summary,
  items,
  empty,
  note,
}: {
  title: string;
  icon: React.ElementType;
  tone: "text-success" | "text-danger" | "text-warning";
  summary: string | null;
  items: ScoredAd[];
  empty: string;
  note: (s: ScoredAd) => React.ReactNode;
}) {
  const extra = items.length - SHOWN;
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border/60 bg-card shadow-sm" aria-label={title}>
      <header className="flex items-start gap-2 border-b border-border/60 px-3.5 py-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {title}
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{items.length}</span>
          </h3>
          {summary && <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>}
        </div>
      </header>
      {items.length === 0 ? (
        <p className="flex-1 px-3.5 py-5 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex-1 divide-y divide-border/50">
          {items.slice(0, SHOWN).map((s) => (
            <li key={s.ad.id} className="flex gap-3 px-3.5 py-2.5">
              <CreativeThumbnail ad={s.ad} size="sm" />
              <div className="min-w-0 flex-1 text-sm">
                <CreativeName ad={s.ad} />
                <p className="mt-0.5 text-xs leading-snug text-foreground/80">{note(s)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {extra > 0 && (
        <p className="border-t border-border/50 px-3.5 py-2 text-[11px] text-muted-foreground">
          +{extra} more in All creatives below
        </p>
      )}
    </section>
  );
}

/**
 * What to do with this account's creatives right now: scale the proven winners,
 * cut the money wasters, and refresh what the audience is tiring of.
 */
export function ActionBoard({ scorecard, metric }: { scorecard: Scorecard; metric: Metric }) {
  const noun = METRIC_NOUN[metric];
  const b = scorecard.benchmark;
  const savings = scorecard.winners.reduce((s, w) => s + w.savings, 0);
  // Paused wasters already cost what they'll cost; the live ones need a decision.
  const wasters = [...scorecard.wasters].sort((x, y) => Number(y.ad.live) - Number(x.ad.live));
  const liveWasters = wasters.filter((w) => w.ad.live).length;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Column
        title="Scale these"
        icon={TrendingUp}
        tone="text-success"
        summary={scorecard.winners.length ? `Beating the benchmark with confidence · their ${noun.many} cost ~${formatUsd(savings)} less than at benchmark` : null}
        items={[...scorecard.winners].sort((x, y) => Number(y.ad.live) - Number(x.ad.live))}
        empty={
          b
            ? `No ad is beating ${formatUsd(b.costPer)} per ${noun.one} with enough ${noun.many} to be sure yet.`
            : "Nothing to compare against yet."
        }
        note={(s) => (
          <>
            {s.reason}
            {!s.ad.live && <span className="text-muted-foreground"> · paused: consider relaunching</span>}
          </>
        )}
      />
      <Column
        title="Cut these"
        icon={OctagonX}
        tone="text-danger"
        summary={
          wasters.length
            ? `${formatUsd(scorecard.excessSpend)} spent beyond what their ${noun.many} were worth${liveWasters < wasters.length ? ` · ${wasters.length - liveWasters} already off` : ""}`
            : null
        }
        items={wasters}
        empty={
          scorecard.trackingGap
            ? `Withheld: no ${noun.many} were recorded on any ad, which points at tracking, not creative.`
            : `No money wasters: every ad with enough spend to judge is within range of the benchmark.`
        }
        note={(s) => (
          <>
            {s.reason}
            {!s.ad.live && <span className="text-muted-foreground"> · already off</span>}
          </>
        )}
      />
      <Column
        title="Fatigue watch"
        icon={Repeat}
        tone="text-warning"
        summary={scorecard.fatigued.length ? `Frequency ${FATIGUE_FREQUENCY}+ in this period: refresh the creative before results slide` : null}
        items={scorecard.fatigued}
        empty={`No ad has reached a frequency of ${FATIGUE_FREQUENCY} in this period.`}
        note={(s) => (
          <>
            Frequency {s.ad.frequency?.toFixed(1)}
            {s.ad.linkCtr !== null && <> · link CTR {formatPercent(s.ad.linkCtr)}</>}
            {" · "}
            {s.costPer !== null ? `${formatUsd(s.costPer)} per ${noun.one}` : `0 ${noun.many}`}
          </>
        )}
      />
    </div>
  );
}
