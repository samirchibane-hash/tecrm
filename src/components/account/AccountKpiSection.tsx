import { useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { metaUnavailableReason, useCouplerData, useMetaUnavailable } from "@/hooks/useCouplerData";
import { useSettings } from "@/hooks/useSettings";
import { useAccountGhlConversions } from "@/hooks/useAccountGhlConversions";
import { ALL_KPIS, dependsOnMeta, type KpiKey } from "@/components/dashboard/AccountCard";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { NOT_TRACKED_REASON, resolveChartKpi, untrackedKpis } from "@/lib/kpis";
import { KpiAreaChart, type ChartAnnotation, type ChartAnnotationItem } from "./KpiAreaChart";
import type { AccountBrief, AccountTask } from "./queries";

const CHARTABLE_KEYS = new Set<KpiKey>([
  "totalSpend", "totalClicks", "totalImpressions", "totalReach",
  "avgCTR", "avgCPC", "avgCPM",
  "webApptTotal", "apptTotal", "leadsTotal", "fbLeadsTotal",
  "ghlLeads", "ghlAppointments", "ghlCostPerLead", "ghlCostPerAppt",
]);

const BRIEF_STATUS_LABEL: Record<string, string> = {
  assigned: "Assigned", reviewing: "Reviewing", approved: "Approved", launched: "Launched",
};

const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * The account's headline results (the KPIs chosen in Settings, from Meta and
 * GHL) and one KPI charted over time, marked with completed tasks and briefs.
 */
