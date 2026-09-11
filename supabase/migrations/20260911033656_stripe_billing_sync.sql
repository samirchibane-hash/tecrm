-- Stripe billing mirror for customer management and revenue review.
--
-- The stripe-sync edge function (hourly via pg_cron, or on demand by an admin)
-- reads Stripe with a restricted read-only key (secret STRIPE_SYNC_KEY) and
-- upserts these tables. Stripe stays the source of truth; nothing here writes
-- back to Stripe. All tables are admin-only.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id          TEXT PRIMARY KEY,               -- cus_…
  email       TEXT,
  name        TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ,
  delinquent  BOOLEAN,
  deleted     BOOLEAN NOT NULL DEFAULT false, -- no longer returned by Stripe
  -- Links to the CRM. Set automatically from clients.stripe_customer_id and
  -- never overwritten by the sync, so manual links stick.
  client_id   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  account_id  UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
  id                   TEXT PRIMARY KEY,      -- sub_…
  customer_id          TEXT NOT NULL,
  status               TEXT NOT NULL,         -- active, trialing, past_due, canceled, …
  -- Monthly-normalized recurring amount after percent/amount-off discounts,
  -- before tax. Counts toward MRR only while active or past_due.
  mrr_cents            INTEGER NOT NULL DEFAULT 0,
  currency             TEXT,
  items                JSONB NOT NULL DEFAULT '[]', -- [{price_id, product_id, product_name, unit_amount, interval, interval_count, quantity}]
  cancel_at_period_end BOOLEAN,
  started_at           TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  trial_end            TIMESTAMPTZ,
  canceled_at          TIMESTAMPTZ,
  ended_at             TIMESTAMPTZ,
  created_at           TIMESTAMPTZ,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stripe_subscriptions_customer_idx ON public.stripe_subscriptions (customer_id);

CREATE TABLE IF NOT EXISTS public.stripe_invoices (
  id                   TEXT PRIMARY KEY,      -- in_…
  customer_id          TEXT,
  subscription_id      TEXT,
  number               TEXT,
  status               TEXT,                  -- draft, open, paid, uncollectible, void
  billing_reason       TEXT,
  amount_due           INTEGER,
  amount_paid          INTEGER,
  amount_remaining     INTEGER,
  currency             TEXT,
  created_at           TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  attempt_count        INTEGER,
  next_payment_attempt TIMESTAMPTZ,
  hosted_invoice_url   TEXT,
  lines                JSONB NOT NULL DEFAULT '[]', -- [{description, amount, price_id, product_id, product_name}]
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stripe_invoices_customer_idx ON public.stripe_invoices (customer_id);
CREATE INDEX IF NOT EXISTS stripe_invoices_paid_at_idx ON public.stripe_invoices (paid_at);

-- One row per sync attempt, so every revenue number can say how fresh it is.
CREATE TABLE IF NOT EXISTS public.stripe_sync_runs (
  id          BIGSERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  ok          BOOLEAN,
  counts      JSONB,
  error       TEXT
);

-- Admin-only, same as every other table (see lock_down_rls).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['stripe_customers','stripe_subscriptions','stripe_invoices','stripe_sync_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

-- Link Stripe customers to CRM clients/accounts via clients.stripe_customer_id.
-- Only fills empty links. Called by the sync (service role).
CREATE OR REPLACE FUNCTION public.link_stripe_customers()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.stripe_customers sc
  SET client_id  = coalesce(sc.client_id, c.id),
      account_id = coalesce(sc.account_id, c.account_id)
  FROM public.clients c
  WHERE c.stripe_customer_id = sc.id
    AND (sc.client_id IS NULL OR (sc.account_id IS NULL AND c.account_id IS NOT NULL));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.link_stripe_customers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_stripe_customers() TO service_role;

-- The hourly cron job authenticates to stripe-sync with a random secret kept
-- in Vault; the function checks it here (service role only).
CREATE OR REPLACE FUNCTION public.verify_cron_secret(secret TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    -- $1, not the parameter name: vault.decrypted_secrets has its own `secret`
    -- column (the ciphertext), which would shadow it and never match.
    WHERE name = 'stripe_sync_cron_secret' AND decrypted_secret = $1
  );
$$;
REVOKE EXECUTE ON FUNCTION public.verify_cron_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(TEXT) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'stripe_sync_cron_secret') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'stripe_sync_cron_secret',
      'x-cron-secret header for the hourly stripe-sync job'
    );
  END IF;
END $$;
