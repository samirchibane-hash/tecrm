-- Link Change Log Options to Tasks: store the selected category path
-- (e.g. "CRM" or "CRM › Automations") on each task.
alter table tasks add column if not exists category text;
