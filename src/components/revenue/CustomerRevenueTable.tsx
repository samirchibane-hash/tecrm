import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill, type Status } from "@/components/StatusPill";
import { formatUsd } from "@/lib/format";
import { toast } from "sonner";
import { customerStatus, net, type CustomerStatus, type Payment, type Subscription } from "./revenueMath";
import type { RevenueCustomer } from "./useRevenueData";

const STATUS_PILL: Record<CustomerStatus, { status: Status; label: string }> = {
  active: { status: "success", label: "Active" },
  past_due: { status: "danger", label: "Past due" },
  paused: { status: "warning", label: "Paused" },
  trialing: { status: "info", label: "Trial" },
  ended: { status: "neutral", label: "No active plan" },
};

const PAGE = 12;
const UNLINKED = "__none__";

export function CustomerRevenueTable({
  payments,
  subscriptions,
  customers,
  accounts,
  periodLabel,
}: {
  payments: Payment[]; // already filtered to the period
  subscriptions: Subscription[];
  customers: RevenueCustomer[];
  accounts: { id: string; account_name: string }[];
  periodLabel: string;
}) {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const byCustomer = new Map<string, { net: number; last: string | null }>();
    for (const p of payments) {
      if (!p.customer_id) continue;
      const row = byCustomer.get(p.customer_id) ?? { net: 0, last: null };
      row.net += net(p);
      if (!row.last || p.paid_at > row.last) row.last = p.paid_at;
      byCustomer.set(p.customer_id, row);
    }
    const subsBy = new Map<string, Subscription[]>();
    for (const s of subscriptions) subsBy.set(s.customer_id, [...(subsBy.get(s.customer_id) ?? []), s]);

    return customers
      .map((c) => {
        const subs = subsBy.get(c.id) ?? [];
        const mrr = subs
          .filter((s) => (s.status === "active" || s.status === "past_due") && !s.collection_paused)
          .reduce((sum, s) => sum + s.mrr_cents, 0);
        return { ...c, net: byCustomer.get(c.id)?.net ?? 0, last: byCustomer.get(c.id)?.last ?? null, mrr, status: customerStatus(subs) };
      })
      // Customers with neither money in the period nor a live plan add noise.
      .filter((r) => r.net !== 0 || r.status !== "ended")
      .sort((a, b) => b.net - a.net || b.mrr - a.mrr);
  }, [payments, subscriptions, customers]);

  const filtered = query.trim()
    ? rows.filter((r) => `${r.name ?? ""} ${r.email ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : rows;
  const visible = showAll || query ? filtered : filtered.slice(0, PAGE);
  const unlinkedCount = rows.filter((r) => !r.account_id).length;

  const linkAccount = useMutation({
    mutationFn: async ({ customerId, accountId }: { customerId: string; accountId: string | null }) => {
      const { error } = await supabase.from("stripe_customers").update({ account_id: accountId }).eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["revenue"] }),
    onError: (err: Error) => toast.error(`Couldn't link account: ${err.message}`),
  });

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.account_name;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Revenue by customer</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Net collected · {periodLabel}
              {unlinkedCount > 0 && ` · ${unlinkedCount} not linked to a CRM account`}
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search customers"
              placeholder="Search customers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8 text-xs sm:w-56"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            {query ? "No customers match that search." : "No customer payments in this period."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-6 py-2 text-left font-medium">Customer</th>
                  <th className="px-3 py-2 text-left font-medium">CRM account</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">MRR</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Last paid</th>
                  <th className="whitespace-nowrap px-6 py-2 text-right font-medium">Net collected</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const pill = STATUS_PILL[r.status];
                  const linked = accountName(r.account_id);
                  return (
                    <tr key={r.id} className="border-b border-border/40 last:border-0">
                      <td className="max-w-[240px] px-6 py-2.5">
                        <p className="truncate font-medium text-foreground">{r.name || r.email || r.id}</p>
                        {r.name && r.email && <p className="truncate text-xs text-muted-foreground">{r.email}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Select
                            value={r.account_id ?? UNLINKED}
                            onValueChange={(v) => linkAccount.mutate({ customerId: r.id, accountId: v === UNLINKED ? null : v })}
                          >
                            <SelectTrigger
                              aria-label={`CRM account for ${r.name ?? r.email ?? r.id}`}
                              className={`h-8 w-44 text-xs ${linked ? "" : "border-dashed text-muted-foreground"}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNLINKED} className="text-muted-foreground">Not linked</SelectItem>
                              {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {linked && (
                            <Link
                              to={`/account/${encodeURIComponent(linked)}`}
                              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                            >
                              Open
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={pill.status}>{pill.label}</StatusPill>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {r.mrr ? formatUsd(r.mrr, { cents: true }) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {r.last ? format(new Date(r.last), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-2.5 text-right font-semibold tabular-nums text-foreground">
                        {formatUsd(r.net, { cents: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!query && filtered.length > PAGE && (
          <div className="px-6 pt-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show top 12" : `Show all ${filtered.length} customers`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
