import { describe, expect, it } from "vitest";
import {
  betaFeatureFlagDefinitions,
  betaFeaturesStorageKeyForUser,
  defaultBetaFeaturesPreference,
  loadBetaFeaturesPreference,
  saveBetaFeaturesPreference,
  sanitizeBetaFeaturesPreference,
} from "@/lib/beta-features";

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
  it("defines the Jacob Geometry cleanup beta flags as opt-in toggles", () => {
    expect(betaFeatureFlagDefinitions.map((flag) => flag.key)).toEqual([
      "compactStudyChrome",
      "studyPanelsV2",
      "compactWhiteboardTools",
      "canvasStarterLayouts",
      "mathPerformanceLazyLoading",
      "studentCalmMode",
      "studentPreviewAdminChromeGuard",
      "recallLab",
    ]);

    for (const flag of betaFeatureFlagDefinitions) {
      expect(flag.label.length).toBeGreaterThan(4);
      expect(flag.description.length).toBeGreaterThan(20);
      expect(flag.searchAliases.length).toBeGreaterThan(2);
      expect(defaultBetaFeaturesPreference[flag.key]).toBe(false);
    }
  });

  it("sanitizes and persists individual beta flags without turning them on by default", () => {
    const storage = createStorage();
    const preference = sanitizeBetaFeaturesPreference({
      enabled: true,
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
    expect(loaded.compactStudyChrome).toBe(true);
    expect(loaded.studyPanelsV2).toBe(true);
    expect(loaded.compactWhiteboardTools).toBe(false);
    expect(loaded.canvasStarterLayouts).toBe(true);
    expect(loaded.mathPerformanceLazyLoading).toBe(true);
    expect(loaded.recallLab).toBe(true);
    expect(loaded.studentCalmMode).toBe(true);
    expect(loaded.studentPreviewAdminChromeGuard).toBe(true);
    expect(storage.snapshot()[betaFeaturesStorageKeyForUser("user-1")]).not.toContain("unknownFlag");
  });
});
