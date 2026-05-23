-- Auto-populate tecrm_id on ghl_conversions from accounts.ghl_location_id
CREATE OR REPLACE FUNCTION public.set_ghl_conversion_tecrm_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tecrm_id IS NULL AND NEW.location_id IS NOT NULL THEN
    SELECT id INTO NEW.tecrm_id
    FROM public.accounts
    WHERE ghl_location_id = NEW.location_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ghl_conversion_set_tecrm_id
BEFORE INSERT OR UPDATE ON public.ghl_conversions
FOR EACH ROW EXECUTE FUNCTION public.set_ghl_conversion_tecrm_id();
