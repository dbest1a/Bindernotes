import type {
  HighlightColor,
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
  WorkspaceStyle,
  WorkspaceThemeSettings,
  WorkspaceThemeId,
  WorkspaceVerticalSpace,
  WorkspaceWindowFrame,
  WorkspaceZone,
} from "@/types";
import { SYSTEM_BINDER_IDS, systemSuiteTemplates } from "@/lib/history-suite-seeds";
import { getPresetDefinition, gridLayoutToWindowFrames } from "@/lib/preset-validator";

export type WorkspacePreset = {
  id: WorkspacePresetId;
  name: string;
  description: string;
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

const WINDOW_CANVAS_WIDTH = 1920;
const WINDOW_CANVAS_HEIGHT = 1600;
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
    description: "A graph-first workspace that gives equations, notes, and reference panels different jobs.",
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
        lesson: frame(20, 20, 260, 1320, 1),
        "private-notes": frame(300, 20, 1020, 1380, 2),
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
        lesson: frame(20, 20, 260, 420, 1),
        "private-notes": frame(300, 20, 1020, 1400, 2),
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
      enabledModules: ["lesson", "private-notes", "desmos-graph", "scientific-calculator"],
      zones: zones(["lesson"], ["private-notes", "desmos-graph"], [], ["scientific-calculator"]),
      paneLayout: paneLayout(18, 56, 0, 26),
      windowLayout: {
        lesson: frame(20, 20, 320, 240, 1),
        "private-notes": frame(20, 280, 320, 1000, 2),
        "desmos-graph": frame(360, 20, 1020, 1260, 3),
        "scientific-calculator": frame(1400, 20, 500, 520, 4),
      },
      moduleLayout: {
        lesson: { span: "medium", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "desmos-graph": { span: "full" },
        "scientific-calculator": { span: "wide" },
      },
    },
    {
      enabledModules: ["lesson", "private-notes", "desmos-graph", "scientific-calculator", "saved-graphs"],
      zones: zones(["lesson"], ["desmos-graph"], ["private-notes", "saved-graphs"], ["scientific-calculator"]),
      paneLayout: paneLayout(14, 56, 30, 0),
      windowLayout: {
        lesson: frame(20, 20, 260, 220, 1),
        "desmos-graph": frame(20, 280, 1200, 1180, 2),
        "private-notes": frame(1240, 20, 660, 500, 3),
        "scientific-calculator": frame(1240, 560, 320, 340, 4),
        "saved-graphs": frame(1580, 560, 320, 340, 5),
      },
      moduleLayout: {
        lesson: { span: "medium", pinned: true },
        "private-notes": { span: "wide", pinned: true },
        "desmos-graph": { span: "full" },
        "scientific-calculator": { span: "medium" },
        "saved-graphs": { span: "medium" },
      },
    },
    {
      enabledModules: ["lesson", "private-notes", "desmos-graph", "scientific-calculator", "saved-graphs", "formula-sheet", "math-blocks"],
      zones: zones(["lesson", "formula-sheet"], ["desmos-graph"], ["private-notes", "math-blocks"], ["scientific-calculator", "saved-graphs"]),
      paneLayout: paneLayout(14, 54, 32, 0),
      windowLayout: {
        lesson: frame(20, 20, 260, 220, 1),
        "formula-sheet": frame(20, 280, 260, 300, 2),
        "desmos-graph": frame(300, 20, 1020, 1200, 3),
        "private-notes": frame(1340, 20, 560, 500, 4),
        "scientific-calculator": frame(1340, 560, 260, 320, 5),
        "saved-graphs": frame(1640, 560, 260, 320, 6),
        "math-blocks": frame(300, 1240, 1020, 280, 7),
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
];

export const accentOptions = [
  { name: "Teal", value: "172 82% 27%" },
  { name: "Blue", value: "212 86% 52%" },
  { name: "Indigo", value: "233 74% 55%" },
  { name: "Violet", value: "267 74% 48%" },
  { name: "Rose", value: "342 76% 48%" },
  { name: "Amber", value: "35 92% 48%" },
  { name: "Emerald", value: "160 84% 32%" },
  { name: "Graphite", value: "0 0% 12%" },
];

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
      return {
        enabledModules,
        zones: buildZonesFromGridLayout(enabledModules),
        paneLayout: buildPaneLayoutFromGrid(enabledModules),
        windowLayout: gridLayoutToWindowFrames(breakpointLayout),
        moduleLayout: buildModuleLayoutFromGrid(enabledModules, breakpointLayout),
      };
    }
  }

  const baseLayout =
    workspacePresetLayouts[presetId]?.[workspaceStyle] ??
    workspacePresetLayouts[defaultPreset.id]?.[workspaceStyle] ??
    workspacePresetLayouts[defaultPreset.id]?.guided;

  if (!baseLayout) {
    throw new Error(`Workspace preset layout is missing for ${presetId}.`);
  }

  return packPresetWindowLayout(baseLayout, workspaceStyle);
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
  accent: defaultTheme.vars.primary,
  density: "cozy",
  roundness: "round",
  shadow: "lifted",
  font: "system",
  backgroundStyle: "subtle-grid",
  hoverMotion: false,
  snapMode: false,
  focusMode: false,
  compactMode: false,
  animationLevel: "subtle",
  graphAppearance: "sync",
  graphChrome: "standard",
  verticalSpace: "balanced",
  defaultHighlightColor: "yellow",
  reducedChrome: true,
  showUtilityUi: false,
};

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
  return ensureWindowFramesForEnabledModules({
    version: 1,
    userId,
    binderId,
    suiteTemplateId: suiteTemplateId ?? null,
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
    theme: loadGlobalThemeSettings(),
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

export function applyWorkspaceStyle(
  preferences: WorkspacePreferences,
  workspaceStyle: WorkspaceStyle,
): WorkspacePreferences {
  const nextBase: WorkspacePreferences = {
    ...preferences,
    workspaceStyle,
    styleChoiceCompleted: true,
    locked: workspaceStyle === "full-studio" ? false : true,
    updatedAt: new Date().toISOString(),
  };

  return applyPreset(nextBase, nextBase.preset ?? defaultPreset.id);
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
  saveGlobalThemeSettings(next.theme);
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
) {
  const width = Math.round(viewport.width);
  const height = Math.round(viewport.height);
  if (width < 320 || height < 240) {
    return preferences;
  }

  const visibleModules = preferences.enabledModules.filter(
    (moduleId) =>
      preferences.windowLayout[moduleId] &&
      !preferences.moduleLayout[moduleId]?.collapsed,
  );
  if (visibleModules.length === 0) {
    return preferences;
  }

  const bounds = getWindowBounds(visibleModules, preferences.windowLayout);
  if (!bounds) {
    return preferences;
  }

  const outerPaddingX = preferences.workspaceStyle === "guided" ? 12 : 8;
  const outerPaddingY = 12;
  const widthFillTarget =
    preferences.workspaceStyle === "guided"
      ? 0.92
      : preferences.workspaceStyle === "flexible"
        ? 0.95
        : 0.972;
  const availableWidth = Math.max(320, width - outerPaddingX * 2);
  const verticalMetrics = resolveVerticalWorkspaceMetrics(
    preferences.theme.verticalSpace,
    height,
  );
  const availableHeight = verticalMetrics.availableHeight;
  const allowVerticalOverflow = preferences.theme.verticalSpace !== "fit";
  const previousViewport = preferences.viewportFit;
  const viewportChanged =
    !previousViewport ||
    Math.abs(previousViewport.width - width) > 120 ||
    Math.abs(previousViewport.height - height) > 120;
  const overflowing =
    bounds.width > availableWidth + 24 ||
    bounds.maxX > width + 16 ||
    (!allowVerticalOverflow &&
      (bounds.height > availableHeight + verticalMetrics.overflowTolerance ||
        bounds.maxY > height + 16));
  const underfilled =
    bounds.width < availableWidth * widthFillTarget ||
    (!allowVerticalOverflow &&
      bounds.height < availableHeight * verticalMetrics.underfillThreshold);

  if (!viewportChanged && !overflowing && !underfilled) {
    return preferences;
  }

  let scale = 1;
  const fitScale = allowVerticalOverflow
    ? availableWidth / Math.max(bounds.width, 1)
    : Math.min(
        availableWidth / Math.max(bounds.width, 1),
        availableHeight / Math.max(bounds.height, 1),
      );

  if (overflowing) {
    scale = Math.min(1, fitScale);
  } else if (underfilled && !previousViewport) {
    scale = Math.min(1.22, Math.max(1, fitScale * 0.992));
  } else if (underfilled && viewportChanged) {
    scale = Math.min(1.14, Math.max(1, fitScale * 0.985));
  }

  const fittedWidth = bounds.width * scale;
  const fittedHeight = bounds.height * scale;
  const offsetX =
    outerPaddingX + Math.max(0, (availableWidth - fittedWidth) / 2) - bounds.minX * scale;
  const offsetY =
    outerPaddingY +
    Math.max(
      0,
      Math.min(
        verticalMetrics.topSlack,
        (availableHeight - fittedHeight) / verticalMetrics.topSlackDivisor,
      ),
    ) -
    bounds.minY * scale;

  let changed = false;
  const nextWindowLayout = { ...preferences.windowLayout };

  visibleModules.forEach((moduleId) => {
    const frame = preferences.windowLayout[moduleId];
    if (!frame) {
      return;
    }

    const nextFrame = normalizeWindowFrame({
      x: offsetX + frame.x * scale,
      y: offsetY + frame.y * scale,
      w: frame.w * scale,
      h: frame.h * scale,
      z: frame.z,
    });

    if (
      nextFrame.x !== frame.x ||
      nextFrame.y !== frame.y ||
      nextFrame.w !== frame.w ||
      nextFrame.h !== frame.h
    ) {
      changed = true;
      nextWindowLayout[moduleId] = nextFrame;
    }
  });

  const nextStickyNotes = { ...preferences.stickyNotes };
  Object.entries(preferences.stickyNotes).forEach(([commentId, sticky]) => {
    const nextSticky = {
      ...sticky,
      x: clamp(Math.round(offsetX + sticky.x * scale), 8, Math.max(8, width - sticky.w - 8)),
      y: clamp(Math.round(offsetY + sticky.y * scale), 8, Math.max(8, height - (sticky.minimized ? 56 : sticky.h) - 8)),
    };
    if (nextSticky.x !== sticky.x || nextSticky.y !== sticky.y) {
      changed = true;
      nextStickyNotes[commentId] = nextSticky;
    }
  });

  if (!changed && previousViewport?.width === width && previousViewport?.height === height) {
    return preferences;
  }

  return {
    ...preferences,
    windowLayout: nextWindowLayout,
    stickyNotes: nextStickyNotes,
    viewportFit: {
      width,
      height,
      updatedAt: new Date().toISOString(),
    },
  };
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
    return normalizeThemeSettings(parsed);
  } catch {
    return defaultThemeSettings;
  }
}

export function saveGlobalThemeSettings(theme: WorkspaceThemeSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(globalThemeStorageKey, JSON.stringify(theme));
}

export function applyThemeSettings(settings: WorkspaceThemeSettings) {
  const root = document.documentElement;
  const normalizedSettings = normalizeThemeSettings(settings);
  const theme =
    workspaceThemes.find((candidate) => candidate.id === normalizedSettings.id) ?? defaultTheme;
  const darkSurface = theme.vars.background.match(/(\d+)%$/)?.[1];
  const isDark =
    darkSurface ? Number(darkSurface) < 20 : theme.id === "space" || theme.id === "midnight-scholar";
  const vars = {
    "--background": theme.vars.background,
    "--foreground": theme.vars.foreground,
    "--card": theme.vars.card,
    "--card-foreground": theme.vars.cardForeground,
    "--popover": theme.vars.card,
    "--popover-foreground": theme.vars.cardForeground,
    "--secondary": theme.vars.secondary,
    "--secondary-foreground": theme.vars.foreground,
    "--muted": theme.vars.muted,
    "--muted-foreground": theme.vars.mutedForeground,
    "--accent": theme.vars.accent,
    "--accent-foreground": theme.vars.foreground,
    "--border": theme.vars.border,
    "--input": theme.vars.border,
    "--ring": normalizedSettings.accent,
    "--primary": normalizedSettings.accent || theme.vars.primary,
    "--primary-foreground":
      theme.id.includes("midnight") || theme.id === "space" ? "220 16% 8%" : "0 0% 100%",
  };

  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  root.dataset.workspaceTheme = theme.id;
  root.dataset.workspaceDensity = normalizedSettings.density;
  root.dataset.workspaceRoundness = normalizedSettings.roundness;
  root.dataset.workspaceShadow = normalizedSettings.shadow;
  root.dataset.workspaceFont = normalizedSettings.font;
  root.dataset.workspaceBackground = normalizedSettings.backgroundStyle;
  root.dataset.workspaceHoverMotion = normalizedSettings.hoverMotion ? "on" : "off";
  root.dataset.workspaceSnapMode = normalizedSettings.snapMode ? "on" : "off";
  root.dataset.workspaceFocusMode = normalizedSettings.focusMode ? "on" : "off";
  root.dataset.workspaceCompactMode = normalizedSettings.compactMode ? "on" : "off";
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

  const normalized: WorkspacePreferences = {
    ...preferences,
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
    theme: normalizeThemeSettings({
      ...loadGlobalThemeSettings(),
      ...preferences.theme,
    }),
  };

  const shouldAutoAttachMathModules =
    normalized.enabledModules.some((id) =>
      ["formula-sheet", "math-blocks"].includes(id),
    );

  const withMath = shouldAutoAttachMathModules ? ensureMathWorkspaceModules(normalized) : normalized;
  return ensureWindowFramesForEnabledModules(withMath);
}

function normalizeThemeSettings(settings?: Partial<WorkspaceThemeSettings>): WorkspaceThemeSettings {
  const nextId =
    settings?.id && workspaceThemes.some((theme) => theme.id === settings.id)
      ? (settings.id as WorkspaceThemeId)
      : defaultThemeSettings.id;
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

  return {
    ...defaultThemeSettings,
    ...settings,
    id: nextId,
    accent: settings?.accent || defaultThemeSettings.accent,
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
        canvasPadding: 40,
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
    y: clamp(Math.round(frame.y), 0, WINDOW_CANVAS_HEIGHT * 2),
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
