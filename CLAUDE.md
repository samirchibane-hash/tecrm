# TECRM — Client Reporting Dashboard

Internal CRM for Treat Engine (ad agency). Tracks client accounts, campaigns, creatives,
GHL conversions, and call center metrics. React 18 + Vite + TypeScript + Tailwind +
shadcn/ui + Supabase, deployed on Vercel.

**Two audiences, two bars.** Internal operator screens (`Index`, `AccountDetail`,
`Creatives`, `Settings`) optimize for density and speed. Client-facing screens
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
- Status coloring → shared status component driven by a `status` prop, not class maps

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
different economics. `AccountCard.tsx`'s `CPL_TARGET`/`APPT_TARGET` are existing debt to
migrate, not a pattern to copy.

### 7. Charts

Use the `dataviz` skill before writing any chart, tile row, or picking series colors.
Series colors come from `--chart-1` … `--chart-5`, which are already theme-aware. Charts
must be legible in both themes and must not encode meaning in color alone.

### 8. Responsive and accessible by default

Mobile matters — clients open reports on phones. Use the existing `useIsMobile` hook
rather than new breakpoint logic. Interactive elements need accessible names, visible
focus rings (`--ring`), and real keyboard paths. Prefer Radix primitives already in
`components/ui/` over hand-rolled interaction.

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
