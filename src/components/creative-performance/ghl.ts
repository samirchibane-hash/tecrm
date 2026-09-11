// GHL leads per creative. n8n writes each contact's utm_content (= Meta's
// {{ad.name}}) into ghl_conversions."Ad Name", so CRM leads can be matched to
// ads by name. Coverage is partial (organic, calls and old contacts carry no ad
// name), so every surface that shows these numbers also shows the coverage.

export interface GhlConversionLite {
  type: string | null;
  created_on: string;
  "Ad Name": string | null;
}

export interface GhlMatch {
  byName: Map<string, { leads: number; appts: number }>;
  total: number;       // GHL leads in the period
  withAdName: number;  // of those, carrying an ad name
}

// Same classification as the KPI tiles: a water test is both a lead and an appointment.
const isLead = (t: string) => t === "lead" || t === "water test";
const isAppt = (t: string) => t === "appointment" || t === "water test";

export const adNameKey = (name: string) => name.trim().toLowerCase();

/** `since` / `until` are inclusive YYYY-MM-DD; omit both for all time. */
export function matchGhlByAdName(rows: GhlConversionLite[], since?: string, until?: string): GhlMatch {
  const byName = new Map<string, { leads: number; appts: number }>();
  let total = 0;
  let withAdName = 0;
  for (const r of rows) {
    if (since && r.created_on < since) continue;
    if (until && r.created_on > until) continue;
    const type = r.type?.toLowerCase() ?? "";
    const lead = isLead(type);
    const appt = isAppt(type);
    if (lead) total += 1;
    const name = r["Ad Name"]?.trim();
    if (!name) continue;
    if (lead) withAdName += 1;
    const k = adNameKey(name);
    const cur = byName.get(k) ?? { leads: 0, appts: 0 };
    if (lead) cur.leads += 1;
    if (appt) cur.appts += 1;
    byName.set(k, cur);
  }
  return { byName, total, withAdName };
}
