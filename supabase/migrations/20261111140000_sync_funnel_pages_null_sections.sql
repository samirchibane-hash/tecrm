-- github-sync has failed every run since 2026-10-28 02:17 UTC ("cannot extract
-- elements from a scalar"). github-sync sends page_sections as JSON null for a
-- page whose structure hasn't been read yet, and jsonb_array_elements_text()
-- raises on a JSON null instead of returning nothing. The whole run aborted, so
-- no page pushed since 2026-10-28 reached account_links.
-- Fix: only unpack page_sections when it is a JSON array; otherwise NULL.

create or replace function public.sync_funnel_pages(p_site_id uuid, p_pages jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  s        record;
  pg       jsonb;
  hit      uuid;
  added    integer := 0;
  adopted  integer := 0;
  removed  integer := 0;
begin
  select f.repo, f.root_dir, a.account_name into s
  from public.funnel_sites f join public.accounts a on a.id = f.account_id
  where f.id = p_site_id;
  if not found then
    raise exception 'funnel site % not found', p_site_id;
  end if;

  for pg in select * from jsonb_array_elements(p_pages) loop
    select id into hit from public.account_links
    where repo = s.repo and repo_path = pg->>'repo_path';

    if hit is null then
      select id into hit from public.account_links
      where source = 'manual' and account_name = s.account_name
        and public.normalize_link_url(url) = public.normalize_link_url(pg->>'url')
      order by created_at limit 1;
      if hit is not null then adopted := adopted + 1; end if;
    end if;

    if hit is null then
      insert into public.account_links
        (account_name, label, url, source, repo, repo_path, page_title,
         page_headline, page_subhead, page_cta, copy_synced_at, blob_sha, synced_at,
         template_key, page_sections, structure_synced_at)
      values
        (s.account_name, pg->>'label', pg->>'url', 'funnel_repo', s.repo, pg->>'repo_path',
         pg->>'page_title', pg->>'page_headline', pg->>'page_subhead', pg->>'page_cta',
         (pg->>'copy_synced_at')::timestamptz, pg->>'blob_sha', now(),
         pg->>'template_key',
         (case when jsonb_typeof(pg->'page_sections') = 'array' then (select array_agg(x) from jsonb_array_elements_text(pg->'page_sections') x) end),
         (pg->>'structure_synced_at')::timestamptz);
      added := added + 1;
    else
      -- Keep the existing label: an adopted link keeps the name someone gave it.
      update public.account_links set
        account_name        = s.account_name,
        url                 = pg->>'url',
        source              = 'funnel_repo',
        repo                = s.repo,
        repo_path           = pg->>'repo_path',
        page_title          = pg->>'page_title',
        page_headline       = pg->>'page_headline',
        page_subhead        = pg->>'page_subhead',
        page_cta            = pg->>'page_cta',
        copy_synced_at      = (pg->>'copy_synced_at')::timestamptz,
        blob_sha            = pg->>'blob_sha',
        synced_at           = now(),
        template_key        = pg->>'template_key',
        page_sections       = (case when jsonb_typeof(pg->'page_sections') = 'array' then (select array_agg(x) from jsonb_array_elements_text(pg->'page_sections') x) end),
        structure_synced_at = (pg->>'structure_synced_at')::timestamptz
      where id = hit;
    end if;
  end loop;

  -- Pages deleted from the repo drop off the list.
  delete from public.account_links
  where source = 'funnel_repo' and repo = s.repo
    and starts_with(repo_path, s.root_dir || '/')
    and repo_path not in (select e->>'repo_path' from jsonb_array_elements(p_pages) e);
  get diagnostics removed = row_count;

  return jsonb_build_object('added', added, 'adopted', adopted, 'removed', removed);
end;
$function$;
