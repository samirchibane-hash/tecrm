import { format, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { Tables } from "@/integrations/supabase/types";
import { CREATIVE_STATUS } from "./reportConfig";

export type CampaignUpdate = Tables<"campaign_updates">;
export type Creative = Tables<"creatives">;
export type CreativeRequest = Tables<"creative_requests">;

/** One entry in the report's change log, newest first. */
export type TimelineItem =
  | { type: "update"; date: string; data: CampaignUpdate }
  | { type: "creative-batch"; date: string; batchName: string; items: Creative[] }
  | { type: "creative-request"; date: string; data: CreativeRequest };

export type ChartAnnotation = {
  date: string;
  updates: { category: string; campaign_name: string; details: string | null }[];
};

export function buildTimeline(
  updates: CampaignUpdate[],
  creatives: Creative[],
  requests: CreativeRequest[],
): TimelineItem[] {
  const items: TimelineItem[] = updates.map((u) => ({ type: "update", date: u.created_at, data: u }));

  const batches = new Map<string, Creative[]>();
  for (const c of creatives) {
    const key = c.batch_name || "Ungrouped";
    batches.set(key, [...(batches.get(key) ?? []), c]);
  }
  for (const [batchName, batchItems] of batches) {
    const launchDate = batchItems.find((c) => c.launch_date)?.launch_date;
    const latest = batchItems.reduce((acc, c) => (c.created_at > acc ? c.created_at : acc), batchItems[0].created_at);
    items.push({ type: "creative-batch", date: launchDate ?? latest, batchName, items: batchItems });
  }

  for (const req of requests) items.push({ type: "creative-request", date: req.updated_at ?? req.created_at, data: req });

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export function timelineInRange(items: TimelineItem[], range: DateRange | undefined): TimelineItem[] {
  if (!range?.from) return items;
  const from = startOfDay(range.from);
  const to = range.to ? startOfDay(range.to) : from;
  return items.filter((item) => {
    const d = startOfDay(new Date(item.date));
    return d >= from && d <= to;
  });
}

/** Change-log entries grouped by day, for markers on the KPI chart. */
export function chartAnnotations(items: TimelineItem[]): ChartAnnotation[] {
  const grouped = new Map<string, ChartAnnotation["updates"]>();
  for (const item of items) {
    const date = format(new Date(item.date), "yyyy-MM-dd");
    const day = grouped.get(date) ?? [];
    if (item.type === "update") {
      day.push({ category: item.data.category, campaign_name: item.data.campaign_name, details: item.data.details });
    } else if (item.type === "creative-batch") {
      const n = item.items.length;
      day.push({ category: "creative_swap", campaign_name: item.batchName, details: `${n} asset${n !== 1 ? "s" : ""}` });
    } else {
      const status = CREATIVE_STATUS[item.data.status]?.label ?? item.data.status;
      day.push({
        category: "creative_swap",
        campaign_name: item.data.template_name,
        details: `${item.data.ad_angle} · ${item.data.offer_type} — ${status}`,
      });
    }
    grouped.set(date, day);
  }
  return [...grouped].map(([date, updates]) => ({ date, updates }));
}
