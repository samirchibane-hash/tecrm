
-- Make title nullable and add attachment columns
ALTER TABLE public.campaign_updates 
  ALTER COLUMN title DROP NOT NULL,
  ALTER COLUMN title SET DEFAULT '',
  ADD COLUMN link_url text,
  ADD COLUMN image_url text;

-- Create storage bucket for change log attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('changelog-attachments', 'changelog-attachments', true);

-- Allow public read access
CREATE POLICY "Public read access for changelog attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'changelog-attachments');

-- Allow insert for all (no auth in this app)
CREATE POLICY "Allow insert for changelog attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'changelog-attachments');

-- Allow delete for all
CREATE POLICY "Allow delete for changelog attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'changelog-attachments');
