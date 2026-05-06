import type { FaceliftDensity, WorkspaceModuleId, WorkspacePresetId, WorkspaceWindowFrame } from "@/types";

export type WorkspacePresetLayoutRecipe =
  | "reading-with-outline"
  | "split-even"
  | "notes-dominant"
  | "lesson-with-annotation-rail"
  | "graph-dominant"
  | "lesson-primary-rail"
  | "concept-primary-rail"
  | "practice-primary-rail"
  | "math-studio-zones"
  | "history-guided-zones"
  | "timeline-primary-rail"
  | "source-evidence-zones"
  | "argument-primary-rail"
  | "history-studio-zones";

export type WorkspacePresetDesign = {
  id: WorkspacePresetId;
  purpose: string;
  primary: WorkspaceModuleId[];
  secondary: WorkspaceModuleId[];
  optional: WorkspaceModuleId[];
  defaultVisible: WorkspaceModuleId[];
  compactVisible?: WorkspaceModuleId[];
  smallScreenVisible: WorkspaceModuleId[];
  collapsedByDefault: WorkspaceModuleId[];
  desktopRecipe: WorkspacePresetLayoutRecipe;
  smallScreenRecipe: WorkspacePresetLayoutRecipe;
  fitStrategy: "preserve-composition";
};

export type FaceliftWorkspacePresetDesign = {
  id: WorkspacePresetId;
  purpose: string;
  primaryModule: WorkspaceModuleId;
  secondaryModules: WorkspaceModuleId[];
  optionalModules: WorkspaceModuleId[];
  visibleModules: WorkspaceModuleId[];
  collapsedModules: WorkspaceModuleId[];
  densityVisibleModules: Record<FaceliftDensity, WorkspaceModuleId[]>;
  minimumUsefulSizes: Partial<Record<WorkspaceModuleId, MinimumSize>>;
  layoutRecipe: {
    desktop: string;
    laptop: string;
    tablet: string;
    phone: string;
  };
  placement: {
    desktopPriority: WorkspaceModuleId[];
    canvasRecipe: string;
    collapseFirst: WorkspaceModuleId[];
  };
  graphIntegration?: {
    module: "desmos-graph";
    companionModules: WorkspaceModuleId[];
    placement: string;
    collapsedWhenUnavailable: WorkspaceModuleId[];
  };
  historyWorkflow?: {
    leadModule: WorkspaceModuleId;
    sequence: WorkspaceModuleId[];
    studentGoal: string;
  };
  reasoning: string;
};

export type WorkspacePresetRuntimeAvailability = {
  desmosApiKeyAvailable?: boolean;
  desmosGraphEnabled?: boolean;
  scientificCalculatorEnabled?: boolean;
};

export type WorkspaceMobileModuleTab = {
  moduleId: WorkspaceModuleId;
  label: string;
};

type MinimumSize = {
  width: number;
  height: number;
};

const moduleMinimumSizes: Partial<
  Record<WorkspaceModuleId, MinimumSize | { primary: MinimumSize; secondary: MinimumSize }>
> = {
  lesson: { width: 420, height: 360 },
  "private-notes": { width: 480, height: 360 },
  "binder-notebook": { width: 560, height: 420 },
  "lesson-outline": { width: 220, height: 220 },
  search: { width: 280, height: 220 },
  comments: { width: 320, height: 280 },
  "recent-highlights": { width: 300, height: 240 },
  tasks: { width: 300, height: 240 },
  "formula-sheet": { width: 320, height: 260 },
  "math-blocks": { width: 420, height: 300 },
  "related-concepts": { width: 320, height: 260 },
  "desmos-graph": {
    primary: { width: 620, height: 480 },
    secondary: { width: 480, height: 320 },
  },
  "scientific-calculator": { width: 320, height: 320 },
  "saved-graphs": { width: 320, height: 240 },
  whiteboard: {
    primary: { width: 640, height: 480 },
    secondary: { width: 520, height: 360 },
  },
  "history-timeline": { width: 420, height: 340 },
  "history-evidence": { width: 420, height: 320 },
  "history-argument": {
    primary: { width: 520, height: 360 },
    secondary: { width: 420, height: 320 },
  },
  "history-myth-checks": { width: 320, height: 260 },
};

export function getWorkspaceModuleMinimumSize(
  moduleId: WorkspaceModuleId,
  role: "primary" | "secondary" = "secondary",
): MinimumSize {
  const minimum = moduleMinimumSizes[moduleId];
  if (!minimum) {
    return { width: 280, height: 220 };
  }

  if ("primary" in minimum) {
    return minimum[role];
  }

  return minimum;
}

