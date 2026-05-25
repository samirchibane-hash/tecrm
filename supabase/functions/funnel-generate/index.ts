import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="npm:@types/nunjucks"
import nunjucks from "npm:nunjucks@3.2.4";
import { Octokit } from "npm:@octokit/rest@20.1.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Load template files at startup
const TEMPLATES: Record<string, string> = {
  "landing-1": Deno.readTextFileSync(new URL("./templates/landing-page-1.html", import.meta.url)),
  "landing-2": Deno.readTextFileSync(new URL("./templates/landing-page-2.html", import.meta.url)),
  "schedule": Deno.readTextFileSync(new URL("./templates/calendar.html", import.meta.url)),
};

function renderPage(pageType: string, config: Record<string, unknown>): string {
  const template = TEMPLATES[pageType];
  if (!template) throw new Error(`Unknown page type: ${pageType}`);
  const env = new nunjucks.Environment();
  return env.renderString(template, { config });
}

// deno-lint-ignore no-explicit-any
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv !== null && typeof sv === "object" && !Array.isArray(sv) && typeof tv === "object" && tv !== null && !Array.isArray(tv)) {
      result[key] = deepMerge(tv, sv);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

// deno-lint-ignore no-explicit-any
function buildLandingConfig(form: any, pageSlug: string, templateNum: 1 | 2) {
  const c = form.city, s = form.state, b = form.brandName;
  return {
    meta: { title: `${b} | Free Water Test — ${c}`, description: `${c}'s #1 rated whole-home water treatment. $0 down, installed in 1 day.`, pixel_id: form.pixelId || "YOUR_META_PIXEL_ID", page_slug: pageSlug, client_slug: form.slug },
    template: templateNum === 1 ? "Landing Page 1" : "Landing Page 2",
    geo: { label: c, state: s, banner_text: `Serving ${c} Homeowners`, banner_emoji: "📍" },
    urgency: { text: "Limited install slots available this week" },
    hero: { headline: `Stop Bathing Your Family in <em>Contaminated Water</em> — Whole-Home Purification Installed in 1 Day`, subhead: `${c} tap water contains chlorine, PFAS, and heavy metals. We stop it before it enters your home — for less than your cable bill.` },
    form: { headline: "See if we service your area:", sub: "Enter your zip code for a FREE water test — takes 60 seconds", button_text: "Check My Zip →", guarantee_text: "Free, no-obligation. We never spam.", next_url: "/schedule", webhook_url: form.webhookUrl || "YOUR_GHL_INBOUND_WEBHOOK_URL" },
    social_proof: { google_rating: "4.8", google_review_count: "200+", angi_count: "150+", years_in_business: "10" },
    problem: { headline: `What's Really Coming Out of Your <em>${c}</em> Taps`, subhead: `Most homeowners assume their water is safe. ${s} water is legally treated with chlorine and routinely tests positive for PFAS, heavy metals, and excess minerals.`, stat_num: "83%", stat_label: `of ${s} homes have hard or contaminated water`, entries: [{ icon: "🧴", title: "Dry, Itchy Skin & Damaged Hair", desc: "Hard water strips moisture. Chlorine irritates. Your skin and hair feel the difference every single shower." }, { icon: "🤢", title: "Bad Taste & Smell", desc: "That metallic, chlorine, or sulfur taste isn't just unpleasant — it's a sign of what you're ingesting every day." }, { icon: "🫀", title: "Long-Term Health Exposure", desc: "PFAS and heavy metals accumulate in the body over time. Kids are especially vulnerable to everyday tap water exposure." }, { icon: "🔧", title: "Scale Buildup & Appliance Damage", desc: "Hard water destroys water heaters, dishwashers, and pipes. Softened water pays for itself in appliance lifespan." }] },
    solution: { headline: "One System. Every Tap. Installed Today.", subhead: `${b} customizes a whole-home filtration system specific to your ${c} water profile — installed start to finish in one day.`, benefits: [{ title: "Whole-home purification at every tap", sub: "Kitchen, bathrooms, showers, laundry — all covered" }, { title: "PFAS, chlorine & heavy metal removal", sub: `Certified to eliminate the contaminants in ${s} water` }, { title: "Softer skin, better hair from day one", sub: "Customers notice the difference after the first shower" }, { title: "No-middleman installation by local experts", sub: "Our team handles everything — no subcontractors" }, { title: "Lifetime parts warranty included", sub: "We stand behind every system we install" }] },
    offer: { headline: "Get Your Free Water Test This Week", subhead: "No sales pressure. Just answers about what's in your water — and what it'll cost to fix it.", pills: ["$0 Down — Finance from $45/Month", "Installed in 1 Day", "Lifetime Parts Warranty", "Free Kitchen Filter ($997 Value)"], cta_text: "Check My Zip — Get Free Water Test", guarantee: "No obligation. Free test. Zero pressure." },
    steps: { headline: "Up and Running in 3 Simple Steps", entries: [{ title: "Check Your Zip", desc: "Enter your zip code to confirm we service your area. Takes 60 seconds." }, { title: "Free In-Home Water Test", desc: "A local expert visits, tests your water, and recommends the right system for your home." }, { title: "Same-Day Installation", desc: "We install your custom system in one day. You wake up tomorrow with clean water at every tap." }] },
    reviews: { headline: `What ${c} Homeowners Are Saying`, entries: [{ text: `We had our water tested and were shocked at what was in it. ${b} came out the next day and had everything installed by noon. Amazing service!`, author: "Sarah M.", date: "3 days ago" }, { text: "Our water tastes completely different now. No more buying bottled water. The whole process took about 5 hours and the technicians were so professional.", author: "James R.", date: "1 week ago" }, { text: "My skin and hair feel so much better after just a week. Wish I had done this years ago. The $0 down financing made it a no-brainer.", author: "Maria T.", date: "2 weeks ago" }, { text: "Fast, clean, professional. They showed me my water test results and explained everything clearly with zero pressure. Installed same day.", author: "David K.", date: "5 days ago" }, { text: `The free water test was eye-opening. I had no idea what was coming out of my tap. ${b} fixed it same day. Outstanding team.`, author: "Lisa P.", date: "1 month ago" }, { text: "Best home improvement investment I've made. My coffee tastes better, my appliances run cleaner, and the warranty gives me total peace of mind.", author: "Tom W.", date: "3 weeks ago" }] },
    faq: { headline: "Everything You're Wondering" },
    faqs: [{ question: "How much does it cost?", answer: "Systems are customized to your home, but we offer $0 down financing starting from $45/month. After your free water test, we'll give you an exact quote with no pressure to commit." }, { question: "How long does installation take?", answer: "One day. Our local technicians handle everything from start to finish — you don't need to do anything except let us in. Most installs are complete in 4–6 hours." }, { question: "Is there a warranty?", answer: "Yes — lifetime warranty on all parts. We stand behind every system we install. If anything fails, we fix it." }, { question: "What exactly does it remove?", answer: `Our systems are certified to reduce chlorine, PFAS, heavy metals, excess minerals, bacteria, and the contaminants most commonly found in ${s} tap water.` }, { question: "How is this different from a Brita or under-sink filter?", answer: "Brita and under-sink filters only treat drinking water at one point. Our whole-home systems treat every drop that enters your house — showers, laundry, cooking, everything." }, { question: "What if my water isn't that bad?", answer: "Most homeowners say that before the test. Once we show them the results, they're usually surprised. The test is free and there's zero obligation — at minimum you'll know exactly what's in your water." }],
    cta: { headline: "Ready for <em>Clean Water at Every Tap?</em>", subhead: "Check your zip code and we'll confirm availability in your area. Free, takes 60 seconds.", sticky_text: "Get Your FREE Water Test →" },
    assets: { logo_url: `/assets/images/logo.${form.logoExt || "png"}`, hero_image_url: "/assets/images/hero.png", problem_image_url: "/assets/images/install-1.webp", solution_image_url: "/assets/images/install-2.webp", step_1_image_url: "/assets/images/step-1.webp", step_2_image_url: "/assets/images/step-2.webp", step_3_image_url: "/assets/images/step-3.webp" },
    footer: { phone: form.phone || "YOUR_PHONE_NUMBER", disclaimer: "Discounts apply to complete water system product installed.", copyright_year: new Date().getFullYear().toString(), brand: b, privacy_url: "/privacy", terms_url: "/terms" },
  };
}

// deno-lint-ignore no-explicit-any
function buildScheduleConfig(form: any) {
  const c = form.city, s = form.state, sa = form.stateAbbr || form.state, b = form.brandName;
  return {
    meta: { title: `Book Your Free Water Test — ${b}`, description: "Pick a time for your free in-home water test. Takes 45 minutes. Zero pressure.", pixel_id: form.pixelId || "YOUR_META_PIXEL_ID", page_slug: "schedule", client_slug: form.slug },
    template: "calendar",
    page: { headline: "You're one step away from <em>clean water at every tap</em>", subhead: "Pick a time below and we'll send a local water expert to your home — free, no obligation.", slots_text: "Limited slots available this week", urgency_items: [{ icon: "✅", text: "Free in-home water test" }, { icon: "⏱", text: "45-minute appointment" }, { icon: "🚫", text: "No sales pressure" }] },
    calendar: { card_headline: "Choose Your Appointment Time", card_sub: "Select a date and time that works for you", embed_url: form.calendarEmbedUrl || "YOUR_GHL_BOOKING_WIDGET_URL", embed_id: "ghl-booking-widget", thank_you_url: `https://${form.domain || "yourdomain.com"}/thank-you` },
    expect: [{ icon: "🧪", title: "We test your water on-site", desc: "Takes about 10 minutes. We check for hardness, chlorine, PFAS, and more." }, { icon: "📋", title: "You see the results immediately", desc: "No waiting. We show you exactly what's in your water and what it means." }, { icon: "💧", title: "We recommend the right system", desc: "Based on your water profile and home. No one-size-fits-all upsells." }, { icon: "🏠", title: "Installed same day if you choose", desc: "Most systems go in within hours of your test appointment." }],
    reviews: [{ text: "Booked in 2 minutes, technician showed up on time, water test was thorough and explained in plain English. Zero pressure to buy anything.", author: "Rachel S.", location: `${c}, ${sa}` }, { text: "I was skeptical but the free test convinced me. They showed me what was in my water and I was shocked. Best decision for my family.", author: "Mike D.", location: `${c}, ${sa}` }, { text: "Appointment was easy to book, the tech was super knowledgeable, and we had our system installed the same afternoon. Highly recommend.", author: "Karen B.", location: `${c}, ${sa}` }],
    assets: { logo_url: `/assets/images/logo.${form.logoExt || "png"}` },
    footer: { phone: form.phone || "YOUR_PHONE_NUMBER", disclaimer: "Discounts apply to complete water system product installed.", copyright_year: new Date().getFullYear().toString(), brand: b, privacy_url: "/privacy", terms_url: "/terms" },
  };
}

// deno-lint-ignore no-explicit-any
function buildPageConfig(form: any, page: { type: string; slug: string }, aiOverrides?: Record<string, unknown>) {
  let base;
  if (page.type === "schedule") {
    base = buildScheduleConfig(form);
  } else {
    base = buildLandingConfig(form, page.slug, page.type === "landing-2" ? 2 : 1);
  }
  if (aiOverrides) return deepMerge(base, aiOverrides);
  return base;
}

// deno-lint-ignore no-explicit-any
function generateVercelConfig(pages: { type: string; slug: string }[]): any {
  const rewrites = pages.map(p => ({
    source: `/${p.slug}`,
    destination: `/${p.slug}/index.html`,
  }));
  rewrites.push({ source: "/", destination: `/${pages[0]?.slug || "index"}/index.html` });
  return { rewrites };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formData, aiCopy } = await req.json();
    const { slug, pages, logoBase64, logoExt, clientName } = formData;

    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const githubOwner = Deno.env.get("GITHUB_OWNER");
    const githubRepo = Deno.env.get("GITHUB_REPO");
    if (!githubToken || !githubOwner || !githubRepo) {
      throw new Error("GitHub credentials not configured (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO)");
    }

    const files: { path: string; content: string; encoding?: "utf-8" | "base64" }[] = [];

    // Render each page
    for (const page of pages) {
      const overrides = aiCopy?.[page.slug];
      const config = buildPageConfig(formData, page, overrides);
      const html = renderPage(page.type, config);
      files.push({ path: `dist/${slug}/${page.slug}/index.html`, content: html });
    }

    // vercel.json
    files.push({ path: `dist/${slug}/vercel.json`, content: JSON.stringify(generateVercelConfig(pages), null, 2) });

    // Logo
    if (logoBase64 && logoExt) {
      files.push({ path: `dist/${slug}/assets/images/logo.${logoExt}`, content: logoBase64, encoding: "base64" });
    }

    // GitHub commit via Octokit
    const octokit = new Octokit({ auth: githubToken });

    const { data: refData } = await octokit.git.getRef({ owner: githubOwner, repo: githubRepo, ref: "heads/main" });
    const baseSha = refData.object.sha;
    const { data: baseCommit } = await octokit.git.getCommit({ owner: githubOwner, repo: githubRepo, commit_sha: baseSha });
    const baseTreeSha = baseCommit.tree.sha;

    const blobs = await Promise.all(files.map(f =>
      octokit.git.createBlob({ owner: githubOwner, repo: githubRepo, content: f.content, encoding: f.encoding === "base64" ? "base64" : "utf-8" })
    ));

    const tree = files.map((f, i) => ({ path: f.path, mode: "100644" as const, type: "blob" as const, sha: blobs[i].data.sha }));

    const { data: newTree } = await octokit.git.createTree({ owner: githubOwner, repo: githubRepo, tree, base_tree: baseTreeSha });
    const { data: newCommit } = await octokit.git.createCommit({ owner: githubOwner, repo: githubRepo, message: `feat: add funnel for ${clientName} (slug: ${slug})`, tree: newTree.sha, parents: [baseSha] });
    await octokit.git.updateRef({ owner: githubOwner, repo: githubRepo, ref: "heads/main", sha: newCommit.sha });

    // Save client metadata to Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("funnel_clients").upsert({
      slug,
      name: clientName,
      domain: formData.domain || "",
      tecrm_id: formData.tecrmId || "",
      created: new Date().toISOString().split("T")[0],
      pages: pages.map((p: { type: string; slug: string }) => ({ type: p.type, slug: p.slug, url: "" })),
    }, { onConflict: "slug" });

    return new Response(JSON.stringify({ success: true, commitSha: newCommit.sha, fileCount: files.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("funnel-generate error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
