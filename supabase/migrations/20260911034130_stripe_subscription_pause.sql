-- Stripe "pause payment collection" keeps a subscription `active` while every
-- invoice is left as a draft or voided. Six such subscriptions ($7.5k/mo) were
-- inflating MRR on the first sync, so record the pause and treat those as
-- not collecting.
ALTER TABLE public.stripe_subscriptions
  ADD COLUMN IF NOT EXISTS collection_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_behavior    TEXT,        -- keep_as_draft | mark_uncollectible | void
  ADD COLUMN IF NOT EXISTS pause_resumes_at  TIMESTAMPTZ;
