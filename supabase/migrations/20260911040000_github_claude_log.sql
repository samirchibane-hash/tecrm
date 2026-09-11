-- Claude Log: a mirror of commits across the agency's GitHub repos (from
-- 2026-09-01), each linked to the CRM accounts it touched.
--
-- github-sync (hourly via pg_cron, or on demand by an admin) reads GitHub with
-- a read-only token held in Vault, set from Settings → Integrations. Linking is
-- rule-based (github_client_rules) and recomputed whenever rules change, so a
-- new rule applies to history too. All tables are admin-only.

CREATE TABLE IF NOT EXISTS public.github_repos (
  full_name      TEXT PRIMARY KEY,           -- owner/name
  html_url       TEXT,
  description    TEXT,
  is_private     BOOLEAN,
  default_branch TEXT,
  pushed_at      TIMESTAMPTZ,
  archived       BOOLEAN NOT NULL DEFAULT false,
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.github_commits (
  repo              TEXT NOT NULL REFERENCES public.github_repos(full_name) ON DELETE CASCADE,
  sha               TEXT NOT NULL,
  committed_at      TIMESTAMPTZ NOT NULL,     -- author date: when the work was done
  author_name       TEXT,
  author_login      TEXT,
  subject           TEXT NOT NULL,            -- first line of the message
  body              TEXT,                     -- the rest, trailers stripped
  claude_coauthored BOOLEAN NOT NULL DEFAULT false,
  files             TEXT[] NOT NULL DEFAULT '{}',
  additions         INTEGER,
  deletions         INTEGER,
  html_url          TEXT,
  -- github = from the API; local = seeded from a clone before the token
  -- existed. The API sync re-fetches local rows and overwrites them.
  source            TEXT NOT NULL DEFAULT 'github' CHECK (source IN ('github', 'local')),
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (repo, sha)
);
CREATE INDEX IF NOT EXISTS github_commits_committed_at_idx ON public.github_commits (committed_at DESC);

-- How a commit is attributed to a client:
--   repo    — every commit in that repo      (pattern = owner/name)
--   path    — commits touching a path prefix (repo + pattern = 'dist/tarheel/')
--   keyword — client named in the message    (pattern = 'Tarheel', case-insensitive)
CREATE TABLE IF NOT EXISTS public.github_client_rules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('repo', 'path', 'keyword')),
  repo       TEXT,
  pattern    TEXT NOT NULL CHECK (btrim(pattern) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (kind <> 'path' OR repo IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS github_client_rules_account_idx ON public.github_client_rules (account_id);

-- Derived from the rules by link_github_commits(); never edited directly.
CREATE TABLE IF NOT EXISTS public.github_commit_accounts (
  repo       TEXT NOT NULL,
  sha        TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  matched_by TEXT NOT NULL,                  -- strongest rule kind that matched
  PRIMARY KEY (repo, sha, account_id),
  FOREIGN KEY (repo, sha) REFERENCES public.github_commits(repo, sha) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS github_commit_accounts_account_idx ON public.github_commit_accounts (account_id);

CREATE TABLE IF NOT EXISTS public.github_sync_runs (
  id          BIGSERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  ok          BOOLEAN,
  counts      JSONB,
  error       TEXT
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['github_repos','github_commits','github_client_rules','github_commit_accounts','github_sync_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

-- Rebuild every commit → account link from the rules. Cheap at this volume
-- (hundreds of commits), and a full rebuild means deleting a rule unlinks too.
CREATE OR REPLACE FUNCTION public.link_github_commits()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM public.github_commit_accounts WHERE true;
  INSERT INTO public.github_commit_accounts (repo, sha, account_id, matched_by)
  SELECT DISTINCT ON (c.repo, c.sha, r.account_id) c.repo, c.sha, r.account_id, r.kind
  FROM public.github_commits c
  JOIN public.github_client_rules r ON (
       (r.kind = 'repo' AND lower(c.repo) = lower(btrim(r.pattern)))
    OR (r.kind = 'path' AND lower(c.repo) = lower(btrim(r.repo))
        AND EXISTS (SELECT 1 FROM unnest(c.files) f WHERE starts_with(f, btrim(r.pattern))))
    OR (r.kind = 'keyword'
        AND strpos(lower(c.subject || ' ' || coalesce(c.body, '')), lower(btrim(r.pattern))) > 0)
  )
  ORDER BY c.repo, c.sha, r.account_id,
           CASE r.kind WHEN 'repo' THEN 1 WHEN 'path' THEN 2 ELSE 3 END;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.link_github_commits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_github_commits() TO service_role;

CREATE OR REPLACE FUNCTION public.relink_github_commits_on_rule_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.link_github_commits();
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS github_client_rules_relink ON public.github_client_rules;
CREATE TRIGGER github_client_rules_relink
  AFTER INSERT OR UPDATE OR DELETE ON public.github_client_rules
  FOR EACH STATEMENT EXECUTE FUNCTION public.relink_github_commits_on_rule_change();

-- GitHub token lives in Vault. Admins can set or clear it from Settings but
-- can never read it back; only the service role (github-sync) can.
CREATE OR REPLACE FUNCTION public.set_github_token(token TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE sid UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO sid FROM vault.secrets WHERE name = 'github_sync_token';
  IF token IS NULL OR btrim(token) = '' THEN
    DELETE FROM vault.secrets WHERE id = sid;
  ELSIF sid IS NULL THEN
    PERFORM vault.create_secret(btrim(token), 'github_sync_token', 'Read-only GitHub token for the Claude Log sync');
  ELSE
    PERFORM vault.update_secret(sid, btrim(token));
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_github_token(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_github_token(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.github_token_status()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT created_at, updated_at INTO s FROM vault.secrets WHERE name = 'github_sync_token';
  RETURN jsonb_build_object('configured', FOUND, 'updated_at', s.updated_at);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.github_token_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.github_token_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_github_token()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'github_sync_token';
$$;
REVOKE EXECUTE ON FUNCTION public.get_github_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_github_token() TO service_role;

-- Starter rules for the active (dashboard-visible) clients. Looked up by name,
-- skipped if an account has been renamed; edit in Settings → Integrations.
INSERT INTO public.github_client_rules (account_id, kind, repo, pattern)
SELECT a.id, v.kind, v.repo, v.pattern
FROM (VALUES
  ('Tarheel Pure Water',         'repo',    NULL,                                  'samirchibane-hash/tarheel-pw-website'),
  ('Tarheel Pure Water',         'path',    'samirchibane-hash/temetamanager',     'dist/tarheel/'),
  ('Tarheel Pure Water',         'keyword', NULL,                                  'Tarheel'),
  ('D''Orange Services',         'repo',    NULL,                                  'samirchibane-hash/dorange-website'),
  ('D''Orange Services',         'path',    'samirchibane-hash/temetamanager',     'dist/dorange/'),
  ('D''Orange Services',         'keyword', NULL,                                  'D''Orange'),
  ('High Quality Water and Air', 'path',    'samirchibane-hash/temetamanager',     'dist/hqwa/'),
  ('High Quality Water and Air', 'keyword', NULL,                                  'HQWA'),
  ('High Quality Water and Air', 'keyword', NULL,                                  'High Quality Water'),
  ('Kinetico of SW Idaho',       'path',    'samirchibane-hash/temetamanager',     'dist/kinetico/'),
  ('Kinetico of SW Idaho',       'keyword', NULL,                                  'SW Idaho'),
  ('Kinetico UT',                'path',    'samirchibane-hash/temetamanager',     'dist/kinetico_utah/'),
  ('Kinetico UT',                'keyword', NULL,                                  'Kinetico Utah')
) AS v(account_name, kind, repo, pattern)
JOIN public.accounts a ON a.account_name = v.account_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.github_client_rules r
  WHERE r.account_id = a.id AND r.kind = v.kind AND r.pattern = v.pattern
);
