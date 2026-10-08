import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KpiSortOption, SortDir } from "@/lib/kpiSort";

/**
 * "Sort: Cost / lead ↑" for a list of cards. Picking a KPI applies its natural
 * direction (costs cheapest first, the rest highest first); the arrow flips it.
 */
export function KpiSortControl<K extends string>({
  options,
  value,
  dir,
  onChange,
}: {
  options: KpiSortOption<K>[];
  value: K;
  dir: SortDir;
  onChange: (key: K, dir: SortDir) => void;
}) {
  const current = options.find((o) => o.key === value) ?? options[0];
  const dirText = dir === "asc" ? "Lowest first" : "Highest first";
  return (
    <div className="flex items-center gap-1">
      <Select
        value={current.key}
        onValueChange={(k) => onChange(k as K, options.find((o) => o.key === k)?.dir ?? "desc")}
      >
        <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Sort by">
          <span className="truncate">
            <span className="text-muted-foreground">Sort: </span>
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onChange(current.key, dir === "asc" ? "desc" : "asc")}
        aria-label={`${dirText}. Reverse the order`}
        title={`${dirText} · click to reverse`}
      >
        {dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
