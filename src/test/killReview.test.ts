import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KILL_REVIEW_FIXTURE } from "@/lib/killReview/fixtureData";
import { loadKillReviews } from "@/lib/killReview/load";
import {
  adsManagerAdUrl,
  copyReply,
  inKillReviewScope,
  killReviewTotals,
  rulesHit,
  rulesHitForRow,
  sortKillReviews,
} from "@/lib/killReview/rules";
import { KILL_REVIEW_COLUMNS, type CreativeKillReviewRow } from "@/lib/killReview/types";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261026150000_creative_kill_reviews.sql"),
  "utf8",
);

describe("kill review rules", () => {
  it("matches analyze.py on the boundaries", () => {
    const base = {
      sinceLeadSpend: 0,
      curLeads: 0,
      curCpl: null as number | null,
      sinceApptSpend: 0,
      curSpend: 0,
      curCplc: 1,
    };
    expect(rulesHit({ ...base, sinceLeadSpend: 200 })).toEqual(["a"]);
    expect(rulesHit({ ...base, sinceLeadSpend: 199.99 })).toEqual([]);
    expect(rulesHit({ ...base, curLeads: 1, curCpl: 100.01 })).toEqual(["b"]);
    expect(rulesHit({ ...base, curLeads: 1, curCpl: 100 })).toEqual([]);
    expect(rulesHit({ ...base, curLeads: 0, curCpl: 150 })).toEqual([]);
    expect(rulesHit({ ...base, sinceApptSpend: 400.01 })).toEqual(["c"]);
    expect(rulesHit({ ...base, sinceApptSpend: 400 })).toEqual([]);
    expect(rulesHit({ ...base, curSpend: 50, curCplc: 5.01 })).toEqual(["d"]);
    expect(rulesHit({ ...base, curSpend: 50, curCplc: 5 })).toEqual([]);
    expect(rulesHit({ ...base, curSpend: 50, curCplc: null })).toEqual(["d"]);
    expect(rulesHit({ ...base, curSpend: 49.99, curCplc: 9 })).toEqual([]);
  });

  it("reproduces every bundled flag", () => {
    for (const row of KILL_REVIEW_FIXTURE) {
      expect(rulesHitForRow(row)).toEqual(row.rules_hit);
    }
  });
});

