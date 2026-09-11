-- The CRM becomes the only database the Treat Engine website writes to, so it
-- takes over what the separate onboarding Supabase (itwqxiwwloejzcqnoyaz) held:
-- Stripe IDs (to match cancellations), the raw onboarding form, and when a
-- client onboarded / cancelled. Additive only.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_data        JSONB,
  ADD COLUMN IF NOT EXISTS onboarded_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at           TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS clients_stripe_subscription_id_idx
  ON public.clients (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Existing rows were only ever written at onboarding time.
UPDATE public.clients SET onboarded_at = submitted_at
WHERE status = 'onboarded' AND onboarded_at IS NULL;
