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

export const betaRevampFeatureFlagKeys = [
  "betaRevampCalmStudyHomepage",
  "betaRevampSourceLinkedNotes",
  "betaRevampReviewQueue",
  "betaRevampMathStudyLoop",
  "betaRevampMobileStudyMode",
  "betaRevampCalmWorkspaceUi",
  "betaRevampNarrowAiStudyTools",
] as const;

const betaRevampSearchAliases = [
  "beta",
  "revamp",
  "calm",
  "homepage",
  "landing",
  "notes",
  "source",
  "review",
  "math",
  "graph",
  "formula",
  "mistake",
  "mobile",
  "AI",
  "study loop",
] as const;

export const betaFeatureFlagDefinitions = [
  {
    dataAttribute: "data-revamp-beta",
    description:
      "Turns on the BinderNotes QA revamp: cleaner study layouts, faster tools, safer whiteboard flow, improved notes/save states, better search, and calmer student study surfaces.",
    groupId: "currentPreview",
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
  {
    dataAttribute: "data-beta-canvas-rework",
    description:
      "Try the redesigned Canvas workspace with better freeform editing, starter layouts, snapping, layout persistence, module shelf, and smoother workspace controls.",
    groupId: "currentPreview",
    key: "canvasRework",
    label: "Canvas Rework",
    searchAliases: [
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
    ],
  },
  {
    dataAttribute: "data-beta-desmos-v2",
    description:
      "Experimental smoother graph and whiteboard movement engine with better Desmos resizing, Excalidraw stability, and lower-lag module dragging.",
    groupId: "currentPreview",
    key: "desmosV2",
    label: "Desmos V2",
    searchAliases: [
      "desmos",
      "desmos v2",
      "graph",
      "graphing",
      "whiteboard",
      "excalidraw",
      "movement",
      "smooth move",
      "drag",
      "resize",
      "teleport",
      "snap back",
      "performance",
      "lag",
      "canvas",
      "modules",
      "beta",
    ],
  },
  {
    dataAttribute: "data-beta-whiteboard-smooth-move",
    description:
      "Try lower-lag whiteboard module dragging with movement freezes, active-module-only snapping, and safer embedded surface refreshes.",
    groupId: "currentPreview",
    key: "whiteboardSmoothMove",
    label: "Whiteboard Smooth Move",
    searchAliases: [
      "whiteboard",
      "smooth move",
      "movement",
      "drag",
      "resize",
      "pin",
      "pinned",
      "teleport",
      "snap",
      "excalidraw",
      "canvas",
      "performance",
      "beta",
    ],
  },
  {
    dataAttribute: "data-beta-compact-excalidraw-tools",
    description:
      "Try a more compact whiteboard toolbox that keeps Excalidraw tools out of the way while studying.",
    groupId: "currentPreview",
    key: "compactExcalidrawTools",
    label: "Compact Excalidraw Tools",
    searchAliases: [
      "whiteboard",
      "excalidraw",
      "tools",
      "toolbox",
      "compact",
      "board",
      "templates",
      "focus board",
      "canvas",
      "beta",
    ],
  },
  {
    dataAttribute: "data-beta-whiteboard-performance-diagnostics",
    description:
      "Show development-only whiteboard and Desmos movement diagnostics for drag, resize, Fit/Tidy, remount, and embedded surface refresh behavior.",
    groupId: "currentPreview",
    key: "whiteboardPerformanceDiagnostics",
    label: "Whiteboard Performance Diagnostics",
    searchAliases: [
      "whiteboard",
      "performance",
      "diagnostics",
      "drag fps",
      "resize",
      "desmos",
      "excalidraw",
      "fit",
      "tidy",
      "logs",
      "debug",
      "beta",
    ],
  },
  {
    dataAttribute: "data-beta-revamp-calm-study-homepage",
    description:
      "Tests the new public site direction: a calm, premium, student-owned study workspace with source-linked notes, graph and review workflows, and less generic SaaS or AI wording.",
    groupId: "betaRevamp",
    key: "betaRevampCalmStudyHomepage",
    label: "Beta Revamp — Calm Study Homepage",
    searchAliases: [
      ...betaRevampSearchAliases,
      "public site",
      "student-owned",
      "workspace",
      "premium",
    ],
  },
  {
    dataAttribute: "data-beta-revamp-source-linked-notes",
    description:
      "Tests improved binder-linked and source-linked note capture, source references, jump-to-source and jump-to-note behavior, and a cleaner notes experience.",
    groupId: "betaRevamp",
    key: "betaRevampSourceLinkedNotes",
    label: "Beta Revamp — Source-Linked Notes",
    searchAliases: [
      ...betaRevampSearchAliases,
      "binder-linked",
      "source-linked",
      "jump-to-source",
      "jump-to-note",
      "capture",
    ],
  },
  {
    dataAttribute: "data-beta-revamp-review-queue",
    description:
      "Tests the daily review and study session loop from note, highlight, formula, problem, or mistake into review item, spaced review, and session summary.",
    groupId: "betaRevamp",
    key: "betaRevampReviewQueue",
    label: "Beta Revamp — Review Queue",
    searchAliases: [
      ...betaRevampSearchAliases,
      "daily review",
      "study session",
      "highlight",
      "review queue",
      "spaced review",
      "session summary",
    ],
  },
  {
    dataAttribute: "data-beta-revamp-math-study-loop",
    description:
      "Tests math-specific problem logs, formula and theorem cards, saved graph states, mistake review, and quiz attempt history.",
    groupId: "betaRevamp",
    key: "betaRevampMathStudyLoop",
    label: "Beta Revamp — Math Study Loop",
    searchAliases: [
      ...betaRevampSearchAliases,
      "math study",
      "problem log",
      "theorem",
      "saved graph",
      "quiz",
      "attempt history",
    ],
  },
  {
    dataAttribute: "data-beta-revamp-mobile-study-mode",
    description:
      "Tests phone-friendly review, quick capture, note reading, formula and problem cards, graph thumbnails, and simplified workspace behavior.",
    groupId: "betaRevamp",
    key: "betaRevampMobileStudyMode",
    label: "Beta Revamp — Mobile Study Mode",
    searchAliases: [
      ...betaRevampSearchAliases,
      "phone",
      "quick capture",
      "note reading",
      "cards",
      "graph thumbnails",
      "simplified workspace",
    ],
  },
  {
    dataAttribute: "data-beta-revamp-calm-workspace-ui",
    description:
      "Tests reduced chrome, less visual sprawl, fewer duplicate controls, better empty states, stronger primary actions, and more student-facing copy.",
    groupId: "betaRevamp",
    key: "betaRevampCalmWorkspaceUi",
    label: "Beta Revamp — Calm Workspace UI",
    searchAliases: [
      ...betaRevampSearchAliases,
      "calm workspace",
      "reduced chrome",
      "visual sprawl",
      "empty states",
      "primary actions",
      "student-facing copy",
    ],
  },
  {
    dataAttribute: "data-beta-revamp-narrow-ai-study-tools",
    description:
      "Tests only source-grounded AI helpers for recall questions, mistake explanations, review tags, and editable flashcards with source links. Open-ended homework-answer AI stays out of scope.",
    groupId: "betaRevamp",
    key: "betaRevampNarrowAiStudyTools",
    label: "Beta Revamp — Narrow AI Study Tools",
    searchAliases: [
      ...betaRevampSearchAliases,
      "ai",
      "source-grounded",
      "recall questions",
      "review tags",
      "flashcards",
      "homework-answer",
    ],
  },
] as const;

export const betaFeatureGroups = [
  {
    description: "Existing BinderNotes beta gates that must keep their current behavior.",
    flagKeys: [
      "revampBeta",
      "canvasRework",
      "desmosV2",
      "whiteboardSmoothMove",
      "compactExcalidrawTools",
      "whiteboardPerformanceDiagnostics",
    ],
    id: "currentPreview",
    label: "Current Preview",
  },
  {
    description:
      "Market-research-driven gates for the calmer source-linked, math/STEM, review, mobile, and narrow AI study direction.",
    flagKeys: betaRevampFeatureFlagKeys,
    id: "betaRevamp",
    label: "Beta Revamp",
  },
] as const;

export type UserFacingBetaFeatureFlagKey = (typeof betaFeatureFlagDefinitions)[number]["key"];
export type BetaRevampFeatureFlagKey = (typeof betaRevampFeatureFlagKeys)[number];
export type RevampBetaFeatureAliasKey = (typeof revampBetaFeatureAliases)[number];
export type BetaFeatureFlagKey = UserFacingBetaFeatureFlagKey | RevampBetaFeatureAliasKey;

export type BetaFeaturesPreference = {
  enabled: boolean;
  revampBeta: boolean;
  canvasRework: boolean;
  desmosV2: boolean;
  whiteboardSmoothMove: boolean;
  compactExcalidrawTools: boolean;
  whiteboardPerformanceDiagnostics: boolean;
  betaRevampCalmStudyHomepage: boolean;
  betaRevampSourceLinkedNotes: boolean;
  betaRevampReviewQueue: boolean;
  betaRevampMathStudyLoop: boolean;
  betaRevampMobileStudyMode: boolean;
  betaRevampCalmWorkspaceUi: boolean;
  betaRevampNarrowAiStudyTools: boolean;
};

export const defaultBetaFeaturesPreference: BetaFeaturesPreference = {
  enabled: false,
  revampBeta: false,
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

export function isAnyBetaFeatureEnabled(preference: BetaFeaturesPreference) {
  return preference.enabled && betaFeatureFlagDefinitions.some((flag) => preference[flag.key] === true);
}

export function isAnyBetaRevampFeatureEnabled(preference: BetaFeaturesPreference) {
  return preference.enabled && betaRevampFeatureFlagKeys.some((key) => preference[key] === true);
}

export function sanitizeBetaFeaturesPreference(value: unknown): BetaFeaturesPreference {
  if (!isRecord(value)) {
    return defaultBetaFeaturesPreference;
  }

  const hasExplicitRevampBeta = Object.prototype.hasOwnProperty.call(value, "revampBeta");
  const hasLegacyAlias = revampBetaFeatureAliases.some((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
  const hasExplicitModernFlag = betaFeatureFlagDefinitions.some((flag) =>
    flag.key === "revampBeta" ? false : Object.prototype.hasOwnProperty.call(value, flag.key),
  );
  const legacyRevampSelection = revampBetaFeatureAliases.some((key) => value[key] === true);
  const legacyMasterToggle =
    value.enabled === true && !hasExplicitRevampBeta && !hasLegacyAlias && !hasExplicitModernFlag;
  const revampBeta = value.revampBeta === true || legacyRevampSelection || legacyMasterToggle;
  const canvasRework = value.canvasRework === true;
  const desmosV2 = value.desmosV2 === true;
  const whiteboardSmoothMove = value.whiteboardSmoothMove === true;
  const compactExcalidrawTools = value.compactExcalidrawTools === true;
  const whiteboardPerformanceDiagnostics = value.whiteboardPerformanceDiagnostics === true;
  const betaRevampCalmStudyHomepage = value.betaRevampCalmStudyHomepage === true;
  const betaRevampSourceLinkedNotes = value.betaRevampSourceLinkedNotes === true;
  const betaRevampReviewQueue = value.betaRevampReviewQueue === true;
  const betaRevampMathStudyLoop = value.betaRevampMathStudyLoop === true;
  const betaRevampMobileStudyMode = value.betaRevampMobileStudyMode === true;
  const betaRevampCalmWorkspaceUi = value.betaRevampCalmWorkspaceUi === true;
  const betaRevampNarrowAiStudyTools = value.betaRevampNarrowAiStudyTools === true;

  return {
    enabled:
      value.enabled === true ||
      revampBeta ||
      canvasRework ||
      desmosV2 ||
      whiteboardSmoothMove ||
      compactExcalidrawTools ||
      whiteboardPerformanceDiagnostics ||
      betaRevampCalmStudyHomepage ||
      betaRevampSourceLinkedNotes ||
      betaRevampReviewQueue ||
      betaRevampMathStudyLoop ||
      betaRevampMobileStudyMode ||
      betaRevampCalmWorkspaceUi ||
      betaRevampNarrowAiStudyTools,
    revampBeta,
    canvasRework,
    desmosV2,
    whiteboardSmoothMove,
    compactExcalidrawTools,
    whiteboardPerformanceDiagnostics,
    betaRevampCalmStudyHomepage,
    betaRevampSourceLinkedNotes,
    betaRevampReviewQueue,
    betaRevampMathStudyLoop,
    betaRevampMobileStudyMode,
    betaRevampCalmWorkspaceUi,
    betaRevampNarrowAiStudyTools,
  };
}

export function isBetaFeatureFlagActive(
  preference: BetaFeaturesPreference,
  flag: BetaFeatureFlagKey,
) {
  if (flag === "revampBeta" || revampBetaFeatureAliases.includes(flag as RevampBetaFeatureAliasKey)) {
    return isRevampBetaEnabled(preference);
  }

  if (flag === "canvasRework") {
    return preference.enabled && preference.canvasRework;
  }

  if (
    flag === "desmosV2" ||
    flag === "whiteboardSmoothMove" ||
    flag === "compactExcalidrawTools" ||
    flag === "whiteboardPerformanceDiagnostics"
  ) {
    return preference.enabled && preference[flag];
  }

  if (betaRevampFeatureFlagKeys.includes(flag as BetaRevampFeatureFlagKey)) {
    return preference.enabled && preference[flag as BetaRevampFeatureFlagKey];
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
