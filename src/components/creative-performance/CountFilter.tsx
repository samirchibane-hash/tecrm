import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AMOUNT_OP_LABEL, OP_LABEL, type CountFilterValue, type CountOp } from "./countThreshold";

/** "More than / Fewer than X" on a count (leads, appointments), or "More / Less than $X" with `money`. */
export function CountFilter({
  value,
  onChange,
  noun,
  anyLabel,
  money = false,
}: {
  value: CountFilterValue;
  onChange: (v: CountFilterValue) => void;
  /** Lowercase plural, e.g. "website leads". */
  noun: string;
  /** Label when off, e.g. "Any lead count". */
  anyLabel: string;
  /** A dollar amount (spend): "Less than", a $ prefix. */
  money?: boolean;
}) {
  const labels = money ? AMOUNT_OP_LABEL : OP_LABEL;
  return (
    <div className="flex items-center gap-1.5">
      <Select value={value.op} onValueChange={(op) => onChange({ ...value, op: op as CountOp })}>
        <SelectTrigger className="h-8 w-[140px] text-xs" aria-label={`Filter by ${noun}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any" className="text-xs">{anyLabel}</SelectItem>
          <SelectItem value="gt" className="text-xs">{labels.gt}</SelectItem>
          <SelectItem value="lt" className="text-xs">{labels.lt}</SelectItem>
        </SelectContent>
      </Select>
      {value.op !== "any" && (
        <>
          {money && <span className="text-xs text-muted-foreground">$</span>}
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={value.count}
            onChange={(e) => onChange({ ...value, count: e.target.value })}
            placeholder="0"
            className={money ? "h-8 w-20 text-xs tabular-nums" : "h-8 w-16 text-xs tabular-nums"}
            aria-label={money ? `${labels[value.op]} how much ${noun}` : `${labels[value.op]} how many ${noun}`}
          />
          <span className="text-xs text-muted-foreground">{noun}</span>
        </>
      )}
    </div>
  );
}
