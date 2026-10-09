-- When a task was finished, and the display name of who finished it.
--
-- tasks already has completed, assigned_to (who it is assigned to, not who
-- finished it), updated_at (bumped on every edit), and account_name.
-- None of those is a completion stamp. These two columns are.
--
-- completed_by keeps the raw display name. A bot may send "Tommy - CSM" or
-- "Amy- Image Designer"; the UI shows the first name. Null when unknown.
-- Reopening a task clears both columns.
--
-- Historical done tasks are stamped only for accounts on the Performance
-- dashboard: a row in accounts whose name is not in settings.hidden_accounts.
-- The only timestamp those rows have is updated_at, so that is what is copied.
-- Hidden accounts, tasks with no client, and anyone we cannot place are left
-- null — a missing date, not a guessed one. completed_by is not backfilled;
-- the assignee is not the completer.
--
-- This does not touch client_activity, client_work_events, or record_ops_outcome.

alter table public.tasks
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by text;

comment on column public.tasks.completed_at is
  'When the task was marked done. Null while open, and null for a historical done task with no trustworthy stamp.';

comment on column public.tasks.completed_by is
  'Display name of whoever marked the task done, role suffix included. Null when unknown. The UI shows the first name only.';

update public.tasks t
set completed_at = t.updated_at
where t.completed
  and t.completed_at is null
  and t.account_name is not null
  and exists (
    select 1 from public.accounts a
    where a.account_name = t.account_name
  )
  and not exists (
    select 1
    from public.settings s
    where jsonb_typeof(s.hidden_accounts) = 'array'
      and t.account_name in (select jsonb_array_elements_text(s.hidden_accounts))
  );

-- Going forward, flipping completed records the time when the writer did not,
-- and reopening clears the stamp. completed_by is only what the writer sent:
-- a service-role bot has no session name, so it must set the column itself.
create or replace function public.tasks_stamp_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.completed then
      if new.completed_at is null then
        new.completed_at := now();
      end if;
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;
    return new;
  end if;

  if new.completed and not coalesce(old.completed, false) then
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  elsif not new.completed and coalesce(old.completed, false) then
    new.completed_at := null;
    new.completed_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_stamp_completion on public.tasks;
create trigger tasks_stamp_completion
  before insert or update on public.tasks
  for each row
  execute function public.tasks_stamp_completion();

revoke all on function public.tasks_stamp_completion() from public;
grant execute on function public.tasks_stamp_completion() to authenticated, service_role;
