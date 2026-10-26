import { useState } from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusPill, type Status } from "@/components/StatusPill";
import {
  RULE_COPY,
  VERDICT_LABEL,
  adsManagerAdUrl,
  onlyLiveLabel,
} from "@/lib/killReview/rules";
import {
  formatKillLeads,
  formatKillMoney,
  formatKillMoneyOrDash,
  formatKillPercentOrDash,
  formatKillRange,
  formatSince,
} from "@/lib/killReview/format";
import type { CreativeKillReviewRow, KillVerdict } from "@/lib/killReview/types";
import { cn } from "@/lib/utils";

const VERDICT_STATUS: Record<KillVerdict, Status> = {
  turn_off: "danger",
  watch: "warning",
  keep: "success",
};

export function KillReviewCard({
  row,
  selected,
  onSelectedChange,
}: {
  row: CreativeKillReviewRow;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb = !!row.thumbnail_url && !thumbFailed;
  const curRange = formatKillRange(row.cur_since, row.cur_until);
  const prevRange = formatKillRange(row.prev_since, row.prev_until);

  return (
    <article
      aria-label={`Ad ${row.n}, ${row.client_name}`}
      className={cn(
        "rounded-lg border border-border bg-card shadow-sm",
        selected && "ring-2 ring-ring",
      )}
    >
      <div className="flex flex-col gap-4 p-3 sm:p-4 md:flex-row">
        <div className="flex gap-3 md:w-52 md:flex-col">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selected}
              onCheckedChange={(value) => onSelectedChange(value === true)}
              aria-label={`Select ad ${row.n}`}
            />
            <span
              className="flex h-8 min-w-8 items-center justify-center rounded-md bg-muted px-1.5 text-sm font-semibold tabular-nums text-foreground"
              aria-hidden
            >
              {row.n}
            </span>
          </div>
          <div className="flex aspect-[4/5] w-36 items-center justify-center overflow-hidden rounded-md bg-muted md:w-52">
            {showThumb ? (
              <img
                src={row.thumbnail_url ?? undefined}
                alt=""
                className="max-h-full max-w-full object-contain"
                onError={() => setThumbFailed(true)}
              />
            ) : (
              <p className="px-3 text-center text-xs text-muted-foreground">No thumbnail</p>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{row.client_name}</p>
              <h3 className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{row.ad_name}</h3>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{row.adset_name}</p>
            </div>
            <a
              href={adsManagerAdUrl(row.act, row.ad_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              title="Opens this ad in Ads Manager. Does not pause it."
            >
              Ads Manager
              <SquareArrowOutUpRight className="h-3 w-3" aria-hidden />
            </a>
          </header>

          <div className="space-y-1.5">
            {row.verdict == null ? (
              <StatusPill status="neutral">No verdict</StatusPill>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={VERDICT_STATUS[row.verdict]}>{VERDICT_LABEL[row.verdict]}</StatusPill>
                {row.reviewer && <span className="text-xs text-muted-foreground">{row.reviewer}</span>}
              </div>
            )}
            {row.verdict != null && (
              <p className="text-sm leading-snug text-foreground">
                {row.reason?.trim() ? row.reason : "No reason written"}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {row.rules_hit.map((rule) => (
                <span key={rule} title={RULE_COPY[rule].detail}>
                  <StatusPill status="warning">{RULE_COPY[rule].label}</StatusPill>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{onlyLiveLabel(row.only_live_in_adset)}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <caption className="sr-only">
                Last 14 days ({curRange}) compared with the previous 14 days ({prevRange}). Leads are the website pixel. Schedule is the Meta pixel, not GoHighLevel.
              </caption>
              <thead>
                <tr className="text-left text-[11px] font-medium text-muted-foreground">
                  <th scope="col" className="pb-1 pr-3 font-medium" />
                  <th scope="col" className="pb-1 pr-3 font-medium">
                    Last 14 days
                    <span className="mt-0.5 block font-normal tabular-nums">{curRange}</span>
                  </th>
                  <th scope="col" className="pb-1 font-medium">
                    Previous 14 days
                    <span className="mt-0.5 block font-normal tabular-nums">{prevRange}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <MetricRow label="Spend" current={formatKillMoney(row.cur_spend)} previous={formatKillMoney(row.prev_spend)} />
                <MetricRow label="Leads" current={formatKillLeads(row.cur_leads)} previous={formatKillLeads(row.prev_leads)} />
                <MetricRow
                  label="CPL"
                  current={formatKillMoneyOrDash(row.cur_cpl)}
                  previous={formatKillMoneyOrDash(row.prev_cpl)}
                />
                <MetricRow
                  label="Schedule (Meta pixel)"
                  current={formatKillLeads(row.cur_appts)}
                  previous={formatKillLeads(row.prev_appts)}
                />
              </tbody>
            </table>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Since last lead" value={formatSince(row.since_lead_spend, row.last_lead_on, "no lead yet")} />
            <Stat
              label="Since last Schedule"
              value={formatSince(row.since_appt_spend, row.last_appt_on, "no Schedule yet")}
              title="Meta pixel Schedule, through the day before the run"
            />
            <Stat label="CPLC" value={formatKillMoneyOrDash(row.cplc)} title="Cost per link click, last 14 days" />
            <Stat label="Link CTR" value={formatKillPercentOrDash(row.ctr)} title="Inline link clicks divided by impressions" />
            <Stat
              label="Lifetime"
              value={`${formatKillMoney(row.lifetime_spend)} · ${formatKillLeads(row.lifetime_leads)} leads`}
            />
          </dl>
        </div>
      </div>
    </article>
  );
}

function MetricRow({ label, current, previous }: { label: string; current: string; previous: string }) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className="py-1.5 pr-3 text-left text-xs font-medium text-muted-foreground">
        {label}
      </th>
      <td className="py-1.5 pr-3 font-medium text-foreground">{current}</td>
      <td className="py-1.5 text-muted-foreground">{previous}</td>
    </tr>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums leading-snug text-foreground">{value}</dd>
    </div>
  );
}
