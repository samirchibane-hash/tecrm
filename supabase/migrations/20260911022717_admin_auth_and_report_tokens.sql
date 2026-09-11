-- Groundwork for locking the CRM down (additive — changes no existing access).
--
-- 1. admin_users: allowlist of emails that get full CRM access once signed in
--    through Supabase Auth. Checked by is_admin(); no direct client access.
-- 2. accounts.report_token: unguessable per-client token for the public report
--    links (/report/<token>, /cc-report/<token>), replacing name-based URLs.
-- 3. report_account_id() / report_account_name(): resolve the x-report-token
--    request header to one account so RLS can scope a report page to it.

CREATE TABLE IF NOT EXISTS public.admin_users (
  email      TEXT PRIMARY KEY CHECK (email = lower(email)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- No policies: only reachable through the SECURITY DEFINER functions below.

INSERT INTO public.admin_users (email) VALUES ('samirchibane94@gmail.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS report_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS accounts_report_token_key ON public.accounts (report_token);

CREATE OR REPLACE FUNCTION public.report_account_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.id FROM public.accounts a
  WHERE a.report_token::text =
    nullif(current_setting('request.headers', true), '')::json ->> 'x-report-token';
$$;

CREATE OR REPLACE FUNCTION public.report_account_name()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.account_name FROM public.accounts a WHERE a.id = public.report_account_id();
$$;
