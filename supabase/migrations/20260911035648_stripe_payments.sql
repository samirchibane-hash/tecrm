-- Money actually collected through Stripe. Paid invoices alone under-count
-- revenue: checkout and one-off charges ("Treat Leads Marketing", $997) never
-- produce an invoice. One row per succeeded PaymentIntent, carrying its
-- charge's capture time and refunded amount so revenue can be reported net.
--
-- Written by stripe-sync (service role). Admin-only like every Stripe table.
CREATE TABLE IF NOT EXISTS public.stripe_payments (
  id               TEXT PRIMARY KEY,          -- pi_…
  charge_id        TEXT,                      -- ch_… (latest charge)
  customer_id      TEXT,
  invoice_id       TEXT,                      -- null for checkout / one-off charges
  description      TEXT,
  amount           INTEGER NOT NULL,          -- captured, cents
  amount_refunded  INTEGER NOT NULL DEFAULT 0,
  currency         TEXT,
  disputed         BOOLEAN NOT NULL DEFAULT false,
  paid_at          TIMESTAMPTZ NOT NULL,      -- charge created, i.e. when money moved
  created_at       TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stripe_payments_paid_at_idx ON public.stripe_payments (paid_at);
CREATE INDEX IF NOT EXISTS stripe_payments_customer_idx ON public.stripe_payments (customer_id);

ALTER TABLE public.stripe_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all ON public.stripe_payments;
CREATE POLICY admin_all ON public.stripe_payments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
