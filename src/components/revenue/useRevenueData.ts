import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { REVENUE_DATA_START, type Payment, type Subscription } from "./revenueMath";

export type RevenueCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  account_id: string | null;
};

/**
 * Everything the Revenue page reads from the Stripe mirror. Customers are
 * fetched by id — only those with payments or subscriptions — because the full
 * table is past PostgREST's 1,000-row default and would silently truncate.
 */
export function useRevenueData() {
  return useQuery({
    queryKey: ["revenue"],
    queryFn: async () => {
      const [paymentsRes, subsRes, accountsRes] = await Promise.all([
        supabase
          .from("stripe_payments")
          .select("id, customer_id, invoice_id, description, amount, amount_refunded, paid_at, disputed")
          .gte("paid_at", REVENUE_DATA_START.toISOString())
          .order("paid_at", { ascending: false })
          .limit(5000),
        supabase
          .from("stripe_subscriptions")
          .select("id, customer_id, status, mrr_cents, collection_paused")
          .limit(5000),
        supabase.from("accounts").select("id, account_name").order("account_name"),
      ]);
      if (paymentsRes.error) throw paymentsRes.error;
      if (subsRes.error) throw subsRes.error;
      if (accountsRes.error) throw accountsRes.error;

      const payments = (paymentsRes.data ?? []) as Payment[];
      const subscriptions = (subsRes.data ?? []) as Subscription[];

      const liveStatuses = new Set(["active", "past_due", "trialing"]);
      const customerIds = [
        ...new Set([
          ...payments.map((p) => p.customer_id).filter((id): id is string => !!id),
          ...subscriptions.filter((s) => liveStatuses.has(s.status)).map((s) => s.customer_id),
        ]),
      ];

      const customers: RevenueCustomer[] = [];
      for (let i = 0; i < customerIds.length; i += 200) {
        const { data, error } = await supabase
          .from("stripe_customers")
          .select("id, name, email, account_id")
          .in("id", customerIds.slice(i, i + 200));
        if (error) throw error;
        customers.push(...(data ?? []));
      }

      return { payments, subscriptions, customers, accounts: accountsRes.data ?? [] };
    },
    staleTime: 60_000,
  });
}
