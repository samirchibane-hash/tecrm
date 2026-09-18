// Offer and angle for each ad, detected from what the ad actually says (ad
// name, headlines, primary texts, descriptions). Detection is a starting point:
// an operator can correct any ad from the leaderboard, and the correction wins
// (stored in creative_labels, keyed by ad name).
//
// The taxonomy is the agency's vocabulary for water-treatment offers, shared by
// every client. Order matters: the first offer that matches is the ad's primary
// offer, most specific first (a "FREE RO system" ad usually also says "free
// water test", and the RO system is the offer that sells it).

import type { CreativeAd } from "./useCreativePerformance";

export type OfferKey = "free_ro" | "retail_price" | "discount" | "financing" | "free_test" | "none";
export type AngleKey = "skin_hair" | "contaminants" | "hard_water" | "family" | "taste_odor" | "savings" | "trust" | "none";

export const OFFERS: { key: OfferKey; label: string; pattern: RegExp | null }[] = [
  {
    key: "free_ro",
    label: "Free RO system",
    pattern: /\bfree\b[^.!?\n]{0,40}?(?:reverse[\s-]*osmosis|\br\.?\s?o\.?(?![a-z])|drinking[\s-]*water\s+system)/i,
  },
  {
    key: "retail_price",
    label: "Retail price",
    // A whole-system price ($3,495 / $3495), not a monthly figure or a discount amount.
    pattern: /\$\s?(?:\d{1,2},\d{3}|\d{4,5})(?!\s*(?:off|rebate|savings|discount|\/|per\b|a\s+(?:day|month)))/i,
  },
  {
    key: "discount",
    label: "Discount / rebate",
    pattern: /\b\d{1,2}\s?%\s?off\b|\$\s?\d[\d,]*\s?off\b|\brebates?\b|\bsave\s+(?:up\s+to\s+)?\$|\bdiscount|\binstant\s+savings/i,
  },
  {
    key: "financing",
    label: "Financing",
    // "0 payments, 0 interest" and "no payments for 6 months" are deferred-payment
    // financing offers written without a rate or a monthly figure. Without them the
    // ad or page falls through to whatever free test it also mentions, which hides
    // the offer actually being tested.
    pattern: /\$\s?\d+(?:\.\d{1,2})?\s?(?:\/|a\s|per\s)\s?(?:day|mo|month|week)\b|\bfinanc|\b0\s?%|\bno\s+money\s+down|\$0\s+down|\blow\s+monthly|\bmonthly\s+payments?|\b(?:no|0)\s+(?:payments?|interest)\b|\bpay\s+nothing\b|\bdeferred\s+payments?\b/i,
  },
  {
    key: "free_test",
    label: "Free water test",
    pattern: /\bfree\b[^.!?\n]{0,30}?\b(?:water\s+)?(?:test|testing|analysis|assessment|consultation|quote|estimate)\b/i,
  },
  { key: "none", label: "No offer detected", pattern: null },
];

export const ANGLES: { key: AngleKey; label: string; pattern: RegExp | null }[] = [
  { key: "skin_hair", label: "Skin & hair", pattern: /\b(?:skin|hair|eczema|itch\w*)\b/i },
  {
    key: "contaminants",
    label: "Contaminants & health",
    pattern: /\b(?:pfas|chlorine|chloramines?|contaminants?|chemicals?|heavy\s+metals?|arsenic|nitrates?|pathogens?|toxins?|toxic|bacteria|microplastics?)\b/i,
  },
  { key: "hard_water", label: "Hard water & scale", pattern: /\b(?:hard\s+water|limescale|scale|water\s+spots?|build-?up|appliances?|water\s+heaters?)\b/i },
  { key: "family", label: "Family & kids", pattern: /\b(?:family|families|kids|children|baby|babies|mom|moms|son|daughter)\b/i },
  { key: "taste_odor", label: "Taste & odor", pattern: /\b(?:taste|tastes|smell\w*|odou?rs?|sulfur|rotten\s+eggs?)\b/i },
  { key: "savings", label: "Bottled-water savings", pattern: /\b(?:bottled\s+water|save\s+money|savings)\b/i },
  { key: "trust", label: "Local trust & proof", pattern: /#\s?1\b|\b(?:trusted|rated|reviews?|local|family[-\s]owned)\b/i },
  { key: "none", label: "No angle detected", pattern: null },
];

export const OFFER_LABEL = Object.fromEntries(OFFERS.map((o) => [o.key, o.label])) as Record<OfferKey, string>;
export const ANGLE_LABEL = Object.fromEntries(ANGLES.map((a) => [a.key, a.label])) as Record<AngleKey, string>;

export const isOfferKey = (v: unknown): v is OfferKey => OFFERS.some((o) => o.key === v);
export const isAngleKey = (v: unknown): v is AngleKey => ANGLES.some((a) => a.key === v);

/** The first offer in precedence order that the text mentions. */
export function detectOffer(text: string): OfferKey {
  return OFFERS.find((o) => o.pattern?.test(text))?.key ?? "none";
}

/**
 * The angle is the ad's hook, so the earliest mention wins, not list order:
 * "Tired of itchy skin? Chlorine…" is a skin & hair ad that names a contaminant.
 */
export function detectAngle(text: string): AngleKey {
  let best: { key: AngleKey; index: number } | null = null;
  for (const a of ANGLES) {
    if (!a.pattern) continue;
    const m = a.pattern.exec(text);
    if (m && (best === null || m.index < best.index)) best = { key: a.key, index: m.index };
  }
  return best?.key ?? "none";
}

// Primary texts open with the hook; past this the copy is benefits and CTA.
const HOOK_CHARS = 180;

export interface CreativeLabels {
  offer: OfferKey;
  angle: AngleKey;
  offerSource: "detected" | "manual";
  angleSource: "detected" | "manual";
}

export interface LabelOverride {
  offer: string | null;
  angle: string | null;
}

export function labelCreative(ad: Pick<CreativeAd, "name" | "adset" | "copy">, override?: LabelOverride): CreativeLabels {
  const { headlines, bodies, descriptions } = ad.copy;
  const offerText = [ad.name, ...headlines, ...bodies, ...descriptions].join("\n");
  // Names first: concepts are often named for their angle ("Hair Angle", "Mom & Son").
  const names = [ad.adset ?? "", ad.name].join("\n");
  const hook = [...bodies.map((b) => b.slice(0, HOOK_CHARS)), ...headlines].join("\n");
  const namedAngle = detectAngle(names);

  const manualOffer = isOfferKey(override?.offer) ? override!.offer : null;
  const manualAngle = isAngleKey(override?.angle) ? override!.angle : null;
  return {
    offer: manualOffer ?? detectOffer(offerText),
    offerSource: manualOffer ? "manual" : "detected",
    angle: manualAngle ?? (namedAngle !== "none" ? namedAngle : detectAngle(hook)),
    angleSource: manualAngle ? "manual" : "detected",
  };
}
