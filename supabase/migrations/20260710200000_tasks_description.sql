-- Add an optional long-form description / notes field to tasks, complementing
-- the short title. Rendered in the create + detail sheets.
alter table tasks add column if not exists description text;
