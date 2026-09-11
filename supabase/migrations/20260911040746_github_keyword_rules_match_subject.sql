-- Keyword rules match the commit subject only. Bodies routinely name other
-- clients as provenance ("Built from HQWA's okc-1", "matches
-- tarheel_pure_water"), which attributed True Water work to HQWA and Tarheel.
-- Subjects carry the "Client: …" convention, so that's the reliable signal.
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
    OR (r.kind = 'keyword' AND strpos(lower(c.subject), lower(btrim(r.pattern))) > 0)
  )
  ORDER BY c.repo, c.sha, r.account_id,
           CASE r.kind WHEN 'repo' THEN 1 WHEN 'path' THEN 2 ELSE 3 END;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

SELECT public.link_github_commits();
