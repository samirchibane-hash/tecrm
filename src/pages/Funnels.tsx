import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardPeriodPicker } from "@/components/dashboard/DashboardPeriodPicker";
import { FunnelsBoard } from "@/components/funnels/FunnelsBoard";
import { useAllAccounts } from "@/hooks/useAllAccounts";
import { useDashboardPeriod } from "@/hooks/useDashboardPeriod";
import { useSettings } from "@/hooks/useSettings";

/**
 * Funnels: every landing page the agency runs, in one list, with the
 * performance, ads, copy history and split tests behind each one.
 *
 * The page wires data to the board and owns only the period control — the
 * board and its cards live in components/funnels, and the account page shows
 * the same board scoped to one client. The period is the same control every
 * screen uses, opening on the same month-to-date, so a range means the same
 * days everywhere.
 */
export default function Funnels() {
  const { dateRange, label, creativeRange, onChange } = useDashboardPeriod();
  const { data: accounts = [] } = useAllAccounts();
  // Clients hidden from the Performance dashboard stay hidden here: one setting,
  // one meaning, so a hidden client can't reappear on another screen.
  const { settings } = useSettings();

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
        accounts={accounts}
        hiddenAccounts={settings.hidden_accounts ?? []}
      />
    </div>
  );
}
