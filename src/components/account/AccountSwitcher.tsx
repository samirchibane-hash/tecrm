import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAllAccounts } from "@/hooks/useAllAccounts";
import { useSettings } from "@/hooks/useSettings";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

const stepClass =
  "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

/**
 * The client's name is the switcher: click it (or ⌘K) to jump to any client,
 * or step through them with the arrows (or [ and ]). The tab and period you're
 * on carry over, so comparing two clients' funnels is one keystroke, not a trip
 * back to the dashboard. Clients hidden from the dashboard are listed last.
 */
export function AccountSwitcher({ accountName }: { accountName: string }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { data: accounts = [] } = useAllAccounts();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);

  const { visible, hidden } = useMemo(() => {
    const hiddenSet = new Set(settings.hidden_accounts ?? []);
    const names = accounts.map((a) => a.account_name).sort((a, b) => a.localeCompare(b));
    return { visible: names.filter((n) => !hiddenSet.has(n)), hidden: names.filter((n) => hiddenSet.has(n)) };
  }, [accounts, settings.hidden_accounts]);

  const go = (name: string) => {
    setOpen(false);
    if (name !== accountName) navigate(`/account/${encodeURIComponent(name)}${search}`);
  };

  // Steps walk the dashboard's clients; from a hidden one they start at the top.
  const at = visible.indexOf(accountName);
  const prev = visible.length > 1 ? visible[(at <= 0 ? visible.length : at) - 1] : null;
  const next = visible.length > 1 ? visible[(at + 1) % visible.length] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || open) return;
      if (e.key === "[" && prev) navigate(`/account/${encodeURIComponent(prev)}${search}`);
      if (e.key === "]" && next) navigate(`/account/${encodeURIComponent(next)}${search}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, search, navigate, open]);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group -ml-1.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${accountName}. Switch client`}
            title="Switch client (⌘K)"
          >
            <h1 className="truncate text-xl font-bold text-foreground">{accountName}</h1>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Find a client…" />
            <CommandList className="max-h-80">
              <CommandEmpty>No client by that name.</CommandEmpty>
              <CommandGroup heading="Clients">
                {visible.map((name) => (
                  <CommandItem key={name} value={name} onSelect={() => go(name)}>
                    <Check className={cn("mr-2 h-4 w-4", name === accountName ? "opacity-100" : "opacity-0")} aria-hidden />
                    <span className="truncate">{name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {hidden.length > 0 && (
                <CommandGroup heading="Hidden from dashboard">
                  {hidden.map((name) => (
                    <CommandItem key={name} value={name} onSelect={() => go(name)} className="text-muted-foreground">
                      <Check className={cn("mr-2 h-4 w-4", name === accountName ? "opacity-100" : "opacity-0")} aria-hidden />
                      <span className="truncate">{name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            <p className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
              <kbd className="font-mono">[</kbd> / <kbd className="font-mono">]</kbd> previous / next client · <kbd className="font-mono">⌘K</kbd> this list
            </p>
          </Command>
        </PopoverContent>
      </Popover>
      <button type="button" className={stepClass} disabled={!prev} onClick={() => prev && go(prev)} aria-label={prev ? `Previous client: ${prev}` : "Previous client"} title={prev ? `${prev} ( [ )` : undefined}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className={stepClass} disabled={!next} onClick={() => next && go(next)} aria-label={next ? `Next client: ${next}` : "Next client"} title={next ? `${next} ( ] )` : undefined}>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
