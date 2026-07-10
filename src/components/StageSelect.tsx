import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGE_STEPS, STAGE_LABEL, STAGE_DOT } from "@/lib/stages";

interface Props {
  value: string;
  onChange: (stage: string) => void;
  disabled?: boolean;
  className?: string;
}

// Shared stage picker for Creative Requests and Tasks — a coloured-dot dropdown
// over the four pipeline stages (Assigned → Reviewing → Approved → Launched).
export function StageSelect({ value, onChange, disabled, className }: Props) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("h-9 w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGE_STEPS.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", STAGE_DOT[s])} />
              {STAGE_LABEL[s]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
