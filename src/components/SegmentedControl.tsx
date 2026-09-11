import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

/**
 * The one segmented switch (a Radix single-select toggle group: arrow keys move
 * between options, the choice is announced). Surface tokens only, so the
 * selected state reads the same in light and dark; the shadcn toggle's
 * `--accent` fill is gray in light and green in dark.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "sm",
  className,
}: {
  value: T;
  onChange: (v: NoInfer<T>) => void;
  options: { value: NoInfer<T>; label: string; disabled?: boolean; title?: string }[];
  /** Accessible name for the group. */
  label: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix sends "" when the active item is clicked again; keep the selection.
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          title={o.title}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-md font-medium text-muted-foreground transition-colors",
            size === "xs" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-40",
            "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
