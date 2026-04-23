import { describe, expect, it } from "vitest";
import { MissingSeedError, createMissingSeedError, isMissingSeedError } from "@/lib/seed-health";

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
});
