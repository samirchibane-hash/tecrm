import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONFIG_SCHEMA = `
{
  "hero": { "headline": "string (can include <em> tags)", "subhead": "string" },
  "urgency": { "text": "string" },
  "geo": { "banner_text": "string", "banner_emoji": "emoji" },
  "social_proof": { "google_rating": "4.8", "google_review_count": "string", "years_in_business": "string" },
  "problem": {
    "headline": "string (can include <em> tags)",
    "subhead": "string",
    "stat_num": "percentage",
    "stat_label": "string",
    "entries": [{ "icon": "emoji", "title": "string", "desc": "string" }]
  },
  "solution": {
    "headline": "string",
    "subhead": "string",
    "benefits": [{ "title": "string", "sub": "string" }]
  },
  "offer": {
    "headline": "string",
    "subhead": "string",
    "pills": ["string"],
    "cta_text": "string",
    "guarantee": "string"
  },
  "steps": {
    "headline": "string",
    "entries": [{ "title": "string", "desc": "string" }]
  },
  "reviews": {
    "headline": "string",
    "entries": [{ "text": "string", "author": "First L.", "date": "X days ago" }]
  },
  "faqs": [{ "question": "string", "answer": "string" }],
  "cta": { "headline": "string (can include <em> tags)", "subhead": "string", "sticky_text": "short CTA string" }
}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formData, pages } = await req.json();

    const pageDescriptions = pages
      .filter((p: { type: string }) => p.type !== "schedule")
      .map((p: { type: string; slug: string }) =>
        `- ${p.type === "landing-1" ? "Landing Page 1 (primary, full content)" : "Landing Page 2 (secondary variant, slightly different angle)"}  slug: ${p.slug}`
      )
      .join("\n");

    const prompt = `You are an expert direct-response copywriter specializing in home services and water treatment. Your copy is urgent, local-feeling, benefit-driven, and converts homeowners to leads.

Write landing page copy for:
- Brand: ${formData.brandName}
- City: ${formData.city}, ${formData.state}
- Service: residential water treatment / whole-home filtration and softening systems
- Target customer: homeowners worried about tap water quality, hard water, health concerns
- Tone: urgent, trustworthy, locally relevant, no fluff

Pages to generate copy for:
${pageDescriptions || "(landing pages only)"}

For each page, generate copy tailored to that specific city and brand. Reference real local water quality concerns for ${formData.city}, ${formData.state} (hard water, specific contaminants common in the region, etc.).

Return a JSON object where each key is the page slug, and the value is the copy object matching this schema:
${CONFIG_SCHEMA}

Important:
- Use <em> tags in headlines for emphasis (they render in blue)
- Reviews should sound authentic and local (mention ${formData.city})
- FAQs should address common objections for water treatment sales
- Make the hero headline punchy and specific to ${formData.city}
- Return ONLY valid JSON, no markdown, no explanation`;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY secret not configured");

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`Anthropic API error ${aiRes.status}: ${await aiRes.text()}`);
    }

    const aiData = await aiRes.json();
    const text: string = aiData.content?.[0]?.text ?? "{}";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI response did not contain valid JSON");

    const copy = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ copy }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("funnel-copy-gen error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
