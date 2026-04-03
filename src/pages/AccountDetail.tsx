import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCouplerData } from "@/hooks/useCouplerData";
import { KPICards } from "@/components/dashboard/KPICards";
import { SpendChart } from "@/components/dashboard/SpendChart";
import { CampaignTable } from "@/components/dashboard/CampaignTable";
import { CampaignNotes } from "@/components/dashboard/CampaignNotes";
import { CampaignUpdates } from "@/components/dashboard/CampaignUpdates";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const AccountDetail = () => {
  const { accountName } = useParams<{ accountName: string }>();
  const decodedName = decodeURIComponent(accountName ?? "");
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useCouplerData();

  const accountData = useMemo(() => {
    if (!data) return [];
    return data.filter((row) => row["Account: Account name"] === decodedName);
  }, [data, decodedName]);

  const campaigns = useMemo(() => {
    const set = new Set<string>();
    accountData.forEach((row) => set.add(row["Campaign: Campaign name"]));
    return Array.from(set).sort();
  }, [accountData]);

  const kpis = useMemo(() => {
    if (accountData.length === 0)
      return { totalSpend: 0, totalClicks: 0, totalImpressions: 0, totalReach: 0, avgCTR: 0, avgCPC: 0 };

    const totalSpend = accountData.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
    const totalClicks = accountData.reduce((s, r) => s + (r["Performance: Clicks"] ?? 0), 0);
    const totalImpressions = accountData.reduce((s, r) => s + (r["Performance: Impressions"] ?? 0), 0);
    const totalReach = accountData.reduce((s, r) => s + (r["Performance: Reach"] ?? 0), 0);
    const avgCTR = accountData.reduce((s, r) => s + (r["Clicks: CTR"] ?? 0), 0) / accountData.length;
    const avgCPC = accountData.reduce((s, r) => s + (r["Cost: CPC"] ?? 0), 0) / accountData.length;

    return { totalSpend, totalClicks, totalImpressions, totalReach, avgCTR, avgCPC };
  }, [accountData]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">{decodedName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{campaigns.length} campaigns</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="w-fit">
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-[350px] rounded-xl" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-medium">Failed to load data</p>
            <p className="max-w-md text-sm text-muted-foreground">{(error as Error).message}</p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        )}

        {accountData.length > 0 && (
          <div className="space-y-6">
            <KPICards {...kpis} />
            <SpendChart data={accountData} />
            <CampaignTable data={accountData} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CampaignNotes accountName={decodedName} campaigns={campaigns} />
              <CampaignUpdates accountName={decodedName} campaigns={campaigns} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountDetail;