export const workspacePresetDesigns = {
  "focused-reading": {
    id: "focused-reading",
    purpose: "Read a lesson or source with just enough navigation to stay oriented.",
    primary: ["lesson"],
    secondary: ["lesson-outline"],
    optional: ["search", "recent-highlights", "related-concepts"],
    defaultVisible: ["lesson", "lesson-outline"],
    compactVisible: ["lesson", "lesson-outline"],
    smallScreenVisible: ["lesson"],
    collapsedByDefault: ["search", "recent-highlights", "related-concepts"],
    desktopRecipe: "reading-with-outline",
    smallScreenRecipe: "reading-with-outline",
    fitStrategy: "preserve-composition",
  },
  "split-study": {
    id: "split-study",
    purpose: "Read source material and write private notes with equal visual priority.",
    primary: ["lesson", "private-notes"],
    secondary: [],
    optional: ["recent-highlights", "tasks", "comments"],
    defaultVisible: ["lesson", "private-notes"],
    compactVisible: ["lesson", "private-notes"],
    smallScreenVisible: ["lesson", "private-notes"],
    collapsedByDefault: ["recent-highlights", "tasks", "comments"],
    desktopRecipe: "split-even",
    smallScreenRecipe: "split-even",
    fitStrategy: "preserve-composition",
  },
  "notes-focus": {
    id: "notes-focus",
    purpose: "Write substantial notes while keeping a readable source reference nearby.",
    primary: ["private-notes"],
    secondary: ["lesson"],
    optional: ["binder-notebook", "recent-highlights", "comments"],
    defaultVisible: ["private-notes", "lesson"],
    compactVisible: ["private-notes", "lesson"],
    smallScreenVisible: ["private-notes", "lesson"],
    collapsedByDefault: ["binder-notebook", "recent-highlights", "comments"],
    desktopRecipe: "notes-dominant",
    smallScreenRecipe: "notes-dominant",
    fitStrategy: "preserve-composition",
  },
  "annotation-mode": {
    id: "annotation-mode",
    purpose: "Keep the lesson central while showing the annotation surfaces that support close reading.",
    primary: ["lesson"],
    secondary: ["private-notes", "comments", "recent-highlights"],
    optional: ["lesson-outline", "search", "related-concepts"],
    defaultVisible: ["lesson", "private-notes", "comments", "recent-highlights"],
    compactVisible: ["lesson", "private-notes"],
    smallScreenVisible: ["lesson", "private-notes"],
    collapsedByDefault: ["lesson-outline", "search", "related-concepts"],
    desktopRecipe: "lesson-with-annotation-rail",
    smallScreenRecipe: "lesson-primary-rail",
    fitStrategy: "preserve-composition",
  },
  "math-study": {
    id: "math-study",
    purpose: "Use graphing, source context, notes, and formulas without turning study into a tool dump.",
    primary: ["desmos-graph"],
    secondary: ["lesson", "private-notes", "formula-sheet"],
    optional: ["saved-graphs", "scientific-calculator", "math-blocks", "whiteboard"],
    defaultVisible: ["desmos-graph", "lesson", "private-notes", "formula-sheet"],
    compactVisible: ["desmos-graph", "formula-sheet", "private-notes"],
    smallScreenVisible: ["desmos-graph", "formula-sheet"],
    collapsedByDefault: ["saved-graphs", "scientific-calculator", "math-blocks", "whiteboard"],
    desktopRecipe: "graph-dominant",
    smallScreenRecipe: "graph-dominant",
    fitStrategy: "preserve-composition",
  },
  "math-simple-presentation": {
    id: "math-simple-presentation",
    purpose: "Present a math lesson calmly with notes and formulas nearby but advanced graph tools quiet.",
    primary: ["lesson"],
    secondary: ["private-notes", "formula-sheet", "desmos-graph"],
    optional: ["math-blocks", "saved-graphs", "scientific-calculator", "whiteboard"],
    defaultVisible: ["lesson", "private-notes", "formula-sheet"],
    compactVisible: ["lesson", "private-notes"],
    smallScreenVisible: ["lesson", "private-notes"],
    collapsedByDefault: ["desmos-graph", "math-blocks", "saved-graphs", "scientific-calculator", "whiteboard"],
    desktopRecipe: "lesson-primary-rail",
    smallScreenRecipe: "lesson-primary-rail",
    fitStrategy: "preserve-composition",
  },
  "math-guided-study": {
    id: "math-guided-study",
    purpose: "Study a math lesson with notes, worked blocks, and graph support arranged by learning priority.",
    primary: ["lesson"],
    secondary: ["private-notes", "math-blocks", "desmos-graph"],
    optional: ["formula-sheet", "saved-graphs", "scientific-calculator", "whiteboard"],
    defaultVisible: ["lesson", "private-notes", "math-blocks", "desmos-graph"],
    compactVisible: ["lesson", "private-notes", "math-blocks"],
    smallScreenVisible: ["lesson", "private-notes"],
    collapsedByDefault: ["formula-sheet", "saved-graphs", "scientific-calculator", "whiteboard"],
    desktopRecipe: "lesson-primary-rail",
    smallScreenRecipe: "lesson-primary-rail",
    fitStrategy: "preserve-composition",
  },
  "math-graph-lab": {
    id: "math-graph-lab",
    purpose: "Explore graph behavior with Desmos as the dominant work surface and helpers within reach.",
    primary: ["desmos-graph"],
    secondary: ["formula-sheet", "lesson", "private-notes"],
    optional: ["saved-graphs", "scientific-calculator", "math-blocks", "whiteboard"],
    defaultVisible: ["desmos-graph", "formula-sheet", "lesson", "private-notes"],
    compactVisible: ["desmos-graph", "formula-sheet", "private-notes"],
    smallScreenVisible: ["desmos-graph", "formula-sheet"],
    collapsedByDefault: ["saved-graphs", "scientific-calculator", "math-blocks", "whiteboard"],
    desktopRecipe: "graph-dominant",
    smallScreenRecipe: "graph-dominant",
    fitStrategy: "preserve-composition",
  },
  "math-proof-concept": {
    id: "math-proof-concept",
    purpose: "Understand formulas, concepts, and proof ideas without showing every math tool at once.",
    primary: ["lesson", "math-blocks"],
    secondary: ["related-concepts", "private-notes"],
    optional: [
      "formula-sheet",
      "desmos-graph",
      "scientific-calculator",
      "saved-graphs",
      "comments",
      "recent-highlights",
      "whiteboard",
    ],
    defaultVisible: ["lesson", "math-blocks", "related-concepts", "private-notes"],
    compactVisible: ["lesson", "math-blocks", "private-notes"],
    smallScreenVisible: ["lesson", "math-blocks"],
    collapsedByDefault: [
      "formula-sheet",
      "desmos-graph",
      "scientific-calculator",
      "saved-graphs",
      "comments",
      "recent-highlights",
      "whiteboard",
    ],
    desktopRecipe: "concept-primary-rail",
    smallScreenRecipe: "concept-primary-rail",
    fitStrategy: "preserve-composition",
  },
  "math-practice-mode": {
    id: "math-practice-mode",
    purpose: "Solve problems with a large scratch board, notes, formula reference, and source context nearby.",
    primary: ["whiteboard", "math-blocks"],
    secondary: ["private-notes", "formula-sheet", "lesson"],
    optional: ["desmos-graph", "scientific-calculator", "saved-graphs"],
    defaultVisible: ["whiteboard", "math-blocks", "private-notes", "formula-sheet"],
    compactVisible: ["whiteboard", "private-notes"],
    smallScreenVisible: ["whiteboard"],
    collapsedByDefault: ["desmos-graph", "scientific-calculator", "saved-graphs", "lesson"],
    desktopRecipe: "practice-primary-rail",
    smallScreenRecipe: "practice-primary-rail",
    fitStrategy: "preserve-composition",
  },
  "full-math-canvas": {
    id: "full-math-canvas",
    purpose: "Give advanced math work multiple readable zones without collapsing into tiny utility boxes.",
    primary: ["desmos-graph", "whiteboard", "math-blocks"],
    secondary: ["lesson", "private-notes", "formula-sheet", "related-concepts"],
    optional: ["saved-graphs", "scientific-calculator", "comments", "recent-highlights"],
    defaultVisible: [
      "desmos-graph",
      "whiteboard",
      "math-blocks",
      "lesson",
      "private-notes",
      "formula-sheet",
      "related-concepts",
    ],
    compactVisible: ["whiteboard"],
    smallScreenVisible: ["whiteboard"],
    collapsedByDefault: ["saved-graphs", "scientific-calculator", "comments", "recent-highlights"],
    desktopRecipe: "math-studio-zones",
    smallScreenRecipe: "math-studio-zones",
    fitStrategy: "preserve-composition",
  },
  "history-guided": {
    id: "history-guided",
    purpose: "Study history through source, chronology, evidence, and note capture in a calm loop.",
    primary: ["lesson", "history-timeline"],
    secondary: ["history-evidence", "private-notes"],
    optional: ["history-argument", "history-myth-checks"],
    defaultVisible: ["lesson", "history-timeline", "history-evidence", "private-notes"],
    compactVisible: ["lesson", "history-timeline", "history-evidence", "private-notes"],
    smallScreenVisible: ["lesson", "history-timeline"],
    collapsedByDefault: ["history-argument", "history-myth-checks"],
    desktopRecipe: "history-guided-zones",
    smallScreenRecipe: "history-guided-zones",
    fitStrategy: "preserve-composition",
  },
  "history-timeline-focus": {
    id: "history-timeline-focus",
    purpose: "Make chronology the central object while source and notes explain what happened.",
    primary: ["history-timeline"],
    secondary: ["lesson", "private-notes"],
    optional: ["history-evidence", "history-argument", "history-myth-checks"],
    defaultVisible: ["history-timeline", "lesson", "private-notes"],
    compactVisible: ["history-timeline", "lesson", "private-notes"],
    smallScreenVisible: ["history-timeline", "lesson"],
    collapsedByDefault: ["history-evidence", "history-argument", "history-myth-checks"],
    desktopRecipe: "timeline-primary-rail",
    smallScreenRecipe: "timeline-primary-rail",
    fitStrategy: "preserve-composition",
  },
  "history-source-evidence": {
    id: "history-source-evidence",
    purpose: "Keep source reading and evidence collection central for close historical analysis.",
    primary: ["lesson", "history-evidence"],
    secondary: ["private-notes"],
    optional: ["history-timeline", "history-argument", "history-myth-checks"],
    defaultVisible: ["lesson", "history-evidence", "private-notes"],
    compactVisible: ["lesson", "history-evidence", "private-notes"],
    smallScreenVisible: ["lesson", "history-evidence"],
    collapsedByDefault: ["history-timeline", "history-argument", "history-myth-checks"],
    desktopRecipe: "source-evidence-zones",
    smallScreenRecipe: "source-evidence-zones",
    fitStrategy: "preserve-composition",
  },
  "history-argument-builder": {
    id: "history-argument-builder",
    purpose: "Give argument writing the largest surface with evidence and source close enough to cite.",
    primary: ["history-argument"],
    secondary: ["history-evidence", "lesson"],
    optional: ["history-timeline", "private-notes", "history-myth-checks"],
    defaultVisible: ["history-argument", "history-evidence", "lesson"],
    compactVisible: ["history-argument", "history-evidence", "lesson"],
    smallScreenVisible: ["history-argument", "history-evidence"],
    collapsedByDefault: ["history-timeline", "private-notes", "history-myth-checks"],
    desktopRecipe: "argument-primary-rail",
    smallScreenRecipe: "argument-primary-rail",
    fitStrategy: "preserve-composition",
  },
  "history-full-studio": {
    id: "history-full-studio",
    purpose: "Organize source, timeline, evidence, and argument into readable advanced history zones.",
    primary: ["lesson", "history-timeline", "history-evidence", "history-argument"],
    secondary: [],
    optional: ["private-notes", "history-myth-checks"],
    defaultVisible: ["lesson", "history-timeline", "history-evidence", "history-argument"],
    compactVisible: ["lesson", "history-timeline", "history-evidence", "history-argument"],
    smallScreenVisible: ["lesson", "history-timeline"],
    collapsedByDefault: ["private-notes", "history-myth-checks"],
    desktopRecipe: "history-studio-zones",
    smallScreenRecipe: "history-studio-zones",
    fitStrategy: "preserve-composition",
  },
} satisfies Record<WorkspacePresetId, WorkspacePresetDesign>;

export function getWorkspacePresetDesign(presetId: WorkspacePresetId) {
  return workspacePresetDesigns[presetId];
}

