CREATE TABLE public.creative_options (
  id    UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type  TEXT  NOT NULL CHECK (type IN ('ad_angle', 'offer_type')),
  value TEXT  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, value)
);

ALTER TABLE public.creative_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_creative_options" ON public.creative_options FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_creative_options_type ON public.creative_options (type);