export function AccountKpiSection({
  accountId,
  accountName,
  fbAdAccountId,
  dateRange,
  rangeCaption,
  tasks,
  briefs,
}: {
  accountId: string;
  accountName: string;
  fbAdAccountId: string | null | undefined;
  dateRange: DateRange | undefined;
  rangeCaption: string;
  tasks: AccountTask[];
  briefs: AccountBrief[];
}) {
  // Meta outages degrade only Meta-derived KPIs — GHL metrics stay live.
  const { data: couplerData, isError: metaFeedDown, error: metaError, refetch: refetchAds, isFetching: adFetching } = useCouplerData();
  const metaUnavailable = useMetaUnavailable();
  const { settings } = useSettings();
  const { data: ghlRaw = [] } = useAccountGhlConversions(accountId);
  const [selectedChart, setSelectedChart] = useState<KpiKey>("totalSpend");

  // Meta can be down for everyone, or unable to read just this client's ad account
  // while the rest load; either way this account's Meta metrics are unknown, not $0.
  const accountMetaGap = metaUnavailable.find((a) => a.id === fbAdAccountId);
  const metaDown = metaFeedDown || !!accountMetaGap;
  const metaDownMessage = accountMetaGap ? metaUnavailableReason(accountMetaGap.code) : (metaError as Error | null)?.message;

  const filteredAdData = useMemo(() => {
    if (!couplerData) return [];
    const rows = couplerData.filter((r) => r["Account: Account name"] === accountName);
    if (!dateRange?.from) return rows;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? startOfDay(dateRange.to) : from;
    return rows.filter((r) => {
      const rowDate = parseDay(r["Report: Date"]);
      return rowDate >= from && rowDate <= to;
    });
  }, [couplerData, accountName, dateRange]);

  // Conversion KPIs this client's funnel doesn't send to Meta read "Not tracked".
  const untracked = useMemo(() => untrackedKpis(filteredAdData), [filteredAdData]);

  const ghlConversions = useMemo(() => {
    if (!dateRange?.from) return ghlRaw;
    return ghlRaw.filter((c) => {
      const dateVal = parseDay(c.created_on);
      if (dateRange.from && dateVal < dateRange.from) return false;
      if (dateRange.to && dateVal > new Date(dateRange.to.getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [ghlRaw, dateRange]);

  const kpis = useMemo((): Record<KpiKey, number> => {
    const sum = (f: (r: (typeof filteredAdData)[number]) => number | null | undefined) => filteredAdData.reduce((s, r) => s + (f(r) ?? 0), 0);
    const avg = (f: (r: (typeof filteredAdData)[number]) => number | null | undefined) => (filteredAdData.length > 0 ? sum(f) / filteredAdData.length : 0);
    const totalSpend = sum((r) => r["Cost: Amount spend"]);
    const webApptTotal = sum((r) => r["Conversions: Website Appointments Scheduled - Total"]);
    const webApptCostRaw = sum((r) => r["Conversions: Website Appointments Scheduled - Cost"]);
    const apptTotal = sum((r) => r["Conversions: Appointments Scheduled - Total"]);
    const apptCostRaw = sum((r) => r["Conversions: Appointments Scheduled - Cost"]);
    const leadsTotal = sum((r) => r["Conversions: Leads - Total"]);
    const leadsCostRaw = sum((r) => r["Conversions: Leads - Cost"]);
    const fbLeadsTotal = sum((r) => r["Conversions: All On-Facebook Leads - Total"]);
    const fbLeadsCostRaw = sum((r) => r["Conversions: All On-Facebook Leads - Cost"]);
    const type = (c: { type: string | null }) => c.type?.toLowerCase();
    const ghlLeads = ghlConversions.filter((c) => type(c) === "lead" || type(c) === "water test").length;
    const ghlAppointments = ghlConversions.filter((c) => type(c) === "appointment" || type(c) === "water test").length;
    const sold = ghlConversions.filter((c) => c.appointment_status === "sold");
    const totalRevenue = sold.reduce((s, c) => s + (c.deal_value ?? 0), 0);
    return {
      totalSpend,
      totalClicks: sum((r) => r["Performance: Clicks"]),
      totalImpressions: sum((r) => r["Performance: Impressions"]),
      totalReach: sum((r) => r["Performance: Reach"]),
      avgCTR: avg((r) => r["Clicks: CTR"]),
      avgCPC: avg((r) => r["Cost: CPC"]),
      avgCPM: avg((r) => r["Cost: CPM"]),
      webApptTotal, webApptCost: webApptTotal > 0 ? webApptCostRaw / webApptTotal : 0,
      apptTotal, apptCost: apptTotal > 0 ? apptCostRaw / apptTotal : 0,
      leadsTotal, leadsCost: leadsTotal > 0 ? leadsCostRaw / leadsTotal : 0,
      fbLeadsTotal, fbLeadsCost: fbLeadsTotal > 0 ? fbLeadsCostRaw / fbLeadsTotal : 0,
      ghlLeads, ghlAppointments,
      ghlCostPerLead: ghlLeads > 0 ? totalSpend / ghlLeads : 0,
      ghlCostPerAppt: ghlAppointments > 0 ? totalSpend / ghlAppointments : 0,
      soldCount: sold.length, totalRevenue,
      adRoi: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    };
  }, [filteredAdData, ghlConversions]);

  const chartSeriesData = useMemo(() => {
    type Day = { spend: number; clicks: number; impressions: number; reach: number; ctr_sum: number; cpc_sum: number; cpm_sum: number; count: number; webApptTotal: number; apptTotal: number; leadsTotal: number; fbLeadsTotal: number };
    const adByDate: Record<string, Day> = {};
    filteredAdData.forEach((r) => {
      const date = r["Report: Date"];
      if (!date) return;
      const d = (adByDate[date] ??= { spend: 0, clicks: 0, impressions: 0, reach: 0, ctr_sum: 0, cpc_sum: 0, cpm_sum: 0, count: 0, webApptTotal: 0, apptTotal: 0, leadsTotal: 0, fbLeadsTotal: 0 });
      d.spend += r["Cost: Amount spend"] ?? 0;
      d.clicks += r["Performance: Clicks"] ?? 0;
      d.impressions += r["Performance: Impressions"] ?? 0;
      d.reach += r["Performance: Reach"] ?? 0;
      d.ctr_sum += r["Clicks: CTR"] ?? 0;
      d.cpc_sum += r["Cost: CPC"] ?? 0;
      d.cpm_sum += r["Cost: CPM"] ?? 0;
      d.count += 1;
      d.webApptTotal += r["Conversions: Website Appointments Scheduled - Total"] ?? 0;
      d.apptTotal += r["Conversions: Appointments Scheduled - Total"] ?? 0;
      d.leadsTotal += r["Conversions: Leads - Total"] ?? 0;
      d.fbLeadsTotal += r["Conversions: All On-Facebook Leads - Total"] ?? 0;
    });
    const ghlByDate: Record<string, { leads: number; appts: number }> = {};
    ghlConversions.forEach((c) => {
      const date = c.created_on;
      if (!date) return;
      const g = (ghlByDate[date] ??= { leads: 0, appts: 0 });
      const t = c.type?.toLowerCase();
      if (t === "lead" || t === "water test") g.leads += 1;
      if (t === "appointment" || t === "water test") g.appts += 1;
    });
    const adDates = Object.keys(adByDate).sort();
    const ghlDates = Object.keys(ghlByDate).sort();
    const allDates = [...new Set([...adDates, ...ghlDates])].sort();
    const pick: Partial<Record<KpiKey, (d: Day) => number>> = {
      totalSpend: (d) => d.spend, totalClicks: (d) => d.clicks, totalImpressions: (d) => d.impressions, totalReach: (d) => d.reach,
      avgCTR: (d) => (d.count > 0 ? d.ctr_sum / d.count : 0), avgCPC: (d) => (d.count > 0 ? d.cpc_sum / d.count : 0), avgCPM: (d) => (d.count > 0 ? d.cpm_sum / d.count : 0),
      webApptTotal: (d) => d.webApptTotal, apptTotal: (d) => d.apptTotal, leadsTotal: (d) => d.leadsTotal, fbLeadsTotal: (d) => d.fbLeadsTotal,
    };
    const series: Partial<Record<KpiKey, { date: string; value: number }[]>> = {};
    for (const [key, f] of Object.entries(pick) as [KpiKey, (d: Day) => number][]) {
      series[key] = adDates.map((date) => ({ date, value: +f(adByDate[date]).toFixed(3) }));
    }
    series.ghlLeads = ghlDates.map((date) => ({ date, value: ghlByDate[date].leads }));
    series.ghlAppointments = ghlDates.map((date) => ({ date, value: ghlByDate[date].appts }));
    series.ghlCostPerLead = allDates.map((date) => ({ date, value: (ghlByDate[date]?.leads ?? 0) > 0 ? +((adByDate[date]?.spend ?? 0) / ghlByDate[date].leads).toFixed(2) : 0 }));
    series.ghlCostPerAppt = allDates.map((date) => ({ date, value: (ghlByDate[date]?.appts ?? 0) > 0 ? +((adByDate[date]?.spend ?? 0) / ghlByDate[date].appts).toFixed(2) : 0 }));
    return series;
  }, [filteredAdData, ghlConversions]);

  // A task marks the chart on the day it was completed (the day the change landed);
  // a brief marks the day its status last moved.
  const annotations = useMemo((): ChartAnnotation[] => {
    const inRange = (d: Date) => {
      if (dateRange?.from && d < startOfDay(dateRange.from)) return false;
      if (dateRange?.to && d > startOfDay(dateRange.to)) return false;
      return true;
    };
    const grouped: Record<string, ChartAnnotationItem[]> = {};
    const push = (at: string, item: ChartAnnotationItem) => {
      const d = new Date(at);
      if (!inRange(startOfDay(d))) return;
      (grouped[format(d, "yyyy-MM-dd")] ??= []).push(item);
    };
    tasks.filter((t) => t.completed).forEach((t) => push(t.updated_at, { kind: "task", label: t.title, detail: "Task completed" }));
    briefs.forEach((req) => push(req.updated_at, { kind: "brief", label: req.template_name, detail: BRIEF_STATUS_LABEL[req.status] ?? req.status }));
    return Object.entries(grouped).map(([date, items]) => ({ date, items })).sort((a, b) => a.date.localeCompare(b.date));
  }, [tasks, briefs, dateRange]);

  const enabledKpis = ALL_KPIS.filter((k) => settings.enabled_kpis.includes(k.key));
  // Chart only KPIs whose feed is live; when Meta is down the default (Spend)
  // falls through to the first enabled live KPI instead of charting nothing.
  const isChartable = (key: KpiKey) => CHARTABLE_KEYS.has(key) && !(metaDown && dependsOnMeta(key)) && !untracked.has(key);
  const activeChart = resolveChartKpi(selectedChart, enabledKpis.map((k) => k.key), isChartable);
  const selectedKpi = ALL_KPIS.find((k) => k.key === activeChart);

  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account results</h2>
      {enabledKpis.length > 0 ? (
        <>
          {metaDown && (
            <SourceUnavailableNotice
              className="mb-3"
              source="Meta Ads"
              stillLive="GoHighLevel (leads, appointments, revenue)"
              message={metaDownMessage}
              onRetry={() => refetchAds()}
              retrying={adFetching}
            />
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {enabledKpis.map(({ key, label, icon, format: fmt }) => {
              const metaGap = metaDown && dependsOnMeta(key);
              const unavailable = metaGap || untracked.has(key);
              return (
                <KpiStatCard key={key} label={label} value={fmt(kpis[key])} icon={icon}
                  unavailable={unavailable}
                  unavailableReason={metaGap ? (accountMetaGap ? "Meta can't read this ad account" : "Meta Ads disconnected") : unavailable ? NOT_TRACKED_REASON : undefined}
                  isActive={activeChart === key}
                  onClick={isChartable(key) ? () => setSelectedChart(key) : undefined}
                />
              );
            })}
          </div>
          {selectedKpi && activeChart && (
            <div className="mt-3">
              <KpiAreaChart
                data={chartSeriesData[activeChart] ?? []}
                label={selectedKpi.label}
                caption={rangeCaption}
                formatValue={selectedKpi.format}
                annotations={annotations}
              />
            </div>
          )}
        </>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">No KPIs enabled — configure them in Settings.</p>
      )}
    </section>
  );
}
