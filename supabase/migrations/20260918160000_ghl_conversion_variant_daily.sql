-- Booked appointments per split-test arm.
--
-- The funnel has three measures and each has exactly one source:
--   views  → funnel_variant_events   (the page reports what it showed)
--   leads  → funnel_variant_events   (the page reports its own opt-in)
--   booked → here                    (the booking happens in GoHighLevel)
--
-- They are never added together and never substituted for one another. Meta
-- attributes a view to the ad rather than to the arm, so it cannot split a
-- test; GHL never sees a page view. Each source is asked only what it knows.
--
-- `lead` is counted here too, but only so an arm's booked rate has a
-- denominator from the same source. The board still reads its lead *count*
-- from the page events — a lead that books flips type from 'lead' to
-- 'water test' on the same row, so GHL's lead count is a different quantity
-- from the page's and mixing them would make a funnel that loses people.

create or replace view public.ghl_conversion_variant_daily as
select al.url                                         as url,
       g.lp_variant                                   as variant,
       g.created_on                                   as day,
       -- Same predicates as the account dashboard (components/dashboard/AccountCard.tsx).
       -- A 'water test' row is both: it is a lead that went on to book.
       count(*) filter (where lower(g.type) in ('lead', 'water test'))        as leads,
       count(*) filter (where lower(g.type) in ('appointment', 'water test')) as booked
from public.ghl_conversions g
-- tecrm_id is text and has held '' before, so the cast is guarded by a CASE:
-- a WHERE clause would not pin evaluation order and one bad row would take the
-- whole view down.
join public.accounts a
  on a.id = (case
               when g.tecrm_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
               then g.tecrm_id::uuid
             end)
-- lp_page is the *base* slug ('broadway-1'), which is the page a test attaches
-- to; the arms live on it as versions, not as separate links. Anchoring the
-- match on '/' keeps 'utah-1' off 'utah-1-a'.
join public.account_links al
  on al.account_name = a.account_name
 and public.normalize_link_url(al.url) like '%/' || lower(btrim(g.lp_page))
where g.lp_variant is not null
  and g.lp_page is not null
group by al.url, g.lp_variant, g.created_on;

comment on view public.ghl_conversion_variant_daily is
  'Booked appointments per landing page split-test arm, from GHL. Views and leads come from funnel_variant_daily instead — see the migration header.';

-- A view runs with its owner's rights unless told otherwise, which would hand
-- out the rows the underlying tables withhold.
alter view public.ghl_conversion_variant_daily set (security_invoker = on);
revoke all on public.ghl_conversion_variant_daily from anon;
