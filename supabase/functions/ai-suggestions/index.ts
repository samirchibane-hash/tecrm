import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountName, kpis, prevKpis, updates, dateLabel } = await req.json();

    const fmt = (v: number) => (v > 0 ? `$${v.toFixed(2)}` : "–");
    const delta = (curr: number, prev: number) => {
      if (!prev || prev <= 0 || curr < 0) return "";
      const pct = ((curr - prev) / prev) * 100;
      return ` (${pct > 0 ? "+" : ""}${pct.toFixed(0)}% vs prior period)`;
    };

    const recentUpdates = (updates ?? [])
      .slice(0, 10)
      .map((u: { date: string; title: string; details: string }) =>
        `  • [${u.date}] ${u.title}: ${u.details || "(no details)"}`
      )
      .join("\n");

    const soldLine =
      kpis.soldCount > 0
        ? `- Deals Sold: ${kpis.soldCount}, Revenue: $${(kpis.totalRevenue ?? 0).toLocaleString()}, ROAS: ${(kpis.adRoi ?? 0).toFixed(1)}x`
        : "";

    const prompt = `You are a performance marketing analyst for a Facebook Ads agency specializing in lead generation and appointment booking campaigns.

Analyze this ad account and provide 3–5 specific, actionable optimization suggestions.

Account: ${accountName}
Date Range: ${dateLabel}

Performance (current period):
- Total Spend: ${fmt(kpis.totalSpend)}${delta(kpis.totalSpend, prevKpis?.totalSpend)}
- GHL Leads: ${kpis.ghlLeads ?? 0}${delta(kpis.ghlLeads, prevKpis?.ghlLeads)} @ ${fmt(kpis.ghlCostPerLead)}/lead${delta(kpis.ghlCostPerLead, prevKpis?.ghlCostPerLead)} (target: $40)
- GHL Appointments: ${kpis.ghlAppointments ?? 0}${delta(kpis.ghlAppointments, prevKpis?.ghlAppointments)} @ ${fmt(kpis.ghlCostPerAppt)}/appt${delta(kpis.ghlCostPerAppt, prevKpis?.ghlCostPerAppt)} (target: $200)
- Avg CTR: ${(kpis.avgCTR ?? 0).toFixed(2)}%${delta(kpis.avgCTR, prevKpis?.avgCTR)}
- Avg CPC: ${fmt(kpis.avgCPC)}${delta(kpis.avgCPC, prevKpis?.avgCPC)}
- Avg CPM: ${fmt(kpis.avgCPM)}${delta(kpis.avgCPM, prevKpis?.avgCPM)}
- Clicks: ${(kpis.totalClicks ?? 0).toLocaleString()}${delta(kpis.totalClicks, prevKpis?.totalClicks)}
- Impressions: ${(kpis.totalImpressions ?? 0).toLocaleString()}${delta(kpis.totalImpressions, prevKpis?.totalImpressions)}
${soldLine}

Recent Change Log:
${recentUpdates || "  (no recent changes logged)"}

Respond with a JSON array only — no markdown, no extra text:
[{"priority":"high|medium|low","suggestion":"..."}]

Each suggestion must reference this account's actual numbers, explain why there is an issue or opportunity, and give one clear next action.`;

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`Anthropic API error ${aiRes.status}: ${await aiRes.text()}`);
    }

    const aiData = await aiRes.json();
    const text: string = aiData.content?.[0]?.text ?? "[]";

    // Extract the JSON array even if wrapped in markdown code fences
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("ai-suggestions error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
