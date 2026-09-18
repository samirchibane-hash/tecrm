-- Landing page split tests: two versions of a page live at once, each measured
-- on its own.
--
-- Why this can't lean on Meta: Meta attributes landing page views and leads to
-- the *ad*, not the URL. One ad pointing at one page that splits its own traffic
-- looks like a single destination to Meta, so it cannot say which arm converted.
-- The conversion rate therefore comes from our own view/lead events; Meta is
-- still the only source for what the traffic cost.
--
-- Three pieces:
--   1. funnel_page_copy_versions gains `variant` — the arm a version belongs to.
--      Sequential rewrites stay variant 'a', so nothing already recorded moves.
--   2. funnel_split_tests — which page is under test, the weights, and how it ended.
--   3. funnel_variant_events — the raw views and leads, written by the public page.

-- ── 1. Versions belong to an arm ────────────────────────────────────────────
alter table public.funnel_page_copy_versions
  add column if not exists variant text not null default 'a';

comment on column public.funnel_page_copy_versions.variant is
  'Split-test arm this version is. ''a'' for an ordinary sequential rewrite.';

alter table public.funnel_page_copy_versions
  drop constraint if exists funnel_page_copy_versions_variant_key;
alter table public.funnel_page_copy_versions
  add constraint funnel_page_copy_versions_variant_key check (variant ~ '^[a-z]$');

-- A page may now have one open version *per arm*, not one overall: that is the
-- whole point of a split test. `version` stays unique per page, so every row is
-- still individually addressable.
drop index if exists public.funnel_page_copy_versions_open_idx;
create unique index if not exists funnel_page_copy_versions_open_idx
  on public.funnel_page_copy_versions (account_link_id, variant) where valid_to is null;

-- ── 2. The test itself ──────────────────────────────────────────────────────
create table if not exists public.funnel_split_tests (
  id              uuid primary key default gen_random_uuid(),
  account_link_id uuid not null references public.account_links(id) on delete cascade,
  name            text,
  status          text not null default 'running',
  -- {"a": 50, "b": 50}: relative weights the page splits traffic by.
  weights         jsonb not null default '{"a": 50, "b": 50}'::jsonb,
  started_at      timestamptz not null default now(),
  stopped_at      timestamptz,
  winner_variant  text,
  created_at      timestamptz not null default now(),
  constraint funnel_split_tests_status check (status in ('running', 'stopped')),
  constraint funnel_split_tests_stopped check (
    (status = 'running' and stopped_at is null) or (status = 'stopped' and stopped_at is not null)
  )
);

comment on table public.funnel_split_tests is
  'A landing page running two copy versions head to head. One running test per page.';

create unique index if not exists funnel_split_tests_one_running_idx
  on public.funnel_split_tests (account_link_id) where status = 'running';

-- ── 3. What the page saw ────────────────────────────────────────────────────
-- Written by funnel-track from the public landing page, so it holds no PII:
-- an opaque session id, the arm, and which of the two things happened.
create table if not exists public.funnel_variant_events (
  id              bigint generated always as identity primary key,
  account_link_id uuid not null references public.account_links(id) on delete cascade,
  variant         text not null,
  event           text not null,
  -- Opaque per-browser id, so a view and its lead can be tied together and a
  -- refresh doesn't count twice. Never a person, never reversible.
  session_id      text not null,
  -- The ad that sent them (utm_content), when the funnel passes it through.
  ad_name         text,
  occurred_at     timestamptz not null default now(),
  constraint funnel_variant_events_event check (event in ('view', 'lead')),
  constraint funnel_variant_events_variant check (variant ~ '^[a-z]$')
);

comment on table public.funnel_variant_events is
  'Raw landing page views and leads per split-test arm, written by the public page.';

-- One view and one lead per session per arm: a refresh or a double-submit must
-- not inflate either side of a test.
create unique index if not exists funnel_variant_events_once_idx
  on public.funnel_variant_events (account_link_id, variant, session_id, event);
create index if not exists funnel_variant_events_page_idx
  on public.funnel_variant_events (account_link_id, occurred_at desc);

-- Daily rollup the dashboard reads, so a board never scans raw events.
create or replace view public.funnel_variant_daily as
select account_link_id,
       variant,
       occurred_at::date as day,
       count(*) filter (where event = 'view') as views,
       count(*) filter (where event = 'lead') as leads
from public.funnel_variant_events
group by account_link_id, variant, occurred_at::date;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.funnel_split_tests enable row level security;
alter table public.funnel_variant_events enable row level security;

drop policy if exists admin_all on public.funnel_split_tests;
create policy admin_all on public.funnel_split_tests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Events are written by the edge function (service role) and read by admins.
-- anon gets neither: the page posts through funnel-track, never straight to the
-- table, so a public write can be rate limited and validated first.
drop policy if exists admin_all on public.funnel_variant_events;
create policy admin_all on public.funnel_variant_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.funnel_variant_events from anon;
revoke all on public.funnel_split_tests from anon;

-- ── record_funnel_page_copy gains the arm ───────────────────────────────────
-- A defaulted parameter makes a new signature rather than replacing the old
-- one, so both would match github-sync's six named arguments and the call would
-- fail as ambiguous. The six-argument form has to go first.
drop function if exists public.record_funnel_page_copy(uuid, text, text, text, text, timestamptz);

-- Same contract as before for sequential rewrites (variant defaults to 'a'), so
-- github-sync keeps working unchanged until it starts reporting arms.
create or replace function public.record_funnel_page_copy(
  p_account_link_id uuid,
  p_headline text,
  p_subhead text,
  p_cta text,
  p_blob_sha text,
  p_observed_at timestamptz default now(),
  p_variant text default 'a'
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
  where account_link_id = p_account_link_id and variant = p_variant and valid_to is null
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

  -- `version` stays unique across the whole page, arms included, so every
  -- recorded copy has one stable number no matter which arm it belonged to.
  select coalesce(max(version), 0) + 1 into v_next
  from public.funnel_page_copy_versions where account_link_id = p_account_link_id;

  insert into public.funnel_page_copy_versions
    (account_link_id, version, variant, page_headline, page_subhead, page_cta, blob_sha, valid_from)
  values (p_account_link_id, v_next, p_variant, p_headline, p_subhead, p_cta, p_blob_sha, p_observed_at);

  return v_next;
end;
$$;

revoke execute on function public.record_funnel_page_copy(uuid, text, text, text, text, timestamptz, text)
  from public, anon, authenticated;
