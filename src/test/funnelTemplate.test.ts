import { describe, expect, it } from "vitest";
import { classifyTemplate, pageSections } from "../../supabase/functions/_shared/funnelTemplate";

const html = (...classes: string[]) => classes.map((c) => `<section class="${c}">x</section>`).join("\n");

describe("pageSections", () => {
  it("names each section by its first class, without the -section suffix", () => {
    expect(pageSections(html("hero", "benefits-section", "reviews-section", "cta-section"))).toEqual(["hero", "benefits", "reviews", "cta"]);
    expect(pageSections(html("hero", "section section-white", "section"))).toEqual(["hero", "section", "section"]);
    expect(pageSections('<section id="faq">')).toEqual(["faq"]);
  });

  it("reads no sections off a split-test router", () => {
    expect(pageSections("<script>location.replace('/okc-1-a')</script>")).toEqual([]);
  });
});

describe("classifyTemplate", () => {
  it("tags the short control page, however its blocks are named", () => {
    expect(classifyTemplate(["hero", "benefits", "reviews", "cta"])).toBe("short");
    expect(classifyTemplate(["hero", "section", "section", "section"])).toBe("short"); // Culligan, True H2O
    expect(classifyTemplate(["hero", "benefits", "cta"])).toBe("short"); // True Water, reviews stripped
  });

  it("tags long-form pages, including a shorter cut", () => {
    expect(classifyTemplate(["hero", "agitation", "villain", "cost", "mechanism", "before-after", "benefits", "reviews", "cta"])).toBe("long_form");
    expect(classifyTemplate(["hero", "agitation", "villain", "mechanism", "benefits", "reviews", "cta"])).toBe("long_form"); // utah-2
  });

  it("tags the SSW long-form v1", () => {
    expect(classifyTemplate(["hero", "problem", "solution", "offer", "steps", "reviews", "faq", "final-cta"])).toBe("long_form_v1");
  });

  it("leaves routers, booking pages and unknown skeletons untagged", () => {
    expect(classifyTemplate([])).toBeNull();
    expect(classifyTemplate(["calendar"])).toBeNull();
    expect(classifyTemplate(["hero", "a", "b", "c", "d", "e"])).toBeNull();
  });
});
