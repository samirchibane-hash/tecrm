-- Meta (Facebook) CAPI credentials for GoHighLevel workflow steps.
--
-- One optional dataset / pixel id and access token per funnel site, edited
-- beside the inbound webhook on the account Funnel tab. Nullable and with no
-- default, so existing funnel_sites rows stay valid until someone sets them.
-- Already applied on production; IF NOT EXISTS keeps a re-run a no-op.
--
-- funnel_sites has no anon / report policy, so these values are not readable
-- on client report pages. The access token is a credential.

ALTER TABLE public.funnel_sites
  ADD COLUMN IF NOT EXISTS meta_dataset_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token TEXT;

COMMENT ON COLUMN public.funnel_sites.meta_dataset_id IS
  'Meta (Facebook) Dataset / Pixel ID for CAPI steps in GHL workflows';

COMMENT ON COLUMN public.funnel_sites.meta_access_token IS
  'Meta CAPI access token for GHL Facebook Conversion API workflow steps';
