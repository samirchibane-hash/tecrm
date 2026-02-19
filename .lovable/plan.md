
## Ad Breakdown Graph on GHL Capsule Click

### What we're building

When a user clicks the **Leads capsule** or **Appts capsule** on a company card, a horizontal bar chart panel slides open below the KPI row showing a breakdown of conversions by Ad Name — so you can instantly see which ads generated how many leads or appointments.

### How it will work

**Interaction flow:**
- Leads capsule → click → opens "Leads by Ad" bar chart
- Appts capsule → click → opens "Appts by Ad" bar chart  
- Clicking the same capsule again → closes the panel
- Clicking the other capsule → switches to that view

**Data source:**
The `ghlConversions` array is already fetched in the component. Each record has an `"Ad Name"` field. We'll group those records by ad name and count leads/appts per ad — no new database queries needed.

### Technical Changes

**1. `src/components/dashboard/AccountCard.tsx`**

- Add a `activeAdChart` state: `"leads" | "appts" | null` — tracks which chart is open (or none).
- Make both KPI capsules clickable by wrapping them in `button` elements (or adding `onClick` + `cursor-pointer`).
- Compute two derived data arrays via `useMemo`:
  - `leadsByAd`: groups `ghlConversions` by `"Ad Name"`, counting entries that are leads or water tests, sorted descending.
  - `apptsByAd`: same but for appointment / water test entries.
- Render a collapsible panel directly below the KPI row (above the Change Log section) that shows a horizontal `BarChart` from `recharts` (already installed) when `activeAdChart` is non-null.
- The chart panel will be compact — a horizontal bar chart with ad names on the Y-axis and count on the X-axis, capped to the top 8 ads to prevent overflow, with a subtle label showing the total.
- Style the panel with a light `bg-muted/20` background and rounded border, matching the card's existing aesthetic.

### Visual Layout

```text
┌─────────────────────────────────────────────────────┐
│ TL - Select Source Main                             │
│ $5,931.56   [90 leads @ $65.91]  [25 appts @ $237] │
│              ↑ click opens ↓                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Leads by Ad                              ×      │ │
│ │                                                 │ │
│ │ Campaign A ████████████████████ 42             │ │
│ │ Campaign B ██████████ 21                       │ │
│ │ Campaign C ████ 9                              │ │
│ │ Other      ████ 8                              │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ▶ Change Log (4)                              Add   │
└─────────────────────────────────────────────────────┘
```

### Key Implementation Details

- Recharts `BarChart` with `layout="vertical"` so ad names are readable on the Y-axis.
- Ad names that are `null` or `""` will be grouped as `"(No Ad Name)"`.
- The capsules get a subtle `hover:bg-muted/50 cursor-pointer transition-colors` treatment so they feel interactive.
- The chart panel uses an animated `transition-all` collapse for smooth expand/close.
- No new dependencies needed — recharts is already installed.
