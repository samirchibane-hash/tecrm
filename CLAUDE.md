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
done. Today `--primary` is black in light and blue in dark; treat that as a known defect
to converge, and never widen the gap.

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

### 6. Thresholds are configuration, not constants

Per-client targets (cost per lead, cost per appointment, etc.) belong in account settings
and must be readable per account. Do not add module-level target constants — clients have
different economics. Targets live in `accounts.target_cpl` / `target_cpa` (edited from the
account page's Performance tab); the Performance dashboard and creative verdicts read them.
`AccountCard.tsx`'s `CPL_TARGET`/`APPT_TARGET` are remaining debt to migrate, not a pattern to copy.

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

The account page's **Performance** tab (KPIs, then scale / cut / fatigue board, breakdowns by
offer · angle · headline · primary text · format · ad set · landing page, and the full
leaderboard) and **Funnel** tab (step conversion + landing page split test), plus the
Performance dashboard's two cross-client scorecards — **creative** (`PortfolioCreativeBoard`)
and **funnel** (`PortfolioFunnelBoard`) — all read `meta-creative-performance` live, through
one shared query so the page makes a single Meta call. Pure logic lives in
`components/creative-performance/` and `components/funnel/` and is tested in
`src/test/creativeIntelligence.test.ts`. Keep it that way:

- **Verdicts are statistical claims** (`verdicts.ts`): one-sided Poisson test at 90% against the
  benchmark, plus a material gap, plus a spend floor for winners. Never label an ad or group a
  winner / money waster from a raw ratio, and never lower the bar to make a board look fuller.
- **Benchmark** = `accounts.target_cpl` / `target_cpa` (edited from the account page), else the
  account's own average, and the UI says which. **Instant-form ads are always judged against the
  account's form-lead average**, never the website CPL target (`targetFor`): form leads are
  cheap by nature and would otherwise crown every form ad.
- **Website and form leads are never summed** into one cost per lead. One lead source at a time.
- **Zero results on every ad after real spend = tracking gap**: verdicts are withheld and the UI
  asks for a tracking check instead of listing every ad as a money waster.
- **Offer / angle** are detected from copy (`labels.ts`, one taxonomy for all dealers) and
  corrected per ad name in `creative_labels`. Add an offer or angle by extending that taxonomy.
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
- The cross-client board pools pages by headline and by offer to rank what converts. That
  pooling mixes markets and audiences, so it is presented as the next test to run, never a
  verdict, and a pooled row under `MIN_GROUP_VIEWS` reads "Needs traffic" instead of ranking.
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
