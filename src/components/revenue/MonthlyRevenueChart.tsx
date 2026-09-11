import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCount, formatUsd, formatUsdCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthBucket } from "./revenueMath";

const chartConfig: ChartConfig = {
  net: { label: "Net collected", color: "hsl(var(--chart-1))" },
};

/**
 * Net collected per month — one series, so no legend: the title names it.
 * The running month is drawn lighter and labelled "to date" in the tooltip
 * and the table, never extrapolated.
 */
export function MonthlyRevenueChart({ buckets, periodLabel }: { buckets: MonthBucket[]; periodLabel: string }) {
  const [tableOpen, setTableOpen] = useState(false);
  const hasPartial = buckets.some((b) => b.partial);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle className="text-base font-semibold">Net collected by month</CardTitle>
          <p className="text-xs text-muted-foreground">
            Stripe payments minus refunds · {periodLabel}
            {hasPartial && " · lighter bar = month to date"}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full sm:h-[280px]">
          <BarChart data={buckets} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={48}
              tickFormatter={(v: number) => formatUsdCompact(v, { cents: true })}
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
              content={({ active, payload }) => {
                const b = active && payload?.[0]?.payload as MonthBucket | undefined;
                if (!b) return null;
                return (
                  <div className="min-w-[180px] rounded-lg border border-border bg-popover p-2.5 text-xs text-popover-foreground shadow-md">
                    <p className="mb-1.5 font-medium">
                      {b.label}
                      {b.partial && <span className="font-normal text-muted-foreground"> · to date</span>}
                    </p>
                    <TooltipRow label="Net collected" value={formatUsd(b.net, { cents: true })} strong />
                    <TooltipRow label="Gross" value={formatUsd(b.gross, { cents: true })} />
                    {b.refunded > 0 && <TooltipRow label="Refunded" value={`−${formatUsd(b.refunded, { cents: true })}`} />}
                    <TooltipRow label="Payments" value={formatCount(b.payments)} />
                  </div>
                );
              }}
            />
            <Bar dataKey="net" fill="var(--color-net)" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {buckets.map((b) => (
                <Cell key={b.key} fillOpacity={b.partial ? 0.4 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <Collapsible open={tableOpen} onOpenChange={setTableOpen} className="mt-3">
          <CollapsibleTrigger className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", tableOpen && "rotate-180")} />
            {tableOpen ? "Hide" : "Show"} monthly table
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Month</th>
                    <th className="px-3 py-2 text-right font-medium">Gross</th>
                    <th className="px-3 py-2 text-right font-medium">Refunded</th>
                    <th className="px-3 py-2 text-right font-medium">Net</th>
                    <th className="px-3 py-2 text-right font-medium">Payments</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {[...buckets].reverse().map((b) => (
                    <tr key={b.key} className="border-t border-border/60">
                      <td className="px-3 py-1.5 text-left">
                        {b.label}
                        {b.partial && <span className="text-muted-foreground"> (to date)</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">{formatUsd(b.gross, { cents: true })}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">
                        {b.refunded ? `−${formatUsd(b.refunded, { cents: true })}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium">{formatUsd(b.net, { cents: true })}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{formatCount(b.payments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function TooltipRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold")}>{value}</span>
    </div>
  );
}
