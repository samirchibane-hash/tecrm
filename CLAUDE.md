# TECRM — Client Reporting Dashboard

Internal CRM for Treat Engine (ad agency). Tracks client accounts, campaigns, creatives,
GHL conversions, and call center metrics. React 18 + Vite + TypeScript + Tailwind +
shadcn/ui + Supabase, deployed on Vercel.

**Two audiences, two bars.** Internal operator screens (`Index`, `AccountDetail`,
`Creatives`, `AllTasks`, `Revenue`, `ClaudeLog`, `Settings`) optimize for density and speed.
They all render inside `components/layout/AppShell` (left sidebar); the menu and the
Settings sub-pages are defined once in `components/layout/navigation.ts`, and each
Settings sub-page is its own component in `components/settings/`. Client-facing screens
(`ClientReport`, `CallCenterReport`) are the product clients judge the agency by —
they get the higher polish bar and stricter data-honesty rules below.

## Design rules

These are not suggestions. When a change conflicts with one, say so rather than
quietly breaking it.

### 1. Semantic tokens only — never raw palette classes

Never write `bg-green-50`, `text-red-600`, `border-slate-200`. Use the HSL custom
properties in `src/index.css` via their Tailwind aliases: `bg-card`, `text-muted-foreground`,
`border-border`, `bg-primary/10`.

Raw palette classes are permitted **only** inside `src/components/ui/` (vendored shadcn).

Status colors (over/under target, healthy/warning/critical) are a *token gap*, not a
license to hardcode. If a semantic token doesn't exist, add it to `:root` **and** `.dark`
in `index.css`, then use it. Do not inline a `dark:` variant pair as a workaround.

### 2. Light and dark are one brand

Every token added to `:root` gets a deliberate `.dark` counterpart with the same *meaning*
and comparable contrast — not a different hue. Check both themes before calling UI work
done. `--primary` is blue in both themes (converged 2026-10-03); keep it that way. Nothing
in the app sets `.dark` today, so light is what everyone sees — it gets the polish first.
Page ground behind cards is `bg-canvas` (the grouped grey); cards stay `bg-card`.

### 3. One vocabulary — reuse before you build

Before writing a stat tile, status pill, empty state, or number formatter, search for the
existing one and use it. If it's not good enough, **improve it in place** so every caller
benefits. Do not fork a local variant inside a page file.

- Metric tiles → the shared stat tile component, not a bespoke `<Card>` per page
- Currency/number/percent → shared helpers in `src/lib/`, never inline `toLocaleString`
- Status coloring → `components/StatusPill` (`status="success" | "warning" | "danger" | …`), not class maps.
  Failure text uses `text-danger`; `--destructive` is a button fill and is unreadable as text in dark.
- Page titles → `components/layout/PageHeader`

Known debt: `components/dashboard/KPICards.tsx` is unimported dead code while ~13 files
reimplement its label pattern inline. Consolidating toward one primitive is always
in-scope cleanup.

### 4. Pages compose, they don't implement

`src/pages/*.tsx` should wire data to components and lay out the screen. Multiple pages
here exceed 1,000 lines — that is the main reason the UI has drifted. When you touch a
region of one of those files, extract that region into `src/components/<feature>/` rather
than growing the file. Never add a new inline sub-view to a page over ~400 lines.

### 5. Data honesty — the highest-stakes rule here

This dashboard reports client performance. A wrong number costs the agency a client.

- **"No data" is never "0".** Unmapped, not-yet-synced, and genuinely-zero are three
  distinct states and must render distinctly. A blank or `0` tile that actually means
  "this account isn't mapped" is a bug, not a display choice.
- Every async surface handles **loading / empty / error / partial** explicitly. No metric
  renders a value while its query is still in flight.
- Label the period and the source on client-facing metrics. "Leads: 56" is not reportable;
  "GHL Leads · Jun 1–27" is.
- Never invent, interpolate, or round-trip a metric to make a chart look continuous.

### 6. One bar: the portfolio average, never manual targets (since 2026-10-07)

Every judgement reads against the portfolio's own value for the same period, so every client is held
to the same bar and nothing needs setting (Samir: "compare KPIs to the index or average across active
clients"). Manual per-account targets are retired: the account page's targets editor is gone, and
`accounts.target_cpl` / `target_cpa` are no longer read by any judgement (columns kept, unused).
Never add module-level target constants either; `AccountCard.tsx`'s `CPL_TARGET`/`APPT_TARGET` are
remaining debt.

- **Dashboard account table and account page KPI tiles:** cost per GHL lead / appt pool with
  `portfolioBenchmark` (spend ÷ results across clients that spent, have known spend and recorded at
  least one result). The account page also reads CPC, CPM, CTR and Meta appt cost against the pooled
  Meta figure (`lib/portfolioAverages.ts`, `usePortfolioAverages`); counts (spend, leads, reach) are
  not compared, since size isn't skill. Green at or better than average, amber up to 25% worse (20%
  for rates), red further; the tile says how far off. Hidden accounts never move the bar.
