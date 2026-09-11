import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCount, formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreativeName, CreativeThumbnail, Dash, VerdictPill } from "./CreativeBits";
import { LabelEditor } from "./LabelEditor";
import { adNameKey, type GhlMatch } from "./ghl";
import { labelCreative, type CreativeLabels } from "./labels";
import { FATIGUE_FREQUENCY, METRIC_NOUN, type Metric, type ScoredAd, type Verdict } from "./verdicts";

type SortKey = "spend" | "results" | "costPer" | "appointments" | "crm" | "ctr" | "hook" | "frequency" | "verdict";

// Money wasters first when sorting by verdict: they're the decision to make.
const VERDICT_RANK: Record<Verdict, number> = { waster: 0, winner: 1, on_par: 2, learning: 3, unscored: 4, no_delivery: 5 };

const hookRate = (s: ScoredAd) =>
  s.ad.videoPlays !== null && s.ad.impressions > 0 ? (s.ad.videoPlays / s.ad.impressions) * 100 : null;

/** Every ad that spent in the period (live or not) plus live ads yet to deliver. */
export function CreativeLeaderboard({
  scored,
  labels,
  ghl,
  metric,
  appointmentsTracked,
  onSaveLabel,
  savingLabel,
}: {
  scored: ScoredAd[];
  labels: Map<string, CreativeLabels>;
  ghl: GhlMatch | null;
  metric: Metric;
  appointmentsTracked: boolean;
  onSaveLabel: (adName: string, offer: string | null, angle: string | null) => void;
  savingLabel: boolean;
}) {
  const isMobile = useIsMobile();
  const [show, setShow] = useState<"all" | "live">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "spend", dir: "desc" });
  const noun = METRIC_NOUN[metric];
  // Only when some of these ads actually match GHL leads by name: a column of
  // zeros for a funnel that never passes the ad name would read as "no leads".
  const showCrm = !!ghl && scored.some((s) => (ghl.byName.get(adNameKey(s.ad.name))?.leads ?? 0) > 0);

  const crmLeads = (s: ScoredAd) => ghl?.byName.get(adNameKey(s.ad.name))?.leads ?? 0;
  const nameCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of scored) m.set(adNameKey(s.ad.name), (m.get(adNameKey(s.ad.name)) ?? 0) + 1);
    return m;
  }, [scored]);

  const getters: Record<SortKey, (s: ScoredAd) => number | null> = {
    spend: (s) => (s.ad.delivered ? s.ad.spend : null),
    results: (s) => (s.ad.delivered ? s.results : null),
    costPer: (s) => s.costPer,
    appointments: (s) => s.ad.appointments,
    crm: (s) => (showCrm ? crmLeads(s) : null),
    ctr: (s) => s.ad.linkCtr,
    hook: hookRate,
    frequency: (s) => s.ad.frequency,
    verdict: (s) => VERDICT_RANK[s.verdict],
  };

  const rows = useMemo(() => {
    const get = getters[sort.key];
    return scored
      .filter((s) => (show === "live" ? s.ad.live : s.ad.delivered || s.ad.live))
      .sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        if (va === null && vb === null) return b.ad.spend - a.ad.spend;
        if (va === null) return 1;
        if (vb === null) return -1;
        return (sort.dir === "asc" ? va - vb : vb - va) || b.ad.spend - a.ad.spend;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scored, sort, show, ghl]);

  const defaultDir = (k: SortKey): "asc" | "desc" => (k === "costPer" || k === "verdict" || k === "frequency" ? "asc" : "desc");
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir(key) }));

  const sortHead = (k: SortKey, text: string, opts: { title?: string; align?: "left" | "right" } = {}) => {
    const active = sort.key === k;
    const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead
        className={cn("whitespace-nowrap", opts.align !== "left" && "text-right")}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => toggleSort(k)}
          title={opts.title}
          className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {text}
          <Icon className={cn("h-3 w-3", !active && "opacity-40")} aria-hidden />
        </button>
      </TableHead>
    );
  };

  const nameCell = (s: ScoredAd) => {
    const l = labels.get(s.ad.id) ?? labelCreative(s.ad);
    return (
      <div className="flex items-start gap-3">
        <CreativeThumbnail ad={s.ad} />
        <div className="min-w-0">
          <CreativeName ad={s.ad} />
          <LabelEditor ad={s.ad} labels={l} saving={savingLabel} onSave={(o, a) => onSaveLabel(s.ad.name, o, a)} />
        </div>
      </div>
    );
  };

  const cost = (s: ScoredAd): ReactNode =>
    s.costPer !== null ? formatUsd(s.costPer, { decimals: true }) : <Dash title={`No ${noun.many} in this period`} />;
  const crm = (s: ScoredAd): ReactNode => {
    const shared = (nameCounts.get(adNameKey(s.ad.name)) ?? 0) > 1;
    return (
      <span title={shared ? `GHL matches by ad name; ${nameCounts.get(adNameKey(s.ad.name))} ads share “${s.ad.name}”, so each shows the name's total` : undefined}>
        {formatCount(crmLeads(s))}
        {shared && <span className="text-muted-foreground">*</span>}
      </span>
    );
  };
  const hook = (s: ScoredAd): ReactNode => {
    const h = hookRate(s);
    if (h === null) return <Dash title={s.ad.format === "video" ? "No impressions" : "Images have no hook rate"} />;
    const hold = s.ad.thruplays !== null && s.ad.videoPlays ? `${Math.round((s.ad.thruplays / s.ad.videoPlays) * 100)}% held to ThruPlay` : undefined;
    return <span title={hold}>{formatPercent(h, 1)}</span>;
  };
  const freq = (s: ScoredAd): ReactNode =>
    s.ad.frequency !== null ? (
      <span className={cn(s.fatigued && "font-semibold text-warning")} title={s.fatigued ? `At or above ${FATIGUE_FREQUENCY}: fatigue risk` : undefined}>
        {s.ad.frequency.toFixed(1)}
      </span>
    ) : (
      <Dash title="No delivery" />
    );

  const colCount = 7 + Number(appointmentsTracked) + Number(showCrm);

  return (
    <section className="space-y-3" aria-labelledby="leaderboard-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="leaderboard-heading" className="text-sm font-semibold text-foreground">
          All creatives
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{rows.length}</span>
        </h3>
        <div className="flex items-center gap-2">
          {isMobile && (
            <Select value={sort.key} onValueChange={(v) => setSort({ key: v as SortKey, dir: defaultDir(v as SortKey) })}>
              <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Sort by"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spend" className="text-xs">Spend</SelectItem>
                <SelectItem value="verdict" className="text-xs">Verdict</SelectItem>
                <SelectItem value="results" className="text-xs capitalize">{noun.many}</SelectItem>
                <SelectItem value="costPer" className="text-xs">{noun.costLabel}</SelectItem>
                <SelectItem value="frequency" className="text-xs">Frequency</SelectItem>
              </SelectContent>
            </Select>
          )}
          <SegmentedControl
            value={show}
            onChange={setShow}
            label="Which ads"
            size="xs"
            options={[{ value: "all", label: "Spent in period" }, { value: "live", label: "Live now" }]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {show === "live" ? "No ads are live right now." : "No ads spent in this period."}
        </p>
      ) : isMobile ? (
        <ul className="divide-y divide-border/60 rounded-md border border-border/50">
          {rows.map((s) => (
            <li key={s.ad.id} className="space-y-2 p-3 text-sm">
              {nameCell(s)}
              {s.ad.delivered ? (
                <>
                  <VerdictPill verdict={s.verdict} reason={s.reason} />
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Spend</dt><dd className="font-medium tabular-nums text-foreground">{formatUsd(s.ad.spend, { decimals: true })}</dd></div>
                    <div><dt className="capitalize text-muted-foreground">{noun.many}</dt><dd className="font-medium tabular-nums text-foreground">{formatCount(s.results)}</dd></div>
                    <div><dt className="text-muted-foreground">{noun.costLabel}</dt><dd className="font-medium tabular-nums text-foreground">{cost(s)}</dd></div>
                    {appointmentsTracked && metric === "leads" && (
                      <div><dt className="text-muted-foreground">Appts</dt><dd className="font-medium tabular-nums text-foreground">{formatCount(s.ad.appointments ?? 0)}</dd></div>
                    )}
                    {showCrm && <div><dt className="text-muted-foreground">CRM leads</dt><dd className="font-medium tabular-nums text-foreground">{crm(s)}</dd></div>}
                    <div><dt className="text-muted-foreground">Frequency</dt><dd className="font-medium tabular-nums text-foreground">{freq(s)}</dd></div>
                  </dl>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Live, no delivery in this period</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-auto rounded-md border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Creative</TableHead>
                {sortHead("verdict", "Verdict", { align: "left" })}
                {sortHead("spend", "Spend")}
                {sortHead("results", noun.many.replace(/^\w/, (c) => c.toUpperCase()))}
                {sortHead("costPer", noun.costLabel)}
                {appointmentsTracked && sortHead("appointments", "Appts", { title: "Meta Schedule events credited to the ad" })}
                {showCrm && sortHead("crm", "CRM leads", { title: `GHL leads matched by ad name · ${ghl!.withAdName} of ${ghl!.total} GHL leads in the period carry an ad name` })}
                {sortHead("ctr", "Link CTR")}
                {sortHead("hook", "Hook", { title: "Video hook rate: 3-second plays ÷ impressions. Hover a value for how many held to ThruPlay." })}
                {sortHead("frequency", "Freq.")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.ad.id} className={cn(!s.ad.live && "text-muted-foreground")}>
                  <TableCell className="min-w-[240px] max-w-[300px] py-2">{nameCell(s)}</TableCell>
                  {s.ad.delivered ? (
                    <>
                      <TableCell className="py-2">
                        <VerdictPill verdict={s.verdict} reason={s.reason} />
                        <p className="mt-0.5 max-w-[170px] truncate text-[11px] text-muted-foreground" title={s.reason}>{s.reason}</p>
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-foreground">{formatUsd(s.ad.spend, { decimals: true })}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-foreground">{formatCount(s.results)}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-foreground">{cost(s)}</TableCell>
                      {appointmentsTracked && (
                        <TableCell className="py-2 text-right tabular-nums text-foreground">{formatCount(s.ad.appointments ?? 0)}</TableCell>
                      )}
                      {showCrm && <TableCell className="py-2 text-right tabular-nums text-foreground">{crm(s)}</TableCell>}
                      <TableCell className="py-2 text-right tabular-nums text-foreground">
                        {s.ad.linkCtr !== null ? formatPercent(s.ad.linkCtr) : <Dash title="No link clicks" />}
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-foreground">{hook(s)}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-foreground">{freq(s)}</TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={colCount - 1} className="py-2 text-xs text-muted-foreground">
                      Live, no delivery in this period
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
