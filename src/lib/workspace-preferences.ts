import type {
  AccentColor,
  AppearanceCustomPalette,
  AppearanceMotion,
  AppearanceSettings,
  FullCanvasSettings,
  FullCanvasSnapBehavior,
  HighlightColor,
  ModularPanelDensity,
  ModularSidePanelPosition,
  ModularStudySettings,
  SimplePresentationFontSize,
  SimplePresentationMotion,
  SimplePresentationReadingWidth,
  SimplePresentationSettings,
  SimplePresentationTheme,
  WorkspaceAnimationLevel,
  WorkspaceBackgroundStyle,
  StickyNoteLayout,
  StickyNoteTint,
  WorkspaceDensity,
  WorkspaceFont,
  WorkspaceGraphAppearance,
  WorkspaceGraphChrome,
  WorkspaceModuleId,
  WorkspaceModuleSpan,
  WorkspacePreferences,
  WorkspacePresetId,
  WorkspaceRoundness,
  WorkspaceShadow,
  WorkspaceMode,
  WorkspaceStyle,
  WorkspaceThemeSettings,
  WorkspaceThemeId,
  WorkspaceVerticalSpace,
  WorkspaceWindowFrame,
  WorkspaceZone,
} from "@/types";
import { SYSTEM_BINDER_IDS, systemSuiteTemplates } from "@/lib/history-suite-seeds";
import {
  fitWindowFramesToViewport,
  tidyWorkspaceFrames,
  WORKSPACE_MAX_CANVAS_HEIGHT,
  WORKSPACE_SAFE_EDGE_PADDING,
} from "@/lib/workspace-layout-engine";
import { getPresetDefinition, gridLayoutToWindowFrames } from "@/lib/preset-validator";
import { hasDesmosApiKey } from "@/lib/desmos-loader";
import {
  applyWorkspacePresetDesignAvailability,
  getWorkspacePresetDesign,
  selectWorkspacePresetVisibleModules,
  type WorkspacePresetRuntimeAvailability,
} from "@/lib/workspace-preset-designs";

export type WorkspacePreset = {
  id: WorkspacePresetId;
  name: string;
  description: string;
};

type WorkspacePresetSubject = "general" | "math" | "history";

type WorkspacePresetVisibility = {
  subject: WorkspacePresetSubject;
  modes: WorkspaceMode[];
  advanced?: boolean;
};

type VisibleWorkspacePresetOptions = {
  binderSubject?: string | null;
  historyEnabled?: boolean;
  includeAdvanced?: boolean;
};

type WorkspacePresetLayout = {
  enabledModules: WorkspaceModuleId[];
  zones: Record<WorkspaceZone, WorkspaceModuleId[]>;
  paneLayout: WorkspacePreferences["paneLayout"];
  windowLayout?: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
  moduleLayout?: WorkspacePreferences["moduleLayout"];
};

export type WorkspaceTheme = {
  id: WorkspaceThemeId;
  name: string;
  description: string;
  vars: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    secondary: string;
    muted: string;
    mutedForeground: string;
    border: string;
    accent: string;
    primary: string;
  };
};

export type WorkspaceStyleOption = {
  id: WorkspaceStyle;
  name: string;
  description: string;
};

export type WorkspaceModeOption = {
  id: WorkspaceMode;
  name: string;
  description: string;
};

const WINDOW_CANVAS_WIDTH = 1920;
const WINDOW_CANVAS_HEIGHT = 1600;
const WINDOW_CANVAS_MIN_HEIGHT = WINDOW_CANVAS_HEIGHT;
const WINDOW_PADDING = 16;
const WINDOW_GAP = 16;
const PRESET_SPACE = {
  small: 16,
  medium: 20,
  large: 24,
} as const;
const DEFAULT_NOTE_TINTS: StickyNoteTint[] = ["amber", "mint", "sky", "rose", "violet"];

export const workspaceModules: {
  id: WorkspaceModuleId;
  name: string;
  description: string;
  steady?: boolean;
}[] = [
  { id: "lesson", name: "Published lesson", description: "The source lesson you are studying.", steady: true },
  { id: "private-notes", name: "Private notes", description: "Your own side-by-side working notes.", steady: true },
  { id: "binder-notebook", name: "Binder notebook", description: "A combined view of your lesson notes across this binder.", steady: true },
  { id: "history-timeline", name: "History timeline", description: "Chronology, event cards, and map-style context.", steady: true },
  { id: "history-evidence", name: "Source evidence", description: "Evidence locker with primary and secondary sources.", steady: true },
  { id: "history-argument", name: "Argument builder", description: "Cause-and-effect chains with evidence links.", steady: true },
  { id: "history-myth-checks", name: "Myth vs history", description: "Evaluate claims against evidence and interpretation.", steady: true },
  { id: "comments", name: "Sticky notes", description: "Anchored and freeform study notes." },
  { id: "lesson-outline", name: "Lesson outline", description: "Fast lesson navigation." },
  { id: "search", name: "Search", description: "Search within the current binder." },
  { id: "formula-sheet", name: "Formula sheet", description: "Reusable equations from lessons and notes." },
  { id: "math-blocks", name: "Math blocks", description: "Structured equations saved in this lesson." },
  { id: "desmos-graph", name: "Desmos graph", description: "A live graphing calculator window." },
  { id: "scientific-calculator", name: "Scientific calculator", description: "Desmos scientific calculator and fallback tools." },
  { id: "saved-graphs", name: "Saved graphs", description: "Named graph states and snapshots." },
  { id: "whiteboard", name: "Whiteboard", description: "A graph-paper study board for drawing, templates, and live BinderNotes modules." },
  { id: "recent-highlights", name: "Recent highlights", description: "Saved anchors and takeaways." },
  { id: "tasks", name: "Tasks/checklist", description: "A focused study checklist." },
  { id: "related-concepts", name: "Related concepts", description: "Connected concepts and references." },
  { id: "flashcards", name: "Flashcards", description: "Recall cards placeholder." },
  { id: "mini-tools", name: "Mini tools", description: "Timer, focus, and utility actions." },
];

export const workspaceStyleOptions: WorkspaceStyleOption[] = [
  {
    id: "guided",
    name: "Guided",
    description: "Preset-first studying with fewer controls on screen.",
  },
  {
    id: "flexible",
    name: "Flexible",
    description: "A lighter version of the studio with the main windows still adjustable.",
  },
  {
    id: "full-studio",
    name: "Full Studio",
    description: "Full modular control with drag, resize, collapse, and advanced layout tools.",
  },
];

export const workspaceModeOptions: WorkspaceModeOption[] = [
  {
    id: "simple",
    name: "Simple View",
    description: "Clean fullscreen study view with reading, notes, and helper drawers.",
  },
  {
    id: "modular",
    name: "Study Panels",
    description: "Structured preset panels for active study without full canvas editing.",
  },
  {
    id: "canvas",
    name: "Canvas",
    description: "Advanced custom workspace with movable and resizable modules.",
  },
];

export const simplePresentationThemeOptions: {
  id: SimplePresentationTheme;
  name: string;
  description: string;
}[] = [
  { id: "match", name: "Study Surface Match", description: "Follow the selected app theme." },
  { id: "classic-light", name: "Classic Light", description: "Crisp white study surface." },
  { id: "warm-paper", name: "Warm Paper", description: "Softer reading with paper-like warmth." },
  { id: "night-study", name: "Night Study", description: "Dark, calm, and lower glare." },
  { id: "history-gold", name: "History Gold", description: "Warm accent for timelines and sources." },
  { id: "math-blue", name: "Math Blue", description: "Cool, clear tone for formulas and graph work." },
  { id: "high-contrast", name: "High Contrast", description: "Maximum readability and stronger edges." },
];

const studySurfaceThemeIds: SimplePresentationTheme[] = [
  "match",
  "classic-light",
  "warm-paper",
  "night-study",
  "history-gold",
  "math-blue",
  "high-contrast",
  "custom",
];

function isStudySurfaceTheme(value: unknown): value is SimplePresentationTheme {
  return studySurfaceThemeIds.includes(value as SimplePresentationTheme);
}

export const simplePresentationFontSizeOptions: {
  id: SimplePresentationFontSize;
  name: string;
}[] = [
  { id: "small", name: "Small" },
  { id: "medium", name: "Medium" },
  { id: "large", name: "Large" },
];

export const simplePresentationReadingWidthOptions: {
  id: SimplePresentationReadingWidth;
  name: string;
}[] = [
  { id: "focused", name: "Focused" },
  { id: "comfortable", name: "Comfortable" },
  { id: "wide", name: "Wide" },
];

export const simplePresentationMotionOptions: {
  id: SimplePresentationMotion;
  name: string;
}[] = [
  { id: "reduced", name: "Reduced" },
  { id: "standard", name: "Standard" },
];

export const highlightColorOptions: { id: HighlightColor; name: string; description: string }[] = [
  { id: "yellow", name: "Important", description: "Core ideas and anchor points." },
  { id: "blue", name: "Definition", description: "Definitions, meaning, and vocabulary." },
  { id: "green", name: "Method", description: "Procedures, moves, and worked methods." },
  { id: "pink", name: "Review later", description: "Save this for a second pass." },
  { id: "orange", name: "Question", description: "Confusing spots and open questions." },
];

const presetStyles = (
  guided: WorkspacePresetLayout,
  flexible: WorkspacePresetLayout,
  fullStudio: WorkspacePresetLayout,
) =>
  ({
    guided,
    flexible,
    "full-studio": fullStudio,
  }) satisfies Record<WorkspaceStyle, WorkspacePresetLayout>;

const zones = (
  leftRail: WorkspaceModuleId[],
  centerLeft: WorkspaceModuleId[],
  centerRight: WorkspaceModuleId[],
  rightRail: WorkspaceModuleId[] = [],
  bottom: WorkspaceModuleId[] = [],
) => ({
  "left-rail": leftRail,
  "center-left": centerLeft,
  "center-right": centerRight,
  "right-rail": rightRail,
  bottom,
});

const paneLayout = (leftRail: number, centerLeft: number, centerRight: number, rightRail: number) => ({
  leftRail,
  centerLeft,
  centerRight,
  rightRail,
});

const frame = (
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
): WorkspaceWindowFrame => ({
  x,
  y,
  w,
  h,
  z,
});

const defaultModuleLayout: WorkspacePreferences["moduleLayout"] = {
  lesson: { span: "wide", pinned: true },
  "private-notes": { span: "wide", pinned: true },
  "binder-notebook": { span: "wide", pinned: true },
  "history-timeline": { span: "full", pinned: true },
  "history-evidence": { span: "wide", pinned: true },
  "history-argument": { span: "wide", pinned: true },
  "history-myth-checks": { span: "medium", pinned: true },
  comments: { span: "medium" },
  "lesson-outline": { span: "narrow" },
  search: { span: "narrow" },
  "formula-sheet": { span: "medium" },
  "math-blocks": { span: "medium" },
  "recent-highlights": { span: "medium" },
  "desmos-graph": { span: "full" },
  "scientific-calculator": { span: "wide" },
  "saved-graphs": { span: "medium" },
  whiteboard: { span: "full" },
  tasks: { span: "medium" },
  "related-concepts": { span: "medium" },
  flashcards: { span: "medium" },
  "mini-tools": { span: "narrow" },
};

export const workspacePresets: WorkspacePreset[] = [
  {
    id: "focused-reading",
    name: "Focused Reading",
    description: "A source-first reading preset with a strong lesson anchor and just enough support nearby.",
  },
  {
    id: "notes-focus",
    name: "Notes Focus",
    description: "A writing-first preset that still keeps the source close enough to think with.",
  },
  {
    id: "split-study",
    name: "Split Study",
    description: "A lesson-and-notes workspace that gives both surfaces room to matter without flattening them.",
  },
  {
    id: "math-study",
    name: "Math Study",
    description: "A graph-first study preset with lesson context, notes, formula cards, and saved graph states in reach.",
  },
  {
    id: "math-simple-presentation",
    name: "Math Simple Presentation",
    description: "A calm lesson-first math view with notes and a small helper stack nearby.",
  },
  {
    id: "math-guided-study",
    name: "Math Guided Study",
    description: "A balanced math preset for reading, graphing, formulas, notes, and linked practice.",
  },
  {
    id: "math-graph-lab",
    name: "Math Graph Lab",
    description: "A graph-dominant layout with 2D/3D exploration, formula context, and saved graph states.",
  },
  {
    id: "math-proof-concept",
    name: "Math Proof / Concept Mode",
    description: "A theorem-first layout for linear algebra and real analysis proof work.",
  },
  {
    id: "math-practice-mode",
    name: "Math Practice Mode",
    description: "A practice-first math layout with formulas, notes, and graph help close by.",
  },
  {
    id: "full-math-canvas",
    name: "Full Math Canvas",
    description: "A full modular math canvas with graph, notes, formulas, calculator, saved states, and concept support.",
  },
  {
    id: "annotation-mode",
    name: "Annotation Mode",
    description: "A capture-heavy workspace where the lesson stays central and annotations stack around it.",
  },
  {
    id: "history-guided",
    name: "History Guided",
    description: "A four-panel history suite layout with chronology first and evidence close by.",
  },
  {
    id: "history-timeline-focus",
    name: "History Timeline Focus",
    description: "A chronology-first history layout with evidence and argument support panels.",
  },
  {
    id: "history-source-evidence",
    name: "History Source Evidence",
    description: "A source-first history layout for close reading and evidence storage.",
  },
  {
    id: "history-argument-builder",
    name: "History Argument Builder",
    description: "A writing-heavy history layout that keeps the cause chain in view.",
  },
  {
    id: "history-full-studio",
    name: "History Full Studio",
    description: "A full history study workspace that balances source, timeline, argument, and myth checks.",
  },
];

const workspacePresetVisibility: Record<WorkspacePresetId, WorkspacePresetVisibility> = {
  "focused-reading": { subject: "general", modes: ["simple", "modular"] },
  "notes-focus": { subject: "general", modes: ["simple", "modular"] },
  "split-study": { subject: "general", modes: ["simple", "modular", "canvas"] },
  "math-study": { subject: "math", modes: ["modular", "canvas"] },
  "math-simple-presentation": { subject: "math", modes: ["simple"] },
  "math-guided-study": { subject: "math", modes: ["modular", "canvas"] },
  "math-graph-lab": { subject: "math", modes: ["modular", "canvas"] },
  "math-proof-concept": { subject: "math", modes: ["modular", "canvas"] },
  "math-practice-mode": { subject: "math", modes: ["modular", "canvas"] },
  "full-math-canvas": { subject: "math", modes: ["canvas"], advanced: true },
  "annotation-mode": { subject: "general", modes: ["modular", "canvas"], advanced: true },
  "history-guided": { subject: "history", modes: ["modular", "canvas"] },
  "history-timeline-focus": { subject: "history", modes: ["modular", "canvas"] },
  "history-source-evidence": { subject: "history", modes: ["modular", "canvas"] },
  "history-argument-builder": { subject: "history", modes: ["modular", "canvas"] },
  "history-full-studio": { subject: "history", modes: ["canvas"], advanced: true },
};

export function getWorkspacePresetSubject(presetId: WorkspacePresetId) {
  return workspacePresetVisibility[presetId]?.subject ?? "general";
}

export function getVisibleWorkspacePresets(
  preferences: Pick<WorkspacePreferences, "activeMode" | "preset">,
  options: VisibleWorkspacePresetOptions = {},
) {
  const activeSubject = resolvePresetSubject(options.binderSubject, options.historyEnabled);

  return workspacePresets.filter((preset) => {
    const visibility = workspacePresetVisibility[preset.id];
    if (!visibility) {
      return true;
    }

    const presetIsActive = preset.id === preferences.preset;
    const subjectMatches =
      visibility.subject === "general" ||
      visibility.subject === activeSubject ||
      (presetIsActive && visibility.subject !== "history" && activeSubject === "general");
    const modeMatches = visibility.modes.includes(preferences.activeMode) || presetIsActive;
    const advancedMatches = options.includeAdvanced || !visibility.advanced || presetIsActive;

    return subjectMatches && modeMatches && advancedMatches;
  });
}

export function getTopbarWorkspacePresetRecommendations(
  preferences: Pick<WorkspacePreferences, "activeMode" | "preset">,
  options: VisibleWorkspacePresetOptions = {},
  limit = 2,
) {
  const activeSubject = resolvePresetSubject(options.binderSubject, options.historyEnabled);
  const visiblePresets = getVisibleWorkspacePresets(preferences, {
    ...options,
    includeAdvanced: true,
  });
  const preferredMathPresetOrder: WorkspacePresetId[] = [
    "split-study",
    "math-study",
    "math-guided-study",
    "math-graph-lab",
    "math-proof-concept",
    "math-practice-mode",
  ];
  const orderedVisiblePresets =
    activeSubject === "math"
      ? [
          ...preferredMathPresetOrder
            .map((presetId) => visiblePresets.find((preset) => preset.id === presetId))
            .filter((preset): preset is WorkspacePreset => Boolean(preset)),
          ...visiblePresets.filter((preset) => !preferredMathPresetOrder.includes(preset.id)),
        ]
      : visiblePresets;
  const activePreset = visiblePresets.find((preset) => preset.id === preferences.preset);
  const recommendations = [
    ...(activePreset ? [activePreset] : []),
    ...orderedVisiblePresets.filter((preset) => preset.id !== activePreset?.id),
  ];

  return recommendations.slice(0, limit);
}