- **Creative and landing-page verdicts:** `portfolioCostPer` pools Meta's per-ad results across every
  visible client's delivered ads, per channel (website and form pooled separately), because GHL can't
  attribute every lead to an ad. A scoped (one-client) screen still uses the whole portfolio's bar.
- **Client-facing reports never show other clients' averages.**

### 7. Charts

Use the `dataviz` skill before writing any chart, tile row, or picking series colors.
Series colors come from `--chart-1` … `--chart-5`, which are already theme-aware. Charts
must be legible in both themes and must not encode meaning in color alone.

### 8. Responsive and accessible by default

Mobile matters — clients open reports on phones. Use the existing `useIsMobile` hook
rather than new breakpoint logic. Interactive elements need accessible names, visible
focus rings (`--ring`), and real keyboard paths. Prefer Radix primitives already in
`components/ui/` over hand-rolled interaction.

## Security model (since 2026-09-11)

The anon key ships in the bundle, so RLS is the only boundary. Keep it that way:

- **Admin access** = Supabase Auth session whose email is in `public.admin_users`
  (`public.is_admin()`). Every table has an `admin_all` policy for `authenticated`.
  **A new table needs its own `admin_all` policy** (copy the pattern in
  `migrations/*_lock_down_rls.sql`) or the dashboard can't read it.
- **Client report pages** (`/report/:token`, `/cc-report/:token`) run as `anon` with an
  `x-report-token` header, via `ReportClientProvider`. `report_*` policies scope them to
  that one account. Anything rendered inside a report must use `useSupabase()`, never the
  `supabase` singleton, or it will query as the wrong identity.
- **Edge functions** must call `isAdminRequest()` from `_shared/admin-auth.ts`.
  `verify_jwt` alone accepts the public anon key. Deploy with the `_shared` file included.
- Service role (edge functions, website sync) and the `postgres` role (n8n's GHL sync)
  bypass RLS.

## Creative intelligence (since 2026-09-11)

**One view of creatives, one view of funnels (since 2026-10-05).** Creatives are analysed in
`PortfolioCreativeGallery` (the Creative Performance tab of `/creatives`) and funnels in
`FunnelsBoard` (`/funnels`). The account page's **Performance** tab shows those same two
components with `accountId` set, under the account's KPIs (funnels first, then creatives); scoping only hides the client
picker / client names, never changes a number. The dashboard is the account table only: the
cross-client creative and funnel scorecards, the account page's scale/cut board, breakdowns,
leaderboard and separate Funnel tab were removed as duplicate views. Don't build a second view
of either; improve the one component so every screen gets it. All of them read
`meta-creative-performance` through one shared portfolio query (`usePortfolioCreatives`), so
moving between screens on the same period costs no extra Meta call. Pure logic lives in
`components/creative-performance/`, `components/funnel/` and `components/funnels/` and is
tested in `src/test/`. Keep it that way:

- **Ad cards are graded, not labelled (since 2026-10-07).** Each ad's Cost / lead, Link CTR and Hook are coloured
  against the whole visible portfolio's figure on that lead source (`portfolioCostPer`, `portfolioAdRates`,
  `GradedValue`; green at or better, amber a little worse, red well off), and the gallery states those averages.
  On a client's profile the bar is still the portfolio's, never the client's own ads. No per-ad verdict pill.
  The Winners / Money wasters tiles still use the verdicts below.
