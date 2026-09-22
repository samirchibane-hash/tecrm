-- Public staff link for Creative Briefs (/briefs/<token>).
--
-- Designers and other staff work the brief queue without a CRM login. One
-- unguessable token (rotatable from Settings → Staff Links) opens a read-only
-- list of briefs, each carrying what the designer needs to start: the client's
-- Drive folder, the brief's own Drive folder, and the template's link.
--
-- The token never unlocks a table. anon gets no RLS policy here; the page reads
-- only through staff_creative_briefs(), a SECURITY DEFINER function that checks
-- the token and returns a fixed set of columns. Nothing on the page can write.

CREATE TABLE IF NOT EXISTS public.staff_share_links (
  scope      TEXT PRIMARY KEY CHECK (scope IN ('creative_briefs')),
  token      UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ
);

ALTER TABLE public.staff_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all ON public.staff_share_links
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.staff_share_links (scope) VALUES ('creative_briefs')
ON CONFLICT (scope) DO NOTHING;

CREATE OR REPLACE FUNCTION public.staff_creative_briefs(p_token UUID)
RETURNS TABLE (
  id                   UUID,
  account_name         TEXT,
  ad_type              TEXT,
  template_name        TEXT,
  ad_angle             TEXT,
  offer_type           TEXT,
  notes                TEXT,
  status               TEXT,
  assigned_to          TEXT,
  is_template          BOOLEAN,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  brief_drive_url      TEXT,
  client_drive_url     TEXT,
  template_link        TEXT,
  template_preview_url TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_token IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.staff_share_links l
    WHERE l.scope = 'creative_briefs' AND l.token = p_token
  ) THEN
    RAISE EXCEPTION 'invalid_staff_link' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.account_name, r.ad_type, r.template_name, r.ad_angle, r.offer_type,
    r.notes, r.status, r.assigned_to, r.is_template, r.created_at, r.updated_at,
    nullif(r.gdrive_folder_url, ''),
    -- Template-production briefs have no client, so no client Drive.
    CASE WHEN r.is_template THEN NULL ELSE nullif(a.gdrive_folder_url, '') END,
    nullif(tpl.file_url, ''),
    prev.file_url
  FROM public.creative_requests r
  LEFT JOIN public.accounts a ON a.account_name = r.account_name
  LEFT JOIN LATERAL (
    SELECT c.file_url FROM public.creatives c
    WHERE c.batch_name = r.template_name AND c.file_type = 'template_type'
    ORDER BY c.created_at DESC LIMIT 1
  ) tpl ON TRUE
  LEFT JOIN LATERAL (
    SELECT c.file_url FROM public.creatives c
    WHERE c.batch_name = r.template_name AND c.file_type = 'image'
    ORDER BY c.created_at ASC LIMIT 1
  ) prev ON TRUE
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_creative_briefs(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_creative_briefs(UUID) TO anon, authenticated;
