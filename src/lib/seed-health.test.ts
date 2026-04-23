import { describe, expect, it } from "vitest";
import { MissingSeedError, createLegacySeedHealth, createMissingSeedError, isMissingSeedError } from "@/lib/seed-health";
import { systemSuiteTemplates } from "@/lib/history-suite-seeds";

describe("seed health", () => {
  it("returns a structured MissingSeedError for system binders", () => {
    const error = createMissingSeedError("binder-french-revolution-history-suite");

    expect(error).toBeInstanceOf(MissingSeedError);
    expect(isMissingSeedError(error)).toBe(true);
    if (isMissingSeedError(error)) {
      expect(error.suiteTemplateId).toBe("suite-history-demo");
      expect(error.seedHealth.status).toBe("missing");
      expect(error.seedHealth.missingBinders).toContain("binder-french-revolution-history-suite");
    }
  });

  it("can mark legacy published system content as healthy without a suite row", () => {
    const health = createLegacySeedHealth(systemSuiteTemplates[0]);

    expect(health).toMatchObject({
      suiteTemplateId: "suite-algebra-foundations",
      status: "healthy",
      actualVersion: "2026.04.22-history-suite-foundation",
    });
  });
});
