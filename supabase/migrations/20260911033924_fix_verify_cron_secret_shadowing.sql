-- verify_cron_secret compared against vault.decrypted_secrets.secret (the
-- ciphertext column), which shadowed the function's `secret` parameter, so the
-- hourly stripe-sync job was always rejected. Reference the argument as $1.
-- (20260911033656_stripe_billing_sync.sql already carries the corrected body.)
CREATE OR REPLACE FUNCTION public.verify_cron_secret(secret TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'stripe_sync_cron_secret' AND decrypted_secret = $1
  );
$$;
REVOKE EXECUTE ON FUNCTION public.verify_cron_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(TEXT) TO service_role;
