-- Funnel Pages: the account page's link list mirrors every page built in
-- funnels/dist (the temetamanager repo). github-sync reads that repo's default
-- branch, which is exactly what Vercel deploys, and keeps one account_links row
-- per dist/<site>/<page>/index.html. Hand-added links are never touched, except
-- that a hand-added link to a synced page is adopted instead of duplicated.

-- One row per Vercel project: which folder is which client, served on which host.
CREATE TABLE IF NOT EXISTS public.funnel_sites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  repo       TEXT NOT NULL DEFAULT 'samirchibane-hash/temetamanager',
  root_dir   TEXT NOT NULL CHECK (root_dir ~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$'),  -- 'dist/true_water'
  domain     TEXT NOT NULL CHECK (domain ~ '^[a-z0-9.-]+$'),                             -- final host, no scheme
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo, root_dir)
);
CREATE INDEX IF NOT EXISTS funnel_sites_account_idx ON public.funnel_sites (account_id);

ALTER TABLE public.funnel_sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all ON public.funnel_sites;
CREATE POLICY admin_all ON public.funnel_sites
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- manual      = added from the account page
-- funnel_repo = owned by github-sync; label is set once, the rest on every run
ALTER TABLE public.account_links
  ADD COLUMN IF NOT EXISTS source     TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS repo       TEXT,
  ADD COLUMN IF NOT EXISTS repo_path  TEXT,          -- dist/true_water/broadway-1/index.html
  ADD COLUMN IF NOT EXISTS page_title TEXT,          -- the page's <title>
  ADD COLUMN IF NOT EXISTS blob_sha   TEXT,          -- skips re-reading unchanged pages
  ADD COLUMN IF NOT EXISTS synced_at  TIMESTAMPTZ;

ALTER TABLE public.account_links DROP CONSTRAINT IF EXISTS account_links_source_check;
ALTER TABLE public.account_links ADD CONSTRAINT account_links_source_check
  CHECK (source IN ('manual', 'funnel_repo')
     AND (source = 'manual' OR (repo IS NOT NULL AND repo_path IS NOT NULL)));

-- NULLs are distinct, so manual rows never collide.
ALTER TABLE public.account_links DROP CONSTRAINT IF EXISTS account_links_repo_path_key;
ALTER TABLE public.account_links ADD CONSTRAINT account_links_repo_path_key UNIQUE (repo, repo_path);

-- Compare links the way a person would: scheme, www., case and a trailing
-- slash don't make a different page.
CREATE OR REPLACE FUNCTION public.normalize_link_url(u TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT rtrim(regexp_replace(regexp_replace(lower(btrim(u)), '^https?://', ''), '^www\.', ''), '/');
$$;

-- Reconcile one site's links with the pages github-sync found on the default
-- branch. p_pages: [{repo_path, url, label, page_title, blob_sha}, ...].
-- Atomic per site, so a failed run never leaves a half-synced list.
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
        (account_name, label, url, source, repo, repo_path, page_title, blob_sha, synced_at)
      VALUES
        (s.account_name, pg->>'label', pg->>'url', 'funnel_repo', s.repo, pg->>'repo_path',
         pg->>'page_title', pg->>'blob_sha', now());
      added := added + 1;
    ELSE
      -- Keep the existing label: an adopted link keeps the name someone gave it.
      UPDATE public.account_links SET
        account_name = s.account_name,
        url          = pg->>'url',
        source       = 'funnel_repo',
        repo         = s.repo,
        repo_path    = pg->>'repo_path',
        page_title   = pg->>'page_title',
        blob_sha     = pg->>'blob_sha',
        synced_at    = now()
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

-- Live sites as of 2026-09-11 (every page verified 200 on these hosts).
-- Pure Viva is churned and left out. Looked up by name, skipped if renamed.
INSERT INTO public.funnel_sites (account_id, root_dir, domain)
SELECT a.id, v.root_dir, v.domain
FROM (VALUES
  ('D''Orange Services',          'dist/dorange',       'test.purifywithdorange.com'),
  ('High Quality Water and Air',  'dist/hqwa',          'new.highqualitywaterandair.co'),
  ('Kinetico of SW Idaho',        'dist/kinetico',      'test.kineticotv.co'),
  ('Kinetico UT',                 'dist/kinetico_utah', 'new.kineticout.co'),
  ('TL -Select Source Main',      'dist/ssw',           'test.selectsourcewater.co'),
  ('Tarheel Pure Water',          'dist/tarheel',       'test.tarheelwatersystems.com'),
  ('True Water',                  'dist/true_water',    'www.truewatervirginia.com')
) AS v(account_name, root_dir, domain)
JOIN public.accounts a ON a.account_name = v.account_name
ON CONFLICT (repo, root_dir) DO NOTHING;
