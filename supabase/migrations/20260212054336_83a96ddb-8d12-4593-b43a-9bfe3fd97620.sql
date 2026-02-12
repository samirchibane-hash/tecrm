CREATE POLICY "Allow all access to ghl_conversions"
ON public.ghl_conversions
FOR ALL
USING (true)
WITH CHECK (true);