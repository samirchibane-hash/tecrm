import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdRow } from "@/hooks/useCouplerData";

interface CampaignTableProps {
  data: AdRow[];
}

interface CampaignSummary {
  campaign: string;
  account: string;
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  totalReach: number;
  avgCTR: number;
  avgCPC: number;
  entries: number;
}

export function CampaignTable({ data }: CampaignTableProps) {
  const campaigns = useMemo(() => {
    const map: Record<string, CampaignSummary> = {};
    data.forEach((row) => {
      const key = `${row["Account: Account name"]}__${row["Campaign: Campaign name"]}`;
      if (!map[key]) {
        map[key] = {
          campaign: row["Campaign: Campaign name"],
          account: row["Account: Account name"],
          totalSpend: 0,
          totalClicks: 0,
          totalImpressions: 0,
          totalReach: 0,
          avgCTR: 0,
          avgCPC: 0,
          entries: 0,
        };
      }
      map[key].totalSpend += row["Cost: Amount spend"] ?? 0;
      map[key].totalClicks += row["Performance: Clicks"] ?? 0;
      map[key].totalImpressions += row["Performance: Impressions"] ?? 0;
      map[key].totalReach += row["Performance: Reach"] ?? 0;
      map[key].avgCTR += row["Clicks: CTR"] ?? 0;
      map[key].avgCPC += row["Cost: CPC"] ?? 0;
      map[key].entries += 1;
    });
    return Object.values(map)
      .map((c) => ({
        ...c,
        avgCTR: c.entries > 0 ? c.avgCTR / c.entries : 0,
        avgCPC: c.entries > 0 ? c.avgCPC / c.entries : 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [data]);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Campaign Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-md border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Campaign</TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Clicks</TableHead>
                <TableHead className="text-right hidden md:table-cell">Impressions</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">CPC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium max-w-[140px] truncate">{c.campaign}</TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{c.account}</TableCell>
                  <TableCell className="text-right font-mono">
                    ${c.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{c.totalClicks.toLocaleString()}</TableCell>
                  <TableCell className="text-right hidden md:table-cell">{c.totalImpressions.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{c.avgCTR.toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-mono">${c.avgCPC.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No campaign data found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
