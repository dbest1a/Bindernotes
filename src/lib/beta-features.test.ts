import { describe, expect, it } from "vitest";
import {
  betaFeatureFlagDefinitions,
  betaFeatureGroups,
  betaFeaturesStorageKeyForUser,
  defaultBetaFeaturesPreference,
  isAnyBetaRevampFeatureEnabled,
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

const betaRevampFlagKeys = [
  "betaRevampCalmStudyHomepage",
  "betaRevampSourceLinkedNotes",
  "betaRevampReviewQueue",
  "betaRevampMathStudyLoop",
  "betaRevampMobileStudyMode",
  "betaRevampCalmWorkspaceUi",
  "betaRevampNarrowAiStudyTools",
] as const;

describe("beta feature preference gates", () => {
  it("defines the Beta Revamp group with market-research-driven user-facing flags", () => {
    const betaRevampGroup = betaFeatureGroups.find((group) => group.label === "Beta Revamp");

    expect(betaRevampGroup).toEqual(
      expect.objectContaining({
        id: "betaRevamp",
        label: "Beta Revamp",
      }),
    );
    expect(betaRevampGroup?.flagKeys).toEqual(betaRevampFlagKeys);

    for (const key of betaRevampFlagKeys) {
      const flag = betaFeatureFlagDefinitions.find((candidate) => candidate.key === key);
      expect(flag?.groupId).toBe("betaRevamp");
      expect(flag?.label).toMatch(/^Beta Revamp — /);
      expect(flag?.description).toEqual(expect.any(String));
      expect(flag?.description.length).toBeGreaterThan(40);
      expect(flag?.searchAliases).toEqual(
        expect.arrayContaining(["beta", "revamp", "study loop"]),
      );
      expect(defaultBetaFeaturesPreference[key]).toBe(false);
    }

    expect(
      betaFeatureFlagDefinitions.find((flag) => flag.key === "betaRevampCalmStudyHomepage")
        ?.searchAliases,
    ).toEqual(expect.arrayContaining(["calm", "homepage", "landing"]));
    expect(
      betaFeatureFlagDefinitions.find((flag) => flag.key === "betaRevampSourceLinkedNotes")
        ?.searchAliases,
    ).toEqual(expect.arrayContaining(["notes", "source"]));
    expect(
      betaFeatureFlagDefinitions.find((flag) => flag.key === "betaRevampReviewQueue")
        ?.searchAliases,
    ).toEqual(expect.arrayContaining(["review"]));
    expect(
      betaFeatureFlagDefinitions.find((flag) => flag.key === "betaRevampMathStudyLoop")
        ?.searchAliases,
    ).toEqual(expect.arrayContaining(["math", "graph", "formula", "mistake"]));
    expect(
      betaFeatureFlagDefinitions.find((flag) => flag.key === "betaRevampMobileStudyMode")
        ?.searchAliases,
    ).toEqual(expect.arrayContaining(["mobile"]));
    expect(
      betaFeatureFlagDefinitions.find((flag) => flag.key === "betaRevampNarrowAiStudyTools")
        ?.searchAliases,
    ).toEqual(expect.arrayContaining(["AI"]));
  });

  it("defines Revamp Beta, Canvas Rework, and movement beta flags as user-facing beta flags", () => {
    expect(betaFeatureFlagDefinitions.map((flag) => flag.key)).toEqual([
      "revampBeta",
      "canvasRework",
      "desmosV2",
      "whiteboardSmoothMove",
      "compactExcalidrawTools",
      "whiteboardPerformanceDiagnostics",
      ...betaRevampFlagKeys,
    ]);

    const revampFlag = betaFeatureFlagDefinitions.find((flag) => flag.key === "revampBeta");
    expect(revampFlag?.label).toBe("Revamp Beta");
    expect(revampFlag?.dataAttribute).toBe("data-revamp-beta");
    expect(revampFlag?.description).toContain("BinderNotes QA revamp");
    expect(revampFlag?.searchAliases).toEqual(
      expect.arrayContaining(["split study", "study panels", "whiteboard", "settings search", "desmos"]),
    );

    const canvasFlag = betaFeatureFlagDefinitions.find((flag) => flag.key === "canvasRework");
    expect(canvasFlag?.label).toBe("Canvas Rework");
    expect(canvasFlag?.dataAttribute).toBe("data-beta-canvas-rework");
    expect(canvasFlag?.description).toContain("redesigned Canvas workspace");
    expect(canvasFlag?.searchAliases).toEqual(
      expect.arrayContaining([
        "canvas",
        "rework",
        "freeform",
        "workspace",
        "layout",
        "snap",
        "modules",
        "builder",
        "edit",
        "beta",
      ]),
    );
    expect(defaultBetaFeaturesPreference.revampBeta).toBe(false);
    expect(defaultBetaFeaturesPreference.canvasRework).toBe(false);

    const desmosV2Flag = betaFeatureFlagDefinitions.find((flag) => flag.key === "desmosV2");
    expect(desmosV2Flag?.label).toBe("Desmos V2");
    expect(desmosV2Flag?.dataAttribute).toBe("data-beta-desmos-v2");
    expect(desmosV2Flag?.description).toContain("smoother graph and whiteboard movement engine");
    expect(desmosV2Flag?.searchAliases).toEqual(
      expect.arrayContaining([
        "desmos",
        "graph",
        "whiteboard",
        "excalidraw",
        "movement",
        "drag",
        "resize",
        "performance",
      ]),
    );
    expect(defaultBetaFeaturesPreference.desmosV2).toBe(false);
    expect(defaultBetaFeaturesPreference.whiteboardSmoothMove).toBe(false);
    expect(defaultBetaFeaturesPreference.compactExcalidrawTools).toBe(false);
    expect(defaultBetaFeaturesPreference.whiteboardPerformanceDiagnostics).toBe(false);
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
    expect(loaded.canvasRework).toBe(false);
    expect(isBetaFeatureFlagActive(loaded, "revampBeta")).toBe(true);
    expect(isBetaFeatureFlagActive(loaded, "canvasRework")).toBe(false);
    for (const alias of revampBetaFeatureAliases) {
      expect(isBetaFeatureFlagActive(loaded, alias)).toBe(true);
    }
    expect(sanitizeBetaFeaturesPreference({ enabled: true })).toEqual({
      enabled: true,
      revampBeta: true,
      canvasRework: false,
      desmosV2: false,
      whiteboardSmoothMove: false,
      compactExcalidrawTools: false,
      whiteboardPerformanceDiagnostics: false,
      betaRevampCalmStudyHomepage: false,
      betaRevampSourceLinkedNotes: false,
      betaRevampReviewQueue: false,
      betaRevampMathStudyLoop: false,
      betaRevampMobileStudyMode: false,
      betaRevampCalmWorkspaceUi: false,
      betaRevampNarrowAiStudyTools: false,
    });
    expect(storage.snapshot()[betaFeaturesStorageKeyForUser("user-1")]).not.toContain("unknownFlag");
    expect(storage.snapshot()[betaFeaturesStorageKeyForUser("user-1")]).not.toContain("compactStudyChrome");
  });

  it("persists Canvas Rework independently from Revamp Beta", () => {
    const storage = createStorage();
    const preference = sanitizeBetaFeaturesPreference({
      enabled: true,
      revampBeta: false,
      canvasRework: true,
    });

    saveBetaFeaturesPreference("user-1", preference, storage);
    const loaded = loadBetaFeaturesPreference("user-1", storage);

    expect(loaded).toEqual({
      enabled: true,
      revampBeta: false,
      canvasRework: true,
      desmosV2: false,
      whiteboardSmoothMove: false,
      compactExcalidrawTools: false,
      whiteboardPerformanceDiagnostics: false,
      betaRevampCalmStudyHomepage: false,
      betaRevampSourceLinkedNotes: false,
      betaRevampReviewQueue: false,
      betaRevampMathStudyLoop: false,
      betaRevampMobileStudyMode: false,
      betaRevampCalmWorkspaceUi: false,
      betaRevampNarrowAiStudyTools: false,
    });
    expect(isBetaFeatureFlagActive(loaded, "canvasRework")).toBe(true);
    expect(isBetaFeatureFlagActive(loaded, "revampBeta")).toBe(false);
    expect(storage.snapshot()[betaFeaturesStorageKeyForUser("user-1")]).toContain('"canvasRework":true');
  });

  it("persists Desmos V2 and supporting whiteboard movement flags independently", () => {
    const storage = createStorage();
    const preference = sanitizeBetaFeaturesPreference({
      enabled: true,
      revampBeta: false,
      canvasRework: false,
      desmosV2: true,
      whiteboardSmoothMove: true,
      compactExcalidrawTools: true,
      whiteboardPerformanceDiagnostics: true,
    });

    saveBetaFeaturesPreference("user-1", preference, storage);
    const loaded = loadBetaFeaturesPreference("user-1", storage);

    expect(loaded).toEqual({
      enabled: true,
      revampBeta: false,
      canvasRework: false,
      desmosV2: true,
      whiteboardSmoothMove: true,
      compactExcalidrawTools: true,
      whiteboardPerformanceDiagnostics: true,
      betaRevampCalmStudyHomepage: false,
      betaRevampSourceLinkedNotes: false,
      betaRevampReviewQueue: false,
      betaRevampMathStudyLoop: false,
      betaRevampMobileStudyMode: false,
      betaRevampCalmWorkspaceUi: false,
      betaRevampNarrowAiStudyTools: false,
    });
    expect(isBetaFeatureFlagActive(loaded, "desmosV2")).toBe(true);
    expect(isBetaFeatureFlagActive(loaded, "whiteboardSmoothMove")).toBe(true);
    expect(isBetaFeatureFlagActive(loaded, "compactExcalidrawTools")).toBe(true);
    expect(isBetaFeatureFlagActive(loaded, "whiteboardPerformanceDiagnostics")).toBe(true);
    expect(isBetaFeatureFlagActive(loaded, "canvasRework")).toBe(false);
    expect(storage.snapshot()[betaFeaturesStorageKeyForUser("user-1")]).toContain('"desmosV2":true');
  });

  it("sanitizes and persists each Beta Revamp flag without enabling unrelated revamp gates", () => {
    const storage = createStorage();
    const preference = sanitizeBetaFeaturesPreference({
      enabled: true,
      betaRevampCalmStudyHomepage: true,
      betaRevampSourceLinkedNotes: true,
      betaRevampReviewQueue: true,
      betaRevampMathStudyLoop: true,
      betaRevampMobileStudyMode: true,
      betaRevampCalmWorkspaceUi: true,
      betaRevampNarrowAiStudyTools: true,
    });

    saveBetaFeaturesPreference("user-1", preference, storage);
    const loaded = loadBetaFeaturesPreference("user-1", storage);

    expect(loaded.enabled).toBe(true);
    expect(loaded.revampBeta).toBe(false);
    expect(loaded.canvasRework).toBe(false);
    expect(isAnyBetaRevampFeatureEnabled(loaded)).toBe(true);
    for (const key of betaRevampFlagKeys) {
      expect(loaded[key]).toBe(true);
      expect(isBetaFeatureFlagActive(loaded, key)).toBe(true);
      expect(storage.snapshot()[betaFeaturesStorageKeyForUser("user-1")]).toContain(`"${key}":true`);
    }
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
