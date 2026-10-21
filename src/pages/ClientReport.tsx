import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { useCouplerData } from "@/hooks/useCouplerData";
import { useSettings } from "@/hooks/useSettings";
import { ReportClientProvider, useSupabase } from "@/integrations/supabase/SupabaseContext";
import { ALL_KPIS } from "@/components/dashboard/AccountCard";
import { ReportAccountGate } from "@/components/report/ReportAccountGate";
import { ReportHeader, type ReportSection } from "@/components/report/ReportHeader";
import { ReportOverview } from "@/components/report/ReportOverview";
import { ReportAppointments } from "@/components/report/ReportAppointments";
import { ReportChangeLog } from "@/components/report/ReportChangeLog";
import { formatRange, reportPresets } from "@/components/report/reportConfig";
import { buildTimeline, chartAnnotations, timelineInRange } from "@/components/report/timeline";
import { untrackedKpis } from "@/lib/kpis";
import {
  adRowsInRange,
  buildKpiSeries,
  comparisonLabel,
  computeAccountKpis,
  ghlRowsInRange,
  previousPeriod,
  priorCoverage,
} from "@/lib/accountKpis";

export default function ClientReport() {
  const { token = "" } = useParams<{ token: string }>();
  return (
    <ReportClientProvider token={token}>
      <ReportAccountGate>
        {(account) => <ClientReportView accountId={account.id} accountName={account.account_name} />}
      </ReportAccountGate>
    </ReportClientProvider>
  );
}

function ClientReportView({ accountId, accountName }: { accountId: string; accountName: string }) {
  const supabase = useSupabase();

  // ── Period ───────────────────────────────────────────────────────────────
  const presets = useMemo(() => reportPresets(), []);
  const [presetValue, setPresetValue] = useState("mtd");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    () => presets.find((p) => p.value === "mtd")?.range,
  );
  const rangeLabel = formatRange(dateRange);

  // ── Meta ads ─────────────────────────────────────────────────────────────
  // A dead Meta connection must not take the report down: GHL metrics keep
  // rendering and only Meta-derived ones degrade to "unavailable".
  const {
    data: allAdRows,
    isLoading: adLoading,
    isError: metaDown,
    error: metaError,
    refetch: refetchAds,
    isFetching: adFetching,
  } = useCouplerData();
  const accountAdRows = useMemo(
    () => (allAdRows ?? []).filter((r) => r["Account: Account name"] === accountName),
    [allAdRows, accountName],
  );
  const adRows = useMemo(() => adRowsInRange(accountAdRows, dateRange), [accountAdRows, dateRange]);

  // ── GoHighLevel ──────────────────────────────────────────────────────────
  const { data: ghlRaw = [], isLoading: ghlLoading } = useQuery({
    queryKey: ["ghl-conversions", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ghl_conversions").select("*").eq("tecrm_id", accountId);
      if (error) throw error;
      return data;
    },
  });
  // No rows at all means the account isn't connected to GHL — not "0 leads".
  const ghlUnmapped = !ghlLoading && ghlRaw.length === 0;
  const ghlRows = useMemo(() => ghlRowsInRange(ghlRaw, dateRange), [ghlRaw, dateRange]);
  const appointments = useMemo(
    () => ghlRows.filter((c) => ["appointment", "water test"].includes(c.type?.toLowerCase() ?? "")),
    [ghlRows],
  );

  // ── Change log sources ───────────────────────────────────────────────────
  const { data: updates = [] } = useQuery({
    queryKey: ["campaign-updates", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_updates")
        .select("*")
        .eq("account_name", accountName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: creatives = [] } = useQuery({
    queryKey: ["creatives", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creatives")
        .select("*")
        .eq("account_name", accountName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["creative-requests", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_requests")
        .select("*")
        .eq("account_name", accountName)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const timeline = useMemo(() => buildTimeline(updates, creatives, requests), [updates, creatives, requests]);
  const periodTimeline = useMemo(() => timelineInRange(timeline, dateRange), [timeline, dateRange]);
  const annotations = useMemo(() => chartAnnotations(periodTimeline), [periodTimeline]);

  // ── KPIs: one definition, shared with the account page (lib/accountKpis) ──
  const { settings } = useSettings();
  const enabledKeys = useMemo(
    () => ALL_KPIS.filter((k) => settings.enabled_kpis.includes(k.key)).map((k) => k.key),
    [settings.enabled_kpis],
  );
  const kpis = useMemo(() => computeAccountKpis(adRows, ghlRows), [adRows, ghlRows]);
  const series = useMemo(() => buildKpiSeries(adRows, ghlRows), [adRows, ghlRows]);
  const untracked = useMemo(() => untrackedKpis(adRows), [adRows]);

  // Change vs the same number of days just before, withheld per source when
  // that source doesn't hold those days (no fake jump "from 0").
  const prior = useMemo(() => previousPeriod(dateRange), [dateRange]);
  const coverage = useMemo(() => priorCoverage(prior, ghlRaw), [prior, ghlRaw]);
  const priorKpis = useMemo(
    () => (prior ? computeAccountKpis(adRowsInRange(accountAdRows, prior), ghlRowsInRange(ghlRaw, prior)) : null),
    [prior, accountAdRows, ghlRaw],
  );

  const sections: ReportSection[] = [
    { id: "overview", label: "Overview" },
    { id: "appointments", label: "Appointments" },
    ...(periodTimeline.length > 0 ? [{ id: "changes", label: "What we changed" }] : []),
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <ReportHeader
        accountName={accountName}
        presets={presets}
        presetValue={presetValue}
        range={dateRange}
        onPreset={(p) => {
          setPresetValue(p.value);
          setDateRange(p.range);
        }}
        onCustomRange={(r) => {
          setPresetValue("custom");
          setDateRange(r);
        }}
        sections={sections}
      />

      <main className="mx-auto max-w-5xl space-y-12 px-4 py-8 sm:px-8 sm:py-10">
        <ReportOverview
          enabledKeys={enabledKeys}
          kpis={kpis}
          priorKpis={priorKpis}
          coverage={coverage}
          compare={prior ? comparisonLabel(prior) : null}
          series={series}
          annotations={annotations}
          rangeLabel={rangeLabel}
          adLoading={adLoading}
          ghlLoading={ghlLoading}
          ghlUnmapped={ghlUnmapped}
          metaDown={metaDown}
          metaError={metaError}
          onRetryMeta={() => refetchAds()}
          retryingMeta={adFetching}
          untracked={untracked}
        />
        <ReportAppointments
          accountId={accountId}
          appointments={appointments}
          leads={ghlRaw}
          loading={ghlLoading}
          unmapped={ghlUnmapped}
        />
        {periodTimeline.length > 0 && <ReportChangeLog items={periodTimeline} />}
      </main>

      <footer className="border-t border-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">
        Prepared by Treat Engine. Ad metrics come from Meta Ads; leads, appointments and sales from GoHighLevel.
      </footer>
    </div>
  );
}
