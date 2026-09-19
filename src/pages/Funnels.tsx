import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardPeriodPicker } from "@/components/dashboard/DashboardPeriodPicker";
import { FunnelsBoard } from "@/components/funnels/FunnelsBoard";
import { useDashboardPeriod } from "@/hooks/useDashboardPeriod";

/**
 * Funnels: every landing page the agency runs, in one list, with the
 * performance, ads, copy history and split tests behind each one.
 *
 * The page wires data to the board and owns only the period control — the
 * board and its cards live in components/funnels. The period is the same
 * control the Performance dashboard uses, so a range means the same days on
 * both screens. It opens on the last 28 days, the nearest this control offers
 * to the 30 days this page used to default to.
 */
export default function Funnels() {
  const { dateRange, label, creativeRange, onChange } = useDashboardPeriod("last_28d");

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
        actions={<DashboardPeriodPicker dateRange={dateRange} label={label} onChange={onChange} />}
      />

      <FunnelsBoard
        range={creativeRange}
        periodCaption={label}
        accounts={accounts.map((a) => ({ id: a.id, account_name: a.account_name, target_cpl: a.target_cpl }))}
        hiddenAccounts={settings?.hidden_accounts ?? []}
      />
    </div>
  );
}
