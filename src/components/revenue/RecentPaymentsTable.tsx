import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/StatusPill";
import { formatUsd } from "@/lib/format";
import { net, type Payment } from "./revenueMath";
import type { RevenueCustomer } from "./useRevenueData";

const PAGE = 10;

export function RecentPaymentsTable({
  payments,
  customers,
  periodLabel,
}: {
  payments: Payment[]; // newest first, already filtered to the period
  customers: RevenueCustomer[];
  periodLabel: string;
}) {
  const [limit, setLimit] = useState(PAGE);
  const customerLabel = (id: string | null) => {
    const c = customers.find((x) => x.id === id);
    return c?.name || c?.email || "Unknown customer";
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Payments</CardTitle>
        <p className="text-xs text-muted-foreground">
          {payments.length} successful Stripe payment{payments.length === 1 ? "" : "s"} · {periodLabel}
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {payments.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No payments in this period.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {payments.slice(0, limit).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-6 py-2.5">
                <div className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {format(new Date(p.paid_at), "MMM d, yy")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{customerLabel(p.customer_id)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.description || (p.invoice_id ? "Invoice payment" : "Payment")}
                    {!p.invoice_id && " · no invoice"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.disputed && <StatusPill status="danger">Disputed</StatusPill>}
                  {p.amount_refunded > 0 && (
                    <StatusPill status="warning">
                      {p.amount_refunded >= p.amount ? "Refunded" : `−${formatUsd(p.amount_refunded, { cents: true })} refunded`}
                    </StatusPill>
                  )}
                  <span className="w-20 text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatUsd(net(p), { cents: true })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {payments.length > limit && (
          <div className="px-6 pt-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setLimit((n) => n + 25)}>
              Show more ({payments.length - limit} left)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
