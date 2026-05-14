ALTER TABLE settings ADD COLUMN IF NOT EXISTS onboarding_checklists jsonb DEFAULT '{}';
