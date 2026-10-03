-- One client-activity stream.
--
-- Recent work (account → Operations) and /claude-log already read the same
-- GitHub commits. A pushed commit is finished work, so "GitHub pushes" and
-- "finished Claude Log items" are the same rows — source `github`, not a
-- second copy. Ops outcomes (email sent, GHL update, A2P filed, campaign
-- live, checklist stage) are the only events that had nowhere to live.
-- They land in client_activity and the view unions them with commits.
--
-- Both screens read client_work_events. The account page filters to one
-- client; /claude-log is the whole stream. There is no other feed.
--
-- Ops outcomes are scoped to accounts on the Performance dashboard
-- (settings.hidden_accounts). Hidden old clients keep whatever GitHub
-- links they already have; this migration does not relink or delete them.
-- Writer is the person who closed the work. Bot names are rejected on
-- ops rows. A commit's writer is its author, even when Claude co-authored.

create table if not exists public.client_activity (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  outcome     text not null check (outcome in (
                'client_email_sent',
                'ghl_update',
                'a2p_filed',
                'campaign_live',
                'checklist_stage'
              )),
  writer      text not null,
  summary     text not null,
  detail      text,
  occurred_at timestamptz not null default now(),
  dedupe_key  text,
  created_at  timestamptz not null default now(),
  constraint client_activity_writer_person check (
    btrim(writer) <> ''
    and lower(btrim(writer)) not in ('grok', 'claude', 'chatgpt', 'assistant', 'bot')
  ),
  constraint client_activity_summary_present check (btrim(summary) <> '')
);

comment on table public.client_activity is
  'Ops outcomes on the shared client work stream. Not a bot transcript. Write through record_ops_outcome.';

create unique index if not exists client_activity_dedupe_key_idx
  on public.client_activity (dedupe_key) where dedupe_key is not null;
create index if not exists client_activity_occurred_at_idx
  on public.client_activity (occurred_at desc);
create index if not exists client_activity_account_idx
  on public.client_activity (account_id);

alter table public.client_activity enable row level security;
drop policy if exists admin_all on public.client_activity;
create policy admin_all on public.client_activity
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.client_activity from anon;

-- Hook a later writer calls. service_role (edge functions, agents) or an
-- admin session. Repeating a dedupe_key returns the existing row.
create or replace function public.record_ops_outcome(
  p_account_id uuid,
  p_outcome text,
  p_writer text,
  p_summary text,
  p_detail text default null,
  p_occurred_at timestamptz default now(),
  p_dedupe_key text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_writer text := btrim(p_writer);
  v_summary text := btrim(p_summary);
  v_key text := nullif(btrim(coalesce(p_dedupe_key, '')), '');
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_outcome not in (
    'client_email_sent', 'ghl_update', 'a2p_filed', 'campaign_live', 'checklist_stage'
  ) then
    raise exception 'Unknown ops outcome' using errcode = '22023';
  end if;

  if v_writer is null or v_writer = '' then
    raise exception 'writer is required' using errcode = '22023';
  end if;

  if lower(v_writer) in ('grok', 'claude', 'chatgpt', 'assistant', 'bot') then
    raise exception 'writer is the person who closed the work' using errcode = '22023';
  end if;

  if v_summary is null or v_summary = '' then
    raise exception 'summary is required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.accounts where id = p_account_id) then
    raise exception 'Unknown account' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.accounts ac
    where ac.id = p_account_id
      and ac.account_name in (
        select jsonb_array_elements_text(s.hidden_accounts)
        from public.settings s
        where jsonb_typeof(s.hidden_accounts) = 'array'
      )
  ) then
    raise exception 'Ops outcomes are limited to accounts on the Performance dashboard'
      using errcode = '42501';
  end if;

  insert into public.client_activity
    (account_id, outcome, writer, summary, detail, occurred_at, dedupe_key)
  values (
    p_account_id,
    p_outcome,
    v_writer,
    v_summary,
    nullif(btrim(coalesce(p_detail, '')), ''),
    coalesce(p_occurred_at, now()),
    v_key
  )
  on conflict (dedupe_key) where dedupe_key is not null
  do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.client_activity where dedupe_key = v_key;
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_ops_outcome(uuid, text, text, text, text, timestamptz, text)
  from public, anon;
grant execute on function public.record_ops_outcome(uuid, text, text, text, text, timestamptz, text)
  to authenticated, service_role;

-- The stream both screens read.
-- source: 'github' (a pushed commit; this is also a finished Claude Log item)
--         'ops'    (one ops outcome; outcome says which)
-- account_ids: clients the event belongs to. Empty = agency work, no client.
-- writer: person who closed it. For a commit, the git author — not "Claude".
create or replace view public.client_work_events
with (security_invoker = true) as
select
  'github:' || c.repo || ':' || c.sha as id,
  c.committed_at as occurred_at,
  'github'::text as source,
  nullif(btrim(c.author_name), '') as writer,
  c.subject as title,
  c.body as detail,
  null::text as outcome,
  c.html_url as href,
  coalesce(
    array_agg(l.account_id order by l.account_id) filter (where l.account_id is not null),
    '{}'::uuid[]
  ) as account_ids,
  coalesce(
    jsonb_agg(
      jsonb_build_object('account_id', l.account_id, 'matched_by', l.matched_by)
      order by l.account_id
    ) filter (where l.account_id is not null),
    '[]'::jsonb
  ) as links,
  c.repo,
  c.sha,
  c.claude_coauthored,
  c.files,
  c.additions,
  c.deletions
from public.github_commits c
left join public.github_commit_accounts l
  on l.repo = c.repo and l.sha = c.sha
group by c.repo, c.sha
union all
select
  'ops:' || a.id::text,
  a.occurred_at,
  'ops'::text,
  a.writer,
  a.summary,
  a.detail,
  a.outcome,
  null::text,
  array[a.account_id],
  jsonb_build_array(jsonb_build_object('account_id', a.account_id, 'matched_by', null)),
  null::text,
  null::text,
  false,
  '{}'::text[],
  null::integer,
  null::integer
from public.client_activity a
join public.accounts ac on ac.id = a.account_id
where not exists (
  select 1
  from public.settings s
  where jsonb_typeof(s.hidden_accounts) = 'array'
    and ac.account_name in (select jsonb_array_elements_text(s.hidden_accounts))
);

comment on view public.client_work_events is
  'One work stream: GitHub pushes (finished Claude Log items) and in-scope ops outcomes. Recent work slices by account_ids; /claude-log reads the whole view.';

revoke all on public.client_work_events from public, anon;
grant select on public.client_work_events to authenticated, service_role;
