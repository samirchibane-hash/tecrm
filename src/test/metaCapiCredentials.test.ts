import { describe, expect, it } from "vitest";
import { metaCredentialToStore } from "@/components/funnel-pages/metaCapiCredentials";

describe("metaCredentialToStore", () => {
  it("stores a trimmed value and leaves the rest unchanged", () => {
    expect(metaCredentialToStore("  1234567890  ")).toBe("1234567890");
    expect(metaCredentialToStore("  EAAB.token/with+chars  ")).toBe("EAAB.token/with+chars");
  });

  it("clears the column when the field is blank", () => {
    expect(metaCredentialToStore("")).toBeNull();
    expect(metaCredentialToStore("   ")).toBeNull();
  });
});
