-- Landing page attribution on GHL conversions.
--
-- funnel_variant_events already counts views and leads per split-test arm, but
-- it is written by the landing page and the page never learns what happened
-- afterwards. The booking happens in GoHighLevel, so the arm that earned an
-- appointment can only be known if GHL carries the arm along with it.
--
-- The pages already send it: every split page POSTs `lp_variant` and `lp_page`
-- to the GHL inbound webhook. GHL stamps them onto the contact (custom fields
-- contact.lp_variant / contact.lp_page), and the conversion workflows pass them
-- to n8n, which lands them here.

alter table public.ghl_conversions
  add column if not exists lp_variant text,
  add column if not exists lp_page    text;

-- NULL is "not tracked", never "variant a". Rows predating this column, leads
-- from the four pages that aren't split testing, and anything GHL sent without
-- the field are all genuinely unknown, and the dashboard must not read them as
-- an arm. Only a value that arrived is an attribution.
comment on column public.ghl_conversions.lp_variant is
  'Split-test arm the lead was shown, from contact.lp_variant in GHL. NULL = not tracked, never ''a''.';
comment on column public.ghl_conversions.lp_page is
  'Landing page slug the arm belongs to, e.g. ''broadway-1''. Needed because a bare ''b'' is ambiguous when one account runs two tests at once (Kinetico UT).';

-- ── Normalize and protect the attribution ───────────────────────────────────
-- Two things this table cannot survive without:
--
--  1. A CHECK constraint would reject the row, and this table is keyed by
--     ghl_contact_id, so a rejected row is a *lost conversion* — worse than a
--     stray value. Bad input is nulled out instead: store it clean or store
--     nothing, but never drop the lead.
--
--  2. n8n upserts on ghl_contact_id. The appointment workflow fires later than
--     the lead workflow and may not carry the arm; a plain upsert would then
--     write NULL over the variant recorded at lead time and silently orphan the
--     booking. A NULL must never erase a value that is already there.
--
-- Once set, the pair is first-touch and does not move. A returning visitor who
-- lands on the other arm would otherwise re-credit their own earlier booking to
-- the arm that did not earn it.
create or replace function public.set_ghl_conversion_lp_attribution()
returns trigger as $$
begin
  new.lp_variant := lower(btrim(coalesce(new.lp_variant, '')));
  if new.lp_variant !~ '^[a-z]$' then
    new.lp_variant := null;
  end if;

  new.lp_page := nullif(btrim(coalesce(new.lp_page, '')), '');

  -- Keep the pair together: an arm without its page is not an attribution.
  if new.lp_variant is null then
    new.lp_page := null;
  end if;

  if tg_op = 'UPDATE' and old.lp_variant is not null then
    new.lp_variant := old.lp_variant;
    new.lp_page    := old.lp_page;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists ghl_conversion_set_lp_attribution on public.ghl_conversions;
create trigger ghl_conversion_set_lp_attribution
before insert or update on public.ghl_conversions
for each row execute function public.set_ghl_conversion_lp_attribution();

-- ── Restore the tecrm_id trigger ────────────────────────────────────────────
-- 20260523000000_ghl_conversion_auto_tecrm_id.sql created this trigger, but it
-- is not on the table in the live database — the function is there and the
-- trigger is not, so the fallback documented in the onboarding SOP has never
-- actually run. It went unnoticed because n8n sends tecrm_id itself: only 5 of
-- 2568 rows are missing it, and those are an orphan GHL location with no
-- account row, which no trigger could have matched anyway. Recreating it costs
-- nothing (it only fires when tecrm_id is blank and an account matches) and
-- restores the safety net a misconfigured new client would need.
drop trigger if exists ghl_conversion_set_tecrm_id on public.ghl_conversions;
create trigger ghl_conversion_set_tecrm_id
before insert or update on public.ghl_conversions
for each row execute function public.set_ghl_conversion_tecrm_id();

-- ── Read path ───────────────────────────────────────────────────────────────
-- The dashboard asks one question of this: for this account and page, how many
-- conversions did each arm produce. Only attributed rows are ever scanned.
create index if not exists ghl_conversions_lp_attribution_idx
  on public.ghl_conversions (tecrm_id, lp_page, lp_variant, created_on)
  where lp_variant is not null;
