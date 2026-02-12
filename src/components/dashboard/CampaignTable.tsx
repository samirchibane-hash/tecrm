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
  entries: number;
}

export function CampaignTable({ data }: CampaignTableProps) {
  const campaigns = useMemo(() => {
    const map: Record<string, CampaignSummary> = {};
    data.forEach((row) => {
      const key = `${row["Account name"]}__${row["Campaign name"] ?? "Unknown"}`;
      if (!map[key]) {
        map[key] = {
          campaign: row["Campaign name"] ?? "Unknown",
          account: row["Account name"],
          totalSpend: 0,
          entries: 0,
        };
      }
      map[key].totalSpend += row.spend ?? 0;
      map[key].entries += 1;
    });
    return Object.values(map).sort((a, b) => b.totalSpend - a.totalSpend);
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
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead className="text-right">Entries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.campaign}</TableCell>
                  <TableCell className="text-muted-foreground">{c.account}</TableCell>
                  <TableCell className="text-right font-mono">
                    ${c.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">{c.entries}</TableCell>
                </TableRow>
              ))}
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
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
