import type { AdCopy, CreativeAd } from "@/components/creative-performance/useCreativePerformance";

/** A delivered, live website-lead image ad with every metric zeroed; override what the test cares about. */
export function makeAd(over: Omit<Partial<CreativeAd>, "copy"> & { id: string; copy?: Partial<AdCopy> }): CreativeAd {
  const { copy, ...rest } = over;
  return {
    name: over.id,
    status: "ACTIVE",
    live: true,
    createdTime: "2026-09-01T00:00:00Z",
    campaign: null,
    adset: null,
    adsetId: null,
    optimizationGoal: "OFFSITE_CONVERSIONS",
    format: "image",
    thumbnailUrl: null,
    adsManagerUrl: "",
    delivered: true,
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: null,
    linkClicks: 0,
    linkCtr: null,
    cpm: null,
    landingPageViews: 0,
    webLeads: 0,
    formLeads: 0,
    leadChannel: "website",
    videoPlays: null,
    thruplays: null,
    result: null,
    appointments: null,
    costPerAppointment: null,
    ...rest,
    copy: { headlines: [], bodies: [], descriptions: [], destinationUrls: [], cta: null, leadForm: false, ...copy },
  };
}
