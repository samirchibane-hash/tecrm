CREATE TABLE IF NOT EXISTS public.account_poc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_poc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access for account POCs"
  ON public.account_poc
  FOR ALL
  USING (true)
  WITH CHECK (true);
