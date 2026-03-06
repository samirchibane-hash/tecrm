
-- Add appointment_status column to ghl_conversions
-- Stores client-reported outcome for each appointment (survives re-syncs since
-- GHL sync only upserts its own columns and leaves custom columns untouched).
ALTER TABLE public.ghl_conversions ADD COLUMN IF NOT EXISTS appointment_status TEXT;
