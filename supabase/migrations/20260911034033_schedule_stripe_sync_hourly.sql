-- Hourly Stripe → CRM billing sync. The anon key in the Authorization header
-- only satisfies the functions gateway (it is public anyway); the function
-- authorizes the call with the Vault-held x-cron-secret.
SELECT cron.unschedule('stripe-sync-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stripe-sync-hourly');

SELECT cron.schedule(
  'stripe-sync-hourly',
  '7 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://wyjxkkabuwuuvyzrsusy.supabase.co/functions/v1/stripe-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5anhra2FidXd1dXZ5enJzdXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTQxMjcsImV4cCI6MjA4NjQzMDEyN30.gY3UA48zwXTc64kqGMaUFSm292Q5EKUzyXVHRheluUE',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'stripe_sync_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
