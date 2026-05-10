import { describe, expect, it } from "vitest";
import {
  betaFeatureFlagDefinitions,
  betaFeaturesStorageKeyForUser,
  defaultBetaFeaturesPreference,
  isBetaFeatureFlagActive,
  loadBetaFeaturesPreference,
  revampBetaFeatureAliases,
  saveBetaFeaturesPreference,
  sanitizeBetaFeaturesPreference,
} from "@/lib/beta-features";
import { revampBetaQaIssueMap, roleVerificationQaIssues } from "@/lib/revamp-beta-qa-map";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    snapshot: () => Object.fromEntries(values),
  };
}

describe("beta feature preference gates", () => {
  it("defines Revamp Beta as the single user-facing QA cleanup beta flag", () => {
    expect(betaFeatureFlagDefinitions.map((flag) => flag.key)).toEqual([
      "revampBeta",
    ]);

    const [flag] = betaFeatureFlagDefinitions;
    expect(flag.label).toBe("Revamp Beta");
    expect(flag.dataAttribute).toBe("data-revamp-beta");
    expect(flag.description).toContain("BinderNotes QA revamp");
    expect(flag.searchAliases).toEqual(
      expect.arrayContaining(["split study", "study panels", "whiteboard", "settings search", "desmos"]),
    );
    expect(defaultBetaFeaturesPreference.revampBeta).toBe(false);
  });

  it("sanitizes and persists Revamp Beta while mapping old internal gates to the one switch", () => {
    const storage = createStorage();
    const preference = sanitizeBetaFeaturesPreference({
      enabled: true,
      revampBeta: true,
      compactStudyChrome: true,
      studyPanelsV2: true,
      compactWhiteboardTools: false,
      canvasStarterLayouts: true,
      mathPerformanceLazyLoading: true,
      recallLab: true,
      studentCalmMode: true,
      studentPreviewAdminChromeGuard: true,
      unknownFlag: true,
    });

    saveBetaFeaturesPreference("user-1", preference, storage);
    const loaded = loadBetaFeaturesPreference("user-1", storage);

    expect(loaded.enabled).toBe(true);
    expect(loaded.revampBeta).toBe(true);
    expect(isBetaFeatureFlagActive(loaded, "revampBeta")).toBe(true);
    for (const alias of revampBetaFeatureAliases) {
      expect(isBetaFeatureFlagActive(loaded, alias)).toBe(true);
    }
    expect(sanitizeBetaFeaturesPreference({ enabled: true })).toEqual({
      enabled: true,
      revampBeta: true,
    });
    expect(storage.snapshot()[betaFeaturesStorageKeyForUser("user-1")]).not.toContain("unknownFlag");
    expect(storage.snapshot()[betaFeaturesStorageKeyForUser("user-1")]).not.toContain("compactStudyChrome");
  });

  it("keeps the QA report issue IDs mapped to Revamp Beta implementation areas", () => {
    expect(roleVerificationQaIssues).toEqual(["BN-QA-001", "BN-QA-002"]);
    expect([...roleVerificationQaIssues, ...Object.keys(revampBetaQaIssueMap)]).toEqual(
      Array.from({ length: 20 }, (_, index) => `BN-QA-${String(index + 1).padStart(3, "0")}`),
    );
    expect(Object.keys(revampBetaQaIssueMap)).toEqual([
      "BN-QA-003",
      "BN-QA-004",
      "BN-QA-005",
      "BN-QA-006",
      "BN-QA-007",
      "BN-QA-008",
      "BN-QA-009",
      "BN-QA-010",
      "BN-QA-011",
      "BN-QA-012",
      "BN-QA-013",
      "BN-QA-014",
      "BN-QA-015",
      "BN-QA-016",
      "BN-QA-017",
      "BN-QA-018",
      "BN-QA-019",
      "BN-QA-020",
    ]);
    expect(revampBetaQaIssueMap["BN-QA-003"].area).toBe("Split Study");
    expect(revampBetaQaIssueMap["BN-QA-020"].gate).toBe("Revamp Beta");
  });
});
