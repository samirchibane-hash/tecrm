-- Funnel Studio client registry
CREATE TABLE public.funnel_clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  domain      text NOT NULL DEFAULT '',
  tecrm_id    text NOT NULL DEFAULT '',
  created     date NOT NULL DEFAULT CURRENT_DATE,
  pages       jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX funnel_clients_tecrm_id_idx ON public.funnel_clients (tecrm_id);

CREATE OR REPLACE FUNCTION public.set_funnel_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_funnel_clients_updated_at
BEFORE UPDATE ON public.funnel_clients
FOR EACH ROW EXECUTE FUNCTION public.set_funnel_clients_updated_at();
