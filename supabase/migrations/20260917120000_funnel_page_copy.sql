-- Landing page copy for the Funnel scorecard.
--
-- A landing page test is really a test of its headline and its offer, so the
-- scorecard has to show them next to the conversion rate. github-sync already
-- reads each page's HTML for its <title>; it now also lifts the hero headline,
-- the hero subhead and the form card's offer line. Offer and angle are not
-- stored: they're detected from this copy with the same taxonomy the creatives
-- use (components/creative-performance/labels.ts), so there's one vocabulary.

ALTER TABLE public.account_links
  ADD COLUMN IF NOT EXISTS page_headline   TEXT,
  ADD COLUMN IF NOT EXISTS page_subhead    TEXT,
  ADD COLUMN IF NOT EXISTS page_cta        TEXT,
  -- When the HTML was last parsed. NULL = never, which is what makes the sync
  -- re-read pages that predate this migration instead of waiting for an edit.
  ADD COLUMN IF NOT EXISTS copy_synced_at  TIMESTAMPTZ;

-- Same reconciliation as before, now carrying the four copy columns. The sync
-- passes the previous values through for pages whose blob is unchanged, so an
-- unchanged page keeps both its copy and the timestamp of the run that read it.
CREATE OR REPLACE FUNCTION public.sync_funnel_pages(p_site_id UUID, p_pages JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s        RECORD;
  pg       JSONB;
  hit      UUID;
  added    INTEGER := 0;
  adopted  INTEGER := 0;
  removed  INTEGER := 0;
BEGIN
  SELECT f.repo, f.root_dir, a.account_name INTO s
  FROM public.funnel_sites f JOIN public.accounts a ON a.id = f.account_id
  WHERE f.id = p_site_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'funnel site % not found', p_site_id;
  END IF;

  FOR pg IN SELECT * FROM jsonb_array_elements(p_pages) LOOP
    SELECT id INTO hit FROM public.account_links
    WHERE repo = s.repo AND repo_path = pg->>'repo_path';

    IF hit IS NULL THEN
      SELECT id INTO hit FROM public.account_links
      WHERE source = 'manual' AND account_name = s.account_name
        AND public.normalize_link_url(url) = public.normalize_link_url(pg->>'url')
      ORDER BY created_at LIMIT 1;
      IF hit IS NOT NULL THEN adopted := adopted + 1; END IF;
    END IF;

    IF hit IS NULL THEN
      INSERT INTO public.account_links
        (account_name, label, url, source, repo, repo_path, page_title,
         page_headline, page_subhead, page_cta, copy_synced_at, blob_sha, synced_at)
      VALUES
        (s.account_name, pg->>'label', pg->>'url', 'funnel_repo', s.repo, pg->>'repo_path',
         pg->>'page_title', pg->>'page_headline', pg->>'page_subhead', pg->>'page_cta',
         (pg->>'copy_synced_at')::TIMESTAMPTZ, pg->>'blob_sha', now());
      added := added + 1;
    ELSE
      -- Keep the existing label: an adopted link keeps the name someone gave it.
      UPDATE public.account_links SET
        account_name   = s.account_name,
        url            = pg->>'url',
        source         = 'funnel_repo',
        repo           = s.repo,
        repo_path      = pg->>'repo_path',
        page_title     = pg->>'page_title',
        page_headline  = pg->>'page_headline',
        page_subhead   = pg->>'page_subhead',
        page_cta       = pg->>'page_cta',
        copy_synced_at = (pg->>'copy_synced_at')::TIMESTAMPTZ,
        blob_sha       = pg->>'blob_sha',
        synced_at      = now()
      WHERE id = hit;
    END IF;
  END LOOP;

  -- Pages deleted from the repo drop off the list.
  DELETE FROM public.account_links
  WHERE source = 'funnel_repo' AND repo = s.repo
    AND starts_with(repo_path, s.root_dir || '/')
    AND repo_path NOT IN (SELECT e->>'repo_path' FROM jsonb_array_elements(p_pages) e);
  GET DIAGNOSTICS removed = ROW_COUNT;

  RETURN jsonb_build_object('added', added, 'adopted', adopted, 'removed', removed);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_funnel_pages(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_funnel_pages(UUID, JSONB) TO service_role;
