import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminRequest, unauthorizedResponse } from "../_shared/admin-auth.ts";

// Mirrors Stripe customers, subscriptions, invoices and payments into the CRM for
// customer management and revenue review. Read-only against Stripe: it uses
// the restricted key in STRIPE_SYNC_KEY and never writes back.
//
// Runs hourly from pg_cron (x-cron-secret header, checked against Vault) or on
// demand by a signed-in admin.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Pinned so field locations don't shift under us when the account's default
// API version changes (e.g. invoice.subscription and line.price moved in 2025).
const STRIPE_VERSION = "2024-06-20";

// Raw Stripe API JSON; fields are read defensively with optional chaining.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeObject = Record<string, any>;

// Payments are mirrored from here on (the Revenue page starts at July 2024);
// a month of slack catches intents created in June that captured in July.
const PAYMENTS_SINCE = Math.floor(Date.UTC(2024, 5, 1) / 1000);

async function stripeList(path: string, key: string, params: Record<string, string | string[]> = {}): Promise<StripeObject[]> {
  const out: StripeObject[] = [];
  let startingAfter: string | null = null;
  for (;;) {
    const url = new URL(`https://api.stripe.com/v1/${path}`);
    url.searchParams.set("limit", "100");
    for (const [k, v] of Object.entries(params)) {
      for (const one of Array.isArray(v) ? v : [v]) url.searchParams.append(k, one);
    }
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Stripe ${path}: ${body.error?.message ?? res.status}`);

    out.push(...body.data);
    if (!body.has_more || body.data.length === 0) return out;
    startingAfter = body.data[body.data.length - 1].id;
  }
}

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

// Recurring price → monthly cents.
function monthly(amount: number, interval: string, count: number): number {
  const n = count || 1;
  switch (interval) {
    case "day": return (amount * 365) / 12 / n;
    case "week": return (amount * 52) / 12 / n;
    case "month": return amount / n;
    case "year": return amount / 12 / n;
    default: return 0;
  }
}

function subscriptionMrr(sub: StripeObject): number {
  let total = 0;
  for (const item of sub.items?.data ?? []) {
    const price = item.price ?? {};
    const recurring = price.recurring;
    const unit = price.unit_amount ?? (price.unit_amount_decimal ? Number(price.unit_amount_decimal) : 0);
    if (!recurring || !unit) continue;
    total += monthly(unit * (item.quantity ?? 1), recurring.interval, recurring.interval_count);
  }
  const coupon = sub.discount?.coupon;
  if (coupon && coupon.duration !== "once") {
    if (coupon.percent_off) total *= 1 - coupon.percent_off / 100;
    else if (coupon.amount_off) total = Math.max(0, total - coupon.amount_off);
  }
  return Math.round(total);
}

async function upsertInChunks(db: ReturnType<typeof createClient>, table: string, rows: StripeObject[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const cronSecret = req.headers.get("x-cron-secret");
  const viaCron = cronSecret
    ? (await db.rpc("verify_cron_secret", { secret: cronSecret })).data === true
    : false;
  if (!viaCron && !(await isAdminRequest(req))) return unauthorizedResponse(corsHeaders);

  const key = Deno.env.get("STRIPE_SYNC_KEY");
  const runStart = new Date().toISOString();
  const { data: run } = await db.from("stripe_sync_runs").insert({ started_at: runStart }).select("id").single();

  try {
    if (!key) throw new Error("STRIPE_SYNC_KEY is not set");

    const [products, customers, subscriptions, invoices, paymentsResult] = await Promise.all([
      stripeList("products", key),
      stripeList("customers", key),
      stripeList("subscriptions", key, { status: "all" }),
      stripeList("invoices", key),
      // Needs PaymentIntents read on the restricted key. Kept separate so a
      // missing permission fails the run loudly without freezing MRR data.
      stripeList("payment_intents", key, {
        "created[gte]": String(PAYMENTS_SINCE),
        "expand[]": "data.latest_charge",
      }).then(
        (rows) => ({ rows, error: null as string | null }),
        (e) => ({ rows: [] as StripeObject[], error: e instanceof Error ? e.message : String(e) }),
      ),
    ]);
    const productName = new Map(products.map((p) => [p.id, p.name as string]));

    await upsertInChunks(db, "stripe_customers", customers.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      phone: c.phone,
      created_at: iso(c.created),
      delinquent: c.delinquent,
      deleted: false,
      synced_at: runStart,
    })));
    // Customers Stripe no longer returns were deleted there.
    await db.from("stripe_customers").update({ deleted: true }).lt("synced_at", runStart);

    await upsertInChunks(db, "stripe_subscriptions", subscriptions.map((s) => ({
      id: s.id,
      customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id,
      status: s.status,
      mrr_cents: subscriptionMrr(s),
      currency: s.currency,
      items: (s.items?.data ?? []).map((item: StripeObject) => ({
        price_id: item.price?.id ?? null,
        product_id: item.price?.product ?? null,
        product_name: productName.get(item.price?.product) ?? null,
        unit_amount: item.price?.unit_amount ?? null,
        interval: item.price?.recurring?.interval ?? null,
        interval_count: item.price?.recurring?.interval_count ?? null,
        quantity: item.quantity ?? 1,
      })),
      cancel_at_period_end: s.cancel_at_period_end,
      // Paused collection: still `active` in Stripe, but invoices are left as
      // drafts or voided — not revenue until it resumes.
      collection_paused: !!s.pause_collection,
      pause_behavior: s.pause_collection?.behavior ?? null,
      pause_resumes_at: iso(s.pause_collection?.resumes_at),
      started_at: iso(s.start_date),
      current_period_end: iso(s.current_period_end),
      trial_end: iso(s.trial_end),
      canceled_at: iso(s.canceled_at),
      ended_at: iso(s.ended_at),
      created_at: iso(s.created),
      synced_at: runStart,
    })));

    await upsertInChunks(db, "stripe_invoices", invoices.map((inv) => ({
      id: inv.id,
      customer_id: typeof inv.customer === "string" ? inv.customer : inv.customer?.id,
      subscription_id: typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id ?? null,
      number: inv.number,
      status: inv.status,
      billing_reason: inv.billing_reason,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      amount_remaining: inv.amount_remaining,
      currency: inv.currency,
      created_at: iso(inv.created),
      paid_at: iso(inv.status_transitions?.paid_at),
      attempt_count: inv.attempt_count,
      next_payment_attempt: iso(inv.next_payment_attempt),
      hosted_invoice_url: inv.hosted_invoice_url,
      lines: (inv.lines?.data ?? []).map((l: StripeObject) => ({
        description: l.description,
        amount: l.amount,
        price_id: l.price?.id ?? null,
        product_id: l.price?.product ?? null,
        product_name: productName.get(l.price?.product) ?? null,
      })),
      synced_at: runStart,
    })));

    // Only money that moved: succeeded intents with a captured charge.
    const payments = paymentsResult.rows.filter((pi) => pi.status === "succeeded" && pi.latest_charge?.created);
    await upsertInChunks(db, "stripe_payments", payments.map((pi) => {
      const charge = pi.latest_charge;
      // 2024-06-20 exposes `invoice` directly; newer versions moved it to payment_details.
      const orderRef = pi.payment_details?.order_reference;
      const invoiceId = typeof pi.invoice === "string" ? pi.invoice
        : pi.invoice?.id ?? (typeof orderRef === "string" && orderRef.startsWith("in_") ? orderRef : null);
      return {
        id: pi.id,
        charge_id: charge.id,
        customer_id: typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null,
        invoice_id: invoiceId,
        description: pi.description,
        amount: charge.amount_captured ?? pi.amount_received ?? 0,
        amount_refunded: charge.amount_refunded ?? 0,
        currency: pi.currency,
        disputed: !!charge.disputed,
        paid_at: iso(charge.created),
        created_at: iso(pi.created),
        synced_at: runStart,
      };
    }));

    const { data: linked } = await db.rpc("link_stripe_customers");

    const counts = {
      products: products.length,
      customers: customers.length,
      subscriptions: subscriptions.length,
      invoices: invoices.length,
      payments: payments.length,
      newly_linked: linked ?? 0,
    };
    const ok = !paymentsResult.error;
    const error = paymentsResult.error ? `payments: ${paymentsResult.error}` : null;
    if (run) await db.from("stripe_sync_runs").update({ finished_at: new Date().toISOString(), ok, counts, error }).eq("id", run.id);

    return new Response(JSON.stringify({ ok, counts, error }), {
      status: ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("stripe-sync error:", msg);
    if (run) await db.from("stripe_sync_runs").update({ finished_at: new Date().toISOString(), ok: false, error: msg }).eq("id", run.id);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
