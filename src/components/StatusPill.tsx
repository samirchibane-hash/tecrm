import { cn } from "@/lib/utils";

export type Status = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Status, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

/**
 * The shared status label. Color comes only from the semantic `status`, and
 * the label always carries the meaning in words — never color alone.
 */
export function StatusPill({ status, children, className }: { status: Status; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        TONE[status],
        className,
      )}
    >
      {children}
    </span>
  );
}
