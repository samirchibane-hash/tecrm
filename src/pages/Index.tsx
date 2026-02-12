import { useMemo } from "react";
import { useCouplerData } from "@/hooks/useCouplerData";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, ChevronRight, Users, DollarSign, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AccountSummary {
  name: string;
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  campaignCount: number;
}

const Index = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useCouplerData();
  const navigate = useNavigate();

  const accounts = useMemo(() => {
    if (!data || data.length === 0) return [];
    const map: Record<string, AccountSummary> = {};
    const campaignSets: Record<string, Set<string>> = {};

    data.forEach((row) => {
      const name = row["Account: Account name"];
      if (!map[name]) {
        map[name] = { name, totalSpend: 0, totalClicks: 0, totalImpressions: 0, campaignCount: 0 };
        campaignSets[name] = new Set();
      }
      map[name].totalSpend += row["Cost: Amount spend"] ?? 0;
      map[name].totalClicks += row["Performance: Clicks"] ?? 0;
      map[name].totalImpressions += row["Performance: Impressions"] ?? 0;
      campaignSets[name].add(row["Campaign: Campaign name"]);
    });

    return Object.values(map)
      .map((a) => ({ ...a, campaignCount: campaignSets[a.name].size }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Ad Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">Select an account to view campaign performance</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="w-fit">
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
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

        {accounts.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {accounts.map((account) => (
              <Card
                key={account.name}
                className="cursor-pointer border-border/60 transition-all hover:shadow-md hover:border-foreground/20 active:scale-[0.98]"
                onClick={() => navigate(`/account/${encodeURIComponent(account.name)}`)}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-foreground">{account.name}</h2>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5" />
                        ${account.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5" />
                        {account.totalClicks.toLocaleString()} clicks
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {account.campaignCount} campaigns
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
