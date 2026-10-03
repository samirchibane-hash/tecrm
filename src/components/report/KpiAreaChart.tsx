import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { CATEGORY_CHART_COLOR } from "./reportConfig";
import type { ChartAnnotation } from "./timeline";

const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
};

/**
 * One metric per day, with change-log markers. A single series, so no legend:
 * the title names it and the caption names its source and period (rule #5).
 */
export function KpiAreaChart({
  data,
  title,
  caption,
  formatValue,
  annotations = [],
}: {
  data: { date: string; value: number }[];
  title: string;
  caption: string;
  formatValue: (v: number) => string;
  annotations?: ChartAnnotation[];
}) {
  const chartConfig: ChartConfig = { value: { label: title, color: "hsl(var(--chart-1))" } };
  const gradId = `grad-${useId().replace(/:/g, "")}`;

  // Annotation days missing from the series are added with a null value so a
  // marker can anchor there. connectNulls only bridges those anchor points; it
  // adds no value of its own.
  const merged = useMemo(() => {
    const dates = new Set(data.map((d) => d.date));
    const extras = annotations
      .filter((a) => !dates.has(a.date))
      .map((a) => ({ date: a.date, value: null as number | null }));
    return extras.length ? [...data, ...extras].sort((a, b) => a.date.localeCompare(b.date)) : data;
  }, [data, annotations]);

  const empty = data.length === 0;

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
      {empty ? (
        <div className="flex h-[200px] items-center justify-center px-5 text-sm text-muted-foreground">
          No {title.toLowerCase()} recorded in this period.
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-[220px] w-full px-2 pb-3 pt-2 sm:h-[260px]">
          <AreaChart data={merged} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} className="stroke-border/70" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tick={{ fontSize: 11 }}
              tickFormatter={shortDate}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={formatValue} width={64} />
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              content={({ active, payload, label: day }) => {
                if (!active) return null;
                const val = payload?.[0]?.value as number | null | undefined;
                const notes = annotations.find((a) => a.date === day)?.updates ?? [];
                if (val == null && notes.length === 0) return null;
                return (
                  <div className="min-w-[180px] max-w-[260px] rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md">
                    <p className="mb-1 text-muted-foreground">{day}</p>
                    {val != null && (
                      <p className="font-semibold tabular-nums text-foreground">
                        {formatValue(val)} <span className="font-normal text-muted-foreground">{title.toLowerCase()}</span>
                      </p>
                    )}
                    {notes.length > 0 && (
                      <ul className={cn("space-y-1.5", val != null && "mt-1.5 border-t border-border pt-1.5")}>
                        {notes.map((u, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span
                              aria-hidden
                              className="mt-1 h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: CATEGORY_CHART_COLOR[u.category] ?? CATEGORY_CHART_COLOR.other }}
                            />
                            <span className="leading-tight text-muted-foreground">
                              <span className="font-medium text-foreground">{u.campaign_name}</span>
                              {u.details ? ` — ${u.details.slice(0, 80)}${u.details.length > 80 ? "…" : ""}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }}
            />
            {annotations.map((ann) => {
              const color = CATEGORY_CHART_COLOR[ann.updates[0]?.category ?? "other"] ?? CATEGORY_CHART_COLOR.other;
              const count = ann.updates.length;
              return (
                <ReferenceLine
                  key={ann.date}
                  x={ann.date}
                  stroke={color}
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                  label={({ viewBox }: { viewBox?: { x?: number; y?: number } }) => {
                    const x = viewBox?.x;
                    const y = (viewBox?.y ?? 0) + 8;
                    if (x == null) return <g />;
                    return (
                      <g>
                        <circle cx={x} cy={y} r={7} fill={color} stroke="hsl(var(--card))" strokeWidth={2} />
                        {count > 1 && (
                          <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fill="hsl(var(--card))" fontWeight="bold">
                            {count}
                          </text>
                        )}
                      </g>
                    );
                  }}
                />
              );
            })}
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill={`url(#${gradId})`}
              connectNulls
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            />
          </AreaChart>
        </ChartContainer>
      )}
      {annotations.length > 0 && !empty && (
        <p className="border-t border-border/70 px-5 py-2.5 text-xs text-muted-foreground">
          Dots mark days we changed something. Hover one to see what.
        </p>
      )}
    </div>
  );
}
