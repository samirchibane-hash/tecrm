-- The account is keyed by its GHL location: fill ghl_conversions.tecrm_id from
-- accounts.ghl_location_id when the sync leaves it missing. n8n has sent
-- tecrm_id = '' (not NULL) before (Kinetico UT, 2026-06), which the old
-- IS NULL check skipped, leaving those rows matched to no account.
CREATE OR REPLACE FUNCTION public.set_ghl_conversion_tecrm_id()
RETURNS TRIGGER AS $$
BEGIN
  IF nullif(btrim(NEW.tecrm_id::text), '') IS NULL AND NEW.location_id IS NOT NULL THEN
    SELECT id INTO NEW.tecrm_id
    FROM public.accounts
    WHERE ghl_location_id = NEW.location_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
