import { useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { FlaskConical, Globe, MousePointerClick, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { SegmentedControl } from "@/components/SegmentedControl";
import { usePortfolioCreatives, type CreativeRange } from "@/components/creative-performance/useCreativePerformance";
import { useFunnelPageVersions, useFunnelRepoLinks } from "@/components/funnel-pages/useAccountLinks";
import { useAllGhlConversions } from "@/hooks/useAccountGhlConversions";
import { analyzePortfolioFunnel, type FunnelAccountInfo, type PortfolioGhl } from "@/components/funnel/portfolioFunnel";
import { formatCount, formatUsd } from "@/lib/format";
import { buildFunnelsBoard } from "./funnelRows";
import { FunnelPageCard } from "./FunnelPageCard";
import { useFunnelSplitTests, useVariantBookings, useVariantDaily } from "./useFunnelsData";

type Filter = "all" | "traffic" | "tests" | "idle";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "traffic", label: "With traffic" },
  { value: "tests", label: "In a test" },
  { value: "idle", label: "Idle" },
];

/**
 * Every landing page the agency runs, joined to what it earned, which ads feed
 * it, what it used to say, and any split test on it.
 *
 * The list starts from the pages themselves rather than from Meta's data, so a
 * built-but-idle page is visible instead of silently missing.
 */
