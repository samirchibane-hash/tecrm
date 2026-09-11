import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { ClipboardList, ListTodo } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

// Annotations are secondary to the metric, so they share one recessive colour and
// distinguish task vs. creative brief by icon + label — never by colour alone.
const ANNOTATION_COLOR = "hsl(var(--muted-foreground))";

export type ChartAnnotationItem = {
  kind: "task" | "brief";
  label: string;
  detail: string | null;
};

export type ChartAnnotation = {
  date: string;
  items: ChartAnnotationItem[];
};

const ANNOTATION_ICON = { task: ListTodo, brief: ClipboardList } as const;

/** One KPI over time, marked with the days tasks were completed and briefs moved. */
export function KpiAreaChart({ data, label, caption, formatValue, annotations = [] }: {
  data: { date: string; value: number }[];
  label: string;
  caption?: string;
  formatValue: (v: number) => string;
  annotations?: ChartAnnotation[];
}) {
  const gradId = `grad-acct-${label.replace(/\s+/g, "")}`;

  const mergedData = useMemo(() => {
    if (annotations.length === 0) return data;
    const dateSet = new Set(data.map((d) => d.date));
    const extras = annotations
      .filter((a) => !dateSet.has(a.date))
      .map((a) => ({ date: a.date, value: null as unknown as number }));
    if (extras.length === 0) return data;
    return [...data, ...extras].sort((a, b) => a.date.localeCompare(b.date));
  }, [data, annotations]);

  // The charted series can switch on its own when a feed drops out — always name it.
  const header = (
    <div className="mb-1 px-1">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {caption && <p className="text-[11px] text-muted-foreground">{caption}</p>}
    </div>
  );

  if (data.length === 0 && annotations.length === 0) {
    return (
      <Card className="border-border/50 bg-card shadow-sm">
        <CardContent className="px-4 pb-3 pt-4">
          {header}
          <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
            No data for this period
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-border/50 bg-card shadow-sm">
      <CardContent className="px-4 pb-3 pt-4">
        {header}
        <ChartContainer config={{ value: { label, color: "hsl(var(--chart-1))" } }} className="h-[200px] w-full">
          <AreaChart data={mergedData} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => { const p = v.split("-"); return `${parseInt(p[1])}/${parseInt(p[2])}`; }}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatValue} width={60} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
              content={({ active, payload, label: hoverDate }) => {
                if (!active) return null;
                const val = payload?.[0]?.value as number | null | undefined;
                const dayAnn = annotations.find((a) => a.date === hoverDate);
                if (val == null && !dayAnn) return null;
                return (
                  <div className="rounded-lg border border-border bg-background p-2.5 shadow-md text-xs min-w-[160px] max-w-[240px]">
                    <p className="text-muted-foreground mb-1">{hoverDate}</p>
                    {val != null && <p className="font-semibold mb-1">{formatValue(val)} <span className="font-normal text-muted-foreground">{label}</span></p>}
                    {dayAnn && (
                      <div className={cn("space-y-1", val != null && "mt-1.5 pt-1.5 border-t border-border")}>
                        {dayAnn.items.map((item, i) => {
                          const Icon = ANNOTATION_ICON[item.kind];
                          return (
                            <div key={i} className="flex items-start gap-1.5">
                              <Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="text-muted-foreground leading-tight">
                                <span className="font-medium text-foreground">{item.label}</span>
                                {item.detail ? ` — ${item.detail.slice(0, 70)}${item.detail.length > 70 ? "…" : ""}` : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {annotations.map((ann) => (
              <ReferenceLine
                key={ann.date}
                x={ann.date}
                stroke={ANNOTATION_COLOR}
                strokeDasharray="3 3"
                strokeWidth={1.5}
                strokeOpacity={0.5}
                label={({ viewBox }: { viewBox?: { x?: number; y?: number } }) => {
                  const x = viewBox?.x;
                  const y = (viewBox?.y ?? 0) + 8;
                  if (x == null) return <g />;
                  return (
                    <g>
                      <circle cx={x} cy={y} r={5} fill={ANNOTATION_COLOR} stroke="hsl(var(--background))" strokeWidth={2} />
                      {ann.items.length > 1 && (
                        <text x={x} y={y + 3.5} textAnchor="middle" fontSize={7} fill="hsl(var(--background))" fontWeight="bold">{ann.items.length}</text>
                      )}
                    </g>
                  );
                }}
              />
            ))}
            <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} fill={`url(#${gradId})`} connectNulls dot={false} />
          </AreaChart>
        </ChartContainer>
        {annotations.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
            <span className="font-medium">Markers</span>
            <span className="flex items-center gap-1"><ListTodo className="h-3 w-3" /> Task completed</span>
            <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" /> Creative brief</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
