
-- Add deal_value column to ghl_conversions
-- Stores the reported dollar value of a sold appointment.
ALTER TABLE public.ghl_conversions ADD COLUMN IF NOT EXISTS deal_value NUMERIC;
