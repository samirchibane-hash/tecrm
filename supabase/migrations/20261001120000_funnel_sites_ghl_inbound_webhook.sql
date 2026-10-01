-- GoHighLevel inbound webhook for the "Import New Leads from Funnel" workflow.
--
-- One optional URL per funnel site. Ops paste it on the account Funnel tab so
-- a funnel builder can point the landing page at that client's CRM. Nullable
-- and with no default, so existing funnel_sites rows stay valid until someone
-- sets it. Already applied on production; IF NOT EXISTS keeps a re-run a no-op.
--
-- funnel_sites has no anon / report policy, so this URL is not readable on
-- client report pages. It is a credential: anyone who has it can post leads.

ALTER TABLE public.funnel_sites
  ADD COLUMN IF NOT EXISTS ghl_inbound_webhook_url TEXT;

COMMENT ON COLUMN public.funnel_sites.ghl_inbound_webhook_url IS
  'GoHighLevel Import New Leads from Funnel (or equivalent) inbound webhook URL';