export function FunnelsBoard({
  range,
  periodCaption,
  accounts,
  hiddenAccounts,
}: {
  range: CreativeRange;
  periodCaption: string;
  accounts: FunnelAccountInfo[];
  hiddenAccounts: string[];
}) {
  const [filter, setFilter] = useState<Filter>("traffic");
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, error, refetch, isFetching } = usePortfolioCreatives(range);
  const { data: links = [], isLoading: linksLoading } = useFunnelRepoLinks();
  const { data: versions = [] } = useFunnelPageVersions();
  const { data: tests = [] } = useFunnelSplitTests();

  const period = data?.accounts.find((a) => a.period)?.period ?? null;
  const { data: variantDays = [] } = useVariantDaily(period?.since, period?.until);
  const { data: variantBookings = [] } = useVariantBookings(period?.since, period?.until);
  const { data: ghlRows = [] } = useAllGhlConversions(period?.since ?? "");

  // Leads the CRM holds that no page can claim, because the funnel never passed
  // an lp_page/lp_variant for them. Never added to the board's count — it is
  // there so a low number reads as "not measured yet" rather than "not working".
  const unattributedLeads = useMemo(() => {
    const visible = new Set(accounts.filter((a) => !hiddenAccounts.includes(a.account_name)).map((a) => a.id));
    return ghlRows.filter((r) => {
      if (!r.tecrm_id || !visible.has(r.tecrm_id)) return false;
      if (period?.since && r.created_on < period.since) return false;
      if (period?.until && r.created_on > period.until) return false;
      const type = r.type?.toLowerCase();
      if (type !== "lead" && type !== "water test") return false;
      return !r.lp_variant || !r.lp_page;
    }).length;
  }, [ghlRows, accounts, hiddenAccounts, period]);

  const ghl = useMemo((): PortfolioGhl => {
    const byAccount = new Map<string, { type: string | null; created_on: string; "Ad Name": string | null }[]>();
    for (const r of ghlRows) {
      if (!r.tecrm_id) continue;
      byAccount.set(r.tecrm_id, [...(byAccount.get(r.tecrm_id) ?? []), r]);
    }
    return { byAccount, since: period?.since, until: period?.until };
  }, [ghlRows, period]);

  const board = useMemo(() => {
    const funnel = analyzePortfolioFunnel(data?.accounts ?? [], accounts, links, hiddenAccounts, ghl, versions);
    return buildFunnelsBoard({
      links,
      pages: funnel.pages,
      portfolio: data?.accounts ?? [],
      versions,
      tests,
      variantDays,
      variantBookings,
      unattributedLeads,
      hidden: hiddenAccounts,
    });
  }, [data, accounts, links, hiddenAccounts, ghl, versions, tests, variantDays, variantBookings, unattributedLeads]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.rows.filter((r) => {
      if (filter === "traffic" && !r.perf) return false;
      if (filter === "tests" && !r.runningTest) return false;
      if (filter === "idle" && r.perf) return false;
      if (!q) return true;
      return [r.label, r.accountName, r.url, r.headline ?? ""].some((s) => s.toLowerCase().includes(q));
    });
  }, [board.rows, filter, query]);

  const unreadable = (data?.accounts ?? []).filter((a) => a.error).map((a) => a.accountName);

  if (isLoading || linksLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}
        </div>
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (isError) {
    return <SourceUnavailableNotice source="Meta Ads" message={(error as Error).message} onRetry={() => refetch()} retrying={isFetching} />;
  }

  return (
    <div className="space-y-4">
      {unreadable.length > 0 && (
        <SourceUnavailableNotice
          source="Meta Ads"
          stillLive="Every other client's pages, and all copy history"
          message={`${unreadable.join(", ")}: the Meta token can't read ${unreadable.length === 1 ? "this ad account" : "these ad accounts"}, so their pages show copy and versions but no performance. Assign them to the system user in Meta Business Settings.`}
        />
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiStatCard
          label="Landing pages"
          value={formatCount(board.rows.length)}
          icon={Globe}
          detail={`${board.clients} ${board.clients === 1 ? "client" : "clients"} · ${board.idle} idle`}
        />
        <KpiStatCard
          label="Ad spend"
          value={formatUsd(board.spend)}
          icon={Users}
          detail={`${board.withTraffic} ${board.withTraffic === 1 ? "page" : "pages"} with traffic`}
        />
        <KpiStatCard
          label="Page views → leads"
          value={board.cvr !== null ? `${(board.cvr * 100).toFixed(1)}%` : "—"}
          icon={MousePointerClick}
          detail={
            `${formatCount(board.measuredLpv)} views · ${formatCount(board.leads)} attributed ${board.leads === 1 ? "lead" : "leads"}` +
            (board.unattributedLeads > 0 ? ` · ${formatCount(board.unattributedLeads)} unattributed` : "")
          }
        />
        <KpiStatCard
          label="Split tests running"
          value={formatCount(board.runningTests)}
          icon={FlaskConical}
          detail={board.runningTests === 0 ? "None running" : "Measured by page events"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={FILTERS}
          label="Filter landing pages"
        />
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, clients, headlines"
            aria-label="Search landing pages"
            className="h-8 w-56 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh from Meta"
            title="Refresh from Meta"
          >
            <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Spend and views from Meta Ads · leads from attributed GoHighLevel contacts · {periodCaption}
        {data && <> · updated {formatDistanceToNowStrict(new Date(data.fetchedAt), { addSuffix: true })}</>}
        {" · "}entry pages only; booking and thank-you pages are funnel steps, not destinations
      </p>
      <p className="text-[11px] text-muted-foreground">
        A lead here is one the funnel proved this page produced: a GoHighLevel contact carrying
        both <code className="font-mono">lp_page</code> and <code className="font-mono">lp_variant</code>{" "}
        from the ad&rsquo;s UTM parameters. Nothing else is counted — not Meta&rsquo;s pixel lead,
        which counts one opt-in several times, and not a CRM contact with no arm on it, which says
        nothing about which page earned it. Attribution went live on 18 Sep 2026, so pages read from
        there, and a client whose GHL custom fields aren&rsquo;t mapped yet shows
        &ldquo;not tracked&rdquo; rather than zero.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {board.rows.length === 0
            ? "No funnel page is registered yet. Add the client's site to funnel_sites and the hourly sync will list its pages."
            : "No page matches this filter."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => <FunnelPageCard key={row.key} row={row} />)}
        </div>
      )}
    </div>
  );
}
