ALTER TABLE public.campaign_updates
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'assigned'
  CHECK (status IN ('assigned', 'published'));
