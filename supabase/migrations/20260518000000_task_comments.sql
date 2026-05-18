create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  body text not null default '',
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx on task_comments (task_id);

grant select, insert, update, delete on task_comments to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

create policy "task_attachments_insert"
  on storage.objects for insert
  with check (bucket_id = 'task-attachments');

create policy "task_attachments_select"
  on storage.objects for select
  using (bucket_id = 'task-attachments');

create policy "task_attachments_delete"
  on storage.objects for delete
  using (bucket_id = 'task-attachments');
