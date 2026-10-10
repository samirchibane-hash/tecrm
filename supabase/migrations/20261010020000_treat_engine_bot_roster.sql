-- Treat Engine bots on the same roster as the humans.
-- Assign to reads team_members. Humans keep their names and positions.
-- is_bot marks a Treat Engine bot so the dropdown shows the first name only
-- and a finished task with no completed_by can use that assignee.
-- Canopus bots are not part of this roster.

alter table public.team_members
  add column if not exists is_bot boolean not null default false;

comment on column public.team_members.is_bot is
  'Treat Engine bot. Shown and stored by first name. Not a Canopus bot.';

insert into public.team_members (name, is_bot)
select bot, true
from unnest(array[
  'Yan', 'Tommy', 'Jimmy', 'Amy', 'Miu', 'David', 'Alex', 'Warren', 'Elon', 'Jason', 'Nole'
]) as bot
where not exists (
  select 1 from public.team_members existing where existing.name = bot
);
