
-- Create accounts table with unique IDs for each client
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for now (no auth)
CREATE POLICY "Allow all access to accounts"
  ON public.accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add account_id FK to ghl_conversions so we can link CRM data to accounts
ALTER TABLE public.ghl_conversions
  ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add account_id FK to campaign_updates for consistency
ALTER TABLE public.campaign_updates
  ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add account_id FK to campaign_notes for consistency
ALTER TABLE public.campaign_notes
  ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