const faceliftPresetReasoning: Record<WorkspacePresetId, string> = {
  "focused-reading": "Reading stays primary while outline, notes, highlights, and tools stay reachable without crowding the source.",
  "split-study": "Source and private notes are equal partners, so the facelift recipe keeps both as full-height half panes.",
  "notes-focus": "Writing gets the dominant surface while the source remains a compact reference for citations and examples.",
  "annotation-mode": "Markup and close reading stay centered, with comments and highlights supporting the source instead of burying it.",
  "math-study": "General math study needs lesson, notes, formulas, and graph access without loading every math utility at once.",
  "math-simple-presentation": "Math presentation starts with lesson and notes, while formulas and graph tools stay secondary.",
  "math-guided-study": "Guided math learning starts from content and notes, then brings math blocks and graphing in as support.",
  "math-graph-lab": "Graph work needs the largest usable surface, with formulas, source, and notes close enough for interpretation.",
  "math-proof-concept": "Concept and proof work needs reasoning space, related ideas, and notes more than calculator clutter.",
  "math-practice-mode": "Problem solving gets the primary working area, with formula and lesson references opening when useful.",
  "full-math-canvas": "The full math canvas can expose more power, but optional tools stay collapsed before panels become tiny.",
  "history-guided": "History study works best as source, chronology, evidence, and notes in one readable loop.",
  "history-timeline-focus": "Timeline is the anchor, while source and notes explain chronology without competing for the main surface.",
  "history-source-evidence": "Close reading and evidence collection stay primary, with timeline and argument tools available on demand.",
  "history-argument-builder": "Argument writing gets the largest surface, with source and evidence positioned nearby for support.",
  "history-full-studio": "The full history studio exposes source, timeline, evidence, and argument without turning the workspace chaotic.",
};

const faceliftRecipeLabels: Record<WorkspacePresetLayoutRecipe, FaceliftWorkspacePresetDesign["layoutRecipe"]> = {
  "reading-with-outline": {
    desktop: "Wide source column with a slim hierarchy and outline rail.",
    laptop: "Source remains wide while outline compresses into a quiet side rail.",
    tablet: "Lesson appears first with outline and notes available as stacked sections.",
    phone: "Lesson tab opens first; notes, highlights, and tools become purpose tabs.",
  },
  "split-even": {
    desktop: "Two full-height panes split exactly 50/50 between source and notes.",
    laptop: "Two balanced panes keep the midpoint exact while module chrome shrinks.",
    tablet: "Lesson and notes stack with large touch targets and persistent context.",
    phone: "Lesson and Notes tabs replace draggable windows.",
  },
  "notes-dominant": {
    desktop: "Private notes take the largest writing lane with source as reference.",
    laptop: "Notes remain dominant while source uses a narrower reference column.",
    tablet: "Notes lead the vertical flow, then source and support modules follow.",
    phone: "Notes tab opens first, with lesson and tools one tap away.",
  },
  "lesson-with-annotation-rail": {
    desktop: "Source fills the main lane with comments and highlights in a compact rail.",
    laptop: "Annotation tools collapse before reducing source and notes below useful size.",
    tablet: "Source, notes, and highlights become stacked touch-friendly panels.",
    phone: "Lesson, Notes, Highlights, and Tools tabs replace side rails.",
  },
  "graph-dominant": {
    desktop: "Graph is the primary canvas with formulas, lesson, and notes beside it.",
    laptop: "Graph keeps priority while helper panels collapse before becoming strips.",
    tablet: "Graph and formulas lead, followed by lesson and notes.",
    phone: "Graph, Formulas, Lesson, Notes, and Tools tabs keep math surfaces readable.",
  },
  "lesson-primary-rail": {
    desktop: "Lesson anchors the layout with notes and subject tools in supporting rails.",
    laptop: "Lesson stays readable while helpers use compact stacked rails.",
    tablet: "Lesson and notes stack before subject tools.",
    phone: "Lesson opens first with notes and subject tools in tabs.",
  },
  "concept-primary-rail": {
    desktop: "Concept work gets lesson and reasoning blocks as the main lane.",
    laptop: "Reasoning blocks and notes stay readable while tools collapse.",
    tablet: "Concept, notes, and source stack in learning order.",
    phone: "Lesson and Work tabs come first, then Notes and Tools.",
  },
  "practice-primary-rail": {
    desktop: "Practice surface dominates with notes and formulas supporting problem solving.",
    laptop: "Practice remains large; calculators and saved graphs stay collapsed.",
    tablet: "Practice, notes, and formulas stack with source reference below.",
    phone: "Practice or Work tab opens first, followed by Notes, Formulas, and Lesson.",
  },
  "math-studio-zones": {
    desktop: "Graph or board, math blocks, source, notes, and formulas occupy readable zones.",
    laptop: "Studio zones collapse optional tools before shrinking core math surfaces.",
    tablet: "Math studio becomes ordered sections instead of tiny desktop windows.",
    phone: "Subject tabs replace the full freeform studio.",
  },
  "history-guided-zones": {
    desktop: "Source, timeline, evidence, and notes form the primary history loop.",
    laptop: "Evidence and notes share support space while source and timeline remain readable.",
    tablet: "History modules stack as Lesson, Timeline, Evidence, Notes.",
    phone: "History tabs keep chronology, evidence, argument, and notes separate.",
  },
  "timeline-primary-rail": {
    desktop: "Timeline dominates with source and notes as explanation rails.",
    laptop: "Timeline keeps height while supporting rails compact.",
    tablet: "Timeline appears first, then source and notes.",
    phone: "Timeline, Lesson, and Notes tabs keep chronology usable.",
  },
  "source-evidence-zones": {
    desktop: "Source and evidence share the main area, with notes close by.",
    laptop: "Evidence stays readable while secondary history tools collapse.",
    tablet: "Source, evidence, and notes stack for close reading.",
    phone: "Lesson, Evidence, and Notes tabs replace desktop zones.",
  },
  "argument-primary-rail": {
    desktop: "Argument builder gets the widest lane with evidence and source nearby.",
    laptop: "Argument remains primary while evidence/source compact into support lanes.",
    tablet: "Argument, evidence, and lesson stack in drafting order.",
    phone: "Argument, Evidence, Lesson, Timeline, and Notes tabs keep drafting readable.",
  },
  "history-studio-zones": {
    desktop: "Source, timeline, evidence, and argument each get a readable studio zone.",
    laptop: "Full studio hides optional modules before core history zones become cramped.",
    tablet: "History studio becomes ordered source, timeline, evidence, and argument sections.",
    phone: "History tabs replace the desktop studio.",
  },
};

type FaceliftPresetDesignOverride = {
  primaryModule?: WorkspaceModuleId;
  secondaryModules?: WorkspaceModuleId[];
  visibleModules?: WorkspaceModuleId[];
  collapsedModules?: WorkspaceModuleId[];
  densityVisibleModules?: Partial<Record<FaceliftDensity, WorkspaceModuleId[]>>;
  placement?: FaceliftWorkspacePresetDesign["placement"];
  graphIntegration?: FaceliftWorkspacePresetDesign["graphIntegration"];
  historyWorkflow?: FaceliftWorkspacePresetDesign["historyWorkflow"];
  reasoning?: string;
};

const defaultFaceliftPlacement: FaceliftWorkspacePresetDesign["placement"] = {
  desktopPriority: ["lesson", "private-notes"],
  canvasRecipe: "Place the primary study surface first, then keep support modules close enough to use without clutter.",
  collapseFirst: ["search", "tasks", "flashcards", "mini-tools"],
};

const graphToolCollapseOrder: WorkspaceModuleId[] = [
  "scientific-calculator",
  "saved-graphs",
  "whiteboard",
  "comments",
  "recent-highlights",
];

const historyToolCollapseOrder: WorkspaceModuleId[] = [
  "history-myth-checks",
  "comments",
  "recent-highlights",
  "search",
  "tasks",
];

