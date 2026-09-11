-- Hourly GitHub → Claude Log sync, offset from stripe-sync (:07). Reuses the
-- Vault-held cron secret verify_cron_secret() checks; it authorizes the CRM's
-- scheduled jobs generally, not Stripe specifically. Until a GitHub token is
-- set in Settings → Integrations each run records "not connected" and exits.
SELECT cron.unschedule('github-sync-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'github-sync-hourly');

SELECT cron.schedule(
  'github-sync-hourly',
  '17 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://wyjxkkabuwuuvyzrsusy.supabase.co/functions/v1/github-sync',
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
