import { useEffect, useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { APPT_STATUSES, apptStatusMeta, type ApptStatus } from "./reportConfig";

/** The outcome picker. The label carries the meaning; color only reinforces it. */
export function OutcomeSelect({
  value,
  onChange,
  contactName,
  className,
}: {
  value: string | null;
  onChange: (status: ApptStatus | "") => void;
  contactName: string;
  className?: string;
}) {
  const meta = apptStatusMeta(value);
  return (
    <Select value={meta?.value ?? ""} onValueChange={(v) => onChange(v as ApptStatus)}>
      <SelectTrigger
        className={cn("h-9 rounded-lg text-[13px]", className)}
        aria-label={`Outcome for ${contactName}${meta ? `: ${meta.label}` : ""}`}
      >
        <SelectValue placeholder="Set outcome">
          {meta ? <StatusPill status={meta.status}>{meta.label}</StatusPill> : <span className="text-muted-foreground">Set outcome</span>}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {APPT_STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            <StatusPill status={s.status}>{s.label}</StatusPill>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A dollar amount saved on blur. Holds its own draft until then. */
export function DealValueField({
  saved,
  onSave,
  contactName,
  className,
}: {
  saved: number | null;
  onSave: (value: number | null) => void;
  contactName: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(saved != null ? String(saved) : "");
  useEffect(() => setDraft(saved != null ? String(saved) : ""), [saved]);

  return (
    <div className={cn("relative flex items-center", className)}>
      <span aria-hidden className="pointer-events-none absolute left-2.5 text-[13px] text-muted-foreground">$</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        aria-label={`Deal value for ${contactName}`}
        placeholder="Deal value"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const raw = draft.trim();
          const next = raw === "" ? null : parseFloat(raw);
          if (next !== null && isNaN(next)) return;
          if (next !== saved) onSave(next);
        }}
        className="h-9 w-full rounded-lg border border-input bg-card pl-6 pr-3 text-[13px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
