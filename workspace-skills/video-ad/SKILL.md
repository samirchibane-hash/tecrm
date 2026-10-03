---
name: video-ad
description: Build animated Meta video ads for Treat Engine's water-treatment dealer clients — 4:5 feed (1080×1350) and 9:16 Stories/Reels (1080×1920) — rendered in code with Remotion from the client's Samir-approved Figma design, real product photos and confirmed offer, with optional Pollo AI b-roll, voiceover and music. Use when asked for a video ad, animated ad, animation, motion version of an image ad, Reel or Story ad for a dealer client (Tarheel, D'Orange, Kinetico, HQWA, etc.).
---

# /video-ad

Pipeline: `animations/` in this workspace (Remotion 4.0.525, React 18). Manual, layout geometry and gotchas:
**`animations/README.md` — read it before building.** Adapted from CWT's `/social` and ClearDeals' `/campaign`
(`~/CWT/social/README.md`, `~/ClearDeals/treatprezi/campaigns/README.md` hold more Remotion know-how: voiceover
timing, 3D, GIFs).

```bash
cd animations && npm run studio                                   # scrubbable editor
npx remotion still InstalledOneDay-dorange-pay0-Feed out/check/f.png --frame=440
npx remotion render InstalledOneDay-dorange-pay0-Feed out/review/<name>-feed-1080x1350.mp4 --jpeg-quality=95 --crf=16
```

## Why it's built this way

A video ad should be the **animated version of a design Samir already approved** (the last frame IS the approved
static), so image and video run as one creative family and nothing in the video is new, unreviewed design. Colours,
assets and claims live in a per-client profile (`src/clients/<slug>.ts`), so one composition serves every dealer and a
claim can't drift from what the client confirmed.

## Non-negotiables

1. **Samir approves before anything leaves this machine.** Stills of every beat → review MP4s in `out/review/` →
   his explicit yes on the video itself → only then Drive upload and Meta launch. A general "go ahead" approves the
   plan, not the look (memory `feedback-creative-approval-before-export`).
2. **Never let a generative model draw the product.** The client's real system comes from Figma (TE Client Creatives
   `hFLfqCrmNGOVFlVGlMnuCW`) as a transparent cutout. Pollo is context only (water, faucets, scale, showers, kitchens),
   with no legible text or logos.
3. **Claims come from the client profile only**: offer Samir confirmed with the client, market name, CTA. A new claim
   needs Samir's sign-off. No other client's name, logo or reviews anywhere (check product frames: the "Frame 4751" on
   the KSWI and D'Orange pages carries the LUX Pure Alkaline logo).
4. **Build from the proven winner.** Default campaign is `InstalledOneDay` (the IMG013 image headline that won at HQWA
   and is Kinetico Utah's best ad), three money-line variants (`pay0` / `apr` / `mo`), same as the statics.
5. **Formats: 4:5 feed 1080×1350 and 9:16 Story 1080×1920.** The Story embeds the 4:5 core at top 285 with the photo
   bleeding to the top; nothing important in the bottom 330px (Instagram's UI).
6. **Meta plays muted:** every claim is on screen. Voiceover/music (Pollo: ElevenLabs `eleven-v3`, Suno) is optional,
   and **Pollo credits need Samir's OK with the `pollo_estimate_generation_cost` number first.**
7. **Design to a senior Facebook-ads standard** (the rules from `perf-report` §5): CTA is the highest-contrast element,
   no flat brand-colour walls, light band for dark products, dark band for stainless/light products.

## Workflow

1. Read `animations/README.md`, the client's `clients/<slug>.md`, and their approved Figma frame.
2. **Client profile**: if `src/clients/<slug>.ts` doesn't exist, build it from the approved Figma frame: sample colours
   (`get` fills via `use_figma`), download the photo, product cutout and logo as **raw transparent images**
   (`download_assets` → `rawImages`; the node `export` renders the parent's background into the PNG), put them in
   `public/clients/<slug>/`, register in `src/clients/index.ts`.
3. Confirm with Samir: campaign (default InstalledOneDay), money lines, formats.
4. Render a still of every beat for each new client/variant and **look at them** (text wrap vs. the static, nothing under
   the CTA, product behind text). Tile them with ffmpeg for one look.
5. Render review MP4s to `out/review/`, pull frames from the **encoded** file and check those too.
6. **Send Samir the review files and stop.**
7. After his yes: upload to Drive `<Client>/Video Ads/<campaign>/`, launch as a Lead ad set on the client's main LP
   (`meta_ads_launcher.py` handles video uploads; `launch_image_adset.py` is images-only today, so extend it with a
   `--video` path on the first video launch), then update the performance report the same turn (perf-report §6) and
   the client file.

## Adding a campaign

New file `src/compositions/<Campaign>.tsx` exporting `Core` (1080×1350), `Feed`, `Story`, `TOTAL`, props
`{client, ...variant}`; register per client × variant in `src/Root.tsx`. Reuse `motion.ts` presets (`rise`, `glideIn`,
`progress`, `pulse`, `ramp`), never an inline spring. Document the beat spine at the top of the file.

## Gotchas that have cost renders (details in the README)

- Animate headlines **word by word** (`<Phrase>`), never a whole phrase as one `inline-block`: that turns the phrase
  into a column-wide box, breaks the Figma wrap, and pushed "90 days" under the CTA.
- Match Figma type exactly (read `fontSize`/`lineHeight`/`letterSpacing` from the text node): a −0.01em tracking tweak
  changed the wrap.
- An embedded Core must not clip (`overflow: visible`) or the Story's photo bleed stops short.
- `rise()` owns `transform` and `opacity`; multiply extra opacity in, put scales on an inner element.
- Pin every `@remotion/*` package to the same exact version (`npx remotion versions`).
