-- Creative batches: one record per upload session
CREATE TABLE public.creative_batches (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name  TEXT        NOT NULL,
  ad_type       TEXT        NOT NULL CHECK (ad_type IN ('image_ads', 'video_ads')),
  template_name TEXT        NOT NULL,
  ad_angle      TEXT        NOT NULL,
  offer_type    TEXT        NOT NULL,
  notes         TEXT,
  gdrive_folder_id  TEXT,
  gdrive_folder_url TEXT,
  file_count    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual files within a batch
CREATE TABLE public.creative_uploads (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id        UUID        NOT NULL REFERENCES public.creative_batches(id) ON DELETE CASCADE,
  file_name       TEXT        NOT NULL,
  storage_path    TEXT,
  storage_url     TEXT,
  gdrive_file_id  TEXT,
  gdrive_view_url TEXT,
  mime_type       TEXT,
  file_size       BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: permissive (auth is handled at app level via passcode gate)
ALTER TABLE public.creative_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_uploads  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_creative_batches"  ON public.creative_batches  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_creative_uploads"  ON public.creative_uploads   FOR ALL USING (true) WITH CHECK (true);

-- Index for the most common query pattern: list batches by client, newest first
CREATE INDEX idx_creative_batches_account ON public.creative_batches (account_name, created_at DESC);
CREATE INDEX idx_creative_uploads_batch   ON public.creative_uploads  (batch_id);
