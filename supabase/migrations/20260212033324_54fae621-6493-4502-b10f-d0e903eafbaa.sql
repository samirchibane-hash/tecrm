
-- Notes table for free-text notes on campaigns
CREATE TABLE public.campaign_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Structured updates table for campaign changes
CREATE TYPE public.update_category AS ENUM ('budget_change', 'creative_swap', 'audience_update', 'bid_change', 'status_change', 'other');

CREATE TABLE public.campaign_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  category public.update_category NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (public access since no auth)
ALTER TABLE public.campaign_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY;

-- Allow all operations publicly (no auth in this app)
CREATE POLICY "Allow all access to campaign_notes" ON public.campaign_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to campaign_updates" ON public.campaign_updates FOR ALL USING (true) WITH CHECK (true);
