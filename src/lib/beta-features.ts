export const betaFeaturesStorageKey = "bindernotes:beta-features";
export const betaFeaturesPreferenceChangeEvent = "bindernotes:beta-features-change";

export const revampBetaFeatureAliases = [
  "compactStudyChrome",
  "studyPanelsV2",
  "compactWhiteboardTools",
  "canvasStarterLayouts",
  "mathPerformanceLazyLoading",
  "studentCalmMode",
  "studentPreviewAdminChromeGuard",
  "recallLab",
] as const;

export const betaFeatureFlagDefinitions = [
  {
    dataAttribute: "data-revamp-beta",
    description:
      "Turns on the BinderNotes QA revamp: cleaner study layouts, faster tools, safer whiteboard flow, improved notes/save states, better search, and calmer student study surfaces.",
    key: "revampBeta",
    label: "Revamp Beta",
    searchAliases: [
      "revamp",
      "revamp beta",
      "qa cleanup",
      "qa revamp",
      "split study",
      "study panels",
      "math",
      "whiteboard",
      "notes",
      "history",
      "dashboard",
      "settings",
      "settings search",
      "performance",
      "desmos",
      "calculator",
      "autosave",
      "save status",
      "student study surfaces",
    ],
  },
] as const;

export type UserFacingBetaFeatureFlagKey = (typeof betaFeatureFlagDefinitions)[number]["key"];
export type RevampBetaFeatureAliasKey = (typeof revampBetaFeatureAliases)[number];
export type BetaFeatureFlagKey = UserFacingBetaFeatureFlagKey | RevampBetaFeatureAliasKey;

export type BetaFeaturesPreference = {
  enabled: boolean;
  revampBeta: boolean;
};

export const defaultBetaFeaturesPreference: BetaFeaturesPreference = {
  enabled: false,
  revampBeta: false,
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function betaFeaturesStorageKeyForUser(userId: string | null | undefined) {
  return userId ? `${betaFeaturesStorageKey}:${userId}` : betaFeaturesStorageKey;
}

export function isRevampBetaEnabled(preference: BetaFeaturesPreference) {
  return preference.enabled && preference.revampBeta;
}

export function sanitizeBetaFeaturesPreference(value: unknown): BetaFeaturesPreference {
  if (!isRecord(value)) {
    return defaultBetaFeaturesPreference;
  }

  const hasExplicitRevampBeta = Object.prototype.hasOwnProperty.call(value, "revampBeta");
  const hasLegacyAlias = revampBetaFeatureAliases.some((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
  const legacyRevampSelection = revampBetaFeatureAliases.some((key) => value[key] === true);
  const legacyMasterToggle = value.enabled === true && !hasExplicitRevampBeta && !hasLegacyAlias;
  const revampBeta = value.revampBeta === true || legacyRevampSelection || legacyMasterToggle;

  return {
    enabled: value.enabled === true,
    revampBeta,
  };
}

export function isBetaFeatureFlagActive(
  preference: BetaFeaturesPreference,
  flag: BetaFeatureFlagKey,
) {
  if (flag === "revampBeta" || revampBetaFeatureAliases.includes(flag as RevampBetaFeatureAliasKey)) {
    return isRevampBetaEnabled(preference);
  }

  return false;
}

export function loadBetaFeaturesPreference(
  userId: string | null | undefined,
  storage: StorageLike | undefined,
): BetaFeaturesPreference {
  if (!storage) {
    return defaultBetaFeaturesPreference;
  }

  try {
    const raw = storage.getItem(betaFeaturesStorageKeyForUser(userId)) ?? storage.getItem(betaFeaturesStorageKey);
    return raw ? sanitizeBetaFeaturesPreference(JSON.parse(raw)) : defaultBetaFeaturesPreference;
  } catch {
    return defaultBetaFeaturesPreference;
  }
}

export function saveBetaFeaturesPreference(
  userId: string | null | undefined,
  preference: BetaFeaturesPreference,
  storage: StorageLike | undefined,
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      betaFeaturesStorageKeyForUser(userId),
      JSON.stringify(sanitizeBetaFeaturesPreference(preference)),
    );
  } catch {
    // Beta feature preference is non-critical; storage failures should not block studying.
  }
}
