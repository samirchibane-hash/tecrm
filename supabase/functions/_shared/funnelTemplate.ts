// Which landing-page template a funnel page is built on, read from its HTML.
//
// Pure (no Deno APIs) so github-sync and the CRM's tests share one definition.
// Keys match public.funnel_templates.

export type FunnelTemplateKey = "short" | "long_form" | "long_form_v1";

/**
 * The page's <section>s in order, each named by its first class (or id):
 * "benefits-section" → "benefits". Generic `class="section"` blocks stay
 * "section". A split-test router has none.
 */
export function pageSections(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<section\b([^>]*)>/gi)) {
    const attrs = m[1];
    const name = /\bclass="\s*([^"\s]+)/i.exec(attrs)?.[1] ?? /\bid="\s*([^"\s]+)/i.exec(attrs)?.[1] ?? "section";
    out.push(name.toLowerCase().replace(/-section$/, ""));
  }
  return out;
}

/**
 * The template a skeleton matches, or null when it matches none (a router, a
 * booking page, something new). Long-form markers win over length, so a long
 * page missing one block is still long-form.
 */
export function classifyTemplate(sections: string[]): FunnelTemplateKey | null {
  if (!sections.includes("hero")) return null;
  const has = (s: string) => sections.includes(s);
  if (has("agitation") || has("villain") || has("mechanism")) return "long_form";
  if (has("problem") && (has("solution") || has("faq"))) return "long_form_v1";
  // Hero plus up to four blocks: benefits, reviews and the closing CTA (some
  // pages name them generically, one drops reviews).
  if (sections.length <= 5) return "short";
  return null;
}