const faceliftPresetOverrides: Partial<Record<WorkspacePresetId, FaceliftPresetDesignOverride>> = {
  "focused-reading": {
    densityVisibleModules: {
      comfortable: ["lesson", "lesson-outline"],
      compact: ["lesson", "lesson-outline"],
      focus: ["lesson"],
    },
    placement: {
      desktopPriority: ["lesson", "lesson-outline"],
      canvasRecipe: "Source owns the wide reading lane; outline sits as the only persistent navigation rail.",
      collapseFirst: ["search", "recent-highlights", "related-concepts", "tasks"],
    },
  },
  "split-study": {
    densityVisibleModules: {
      comfortable: ["lesson", "private-notes"],
      compact: ["lesson", "private-notes"],
      focus: ["lesson", "private-notes"],
    },
    placement: {
      desktopPriority: ["lesson", "private-notes"],
      canvasRecipe: "Lesson starts at the left edge and private notes begin exactly at the midpoint.",
      collapseFirst: ["recent-highlights", "tasks", "comments", "search"],
    },
  },
  "notes-focus": {
    densityVisibleModules: {
      comfortable: ["private-notes", "lesson", "recent-highlights"],
      compact: ["private-notes", "lesson"],
      focus: ["private-notes"],
    },
    placement: {
      desktopPriority: ["private-notes", "lesson"],
      canvasRecipe: "Notes get the largest writing surface; lesson stays as a compact citation/reference panel.",
      collapseFirst: ["binder-notebook", "comments", "recent-highlights", "tasks"],
    },
  },
  "annotation-mode": {
    densityVisibleModules: {
      comfortable: ["lesson", "private-notes", "comments", "recent-highlights"],
      compact: ["lesson", "private-notes", "comments"],
      focus: ["lesson", "private-notes"],
    },
    placement: {
      desktopPriority: ["lesson", "comments", "recent-highlights", "private-notes"],
      canvasRecipe: "Source remains the markup surface while comments/highlights form a right-side annotation lane.",
      collapseFirst: ["search", "related-concepts", "lesson-outline", "tasks"],
    },
  },
  "math-study": {
    primaryModule: "desmos-graph",
    secondaryModules: ["lesson", "private-notes", "formula-sheet"],
    visibleModules: ["desmos-graph", "lesson", "private-notes", "formula-sheet"],
    densityVisibleModules: {
      comfortable: ["desmos-graph", "lesson", "private-notes", "formula-sheet"],
      compact: ["desmos-graph", "private-notes", "formula-sheet"],
      focus: ["desmos-graph", "private-notes"],
    },
    placement: {
      desktopPriority: ["desmos-graph", "lesson", "private-notes", "formula-sheet"],
      canvasRecipe: "Desmos anchors the middle of the workspace with lesson and notes on opposite study rails.",
      collapseFirst: graphToolCollapseOrder,
    },
    graphIntegration: {
      module: "desmos-graph",
      companionModules: ["formula-sheet", "lesson", "private-notes"],
      placement: "Keep graph large enough for interaction; formulas and notes stay beside it, not below as thin strips.",
      collapsedWhenUnavailable: ["saved-graphs", "scientific-calculator"],
    },
    reasoning:
      "General math study now treats Desmos as a real workspace surface while lesson, formulas, and notes explain the graph.",
  },
  "math-simple-presentation": {
    secondaryModules: ["private-notes", "formula-sheet", "desmos-graph"],
    visibleModules: ["lesson", "private-notes", "formula-sheet", "desmos-graph"],
    densityVisibleModules: {
      comfortable: ["lesson", "private-notes", "formula-sheet", "desmos-graph"],
      compact: ["lesson", "private-notes", "formula-sheet"],
      focus: ["lesson", "private-notes"],
    },
    placement: {
      desktopPriority: ["lesson", "private-notes", "formula-sheet", "desmos-graph"],
      canvasRecipe: "Lesson remains calm and primary; Desmos is a visible reference panel instead of a hidden surprise.",
      collapseFirst: ["saved-graphs", "scientific-calculator", "math-blocks", "whiteboard"],
    },
    graphIntegration: {
      module: "desmos-graph",
      companionModules: ["lesson", "formula-sheet", "private-notes"],
      placement: "Use Desmos as a secondary reference panel for teacher-style walkthroughs.",
      collapsedWhenUnavailable: ["saved-graphs", "scientific-calculator"],
    },
  },
  "math-guided-study": {
    secondaryModules: ["private-notes", "desmos-graph", "math-blocks", "formula-sheet"],
    visibleModules: ["lesson", "private-notes", "desmos-graph", "math-blocks"],
    densityVisibleModules: {
      comfortable: ["lesson", "private-notes", "desmos-graph", "math-blocks"],
      compact: ["lesson", "desmos-graph", "private-notes"],
      focus: ["lesson", "desmos-graph"],
    },
    placement: {
      desktopPriority: ["lesson", "desmos-graph", "private-notes", "math-blocks"],
      canvasRecipe: "Lesson and graph sit side-by-side so examples can move directly into visual exploration.",
      collapseFirst: ["saved-graphs", "scientific-calculator", "formula-sheet", "whiteboard"],
    },
    graphIntegration: {
      module: "desmos-graph",
      companionModules: ["lesson", "math-blocks", "private-notes"],
      placement: "Graph is the worked-example companion, paired horizontally with source content.",
      collapsedWhenUnavailable: ["saved-graphs", "scientific-calculator"],
    },
    reasoning:
      "Guided math study should move from explanation to graph to notes without forcing the student to hunt for Desmos.",
  },
  "math-graph-lab": {
    primaryModule: "desmos-graph",
    secondaryModules: ["formula-sheet", "private-notes", "lesson", "saved-graphs"],
    visibleModules: ["desmos-graph", "formula-sheet", "private-notes"],
    densityVisibleModules: {
      comfortable: ["desmos-graph", "formula-sheet", "private-notes"],
      compact: ["desmos-graph", "formula-sheet", "private-notes"],
      focus: ["desmos-graph", "formula-sheet"],
    },
    collapsedModules: ["lesson", "saved-graphs", "scientific-calculator", "math-blocks", "whiteboard"],
    placement: {
      desktopPriority: ["desmos-graph", "formula-sheet", "private-notes", "lesson", "saved-graphs"],
      canvasRecipe: "Desmos takes the center as the lab bench; formulas sit left and notes sit right for observations.",
      collapseFirst: ["scientific-calculator", "saved-graphs", "lesson", "math-blocks", "whiteboard"],
    },
    graphIntegration: {
      module: "desmos-graph",
      companionModules: ["formula-sheet", "private-notes", "lesson", "saved-graphs"],
      placement: "Graph stays wide and tall; formulas and observation notes flank it like lab controls.",
      collapsedWhenUnavailable: ["saved-graphs", "scientific-calculator"],
    },
    reasoning:
      "Graph Lab is graph-first by design: the student should see Desmos before any utility panel competes for attention.",
  },
  "math-proof-concept": {
    densityVisibleModules: {
      comfortable: ["lesson", "math-blocks", "related-concepts", "private-notes"],
      compact: ["lesson", "math-blocks", "private-notes"],
      focus: ["lesson", "math-blocks"],
    },
    placement: {
      desktopPriority: ["lesson", "math-blocks", "related-concepts", "private-notes"],
      canvasRecipe: "Proof reasoning gets the wide lane; graphing stays available but collapsed until a concept needs it.",
      collapseFirst: ["desmos-graph", "scientific-calculator", "saved-graphs", "whiteboard"],
    },
    graphIntegration: {
      module: "desmos-graph",
      companionModules: ["lesson", "math-blocks", "related-concepts"],
      placement: "Keep graphing collapsed by default but ready for counterexample or concept checks.",
      collapsedWhenUnavailable: ["saved-graphs", "scientific-calculator"],
    },
  },
  "math-practice-mode": {
    primaryModule: "whiteboard",
    secondaryModules: ["math-blocks", "private-notes", "formula-sheet", "lesson"],
    visibleModules: ["whiteboard", "math-blocks", "private-notes", "formula-sheet"],
    densityVisibleModules: {
      comfortable: ["whiteboard", "math-blocks", "private-notes", "formula-sheet"],
      compact: ["whiteboard", "private-notes", "math-blocks"],
      focus: ["whiteboard", "private-notes"],
    },
    collapsedModules: ["desmos-graph", "scientific-calculator", "saved-graphs", "lesson"],
    placement: {
      desktopPriority: ["whiteboard", "math-blocks", "private-notes", "formula-sheet"],
      canvasRecipe: "Whiteboard is the scratch surface; math blocks, notes, and formulas frame it without covering the top tools.",
      collapseFirst: ["desmos-graph", "scientific-calculator", "saved-graphs", "lesson"],
    },
    graphIntegration: {
      module: "desmos-graph",
      companionModules: ["whiteboard", "math-blocks", "formula-sheet"],
      placement: "Keep graphing available as an optional verification station, not a default overlay on the board.",
      collapsedWhenUnavailable: ["saved-graphs", "scientific-calculator"],
    },
  },
  "full-math-canvas": {
    primaryModule: "desmos-graph",
    secondaryModules: ["math-blocks", "private-notes", "lesson", "formula-sheet"],
    visibleModules: ["desmos-graph", "math-blocks", "private-notes", "lesson", "formula-sheet"],
    densityVisibleModules: {
      comfortable: ["desmos-graph", "math-blocks", "private-notes", "lesson", "formula-sheet"],
      compact: ["desmos-graph", "math-blocks", "private-notes"],
      focus: ["desmos-graph", "math-blocks"],
    },
    collapsedModules: ["saved-graphs", "scientific-calculator", "related-concepts", "comments", "recent-highlights"],
    placement: {
      desktopPriority: ["desmos-graph", "math-blocks", "private-notes", "lesson", "formula-sheet"],
      canvasRecipe: "Desmos and math work share the primary canvas; notes, lesson, and formulas stay readable around them.",
      collapseFirst: ["saved-graphs", "scientific-calculator", "related-concepts", "comments", "recent-highlights"],
    },
    graphIntegration: {
      module: "desmos-graph",
      companionModules: ["math-blocks", "private-notes", "formula-sheet", "lesson"],
      placement: "Treat Desmos as one of the two studio anchors, not as a small tool card.",
      collapsedWhenUnavailable: ["saved-graphs", "scientific-calculator"],
    },
    reasoning:
      "Full Math Canvas shows power without shrinking everything: graph and math work stay primary, utilities collapse first.",
  },
  "history-guided": {
    primaryModule: "lesson",
    secondaryModules: ["history-timeline", "history-evidence", "private-notes"],
    visibleModules: ["lesson", "history-timeline", "history-evidence", "private-notes"],
    densityVisibleModules: {
      comfortable: ["lesson", "history-timeline", "history-evidence", "private-notes"],
      compact: ["lesson", "history-timeline", "history-evidence"],
      focus: ["lesson", "history-timeline"],
    },
    placement: {
      desktopPriority: ["lesson", "history-timeline", "history-evidence", "private-notes"],
      canvasRecipe: "Source and timeline sit on top; evidence and notes form the lower study loop.",
      collapseFirst: historyToolCollapseOrder,
    },
    historyWorkflow: {
      leadModule: "lesson",
      sequence: ["lesson", "history-timeline", "history-evidence", "private-notes"],
      studentGoal: "Read the source, place it in time, save evidence, then write what changed.",
    },
    reasoning:
      "Guided history should feel like a repeatable source-to-chronology-to-evidence loop, not a pile of panels.",
  },
  "history-timeline-focus": {
    primaryModule: "history-timeline",
    secondaryModules: ["lesson", "private-notes", "history-evidence"],
    visibleModules: ["history-timeline", "lesson", "private-notes"],
    densityVisibleModules: {
      comfortable: ["history-timeline", "lesson", "private-notes"],
      compact: ["history-timeline", "lesson", "private-notes"],
      focus: ["history-timeline", "lesson"],
    },
    placement: {
      desktopPriority: ["history-timeline", "lesson", "private-notes", "history-evidence"],
      canvasRecipe: "Timeline takes the full top band; source and notes explain the chronology underneath.",
      collapseFirst: ["history-evidence", "history-argument", "history-myth-checks", "comments"],
    },
    historyWorkflow: {
      leadModule: "history-timeline",
      sequence: ["history-timeline", "lesson", "private-notes", "history-evidence"],
      studentGoal: "Start with sequence, then explain each event from source material.",
    },
  },
  "history-source-evidence": {
    primaryModule: "history-evidence",
    secondaryModules: ["lesson", "private-notes", "history-timeline"],
    visibleModules: ["history-evidence", "lesson", "private-notes"],
    densityVisibleModules: {
      comfortable: ["history-evidence", "lesson", "private-notes"],
      compact: ["history-evidence", "lesson", "private-notes"],
      focus: ["history-evidence", "lesson"],
    },
    placement: {
      desktopPriority: ["history-evidence", "lesson", "private-notes", "history-timeline"],
      canvasRecipe: "Evidence locker and source reading share the main area; notes capture claim-ready observations.",
      collapseFirst: ["history-timeline", "history-argument", "history-myth-checks", "comments"],
    },
    historyWorkflow: {
      leadModule: "history-evidence",
      sequence: ["history-evidence", "lesson", "private-notes", "history-timeline"],
      studentGoal: "Collect evidence first, then tie each quote or source detail back to the reading.",
    },
    reasoning:
      "Source Evidence mode now privileges the evidence board while keeping the lesson and notes immediately adjacent.",
  },
  "history-argument-builder": {
    primaryModule: "history-argument",
    secondaryModules: ["history-evidence", "lesson", "history-timeline"],
    visibleModules: ["history-argument", "history-evidence", "lesson"],
    densityVisibleModules: {
      comfortable: ["history-argument", "history-evidence", "lesson"],
      compact: ["history-argument", "history-evidence", "lesson"],
      focus: ["history-argument", "history-evidence"],
    },
    placement: {
      desktopPriority: ["history-argument", "history-evidence", "lesson", "history-timeline"],
      canvasRecipe: "Argument builder gets the widest lane; evidence and source are staged as citation support.",
      collapseFirst: ["history-timeline", "private-notes", "history-myth-checks", "comments"],
    },
    historyWorkflow: {
      leadModule: "history-argument",
      sequence: ["history-argument", "history-evidence", "lesson", "history-timeline"],
      studentGoal: "Draft the claim, pull evidence, check the source, and use chronology to keep the argument honest.",
    },
  },
  "history-full-studio": {
    primaryModule: "history-timeline",
    secondaryModules: ["lesson", "history-evidence", "history-argument"],
    visibleModules: ["history-timeline", "lesson", "history-evidence", "history-argument"],
    densityVisibleModules: {
      comfortable: ["history-timeline", "lesson", "history-evidence", "history-argument"],
      compact: ["history-timeline", "history-evidence", "history-argument"],
      focus: ["history-timeline", "history-evidence"],
    },
    placement: {
      desktopPriority: ["history-timeline", "lesson", "history-evidence", "history-argument"],
      canvasRecipe: "Timeline runs as the organizing spine with source, evidence, and argument in readable quadrants.",
      collapseFirst: ["private-notes", "history-myth-checks", "comments", "recent-highlights"],
    },
    historyWorkflow: {
      leadModule: "history-timeline",
      sequence: ["history-timeline", "lesson", "history-evidence", "history-argument"],
      studentGoal: "Move from chronology to source, then evidence, then a composed historical argument.",
    },
    reasoning:
      "Full History Studio feels powerful by giving each core history surface a real zone and collapsing extras first.",
  },
};

