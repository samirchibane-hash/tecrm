-- Team members: a simple roster (name + position) used to assign
-- Creative Requests and Tasks. No auth/login — display purposes only.
create table if not exists public.team_members (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  position   text,
  created_at timestamptz not null default now()
);

alter table public.team_members enable row level security;
create policy "allow_all_team_members" on public.team_members
  for all using (true) with check (true);

-- Tasks can now be assigned to a team member (stored as the member's name,
-- mirroring how creative_requests.assigned_to already works).
alter table public.tasks add column if not exists assigned_to text;
