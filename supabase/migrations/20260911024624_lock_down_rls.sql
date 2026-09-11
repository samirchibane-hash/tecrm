-- Lock the CRM down.
--
-- Before: every table was readable and writable by anyone holding the public
-- anon key (shipped in the dashboard bundle), and several had RLS disabled.
-- After:
--   * authenticated users on the admin_users allowlist (public.is_admin())
--     get full access to every table — the whole internal CRM.
--   * anonymous requests get nothing, EXCEPT a client report page, which sends
--     its account's report token in the x-report-token header and can then
--     read that one account's report data and edit its appointment outcomes
--     and call center numbers (public.report_account_id()).
--   * the service role (edge functions, the website's server-side sync) and
--     the postgres role (n8n's GHL sync) bypass RLS and are unaffected.
--
-- Any NEW table needs its own `admin_all` policy, or it will be inaccessible to
-- the dashboard once RLS is enabled on it.

-- 1. Drop every existing policy on public tables (all were allow-all).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 2. Discontinued Funnel Studio registry (empty; funnels live in funnels/dist).
DROP TABLE IF EXISTS public.funnel_clients;
DROP FUNCTION IF EXISTS public.set_funnel_clients_updated_at();

-- 3. RLS on everywhere, one admin policy per table.
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'admin_users' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t.tablename
    );
  END LOOP;
END $$;

-- 4. Client report pages (/report/<token>): one account, read-only except the
--    outcome fields clients fill in on their appointments.
CREATE POLICY report_read ON public.accounts
  FOR SELECT TO anon USING (id = public.report_account_id());

CREATE POLICY report_read ON public.ghl_conversions
  FOR SELECT TO anon USING (tecrm_id = public.report_account_id()::text);
CREATE POLICY report_update ON public.ghl_conversions
  FOR UPDATE TO anon
  USING (tecrm_id = public.report_account_id()::text)
  WITH CHECK (tecrm_id = public.report_account_id()::text);
CREATE POLICY report_insert ON public.ghl_conversions
  FOR INSERT TO anon WITH CHECK (tecrm_id = public.report_account_id()::text);
REVOKE UPDATE ON public.ghl_conversions FROM anon;
GRANT UPDATE (appointment_status, deal_value, created_on) ON public.ghl_conversions TO anon;

CREATE POLICY report_read ON public.campaign_updates
  FOR SELECT TO anon USING (account_name = public.report_account_name());
CREATE POLICY report_read ON public.creatives
  FOR SELECT TO anon USING (account_name = public.report_account_name());
CREATE POLICY report_read ON public.creative_requests
  FOR SELECT TO anon USING (account_name = public.report_account_name());
CREATE POLICY report_read ON public.settings
  FOR SELECT TO anon USING (public.report_account_id() IS NOT NULL);

-- 5. Call center report pages (/cc-report/<token>): setters manage their own
--    account's roster, daily numbers and incentives there.
CREATE POLICY report_all ON public.call_center_setters
  FOR ALL TO anon
  USING (account_id = public.report_account_id())
  WITH CHECK (account_id = public.report_account_id());
CREATE POLICY report_all ON public.call_center_metrics
  FOR ALL TO anon
  USING (account_id = public.report_account_id())
  WITH CHECK (account_id = public.report_account_id());
CREATE POLICY report_all ON public.call_center_incentives
  FOR ALL TO anon
  USING (account_id = public.report_account_id())
  WITH CHECK (account_id = public.report_account_id());

-- 6. Storage: buckets stay public (existing file URLs keep working), but only
--    admins can list, upload, replace or delete objects.
DROP POLICY IF EXISTS "Allow delete for changelog attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert for changelog attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for changelog attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete creatives files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update creatives files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload creatives files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view creatives files" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_creative_outputs" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_delete" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_select" ON storage.objects;

CREATE POLICY te_admin_all ON storage.objects
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
