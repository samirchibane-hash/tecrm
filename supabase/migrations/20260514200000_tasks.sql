create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  account_name text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