function buildFaceliftPresetDesign(presetId: WorkspacePresetId): FaceliftWorkspacePresetDesign {
  const base = workspacePresetDesigns[presetId];
  const override = faceliftPresetOverrides[presetId] ?? {};
  const primaryModule = base.primary[0] ?? base.defaultVisible[0] ?? "lesson";
  const secondaryModules = appendUnique([
    ...base.primary.slice(1),
    ...base.secondary,
    ...base.defaultVisible.filter((moduleId) => moduleId !== primaryModule),
  ]).slice(0, 4);
  const resolvedPrimaryModule = override.primaryModule ?? primaryModule;
  const resolvedSecondaryModules = override.secondaryModules ?? secondaryModules;
  const defaultVisibleModules = appendUnique([
    resolvedPrimaryModule,
    ...resolvedSecondaryModules,
    ...base.defaultVisible,
  ]).slice(0, presetId === "full-math-canvas" || presetId === "history-full-studio" ? 5 : 4);
  const visibleModules = override.visibleModules ?? defaultVisibleModules;
  const collapsedModules = appendUnique([
    ...(override.collapsedModules ?? []),
    ...base.collapsedByDefault,
    ...base.optional,
    ...base.defaultVisible.filter((moduleId) => !visibleModules.includes(moduleId)),
  ]);
  const densityVisibleModules = normalizeDensityVisibleModules(
    {
      comfortable: visibleModules,
      compact: base.compactVisible ?? visibleModules.slice(0, Math.min(3, visibleModules.length)),
      focus: compactCoreVisibleModules(visibleModules, 2, resolvedPrimaryModule),
      ...override.densityVisibleModules,
    },
    visibleModules,
    resolvedPrimaryModule,
  );
  const minimumUsefulSizes = Object.fromEntries(
    appendUnique([...visibleModules, ...collapsedModules]).map((moduleId) => [
      moduleId,
      getWorkspaceModuleMinimumSize(moduleId, moduleId === resolvedPrimaryModule ? "primary" : "secondary"),
    ]),
  ) as Partial<Record<WorkspaceModuleId, MinimumSize>>;

  return {
    id: presetId,
    purpose: base.purpose,
    primaryModule: resolvedPrimaryModule,
    secondaryModules: resolvedSecondaryModules,
    optionalModules: base.optional,
    visibleModules,
    collapsedModules,
    densityVisibleModules,
    minimumUsefulSizes,
    layoutRecipe: faceliftRecipeLabels[base.desktopRecipe],
    placement: override.placement ?? {
      ...defaultFaceliftPlacement,
      desktopPriority: appendUnique([resolvedPrimaryModule], resolvedSecondaryModules),
      collapseFirst: collapsedModules.slice(0, 5),
    },
    graphIntegration: override.graphIntegration,
    historyWorkflow: override.historyWorkflow,
    reasoning: override.reasoning ?? faceliftPresetReasoning[presetId],
  };
}

