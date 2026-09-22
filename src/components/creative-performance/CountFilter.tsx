import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OP_LABEL, type CountFilterValue, type CountOp } from "./countThreshold";

/** "More than / Fewer than X" on a per-ad count (leads, appointments). */
export function CountFilter({
  value,
  onChange,
  noun,
  anyLabel,
}: {
  value: CountFilterValue;
  onChange: (v: CountFilterValue) => void;
  /** Lowercase plural, e.g. "website leads". */
  noun: string;
  /** Label when off, e.g. "Any lead count". */
  anyLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Select value={value.op} onValueChange={(op) => onChange({ ...value, op: op as CountOp })}>
        <SelectTrigger className="h-8 w-[140px] text-xs" aria-label={`Filter by ${noun}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any" className="text-xs">{anyLabel}</SelectItem>
          <SelectItem value="gt" className="text-xs">{OP_LABEL.gt}</SelectItem>
          <SelectItem value="lt" className="text-xs">{OP_LABEL.lt}</SelectItem>
        </SelectContent>
      </Select>
      {value.op !== "any" && (
        <>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={value.count}
            onChange={(e) => onChange({ ...value, count: e.target.value })}
            placeholder="0"
            className="h-8 w-16 text-xs tabular-nums"
            aria-label={`${OP_LABEL[value.op]} how many ${noun}`}
          />
          <span className="text-xs text-muted-foreground">{noun}</span>
        </>
      )}
    </div>
  );
}