function resolvePresetSubject(
  binderSubject?: string | null,
  historyEnabled = false,
): WorkspacePresetSubject {
  const normalized = binderSubject?.trim().toLowerCase() ?? "";
  if (historyEnabled || normalized === "history") {
    return "history";
  }

  if (
    normalized.includes("math") ||
    normalized.includes("algebra") ||
    normalized.includes("geometry") ||
    normalized.includes("calculus") ||
    normalized.includes("statistics")
  ) {
    return "math";
  }

  return "general";
}

const workspacePresetLayouts: Partial<
  Record<WorkspacePresetId, Record<WorkspaceStyle, WorkspacePresetLayout>>
> = {
  "focused-reading": presetStyles(
    {
      enabledModules: ["lesson-outline", "lesson"],
      zones: zones(["lesson-outline"], ["lesson"], []),
      paneLayout: paneLayout(13, 87, 0, 0),
      windowLayout: {
        "lesson-outline": frame(20, 20, 232, 1120, 1),
        lesson: frame(272, 20, 1628, 1376, 2),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "lesson-outline": { span: "narrow" },
      },
    },
    {
      enabledModules: ["lesson-outline", "lesson", "recent-highlights"],
      zones: zones(["lesson-outline"], ["lesson"], ["recent-highlights"]),
      paneLayout: paneLayout(13, 67, 20, 0),
      windowLayout: {
        "lesson-outline": frame(20, 20, 236, 340, 1),
        lesson: frame(276, 20, 1264, 1380, 2),
        "recent-highlights": frame(1560, 20, 340, 400, 3),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "lesson-outline": { span: "narrow" },
        "recent-highlights": { span: "medium" },
      },
    },
    {
      enabledModules: ["lesson-outline", "lesson", "recent-highlights", "search", "related-concepts"],
      zones: zones(["lesson-outline", "search"], ["lesson"], [], ["recent-highlights", "related-concepts"]),
      paneLayout: paneLayout(12, 59, 0, 29),
      windowLayout: {
        "lesson-outline": frame(20, 20, 236, 340, 1),
        search: frame(20, 376, 236, 220, 2),
        lesson: frame(276, 20, 1116, 1400, 3),
        "recent-highlights": frame(1412, 20, 488, 340, 4),
        "related-concepts": frame(1412, 376, 488, 320, 5),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "lesson-outline": { span: "narrow" },
        search: { span: "narrow" },
        "recent-highlights": { span: "medium" },
        "related-concepts": { span: "medium" },
      },
    },
  ),
  "notes-focus": presetStyles(
    {
      enabledModules: ["lesson", "private-notes", "binder-notebook"],
      zones: zones(["lesson"], ["private-notes"], ["binder-notebook"]),
      paneLayout: paneLayout(14, 55, 31, 0),
      windowLayout: {
        lesson: frame(20, 20, 420, 520, 1),
        "private-notes": frame(460, 20, 860, 1380, 2),
        "binder-notebook": frame(1340, 20, 560, 1380, 3),
      },
      moduleLayout: {
        lesson: { span: "medium", pinned: true },
        "private-notes": { span: "full", pinned: true },
        "binder-notebook": { span: "wide", pinned: true },
      },
    },
    {
      enabledModules: ["lesson", "private-notes", "binder-notebook"],
      zones: zones(["lesson"], ["private-notes"], ["binder-notebook"]),
      paneLayout: paneLayout(14, 55, 31, 0),
      windowLayout: {
        lesson: frame(20, 20, 420, 520, 1),
        "private-notes": frame(460, 20, 860, 1400, 2),
        "binder-notebook": frame(1340, 20, 560, 1400, 3),
      },
      moduleLayout: {
        lesson: { span: "medium", pinned: true },
        "private-notes": { span: "full", pinned: true },
        "binder-notebook": { span: "wide", pinned: true },
      },
    },
    {
      enabledModules: ["lesson", "private-notes", "binder-notebook", "recent-highlights"],
      zones: zones(["lesson", "recent-highlights"], ["private-notes"], ["binder-notebook"]),
      paneLayout: paneLayout(14, 50, 36, 0),
      windowLayout: {
        lesson: frame(20, 20, 260, 400, 1),
        "recent-highlights": frame(20, 456, 260, 280, 2),
        "private-notes": frame(300, 20, 940, 1400, 3),
        "binder-notebook": frame(1260, 20, 640, 1400, 4),
      },
      moduleLayout: {
        lesson: { span: "medium", pinned: true },
        "recent-highlights": { span: "medium" },
        "private-notes": { span: "full", pinned: true },
        "binder-notebook": { span: "wide", pinned: true },
      },
    },
  ),
  "split-study": presetStyles(
    {
      enabledModules: ["lesson", "private-notes"],
      zones: zones([], ["lesson"], ["private-notes"]),
      paneLayout: paneLayout(0, 50, 50, 0),
      windowLayout: {
        lesson: frame(20, 20, 920, 1380, 1),
        "private-notes": frame(960, 20, 920, 1380, 2),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "private-notes": { span: "wide", pinned: true },
      },
    },
    {
      enabledModules: ["lesson-outline", "lesson", "private-notes"],
      zones: zones(["lesson-outline"], ["lesson"], ["private-notes"]),
      paneLayout: paneLayout(12, 44, 44, 0),
      windowLayout: {
        "lesson-outline": frame(20, 20, 220, 300, 1),
        lesson: frame(260, 20, 810, 1400, 2),
        "private-notes": frame(1090, 20, 810, 1400, 3),
      },
      moduleLayout: {
        "lesson-outline": { span: "narrow" },
        lesson: { span: "full", pinned: true },
        "private-notes": { span: "wide", pinned: true },
      },
    },
    {
      enabledModules: ["lesson-outline", "lesson", "private-notes", "recent-highlights", "tasks"],
      zones: zones(["lesson-outline"], ["lesson"], ["private-notes"], [], ["recent-highlights", "tasks"]),
      paneLayout: paneLayout(12, 44, 44, 0),
      windowLayout: {
        "lesson-outline": frame(20, 20, 220, 300, 1),
        lesson: frame(260, 20, 800, 1180, 2),
        "private-notes": frame(1080, 20, 820, 1180, 3),
        "recent-highlights": frame(260, 1220, 390, 280, 4),
        tasks: frame(670, 1220, 390, 280, 5),
      },
      moduleLayout: {
        "lesson-outline": { span: "narrow" },
        lesson: { span: "full", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        tasks: { span: "medium" },
        "recent-highlights": { span: "medium" },
      },
    },
  ),
  "math-study": presetStyles(
    {
      enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet", "saved-graphs", "scientific-calculator"],
      zones: zones(["lesson", "private-notes"], ["desmos-graph"], [], ["formula-sheet", "saved-graphs", "scientific-calculator"]),
      paneLayout: paneLayout(27, 52, 0, 21),
      windowLayout: {
        lesson: frame(20, 20, 500, 420, 1),
        "private-notes": frame(20, 460, 500, 620, 2),
        "desmos-graph": frame(540, 20, 980, 1060, 3),
        "formula-sheet": frame(1540, 20, 360, 520, 4),
        "saved-graphs": frame(1540, 560, 360, 520, 5),
        "scientific-calculator": frame(1540, 1100, 360, 420, 6),
      },
      moduleLayout: {
        lesson: { span: "wide", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "desmos-graph": { span: "full" },
        "formula-sheet": { span: "medium" },
        "saved-graphs": { span: "medium" },
        "scientific-calculator": { span: "medium" },
      },
    },
    {
      enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet", "saved-graphs", "scientific-calculator", "math-blocks"],
      zones: zones(["lesson", "formula-sheet", "saved-graphs"], ["desmos-graph", "scientific-calculator"], ["private-notes", "math-blocks"], []),
      paneLayout: paneLayout(23, 56, 21, 0),
      windowLayout: {
        lesson: frame(20, 20, 420, 360, 1),
        "formula-sheet": frame(20, 400, 420, 360, 2),
        "saved-graphs": frame(20, 780, 420, 300, 3),
        "desmos-graph": frame(460, 20, 1060, 860, 4),
        "private-notes": frame(1540, 20, 360, 860, 5),
        "scientific-calculator": frame(460, 900, 520, 420, 6),
        "math-blocks": frame(1000, 900, 900, 340, 7),
      },
      moduleLayout: {
        lesson: { span: "medium", pinned: true },
        "formula-sheet": { span: "medium" },
        "saved-graphs": { span: "medium" },
        "private-notes": { span: "wide", pinned: true },
        "desmos-graph": { span: "full" },
        "scientific-calculator": { span: "medium" },
        "math-blocks": { span: "wide" },
      },
    },
    {
      enabledModules: ["lesson", "private-notes", "desmos-graph", "scientific-calculator", "saved-graphs", "formula-sheet", "math-blocks"],
      zones: zones(["lesson", "formula-sheet", "saved-graphs"], ["desmos-graph", "math-blocks"], ["private-notes", "scientific-calculator"], []),
      paneLayout: paneLayout(20, 55, 25, 0),
      windowLayout: {
        lesson: frame(20, 20, 360, 420, 1),
        "formula-sheet": frame(20, 460, 360, 420, 2),
        "saved-graphs": frame(20, 920, 360, 360, 3),
        "desmos-graph": frame(400, 20, 1040, 940, 4),
        "math-blocks": frame(400, 980, 1040, 360, 5),
        "private-notes": frame(1460, 20, 440, 500, 6),
        "scientific-calculator": frame(1460, 540, 440, 420, 7),
      },
      moduleLayout: {
        lesson: { span: "medium", pinned: true },
        "formula-sheet": { span: "medium" },
        "desmos-graph": { span: "full" },
        "private-notes": { span: "wide", pinned: true },
        "scientific-calculator": { span: "wide" },
        "saved-graphs": { span: "medium" },
        "math-blocks": { span: "wide" },
      },
    },
  ),
  "math-simple-presentation": presetStyles(
    {
      enabledModules: ["lesson", "private-notes", "formula-sheet", "desmos-graph"],
      zones: zones(["lesson"], [], [], ["private-notes", "formula-sheet", "desmos-graph"]),
      paneLayout: paneLayout(68, 0, 0, 32),
      windowLayout: {
        lesson: frame(20, 20, 1280, 1180, 1),
        "private-notes": frame(1320, 20, 580, 520, 2),
        "formula-sheet": frame(1320, 560, 580, 340, 3),
        "desmos-graph": frame(1320, 920, 580, 460, 4),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "formula-sheet": { span: "wide" },
        "desmos-graph": { span: "wide" },
      },
    },
    {
      enabledModules: ["lesson", "private-notes", "formula-sheet", "desmos-graph", "math-blocks"],
      zones: zones(["lesson"], ["desmos-graph"], [], ["private-notes", "formula-sheet", "math-blocks"]),
      paneLayout: paneLayout(48, 30, 0, 22),
      windowLayout: {
        lesson: frame(20, 20, 900, 1360, 1),
        "desmos-graph": frame(940, 20, 560, 760, 2),
        "private-notes": frame(1520, 20, 380, 440, 3),
        "formula-sheet": frame(1520, 480, 380, 300, 4),
        "math-blocks": frame(940, 800, 960, 420, 5),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "desmos-graph": { span: "wide" },
        "private-notes": { span: "wide", pinned: true },
        "formula-sheet": { span: "medium" },
        "math-blocks": { span: "wide" },
      },
    },
    {
      enabledModules: ["lesson", "private-notes", "formula-sheet", "desmos-graph", "math-blocks", "saved-graphs"],
      zones: zones(["lesson"], ["desmos-graph", "math-blocks"], [], ["private-notes", "formula-sheet", "saved-graphs"]),
      paneLayout: paneLayout(44, 34, 0, 22),
      windowLayout: {
        lesson: frame(20, 20, 840, 1360, 1),
        "desmos-graph": frame(880, 20, 640, 760, 2),
        "math-blocks": frame(880, 800, 640, 420, 3),
        "private-notes": frame(1540, 20, 360, 420, 4),
        "formula-sheet": frame(1540, 460, 360, 420, 5),
        "saved-graphs": frame(1540, 900, 360, 320, 6),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "desmos-graph": { span: "wide" },
        "math-blocks": { span: "wide" },
        "private-notes": { span: "wide", pinned: true },
        "formula-sheet": { span: "medium" },
        "saved-graphs": { span: "medium" },
      },
    },
  ),
  "math-guided-study": presetStyles(
    {
      enabledModules: ["lesson", "desmos-graph", "formula-sheet", "private-notes", "math-blocks"],
      zones: zones(["lesson", "private-notes"], ["desmos-graph", "math-blocks"], [], ["formula-sheet"]),
      paneLayout: paneLayout(40, 42, 0, 18),
      windowLayout: {
        lesson: frame(20, 20, 760, 660, 1),
        "private-notes": frame(20, 700, 760, 620, 2),
        "desmos-graph": frame(800, 20, 760, 660, 3),
        "math-blocks": frame(800, 700, 760, 420, 4),
        "formula-sheet": frame(1580, 20, 320, 1100, 5),
      },
      moduleLayout: {
        lesson: { span: "wide", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "desmos-graph": { span: "full" },
        "math-blocks": { span: "wide" },
        "formula-sheet": { span: "medium" },
      },
    },
    {
      enabledModules: ["lesson", "desmos-graph", "formula-sheet", "private-notes", "math-blocks", "saved-graphs"],
      zones: zones(["lesson", "formula-sheet"], ["desmos-graph"], ["private-notes", "math-blocks"], ["saved-graphs"]),
      paneLayout: paneLayout(24, 44, 24, 8),
      windowLayout: {
        lesson: frame(20, 20, 460, 520, 1),
        "formula-sheet": frame(20, 560, 460, 520, 2),
        "desmos-graph": frame(500, 20, 840, 900, 3),
        "private-notes": frame(1360, 20, 460, 520, 4),
        "math-blocks": frame(1360, 560, 460, 420, 5),
        "saved-graphs": frame(500, 940, 840, 300, 6),
      },
      moduleLayout: {
        lesson: { span: "medium", pinned: true },
        "formula-sheet": { span: "medium" },
        "desmos-graph": { span: "full" },
        "private-notes": { span: "wide", pinned: true },
        "math-blocks": { span: "wide" },
        "saved-graphs": { span: "wide" },
      },
    },
    {
      enabledModules: ["lesson", "desmos-graph", "formula-sheet", "private-notes", "math-blocks", "saved-graphs", "scientific-calculator"],
      zones: zones(["lesson", "formula-sheet"], ["desmos-graph"], ["private-notes", "math-blocks"], ["saved-graphs", "scientific-calculator"]),
      paneLayout: paneLayout(22, 46, 22, 10),
      windowLayout: {
        lesson: frame(20, 20, 420, 520, 1),
        "formula-sheet": frame(20, 560, 420, 520, 2),
        "desmos-graph": frame(460, 20, 880, 940, 3),
        "private-notes": frame(1360, 20, 420, 500, 4),
        "math-blocks": frame(1360, 540, 420, 420, 5),
        "saved-graphs": frame(460, 980, 640, 300, 6),
        "scientific-calculator": frame(1120, 980, 660, 420, 7),
      },
      moduleLayout: {
        lesson: { span: "medium", pinned: true },
        "formula-sheet": { span: "medium" },
        "desmos-graph": { span: "full" },
        "private-notes": { span: "wide", pinned: true },
        "math-blocks": { span: "wide" },
        "saved-graphs": { span: "medium" },
        "scientific-calculator": { span: "wide" },
      },
    },
  ),
  "math-graph-lab": presetStyles(
    {
      enabledModules: ["desmos-graph", "formula-sheet", "saved-graphs", "lesson", "private-notes"],
      zones: zones(["lesson", "formula-sheet"], ["desmos-graph"], [], ["private-notes", "saved-graphs"]),
      paneLayout: paneLayout(23, 54, 0, 23),
      windowLayout: {
        lesson: frame(20, 20, 420, 420, 1),
        "formula-sheet": frame(20, 460, 420, 420, 2),
        "desmos-graph": frame(460, 20, 1040, 980, 3),
        "private-notes": frame(1520, 20, 380, 500, 4),
        "saved-graphs": frame(1520, 540, 380, 460, 5),
      },
      moduleLayout: {
        "desmos-graph": { span: "full" },
        lesson: { span: "medium", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "formula-sheet": { span: "medium" },
        "saved-graphs": { span: "medium" },
      },
    },
    {
      enabledModules: ["desmos-graph", "formula-sheet", "saved-graphs", "lesson", "private-notes", "math-blocks", "scientific-calculator"],
      zones: zones(["lesson", "formula-sheet"], ["desmos-graph"], ["private-notes", "math-blocks"], ["saved-graphs", "scientific-calculator"]),
      paneLayout: paneLayout(20, 55, 20, 5),
      windowLayout: {
        lesson: frame(20, 20, 380, 360, 1),
        "formula-sheet": frame(20, 400, 380, 480, 2),
        "desmos-graph": frame(420, 20, 1040, 940, 3),
        "private-notes": frame(1480, 20, 420, 420, 4),
        "math-blocks": frame(1480, 460, 420, 500, 5),
        "saved-graphs": frame(420, 980, 500, 320, 6),
        "scientific-calculator": frame(940, 980, 520, 420, 7),
      },
      moduleLayout: {
        "desmos-graph": { span: "full" },
        lesson: { span: "medium", pinned: true },
        "formula-sheet": { span: "medium" },
        "private-notes": { span: "wide", pinned: true },
        "math-blocks": { span: "wide" },
        "saved-graphs": { span: "medium" },
        "scientific-calculator": { span: "medium" },
      },
    },
    {
      enabledModules: ["desmos-graph", "formula-sheet", "saved-graphs", "lesson", "private-notes", "math-blocks", "scientific-calculator"],
      zones: zones(["lesson", "formula-sheet", "saved-graphs"], ["desmos-graph"], ["private-notes", "math-blocks"], ["scientific-calculator"]),
      paneLayout: paneLayout(19, 56, 20, 5),
      windowLayout: {
        lesson: frame(20, 20, 360, 360, 1),
        "formula-sheet": frame(20, 400, 360, 420, 2),
        "saved-graphs": frame(20, 840, 360, 340, 3),
        "desmos-graph": frame(400, 20, 1060, 980, 4),
        "private-notes": frame(1480, 20, 420, 440, 5),
        "math-blocks": frame(1480, 480, 420, 520, 6),
        "scientific-calculator": frame(400, 1020, 1060, 420, 7),
      },
      moduleLayout: {
        "desmos-graph": { span: "full" },
        lesson: { span: "medium", pinned: true },
        "formula-sheet": { span: "medium" },
        "saved-graphs": { span: "medium" },
        "private-notes": { span: "wide", pinned: true },
        "math-blocks": { span: "wide" },
        "scientific-calculator": { span: "wide" },
      },
    },
  ),
  "math-proof-concept": presetStyles(
    {
      enabledModules: ["lesson", "formula-sheet", "related-concepts", "math-blocks", "private-notes"],
      zones: zones(["lesson"], ["formula-sheet"], ["related-concepts", "math-blocks"], ["private-notes"]),
      paneLayout: paneLayout(52, 20, 16, 12),
      windowLayout: {
        lesson: frame(20, 20, 980, 980, 1),
        "formula-sheet": frame(1020, 20, 420, 980, 2),
        "related-concepts": frame(1460, 20, 440, 380, 3),
        "math-blocks": frame(1460, 420, 440, 580, 4),
        "private-notes": frame(20, 1020, 1880, 320, 5),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "formula-sheet": { span: "wide" },
        "related-concepts": { span: "medium" },
        "math-blocks": { span: "wide" },
        "private-notes": { span: "wide", pinned: true },
      },
    },
    {
      enabledModules: ["lesson", "formula-sheet", "related-concepts", "math-blocks", "private-notes", "comments"],
      zones: zones(["lesson"], ["formula-sheet", "related-concepts"], ["math-blocks"], ["private-notes", "comments"]),
      paneLayout: paneLayout(48, 23, 17, 12),
      windowLayout: {
        lesson: frame(20, 20, 920, 1160, 1),
        "formula-sheet": frame(960, 20, 440, 540, 2),
        "related-concepts": frame(960, 580, 440, 360, 3),
        "math-blocks": frame(1420, 20, 480, 920, 4),
        "private-notes": frame(960, 960, 460, 340, 5),
        comments: frame(1440, 960, 460, 340, 6),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "formula-sheet": { span: "wide" },
        "related-concepts": { span: "medium" },
        "math-blocks": { span: "wide" },
        "private-notes": { span: "wide", pinned: true },
        comments: { span: "medium" },
      },
    },
    {
      enabledModules: ["lesson", "formula-sheet", "related-concepts", "math-blocks", "private-notes", "comments", "recent-highlights"],
      zones: zones(["lesson"], ["formula-sheet", "related-concepts"], ["math-blocks"], ["private-notes", "comments", "recent-highlights"]),
      paneLayout: paneLayout(46, 23, 18, 13),
      windowLayout: {
        lesson: frame(20, 20, 880, 1200, 1),
        "formula-sheet": frame(920, 20, 440, 520, 2),
        "related-concepts": frame(920, 560, 440, 360, 3),
        "math-blocks": frame(1380, 20, 520, 900, 4),
        "private-notes": frame(920, 940, 480, 360, 5),
        comments: frame(1420, 940, 230, 360, 6),
        "recent-highlights": frame(1670, 940, 230, 360, 7),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "formula-sheet": { span: "wide" },
        "related-concepts": { span: "medium" },
        "math-blocks": { span: "wide" },
        "private-notes": { span: "wide", pinned: true },
        comments: { span: "medium" },
        "recent-highlights": { span: "medium" },
      },
    },
  ),
  "math-practice-mode": presetStyles(
    {
      enabledModules: ["math-blocks", "formula-sheet", "lesson", "private-notes", "desmos-graph"],
      zones: zones(["formula-sheet", "lesson"], ["math-blocks"], [], ["private-notes", "desmos-graph"]),
      paneLayout: paneLayout(24, 52, 0, 24),
      windowLayout: {
        "formula-sheet": frame(20, 20, 460, 520, 1),
        lesson: frame(20, 560, 460, 460, 2),
        "math-blocks": frame(500, 20, 980, 1000, 3),
        "private-notes": frame(1500, 20, 400, 500, 4),
        "desmos-graph": frame(1500, 540, 400, 480, 5),
      },
      moduleLayout: {
        "math-blocks": { span: "full" },
        "formula-sheet": { span: "medium" },
        lesson: { span: "medium", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "desmos-graph": { span: "wide" },
      },
    },
    {
      enabledModules: ["math-blocks", "formula-sheet", "lesson", "private-notes", "desmos-graph", "scientific-calculator"],
      zones: zones(["formula-sheet", "lesson"], ["math-blocks"], ["private-notes"], ["desmos-graph", "scientific-calculator"]),
      paneLayout: paneLayout(22, 50, 18, 10),
      windowLayout: {
        "formula-sheet": frame(20, 20, 420, 520, 1),
        lesson: frame(20, 560, 420, 420, 2),
        "math-blocks": frame(460, 20, 960, 980, 3),
        "private-notes": frame(1440, 20, 460, 460, 4),
        "desmos-graph": frame(1440, 500, 460, 420, 5),
        "scientific-calculator": frame(460, 1020, 960, 420, 6),
      },
      moduleLayout: {
        "math-blocks": { span: "full" },
        "formula-sheet": { span: "medium" },
        lesson: { span: "medium", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "desmos-graph": { span: "wide" },
        "scientific-calculator": { span: "wide" },
      },
    },
    {
      enabledModules: ["math-blocks", "formula-sheet", "lesson", "private-notes", "desmos-graph", "scientific-calculator", "saved-graphs"],
      zones: zones(["formula-sheet", "lesson", "saved-graphs"], ["math-blocks"], ["private-notes"], ["desmos-graph", "scientific-calculator"]),
      paneLayout: paneLayout(20, 50, 20, 10),
      windowLayout: {
        "formula-sheet": frame(20, 20, 380, 420, 1),
        lesson: frame(20, 460, 380, 380, 2),
        "saved-graphs": frame(20, 860, 380, 300, 3),
        "math-blocks": frame(420, 20, 960, 1040, 4),
        "private-notes": frame(1400, 20, 500, 500, 5),
        "desmos-graph": frame(1400, 540, 500, 440, 6),
        "scientific-calculator": frame(420, 1080, 960, 420, 7),
      },
      moduleLayout: {
        "math-blocks": { span: "full" },
        "formula-sheet": { span: "medium" },
        lesson: { span: "medium", pinned: true },
        "saved-graphs": { span: "medium" },
        "private-notes": { span: "wide", pinned: true },
        "desmos-graph": { span: "wide" },
        "scientific-calculator": { span: "wide" },
      },
    },
  ),
  "full-math-canvas": presetStyles(
    {
      enabledModules: ["lesson", "desmos-graph", "formula-sheet", "math-blocks", "private-notes", "saved-graphs", "scientific-calculator", "related-concepts"],
      zones: zones(["lesson", "formula-sheet"], ["desmos-graph", "math-blocks"], ["private-notes", "related-concepts"], ["saved-graphs", "scientific-calculator"]),
      paneLayout: paneLayout(20, 45, 23, 12),
      windowLayout: {
        lesson: frame(20, 20, 380, 420, 1),
        "formula-sheet": frame(20, 460, 380, 420, 2),
        "desmos-graph": frame(420, 20, 860, 760, 3),
        "math-blocks": frame(420, 800, 860, 360, 4),
        "private-notes": frame(1300, 20, 420, 420, 5),
        "related-concepts": frame(1300, 460, 420, 320, 6),
        "saved-graphs": frame(1740, 20, 160, 420, 7),
        "scientific-calculator": frame(1300, 800, 600, 420, 8),
      },
      moduleLayout: defaultModuleLayout,
    },
    {
      enabledModules: ["lesson", "desmos-graph", "formula-sheet", "math-blocks", "private-notes", "saved-graphs", "scientific-calculator", "related-concepts"],
      zones: zones(["lesson", "formula-sheet", "saved-graphs"], ["desmos-graph"], ["math-blocks", "private-notes"], ["related-concepts", "scientific-calculator"]),
      paneLayout: paneLayout(20, 48, 22, 10),
      windowLayout: {
        lesson: frame(20, 20, 380, 380, 1),
        "formula-sheet": frame(20, 420, 380, 400, 2),
        "saved-graphs": frame(20, 840, 380, 320, 3),
        "desmos-graph": frame(420, 20, 920, 900, 4),
        "math-blocks": frame(1360, 20, 360, 440, 5),
        "private-notes": frame(1360, 480, 360, 440, 6),
        "related-concepts": frame(1740, 20, 160, 440, 7),
        "scientific-calculator": frame(420, 940, 1300, 420, 8),
      },
      moduleLayout: defaultModuleLayout,
    },
    {
      enabledModules: ["lesson", "desmos-graph", "formula-sheet", "math-blocks", "private-notes", "saved-graphs", "scientific-calculator", "related-concepts"],
      zones: zones(["lesson", "formula-sheet", "saved-graphs"], ["desmos-graph"], ["math-blocks", "private-notes"], ["related-concepts", "scientific-calculator"]),
      paneLayout: paneLayout(20, 50, 20, 10),
      windowLayout: {
        lesson: frame(20, 20, 380, 400, 1),
        "formula-sheet": frame(20, 440, 380, 400, 2),
        "saved-graphs": frame(20, 860, 380, 320, 3),
        "desmos-graph": frame(420, 20, 960, 940, 4),
        "math-blocks": frame(1400, 20, 500, 460, 5),
        "private-notes": frame(1400, 500, 500, 460, 6),
        "related-concepts": frame(420, 980, 460, 320, 7),
        "scientific-calculator": frame(900, 980, 1000, 420, 8),
      },
      moduleLayout: defaultModuleLayout,
    },
  ),
  "annotation-mode": presetStyles(
    {
      enabledModules: ["lesson", "private-notes", "comments", "recent-highlights"],
      zones: zones(["lesson"], ["private-notes"], [], ["recent-highlights", "comments"]),
      paneLayout: paneLayout(59, 0, 0, 41),
      windowLayout: {
        lesson: frame(20, 20, 1120, 1380, 1),
        "private-notes": frame(1160, 20, 740, 340, 2),
        "recent-highlights": frame(1160, 380, 740, 320, 3),
        comments: frame(1160, 720, 740, 420, 4),
      },
      moduleLayout: {
        lesson: { span: "full", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "recent-highlights": { span: "wide" },
        comments: { span: "wide" },
      },
    },
    {
      enabledModules: ["lesson-outline", "lesson", "private-notes", "comments", "recent-highlights"],
      zones: zones(["lesson-outline"], ["lesson"], ["private-notes"], ["comments", "recent-highlights"]),
      paneLayout: paneLayout(12, 50, 20, 18),
      windowLayout: {
        "lesson-outline": frame(20, 20, 220, 280, 1),
        lesson: frame(260, 20, 960, 1380, 2),
        "private-notes": frame(1240, 20, 660, 420, 3),
        comments: frame(1240, 480, 310, 360, 4),
        "recent-highlights": frame(1590, 480, 310, 360, 5),
      },
      moduleLayout: {
        "lesson-outline": { span: "narrow" },
        lesson: { span: "full", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        comments: { span: "wide" },
        "recent-highlights": { span: "wide" },
      },
    },
    {
      enabledModules: ["lesson-outline", "lesson", "private-notes", "comments", "recent-highlights", "related-concepts", "search"],
      zones: zones(["lesson-outline"], ["lesson"], ["private-notes", "related-concepts"], ["comments", "recent-highlights", "search"]),
      paneLayout: paneLayout(12, 50, 20, 18),
      windowLayout: {
        "lesson-outline": frame(20, 20, 220, 280, 1),
        search: frame(20, 320, 220, 220, 2),
        lesson: frame(260, 20, 960, 1400, 3),
        "private-notes": frame(1240, 20, 660, 420, 4),
        comments: frame(1240, 480, 310, 360, 5),
        "recent-highlights": frame(1590, 480, 310, 360, 6),
        "related-concepts": frame(1240, 880, 660, 320, 7),
      },
      moduleLayout: {
        "lesson-outline": { span: "narrow" },
        lesson: { span: "full", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "related-concepts": { span: "medium" },
        comments: { span: "medium" },
        "recent-highlights": { span: "medium" },
        search: { span: "narrow" },
      },
    },
  ),
} satisfies Partial<Record<WorkspacePresetId, Record<WorkspaceStyle, WorkspacePresetLayout>>>;

export const workspaceThemes: WorkspaceTheme[] = [
  {
    id: "space",
    name: "Space",
    description: "Dark, focused, and high contrast.",
    vars: {
      background: "225 22% 8%",
      foreground: "42 32% 96%",
      card: "225 18% 11%",
      cardForeground: "42 32% 96%",
      secondary: "225 14% 17%",
      muted: "225 14% 17%",
      mutedForeground: "220 10% 70%",
      border: "225 12% 22%",
      accent: "260 48% 22%",
      primary: "174 67% 48%",
    },
  },
  {
    id: "midnight-scholar",
    name: "Midnight Scholar",
    description: "Late-night study with crisp text.",
    vars: {
      background: "222 24% 10%",
      foreground: "210 30% 96%",
      card: "222 20% 13%",
      cardForeground: "210 30% 96%",
      secondary: "222 16% 18%",
      muted: "222 16% 18%",
      mutedForeground: "218 12% 70%",
      border: "222 14% 24%",
      accent: "220 35% 22%",
      primary: "212 86% 62%",
    },
  },
  {
    id: "paper-studio",
    name: "Paper Studio",
    description: "Warm, editorial, and low glare.",
    vars: {
      background: "42 33% 97%",
      foreground: "220 16% 10%",
      card: "0 0% 100%",
      cardForeground: "220 16% 10%",
      secondary: "40 24% 92%",
      muted: "40 24% 92%",
      mutedForeground: "225 7% 43%",
      border: "38 22% 84%",
      accent: "176 37% 90%",
      primary: "172 82% 27%",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool blues and calm contrast.",
    vars: {
      background: "196 44% 96%",
      foreground: "210 30% 12%",
      card: "0 0% 100%",
      cardForeground: "210 30% 12%",
      secondary: "198 34% 90%",
      muted: "198 34% 90%",
      mutedForeground: "207 14% 42%",
      border: "198 26% 80%",
      accent: "186 44% 88%",
      primary: "193 86% 32%",
    },
  },
  {
    id: "monochrome-pro",
    name: "Monochrome Pro",
    description: "Neutral, serious, and quiet.",
    vars: {
      background: "0 0% 97%",
      foreground: "0 0% 8%",
      card: "0 0% 100%",
      cardForeground: "0 0% 8%",
      secondary: "0 0% 92%",
      muted: "0 0% 92%",
      mutedForeground: "0 0% 42%",
      border: "0 0% 84%",
      accent: "0 0% 88%",
      primary: "0 0% 12%",
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Colorful accents without visual noise.",
    vars: {
      background: "248 38% 97%",
      foreground: "246 24% 12%",
      card: "0 0% 100%",
      cardForeground: "246 24% 12%",
      secondary: "250 32% 92%",
      muted: "250 32% 92%",
      mutedForeground: "250 10% 44%",
      border: "250 22% 84%",
      accent: "318 48% 91%",
      primary: "267 74% 48%",
    },
  },
  {
    id: "custom",
    name: "Custom",
    description: "A personal three-color palette used across app, study, and canvas views.",
    vars: {
      background: "42 33% 97%",
      foreground: "220 16% 10%",
      card: "0 0% 100%",
      cardForeground: "220 16% 10%",
      secondary: "40 24% 92%",
      muted: "40 24% 92%",
      mutedForeground: "225 7% 43%",
      border: "38 22% 84%",
      accent: "176 37% 90%",
      primary: "172 82% 27%",
    },
  },
];

export const accentOptions: Array<{
  id: Exclude<AccentColor, "custom">;
  name: string;
  value: string;
  hex: string;
}> = [
  { id: "teal", name: "Teal", value: "172 82% 27%", hex: "#0f766e" },
  { id: "blue", name: "Blue", value: "212 86% 52%", hex: "#2563eb" },
  { id: "indigo", name: "Indigo", value: "233 74% 55%", hex: "#4f46e5" },
  { id: "violet", name: "Violet", value: "267 74% 48%", hex: "#7e22ce" },
  { id: "rose", name: "Rose", value: "342 76% 48%", hex: "#d61f69" },
  { id: "amber", name: "Amber", value: "35 92% 48%", hex: "#eb8a0f" },
  { id: "emerald", name: "Emerald", value: "160 84% 32%", hex: "#0d9668" },
  { id: "graphite", name: "Graphite", value: "0 0% 12%", hex: "#1f1f1f" },
];

const defaultAccentByTheme: Record<WorkspaceThemeId, AccentColor> = {
  space: "teal",
  "midnight-scholar": "blue",
  "paper-studio": "teal",
  ocean: "blue",
  "monochrome-pro": "graphite",
  aurora: "violet",
  custom: "custom",
};

export const defaultCustomPalette: AppearanceCustomPalette = {
  primary: "#0f766e",
  secondary: "#f8fafc",
  accent: "#d97706",
  sourceTheme: "paper-studio",
};

export const densityOptions: WorkspaceDensity[] = ["compact", "cozy"];
export const roundnessOptions: WorkspaceRoundness[] = ["soft", "round", "pill"];
export const shadowOptions: WorkspaceShadow[] = ["quiet", "lifted", "glow"];
export const fontOptions: WorkspaceFont[] = ["system", "humanist", "serif", "editorial", "mono"];
export const backgroundStyleOptions: WorkspaceBackgroundStyle[] = [
  "none",
  "subtle-grid",
  "graph-paper",
  "dot-grid",
];
export const animationLevelOptions: WorkspaceAnimationLevel[] = ["none", "subtle", "full"];
export const graphAppearanceOptions: WorkspaceGraphAppearance[] = ["sync", "light", "dark"];
export const graphChromeOptions: WorkspaceGraphChrome[] = ["standard", "focused"];
export const verticalSpaceOptions: WorkspaceVerticalSpace[] = [
  "fit",
  "balanced",
  "extended",
  "infinite",
];

const storageKey = (userId: string, binderId: string) =>
  `binder-notes:workspace:v1:${userId}:${binderId}`;
const globalThemeStorageKey = "binder-notes:theme:v1";

const defaultPreset =
  workspacePresets.find((preset) => preset.id === "split-study") ?? workspacePresets[0];
const defaultTheme = workspaceThemes.find((theme) => theme.id === "paper-studio") ?? workspaceThemes[0];

type HslColor = { h: number; s: number; l: number };
type StudySurfaceVars = {
  bg: string;
  surface: string;
  soft: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accentText: string;
};

const hexColorPattern = /^#[0-9a-f]{6}$/i;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(value: unknown, fallback: string) {
  return typeof value === "string" && hexColorPattern.test(value) ? value.toLowerCase() : fallback;
}

function normalizeSourceTheme(value: unknown, fallback: WorkspaceThemeId = "paper-studio") {
  return typeof value === "string" && workspaceThemes.some((theme) => theme.id === value)
    ? (value as WorkspaceThemeId)
    : fallback;
}

function normalizeCustomPalette(
  palette?: Partial<AppearanceCustomPalette> | null,
): AppearanceCustomPalette {
  return {
    primary: normalizeHexColor(palette?.primary, defaultCustomPalette.primary),
    secondary: normalizeHexColor(palette?.secondary, defaultCustomPalette.secondary),
    accent: normalizeHexColor(palette?.accent, defaultCustomPalette.accent),
    sourceTheme: normalizeSourceTheme(palette?.sourceTheme, defaultCustomPalette.sourceTheme),
  };
}

function hexToHsl(hex: string): HslColor {
  const normalized = normalizeHexColor(hex, defaultCustomPalette.primary);
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue =
    max === red
      ? (green - blue) / delta + (green < blue ? 6 : 0)
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  hue /= 6;

  return {
    h: Math.round(hue * 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

function hslParts(color: HslColor) {
  return `${Math.round(color.h)} ${Math.round(color.s)}% ${Math.round(color.l)}%`;
}

function parseHslParts(parts: string, fallback: HslColor = hexToHsl(defaultCustomPalette.primary)): HslColor {
  const match = parts.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  if (!match) {
    return fallback;
  }

  return {
    h: clampNumber(Number(match[1]), 0, 360),
    s: clampNumber(Number(match[2]), 0, 100),
    l: clampNumber(Number(match[3]), 0, 100),
  };
}

function hslToHex(color: HslColor) {
  const h = color.h / 360;
  const s = color.s / 100;
  const l = color.l / 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channels =
    s === 0
      ? [l, l, l]
      : [
          hueToRgb(p, q, h + 1 / 3),
          hueToRgb(p, q, h),
          hueToRgb(p, q, h - 1 / 3),
        ];

  return `#${channels
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hslPartsToHex(parts: string) {
  return hslToHex(parseHslParts(parts));
}

function adjustHsl(color: HslColor, lightness: number, saturationLimit = 100) {
  return hslParts({
    h: color.h,
    s: clampNumber(color.s, 0, saturationLimit),
    l: clampNumber(lightness, 0, 100),
  });
}

function hslLightness(parts: string) {
  return Number(parts.match(/(\d+)%$/)?.[1] ?? 50);
}

function themeVarsAreDark(themeVars: WorkspaceTheme["vars"]) {
  return hslLightness(themeVars.background) < 30;
}

function softAccentForThemeVars(themeVars: WorkspaceTheme["vars"], accent: HslColor) {
  return adjustHsl(accent, themeVarsAreDark(themeVars) ? 22 : 90, 70);
}

function applyAccentToThemeVars(
  themeVars: WorkspaceTheme["vars"],
  accentValue: string,
): WorkspaceTheme["vars"] {
  const accent = parseHslParts(accentValue);

  return {
    ...themeVars,
    primary: accentValue,
    accent: softAccentForThemeVars(themeVars, accent),
  };
}

function buildCustomThemeVars(palette: AppearanceCustomPalette): WorkspaceTheme["vars"] {
  const primary = hexToHsl(palette.primary);
  const secondary = hexToHsl(palette.secondary);
  const accent = hexToHsl(palette.accent);
  const isDark = secondary.l < 45;

  return {
    background: adjustHsl(secondary, isDark ? 8 : 97, 48),
    foreground: isDark ? "42 32% 96%" : "220 18% 10%",
    card: adjustHsl(secondary, isDark ? 12 : 99, 36),
    cardForeground: isDark ? "42 32% 96%" : "220 18% 10%",
    secondary: adjustHsl(secondary, isDark ? 18 : 92, 54),
    muted: adjustHsl(secondary, isDark ? 18 : 92, 42),
    mutedForeground: isDark ? "214 13% 72%" : "220 9% 40%",
    border: adjustHsl(secondary, isDark ? 25 : 84, 42),
    accent: adjustHsl(accent, isDark ? 24 : 90, 70),
    primary: hslParts({
      h: primary.h,
      s: clampNumber(primary.s, 40, 90),
      l: isDark ? clampNumber(primary.l, 54, 70) : clampNumber(primary.l, 28, 48),
    }),
  };
}

function buildStudySurfaceVars(
  surface: SimplePresentationTheme,
  themeVars: WorkspaceTheme["vars"],
  palette: AppearanceCustomPalette,
): StudySurfaceVars {
  const appIsDark = themeVarsAreDark(themeVars);
  const primary = hexToHsl(palette.primary);
  const secondary = hexToHsl(palette.secondary);
  const accent = hexToHsl(palette.accent);
  const customSurfaceIsDark = secondary.l < 45;
  const appAccent = themeVars.primary;
  const appAccentSoft = themeVars.accent;

  switch (surface) {
    case "match":
      return {
        bg: themeVars.background,
        surface: themeVars.card,
        soft: themeVars.secondary,
        line: themeVars.border,
        text: themeVars.foreground,
        muted: themeVars.mutedForeground,
        accent: appAccent,
        accentSoft: appAccentSoft,
        accentText: appIsDark ? "220 16% 8%" : "0 0% 100%",
      };
    case "warm-paper":
      return {
        bg: "42 42% 96%",
        surface: "48 38% 98%",
        soft: "42 24% 90%",
        line: "38 22% 78%",
        text: "222 24% 13%",
        muted: "222 12% 36%",
        accent: appAccent,
        accentSoft: appAccentSoft,
        accentText: appIsDark ? "220 16% 8%" : "0 0% 100%",
      };
    case "night-study":
      return {
        bg: "220 18% 8%",
        surface: "220 16% 11%",
        soft: "220 12% 16%",
        line: "220 11% 26%",
        text: "42 32% 96%",
        muted: "215 12% 72%",
        accent: appAccent,
        accentSoft: appAccentSoft,
        accentText: "220 18% 8%",
      };
    case "history-gold":
      return {
        bg: "44 48% 96%",
        surface: "48 42% 98%",
        soft: "42 26% 90%",
        line: "42 24% 76%",
        text: "224 24% 12%",
        muted: "224 12% 36%",
        accent: "38 88% 42%",
        accentSoft: "43 80% 84%",
        accentText: "36 90% 18%",
      };
    case "math-blue":
      return {
        bg: "210 32% 97%",
        surface: "0 0% 100%",
        soft: "210 25% 92%",
        line: "207 22% 78%",
        text: "221 28% 12%",
        muted: "220 12% 37%",
        accent: "207 84% 42%",
        accentSoft: "207 64% 88%",
        accentText: "210 84% 20%",
      };
    case "high-contrast":
      return {
        bg: "0 0% 100%",
        surface: "0 0% 100%",
        soft: "0 0% 92%",
        line: "0 0% 0%",
        text: "0 0% 0%",
        muted: "0 0% 18%",
        accent: "0 0% 0%",
        accentSoft: "54 100% 80%",
        accentText: "0 0% 0%",
      };
    case "custom":
      return {
        bg: adjustHsl(secondary, customSurfaceIsDark ? 8 : 97, 48),
        surface: adjustHsl(secondary, customSurfaceIsDark ? 12 : 99, 36),
        soft: adjustHsl(accent, customSurfaceIsDark ? 18 : 92, 54),
        line: adjustHsl(secondary, customSurfaceIsDark ? 26 : 84, 42),
        text: customSurfaceIsDark ? "42 32% 96%" : "220 18% 10%",
        muted: customSurfaceIsDark ? "214 13% 72%" : "220 9% 40%",
        accent: hslParts({
          h: primary.h,
          s: clampNumber(primary.s, 40, 90),
          l: customSurfaceIsDark ? clampNumber(primary.l, 54, 70) : clampNumber(primary.l, 28, 48),
        }),
        accentSoft: adjustHsl(accent, customSurfaceIsDark ? 24 : 90, 70),
        accentText: customSurfaceIsDark ? "220 16% 8%" : "0 0% 100%",
      };
    case "classic-light":
    default:
      return {
        bg: "205 26% 98%",
        surface: "0 0% 100%",
        soft: "200 20% 94%",
        line: "214 22% 84%",
        text: "220 26% 12%",
        muted: "218 12% 38%",
        accent: appAccent,
        accentSoft: appAccentSoft,
        accentText: appIsDark ? "220 16% 8%" : "0 0% 100%",
      };
  }
}

function appearanceMotionFromAnimationLevel(level: WorkspaceAnimationLevel): AppearanceMotion {
  if (level === "full") {
    return "full";
  }

  return level === "subtle" ? "reduced" : "minimal";
}

function animationLevelFromAppearanceMotion(motion: AppearanceMotion): WorkspaceAnimationLevel {
  if (motion === "full") {
    return "full";
  }

  return motion === "reduced" ? "subtle" : "none";
}

function simpleMotionFromAppearanceMotion(motion: AppearanceMotion): SimplePresentationMotion {
  return motion === "full" ? "standard" : "reduced";
}

function accentForStudySurface(
  surface: SimplePresentationTheme,
  fallback: SimplePresentationSettings["accentColor"],
) {
  if (surface === "history-gold") {
    return "history-gold";
  }

  if (surface === "math-blue" || surface === "custom") {
    return "math-blue";
  }

  return fallback;
}

function normalizeAccentColor(value: unknown, fallback: AccentColor = "custom") {
  return typeof value === "string" &&
    (value === "custom" || accentOptions.some((option) => option.id === value))
    ? (value as AccentColor)
    : fallback;
}

function accentOptionById(accentColor: AccentColor) {
  return accentColor === "custom"
    ? undefined
    : accentOptions.find((option) => option.id === accentColor);
}

function findBuiltinSourceTheme(themeId?: WorkspaceThemeId) {
  return (
    workspaceThemes.find((theme) => theme.id === themeId && theme.id !== "custom") ??
    defaultTheme
  );
}

function buildPaletteFromSourceTheme(
  theme: WorkspaceTheme,
  accentHex = hslPartsToHex(theme.vars.accent),
): AppearanceCustomPalette {
  return {
    primary: hslPartsToHex(theme.vars.primary),
    secondary: hslPartsToHex(theme.vars.background),
    accent: accentHex,
    sourceTheme: theme.id,
  };
}

function repairLegacyAccentAsPrimaryPalette(
  themeId: WorkspaceThemeId,
  accentColor: AccentColor,
  palette: AppearanceCustomPalette,
) {
  if (themeId !== "custom") {
    return palette;
  }

  const option = accentOptionById(accentColor);
  if (!option || palette.primary.toLowerCase() !== option.hex.toLowerCase()) {
    return palette;
  }

  const sourceTheme = findBuiltinSourceTheme(
    normalizeSourceTheme(palette.sourceTheme, defaultTheme.id),
  );

  return {
    ...palette,
    primary: hslPartsToHex(sourceTheme.vars.primary),
    accent: option.hex,
    sourceTheme: sourceTheme.id,
  };
}

function accentColorForTheme(themeId: WorkspaceThemeId) {
  return defaultAccentByTheme[themeId] ?? "custom";
}

function accentColorForValue(value?: string, fallback: AccentColor = "custom") {
  return accentOptions.find((option) => option.value === value)?.id ?? fallback;
}

export function createCustomThemeFromAccent(
  current: WorkspaceThemeSettings,
  accentColor: AccentColor,
): WorkspaceThemeSettings {
  const option = accentOptionById(accentColor);
  if (!option) {
    return normalizeThemeSettings({
      ...current,
      id: "custom",
      accentColor: "custom",
    });
  }

  const normalized = normalizeThemeSettings(current);
  const sourceThemeId =
    normalized.id === "custom"
      ? normalizeSourceTheme(normalized.customPalette?.sourceTheme, "paper-studio")
      : normalized.id;
  const sourceTheme = findBuiltinSourceTheme(sourceThemeId);
  const nextPalette =
    normalized.id === "custom"
      ? {
          ...normalizeCustomPalette(normalized.customPalette),
          accent: option.hex,
          sourceTheme: normalized.customPalette?.sourceTheme ?? sourceTheme.id,
        }
      : buildPaletteFromSourceTheme(sourceTheme, option.hex);

  return normalizeThemeSettings({
    ...normalized,
    id: "custom",
    accent: hslParts(hexToHsl(nextPalette.primary)),
    accentColor: option.id,
    customPalette: nextPalette,
  });
}

export function createThemeFromAppTheme(
  current: WorkspaceThemeSettings,
  themeId: WorkspaceThemeId,
): WorkspaceThemeSettings {
  const selectedTheme =
    workspaceThemes.find((theme) => theme.id === themeId) ??
    workspaceThemes.find((theme) => theme.id === defaultThemeSettings.id) ??
    defaultTheme;

  return normalizeThemeSettings({
    ...current,
    id: selectedTheme.id,
    accent: selectedTheme.vars.primary,
    accentColor: accentColorForTheme(selectedTheme.id),
    customPalette:
      selectedTheme.id === "custom"
        ? current.customPalette
        : {
            ...(current.customPalette ?? defaultCustomPalette),
            sourceTheme: selectedTheme.id,
          },
  });
}

export function resolveWorkspacePresetLayout(
  presetId: WorkspacePresetId,
  workspaceStyle: WorkspaceStyle,
  suiteTemplateId?: string | null,
): WorkspacePresetLayout {
  const gridDefinition = getPresetDefinition(presetId, suiteTemplateId);
  if (gridDefinition) {
    const breakpointLayout =
      gridDefinition.breakpoints.desktop ??
      gridDefinition.breakpoints.tablet ??
      gridDefinition.breakpoints.mobile;

    if (breakpointLayout) {
      const enabledModules = breakpointLayout.items.map((item) => item.panelId);
      return applyPresetVisibilityProfile({
        enabledModules,
        zones: buildZonesFromGridLayout(enabledModules),
        paneLayout: buildPaneLayoutFromGrid(enabledModules),
        windowLayout: gridLayoutToWindowFrames(breakpointLayout),
        moduleLayout: buildModuleLayoutFromGrid(enabledModules, breakpointLayout),
      }, presetId);
    }
  }

  const baseLayout =
    workspacePresetLayouts[presetId]?.[workspaceStyle] ??
    workspacePresetLayouts[defaultPreset.id]?.[workspaceStyle] ??
    workspacePresetLayouts[defaultPreset.id]?.guided;

  if (!baseLayout) {
    throw new Error(`Workspace preset layout is missing for ${presetId}.`);
  }

  return applyPresetVisibilityProfile(
    packPresetWindowLayout(baseLayout, workspaceStyle),
    presetId,
  );
}

function applyPresetVisibilityProfile(
  layout: WorkspacePresetLayout,
  presetId: WorkspacePresetId,
  availability: WorkspacePresetRuntimeAvailability = detectWorkspacePresetRuntimeAvailability(),
): WorkspacePresetLayout {
  const design = getAvailablePresetDesign(presetId, availability);
  if (!design) {
    return layout;
  }

  const visibleModules = design.defaultVisible.filter(isRegisteredModule);
  const collapsedModules = design.collapsedByDefault.filter(
    (moduleId) => isRegisteredModule(moduleId) && !visibleModules.includes(moduleId),
  );
  const leftoverModules = layout.enabledModules.filter(
    (moduleId) => !visibleModules.includes(moduleId) && !collapsedModules.includes(moduleId),
  );
  const enabledModules = appendUnique([...visibleModules, ...collapsedModules], leftoverModules);
  const moduleLayout = {
    ...layout.moduleLayout,
  };

  enabledModules.forEach((moduleId) => {
    const base = moduleLayout[moduleId] ?? defaultModuleLayout[moduleId] ?? { span: "auto" as WorkspaceModuleSpan };
    moduleLayout[moduleId] = {
      ...base,
      collapsed: !visibleModules.includes(moduleId),
    };
  });

  return {
    ...layout,
    enabledModules,
    moduleLayout,
  };
}

function applyPresetVisibilityToPreferences(
  preferences: WorkspacePreferences,
  viewport?: { width: number; height: number },
  availability: WorkspacePresetRuntimeAvailability = detectWorkspacePresetRuntimeAvailability(),
): WorkspacePreferences {
  const design = getAvailablePresetDesign(preferences.preset, availability);
  if (!design) {
    return preferences;
  }

  const visibleModules = (
    viewport
      ? selectWorkspacePresetVisibleModules(preferences.preset, {
          availability,
          viewport,
        })
      : design.defaultVisible
  ).filter(isRegisteredModule);
  const collapsedModules = design.collapsedByDefault.filter(
    (moduleId) => isRegisteredModule(moduleId) && !visibleModules.includes(moduleId),
  );
  const leftoverModules = preferences.enabledModules.filter(
    (moduleId) => !visibleModules.includes(moduleId) && !collapsedModules.includes(moduleId),
  );
  const enabledModules = appendUnique([...visibleModules, ...collapsedModules], leftoverModules);
  let changed =
    enabledModules.length !== preferences.enabledModules.length ||
    enabledModules.some((moduleId, index) => preferences.enabledModules[index] !== moduleId);
  const moduleLayout = { ...preferences.moduleLayout };

  enabledModules.forEach((moduleId) => {
    const shouldCollapse = !visibleModules.includes(moduleId);
    const current = moduleLayout[moduleId] ?? defaultModuleLayout[moduleId] ?? { span: "auto" as WorkspaceModuleSpan };
    if (current.collapsed !== shouldCollapse) {
      changed = true;
    }
    moduleLayout[moduleId] = {
      ...current,
      collapsed: shouldCollapse,
    };
  });

  if (!changed) {
    return preferences;
  }

  return ensureWindowFramesForEnabledModules({
    ...preferences,
    enabledModules,
    moduleLayout,
    updatedAt: new Date().toISOString(),
  });
}

function getAvailablePresetDesign(
  presetId: WorkspacePresetId,
  availability: WorkspacePresetRuntimeAvailability,
) {
  const design = getWorkspacePresetDesign(presetId);
  return design ? applyWorkspacePresetDesignAvailability(design, availability) : null;
}

function detectWorkspacePresetRuntimeAvailability(): WorkspacePresetRuntimeAvailability {
  return {
    desmosApiKeyAvailable: hasDesmosApiKey(),
  };
}

function isRegisteredModule(moduleId: WorkspaceModuleId) {
  return workspaceModules.some((module) => module.id === moduleId);
}

function buildZonesFromGridLayout(enabledModules: WorkspaceModuleId[]) {
  const hasLesson = enabledModules.includes("lesson");
  const hasTimeline = enabledModules.includes("history-timeline");
  const hasEvidence = enabledModules.includes("history-evidence");
  const hasArgument = enabledModules.includes("history-argument");
  const hasMyth = enabledModules.includes("history-myth-checks");

  const leftRail: WorkspaceModuleId[] = [];
  const centerLeft: WorkspaceModuleId[] = [];
  const centerRight: WorkspaceModuleId[] = [];
  const rightRail: WorkspaceModuleId[] = [];
  const bottom: WorkspaceModuleId[] = [];

  if (hasLesson) {
    leftRail.push("lesson");
  }
  if (hasTimeline) {
    centerLeft.push("history-timeline");
  }
  if (hasEvidence) {
    if (centerRight.length === 0) {
      centerRight.push("history-evidence");
    } else {
      rightRail.push("history-evidence");
    }
  }
  if (hasArgument) {
    if (centerRight.length === 0) {
      centerRight.push("history-argument");
    } else {
      bottom.push("history-argument");
    }
  }
  if (hasMyth) {
    rightRail.push("history-myth-checks");
  }

  enabledModules.forEach((moduleId) => {
    if (
      !leftRail.includes(moduleId) &&
      !centerLeft.includes(moduleId) &&
      !centerRight.includes(moduleId) &&
      !rightRail.includes(moduleId) &&
      !bottom.includes(moduleId)
    ) {
      bottom.push(moduleId);
    }
  });

  return zones(leftRail, centerLeft, centerRight, rightRail, bottom);
}

function buildPaneLayoutFromGrid(enabledModules: WorkspaceModuleId[]) {
  if (enabledModules.includes("lesson")) {
    return paneLayout(22, 38, 24, 16);
  }

  if (enabledModules.includes("history-timeline") && enabledModules.includes("history-argument")) {
    return paneLayout(0, 56, 28, 16);
  }

  return paneLayout(0, 60, 24, 16);
}

function buildModuleLayoutFromGrid(
  enabledModules: WorkspaceModuleId[],
  layout: Parameters<typeof gridLayoutToWindowFrames>[0],
): WorkspacePreferences["moduleLayout"] {
  const byPanel = new Map(layout.items.map((item) => [item.panelId, item]));
  return Object.fromEntries(
    enabledModules.map((moduleId) => {
      const item = byPanel.get(moduleId);
      const span =
        !item
          ? "auto"
          : item.w >= Math.max(8, layout.columns * 0.6)
            ? "full"
            : item.w >= Math.max(6, layout.columns * 0.45)
              ? "wide"
              : item.w >= Math.max(4, layout.columns * 0.3)
                ? "medium"
                : "narrow";
      return [
        moduleId,
        {
          ...(defaultModuleLayout[moduleId] ?? { span: "auto" as WorkspaceModuleSpan }),
          span,
          pinned: true,
        },
      ];
    }),
  ) as WorkspacePreferences["moduleLayout"];
}

export const defaultThemeSettings: WorkspaceThemeSettings = {
  id: defaultTheme.id,
  studySurface: "match",
  accent: defaultTheme.vars.primary,
  accentColor: accentColorForTheme(defaultTheme.id),
  density: "cozy",
  roundness: "round",
  shadow: "lifted",
  font: "system",
  backgroundStyle: "subtle-grid",
  hoverMotion: false,
  snapMode: false,
  focusMode: false,
  compactMode: true,
  animationLevel: "none",
  graphAppearance: "sync",
  graphChrome: "standard",
  verticalSpace: "balanced",
  defaultHighlightColor: "yellow",
  reducedChrome: true,
  showUtilityUi: false,
  customPalette: defaultCustomPalette,
};

export function createDefaultSimplePresentationSettings(
  binderId?: string | null,
  suiteTemplateId?: string | null,
): SimplePresentationSettings {
  const isHistory =
    systemSuiteTemplates.some((suite) => suite.id === suiteTemplateId && suite.history_mode) ||
    binderId === SYSTEM_BINDER_IDS.frenchRevolution ||
    binderId === SYSTEM_BINDER_IDS.riseOfRome;

  return {
    theme: "match",
    fontSize: "medium",
    readingWidth: "comfortable",
    showSideNotes: true,
    showProgressBar: true,
    showStudyDrawer: true,
    accentColor: isHistory ? "history-gold" : "math-blue",
    motion: "reduced",
    focusMode: false,
    highContrast: false,
  };
}

export function createDefaultModularStudySettings(
  selectedPreset: WorkspacePresetId = defaultPreset.id,
): ModularStudySettings {
  return {
    selectedPreset,
    panelDensity: "comfortable",
    moduleVisibility: {},
    sidePanelPosition: "right",
    motionLevel: defaultThemeSettings.animationLevel,
    colorPreset: defaultThemeSettings.id,
    saveLayoutPerBinder: true,
  };
}

export function createDefaultFullCanvasSettings(): FullCanvasSettings {
  return {
    gridSize: 24,
    snapBehavior: "off",
    panelPositions: {},
    customModules: [],
    safeEdgePadding: false,
    canvasHeight: WINDOW_CANVAS_MIN_HEIGHT,
    showDiagnostics: false,
  };
}

export function createDefaultAppearanceSettings(
  binderId?: string | null,
  suiteTemplateId?: string | null,
  theme: WorkspaceThemeSettings = loadGlobalThemeSettings(),
): AppearanceSettings {
  const simple = createDefaultSimplePresentationSettings(binderId, suiteTemplateId);
  const studySurface = isStudySurfaceTheme(theme.studySurface)
    ? theme.studySurface
    : simple.theme;

  return {
    appTheme: theme.id,
    accent: theme.accentColor ?? accentColorForValue(theme.accent, accentColorForTheme(theme.id)),
    studySurface,
    density: theme.density,
    roundness: theme.roundness,
    motion: appearanceMotionFromAnimationLevel(theme.animationLevel),
    customPalette: normalizeCustomPalette(theme.customPalette),
    saveLocalAppearance: false,
  };
}

export function createDefaultWorkspacePreferences(
  userId: string,
  binderId: string,
  suiteTemplateId?: string | null,
): WorkspacePreferences {
  const initialPreset: WorkspacePresetId =
    systemSuiteTemplates.find((suite) => suite.id === suiteTemplateId)?.default_preset_id ??
    (binderId === SYSTEM_BINDER_IDS.frenchRevolution || binderId === SYSTEM_BINDER_IDS.riseOfRome
      ? "history-guided"
      : defaultPreset.id);
  const defaultLayout = resolveWorkspacePresetLayout(initialPreset, "guided", suiteTemplateId);
  const theme = loadGlobalThemeSettings();
  const simple = createDefaultSimplePresentationSettings(binderId, suiteTemplateId);
  const appearance = createDefaultAppearanceSettings(binderId, suiteTemplateId, theme);

  return ensureWindowFramesForEnabledModules({
    version: 1,
    userId,
    binderId,
    suiteTemplateId: suiteTemplateId ?? null,
    activeMode: "simple",
    appearance,
    simple,
    modular: createDefaultModularStudySettings(initialPreset),
    canvas: createDefaultFullCanvasSettings(),
    locked: true,
    workspaceStyle: "guided",
    styleChoiceCompleted: false,
    preset: initialPreset,
    enabledModules: defaultLayout.enabledModules,
    zones: defaultLayout.zones,
    paneLayout: defaultLayout.paneLayout,
    moduleLayout: {
      ...defaultModuleLayout,
      ...defaultLayout.moduleLayout,
    },
    windowLayout: defaultLayout.windowLayout ?? {},
    stickyNotes: {},
    viewportFit: undefined,
    theme: normalizeThemeSettings({
      ...theme,
      studySurface: appearance.studySurface,
    }),
    updatedAt: new Date().toISOString(),
  });
}

export function applyPreset(
  preferences: WorkspacePreferences,
  presetId: WorkspacePresetId,
): WorkspacePreferences {
  const preset = workspacePresets.find((candidate) => candidate.id === presetId) ?? defaultPreset;
  const layout = resolveWorkspacePresetLayout(
    preset.id,
    preferences.workspaceStyle,
    preferences.suiteTemplateId,
  );

  return ensureWindowFramesForEnabledModules({
    ...preferences,
    preset: preset.id,
    modular: {
      ...preferences.modular,
      selectedPreset: preset.id,
    },
    enabledModules: layout.enabledModules,
    zones: layout.zones,
    paneLayout: layout.paneLayout,
    moduleLayout: {
      ...defaultModuleLayout,
      ...preferences.moduleLayout,
      ...layout.moduleLayout,
    },
    windowLayout: layout.windowLayout ?? {},
    updatedAt: new Date().toISOString(),
  });
}

export function applyPresetToViewport(
  preferences: WorkspacePreferences,
  presetId: WorkspacePresetId,
  viewport: { width: number; height: number },
): WorkspacePreferences {
  return fitWorkspaceToViewport(applyPreset(preferences, presetId), viewport, { force: true });
}

export function applyWorkspaceModeToViewport(
  preferences: WorkspacePreferences,
  workspaceMode: WorkspaceMode,
  viewport: { width: number; height: number },
): WorkspacePreferences {
  const next = applyWorkspaceMode(preferences, workspaceMode);
  return next.activeMode === "simple"
    ? next
    : fitWorkspaceToViewport(next, viewport, { force: true });
}

export function applyFocusModeToViewport(
  preferences: WorkspacePreferences,
  focusMode: boolean,
  viewport?: { width: number; height: number },
): WorkspacePreferences {
  const next: WorkspacePreferences = {
    ...preferences,
    simple:
      preferences.activeMode === "simple"
        ? {
            ...preferences.simple,
            focusMode,
          }
        : preferences.simple,
    theme:
      preferences.activeMode === "simple"
        ? preferences.theme
        : {
            ...preferences.theme,
            focusMode,
          },
    updatedAt: new Date().toISOString(),
  };

  if (!focusMode || preferences.activeMode === "simple" || !preferences.locked || !viewport) {
    return normalizeWorkspacePreferences(next);
  }

  return fitWorkspaceToViewport(next, viewport, { force: true });
}

export function applyWorkspaceStyle(
  preferences: WorkspacePreferences,
  workspaceStyle: WorkspaceStyle,
): WorkspacePreferences {
  const nextBase: WorkspacePreferences = {
    ...preferences,
    workspaceStyle,
    styleChoiceCompleted: true,
    locked: true,
    updatedAt: new Date().toISOString(),
  };

  return applyPreset(nextBase, nextBase.preset ?? defaultPreset.id);
}

export function updateWorkspaceAppearance(
  preferences: WorkspacePreferences,
  patch: Partial<AppearanceSettings>,
): WorkspacePreferences {
  let themeForAppearance = normalizeThemeSettings({
    ...preferences.theme,
    studySurface: patch.studySurface ?? preferences.theme.studySurface ?? preferences.simple.theme,
    density: patch.density ?? preferences.theme.density,
    roundness: patch.roundness ?? preferences.theme.roundness,
    animationLevel: patch.motion
      ? animationLevelFromAppearanceMotion(patch.motion)
      : preferences.theme.animationLevel,
    customPalette: patch.customPalette ?? preferences.theme.customPalette,
  });

  if (patch.appTheme) {
    themeForAppearance = createThemeFromAppTheme(themeForAppearance, patch.appTheme);
  }

  if (patch.customPalette && (patch.appTheme === "custom" || themeForAppearance.id === "custom")) {
    themeForAppearance = normalizeThemeSettings({
      ...themeForAppearance,
      id: "custom",
      accent: hslParts(hexToHsl(patch.customPalette.primary)),
      accentColor: "custom",
      customPalette: patch.customPalette,
    });
  } else if (patch.customPalette) {
    themeForAppearance = normalizeThemeSettings({
      ...themeForAppearance,
      customPalette: patch.customPalette,
    });
  }

  if (patch.accent) {
    themeForAppearance = createCustomThemeFromAccent(themeForAppearance, patch.accent);
  }

  const nextAppearance = normalizeAppearanceSettings(
    {
      ...(preferences.appearance ?? createDefaultAppearanceSettings(preferences.binderId, preferences.suiteTemplateId)),
      ...patch,
      appTheme: themeForAppearance.id,
      accent: themeForAppearance.accentColor,
      customPalette: themeForAppearance.customPalette,
    },
    themeForAppearance,
    preferences.simple,
    preferences.binderId,
    preferences.suiteTemplateId,
  );
  const nextTheme = normalizeThemeSettings({
    ...preferences.theme,
    id: nextAppearance.appTheme,
    studySurface: nextAppearance.studySurface,
    accent: themeForAppearance.accent,
    accentColor: nextAppearance.accent,
    density: nextAppearance.density,
    roundness: nextAppearance.roundness,
    animationLevel: animationLevelFromAppearanceMotion(nextAppearance.motion),
    customPalette: nextAppearance.customPalette,
  });
  const nextSimple = normalizeSimplePresentationSettings(
    {
      ...preferences.simple,
      theme: nextAppearance.studySurface,
      accentColor: accentForStudySurface(
        nextAppearance.studySurface,
        preferences.simple.accentColor,
      ),
      motion: simpleMotionFromAppearanceMotion(nextAppearance.motion),
    },
    preferences.binderId,
    preferences.suiteTemplateId,
  );

  return normalizeWorkspacePreferences({
    ...preferences,
    appearance: nextAppearance,
    simple: nextSimple,
    modular: {
      ...preferences.modular,
      colorPreset: nextAppearance.appTheme,
      motionLevel: nextTheme.animationLevel,
    },
    theme: nextTheme,
    updatedAt: new Date().toISOString(),
  });
}

export function applyGlobalAppearanceToWorkspace(
  preferences: WorkspacePreferences,
  globalTheme: WorkspaceThemeSettings = loadGlobalThemeSettings(),
): WorkspacePreferences {
  return updateWorkspaceAppearance(
    {
      ...preferences,
      appearance: {
        ...preferences.appearance,
        saveLocalAppearance: false,
      },
    },
    {
      appTheme: globalTheme.id,
      ...(globalTheme.id === "custom" ? { accent: globalTheme.accentColor } : {}),
      studySurface: preferences.appearance.studySurface === "match" ? "match" : globalTheme.studySurface,
      density: globalTheme.density,
      roundness: globalTheme.roundness,
      motion: appearanceMotionFromAnimationLevel(globalTheme.animationLevel),
      customPalette: normalizeCustomPalette(globalTheme.customPalette),
      saveLocalAppearance: false,
    },
  );
}

export function applyWorkspaceMode(
  preferences: WorkspacePreferences,
  activeMode: WorkspaceMode,
): WorkspacePreferences {
  if (activeMode === "simple") {
    return ensureWindowFramesForEnabledModules({
      ...preferences,
      activeMode,
      workspaceStyle: "guided",
      styleChoiceCompleted: true,
      locked: true,
      updatedAt: new Date().toISOString(),
    });
  }

  if (activeMode === "modular") {
    const nextBase: WorkspacePreferences = {
      ...preferences,
      activeMode,
      workspaceStyle: "flexible",
      styleChoiceCompleted: true,
      locked: true,
      preset: preferences.modular.selectedPreset,
      theme: {
        ...preferences.theme,
        snapMode: false,
      },
      updatedAt: new Date().toISOString(),
    };
    return applyPreset(nextBase, nextBase.modular.selectedPreset);
  }

  const nextBase: WorkspacePreferences = {
    ...preferences,
    activeMode,
    workspaceStyle: "full-studio",
    styleChoiceCompleted: true,
    locked: true,
    theme: {
      ...preferences.theme,
      snapMode: preferences.canvas.snapBehavior !== "off",
    },
    windowLayout: {
      ...preferences.windowLayout,
      ...preferences.canvas.panelPositions,
    },
    updatedAt: new Date().toISOString(),
  };

  return ensureWindowFramesForEnabledModules(nextBase);
}

export function loadWorkspacePreferences(
  userId: string,
  binderId: string,
  suiteTemplateId?: string | null,
) {
  try {
    const raw = window.localStorage.getItem(storageKey(userId, binderId));
    if (!raw) {
      return createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId);
    }

    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences>;
    return normalizeWorkspacePreferences({
      ...createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId),
      ...parsed,
      userId,
      binderId,
    } as WorkspacePreferences);
  } catch {
    return createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId);
  }
}

export function saveWorkspacePreferences(preferences: WorkspacePreferences) {
  const next = {
    ...normalizeWorkspacePreferences(preferences),
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(storageKey(next.userId, next.binderId), JSON.stringify(next));
  return next;
}

export function ensureMathWorkspaceModules(preferences: WorkspacePreferences) {
  const requiredModules: WorkspaceModuleId[] = [
    "desmos-graph",
    "scientific-calculator",
  ];

  const enabledModules = [
    ...preferences.enabledModules,
    ...requiredModules.filter((moduleId) => !preferences.enabledModules.includes(moduleId)),
  ];
  const zones = {
    ...preferences.zones,
    "right-rail": appendUnique(preferences.zones["right-rail"], [
      "scientific-calculator",
    ]),
    bottom: appendUnique(preferences.zones.bottom, ["desmos-graph"]),
  };

  return ensureWindowFramesForEnabledModules({
    ...preferences,
    enabledModules,
    zones,
    updatedAt: new Date().toISOString(),
  });
}

export function ensureWindowFramesForEnabledModules(
  preferences: WorkspacePreferences,
): WorkspacePreferences {
  const fallbackLayout = buildWindowLayoutFromZones(preferences);
  const currentLayout = preferences.windowLayout ?? {};
  const normalizedFallback = Object.fromEntries(
    Object.entries(fallbackLayout).map(([moduleId, frame]) => [
      moduleId,
      normalizeWindowFrame(frame),
    ]),
  ) as WorkspacePreferences["windowLayout"];
  let nextZ = Math.max(
    1,
    ...Object.values(currentLayout).map((frame) => frame?.z ?? 1),
    ...Object.values(normalizedFallback).map((frame) => frame?.z ?? 1),
  );

  const windowLayout = Object.fromEntries(
    Object.entries(currentLayout).flatMap(([moduleId, frame]) => {
      const nextId = normalizeModuleId(moduleId);
      if (!nextId || !frame) {
        return [];
      }

      return [[nextId, normalizeWindowFrame(frame)]];
    }),
  ) as WorkspacePreferences["windowLayout"];

  preferences.enabledModules.forEach((moduleId) => {
    const existing = windowLayout[moduleId];
    if (existing) {
      return;
    }

    const fallback = normalizedFallback[moduleId] ?? createFloatingFallbackFrame(moduleId, nextZ);
    nextZ += 1;
    windowLayout[moduleId] = normalizeWindowFrame({ ...fallback, z: nextZ });
  });

  if (preferences.locked) {
    const orderedModuleIds = [...preferences.enabledModules].sort((left, right) => {
      const leftZ = windowLayout[left]?.z ?? 0;
      const rightZ = windowLayout[right]?.z ?? 0;
      return leftZ - rightZ;
    });
    const settled: Array<{ moduleId: WorkspaceModuleId; frame: WorkspaceWindowFrame }> = [];

    orderedModuleIds.forEach((moduleId) => {
      const current = windowLayout[moduleId];
      if (!current) {
        return;
      }

      const fallback = normalizedFallback[moduleId] ?? createFloatingFallbackFrame(moduleId, current.z);
      let next = normalizeWindowFrame(current);

      if (hasImpossibleWindowShape(next)) {
        next = normalizeWindowFrame({ ...fallback, z: next.z });
      }

      const overlaps = settled.some((entry) => framesOverlap(entry.frame, next));
      if (overlaps) {
        next = normalizeWindowFrame({
          ...fallback,
          z: next.z,
        });
      }

      const stillOverlapping = settled.some((entry) => framesOverlap(entry.frame, next));
      if (stillOverlapping) {
        const top = settled.reduce(
          (maxBottom, entry) => Math.max(maxBottom, entry.frame.y + entry.frame.h + WINDOW_GAP),
          next.y,
        );
        next = normalizeWindowFrame({
          ...next,
          y: top,
        });
      }

      windowLayout[moduleId] = next;
      settled.push({ moduleId, frame: next });
    });
  }

  return {
    ...preferences,
    windowLayout,
  };
}

export function resetWorkspacePreferences(userId: string, binderId: string) {
  const preferences = createDefaultWorkspacePreferences(userId, binderId);
  return saveWorkspacePreferences(preferences);
}

export function createStickyNoteLayout(index: number): StickyNoteLayout {
  return {
    x: 72 + (index % 3) * 44,
    y: 84 + (index % 4) * 36,
    w: 250,
    h: 206,
    z: 40 + index,
    minimized: false,
    color: DEFAULT_NOTE_TINTS[index % DEFAULT_NOTE_TINTS.length],
  };
}

export function fitWorkspaceToViewport(
  preferences: WorkspacePreferences,
  viewport: { width: number; height: number },
  options: { force?: boolean } = {},
): WorkspacePreferences {
  const width = Math.round(viewport.width);
  const height = Math.round(viewport.height);
  if (width < 320 || height < 240) {
    return preferences;
  }

  const composedPreferences = applyPresetVisibilityToPreferences(preferences, { width, height });
  const visibilityChanged = composedPreferences !== preferences;
  if (isPhoneViewport({ width, height })) {
    return applyMobileViewportFit(composedPreferences, width, height);
  }
  const visibleModules = composedPreferences.enabledModules.filter(
    (moduleId) =>
      composedPreferences.windowLayout[moduleId] &&
      !composedPreferences.moduleLayout[moduleId]?.collapsed,
  );
  if (visibleModules.length === 0) {
    return visibilityChanged ? composedPreferences : preferences;
  }

  const bounds = getWindowBounds(visibleModules, composedPreferences.windowLayout);
  if (!bounds) {
    return visibilityChanged ? composedPreferences : preferences;
  }
  const previousViewport = composedPreferences.viewportFit;
  const viewportChanged =
    !previousViewport ||
    Math.abs(previousViewport.width - width) > 120 ||
    Math.abs(previousViewport.height - height) > 120;
  const force = options.force ?? false;
  const hasDesignedPreset = Boolean(getWorkspacePresetDesign(composedPreferences.preset));
  const layoutResult = hasDesignedPreset
    ? tidyWorkspaceFrames({
        frames: composedPreferences.windowLayout,
        moduleIds: visibleModules,
        presetId: composedPreferences.preset,
        safeEdgePadding: composedPreferences.canvas.safeEdgePadding,
        viewport: { width, height },
      })
    : fitWindowFramesToViewport({
        force: force || viewportChanged,
        frames: composedPreferences.windowLayout,
        moduleIds: visibleModules,
        presetId: composedPreferences.preset,
        safeEdgePadding: composedPreferences.canvas.safeEdgePadding,
        viewport: { width, height },
      });
  const shouldFitSplitCanvasHeight =
    composedPreferences.activeMode === "canvas" && composedPreferences.preset === "split-study";
  const splitCanvasHeightChanged =
    shouldFitSplitCanvasHeight && composedPreferences.canvas.canvasHeight !== height;

  if (!force && !viewportChanged && !layoutResult.changed && !splitCanvasHeightChanged) {
    return visibilityChanged ? composedPreferences : preferences;
  }

  let changed = false;
  const nextWindowLayout = Object.fromEntries(
    Object.entries(layoutResult.frames).map(([moduleId, frame]) => [
      moduleId,
      frame ? normalizeWindowFrame(frame) : frame,
    ]),
  ) as WorkspacePreferences["windowLayout"];

  const nextStickyNotes = { ...composedPreferences.stickyNotes };
  const safePadding = composedPreferences.canvas.safeEdgePadding ? WORKSPACE_SAFE_EDGE_PADDING : 0;
  Object.entries(composedPreferences.stickyNotes).forEach(([commentId, sticky]) => {
    const nextSticky = {
      ...sticky,
      x: clamp(
        Math.round(sticky.x),
        safePadding,
        Math.max(safePadding, width - sticky.w - safePadding),
      ),
      y: clamp(
        Math.round(sticky.y),
        safePadding,
        Math.max(safePadding, height - (sticky.minimized ? 56 : sticky.h) - safePadding),
      ),
    };
    if (nextSticky.x !== sticky.x || nextSticky.y !== sticky.y) {
      changed = true;
      nextStickyNotes[commentId] = nextSticky;
    }
  });

  if (
    !changed &&
    !layoutResult.changed &&
    !splitCanvasHeightChanged &&
    previousViewport?.width === width &&
    previousViewport?.height === height
  ) {
    return visibilityChanged ? composedPreferences : preferences;
  }

  return {
    ...composedPreferences,
    canvas: shouldFitSplitCanvasHeight
      ? {
          ...composedPreferences.canvas,
          canvasHeight: height,
        }
      : composedPreferences.canvas,
    windowLayout: nextWindowLayout,
    stickyNotes: nextStickyNotes,
    viewportFit: {
      width,
      height,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function tidyWorkspaceLayout(
  preferences: WorkspacePreferences,
  viewport: { width: number; height: number },
): WorkspacePreferences {
  const width = Math.round(viewport.width);
  const height = Math.round(viewport.height);
  if (width < 320 || height < 240) {
    return preferences;
  }

  const composedPreferences = applyPresetVisibilityToPreferences(preferences, { width, height });
  if (isPhoneViewport({ width, height })) {
    return applyMobileViewportFit(composedPreferences, width, height);
  }
  const visibleModules = composedPreferences.enabledModules.filter(
    (moduleId) =>
      composedPreferences.windowLayout[moduleId] &&
      !composedPreferences.moduleLayout[moduleId]?.collapsed,
  );
  const result = tidyWorkspaceFrames({
    frames: composedPreferences.windowLayout,
    moduleIds: visibleModules,
    presetId: composedPreferences.preset,
    safeEdgePadding: composedPreferences.canvas.safeEdgePadding,
    viewport: { width, height },
  });
  const shouldFitSplitCanvasHeight =
    composedPreferences.activeMode === "canvas" && composedPreferences.preset === "split-study";
  const splitCanvasHeightChanged =
    shouldFitSplitCanvasHeight && composedPreferences.canvas.canvasHeight !== height;

  if (!result.changed && !splitCanvasHeightChanged) {
    return composedPreferences;
  }

  const windowLayout = Object.fromEntries(
    Object.entries(result.frames).map(([moduleId, frame]) => [
      moduleId,
      frame ? normalizeWindowFrame(frame) : frame,
    ]),
  ) as WorkspacePreferences["windowLayout"];

  return {
    ...composedPreferences,
    canvas:
      composedPreferences.activeMode === "canvas"
        ? {
            ...composedPreferences.canvas,
            canvasHeight: shouldFitSplitCanvasHeight ? height : composedPreferences.canvas.canvasHeight,
            panelPositions: {
              ...composedPreferences.canvas.panelPositions,
              ...windowLayout,
            },
          }
        : composedPreferences.canvas,
    windowLayout,
    viewportFit: {
      width,
      height,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

function applyMobileViewportFit(
  preferences: WorkspacePreferences,
  width: number,
  height: number,
): WorkspacePreferences {
  const updatedAt = new Date().toISOString();
  return {
    ...preferences,
    theme: {
      ...preferences.theme,
      verticalSpace: "fit",
    },
    viewportFit: {
      width,
      height,
      updatedAt,
    },
    updatedAt,
  };
}

function isPhoneViewport(viewport: { width: number; height: number }): boolean {
  return viewport.width <= 760;
}

export function loadGlobalThemeSettings(): WorkspaceThemeSettings {
  if (typeof window === "undefined") {
    return defaultThemeSettings;
  }

  try {
    const raw = window.localStorage.getItem(globalThemeStorageKey);
    if (!raw) {
      return defaultThemeSettings;
    }

    const parsed = JSON.parse(raw) as Partial<WorkspaceThemeSettings>;
    return normalizePersistedGlobalThemeSettings(parsed);
  } catch {
    return defaultThemeSettings;
  }
}

export function saveGlobalThemeSettings(theme: WorkspaceThemeSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(globalThemeStorageKey, JSON.stringify(normalizePersistedGlobalThemeSettings(theme)));
}

export function applyThemeSettings(settings: WorkspaceThemeSettings) {
  const root = document.documentElement;
  const normalizedSettings = normalizeThemeSettings(settings);
  const theme =
    workspaceThemes.find((candidate) => candidate.id === normalizedSettings.id) ?? defaultTheme;
  const themeVars =
    normalizedSettings.id === "custom"
      ? buildCustomThemeVars(normalizedSettings.customPalette ?? defaultCustomPalette)
      : theme.vars;
  const appPrimary =
    normalizedSettings.id === "custom"
      ? themeVars.primary
      : normalizedSettings.accent || themeVars.primary;
  const darkSurface = themeVars.background.match(/(\d+)%$/)?.[1];
  const isDark =
    darkSurface ? Number(darkSurface) < 20 : theme.id === "space" || theme.id === "midnight-scholar";
  const vars = {
    "--background": themeVars.background,
    "--foreground": themeVars.foreground,
    "--card": themeVars.card,
    "--card-foreground": themeVars.cardForeground,
    "--popover": themeVars.card,
    "--popover-foreground": themeVars.cardForeground,
    "--secondary": themeVars.secondary,
    "--secondary-foreground": themeVars.foreground,
    "--muted": themeVars.muted,
    "--muted-foreground": themeVars.mutedForeground,
    "--accent": themeVars.accent,
    "--accent-foreground": themeVars.foreground,
    "--border": themeVars.border,
    "--input": themeVars.border,
    "--ring": appPrimary,
    "--primary": appPrimary,
    "--primary-foreground":
      isDark ? "220 16% 8%" : "0 0% 100%",
    "--bg-app": themeVars.background,
    "--bg-surface": themeVars.card,
    "--bg-panel": themeVars.card,
    "--bg-elevated": themeVars.secondary,
    "--text-primary": themeVars.foreground,
    "--text-secondary": themeVars.mutedForeground,
    "--border-default": themeVars.border,
    "--accent-primary": appPrimary,
    "--accent-secondary": themeVars.accent,
    "--accent-soft": themeVars.accent,
    "--button-primary": appPrimary,
    "--button-secondary": themeVars.secondary,
    "--focus-ring": appPrimary,
    "--shadow-strength": normalizedSettings.shadow === "glow" ? "0.18" : normalizedSettings.shadow === "lifted" ? "0.1" : "0.04",
  };
  const studySurfaceVars = buildStudySurfaceVars(
    normalizedSettings.studySurface,
    themeVars,
    normalizedSettings.customPalette ?? defaultCustomPalette,
  );
  const studyVars = {
    "--study-bg": studySurfaceVars.bg,
    "--study-surface": studySurfaceVars.surface,
    "--study-soft": studySurfaceVars.soft,
    "--study-line": studySurfaceVars.line,
    "--study-text": studySurfaceVars.text,
    "--study-muted": studySurfaceVars.muted,
    "--study-accent": studySurfaceVars.accent,
    "--study-accent-soft": studySurfaceVars.accentSoft,
    "--study-accent-text": studySurfaceVars.accentText,
  };

  Object.entries({ ...vars, ...studyVars }).forEach(([key, value]) => root.style.setProperty(key, value));
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  root.dataset.workspaceTheme = normalizedSettings.id;
  root.dataset.workspaceAccent = normalizedSettings.accentColor;
  root.dataset.studySurface = normalizedSettings.studySurface;
  root.dataset.workspaceCustomPalette =
    normalizedSettings.id === "custom" || normalizedSettings.studySurface === "custom" ? "on" : "off";
  root.dataset.workspaceDensity = normalizedSettings.density;
  root.dataset.workspaceRoundness = normalizedSettings.roundness;
  root.dataset.workspaceShadow = normalizedSettings.shadow;
  root.dataset.workspaceFont = normalizedSettings.font;
  root.dataset.workspaceBackground = normalizedSettings.backgroundStyle;
  root.dataset.workspaceHoverMotion = normalizedSettings.hoverMotion ? "on" : "off";
  root.dataset.workspaceSnapMode = normalizedSettings.snapMode ? "on" : "off";
  root.dataset.workspaceFocusMode = normalizedSettings.focusMode ? "on" : "off";
  root.dataset.workspaceCompactMode = normalizedSettings.compactMode ? "on" : "off";
  root.dataset.maximizeModuleSpace = normalizedSettings.compactMode ? "true" : "false";
  root.dataset.workspaceAnimation = normalizedSettings.animationLevel;
  root.dataset.workspaceGraphAppearance = normalizedSettings.graphAppearance;
  root.dataset.workspaceGraphChrome = normalizedSettings.graphChrome;
  root.dataset.workspaceVerticalSpace = normalizedSettings.verticalSpace;
  root.dataset.workspaceHighlightColor = normalizedSettings.defaultHighlightColor;
  root.dataset.workspaceReducedChrome = normalizedSettings.reducedChrome ? "on" : "off";
  root.dataset.workspaceUtilityUi = normalizedSettings.showUtilityUi ? "on" : "off";
}

export function applyWorkspaceTheme(preferences: WorkspacePreferences) {
  applyThemeSettings(preferences.theme);
}

function normalizeWorkspacePreferences(preferences: WorkspacePreferences): WorkspacePreferences {
  const legacyZones = preferences.zones as Record<string, WorkspaceModuleId[] | undefined>;
  const zones: Record<WorkspaceZone, WorkspaceModuleId[]> = {
    "left-rail": legacyZones["left-rail"] ?? legacyZones.left ?? [],
    "center-left": legacyZones["center-left"] ?? legacyZones.center ?? [],
    "center-right": legacyZones["center-right"] ?? legacyZones.right ?? [],
    "right-rail": legacyZones["right-rail"] ?? [],
    bottom: legacyZones.bottom ?? [],
  };
  (Object.keys(zones) as WorkspaceZone[]).forEach((zone) => {
    zones[zone] = zones[zone]
      .map((id) => normalizeModuleId(id))
      .filter((id, index, list): id is WorkspaceModuleId => Boolean(id) && list.indexOf(id) === index);
  });

  const enabledModules = preferences.enabledModules
    .map((id) => normalizeModuleId(id))
    .filter((id, index, list): id is WorkspaceModuleId => Boolean(id) && list.indexOf(id) === index);

  const normalizedSimple = normalizeSimplePresentationSettings(
    preferences.simple,
    preferences.binderId,
    preferences.suiteTemplateId,
  );
  const legacyTheme = normalizeThemeSettings(preferences.theme);
  const normalizedAppearance = normalizeAppearanceSettings(
    preferences.appearance,
    legacyTheme,
    normalizedSimple,
    preferences.binderId,
    preferences.suiteTemplateId,
  );
  const normalizedTheme = normalizeThemeSettings({
    ...legacyTheme,
    id: normalizedAppearance.appTheme,
    studySurface: normalizedAppearance.studySurface,
    density: normalizedAppearance.density,
    roundness: normalizedAppearance.roundness,
    animationLevel: animationLevelFromAppearanceMotion(normalizedAppearance.motion),
    customPalette: normalizedAppearance.customPalette,
  });
  const simple = normalizeSimplePresentationSettings(
    {
      ...normalizedSimple,
      theme: normalizedAppearance.studySurface,
      accentColor: accentForStudySurface(
        normalizedAppearance.studySurface,
        normalizedSimple.accentColor,
      ),
      motion: simpleMotionFromAppearanceMotion(normalizedAppearance.motion),
    },
    preferences.binderId,
    preferences.suiteTemplateId,
  );
  const modular = normalizeModularStudySettings(preferences.modular, preferences.preset);

  const normalized: WorkspacePreferences = {
    ...preferences,
    activeMode: normalizeWorkspaceMode(preferences.activeMode, preferences.workspaceStyle),
    appearance: normalizedAppearance,
    simple,
    modular: {
      ...modular,
      colorPreset: normalizedAppearance.appTheme,
      motionLevel: normalizedTheme.animationLevel,
    },
    canvas: normalizeFullCanvasSettings(preferences.canvas),
    workspaceStyle: normalizeWorkspaceStyle(preferences.workspaceStyle),
    styleChoiceCompleted: preferences.styleChoiceCompleted ?? false,
    preset: normalizePresetId(preferences.preset),
    enabledModules,
    zones,
    paneLayout: normalizePaneLayout(preferences.paneLayout),
    moduleLayout: normalizeModuleLayout(preferences.moduleLayout),
    windowLayout: normalizeWindowLayout(preferences.windowLayout),
    stickyNotes: normalizeStickyNotes(preferences.stickyNotes),
    viewportFit: normalizeViewportFit(preferences.viewportFit),
    theme: normalizedTheme,
  };

  const shouldAutoAttachMathModules =
    normalized.enabledModules.some((id) =>
      ["formula-sheet", "math-blocks"].includes(id),
    );

  const withMath = shouldAutoAttachMathModules ? ensureMathWorkspaceModules(normalized) : normalized;
  return ensureWindowFramesForEnabledModules(withMath);
}

export function normalizeThemeSettings(settings?: Partial<WorkspaceThemeSettings>): WorkspaceThemeSettings {
  const nextId =
    settings?.id && workspaceThemes.some((theme) => theme.id === settings.id)
      ? (settings.id as WorkspaceThemeId)
      : defaultThemeSettings.id;
  const studySurface =
    settings?.studySurface &&
    isStudySurfaceTheme(settings.studySurface)
      ? settings.studySurface
      : defaultThemeSettings.studySurface;
  const density = densityOptions.includes(settings?.density as WorkspaceDensity)
    ? (settings?.density as WorkspaceDensity)
    : defaultThemeSettings.density;
  const roundness = roundnessOptions.includes(settings?.roundness as WorkspaceRoundness)
    ? (settings?.roundness as WorkspaceRoundness)
    : defaultThemeSettings.roundness;
  const shadow = shadowOptions.includes(settings?.shadow as WorkspaceShadow)
    ? (settings?.shadow as WorkspaceShadow)
    : defaultThemeSettings.shadow;
  const font = fontOptions.includes(settings?.font as WorkspaceFont)
    ? (settings?.font as WorkspaceFont)
    : defaultThemeSettings.font;
  const backgroundStyle = backgroundStyleOptions.includes(
    settings?.backgroundStyle as WorkspaceBackgroundStyle,
  )
    ? (settings?.backgroundStyle as WorkspaceBackgroundStyle)
    : defaultThemeSettings.backgroundStyle;
  const animationLevel = animationLevelOptions.includes(
    settings?.animationLevel as WorkspaceAnimationLevel,
  )
    ? (settings?.animationLevel as WorkspaceAnimationLevel)
    : defaultThemeSettings.animationLevel;
  const graphAppearance = graphAppearanceOptions.includes(
    settings?.graphAppearance as WorkspaceGraphAppearance,
  )
    ? (settings?.graphAppearance as WorkspaceGraphAppearance)
    : defaultThemeSettings.graphAppearance;
  const graphChrome = graphChromeOptions.includes(settings?.graphChrome as WorkspaceGraphChrome)
    ? (settings?.graphChrome as WorkspaceGraphChrome)
    : defaultThemeSettings.graphChrome;
  const verticalSpace = verticalSpaceOptions.includes(settings?.verticalSpace as WorkspaceVerticalSpace)
    ? (settings?.verticalSpace as WorkspaceVerticalSpace)
    : defaultThemeSettings.verticalSpace;
  const defaultHighlightColor = highlightColorOptions.some(
    (option) => option.id === settings?.defaultHighlightColor,
  )
    ? (settings?.defaultHighlightColor as HighlightColor)
    : defaultThemeSettings.defaultHighlightColor;
  const rawCustomPalette = normalizeCustomPalette(settings?.customPalette);
  const fallbackAccentColor = accentColorForTheme(nextId);
  const accentColor = normalizeAccentColor(
    settings?.accentColor,
    settings?.accent ? accentColorForValue(settings.accent, fallbackAccentColor) : fallbackAccentColor,
  );
  const customPalette = repairLegacyAccentAsPrimaryPalette(
    nextId,
    accentColor,
    rawCustomPalette,
  );
  const accent =
    nextId === "custom"
      ? hslParts(hexToHsl(customPalette.primary))
      : settings?.accent || workspaceThemes.find((theme) => theme.id === nextId)?.vars.primary || defaultThemeSettings.accent;

  return {
    ...defaultThemeSettings,
    ...settings,
    id: nextId,
    studySurface,
    accent,
    accentColor,
    density,
    roundness,
    shadow,
    font,
    backgroundStyle,
    hoverMotion:
      typeof settings?.hoverMotion === "boolean"
        ? settings.hoverMotion
        : defaultThemeSettings.hoverMotion,
    snapMode:
      typeof settings?.snapMode === "boolean"
        ? settings.snapMode
        : defaultThemeSettings.snapMode,
    focusMode:
      typeof settings?.focusMode === "boolean"
        ? settings.focusMode
        : defaultThemeSettings.focusMode,
    compactMode:
      typeof settings?.compactMode === "boolean"
        ? settings.compactMode
        : defaultThemeSettings.compactMode,
    animationLevel,
    graphAppearance,
    graphChrome,
    verticalSpace,
    defaultHighlightColor,
    reducedChrome:
      typeof settings?.reducedChrome === "boolean"
        ? settings.reducedChrome
        : defaultThemeSettings.reducedChrome,
    showUtilityUi:
      typeof settings?.showUtilityUi === "boolean"
        ? settings.showUtilityUi
        : defaultThemeSettings.showUtilityUi,
    customPalette,
  };
}

function normalizePersistedGlobalThemeSettings(settings?: Partial<WorkspaceThemeSettings>): WorkspaceThemeSettings {
  return {
    ...normalizeThemeSettings(settings),
    focusMode: false,
  };
}

function normalizeWorkspaceMode(mode?: string, workspaceStyle?: string): WorkspaceMode {
  if (workspaceModeOptions.some((option) => option.id === mode)) {
    return mode as WorkspaceMode;
  }

  if (workspaceStyle === "full-studio") {
    return "canvas";
  }

  if (workspaceStyle === "flexible") {
    return "modular";
  }

  return "simple";
}

function normalizeAppearanceSettings(
  settings?: Partial<AppearanceSettings>,
  theme?: Partial<WorkspaceThemeSettings>,
  simple?: Partial<SimplePresentationSettings>,
  binderId?: string | null,
  suiteTemplateId?: string | null,
): AppearanceSettings {
  const fallback = createDefaultAppearanceSettings(
    binderId,
    suiteTemplateId,
    normalizeThemeSettings(theme),
  );
  const appTheme =
    theme?.id && workspaceThemes.some((option) => option.id === theme.id)
      ? (theme.id as AppearanceSettings["appTheme"])
      : settings?.appTheme && workspaceThemes.some((option) => option.id === settings.appTheme)
        ? settings.appTheme
        : fallback.appTheme;
  const studySurface =
    settings?.studySurface &&
    isStudySurfaceTheme(settings.studySurface)
      ? settings.studySurface
      : simple?.theme &&
          isStudySurfaceTheme(simple.theme)
        ? (simple.theme as AppearanceSettings["studySurface"])
        : fallback.studySurface;
  const accent = normalizeAccentColor(
    settings?.accent,
    theme?.accentColor
      ? normalizeAccentColor(theme.accentColor)
      : theme?.accent
        ? accentColorForValue(theme.accent, fallback.accent)
        : fallback.accent,
  );
  const density =
    theme?.density && densityOptions.includes(theme.density as WorkspaceDensity)
      ? (theme.density as WorkspaceDensity)
      : densityOptions.includes(settings?.density as WorkspaceDensity)
        ? (settings?.density as WorkspaceDensity)
        : fallback.density;
  const roundness =
    theme?.roundness && roundnessOptions.includes(theme.roundness as WorkspaceRoundness)
      ? (theme.roundness as WorkspaceRoundness)
      : roundnessOptions.includes(settings?.roundness as WorkspaceRoundness)
        ? (settings?.roundness as WorkspaceRoundness)
        : fallback.roundness;
  const motion =
    theme?.animationLevel &&
          animationLevelOptions.includes(theme.animationLevel as WorkspaceAnimationLevel)
        ? appearanceMotionFromAnimationLevel(theme.animationLevel as WorkspaceAnimationLevel)
        : settings?.motion && (["full", "reduced", "minimal"] as AppearanceMotion[]).includes(settings.motion)
          ? settings.motion
          : fallback.motion;
  const saveLocalAppearance =
    typeof settings?.saveLocalAppearance === "boolean"
      ? settings.saveLocalAppearance
      : false;
  const customPalette = repairLegacyAccentAsPrimaryPalette(
    appTheme,
    accent,
    normalizeCustomPalette(settings?.customPalette ?? theme?.customPalette),
  );

  return {
    appTheme,
    accent,
    studySurface,
    density,
    roundness,
    motion,
    customPalette,
    saveLocalAppearance,
  };
}

function normalizeSimplePresentationSettings(
  settings?: Partial<SimplePresentationSettings>,
  binderId?: string | null,
  suiteTemplateId?: string | null,
): SimplePresentationSettings {
  const fallback = createDefaultSimplePresentationSettings(binderId, suiteTemplateId);
  const theme = isStudySurfaceTheme(settings?.theme)
    ? (settings?.theme as SimplePresentationTheme)
    : fallback.theme;
  const fontSize = simplePresentationFontSizeOptions.some((option) => option.id === settings?.fontSize)
    ? (settings?.fontSize as SimplePresentationFontSize)
    : fallback.fontSize;
  const readingWidth = simplePresentationReadingWidthOptions.some((option) => option.id === settings?.readingWidth)
    ? (settings?.readingWidth as SimplePresentationReadingWidth)
    : fallback.readingWidth;
  const motion = simplePresentationMotionOptions.some((option) => option.id === settings?.motion)
    ? (settings?.motion as SimplePresentationMotion)
    : fallback.motion;
  const accentColor =
    settings?.accentColor &&
    (["history-gold", "math-blue", "teal", "rose"] as const).includes(settings.accentColor)
      ? settings.accentColor
      : fallback.accentColor;

  return {
    ...fallback,
    ...settings,
    theme,
    fontSize,
    readingWidth,
    showSideNotes:
      typeof settings?.showSideNotes === "boolean" ? settings.showSideNotes : fallback.showSideNotes,
    showProgressBar:
      typeof settings?.showProgressBar === "boolean"
        ? settings.showProgressBar
        : fallback.showProgressBar,
    showStudyDrawer:
      typeof settings?.showStudyDrawer === "boolean"
        ? settings.showStudyDrawer
        : fallback.showStudyDrawer,
    accentColor,
    motion,
    focusMode: typeof settings?.focusMode === "boolean" ? settings.focusMode : fallback.focusMode,
    highContrast:
      typeof settings?.highContrast === "boolean" ? settings.highContrast : fallback.highContrast,
  };
}

function normalizeModularStudySettings(
  settings?: Partial<ModularStudySettings>,
  fallbackPresetId?: string,
): ModularStudySettings {
  const fallback = createDefaultModularStudySettings(normalizePresetId(fallbackPresetId ?? defaultPreset.id));
  const selectedPreset = normalizePresetId(settings?.selectedPreset ?? fallback.selectedPreset);
  const panelDensity =
    settings?.panelDensity && (["comfortable", "compact"] as ModularPanelDensity[]).includes(settings.panelDensity)
      ? settings.panelDensity
      : fallback.panelDensity;
  const sidePanelPosition =
    settings?.sidePanelPosition &&
    (["left", "right"] as ModularSidePanelPosition[]).includes(settings.sidePanelPosition)
      ? settings.sidePanelPosition
      : fallback.sidePanelPosition;
  const motionLevel = animationLevelOptions.includes(settings?.motionLevel as WorkspaceAnimationLevel)
    ? (settings?.motionLevel as WorkspaceAnimationLevel)
    : fallback.motionLevel;
  const colorPreset = workspaceThemes.some((theme) => theme.id === settings?.colorPreset)
    ? (settings?.colorPreset as WorkspaceThemeId)
    : fallback.colorPreset;
  const moduleVisibility = Object.fromEntries(
    Object.entries(settings?.moduleVisibility ?? {}).flatMap(([moduleId, visible]) => {
      const nextId = normalizeModuleId(moduleId);
      return nextId ? [[nextId, Boolean(visible)]] : [];
    }),
  ) as ModularStudySettings["moduleVisibility"];

  return {
    selectedPreset,
    panelDensity,
    moduleVisibility,
    sidePanelPosition,
    motionLevel,
    colorPreset,
    saveLayoutPerBinder:
      typeof settings?.saveLayoutPerBinder === "boolean"
        ? settings.saveLayoutPerBinder
        : fallback.saveLayoutPerBinder,
  };
}

function normalizeFullCanvasSettings(settings?: Partial<FullCanvasSettings>): FullCanvasSettings {
  const fallback = createDefaultFullCanvasSettings();
  const snapBehavior =
    settings?.snapBehavior &&
    (["off", "edges", "modules"] as FullCanvasSnapBehavior[]).includes(settings.snapBehavior)
      ? settings.snapBehavior
      : fallback.snapBehavior;
  const gridSize =
    typeof settings?.gridSize === "number" && Number.isFinite(settings.gridSize)
      ? clamp(Math.round(settings.gridSize), 8, 96)
      : fallback.gridSize;
  const customModules = (settings?.customModules ?? [])
    .map((moduleId) => normalizeModuleId(moduleId))
    .filter((moduleId, index, list): moduleId is WorkspaceModuleId => Boolean(moduleId) && list.indexOf(moduleId) === index);
  const canvasHeight =
    typeof settings?.canvasHeight === "number" && Number.isFinite(settings.canvasHeight)
      ? clamp(Math.round(settings.canvasHeight), WINDOW_CANVAS_MIN_HEIGHT, WORKSPACE_MAX_CANVAS_HEIGHT)
      : fallback.canvasHeight;

  return {
    gridSize,
    snapBehavior,
    panelPositions: normalizeWindowLayout(settings?.panelPositions),
    customModules,
    safeEdgePadding:
      typeof settings?.safeEdgePadding === "boolean"
        ? settings.safeEdgePadding
        : fallback.safeEdgePadding,
    canvasHeight,
    showDiagnostics:
      typeof settings?.showDiagnostics === "boolean"
        ? settings.showDiagnostics
        : fallback.showDiagnostics,
  };
}

export function resolveVerticalWorkspaceMetrics(
  verticalSpace: WorkspaceVerticalSpace,
  viewportHeight: number,
) {
  switch (verticalSpace) {
    case "fit":
      return {
        availableHeight: Math.max(280, viewportHeight - 24),
        canvasFloor: Math.max(0, viewportHeight - 8),
        canvasPadding: 20,
        overflowTolerance: 10,
        underfillThreshold: 0.82,
        topSlack: 18,
        topSlackDivisor: 14,
      };
    case "extended":
      return {
        availableHeight: Math.max(320, viewportHeight - 40),
        canvasFloor: Math.max(0, viewportHeight + 220),
        canvasPadding: 260,
        overflowTolerance: 44,
        underfillThreshold: 0.52,
        topSlack: 84,
        topSlackDivisor: 6,
      };
    case "infinite":
      return {
        availableHeight: Math.max(360, viewportHeight - 56),
        canvasFloor: Math.max(0, Math.round(viewportHeight * 1.45)),
        canvasPadding: 420,
        overflowTolerance: 64,
        underfillThreshold: 0.42,
        topSlack: 120,
        topSlackDivisor: 5,
      };
    case "balanced":
    default:
      return {
        availableHeight: Math.max(280, viewportHeight - 32),
        canvasFloor: Math.max(0, viewportHeight - 8),
        canvasPadding: 16,
        overflowTolerance: 24,
        underfillThreshold: 0.68,
        topSlack: 32,
        topSlackDivisor: 10,
      };
  }
}

function normalizePaneLayout(
  layout: WorkspacePreferences["paneLayout"] | Record<string, number>,
) {
  const legacy = layout as Record<string, number | undefined>;
  const fallbackLayout = resolveWorkspacePresetLayout(defaultPreset.id, "guided").paneLayout;
  return {
    leftRail: legacy.leftRail ?? legacy.left ?? fallbackLayout.leftRail,
    centerLeft: legacy.centerLeft ?? legacy.center ?? fallbackLayout.centerLeft,
    centerRight: legacy.centerRight ?? legacy.right ?? fallbackLayout.centerRight,
    rightRail: legacy.rightRail ?? fallbackLayout.rightRail,
  };
}

function normalizeModuleLayout(layout?: WorkspacePreferences["moduleLayout"]) {
  const allowed: WorkspaceModuleSpan[] = ["auto", "narrow", "medium", "wide", "full"];
  return Object.fromEntries(
    workspaceModules.map((module) => {
      const current = layout?.[module.id];
      const fallback = defaultModuleLayout[module.id] ?? { span: "auto" as WorkspaceModuleSpan };
      return [
        module.id,
        {
          ...fallback,
          ...current,
          span: current?.span && allowed.includes(current.span) ? current.span : fallback.span,
        },
      ];
    }),
  ) as WorkspacePreferences["moduleLayout"];
}

function normalizeWorkspaceStyle(style?: string): WorkspaceStyle {
  return workspaceStyleOptions.some((option) => option.id === style)
    ? (style as WorkspaceStyle)
    : "guided";
}

function normalizeWindowLayout(layout?: WorkspacePreferences["windowLayout"]) {
  return Object.fromEntries(
    Object.entries(layout ?? {}).flatMap(([moduleId, frame]) => {
      const nextId = normalizeModuleId(moduleId);
      if (!nextId || !frame) {
        return [];
      }

      return [[nextId, normalizeWindowFrame(frame)]];
    }),
  ) as WorkspacePreferences["windowLayout"];
}

function normalizeStickyNotes(stickyNotes?: WorkspacePreferences["stickyNotes"]) {
  return Object.fromEntries(
    Object.entries(stickyNotes ?? {}).map(([commentId, sticky]) => [
      commentId,
      {
        x: Number.isFinite(sticky.x) ? sticky.x : 0,
        y: Number.isFinite(sticky.y) ? sticky.y : 0,
        w: Number.isFinite(sticky.w) ? sticky.w : 250,
        h: Number.isFinite(sticky.h) ? sticky.h : 206,
        z: Number.isFinite(sticky.z) ? sticky.z : 40,
        minimized: Boolean(sticky.minimized),
        color: DEFAULT_NOTE_TINTS.includes(sticky.color) ? sticky.color : "amber",
      },
    ]),
  ) as WorkspacePreferences["stickyNotes"];
}

function normalizeViewportFit(viewportFit?: WorkspacePreferences["viewportFit"]) {
  if (!viewportFit) {
    return undefined;
  }

  if (!Number.isFinite(viewportFit.width) || !Number.isFinite(viewportFit.height)) {
    return undefined;
  }

  return {
    width: Math.round(viewportFit.width),
    height: Math.round(viewportFit.height),
    updatedAt: viewportFit.updatedAt ?? new Date(0).toISOString(),
  };
}

function normalizePresetId(presetId: string): WorkspacePresetId {
  const legacyMap: Record<string, WorkspacePresetId> = {
    "classic-study": "split-study",
    "deep-focus": "focused-reading",
    "math-lab": "math-study",
    "lecture-review": "annotation-mode",
    "exam-prep": "notes-focus",
    "creator-mode": "annotation-mode",
  };
  const nextId = legacyMap[presetId] ?? presetId;
  return workspacePresets.some((preset) => preset.id === nextId)
    ? (nextId as WorkspacePresetId)
    : defaultPreset.id;
}

export { normalizeWorkspacePreferences };

function buildWindowLayoutFromZones(
  preferences: Pick<WorkspacePreferences, "enabledModules" | "zones" | "paneLayout" | "moduleLayout">,
) {
  const xMap = computeZoneXPositions(preferences.paneLayout);
  const layout: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> = {};
  let z = 1;

  const bottomY = 820;
  const columnBottoms: number[] = [];

  (
    ["left-rail", "center-left", "center-right", "right-rail"] as const
  ).forEach((zone) => {
    const zoneModules = preferences.zones[zone].filter((moduleId) =>
      preferences.enabledModules.includes(moduleId),
    );
    const zoneWidth = xMap.widths[zone];
    let y = WINDOW_PADDING;

    zoneModules.forEach((moduleId) => {
      const frame = placeModuleFrame(moduleId, zone, zoneWidth, xMap.positions[zone], y, z, preferences.moduleLayout);
      layout[moduleId] = frame;
      y = frame.y + frame.h + WINDOW_GAP;
      z += 1;
    });

    columnBottoms.push(y);
  });

  let bottomX = WINDOW_PADDING;
  const baselineBottomY = Math.max(bottomY, ...columnBottoms) + 8;
  preferences.zones.bottom
    .filter((moduleId) => preferences.enabledModules.includes(moduleId))
    .forEach((moduleId) => {
      const frame = placeBottomFrame(
        moduleId,
        bottomX,
        baselineBottomY,
        z,
        preferences.moduleLayout,
      );
      layout[moduleId] = frame;
      bottomX += frame.w + WINDOW_GAP;
      z += 1;
    });

  return layout;
}

function computeZoneXPositions(layout: WorkspacePreferences["paneLayout"]) {
  const usableWidth = WINDOW_CANVAS_WIDTH - WINDOW_PADDING * 2 - WINDOW_GAP * 3;
  const majorTotal = layout.leftRail + layout.centerLeft + layout.centerRight + layout.rightRail || 1;
  const widths = {
    "left-rail": Math.max(240, Math.round((usableWidth * layout.leftRail) / majorTotal)),
    "center-left": Math.max(400, Math.round((usableWidth * layout.centerLeft) / majorTotal)),
    "center-right": Math.max(400, Math.round((usableWidth * layout.centerRight) / majorTotal)),
    "right-rail": Math.max(280, Math.round((usableWidth * layout.rightRail) / majorTotal)),
    bottom: WINDOW_CANVAS_WIDTH - WINDOW_PADDING * 2,
  } as const;
  const positions = {
    "left-rail": WINDOW_PADDING,
    "center-left": WINDOW_PADDING + widths["left-rail"] + WINDOW_GAP,
    "center-right":
      WINDOW_PADDING + widths["left-rail"] + widths["center-left"] + WINDOW_GAP * 2,
    "right-rail":
      WINDOW_PADDING +
      widths["left-rail"] +
      widths["center-left"] +
      widths["center-right"] +
      WINDOW_GAP * 3,
    bottom: WINDOW_PADDING,
  } as const;

  return { positions, widths };
}

function packPresetWindowLayout(
  layout: WorkspacePresetLayout,
  workspaceStyle: WorkspaceStyle,
): WorkspacePresetLayout {
  if (!layout.windowLayout) {
    return layout;
  }

  const moduleIds = Object.keys(layout.windowLayout) as WorkspaceModuleId[];
  const bounds = getWindowBounds(moduleIds, layout.windowLayout);
  if (!bounds) {
    return layout;
  }

  const paddingX = workspaceStyle === "guided" ? PRESET_SPACE.medium : PRESET_SPACE.small;
  const paddingY = PRESET_SPACE.medium;
  const targetWidth = WINDOW_CANVAS_WIDTH - paddingX * 2;
  const targetHeight = WINDOW_CANVAS_HEIGHT - paddingY * 2;
  const desiredWidth =
    targetWidth *
    (workspaceStyle === "guided"
      ? 0.94
      : workspaceStyle === "flexible"
        ? 0.965
        : 0.982);
  const desiredHeight =
    targetHeight *
    (workspaceStyle === "guided"
      ? 0.86
      : workspaceStyle === "flexible"
        ? 0.91
        : 0.95);

  const maxScale = Math.min(
    targetWidth / Math.max(bounds.width, 1),
    targetHeight / Math.max(bounds.height, 1),
  );
  const desiredScale = Math.min(
    desiredWidth / Math.max(bounds.width, 1),
    desiredHeight / Math.max(bounds.height, 1),
  );
  const scale =
    bounds.width > targetWidth || bounds.height > targetHeight
      ? Math.min(1, maxScale)
      : desiredScale > 1
        ? Math.min(
            workspaceStyle === "guided" ? 1.08 : workspaceStyle === "flexible" ? 1.1 : 1.12,
            desiredScale,
            maxScale,
          )
        : 1;

  if (Math.abs(scale - 1) < 0.01 && bounds.minX === paddingX && bounds.minY === paddingY) {
    return layout;
  }

  const nextWindowLayout = Object.fromEntries(
    Object.entries(layout.windowLayout).map(([moduleId, frame]) => {
      if (!frame) {
        return [moduleId, frame];
      }

      const nextFrame = normalizeWindowFrame({
        x: paddingX + (frame.x - bounds.minX) * scale,
        y: paddingY + (frame.y - bounds.minY) * scale,
        w: frame.w * scale,
        h: frame.h * scale,
        z: frame.z,
      });

      return [moduleId, nextFrame];
    }),
  ) as Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;

  return {
    ...layout,
    windowLayout: nextWindowLayout,
  };
}

function placeModuleFrame(
  moduleId: WorkspaceModuleId,
  zone: Exclude<WorkspaceZone, "bottom">,
  zoneWidth: number,
  x: number,
  y: number,
  z: number,
  moduleLayout: WorkspacePreferences["moduleLayout"],
): WorkspaceWindowFrame {
  const span = moduleLayout[moduleId]?.span ?? "auto";
  const width = computeModuleWidth(moduleId, zoneWidth, span);
  const height = computeModuleHeight(moduleId, span);
  const centeredX = x + Math.max(0, Math.round((zoneWidth - width) / 2));
  return normalizeWindowFrame({ x: centeredX, y, w: width, h: height, z });
}

function placeBottomFrame(
  moduleId: WorkspaceModuleId,
  x: number,
  y: number,
  z: number,
  moduleLayout: WorkspacePreferences["moduleLayout"],
): WorkspaceWindowFrame {
  const span = moduleLayout[moduleId]?.span ?? "medium";
  const width =
    span === "full" ? 960 : span === "wide" ? 620 : span === "medium" ? 460 : 340;
  const height = computeModuleHeight(moduleId, span);
  return normalizeWindowFrame({ x, y, w: width, h: height, z });
}

function computeModuleWidth(
  moduleId: WorkspaceModuleId,
  zoneWidth: number,
  span: WorkspaceModuleSpan,
) {
  const majorModule =
    moduleId === "lesson" ||
    moduleId === "private-notes" ||
    moduleId === "binder-notebook" ||
    moduleId === "desmos-graph";
  if (span === "full") {
    return Math.max(zoneWidth, majorModule ? 680 : 420);
  }

  if (majorModule) {
    if (span === "wide") {
      return Math.max(zoneWidth - 12, 620);
    }
    if (span === "medium") {
      return Math.max(Math.min(zoneWidth, 540), 480);
    }
  }

  if (span === "wide") {
    return Math.max(Math.min(zoneWidth, 520), 420);
  }
  if (span === "medium") {
    return Math.max(Math.min(zoneWidth, 420), 320);
  }
  if (span === "narrow") {
    return Math.max(Math.min(zoneWidth, 320), 260);
  }

  return Math.max(Math.min(zoneWidth, majorModule ? 620 : 420), majorModule ? 480 : 300);
}

function computeModuleHeight(moduleId: WorkspaceModuleId, span: WorkspaceModuleSpan) {
  if (moduleId === "lesson" || moduleId === "private-notes") {
    return span === "full" ? 820 : 760;
  }
  if (moduleId === "binder-notebook") {
    return span === "full" ? 840 : 780;
  }
  if (moduleId === "desmos-graph") {
    return 640;
  }
  if (moduleId === "scientific-calculator") {
    return 560;
  }
  if (moduleId === "saved-graphs") {
    return 320;
  }
  if (moduleId === "comments") {
    return 480;
  }
  if (moduleId === "lesson-outline") {
    return 380;
  }
  if (span === "wide") {
    return 360;
  }
  if (span === "narrow") {
    return 220;
  }
  return 280;
}

function createFloatingFallbackFrame(moduleId: WorkspaceModuleId, z: number): WorkspaceWindowFrame {
  const index = workspaceModules.findIndex((module) => module.id === moduleId);
  return normalizeWindowFrame({
    x: 200 + (index % 4) * 48,
    y: 120 + (index % 4) * 44,
    w: moduleId === "lesson" || moduleId === "private-notes" ? 620 : 360,
    h: computeModuleHeight(moduleId, moduleId === "lesson" || moduleId === "private-notes" ? "wide" : "medium"),
    z,
  });
}

function getWindowBounds(
  moduleIds: WorkspaceModuleId[],
  layout: WorkspacePreferences["windowLayout"],
) {
  const frames = moduleIds
    .map((moduleId) => layout[moduleId])
    .filter((frame): frame is WorkspaceWindowFrame => Boolean(frame));
  if (frames.length === 0) {
    return null;
  }

  const minX = Math.min(...frames.map((frame) => frame.x));
  const minY = Math.min(...frames.map((frame) => frame.y));
  const maxX = Math.max(...frames.map((frame) => frame.x + frame.w));
  const maxY = Math.max(...frames.map((frame) => frame.y + frame.h));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function normalizeWindowFrame(frame: WorkspaceWindowFrame): WorkspaceWindowFrame {
  return {
    x: clamp(Math.round(frame.x), 0, WINDOW_CANVAS_WIDTH * 2),
    y: clamp(Math.round(frame.y), 0, WORKSPACE_MAX_CANVAS_HEIGHT),
    w: clamp(Math.round(frame.w), 160, WINDOW_CANVAS_WIDTH),
    h: clamp(Math.round(frame.h), 160, WINDOW_CANVAS_HEIGHT),
    z: Math.max(1, Math.round(frame.z)),
  };
}

function normalizeModuleId(id: string): WorkspaceModuleId | null {
  const nextId =
    id === "concept-map" ? "related-concepts" : id === "graph-panel" ? "desmos-graph" : id;
  return workspaceModules.some((module) => module.id === nextId)
    ? (nextId as WorkspaceModuleId)
    : null;
}

function appendUnique(current: WorkspaceModuleId[], additions: WorkspaceModuleId[]) {
  return [...current, ...additions.filter((id) => !current.includes(id))];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hasImpossibleWindowShape(frame: WorkspaceWindowFrame) {
  return (
    !Number.isFinite(frame.x) ||
    !Number.isFinite(frame.y) ||
    !Number.isFinite(frame.w) ||
    !Number.isFinite(frame.h) ||
    frame.w <= 0 ||
    frame.h <= 0
  );
}

function framesOverlap(left: WorkspaceWindowFrame, right: WorkspaceWindowFrame) {
  return !(
    left.x + left.w <= right.x ||
    right.x + right.w <= left.x ||
    left.y + left.h <= right.y ||
    right.y + right.h <= left.y
  );
}
