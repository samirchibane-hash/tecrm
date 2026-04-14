-- Per-account feature flags (call center is an exclusive VIP service)
CREATE TABLE IF NOT EXISTS public.account_features (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  call_center_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

-- Individual setters for a client's call center team
CREATE TABLE IF NOT EXISTS public.call_center_setters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily performance metrics per setter (manually updated by account manager)
CREATE TABLE IF NOT EXISTS public.call_center_metrics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setter_id           UUID NOT NULL REFERENCES public.call_center_setters(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  metric_date         DATE NOT NULL,
  calls_made          INT NOT NULL DEFAULT 0,
  appointments_set    INT NOT NULL DEFAULT 0,
  installs_generated  INT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (setter_id, metric_date)
);

-- Gamification incentives: targets + bonus commissions per account
CREATE TABLE IF NOT EXISTS public.call_center_incentives (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  metric_type         TEXT NOT NULL CHECK (metric_type IN ('calls_made', 'appointments_set', 'installs_generated')),
  target_value        INT NOT NULL,
  bonus_amount        NUMERIC(10,2),
  bonus_description   TEXT,
  deadline            DATE NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
