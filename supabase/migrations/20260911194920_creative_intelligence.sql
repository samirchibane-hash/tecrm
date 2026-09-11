-- Creative intelligence: per-account cost targets and hand-set creative labels.
--
-- 1. Targets. The Performance dashboard colored every client's CPL / cost per
--    appointment against module constants ($40 / $200), and the new creative
--    verdicts ("scale" / "money waster") need a benchmark per client. Targets
--    now live on the account (design rule #6). Existing accounts are seeded with
--    the old constants so today's coloring doesn't change; edit them per client
--    from the account page. NULL = no target, and verdicts fall back to the
--    account's own average cost for the period (labelled as such in the UI).
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS target_cpl NUMERIC CHECK (target_cpl IS NULL OR target_cpl > 0),
  ADD COLUMN IF NOT EXISTS target_cpa NUMERIC CHECK (target_cpa IS NULL OR target_cpa > 0);

UPDATE public.accounts SET target_cpl = 40 WHERE target_cpl IS NULL;
UPDATE public.accounts SET target_cpa = 200 WHERE target_cpa IS NULL;

-- 2. Creative labels. Offer and angle are detected from each ad's copy; when
--    the detection is wrong an operator corrects it, and the correction is
--    stored here. Keyed by ad NAME within the account, not ad id: the same
--    creative is routinely duplicated into several ad sets under one name, and
--    GHL attributes leads by ad name (utm_content) too. NULL = keep detecting.
CREATE TABLE IF NOT EXISTS public.creative_labels (
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  ad_name    TEXT NOT NULL CHECK (length(ad_name) BETWEEN 1 AND 400),
  offer      TEXT CHECK (offer IS NULL OR offer ~ '^[a-z_]{1,40}$'),
  angle      TEXT CHECK (angle IS NULL OR angle ~ '^[a-z_]{1,40}$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, ad_name)
);

ALTER TABLE public.creative_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all ON public.creative_labels;
CREATE POLICY admin_all ON public.creative_labels
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
