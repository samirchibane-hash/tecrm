-- A template's own production is tracked as a creative_request that flows
-- through the same Assigned → Reviewing → Approved → Launched pipeline. It is
-- not a client brief, so this flag lets the UI keep it out of the client
-- template matrix while still surfacing it in the production pipeline.
ALTER TABLE public.creative_requests
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
