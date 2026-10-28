-- Landing-page templates (Funnels → Templates tab, 2026-10-27).
--
-- A template is a page skeleton: the ordered <section>s under the hero. Every
-- funnel page in dist/ is hand-built from one of a few skeletons, so
-- github-sync reads each page's sections and tags it with the template it
-- matches (supabase/functions/_shared/funnelTemplate.ts). Nothing is tagged by
-- hand, so a new page lands on the right template on its first sync.
--
-- Split-test routers have no sections (they redirect to an arm), so their
-- template_key stays NULL; the board takes a router's template from its arms.

create table if not exists public.funnel_templates (
  key text primary key,
  name text not null,
  description text not null,
  -- The canonical skeleton, drawn as the template's wireframe.
  sections text[] not null,
  -- active = a template we build new pages from; legacy = still live somewhere, not built new.
  status text not null default 'active' check (status in ('active', 'legacy')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.funnel_templates (key, name, description, sections, status, sort_order) values
  ('short', 'Short page',
   'The control page every client runs: offer and zip form above the fold, then benefits, the client''s own reviews and a final CTA with the same form.',
   array['hero', 'benefits', 'reviews', 'cta'], 'active', 1),
  ('long_form', 'Long-form',
   'Problem-agitate page: hero, then agitation, villain, cost, mechanism and before/after before benefits, reviews and the CTA.',
   array['hero', 'agitation', 'villain', 'cost', 'mechanism', 'before-after', 'benefits', 'reviews', 'cta'], 'active', 2),
  ('long_form_v1', 'Long-form v1',
   'The original Select Source Water long page: problem, solution, offer, steps, reviews and FAQ.',
   array['hero', 'problem', 'solution', 'offer', 'steps', 'reviews', 'faq', 'cta'], 'legacy', 3)
on conflict (key) do nothing;

alter table public.funnel_templates enable row level security;
create policy admin_all on public.funnel_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.funnel_templates from anon;

alter table public.account_links
  add column if not exists template_key text references public.funnel_templates(key) on update cascade on delete set null,
  -- The page's own <section> order as last read, so the UI can draw it and a
  -- page that drifts from its template is visible.
  add column if not exists page_sections text[],
  -- NULL = never read for structure; github-sync re-reads such a page once.
  add column if not exists structure_synced_at timestamptz;

create index if not exists account_links_template_key_idx on public.account_links (template_key);

-- Same function, now also writing the three structure columns.
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
         (select array_agg(x) from jsonb_array_elements_text(pg->'page_sections') x),
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
        page_sections       = (select array_agg(x) from jsonb_array_elements_text(pg->'page_sections') x),
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
