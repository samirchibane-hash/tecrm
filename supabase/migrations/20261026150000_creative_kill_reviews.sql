-- Proposed table for Yan's Monday/Thursday website-ad kill review.
-- Additive only. Do not apply as part of the preview; the screen reads a
-- bundled fixture until this lands and Yan publishes each run into it.
--
-- Appointments here are the Meta pixel Schedule event (cur_appts /
-- since_appt_spend), not GoHighLevel. Leads are the website pixel.
-- Instant Forms do not belong in this table (lead_source = 'website').
--
-- only_live_in_adset null means unknown. verdict null means no call yet.
-- The current 14-day window ends the day before run_date, matching analyze.py.

create table if not exists public.creative_kill_reviews (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  n integer not null check (n > 0),
  account_id uuid references public.accounts (id) on delete set null,
  client_name text not null,
  act text not null,
  ad_id text not null,
  ad_name text not null,
  adset_id text not null,
  adset_name text not null,
  campaign_id text,
  campaign_name text,
  business_id text,
  lead_source text not null default 'website',
  thumbnail_url text,
  cur_since date not null,
  cur_until date not null,
  prev_since date not null,
  prev_until date not null,
  cur_spend numeric not null,
  cur_leads numeric not null,
  cur_cpl numeric,
  cur_appts numeric not null,
  cplc numeric,
  ctr numeric,
  cpc numeric,
  prev_spend numeric not null,
  prev_leads numeric not null,
  prev_cpl numeric,
  prev_appts numeric not null,
  since_lead_spend numeric not null,
  last_lead_on date,
  since_appt_spend numeric not null,
  last_appt_on date,
  lifetime_spend numeric not null,
  lifetime_leads numeric not null,
  rules_hit text[] not null,
  only_live_in_adset boolean,
  verdict text,
  reason text,
  reviewer text,
  created_at timestamptz not null default now(),
  constraint creative_kill_reviews_run_ad unique (run_date, ad_id),
  constraint creative_kill_reviews_run_n unique (run_date, n),
  constraint creative_kill_reviews_lead_source check (lead_source = 'website'),
  constraint creative_kill_reviews_not_internal_act check (
    act <> 'act_1170300274125472' and act <> '1170300274125472'
  ),
  constraint creative_kill_reviews_rules_known check (
    cardinality(rules_hit) > 0
    and rules_hit <@ array['a', 'b', 'c', 'd']::text[]
  ),
  constraint creative_kill_reviews_verdict check (
    verdict is null or verdict in ('turn_off', 'watch', 'keep')
  ),
  constraint creative_kill_reviews_reason_with_verdict check (
    verdict is null or nullif(btrim(reason), '') is not null
  ),
  constraint creative_kill_reviews_scope check (
    client_name !~* 'true[[:space:]]*h2o'
    and client_name !~* 'clear[[:space:]]*deals'
    and coalesce(campaign_name, '') !~* 'clear[[:space:]]*deals'
    and client_name !~* '\yinternal\y'
    and coalesce(campaign_name, '') !~* '\yinternal\y'
  )
);

comment on table public.creative_kill_reviews is
  'One row per flagged website ad on a kill-review run. Team-readable. Yan publishes; the dashboard does not pause ads.';

comment on column public.creative_kill_reviews.campaign_id is
  'Meta campaign id. Null on runs before 2026-10-29.';

comment on column public.creative_kill_reviews.business_id is
  'Meta business id for the Ads Manager link. Null leaves business_id off the URL.';

comment on column public.creative_kill_reviews.cpc is
  'Cost per click on all clicks, only when the run supplied it. Never derived from link clicks.';

comment on column public.creative_kill_reviews.cur_appts is
  'Meta pixel Schedule events in the current 14 days. Not GoHighLevel appointments.';

comment on column public.creative_kill_reviews.only_live_in_adset is
  'True when this is the only ad still live in the ad set. Null means unknown.';

comment on column public.creative_kill_reviews.rules_hit is
  'a $200+ since last lead; b CPL over $100; c over $400 since last Schedule; d early signal, $50+ spend and CPLC over $5.';

comment on column public.creative_kill_reviews.thumbnail_url is
  'Object path in the creative-kill-thumbs bucket, or an absolute URL. The bucket is private.';

-- The act check above rejects the internal Meta account on the row itself.
-- This also rejects a row whose linked accounts.id is that same ad account,
-- even when the published act string is a client account.
create or replace function public.creative_kill_reviews_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  linked_act text;
begin
  if replace(btrim(new.act), 'act_', '') = '1170300274125472' then
    raise exception 'creative_kill_reviews rejects the internal ad account'
      using errcode = '23514';
  end if;

  if new.account_id is not null then
    select a.fb_ad_account_id into linked_act
    from public.accounts a
    where a.id = new.account_id;

    if linked_act is not null
       and replace(btrim(linked_act), 'act_', '') = '1170300274125472' then
      raise exception 'creative_kill_reviews rejects the internal ad account'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists creative_kill_reviews_guard on public.creative_kill_reviews;
create trigger creative_kill_reviews_guard
  before insert or update of act, account_id on public.creative_kill_reviews
  for each row
  execute function public.creative_kill_reviews_guard();

revoke all on function public.creative_kill_reviews_guard() from public, anon;
grant execute on function public.creative_kill_reviews_guard() to authenticated, service_role;

create index if not exists creative_kill_reviews_run_idx
  on public.creative_kill_reviews (run_date desc, n);
create index if not exists creative_kill_reviews_account_idx
  on public.creative_kill_reviews (account_id);

alter table public.creative_kill_reviews enable row level security;

drop policy if exists admin_all on public.creative_kill_reviews;
create policy admin_all on public.creative_kill_reviews
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.creative_kill_reviews from anon;
grant select, insert, update, delete on public.creative_kill_reviews to authenticated, service_role;

-- Private thumbnail bucket. Public URLs would skip RLS, so this stays private:
-- team reads with an admin session, Yan's publisher uses the service role
-- (which bypasses RLS). Upsert needs select + insert + update.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creative-kill-thumbs',
  'creative-kill-thumbs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists creative_kill_thumbs_admin_select on storage.objects;
create policy creative_kill_thumbs_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'creative-kill-thumbs' and public.is_admin());

drop policy if exists creative_kill_thumbs_admin_insert on storage.objects;
create policy creative_kill_thumbs_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'creative-kill-thumbs' and public.is_admin());

drop policy if exists creative_kill_thumbs_admin_update on storage.objects;
create policy creative_kill_thumbs_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'creative-kill-thumbs' and public.is_admin())
  with check (bucket_id = 'creative-kill-thumbs' and public.is_admin());

drop policy if exists creative_kill_thumbs_admin_delete on storage.objects;
create policy creative_kill_thumbs_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'creative-kill-thumbs' and public.is_admin());