describe("kill review fixture", () => {
  const oct26 = KILL_REVIEW_FIXTURE.filter((row) => row.run_date === "2026-10-26");
  const oct22 = KILL_REVIEW_FIXTURE.filter((row) => row.run_date === "2026-10-22");

  it("uses the published row shape, and the migration names those columns", () => {
    expect(Object.keys(KILL_REVIEW_FIXTURE[0]).sort()).toEqual([...KILL_REVIEW_COLUMNS].sort());
    for (const column of [...KILL_REVIEW_COLUMNS, "id", "created_at"]) {
      expect(migration).toMatch(new RegExp(`^\\s+${column}\\s`, "m"));
    }
    expect(migration).toContain("creative-kill-thumbs");
    expect(migration).toContain("public.is_admin()");
    expect(migration).toMatch(/revoke all on public\.creative_kill_reviews from anon/i);
    expect(migration).toContain("creative_kill_reviews_guard");
    expect(migration).toContain("fb_ad_account_id");
    expect(migration).toContain("1170300274125472");
  });

  it("leaves campaign, business, and all-clicks CPC empty on these two runs", () => {
    expect(KILL_REVIEW_FIXTURE.every((row) => row.campaign_id == null && row.business_id == null && row.cpc == null)).toBe(true);
  });

  it("keeps Oct 26 verdicts and leaves Oct 22 uncalled", () => {
    expect(oct26).toHaveLength(17);
    expect(oct26.map((row) => row.n)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(oct26.every((row) => row.verdict != null && row.reason && row.reviewer === "Yan")).toBe(true);
    expect(oct26.filter((row) => row.verdict === "turn_off")).toHaveLength(8);

    expect(oct22).toHaveLength(16);
    expect(oct22.every((row) => row.verdict == null && row.reason == null && row.reviewer == null)).toBe(true);
    expect(oct22.every((row) => row.only_live_in_adset == null)).toBe(true);
    expect(oct22.every((row) => row.rules_hit.length > 0)).toBe(true);
  });

  it("points every row at a bundled thumbnail", () => {
    for (const row of KILL_REVIEW_FIXTURE) {
      expect(row.lead_source).toBe("website");
      expect(row.thumbnail_url).toMatch(/^\/kill-review\/2026-10-\d\d\/\d+_[\d]+\.(jpg|png)$/);
      const file = path.join(process.cwd(), "public", row.thumbnail_url!.slice(1));
      expect(existsSync(file)).toBe(true);
    }
  });

  it("sums the Oct 26 headline from current-window spend", () => {
    const totals = killReviewTotals(oct26);
    expect(totals.flagged).toBe(17);
    expect(totals.spendAtRisk).toBeCloseTo(3940.39, 2);
    expect(totals.turnOffSpend).toBeCloseTo(1785.32, 2);
    expect(totals.turnOffCount).toBe(8);
    expect(killReviewTotals(oct22).turnOffSpend).toBeNull();
  });
});

describe("kill review scope and reply", () => {
  const sample = KILL_REVIEW_FIXTURE[0];

  function withPatch(patch: Partial<CreativeKillReviewRow>): CreativeKillReviewRow {
    return { ...sample, ...patch };
  }

  it("drops the internal account, True H2O, ClearDeals, and instant forms", () => {
    expect(inKillReviewScope(sample)).toBe(true);
    expect(inKillReviewScope(withPatch({ act: "act_1170300274125472" }))).toBe(false);
    expect(inKillReviewScope(withPatch({ act: "1170300274125472" }))).toBe(false);
    expect(inKillReviewScope(withPatch({ account_id: "act_1170300274125472" }))).toBe(false);
    expect(inKillReviewScope(withPatch({ account_id: " 1170300274125472 " }))).toBe(false);
    expect(inKillReviewScope(withPatch({ client_name: "True H2O" }))).toBe(false);
    expect(inKillReviewScope(withPatch({ campaign_name: "ClearDeals - water" }))).toBe(false);
    expect(inKillReviewScope(withPatch({ campaign_name: "Internal prospecting" }))).toBe(false);
    expect(inKillReviewScope(withPatch({ lead_source: "form" as "website" }))).toBe(false);
  });

  it("hides an account by name or by its Meta act", () => {
    const rows = loadKillReviews({
      runDate: "2026-10-26",
      hiddenAccounts: ["Culligan Rochester"],
      accounts: [],
    });
    expect(rows.some((row) => row.client_name === "Culligan Rochester")).toBe(false);
    expect(rows.length).toBeLessThan(17);

    const linked = loadKillReviews({
      runDate: "2026-10-26",
      hiddenAccounts: [],
      accounts: [{ id: "acct-1", account_name: "Culligan Rochester", fb_ad_account_id: "act_1417432623684500" }],
    });
    expect(linked.find((row) => row.n === 1)?.account_id).toBe("acct-1");

    const hiddenByAct = loadKillReviews({
      runDate: "2026-10-26",
      hiddenAccounts: ["Culligan Rochester"],
      accounts: [{ id: "acct-1", account_name: "Culligan Rochester", fb_ad_account_id: sample.act }],
    });
    expect(hiddenByAct.some((row) => row.act === sample.act)).toBe(false);
  });

  it("prefers account_id for the account and the hidden list", () => {
    const visible = loadKillReviews({
      runDate: sample.run_date,
      hiddenAccounts: ["Culligan Rochester"],
      accounts: [{ id: "uuid-visible", account_name: "Kinetico UT", fb_ad_account_id: "act_999" }],
      rows: [{
        ...sample,
        account_id: "uuid-visible",
        client_name: "Culligan Rochester",
        campaign_id: "1200001",
        campaign_name: "Website leads",
        business_id: "555",
        cpc: 0.9,
      }],
    });
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({
      account_id: "uuid-visible",
      campaign_id: "1200001",
      campaign_name: "Website leads",
      business_id: "555",
      cpc: 0.9,
    });

    const hiddenById = loadKillReviews({
      runDate: sample.run_date,
      hiddenAccounts: ["Hidden Dealer"],
      accounts: [{ id: "uuid-hidden", account_name: "Hidden Dealer", fb_ad_account_id: "act_111" }],
      rows: [{ ...sample, account_id: "uuid-hidden", client_name: "Not Hidden Co" }],
    });
    expect(hiddenById).toEqual([]);

    const preferred = loadKillReviews({
      runDate: sample.run_date,
      hiddenAccounts: [],
      accounts: [
        { id: "by-id", account_name: "By Id", fb_ad_account_id: "act_1" },
        { id: "by-act", account_name: "By Act", fb_ad_account_id: sample.act },
      ],
      rows: [{ ...sample, account_id: "by-id" }],
    });
    expect(preferred[0]?.account_id).toBe("by-id");

    const unknown = loadKillReviews({
      runDate: sample.run_date,
      hiddenAccounts: [],
      accounts: [{ id: "by-act", account_name: "Culligan Rochester", fb_ad_account_id: sample.act }],
      rows: [{ ...sample, account_id: "published-uuid" }],
    });
    expect(unknown[0]?.account_id).toBe("published-uuid");
  });

  it("drops a client act when the linked account is the internal ad account", () => {
    const byId = loadKillReviews({
      runDate: sample.run_date,
      hiddenAccounts: [],
      accounts: [{ id: "te", account_name: "Treat Engine", fb_ad_account_id: "1170300274125472" }],
      rows: [{ ...sample, account_id: "te", client_name: "Treat Engine" }],
    });
    expect(byId).toEqual([]);

    const byName = loadKillReviews({
      runDate: sample.run_date,
      hiddenAccounts: [],
      accounts: [{ id: "te", account_name: "Treat Engine", fb_ad_account_id: "act_1170300274125472" }],
      rows: [{ ...sample, account_id: null, client_name: "Treat Engine" }],
    });
    expect(byName).toEqual([]);
  });

  it("keeps a supplied campaign and CPC, and leaves them empty when the row omits them", () => {
    const legacy: CreativeKillReviewRow = { ...sample };
    delete (legacy as Partial<CreativeKillReviewRow>).campaign_id;
    delete (legacy as Partial<CreativeKillReviewRow>).business_id;
    delete (legacy as Partial<CreativeKillReviewRow>).cpc;
    const [filled] = loadKillReviews({
      runDate: sample.run_date,
      hiddenAccounts: [],
      accounts: [],
      rows: [legacy],
    });
    expect(filled.campaign_id).toBeNull();
    expect(filled.business_id).toBeNull();
    expect(filled.cpc).toBeNull();

    const [blankBusiness] = loadKillReviews({
      runDate: sample.run_date,
      hiddenAccounts: [],
      accounts: [],
      rows: [{ ...sample, business_id: "  ", cpc: 0 }],
    });
    expect(blankBusiness.business_id).toBeNull();
    expect(blankBusiness.cpc).toBe(0);
  });

  it("builds the reply from the stable numbers", () => {
    expect(copyReply([6, 3, 4, 3])).toBe("turn off 3, 4, 6");
    expect(copyReply([])).toBe("");
  });

  it("strips the act_ prefix for Ads Manager and omits an unknown business", () => {
    const url = new URL(adsManagerAdUrl("act_1417432623684500", "52591514415503"));
    expect(url.searchParams.get("act")).toBe("1417432623684500");
    expect(url.searchParams.get("selected_ad_ids")).toBe("52591514415503");
    expect(url.searchParams.get("business_id")).toBeNull();
    expect(url.toString()).not.toContain("act_");

    expect(new URL(adsManagerAdUrl("act_1417432623684500", "52591514415503", null)).searchParams.get("business_id")).toBeNull();
    expect(new URL(adsManagerAdUrl("act_1417432623684500", "52591514415503", "  ")).searchParams.get("business_id")).toBeNull();
    expect(new URL(adsManagerAdUrl("act_1417432623684500", "52591514415503", "998877")).searchParams.get("business_id")).toBe("998877");
  });

  it("sorts a missing CPL after priced ads and keeps n stable", () => {
    const rows = sortKillReviews(
      [
        withPatch({ n: 2, cur_cpl: 10, cur_spend: 5 }),
        withPatch({ n: 1, cur_cpl: null, cur_spend: 90 }),
        withPatch({ n: 3, cur_cpl: 40, cur_spend: 5 }),
      ],
      "cpl",
    );
    expect(rows.map((row) => row.n)).toEqual([3, 2, 1]);
  });
});
