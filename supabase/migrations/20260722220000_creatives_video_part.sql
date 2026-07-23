-- Video templates are either a Hook (the opening) or a Body (the main content).
-- Only meaningful when the template type is 'video'; NULL otherwise.
ALTER TABLE public.creatives
  ADD COLUMN IF NOT EXISTS video_part TEXT
  CHECK (video_part IS NULL OR video_part IN ('hook', 'body'));
