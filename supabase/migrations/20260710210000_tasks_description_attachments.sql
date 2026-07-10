-- Files attached to a task's description, stored in the shared
-- `task-attachments` bucket. Same shape as task_comments.attachments:
-- [{ name, url, size, type }].
alter table tasks
  add column if not exists description_attachments jsonb not null default '[]'::jsonb;