- **The gallery has a Copy view (since 2026-10-07)**: a `Creatives | Copy` switch, then `Headlines | Primary text`, beside
  the lead-source switch (URL `?view=copy&copy=body`), so it shows on `/creatives` and scoped on every account page. One
  row per distinct line of copy (`copyRows.ts`), pooled across ads and across clients running the same words. Attribution
  is `breakdown`'s: one text = the ad in full, rotating texts = Meta's `title_asset` / `body_asset` split (the portfolio
  query sends `detail: true` for it), unsplit rotating ads = a catch-all row at the end. Ads under a tracking gap stay
  out. Cost / lead, Link CTR and Click → lead (leads ÷ link clicks) are graded against the portfolio like ad cards;
  Winning / Losing tiles use `judge`. The part of a headline past ~40 characters and of a primary text past ~125 ("See
  more") renders muted. Copy is a view of the same gallery, not a second creatives screen.
- **Verdicts are statistical claims** (`verdicts.ts`): one-sided Poisson test at 90% against the
  benchmark, plus a material gap, plus a spend floor for winners. Never label an ad or group a
  winner / money waster from a raw ratio, and never lower the bar to make a board look fuller.
- **Benchmark** = the portfolio's pooled cost per lead on that ad's channel (`portfolioCostPer`, source
  "portfolio avg"), else the account's own average when no client qualifies, and the UI says which.
  **Instant-form ads are always judged against the portfolio's form-lead average**, never the website
  one: form leads are cheap by nature and would otherwise crown every form ad.
- **Website and form leads are never summed** into one cost per lead. One lead source at a time.
- **Zero results on every ad after real spend = tracking gap**: verdicts are withheld and the UI
  asks for a tracking check instead of listing every ad as a money waster.
- **Offer / angle** are detected from copy (`labels.ts`, one taxonomy for all dealers) and
  per-ad corrections were stored in `creative_labels` (its editor went with the breakdowns on
  2026-10-05; the table is kept). Add an offer or angle by extending that taxonomy.
  The taxonomy reads ads *and* landing pages, so a pattern gap mislabels both: "0 payments,
  0 interest" was falling through to Free water test until 2026-09-17.
- **CRM leads per ad** match `ghl_conversions."Ad Name"` (utm_content). The column only shows
  when some ad actually matches; otherwise the page says the funnel isn't passing the ad name.
- Landing pages compare on website leads ÷ landing page views with Wilson intervals and a
  two-proportion test vs the leader. Idle synced funnel pages show as "No ad traffic".
- **A landing page is judged on two separate things, never one** (`portfolioFunnel.ts`): its
  *verdict* is cost per website lead against that client's own CPL benchmark (the same Poisson
  test ads get — it's the only number carrying dollars), while its *conversion rate* isolates
  the page from the price of its traffic. A page can convert well and still cost too much.
- **CRM leads are a second source, never merged.** `allocateCrmLeads` puts a GoHighLevel lead
  on a page by the ad name the funnel passes through (`utm_content`). A lead with no ad name is
  placed only when the client has exactly one page with ad traffic — flagged `crmInferred` and
  labelled as inferred in the UI — and is otherwise reported as unallocated rather than split
  across pages. CRM leads never feed `leads`, the conversion rate, the ranking or the verdict.
- **One ranked list, not a winners/losers split.** Pages are ordered by `benchmarkIndex`
  (cost per lead ÷ that client's benchmark), which is the only way a page from a cheap
  market and one from a dear market belong in the same ranking. Pages that spent with no
  lead rank below every priced page; unscorable ones (tracking gap, no benchmark) sit last
  and are explicitly *not* ranked, because unknown isn't bad. The verdict pill stays on
  each row, so a page can rank first and still read "Too early".
- **Headline and offer are the landing page's identity.** github-sync lifts the `<h1>`,
  `.hero-subhead` and the form card line off each page into `account_links.page_headline /
  page_subhead / page_cta`; offer and angle are then detected from that copy with the same
  `labels.ts` taxonomy the ads use (`detectPageCopy` in `funnelMath.ts` — one definition,
  shared by both funnel surfaces). A page whose site isn't registered in `funnel_sites` has
  no copy, and the UI says "not synced" rather than showing a blank headline.
- `portfolioFunnel.ts` can pool pages by headline and by offer (no screen shows it since
  2026-10-05). If it comes back, that
  pooling mixes markets and audiences, so it is presented as the next test to run, never a
  verdict, and a pooled row under `MIN_GROUP_VIEWS` reads "Needs traffic" instead of ranking.
- **A page's numbers belong to the copy version that earned them** (`funnel_page_copy_versions`,
  since 2026-09-17). `account_links` holds only what a page says *today*, so without history a
  period spanning a rewrite would credit the whole conversion rate to the new headline.
  Each distinct hero copy gets a row with the window it was live for (`valid_to` NULL = live
  now); `resolveCopyVersion` counts the versions overlapping the reporting period, and a page
  with more than one is badged **mixed**, feeds `mixedPages` on every pooled row it belongs to,
  and raises a board-level notice. Only `github-sync` writes versions, through the
  `record_funnel_page_copy` RPC (service_role only — it is security definer), which opens a new
  version *only when the headline, subhead or offer line actually differs*: a blob whose sha
  moved for a pixel id or a script is not a new version. Never backfill a `valid_from` to make
  a period look clean — an unknown version is `null`, not v1.
- **Split tests are read on chance to be best (since 2026-10-07)** (`scoreArms` in `funnels/funnelRows.ts`,
  `chanceToBeBest` in `lib/stats.ts`): Beta posteriors on views → attributed lead per arm, seeded Monte Carlo so the
  number never flickers. **Winner** = ≥95% chance, every arm ≥100 views, 3+ leads; **Ahead** = the top arm once it has
  65%+ odds, named with its odds and its appt odds (a lean, never a call; Samir, 2026-10-07: a 67% leader was hidden
  behind a 75% cutoff and read as the board missing it); **Losing** only once a winner is called. Lift is against the control (first declared letter). **Every test
  runs to one fixed budget, `TEST_VIEWS_PER_ARM` = 500 views an arm** (enough to catch an arm that doubles leads at
  our ~4–6% rates), shown as a progress bar with days left at the last 7 days' pace; at the budget with no winner the
  test reads "Done: no big winner". Never show a "views to call" that scales with 1/gap² — it explodes on near-ties
  (Samir saw 40,000 vs 300 across funnels, 2026-10-07). Pills only for signal (winner, leading, losing, done): no
  "needs traffic" / "too close" / "waiting" pills, every young test is all three. Arms are the test's declared
  weights only: stray views on retired letters are not arms.
- **The Funnels board shows no page verdict pill and no offer / angle pills (Samir, 2026-10-07).** A page's
  "money waster" was its cost per lead vs the client target, which reads as a judgement on conversion (Meridian 1:
  6 leads at 5.4% was flagged). Cost per lead is an ad question for /creatives. The verdict is still computed on
  attributed GHL leads (never Meta's pixel) for ranking; don't put it back on the row.
- **Funnel rows are coloured against one portfolio average instead** (same idea as the dashboard's account table):
  Conv. and Lead → appt use `rateStatus` against the board's pooled measured-page rates (green at or above, amber
  up to 20% under, red further under, shape-marked via `RateVsAverage`), and the board states the average and how
  many pages it pools. It's testing money: show how far off, never a verdict label. On a client's own page (scoped board) the bar is still
  the whole visible portfolio's, never the client's own pages, which with one test per client would always
  read green.
- The function returns paused ads that spent in the period only to callers that send `v: 2`.
- The Performance dashboard is performance only: creative requests live on `/creatives` and
  tasks on `/tasks`, and neither is duplicated back onto the dashboard.

## Synced mirrors

Both run hourly from pg_cron (authorized by the Vault `stripe_sync_cron_secret`, which
`verify_cron_secret()` checks for every CRM cron job) and can be run from the UI.
Each run is logged to a `*_sync_runs` table; screens show freshness via `SyncStatus`.

- **Stripe** (`stripe-sync`, :07): customers, subscriptions, invoices, and
  `stripe_payments` (succeeded PaymentIntents since Jun 2024 with charge date + refunds).
  **Revenue = `stripe_payments`, not paid invoices**: checkout/one-off charges have no
  invoice. The restricted key can't read refunds or balance transactions directly, so
  refunds come from the expanded charge and land in the original payment's month.
- **GitHub** (`github-sync`, :17): commits since 2026-09-01 on each repo's default
  branch → `github_commits`, linked to accounts by `github_client_rules`
  (repo / path prefix / subject keyword). Keyword rules match the **subject only** —
  bodies name other clients as provenance. The token lives in Vault (`set_github_token`,
  admin-only, write-only from the UI). The same run lists every funnel page in each
  `funnel_sites` folder into `account_links` and parses its HTML for the title and hero
  copy. A page's blob is only re-read when its sha changed or `copy_synced_at` is NULL,
  so unchanged pages cost no API calls and pages predating the copy columns backfill once.
  Every re-read page is then passed to `record_funnel_page_copy`, which appends to
  `funnel_page_copy_versions` when the copy really changed; the run's `counts.funnel_pages`
  reports it as `versioned`.

## Working agreement

- **Match surrounding code.** Same naming, same import style, same component idiom.
- **Read before editing.** These files are large; grep for existing patterns first.
- **Verify in both themes** for any visual change, and state that you did.
- Run `npm run lint` and `npm run test` after changes; report failures with output rather
  than describing them as passing.
- Don't add dependencies for something Radix/shadcn/Tailwind already covers.

## Commands

```
npm run dev      # Vite dev server
npm run build    # production build
npm run lint     # ESLint
npm run test     # Vitest (run once)
```
