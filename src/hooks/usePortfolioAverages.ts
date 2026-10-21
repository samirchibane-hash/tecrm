import { useMemo } from "react";
import { format, startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useCouplerData, useMetaGapAccounts } from "@/hooks/useCouplerData";
import { useAllAccounts } from "@/hooks/useAllAccounts";
import { useAllGhlConversions } from "@/hooks/useAccountGhlConversions";
import { useSettings } from "@/hooks/useSettings";
import { adRowsInRange, ghlRowsInRange } from "@/lib/accountKpis";
import { portfolioAverages, type PortfolioAverages } from "@/lib/portfolioAverages";

/**
 * The portfolio's averages for a period, over every client the dashboard shows
 * (hidden accounts out). Shares the Meta feed and account list caches with the
 * dashboard, so opening a client after the dashboard costs one GHL query.
 * Null while either source is still loading: a half-loaded average is wrong,
 * not approximate.
 */
export function usePortfolioAverages(dateRange: DateRange | undefined): PortfolioAverages | null {
  const { data: adRows, isLoading: metaLoading, isError: metaDown } = useCouplerData();
  const { data: accounts = [] } = useAllAccounts();
  const { settings } = useSettings();
  const metaGaps = useMetaGapAccounts();
  const since = format(startOfDay(dateRange?.from ?? subDays(new Date(), 180)), "yyyy-MM-dd");
  const { data: ghl, isLoading: ghlLoading } = useAllGhlConversions(since);

  return useMemo(() => {
    if (metaLoading || ghlLoading || !ghl || accounts.length === 0) return null;
    const hidden = settings.hidden_accounts ?? [];
    const rows = adRowsInRange(adRows ?? [], dateRange);
    const inRange = ghlRowsInRange(ghl, dateRange);
    return portfolioAverages(
      accounts
        .filter((a) => !hidden.includes(a.account_name))
        .map((a) => ({
          adRows: rows.filter((r) => r["Account: Account name"] === a.account_name),
          ghl: inRange.filter((c) => c.tecrm_id === a.id),
          spendKnown: !metaDown && !metaGaps.has(a.account_name),
        })),
    );
  }, [adRows, accounts, ghl, metaLoading, ghlLoading, metaDown, metaGaps, settings.hidden_accounts, dateRange]);
}
