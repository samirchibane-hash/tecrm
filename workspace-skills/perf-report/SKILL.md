---
name: perf-report
description: Portfolio performance report and execution loop for every active Treat Engine client. Pulls Meta Ads (lead-form and website campaigns, separately) plus funnel and GHL data, audits account structure, analyzes each client and then across clients with a four-expert panel (Meta ads manager, direct-response copywriter, CRO expert, water quality expert), writes a CMO-level Claude Doc with one sub-report tab per client, then executes what Samir approves ("do 1 and 2") — pauses, budgets, Lead-optimization rebuilds, new image ad sets, Figma creative — and updates the report in the same turn. Use when Samir asks for a performance report, account review, portfolio review, "how are the accounts doing", optimization suggestions, or to act on a report item.
---

# /perf-report

**The loop Samir wants** (2026-09-30: "allows me to assume what the data means and what to do next, then put it into
execution right away"): read the data → say plainly what it means and what you'd bet on → Samir says go → execute with
the tools below → the report shows it the same turn. Every step serves that loop; nothing is done until the report says so.

Args (optional): window in days (default 14), client names to limit the report, clients to exclude.
Rulebook: `directives/performance_review.md` ("Samir's rules" first). Samir's style: memory `feedback-account-review-style`.

## 1. Pull the numbers (deterministic; never estimate)

**Meta:** `python3 execution/performance_snapshot.py --days <N> [--accounts ...]` → `.tmp/perf_report/<date>/snapshot.json`
+ `summary.md`: portfolio benchmarks per lead source (mean of accounts with ≥3 results), per-account totals (website and
form kept separate), campaign rollups with the prior window, ad set rollups, active ad sets with budgets and
optimization event, every delivered ad with copy, verdict, `preview_url`, Figma frame hint and Ads Manager link, and the
**Structure audit** (website ad sets not on LEAD; live ads off the account's main landing page). Unreadable accounts are
listed, not fatal. Samir excludes some clients by request; recompute benchmarks without them.

**Funnel + GHL** (Supabase MCP `execute_sql`, project `wyjxkkabuwuuvyzrsusy`). CRM account names differ from the launcher
config: join on `accounts.fb_ad_account_id`. First check `select max(created_on) from ghl_conversions`; more than a day
old = n8n sync down, don't read GHL zeros as real.

Page views, verified leads and bookings per headline variant (split-tested pages keep their copy on `<url>-<variant>`):
```sql
with w as (select date '<since>' s, date '<until>' u),
links as (select id, account_name, url, lower(rtrim(regexp_replace(url,'^https?://(www\.)?',''),'/')) k, page_headline, page_subhead, page_cta from account_links),
copy as (select k, max(page_headline) headline, max(page_subhead) subhead, max(page_cta) cta from links group by k),
views as (select l.k, v.variant, max(l.account_name) account_name, min(l.url) url, sum(v.views) views from funnel_variant_daily v join links l on l.id=v.account_link_id, w where v.day between w.s and w.u group by 1,2),
ghl as (select lower(rtrim(regexp_replace(url,'^https?://(www\.)?',''),'/')) k, variant, sum(leads) leads, sum(booked) booked from ghl_conversion_variant_daily, w where day between w.s and w.u group by 1,2)
select v.account_name, v.url, v.variant, coalesce(cv.headline, c.headline) headline, coalesce(cv.cta, c.cta) cta, v.views, g.leads verified_leads, g.booked
from views v left join copy cv on cv.k = v.k||'-'||v.variant left join copy c on c.k=v.k
left join ghl g on g.k=v.k and g.variant=v.variant
where v.url !~* 'schedule|calendar|booking|thank|confirm' order by 1, 2, 3;
```
`verified_leads` NULL = not tracked, never 0. **Page conversion = counted leads ÷ Meta landing page views** (what the
CRM Funnels page divides by); split-test arms use the page's own `views`. Never Meta leads ÷ LPV.

GHL leads, appointments and attribution coverage per account:
```sql
select a.account_name, a.fb_ad_account_id,
  count(*) filter (where g.type = 'lead') ghl_leads,
  count(*) filter (where lower(g.type) = 'water test') ghl_appts,
  count(*) filter (where g.type = 'lead' and g.lp_variant is not null and g.lp_page is not null) attributed_leads,
  count(*) filter (where nullif(g."Ad Name", '') is not null) with_ad_name
from accounts a left join ghl_conversions g on g.tecrm_id = a.id::text and g.created_on between '<since>' and '<until>'
where a.fb_ad_account_id is not null group by 1, 2 order by 1;
```
Per ad (accounts with `with_ad_name` > 0): group `ghl_conversions` by `"Ad Name"` the same way.

**Booking reconciliation: GHL calendar vs CRM (required, before any booked number is read).** The CRM under-counted
booked tests by half for a month and nothing flagged it (2026-09-30: September 19 in the CRM vs 38 on the calendars;
cause in memory `project_booking_overwrite_race`). So every run proves the CRM's bookings against GHL first:
1. Per active client, LeadConnector MCP `get-calendar-events` on its booking calendar (`locationId` + `calendarId` from
   `context/ghl_integration.md`; `startTime` = window start − 7 days, `endTime` = window end + 45 days, epoch ms as
   strings). Keep events whose `dateAdded` falls in the window, drop `appointmentStatus = cancelled`, one per
   `contactId` (latest `startTime`). Select Source Water is out of MCP scope: say "not reconciled".
2. Match them against the CRM:
```sql
with cal(account, cid, appt, source) as (values ('HQWA','<contactId>','<YYYY-MM-DD>','booking_widget') /* … */)
select c.account, c.cid, c.appt, c.source, g.type, g.appointment_time, g.created_on,
  case when g.ghl_contact_id is null then 'missing from CRM'
       when lower(g.type) <> 'water test' then 'booked in GHL, lead in CRM'
       else 'ok' end status
from cal c left join ghl_conversions g on g.ghl_contact_id = c.cid order by status, 1;
-- and the reverse: CRM bookings in the window the calendar doesn't hold (cancelled, or another calendar)
select a.account_name, g.ghl_contact_id, g.created_on, g.appointment_time from ghl_conversions g
join accounts a on a.id::text = g.tecrm_id
where lower(g.type) = 'water test' and g.created_on between '<since>' and '<until>'
  and g.ghl_contact_id not in (/* every calendar contactId, cancelled ones included */);
```
3. Read it: per client `Calendar | CRM | Gap`. **Any gap of 2+ on a client, or 10%+ portfolio-wide, is a `Tracking ·`
   finding at the top of the report** and of Three decisions; book numbers in the report come from the calendar until
   the CRM agrees. "Booked in GHL, lead in CRM" = the lead post overwrote the booking (guarded by trigger
   `ghl_conversion_keep_booked` since 2026-09-30: if it recurs, the guard or n8n changed). "Missing from CRM" = n8n /
   `tecrm_id`. CRM bookings the calendar lacks = cancellations the CRM never hears about (Tarheel, D'Orange): list them.
4. With Samir's go, correct stuck rows (`update ghl_conversions set type='water test', appointment_time=<appt> where
   ghl_contact_id=… and lower(type)='lead'`), skipping staff test bookings (H2O's Caleb Hopkins), and log it in What
   changed. Put the reconciliation table in the main tab's **Data gaps** every run, even when it's clean ("reconciled: 0 gap").

**A lead = a GHL contact carrying both `lp_page` and `lp_variant`. Nothing else counts, anywhere in the report**
(lead paragraph, scorecard, cost per lead, funnel), the same rule as the CRM Funnels page
(reports.treatengine.com/funnels). Instant-form leads and unattributed contacts get one "not counted" line on the client
tab, never a number in a total. `ghl_conversions` is **one row per contact** (PK `ghl_contact_id`): when a lead books,
its row flips from `lead` to `water test`. So counted leads = rows with both lp fields of either type, booked = the
`water test` ones among them, and lead → booked = booked ÷ counted leads. Time-to-book can't be measured.

**Funnel by page** (the CRM Funnels page's numbers, rebuilt here):
- Meta spend / link clicks / landing page views per page: read each delivering ad's creative
  (`/<ad_id>?fields=creative{object_story_spec,asset_feed_spec}`), strip the query string off the link, sum the
  snapshot's ad rows by page.
- Page views and form submits per ad (the page's own tracker, `-a`/`-b` split copies only):
```sql
select l.account_name, l.url, coalesce(e.ad_name,'(no ad tag)') ad,
  count(*) filter (where event='view') views, count(*) filter (where event='lead') submits
from funnel_variant_events e join account_links l on l.id=e.account_link_id
where e.occurred_at >= '<since>' and e.occurred_at < '<until>'::date + 1 group by 1,2,3;
```
- Counted leads and booked per page/variant: `ghl_conversions` grouped by `lp_page, lp_variant` (both not null).
- A page with no `-a`/`-b` copies sends no views and no `lp_variant`: it is **not tracked** (D'Orange naples-1 on
  2026-09-30), never 0%. Fix = put it in the split test.

**Page check** (every page with spend): `python3 execution/lp_mobile_check.py` (iPhone emulation, 4G throttle, trackers
blocked so it logs no views) → load time, LCP, page weight, horizontal overflow, form above the fold, plus a screenshot
of the top of the page on mobile per URL in `.tmp/perf_report/<date>/lp/`. Then **read every screenshot**: expired
offer dates ("Offer ends August 31st" was still live on 3 heroes on 2026-09-30), the headline vs the ad's promise, and
whether the offer in the ad is on screen. Never load a live `-a`/`-b` page by hand: it logs a real view.
Weekly history for client charts: group `ghl_conversions` (type = 'lead') by `date_trunc('week', created_on)` since ~Jul;
Meta weekly spend/leads: `act_<id>/insights?time_increment=7`.

## 2. Analyze: say what it means, and bet

0. **Reconciled bookings before anything.** If the booking reconciliation (section 1) shows a gap, that's the first
   finding; never judge lead → booked, cost per booked test or a page's booking rate on unreconciled CRM numbers.
1. **Structure before creative.** Read the Structure audit first: a website ad set on Schedule (it sank Tarheel and
   D'Orange), an active ad on an unattributed page, missing URL tags, a disabled ad account. These outrank every
   creative verdict.
2. **Read the history, not just the window.** A weekly GHL chart shows turning points (lead forms paused, optimization
   switched, sync gaps). Tarheel and D'Orange both looked like "bad ads" until the chart showed forms had been carrying them.
3. **Open every ad you credit or blame.** The image headline often decides it: "Installed in 1 Day. Pay $0 for 90 days"
   won at HQWA and is Kinetico Utah's best ad; price-only images lost. Grid the thumbnails and look before concluding.
4. **Four-expert panel per client**, then the cross-client pass (same frame across accounts, pooled headline test, form vs
   website economics). Where experts disagree, say which decides it (tracking before copy, copy before budget).
5. **When Samir asks what you'd bet on, give ONE pick and the reason in three bullets**, plus an honest line on what
   the evidence doesn't settle. No menus when he asks for a call.

## 3. The report (Claude Doc)

Docs connector flow (skeleton first, then fill, one section per call). Title `Performance Report · <since> → <until>`.
Tabs: main tab `Portfolio report` (`a0`), parent `Clients` (`a1`), one sub-tab per active client (`subtabOf` Clients,
`b01`… biggest spender first; `guide(["topic.tabs"])` ex.1 for the members).

**Ads and Funnel are two separate parts, everywhere** (Samir, 2026-09-30: the CMO needs a digestible overview of
performance and gaps, not creative and funnel mixed). Ads = are we buying the right clicks (setup, cost, creative).
Funnel = what happens after the click (page, lead, booking). Each part opens with performance, then a numbered gap list.

**Main tab = what a CMO needs**, outcomes and decisions only, in this order:
1. **Lead paragraph** (3 sentences): spend → counted leads (lp_page + lp_variant) → booked tests → cost per booked
   test; then one **Ads:** sentence and one **Funnel:** sentence, each with its number. Don't list excluded clients.
2. **Scorecard**: `Client | Health | Spend | Leads | Booked | Cost per lead | Top move | Detail`, with one line under it
   defining a counted lead. Health = dropdown enum (On track / Watch / Fix underway / Broken); Detail = `mention` chip.
3. **Ads**: lead sentence (cost per click and per page load, where the gaps are), then `Client | Spend | Clicks | Cost per
   click | Cost per page load | Read` with a bold Portfolio row, then **Gaps** (numbered, each with its dollar figure and
   the decision that fixes it), then one **What works** line.
4. **Funnel**: lead sentence (the two leak rates), the drawn funnel (`claude.Visualize`: link clicks → page loads →
   counted leads → booked, step rates, the leakiest step in the accent), `Client | Click → page | Page conversion |
   Lead → booked | Cost per lead | Cost per booked test` with a bold Portfolio row, one definitions line, **Gaps**
   (numbered, with numbers), then the pooled headline A vs B line, then **`### Decisions this week (funnel)`** as the
   section's last block: `# | Status | Decision | Stakes`, ids F1, F2… **Owned by `/funnel-dev`** (its section 3 has
   the format): when this report is built, run its analysis for the same window and fill it, or leave the heading
   with a pending block saying `/funnel-dev` fills it. Never drop or renumber F rows on an update.
5. **Three decisions this week**: `# | Status | Decision | Stakes`, each decision prefixed `Ads ·` or `Funnel ·`,
   dollar stake each. Status = dropdown enum (Not started / In progress / Done / Skipped).
6. **What changed**: `Date | Client | Change | Why | Daily budget`, newest first, with a one-line portfolio budget
   total ("went from $445 to $530"), recomputed from the live ad sets. Starts empty; grows as things execute.
7. **Data gaps** (only what changes how to read the numbers). No separate benchmarks or "what we learned": the
   Portfolio rows are the benchmarks, and learnings live in each part's gaps and What works line.
No ad names, action lists or thumbnails on the main tab.

**Client tab** (shorter for a healthy account):
- **Latest (date)** line right under the title: health, what's live, budget, next check. Kept current.
- **At a glance** table right under it: `At a glance | How it's performing | Biggest gap | Next step`, two rows
  (**Ads**, **Funnel**), each gap with its number, each next step pointing at its action number. A CMO reads only this.
1. **What's happening**: lead sentence with the number + a hand-rolled `claude.Visualize` chart of weekly GHL leads
   (all contacts; history before 2026-09-18 has no lp fields; grey bars, accent on the current era, turning point
   marked with a dashed line and a note placed where it won't hit bar labels, sync gaps as "no data"). Screenshot-read
   every chart and fix collisions.
2. **## Ads**, with `###` subsections:
   - **Where the money goes**: every active ad set (linked) with budget, spend, leads, best/worst ad (linked),
     verdict. A **Now (date)** note after changes.
   - **Which ads bring visitors who convert**: `Ad (linked) | Page views | Form submits | Conv.` from the page's own
     events, ads with ≥ 20 views. Same page and offer, different result = the ad's promise; name it. When click → page
     is under 65%, split it by ad here (Meta clicks vs landing page views) before blaming the page (D'Orange
     2026-09-30: 57% overall, 93% on its 1002 video, under 50% on the 1005 videos, same page).
   - **What works for other clients**: working accounts vs this client vs the change. Ad-side rows only.
   - **Copy and creative**: launch-ready primary texts grounded in the client's water source; template briefs.
   - **Ad reference**: thumbnail tables (header = linked ad name + format, images row, one-line result row) and a
     **Live since (date)** table for new creatives. Images via `act_<id>/adimages?hashes=[…]`; videos via
     `/<video_id>?fields=thumbnails`, falling back to the creative `thumbnail_url`; `sips -s format jpeg -Z 640`;
     Artifact upload (`asset: true`) → `create` blob → `![alt](blob/<id>)`. Drop blurry ones. Caption only after looking.
3. **## Funnel**: lead sentence = where this client leaks and what it costs. Then, in order:
   - Steps vs portfolio: `Step | This client | Portfolio | Read` for click → page, page conversion, lead → booked,
     cost per lead, cost per booked test.
   - By page (the Funnels page view): `Page | Spend | Clicks | Views | Leads | Conv. | Booked | Cost per lead`, page
     linked to the live URL, then the split-test read (ahead / behind / too close, ≥100 views per arm).
   - Page check: the mobile screenshot of the top of the page (uploaded, looked at), load time, overflow, form above
     the fold, offer dates, the ad's offer on the page, one concrete edit in `funnels/dist/<client>/<page>/`.
   - Tracking: pixel state, URL tags, "not counted" line (form leads, unattributed contacts), open items.
   - **`### Decisions this week (funnel)`** last: this client's F rows (shared ids + client-only), owned by
     `/funnel-dev`. The Action plan doesn't repeat them; a funnel action that's an F row says "see F2" in its Detail.
4. **## Action plan** (last): `# | Status | Action | Detail | Why | Update`, each Action prefixed `Ads ·` or
   `Funnel ·`; every funnel fix gets a row too. Review date + success line. A new row: insert it as blocks with plain
   text in Status, then replace that cell with a dropdown chip (`{"type":"dropdown","enum":"<status enum id>","index":0}`).
- A client with its own plan doc (Tarheel `056420dd-0cbf-483a-81f7-ba04444460bc`) gets a short status tab linking it,
  with the At a glance table and its Funnel section.

**Link everything you name**: ad name → `preview_url`; ad ID or ad set → Ads Manager URL
(`…/adsmanager/manage/adsets?act=<digits>&selected_adset_ids=<id>`); landing page → live URL; Figma batch → node link.

In chat: the doc link and the three decisions. Plain words, numbers inline.

## 4. Execute ("do 1 and 2")

**Pre-flight, every time you touch Meta** (each of these bit on 2026-09-30):
- `act_<id>?fields=account_status,disable_reason` — status 2 / reason 3 = disabled for billing: stop, tell Samir, only a
  human with billing access fixes it.
- Page role for new creatives: `me/accounts?fields=id,name,tasks` must list the client's Page with `ADVERTISE`, or
  creative creation fails ("contact an admin to get permission for Advertiser role"). The owner grants it to the system user.
- Dry run first; after `--go`, re-read status/budget from the API and report what Meta says, not what you sent.
- If a run fails midway, find and delete the empty ad set it left.

**Toolbox**

| Action | Tool / call |
|---|---|
| Pause ad or ad set | `POST /<id> status=PAUSED`, re-read |
| Budget change | `POST /<adset_id> daily_budget=<cents>`, re-read. >30% jump resets learning: say so, then follow Samir's number |
| Switch ad sets to Lead | `execution/relaunch_on_lead.py --account "<name>" [--adsets …] [--go]`. New ad set per source (Meta refuses event edits on published ad sets **and their copies**), same switched-on ads, dynamic-creative flag carried, source paused |
| New image ad set | `execution/launch_image_adset.py --account … --template-adset <live LEAD ad set> --name … --budget … --lp … --headline … --description … --message-file … --image "name=file" … [--dof-source-ad …] [--go]`. One shared text so the image is the only variable; standard URL tags |
| Swap images in a live ad set | same script with `--into-adset <id> --replace` (a live ad's image/link can't change: new ads in, old archived) |
| Repoint ads to the main LP | new creative with the link swapped + new ad, pause the old (`tarheel_img013_launch.py` part A) |
| Creative from a template | Figma, `directives/figma_creative_duplication.md` + section 5 below |
| LP edit | `funnels/dist/<client>/…`, preview, commit + push `funnels/` |

**Gates (always):**
- **Creative: Samir approves the rendered frames before any export, Drive upload or launch.** Build → send links and a
  screenshot → stop. "Whatever you see best" approves a plan, not a design (D'Orange was launched on that and turned off).
- **Outward-facing tests** (a test lead that creates a real GHL contact and may alert the dealer): ask first.
- Samir can override a recommendation (keep "wasters" and rebuild them, run a flagged video, bigger budget jump): note
  the risk once, then do it his way and record it as his call.

## 5. Creative in Figma (TE Client Creatives `hFLfqCrmNGOVFlVGlMnuCW`)

- **Reuse first.** Winning images already in the ad account launch without Figma. Check the client's Figma page for the
  template before building. Copy another client's proven batch (IMG013 = HQWA's "Installed in 1 Day") and keep its
  layout, headline structure and aspect ratio.
- **Three variations = one variable.** Same image and text, only the money line changes (Pay $0 / 0% APR / $0/mo for 90
  days). If a longer line wraps under the CTA, shorten the wording (0% APR, $0/mo), don't shrink the proven type.
- **Swap only brand pieces:** logo, the client's own product shot (Samir picks it when unclear), hidden region text,
  band colors. Never another client's name, logo or reviews: check product frames for stray logos (both KSWI's and
  D'Orange's "Frame 4751" carry the LUX Pure Alkaline logo on the tank).
- **Design like a 10-year Facebook-ads designer:** sample the brand color from the logo; the CTA must be the
  highest-contrast element in the lower half; a flat saturated brand-color wall looks cheap (use a gradient); dark
  product → light band (Kinetico black tanks), light/stainless product → dark band works (D'Orange navy + orange CTA).
  When unsure, build both as separate labelled variations side by side and recommend one.
- Products sit behind text and CTA but above the photo, so tank heads can overlap the photo like the source.
- If Samir resizes or rearranges something in one frame, propagate it to the sibling frames (and variation batches).
- Place new batches next to the client's existing ad frames and send a node link; far-right placement gets lost.
- Re-read frames right before export (Samir edits live). Export → `.tmp/<client>/…` → Drive `<Client>/Image Ads/IMG0XX -
  Offer - <offer>/` (trash superseded files) → launch.

## 6. Record it (same turn, every change; the CMO watches)

1. Main tab: a **What changed** row + corrected budget total; Scorecard Health and Top move; decision Status.
   "do F<n>" is a funnel decision: run it with `/funnel-dev` section 4 and set that F row's Status on every tab.
2. Client tab: **Latest (date)** line; action Status + Update cell (what actually ran, links, whose call); **Now
   (date)** note; **Live since (date)** thumbnail.
3. Client file (`clients/<slug>.md`): Campaign History row and dated Ongoing Notes, including IDs, rerun commands for
   anything blocked, and hazards found.

## Self-annealing

When a check proves wrong or a step fails, fix the script, update this skill or `directives/performance_review.md`
(changelog), and save the lesson to memory, not just this run.
