-- Optional production metadata carried on a template's meta row
-- (the file_type = 'template_type' record). Mirrors the fields a
-- creative_requests brief captures, so a template can define its
-- default ad angle / offer type. `notes` already exists on creatives.
ALTER TABLE public.creatives
  ADD COLUMN IF NOT EXISTS ad_angle   TEXT,
  ADD COLUMN IF NOT EXISTS offer_type TEXT;
