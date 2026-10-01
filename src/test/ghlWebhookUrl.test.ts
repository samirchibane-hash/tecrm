import { describe, expect, it } from "vitest";
import { webhookUrlToStore } from "@/components/funnel-pages/ghlWebhookUrl";

const SAMPLE = "https://services.leadconnectorhq.com/hooks/GJvA4example/webhook-trigger/abc123";

describe("webhookUrlToStore", () => {
  it("stores a trimmed https webhook and leaves the token unchanged", () => {
    expect(webhookUrlToStore(`  ${SAMPLE}  `)).toBe(SAMPLE);
  });

  it("clears the column when the field is blank", () => {
    expect(webhookUrlToStore("")).toBeNull();
    expect(webhookUrlToStore("   ")).toBeNull();
  });

  it("rejects a non-https or unparseable value", () => {
    expect(() => webhookUrlToStore("http://services.leadconnectorhq.com/hooks/x")).toThrow(/https:\/\//);
    expect(() => webhookUrlToStore("not a url")).toThrow(/https/);
  });
});
