import { useMemo } from "react";
import { useCouplerData } from "@/hooks/useCouplerData";
import { KPICards } from "@/components/dashboard/KPICards";
import { SpendChart } from "@/components/dashboard/SpendChart";
import { CampaignTable } from "@/components/dashboard/CampaignTable";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useCouplerData();

  const kpis = useMemo(() => {
    if (!data || data.length === 0)
      return { totalSpend: 0, totalClicks: 0, totalImpressions: 0, totalReach: 0, avgCTR: 0, avgCPC: 0 };

    const totalSpend = data.reduce((s, r) => s + (r["Cost: Amount spend"] ?? 0), 0);
    const totalClicks = data.reduce((s, r) => s + (r["Performance: Clicks"] ?? 0), 0);
    const totalImpressions = data.reduce((s, r) => s + (r["Performance: Impressions"] ?? 0), 0);
    const totalReach = data.reduce((s, r) => s + (r["Performance: Reach"] ?? 0), 0);
    const avgCTR = data.reduce((s, r) => s + (r["Clicks: CTR"] ?? 0), 0) / data.length;
    const avgCPC = data.reduce((s, r) => s + (r["Cost: CPC"] ?? 0), 0) / data.length;

    return { totalSpend, totalClicks, totalImpressions, totalReach, avgCTR, avgCPC };
  }, [data]);

  return (
    <div className="dark min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facebook Ads Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Live data from Coupler.io</p>
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
            <Skeleton className="h-[300px] rounded-xl" />
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

        {data && (
          <div className="space-y-6">
            <KPICards {...kpis} />
            <SpendChart data={data} />
            <CampaignTable data={data} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
