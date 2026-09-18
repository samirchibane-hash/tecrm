-- Landing page copy versions — so the Funnel scorecard can say which version of
-- a page earned a number, instead of pinning every historical lead on whatever
-- copy happens to be live today.
--
-- account_links holds one row per page and github-sync overwrites its copy in
-- place. That was fine while pages rarely changed, but it means a period that
-- spans an edit reports its whole conversion rate under the *new* headline —
-- exactly the wrong attribution, and a design-rule-5 violation once anyone
-- rewrites a page mid-flight.
--
-- Here each distinct copy a page has ever shown gets a row with the window it
-- was live for. `valid_to` NULL = the version serving now. github-sync closes
-- the open version and opens a new one only when the copy actually differs;
-- a blob whose sha changed for unrelated reasons (a pixel id, a script) is not
-- a new version.

create table if not exists public.funnel_page_copy_versions (
  id              uuid primary key default gen_random_uuid(),
  account_link_id uuid not null references public.account_links(id) on delete cascade,
  version         integer not null,
  page_headline   text,
  page_subhead    text,
  page_cta        text,
  blob_sha        text,
  valid_from      timestamptz not null default now(),
  valid_to        timestamptz,
  created_at      timestamptz not null default now(),
  constraint funnel_page_copy_versions_window check (valid_to is null or valid_to >= valid_from)
);

comment on table public.funnel_page_copy_versions is
  'One row per distinct hero copy a funnel page has shown. valid_to NULL = live now.';

-- One open version per page, and version numbers are stable per page.
create unique index if not exists funnel_page_copy_versions_open_idx
  on public.funnel_page_copy_versions (account_link_id) where valid_to is null;
create unique index if not exists funnel_page_copy_versions_number_idx
  on public.funnel_page_copy_versions (account_link_id, version);
create index if not exists funnel_page_copy_versions_window_idx
  on public.funnel_page_copy_versions (account_link_id, valid_from desc);

alter table public.funnel_page_copy_versions enable row level security;

-- Admin-only, matching every other table (see *_lock_down_rls.sql). The funnel
-- scorecard is an internal dashboard surface, so no report_* policy is needed.
drop policy if exists admin_all on public.funnel_page_copy_versions;
create policy admin_all on public.funnel_page_copy_versions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed v1 from whatever each page is currently showing. `copy_synced_at` is the
-- last time the sync actually re-read that page's blob, so it is the best known
-- lower bound for when this copy went live — not when it was written, and the
-- UI must not present it as one.
insert into public.funnel_page_copy_versions
  (account_link_id, version, page_headline, page_subhead, page_cta, blob_sha, valid_from)
select l.id, 1, l.page_headline, l.page_subhead, l.page_cta, l.blob_sha,
       coalesce(l.copy_synced_at, l.created_at, now())
from public.account_links l
where l.source = 'funnel_repo'
  and l.page_headline is not null
  and not exists (
    select 1 from public.funnel_page_copy_versions v where v.account_link_id = l.id
  );

-- Records a page's copy, opening a new version only when it actually changed.
-- Returns the version number now live. github-sync calls this per page.
create or replace function public.record_funnel_page_copy(
  p_account_link_id uuid,
  p_headline text,
  p_subhead text,
  p_cta text,
  p_blob_sha text,
  p_observed_at timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open   public.funnel_page_copy_versions%rowtype;
  v_next   integer;
begin
  select * into v_open
  from public.funnel_page_copy_versions
  where account_link_id = p_account_link_id and valid_to is null
  limit 1;

  -- Unchanged copy: keep the open version, just refresh the sha it was seen at.
  if found
     and v_open.page_headline is not distinct from p_headline
     and v_open.page_subhead  is not distinct from p_subhead
     and v_open.page_cta      is not distinct from p_cta then
    update public.funnel_page_copy_versions
       set blob_sha = coalesce(p_blob_sha, blob_sha)
     where id = v_open.id;
    return v_open.version;
  end if;

  if found then
    update public.funnel_page_copy_versions
       set valid_to = greatest(p_observed_at, v_open.valid_from)
     where id = v_open.id;
  end if;

  select coalesce(max(version), 0) + 1 into v_next
  from public.funnel_page_copy_versions where account_link_id = p_account_link_id;

  insert into public.funnel_page_copy_versions
    (account_link_id, version, page_headline, page_subhead, page_cta, blob_sha, valid_from)
  values (p_account_link_id, v_next, p_headline, p_subhead, p_cta, p_blob_sha, p_observed_at);

  return v_next;
end;
$$;

-- Only the sync (service_role) writes versions. It is security definer, so a
-- merely-authenticated session must not reach it — same posture as sync_funnel_pages.
revoke execute on function public.record_funnel_page_copy(uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated;