export const faceliftWorkspacePresetDesigns = Object.fromEntries(
  (Object.keys(workspacePresetDesigns) as WorkspacePresetId[]).map((presetId) => [
    presetId,
    buildFaceliftPresetDesign(presetId),
  ]),
) as Record<WorkspacePresetId, FaceliftWorkspacePresetDesign>;

export function getFaceliftWorkspacePresetDesign(presetId: WorkspacePresetId) {
  return faceliftWorkspacePresetDesigns[presetId];
}

export function selectFaceliftSurfaceModules(
  presetId: WorkspacePresetId,
  options: {
    density?: FaceliftDensity;
    enabledModules?: WorkspaceModuleId[];
  } = {},
): WorkspaceModuleId[] {
  const design = getFaceliftWorkspacePresetDesign(presetId);
  const density = options.density ?? "comfortable";
  const enabled = options.enabledModules ? new Set(options.enabledModules) : null;
  const preferred = design.densityVisibleModules[density] ?? design.visibleModules;
  const visible = preferred.filter((moduleId) => !enabled || enabled.has(moduleId) || moduleId === "lesson");

  if (visible.length > 0) {
    return visible;
  }

  return design.visibleModules.filter((moduleId) => !enabled || enabled.has(moduleId) || moduleId === "lesson");
}

export function buildFaceliftPresetFrames(
  presetId: WorkspacePresetId,
  viewport: { width: number; height: number },
): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  if (presetId === "split-study") {
    return buildFaceliftSplitStudyFrames(viewport);
  }

  const width = Math.max(960, Math.round(viewport.width));
  const height = Math.max(640, Math.round(viewport.height));

  if (presetId === "math-graph-lab") {
    return buildGraphLabFrames(width, height);
  }

  if (presetId === "math-study") {
    return buildMathStudyFrames(width, height);
  }

  if (presetId === "math-guided-study") {
    return buildMathGuidedFrames(width, height);
  }

  if (presetId === "math-simple-presentation") {
    return buildMathPresentationFrames(width, height);
  }

  if (presetId === "math-practice-mode") {
    return buildMathPracticeFrames(width, height);
  }

  if (presetId === "full-math-canvas") {
    return buildFullMathCanvasFrames(width, height);
  }

  if (presetId === "history-guided") {
    return buildHistoryGuidedFrames(width, height);
  }

  if (presetId === "history-timeline-focus") {
    return buildHistoryTimelineFrames(width, height);
  }

  if (presetId === "history-source-evidence") {
    return buildHistorySourceEvidenceFrames(width, height);
  }

  if (presetId === "history-argument-builder") {
    return buildHistoryArgumentFrames(width, height);
  }

  if (presetId === "history-full-studio") {
    return buildHistoryFullStudioFrames(width, height);
  }

  return buildGeneralFaceliftFrames(presetId, width, height);
}

export function buildFaceliftSplitStudyFrames(viewport: {
  width: number;
  height: number;
}): Pick<Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>, "lesson" | "private-notes"> {
  const width = Math.max(640, Math.round(viewport.width));
  const height = Math.max(360, Math.round(viewport.height));
  const leftWidth = Math.floor(width / 2);
  const rightWidth = width - leftWidth;

  return {
    lesson: { x: 0, y: 0, w: leftWidth, h: height, z: 1 },
    "private-notes": { x: leftWidth, y: 0, w: rightWidth, h: height, z: 2 },
  };
}

function normalizeDensityVisibleModules(
  modules: Record<FaceliftDensity, WorkspaceModuleId[]>,
  fallback: WorkspaceModuleId[],
  primaryModule: WorkspaceModuleId,
): Record<FaceliftDensity, WorkspaceModuleId[]> {
  return {
    comfortable: normalizeVisibleModuleOrder(modules.comfortable, fallback, primaryModule),
    compact: normalizeVisibleModuleOrder(modules.compact, modules.comfortable, primaryModule).slice(0, 3),
    focus: normalizeVisibleModuleOrder(modules.focus, modules.compact, primaryModule).slice(0, 2),
  };
}

function normalizeVisibleModuleOrder(
  modules: WorkspaceModuleId[] | undefined,
  fallback: WorkspaceModuleId[],
  primaryModule: WorkspaceModuleId,
) {
  const source = modules && modules.length > 0 ? modules : fallback;
  return appendUnique([primaryModule], source).filter(Boolean);
}

function compactCoreVisibleModules(
  modules: WorkspaceModuleId[],
  limit: number,
  primaryModule: WorkspaceModuleId,
) {
  return appendUnique(
    [primaryModule],
    [
      ...modules.filter((moduleId) => moduleId === "lesson" || moduleId === "private-notes"),
      ...modules,
    ],
  ).slice(0, limit);
}

function buildGraphLabFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const leftWidth = Math.max(320, Math.round(width * 0.2));
  const rightWidth = Math.max(480, Math.round(width * 0.29));
  const graphWidth = Math.max(620, width - leftWidth - rightWidth - gap * 2);
  const graphX = leftWidth + gap;
  const rightX = graphX + graphWidth + gap;

  return {
    "formula-sheet": faceliftFrame(0, 0, leftWidth, height, 1),
    "desmos-graph": faceliftFrame(graphX, 0, graphWidth, height, 2),
    "private-notes": faceliftFrame(rightX, 0, Math.max(0, width - rightX), height, 3),
  };
}

function buildMathStudyFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const graphHeight = Math.max(480, Math.round(height * 0.58));
  const supportHeight = Math.max(320, height - graphHeight - gap);
  const lessonWidth = Math.max(420, Math.round(width * 0.34));
  const notesWidth = Math.max(480, Math.round(width * 0.36));
  const formulaWidth = Math.max(320, width - lessonWidth - notesWidth - gap * 2);

  return {
    "desmos-graph": faceliftFrame(0, 0, width, graphHeight, 1),
    lesson: faceliftFrame(0, graphHeight + gap, lessonWidth, supportHeight, 2),
    "private-notes": faceliftFrame(lessonWidth + gap, graphHeight + gap, notesWidth, supportHeight, 3),
    "formula-sheet": faceliftFrame(lessonWidth + notesWidth + gap * 2, graphHeight + gap, formulaWidth, supportHeight, 4),
  };
}

function buildMathPresentationFrames(
  width: number,
  height: number,
): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const lessonWidth = Math.max(620, Math.round(width * 0.58));
  const rightWidth = width - lessonWidth - gap;
  const notesHeight = Math.max(360, Math.round(height * 0.42));
  const formulaHeight = Math.max(260, Math.round(height * 0.24));
  const graphHeight = Math.max(320, height - notesHeight - formulaHeight - gap * 2);

  return {
    lesson: faceliftFrame(0, 0, lessonWidth, height, 1),
    "private-notes": faceliftFrame(lessonWidth + gap, 0, rightWidth, notesHeight, 2),
    "formula-sheet": faceliftFrame(lessonWidth + gap, notesHeight + gap, rightWidth, formulaHeight, 3),
    "desmos-graph": faceliftFrame(lessonWidth + gap, notesHeight + formulaHeight + gap * 2, rightWidth, graphHeight, 4),
  };
}

function buildMathGuidedFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const topHeight = Math.max(420, Math.round(height * 0.58));
  const bottomHeight = height - topHeight - gap;
  const leftWidth = Math.max(520, Math.round(width * 0.48));
  const rightWidth = width - leftWidth - gap;

  return {
    lesson: faceliftFrame(0, 0, leftWidth, topHeight, 1),
    "desmos-graph": faceliftFrame(leftWidth + gap, 0, rightWidth, topHeight, 2),
    "private-notes": faceliftFrame(0, topHeight + gap, leftWidth, bottomHeight, 3),
    "math-blocks": faceliftFrame(leftWidth + gap, topHeight + gap, rightWidth, bottomHeight, 4),
  };
}

function buildMathPracticeFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const compact = width < 1280;
  const leftWidth = compact ? 240 : Math.min(380, Math.max(300, Math.round(width * 0.2)));
  const rightWidth = compact ? 300 : Math.min(460, Math.max(340, Math.round(width * 0.24)));
  const boardWidth = Math.max(360, width - leftWidth - rightWidth - gap * 2);
  const rightTopHeight = Math.max(300, Math.round(height * 0.48));
  const formulaHeight = Math.max(260, Math.round(height * 0.46));

  return {
    "formula-sheet": faceliftFrame(0, 0, leftWidth, formulaHeight, 1),
    lesson: faceliftFrame(0, formulaHeight + gap, leftWidth, Math.max(240, height - formulaHeight - gap), 2),
    whiteboard: faceliftFrame(leftWidth + gap, 0, boardWidth, height, 3),
    "private-notes": faceliftFrame(leftWidth + boardWidth + gap * 2, 0, rightWidth, rightTopHeight, 4),
    "math-blocks": faceliftFrame(
      leftWidth + boardWidth + gap * 2,
      rightTopHeight + gap,
      rightWidth,
      Math.max(280, height - rightTopHeight - gap),
      5,
    ),
    "desmos-graph": faceliftFrame(
      leftWidth + boardWidth + gap * 2,
      rightTopHeight + gap,
      rightWidth,
      Math.max(280, height - rightTopHeight - gap),
      6,
    ),
  };
}

function buildFullMathCanvasFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const leftWidth = Math.max(360, Math.round(width * 0.24));
  const centerWidth = Math.max(620, Math.round(width * 0.42));
  const rightWidth = width - leftWidth - centerWidth - gap * 2;
  const graphHeight = Math.max(480, Math.round(height * 0.6));

  return {
    lesson: faceliftFrame(0, 0, leftWidth, Math.round(height * 0.48), 1),
    "formula-sheet": faceliftFrame(0, Math.round(height * 0.48) + gap, leftWidth, Math.round(height * 0.3), 2),
    "desmos-graph": faceliftFrame(leftWidth + gap, 0, centerWidth, graphHeight, 3),
    "math-blocks": faceliftFrame(leftWidth + gap, graphHeight + gap, centerWidth, height - graphHeight - gap, 4),
    "private-notes": faceliftFrame(leftWidth + centerWidth + gap * 2, 0, rightWidth, Math.round(height * 0.52), 5),
    "related-concepts": faceliftFrame(
      leftWidth + centerWidth + gap * 2,
      Math.round(height * 0.52) + gap,
      rightWidth,
      height - Math.round(height * 0.52) - gap,
      6,
    ),
  };
}

function buildHistoryGuidedFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const columnWidth = Math.floor((width - gap) / 2);
  const rowHeight = Math.floor((height - gap) / 2);
  const rightWidth = width - columnWidth - gap;
  const bottomHeight = height - rowHeight - gap;

  return {
    lesson: faceliftFrame(0, 0, columnWidth, rowHeight, 1),
    "history-timeline": faceliftFrame(columnWidth + gap, 0, rightWidth, rowHeight, 2),
    "history-evidence": faceliftFrame(0, rowHeight + gap, columnWidth, bottomHeight, 3),
    "private-notes": faceliftFrame(columnWidth + gap, rowHeight + gap, rightWidth, bottomHeight, 4),
  };
}

function buildHistoryTimelineFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const timelineHeight = Math.max(340, Math.round(height * 0.52));
  const supportHeight = height - timelineHeight - gap;
  const leftWidth = Math.floor((width - gap) / 2);

  return {
    "history-timeline": faceliftFrame(0, 0, width, timelineHeight, 1),
    lesson: faceliftFrame(0, timelineHeight + gap, leftWidth, supportHeight, 2),
    "private-notes": faceliftFrame(leftWidth + gap, timelineHeight + gap, width - leftWidth - gap, supportHeight, 3),
  };
}

function buildHistorySourceEvidenceFrames(
  width: number,
  height: number,
): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const leftWidth = Math.max(520, Math.round(width * 0.5));
  const rightWidth = width - leftWidth - gap;
  const topHeight = Math.floor((height - gap) / 2);

  return {
    "history-evidence": faceliftFrame(0, 0, leftWidth, height, 1),
    lesson: faceliftFrame(leftWidth + gap, 0, rightWidth, topHeight, 2),
    "private-notes": faceliftFrame(leftWidth + gap, topHeight + gap, rightWidth, height - topHeight - gap, 3),
  };
}

function buildHistoryArgumentFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const leftWidth = Math.max(620, Math.round(width * 0.54));
  const rightWidth = width - leftWidth - gap;
  const topHeight = Math.floor((height - gap) / 2);

  return {
    "history-argument": faceliftFrame(0, 0, leftWidth, height, 1),
    "history-evidence": faceliftFrame(leftWidth + gap, 0, rightWidth, topHeight, 2),
    lesson: faceliftFrame(leftWidth + gap, topHeight + gap, rightWidth, height - topHeight - gap, 3),
  };
}

function buildHistoryFullStudioFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const timelineHeight = Math.max(360, Math.round(height * 0.42));
  const lowerHeight = height - timelineHeight - gap;
  const columnWidth = Math.floor((width - gap * 2) / 3);
  const evidenceX = columnWidth + gap;
  const argumentX = evidenceX + columnWidth + gap;

  return {
    "history-timeline": faceliftFrame(0, 0, width, timelineHeight, 1),
    lesson: faceliftFrame(0, timelineHeight + gap, columnWidth, lowerHeight, 2),
    "history-evidence": faceliftFrame(evidenceX, timelineHeight + gap, columnWidth, lowerHeight, 3),
    "history-argument": faceliftFrame(argumentX, timelineHeight + gap, width - argumentX, lowerHeight, 4),
  };
}

function buildGeneralFaceliftFrames(
  presetId: WorkspacePresetId,
  width: number,
  height: number,
): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;

  if (presetId === "notes-focus") {
    const notesWidth = Math.max(620, Math.round(width * 0.62));
    return {
      "private-notes": faceliftFrame(0, 0, notesWidth, height, 1),
      lesson: faceliftFrame(notesWidth + gap, 0, width - notesWidth - gap, height, 2),
    };
  }

  if (presetId === "annotation-mode") {
    const lessonWidth = Math.max(620, Math.round(width * 0.62));
    const sideWidth = width - lessonWidth - gap;
    return {
      lesson: faceliftFrame(0, 0, lessonWidth, height, 1),
      "private-notes": faceliftFrame(lessonWidth + gap, 0, sideWidth, Math.round(height * 0.38), 2),
      comments: faceliftFrame(lessonWidth + gap, Math.round(height * 0.38) + gap, sideWidth, Math.round(height * 0.3), 3),
      "recent-highlights": faceliftFrame(
        lessonWidth + gap,
        Math.round(height * 0.68) + gap * 2,
        sideWidth,
        height - Math.round(height * 0.68) - gap * 2,
        4,
      ),
    };
  }

  const outlineWidth = Math.min(280, Math.max(220, Math.round(width * 0.18)));
  return {
    "lesson-outline": faceliftFrame(0, 0, outlineWidth, height, 1),
    lesson: faceliftFrame(outlineWidth + gap, 0, width - outlineWidth - gap, height, 2),
  };
}

function faceliftFrame(x: number, y: number, w: number, h: number, z: number): WorkspaceWindowFrame {
  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
    z,
  };
}

export function applyWorkspacePresetDesignAvailability(
  design: WorkspacePresetDesign,
  availability: WorkspacePresetRuntimeAvailability = {},
): WorkspacePresetDesign {
  const unavailable = new Set<WorkspaceModuleId>();

  if (availability.desmosApiKeyAvailable === false) {
    unavailable.add("desmos-graph");
    unavailable.add("scientific-calculator");
    unavailable.add("saved-graphs");
  }
  if (availability.desmosGraphEnabled === false) {
    unavailable.add("desmos-graph");
    unavailable.add("saved-graphs");
  }
  if (availability.scientificCalculatorEnabled === false) {
    unavailable.add("scientific-calculator");
  }

  if (unavailable.size === 0) {
    return design;
  }

  const stripUnavailable = (moduleIds: WorkspaceModuleId[]) =>
    moduleIds.filter((moduleId) => !unavailable.has(moduleId));
  const collapsedByDefault = appendUnique(design.collapsedByDefault, [...unavailable]);

  return {
    ...design,
    primary: stripUnavailable(design.primary),
    secondary: stripUnavailable(design.secondary),
    defaultVisible: stripUnavailable(design.defaultVisible),
    compactVisible: design.compactVisible ? stripUnavailable(design.compactVisible) : undefined,
    smallScreenVisible: stripUnavailable(design.smallScreenVisible),
    collapsedByDefault,
  };
}

