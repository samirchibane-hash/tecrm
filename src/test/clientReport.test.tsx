import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MIN_DATE, formatRange, reportPresets } from "@/components/report/reportConfig";
import { buildTimeline, chartAnnotations, timelineInRange, type CampaignUpdate, type Creative, type CreativeRequest } from "@/components/report/timeline";
import { CostVsTarget } from "@/components/dashboard/CostVsTarget";

const update = (id: string, created_at: string, category: CampaignUpdate["category"] = "budget_change"): CampaignUpdate => ({
  id,
  created_at,
  category,
  account_id: null,
  account_name: "Client A",
  campaign_name: "Spring",
  details: "Raised budget",
  emailed_at: null,
  image_url: null,
  link_url: null,
  status: "done",
  title: null,
});

const creative = (id: string, batch_name: string, created_at: string, launch_date: string | null = null): Creative => ({
  id,
  batch_name,
  created_at,
  launch_date,
  account_id: null,
  account_name: "Client A",
  ad_angle: null,
  file_name: `${id}.png`,
  file_type: "image",
  file_url: `https://example.com/${id}.png`,
  notes: null,
  offer_type: null,
  status: "live",
  video_part: null,
});

const request = (id: string, updated_at: string): CreativeRequest => ({
  id,
  updated_at,
  created_at: updated_at,
  account_name: "Client A",
  ad_angle: "Health",
  ad_type: "image_ads",
  assigned_to: null,
  created_by: null,
  gdrive_folder_url: null,
  is_template: false,
  notes: null,
  offer_type: "Free water test",
  status: "launched",
  template_name: "Kitchen UGC",
});

describe("formatRange", () => {
  it("collapses a range inside one month", () => {
    expect(formatRange({ from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) })).toBe("Sep 1 – 30, 2026");
  });
  it("names both months when the range crosses one", () => {
    expect(formatRange({ from: new Date(2026, 7, 28), to: new Date(2026, 8, 3) })).toBe("Aug 28 – Sep 3, 2026");
  });
  it("names both years when the range crosses one", () => {
    expect(formatRange({ from: new Date(2025, 11, 30), to: new Date(2026, 0, 2) })).toBe("Dec 30, 2025 – Jan 2, 2026");
  });
  it("reads a missing range as all time, never as a date", () => {
    expect(formatRange(undefined)).toBe("All time");
  });
});

describe("reportPresets", () => {
  it("never starts a period before GHL data exists", () => {
    for (const p of reportPresets(new Date(2026, 1, 15))) {
      expect(+p.range.from!).toBeGreaterThanOrEqual(+MIN_DATE);
    }
  });
  it("drops presets that end before GHL data exists", () => {
    const values = reportPresets(new Date(2026, 1, 15)).map((p) => p.value);
    expect(values).not.toContain("last-month");
  });
  it("offers every preset once data covers them", () => {
    expect(reportPresets(new Date(2026, 9, 3)).map((p) => p.value)).toEqual(["7d", "14d", "30d", "mtd", "last-month"]);
  });
});

describe("report timeline", () => {
  const items = buildTimeline(
    [update("u1", "2026-09-10T15:00:00Z"), update("u2", "2026-09-02T15:00:00Z")],
    [creative("c1", "Batch A", "2026-09-01T10:00:00Z", "2026-09-05"), creative("c2", "Batch A", "2026-09-03T10:00:00Z")],
    [request("r1", "2026-09-20T12:00:00Z")],
  );

  it("groups creatives into one entry per batch, dated by launch", () => {
    const batches = items.filter((i) => i.type === "creative-batch");
    expect(batches).toHaveLength(1);
    expect(batches[0].date).toBe("2026-09-05");
  });

  it("orders entries newest first", () => {
    expect(items.map((i) => i.date)).toEqual([...items.map((i) => i.date)].sort().reverse());
  });

  it("keeps only entries inside the reporting period", () => {
    const inRange = timelineInRange(items, { from: new Date(2026, 8, 4), to: new Date(2026, 8, 12) });
    expect(inRange.map((i) => (i.type === "update" ? i.data.id : i.type))).toEqual(["u1", "creative-batch"]);
  });

  it("groups chart markers by day", () => {
    const sameDay = buildTimeline([update("a", "2026-09-10T12:00:00Z"), update("b", "2026-09-10T13:00:00Z")], [], []);
    const marks = chartAnnotations(sameDay);
    expect(marks).toHaveLength(1);
    expect(marks[0].updates).toHaveLength(2);
  });
});

describe("CostVsTarget", () => {
  it("states the judgement in words, not color alone", () => {
    render(<CostVsTarget value={62} target={45} status="danger" />);
    expect(screen.getByText("$62")).toBeInTheDocument();
    expect(screen.getByText(/more than 25% over target/)).toBeInTheDocument();
  });

  it("makes no judgement without a target", () => {
    render(<CostVsTarget value={34} target={null} status={null} />);
    expect(screen.queryByText(/target/)).not.toBeInTheDocument();
  });
});

describe("formatPhone", () => {
  it("formats US numbers stored as integers", async () => {
    const { formatPhone } = await import("@/lib/format");
    expect(formatPhone(6025550143)).toBe("(602) 555-0143");
    expect(formatPhone(16025550143)).toBe("(602) 555-0143");
  });
  it("leaves anything else as stored", async () => {
    const { formatPhone } = await import("@/lib/format");
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhone(null)).toBe("");
  });
});
