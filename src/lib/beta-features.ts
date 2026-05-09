export const betaFeaturesStorageKey = "bindernotes:beta-features";
export const betaFeaturesPreferenceChangeEvent = "bindernotes:beta-features-change";

export const betaFeatureFlagDefinitions = [
  {
    dataAttribute: "data-beta-compact-study-chrome",
    description:
      "Reduces repeated headers, chips, action rows, and study document controls so lesson modules get more room.",
    key: "compactStudyChrome",
    label: "Compact Study Chrome",
    searchAliases: [
      "compact",
      "study chrome",
      "global chrome",
      "headers",
      "document header",
      "action rows",
      "chips",
      "mode switcher",
      "workspace cleanup",
      "jacob geometry",
    ],
  },
  {
    dataAttribute: "data-beta-study-panels-v2",
    description:
      "Enables a cleaner Study Panels experiment with slimmer tabs, better panel hierarchy, and less repeated content.",
    key: "studyPanelsV2",
    label: "Study Panels v2",
    searchAliases: [
      "study panels",
      "panels v2",
      "slimmer tabs",
      "split widths",
      "focus behavior",
      "hide secondary controls",
      "tools drawer",
      "jacob geometry",
    ],
  },
  {
    dataAttribute: "data-beta-compact-whiteboard-tools",
    description:
      "Tests a rail-first whiteboard sidebar and toolbox with lazy board templates and calmer study mode controls.",
    key: "compactWhiteboardTools",
    label: "Compact Whiteboard Tools",
    searchAliases: [
      "whiteboard",
      "board",
      "toolbox",
      "sidebar",
      "rail",
      "templates",
      "draw",
      "math board",
      "jacob geometry",
    ],
  },
  {
    dataAttribute: "data-beta-canvas-starter-layouts",
    description:
      "Adds calmer Canvas starter layouts for proof, graph, and problem-solving work without changing saved layouts.",
    key: "canvasStarterLayouts",
    label: "Canvas Starter Layouts",
    searchAliases: [
      "canvas",
      "starter layouts",
      "jacob geometry",
      "proof",
      "graph",
      "problem solving",
      "presets",
      "module warnings",
    ],
  },
  {
    dataAttribute: "data-beta-math-performance-lazy-loading",
    description:
      "Gates math performance experiments that lazy-load Desmos, keypads, graph helpers, and whiteboard resources.",
    key: "mathPerformanceLazyLoading",
    label: "Math Performance + Lazy Loading",
    searchAliases: [
      "math performance",
      "lazy loading",
      "desmos",
      "graph",
      "keypad",
      "whiteboard templates",
      "webgl",
      "speed",
      "lag",
    ],
  },
  {
    dataAttribute: "data-beta-student-calm-mode",
    description:
      "Tests calmer Jacob Math defaults with fewer always-visible support panels and student-facing workspace copy.",
    key: "studentCalmMode",
    label: "Student Calm Mode",
    searchAliases: [
      "student calm",
      "calm mode",
      "simple",
      "compact study panels",
      "reduced ornamentation",
      "student copy",
      "jacob math",
      "jacob geometry",
    ],
  },
  {
    dataAttribute: "data-beta-student-preview-admin-chrome-guard",
    description:
      "Lets admins preview the student study surface without admin chrome cluttering the learning workspace.",
    key: "studentPreviewAdminChromeGuard",
    label: "Student Preview / Admin Chrome Guard",
    searchAliases: [
      "student preview",
      "admin chrome",
      "admin guard",
      "student study surface",
      "qa preview",
      "global nav",
      "jacob geometry",
    ],
  },
  {
    dataAttribute: "data-beta-recall-lab",
    description:
      "Previews BinderNotes Recall Lab for source-linked cards, draft review, checkpoints, and mistake-aware practice.",
    key: "recallLab",
    label: "Recall Lab",
    searchAliases: [
      "recall",
      "recall lab",
      "active recall",
      "cards",
      "source recall",
      "flashcard studio",
      "memory workshop",
      "checkpoint",
      "due review",
      "mistake notebook",
    ],
  },
] as const;

export type BetaFeatureFlagKey = (typeof betaFeatureFlagDefinitions)[number]["key"];

export type BetaFeaturesPreference = {
  enabled: boolean;
} & Record<BetaFeatureFlagKey, boolean>;

export const defaultBetaFeaturesPreference: BetaFeaturesPreference = {
  canvasStarterLayouts: false,
  compactStudyChrome: false,
  compactWhiteboardTools: false,
  enabled: false,
  mathPerformanceLazyLoading: false,
  recallLab: false,
  studentCalmMode: false,
  studentPreviewAdminChromeGuard: false,
  studyPanelsV2: false,
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function betaFeaturesStorageKeyForUser(userId: string | null | undefined) {
  return userId ? `${betaFeaturesStorageKey}:${userId}` : betaFeaturesStorageKey;
}

export function sanitizeBetaFeaturesPreference(value: unknown): BetaFeaturesPreference {
  if (!isRecord(value)) {
    return defaultBetaFeaturesPreference;
  }

  const preference: BetaFeaturesPreference = {
    ...defaultBetaFeaturesPreference,
    enabled: value.enabled === true,
  };

  for (const flag of betaFeatureFlagDefinitions) {
    preference[flag.key] = value[flag.key] === true;
  }

  return preference;
}

export function isBetaFeatureFlagActive(
  preference: BetaFeaturesPreference,
  flag: BetaFeatureFlagKey,
) {
  return preference.enabled && preference[flag];
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
