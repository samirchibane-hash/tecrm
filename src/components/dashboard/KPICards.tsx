import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, MousePointerClick, Eye, Users, TrendingUp, BarChart3 } from "lucide-react";

interface KPICardsProps {
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  totalReach: number;
  avgCTR: number;
  avgCPC: number;
}

const kpiConfig = [
  {
    label: "Total Spend",
    icon: DollarSign,
    format: (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    key: "totalSpend" as const,
  },
  {
    label: "Total Clicks",
    icon: MousePointerClick,
    format: (v: number) => v.toLocaleString(),
    key: "totalClicks" as const,
  },
  {
    label: "Impressions",
    icon: Eye,
    format: (v: number) => v.toLocaleString(),
    key: "totalImpressions" as const,
  },
  {
    label: "Reach",
    icon: Users,
    format: (v: number) => v.toLocaleString(),
    key: "totalReach" as const,
  },
  {
    label: "Avg CTR",
    icon: TrendingUp,
    format: (v: number) => `${v.toFixed(2)}%`,
    key: "avgCTR" as const,
  },
  {
    label: "Avg CPC",
    icon: BarChart3,
    format: (v: number) => `$${v.toFixed(2)}`,
    key: "avgCPC" as const,
  },
];

export function KPICards(props: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpiConfig.map(({ label, icon: Icon, format, key }) => (
        <Card key={key} className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-1 truncate text-2xl font-bold tracking-tight">{format(props[key])}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
