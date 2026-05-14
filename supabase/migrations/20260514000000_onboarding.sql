-- Track per-client internal onboarding checklist progress
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL,
  item_key   TEXT NOT NULL,
  completed  BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, item_key)
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access for onboarding_progress"
  ON public.onboarding_progress FOR ALL USING (true) WITH CHECK (true);

-- Internal team comments per client
CREATE TABLE IF NOT EXISTS public.onboarding_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL,
  author     TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access for onboarding_comments"
  ON public.onboarding_comments FOR ALL USING (true) WITH CHECK (true);
