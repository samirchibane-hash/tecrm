-- A booked contact never drops back to "lead".
--
-- ghl_conversions is one row per GHL contact, and n8n ("GHL conversions to
-- Supabase") upserts it on ghl_contact_id from two GHL workflows:
--
--   * "Water Test Confirmation & Reminders" posts type 'water test' the moment
--     the homeowner books.
--   * "New Lead Follow Up" posts type 'lead'. It is entered from "Import New
--     Leads from Funnel" only after that workflow's 2 minute wait.
--
-- So anyone who books within ~2 minutes of the form (common: the page sends
-- them straight to /schedule) has their 'water test' row overwritten by the
-- late 'lead' post, appointment_time nulled with it. Traced on HQWA 2026-09-30:
-- every September booking made <=126s after opt-in was stuck as 'lead', every
-- later one was fine. The dashboard then under-counts booked tests by about half.
--
-- The rule here: the funnel only moves forward. A 'lead' post on a booked row
-- keeps the booking (type, appointment time, appointment status); everything
-- else in the post still updates the row.
create or replace function public.keep_ghl_conversion_booked()
returns trigger as $$
begin
  if lower(btrim(coalesce(old.type, ''))) in ('water test', 'appointment')
     and lower(btrim(coalesce(new.type, ''))) = 'lead' then
    new.type               := old.type;
    new.appointment_time   := coalesce(new.appointment_time, old.appointment_time);
    new.appointment_status := coalesce(new.appointment_status, old.appointment_status);
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists ghl_conversion_keep_booked on public.ghl_conversions;
create trigger ghl_conversion_keep_booked
  before update on public.ghl_conversions
  for each row execute function public.keep_ghl_conversion_booked();