export function selectWorkspacePresetVisibleModules(
  presetId: WorkspacePresetId,
  options: {
    availability?: WorkspacePresetRuntimeAvailability;
    viewport?: { width: number; height: number };
  } = {},
) {
  const design = applyWorkspacePresetDesignAvailability(
    getWorkspacePresetDesign(presetId),
    options.availability,
  );
  const usePhoneScreen = Boolean(options.viewport && options.viewport.width <= 760);
  const useSmallScreen =
    options.viewport &&
    (options.viewport.width <= 1100 || options.viewport.height <= 720);
  const useCompactScreen =
    options.viewport &&
    (options.viewport.width < 1320 || options.viewport.height < 960);
  const preferred = usePhoneScreen
    ? design.smallScreenVisible.slice(0, 1)
    : useSmallScreen
    ? design.smallScreenVisible
    : useCompactScreen
      ? design.compactVisible ?? design.smallScreenVisible
      : design.defaultVisible;
  const visible = preferred.filter((moduleId) => design.defaultVisible.includes(moduleId));

  if (visible.length > 0) {
    return visible;
  }

  return design.defaultVisible.slice(0, Math.max(1, usePhoneScreen ? 1 : useSmallScreen ? 2 : 4));
}

export function getWorkspaceMobileModuleTabs(
  presetId: WorkspacePresetId,
  enabledModules: WorkspaceModuleId[],
): WorkspaceMobileModuleTab[] {
  const design = getWorkspacePresetDesign(presetId);
  const enabled = new Set(enabledModules);
  const order = getMobileModuleOrder(presetId);
  const preferred = appendUnique(order, [
    ...design.smallScreenVisible,
    ...design.defaultVisible,
    ...design.secondary,
    ...design.optional,
  ]);

  return preferred
    .filter((moduleId) => enabled.has(moduleId))
    .filter((moduleId) => !compactMobileToolModules.has(moduleId))
    .map((moduleId) => ({
      moduleId,
      label: mobileModuleLabels[moduleId] ?? moduleId,
    }));
}

const compactMobileToolModules = new Set<WorkspaceModuleId>([
  "scientific-calculator",
  "saved-graphs",
  "comments",
  "recent-highlights",
  "search",
  "tasks",
  "history-myth-checks",
  "flashcards",
  "mini-tools",
]);

const mobileModuleLabels: Partial<Record<WorkspaceModuleId, string>> = {
  lesson: "Lesson",
  "private-notes": "Notes",
  "binder-notebook": "Notebook",
  "lesson-outline": "Outline",
  comments: "Comments",
  "recent-highlights": "Highlights",
  "formula-sheet": "Formulas",
  "math-blocks": "Work",
  whiteboard: "Board",
  "related-concepts": "Concepts",
  "desmos-graph": "Graph",
  "scientific-calculator": "Calculator",
  "saved-graphs": "Saved",
  "history-timeline": "Timeline",
  "history-evidence": "Evidence",
  "history-argument": "Argument",
  "history-myth-checks": "Myth checks",
  tasks: "Tasks",
  search: "Search",
  flashcards: "Flashcards",
  "mini-tools": "Tools",
};

function getMobileModuleOrder(presetId: WorkspacePresetId): WorkspaceModuleId[] {
  if (presetId.startsWith("math-")) {
    if (presetId === "math-graph-lab" || presetId === "math-study" || presetId === "full-math-canvas") {
      return [
        "desmos-graph",
        "whiteboard",
        "formula-sheet",
        "lesson",
        "private-notes",
        "math-blocks",
        "scientific-calculator",
        "saved-graphs",
      ];
    }

    if (presetId === "math-practice-mode") {
      return [
        "whiteboard",
        "math-blocks",
        "private-notes",
        "formula-sheet",
        "lesson",
        "desmos-graph",
        "scientific-calculator",
      ];
    }

    return [
      "lesson",
      "private-notes",
      "whiteboard",
      "math-blocks",
      "formula-sheet",
      "desmos-graph",
      "related-concepts",
      "scientific-calculator",
    ];
  }

  if (presetId.startsWith("history-")) {
    if (presetId === "history-argument-builder") {
      return [
        "history-argument",
        "history-evidence",
        "lesson",
        "history-timeline",
        "private-notes",
        "history-myth-checks",
      ];
    }

    if (presetId === "history-timeline-focus") {
      return ["history-timeline", "lesson", "private-notes", "history-evidence", "history-argument"];
    }

    if (presetId === "history-source-evidence") {
      return ["lesson", "history-evidence", "private-notes", "history-timeline", "history-argument"];
    }

    return ["lesson", "history-timeline", "history-evidence", "history-argument", "private-notes"];
  }

  return [
    "lesson",
    "private-notes",
    "recent-highlights",
    "comments",
    "binder-notebook",
    "lesson-outline",
    "search",
  ];
}

export function validateDesignedLayout({
  design,
  frames,
  moduleIds,
  viewport,
}: {
  design: WorkspacePresetDesign;
  frames: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
  moduleIds: WorkspaceModuleId[];
  viewport: { width: number; height: number };
}) {
  const errors: string[] = [];
  const visibleFrames = moduleIds
    .map((moduleId) => ({ moduleId, frame: frames[moduleId] }))
    .filter((entry): entry is { moduleId: WorkspaceModuleId; frame: WorkspaceWindowFrame } =>
      Boolean(entry.frame),
    );

  visibleFrames.forEach(({ moduleId, frame }) => {
    const role = design.primary.includes(moduleId) ? "primary" : "secondary";
    const minimum = getWorkspaceModuleMinimumSize(moduleId, role);
    if (frame.w < minimum.width || frame.h < minimum.height) {
      errors.push(
        `${moduleId} is too small: ${frame.w}x${frame.h}, needs at least ${minimum.width}x${minimum.height}.`,
      );
    }
    if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > viewport.width || frame.y + frame.h > viewport.height) {
      errors.push(`${moduleId} is offscreen.`);
    }
  });

  visibleFrames.forEach((entry, index) => {
    visibleFrames.slice(index + 1).forEach((other) => {
      if (framesOverlap(entry.frame, other.frame)) {
        errors.push(`${entry.moduleId} overlaps ${other.moduleId}.`);
      }
    });
  });

  if (hasBottomStrip(visibleFrames.map((entry) => entry.frame), viewport)) {
    errors.push("Layout created a bottom strip of unreadable helper modules.");
  }

  const bounds = getFrameBounds(visibleFrames.map((entry) => entry.frame));
  if (bounds && visibleFrames.length > 1) {
    const usedArea = bounds.width * bounds.height;
    const viewportArea = viewport.width * viewport.height;
    if (usedArea < viewportArea * 0.45) {
      errors.push("Layout leaves excessive unused canvas space.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function appendUnique<T>(base: T[], additions: T[] = []) {
  const seen = new Set(base);
  const next = [...base];

  additions.forEach((item) => {
    if (!seen.has(item)) {
      seen.add(item);
      next.push(item);
    }
  });

  return next;
}

function framesOverlap(left: WorkspaceWindowFrame, right: WorkspaceWindowFrame) {
  return !(
    left.x + left.w <= right.x ||
    right.x + right.w <= left.x ||
    left.y + left.h <= right.y ||
    right.y + right.h <= left.y
  );
}

function hasBottomStrip(frames: WorkspaceWindowFrame[], viewport: { width: number; height: number }) {
  if (frames.length < 4) {
    return false;
  }

  const rows = new Map<number, WorkspaceWindowFrame[]>();
  frames.forEach((frame) => {
    const row = Math.round(frame.y / 24) * 24;
    rows.set(row, [...(rows.get(row) ?? []), frame]);
  });

  return [...rows.entries()].some(([rowY, rowFrames]) => {
    const cramped = rowFrames.filter((frame) => frame.w < 360 || frame.h < 260);
    return rowY > viewport.height * 0.55 && rowFrames.length >= 3 && cramped.length >= 2;
  });
}

function getFrameBounds(frames: WorkspaceWindowFrame[]) {
  if (frames.length === 0) {
    return null;
  }

  const minX = Math.min(...frames.map((frame) => frame.x));
  const minY = Math.min(...frames.map((frame) => frame.y));
  const maxX = Math.max(...frames.map((frame) => frame.x + frame.w));
  const maxY = Math.max(...frames.map((frame) => frame.y + frame.h));

  return {
    width: maxX - minX,
    height: maxY - minY,
  };
}
