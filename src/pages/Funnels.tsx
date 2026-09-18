import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { FunnelsBoard } from "@/components/funnels/FunnelsBoard";
import type { CreativePreset, CreativeRange } from "@/components/creative-performance/useCreativePerformance";

const PRESETS: { value: CreativePreset; label: string }[] = [
  { value: "last_7d", label: "7 days" },
  { value: "last_14d", label: "14 days" },
  { value: "last_30d", label: "30 days" },
  { value: "this_month", label: "This month" },
  { value: "maximum", label: "All time" },
];

const CAPTION: Record<string, string> = {
  last_7d: "Last 7 days",
  last_14d: "Last 14 days",
  last_30d: "Last 30 days",
  this_month: "This month",
  maximum: "All time",
};

/**
 * Funnels: every landing page the agency runs, in one list, with the
 * performance, ads, copy history and split tests behind each one.
 *
 * The page wires data to the board and owns only the period control — the
 * board and its cards live in components/funnels.
 */
export default function Funnels() {
  const [preset, setPreset] = useState<CreativePreset>("last_30d");
  const range = useMemo((): CreativeRange => ({ preset }), [preset]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["all-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, account_name, target_cpl, target_cpa");
      return data ?? [];
    },
  });

  // Clients hidden from the Performance dashboard stay hidden here: one setting,
  // one meaning, so a hidden client can't reappear on another screen.
  const { data: settings } = useQuery({
    queryKey: ["dashboard-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("dashboard_settings").select("hidden_accounts").maybeSingle();
      return data;
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="Funnels"
        description="Every landing page, what it says, what it earns, and what's being tested on it."
        actions={
          <SegmentedControl<CreativePreset>
            value={preset}
            onChange={setPreset}
            options={PRESETS}
            label="Reporting period"
          />
        }
      />

      <FunnelsBoard
        range={range}
        periodCaption={CAPTION[preset] ?? preset}
        accounts={accounts.map((a) => ({ id: a.id, account_name: a.account_name, target_cpl: a.target_cpl }))}
        hiddenAccounts={settings?.hidden_accounts ?? []}
      />
    </div>
  );
}
