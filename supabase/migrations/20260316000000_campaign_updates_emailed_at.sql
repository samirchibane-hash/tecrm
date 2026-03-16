ALTER TABLE public.campaign_updates ADD COLUMN IF NOT EXISTS emailed_at timestamptz DEFAULT NULL;
