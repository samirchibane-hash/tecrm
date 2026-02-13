
-- Create creatives table
CREATE TABLE public.creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  batch_name TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  launch_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;

-- Allow all access (matching existing pattern)
CREATE POLICY "Allow all access to creatives"
ON public.creatives
FOR ALL
USING (true)
WITH CHECK (true);

-- Create storage bucket for creative files
INSERT INTO storage.buckets (id, name, public) VALUES ('creatives', 'creatives', true);

-- Storage policies
CREATE POLICY "Anyone can view creatives files"
ON storage.objects FOR SELECT
USING (bucket_id = 'creatives');

CREATE POLICY "Anyone can upload creatives files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creatives');

CREATE POLICY "Anyone can update creatives files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'creatives');

CREATE POLICY "Anyone can delete creatives files"
ON storage.objects FOR DELETE
USING (bucket_id = 'creatives');
