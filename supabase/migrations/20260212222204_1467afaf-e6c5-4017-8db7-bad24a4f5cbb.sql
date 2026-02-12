
CREATE TABLE public.settings (
  id text PRIMARY KEY DEFAULT 'global',
  enabled_kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_campaigns jsonb NOT NULL DEFAULT '["CRM", "Retell Ai"]'::jsonb,
  visible_kpis jsonb NOT NULL DEFAULT '["totalSpend", "totalClicks", "totalImpressions", "avgCTR"]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to settings"
ON public.settings
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert default row
INSERT INTO public.settings (id) VALUES ('global');
