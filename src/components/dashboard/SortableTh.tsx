import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDir } from "@/lib/kpiSort";

interface SortableThProps {
  children: ReactNode;
  /** This column's sort direction, or null when another column is sorted. */
  active: SortDir | null;
  onSort: () => void;
  align?: "left" | "right";
  title?: string;
}

/** Table header that sorts its column; click again to flip the direction. */
export function SortableTh({ children, active, onSort, align = "right", title }: SortableThProps) {
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <th
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
      className={`p-0 text-xs font-medium ${align === "right" ? "text-right" : "text-left"}`}
      title={title}
    >
      <button
        type="button"
        onClick={onSort}
        className={`group/sort inline-flex w-full items-center gap-1 py-3 px-4 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          align === "right" ? "justify-end" : "justify-start"
        } ${active ? "text-foreground" : "text-muted-foreground"}`}
      >
        {children}
        <Icon
          aria-hidden
          className={`h-3 w-3 shrink-0 ${active ? "" : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60"}`}
        />
      </button>
    </th>
  );
}
