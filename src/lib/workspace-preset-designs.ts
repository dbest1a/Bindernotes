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
  | "chemistry-lab-zones"
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
  studentCommand: {
    intent: "read" | "write" | "graph" | "work" | "lab" | "argue" | "timeline" | "evidence";
    label: string;
    primaryAction: string;
    followUpAction: string;
  };
  performanceBudget: {
    maxComfortableModules: number;
    maxCompactModules: number;
    mobilePrimaryModule: WorkspaceModuleId;
    lazyModules: WorkspaceModuleId[];
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

export type WorkspaceStarterChoice = {
  id: "read" | "notes" | "math" | "chemistry" | "history" | "canvas";
  label: string;
  description: string;
  presetId: WorkspacePresetId;
  presentation: "facelift-simple" | "facelift-canvas" | "classic-simple" | "classic-canvas";
  recommendedFor: "all" | "math" | "chemistry" | "history";
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
  "chem-concept-cards": { width: 340, height: 260 },
  "chem-quick-tools": { width: 340, height: 260 },
  "chem-periodic-table": {
    primary: { width: 760, height: 520 },
    secondary: { width: 560, height: 380 },
  },
  "chem-element-builder": { width: 460, height: 360 },
  "chem-electron-config-builder": { width: 460, height: 360 },
  "chem-periodic-trends-graph": { width: 520, height: 340 },
  "chem-molecule-builder": {
    primary: { width: 620, height: 460 },
    secondary: { width: 460, height: 340 },
  },
  "chem-geometry-viewer": { width: 420, height: 320 },
  "chem-reaction-balancer": { width: 520, height: 360 },
  "chem-tri-reaction-view": {
    primary: { width: 620, height: 420 },
    secondary: { width: 480, height: 320 },
  },
  "chem-stoichiometry-coach": { width: 520, height: 360 },
  "chem-molar-mass-calculator": { width: 340, height: 240 },
  "chem-solution-mixer": {
    primary: { width: 620, height: 440 },
    secondary: { width: 460, height: 340 },
  },
  "chem-molarity-calculator": { width: 360, height: 260 },
  "chem-desmos-concentration-graph": { width: 520, height: 360 },
  "chem-ph-calculator": { width: 420, height: 320 },
  "chem-titration-lab": {
    primary: { width: 640, height: 520 },
    secondary: { width: 520, height: 380 },
  },
  "chem-desmos-titration-curve": { width: 520, height: 360 },
  "chem-kinetics-simulator": { width: 520, height: 360 },
  "chem-desmos-kinetics-plot": { width: 520, height: 360 },
  "chem-data-table": { width: 360, height: 260 },
  "chem-calorimetry-lab": {
    primary: { width: 560, height: 420 },
    secondary: { width: 420, height: 320 },
  },
  "chem-energy-diagram": { width: 420, height: 320 },
  "chem-calculation-sheet": { width: 420, height: 320 },
  "chem-safety-cards": { width: 340, height: 260 },
  "chem-review-queue": { width: 360, height: 280 },
  "chem-lab-notebook": { width: 420, height: 360 },
  "chem-reference-safety": { width: 320, height: 260 },
  "history-timeline": { width: 420, height: 340 },
  "history-evidence": { width: 420, height: 320 },
  "history-argument": {
    primary: { width: 520, height: 360 },
    secondary: { width: 420, height: 320 },
  },
  "history-myth-checks": { width: 320, height: 260 },
  flashcards: {
    primary: { width: 680, height: 520 },
    secondary: { width: 420, height: 320 },
  },
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
  "recall-lab": {
    id: "recall-lab",
    purpose: "Make source-linked active recall the whole study surface while keeping source, notes, and highlights available as drawers.",
    primary: ["flashcards"],
    secondary: ["lesson", "private-notes", "recent-highlights"],
    optional: ["comments", "binder-notebook", "related-concepts"],
    defaultVisible: ["flashcards", "lesson", "private-notes", "recent-highlights"],
    compactVisible: ["flashcards", "lesson"],
    smallScreenVisible: ["flashcards"],
    collapsedByDefault: ["comments", "binder-notebook", "related-concepts"],
    desktopRecipe: "lesson-primary-rail",
    smallScreenRecipe: "lesson-primary-rail",
    fitStrategy: "preserve-composition",
  },
  "chem-guided-study": {
    id: "chem-guided-study",
    purpose: "Study chemistry with a readable source, private notes, concept cards, and compact quick tools.",
    primary: ["lesson"],
    secondary: ["private-notes", "chem-concept-cards", "chem-quick-tools"],
    optional: ["chem-periodic-table", "chem-desmos-titration-curve", "chem-titration-lab", "chem-reaction-balancer"],
    defaultVisible: ["lesson", "private-notes", "chem-concept-cards", "chem-quick-tools"],
    compactVisible: ["lesson", "private-notes", "chem-concept-cards"],
    smallScreenVisible: ["lesson", "private-notes", "chem-quick-tools"],
    collapsedByDefault: ["chem-periodic-table", "chem-desmos-titration-curve", "chem-titration-lab", "chem-reaction-balancer"],
    desktopRecipe: "lesson-primary-rail",
    smallScreenRecipe: "lesson-primary-rail",
    fitStrategy: "preserve-composition",
  },
  "chem-element-explorer": {
    id: "chem-element-explorer",
    purpose: "Explore atoms, ions, isotopes, electron configuration, and periodic trends from one flagship table.",
    primary: ["chem-periodic-table"],
    secondary: ["chem-element-builder", "chem-periodic-trends-graph", "lesson"],
    optional: ["private-notes", "chem-electron-config-builder", "chem-molecule-builder"],
    defaultVisible: ["chem-periodic-table", "chem-element-builder", "chem-periodic-trends-graph", "lesson"],
    compactVisible: ["chem-periodic-table", "chem-element-builder", "lesson"],
    smallScreenVisible: ["chem-periodic-table", "chem-element-builder"],
    collapsedByDefault: ["private-notes", "chem-electron-config-builder", "chem-molecule-builder"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
    fitStrategy: "preserve-composition",
  },
  "chem-bonding-studio": {
    id: "chem-bonding-studio",
    purpose: "Build Lewis structures and geometry with source and notes support nearby.",
    primary: ["chem-molecule-builder"],
    secondary: ["chem-geometry-viewer", "lesson", "private-notes"],
    optional: ["chem-quick-tools", "chem-concept-cards", "chem-review-queue"],
    defaultVisible: ["chem-molecule-builder", "chem-geometry-viewer", "lesson", "private-notes"],
    compactVisible: ["chem-molecule-builder", "lesson", "private-notes"],
    smallScreenVisible: ["chem-molecule-builder", "lesson"],
    collapsedByDefault: ["chem-quick-tools", "chem-concept-cards", "chem-review-queue"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
    fitStrategy: "preserve-composition",
  },
  "chem-reaction-studio": {
    id: "chem-reaction-studio",
    purpose: "Balance reactions and connect symbolic equations to particle and observation views.",
    primary: ["chem-tri-reaction-view"],
    secondary: ["chem-reaction-balancer", "lesson", "private-notes"],
    optional: ["chem-stoichiometry-coach", "chem-quick-tools", "chem-concept-cards"],
    defaultVisible: ["chem-tri-reaction-view", "chem-reaction-balancer", "lesson", "private-notes"],
    compactVisible: ["chem-tri-reaction-view", "chem-reaction-balancer", "lesson"],
    smallScreenVisible: ["chem-tri-reaction-view", "chem-reaction-balancer"],
    collapsedByDefault: ["chem-stoichiometry-coach", "chem-quick-tools", "chem-concept-cards"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
    fitStrategy: "preserve-composition",
  },
  "chem-stoichiometry-lab": {
    id: "chem-stoichiometry-lab",
    purpose: "Give the mole bridge, molar mass, source, and notes enough room for calculation practice.",
    primary: ["chem-stoichiometry-coach"],
    secondary: ["chem-molar-mass-calculator", "lesson", "private-notes"],
    optional: ["chem-reaction-balancer", "chem-quick-tools", "chem-review-queue"],
    defaultVisible: ["chem-stoichiometry-coach", "chem-molar-mass-calculator", "lesson", "private-notes"],
    compactVisible: ["chem-stoichiometry-coach", "lesson", "private-notes"],
    smallScreenVisible: ["chem-stoichiometry-coach", "lesson"],
    collapsedByDefault: ["chem-reaction-balancer", "chem-quick-tools", "chem-review-queue"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
    fitStrategy: "preserve-composition",
  },
  "chem-solutions-molarity-lab": {
    id: "chem-solutions-molarity-lab",
    purpose: "Practice solution preparation with a bench, concentration graph, and notebook capture.",
    primary: ["chem-solution-mixer"],
    secondary: ["chem-molarity-calculator", "chem-desmos-concentration-graph", "chem-lab-notebook"],
    optional: ["lesson", "chem-safety-cards", "chem-reference-safety"],
    defaultVisible: ["chem-solution-mixer", "chem-molarity-calculator", "chem-desmos-concentration-graph", "chem-lab-notebook"],
    compactVisible: ["chem-solution-mixer", "chem-desmos-concentration-graph", "chem-lab-notebook"],
    smallScreenVisible: ["chem-solution-mixer", "chem-lab-notebook"],
    collapsedByDefault: ["lesson", "chem-safety-cards", "chem-reference-safety"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
    fitStrategy: "preserve-composition",
  },
  "chem-acid-base-titration-lab": {
    id: "chem-acid-base-titration-lab",
    purpose: "Run acid-base titrations with pH, curve, safety, and notebook surfaces visible.",
    primary: ["chem-titration-lab"],
    secondary: ["chem-desmos-titration-curve", "chem-ph-calculator", "chem-lab-notebook"],
    optional: ["lesson", "chem-safety-cards", "chem-reference-safety"],
    defaultVisible: ["chem-titration-lab", "chem-desmos-titration-curve", "chem-ph-calculator", "chem-lab-notebook"],
    compactVisible: ["chem-titration-lab", "chem-desmos-titration-curve", "chem-lab-notebook"],
    smallScreenVisible: ["chem-titration-lab", "chem-desmos-titration-curve"],
    collapsedByDefault: ["lesson", "chem-safety-cards", "chem-reference-safety"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
    fitStrategy: "preserve-composition",
  },
  "chem-kinetics-graph-lab": {
    id: "chem-kinetics-graph-lab",
    purpose: "Explore reaction rates with simulator controls, data, graph, and source context.",
    primary: ["chem-desmos-kinetics-plot"],
    secondary: ["chem-kinetics-simulator", "chem-data-table", "lesson"],
    optional: ["private-notes", "chem-concept-cards", "chem-review-queue"],
    defaultVisible: ["chem-desmos-kinetics-plot", "chem-kinetics-simulator", "chem-data-table", "lesson"],
    compactVisible: ["chem-desmos-kinetics-plot", "chem-kinetics-simulator", "lesson"],
    smallScreenVisible: ["chem-kinetics-simulator", "chem-desmos-kinetics-plot"],
    collapsedByDefault: ["private-notes", "chem-concept-cards", "chem-review-queue"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
    fitStrategy: "preserve-composition",
  },
  "chem-thermochemistry-studio": {
    id: "chem-thermochemistry-studio",
    purpose: "Connect calorimetry calculations, energy diagrams, and lab-notebook reasoning.",
    primary: ["chem-calorimetry-lab"],
    secondary: ["chem-energy-diagram", "chem-calculation-sheet", "chem-lab-notebook"],
    optional: ["lesson", "chem-desmos-concentration-graph", "chem-safety-cards"],
    defaultVisible: ["chem-calorimetry-lab", "chem-energy-diagram", "chem-calculation-sheet", "chem-lab-notebook"],
    compactVisible: ["chem-calorimetry-lab", "chem-calculation-sheet", "chem-lab-notebook"],
    smallScreenVisible: ["chem-calorimetry-lab", "chem-lab-notebook"],
    collapsedByDefault: ["lesson", "chem-desmos-concentration-graph", "chem-safety-cards"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
    fitStrategy: "preserve-composition",
  },
  "chem-full-studio": {
    id: "chem-full-studio",
    purpose: "Offer an advanced chemistry studio while keeping visible modules readable instead of smashed.",
    primary: ["chem-periodic-table", "chem-reaction-balancer"],
    secondary: ["lesson", "private-notes", "chem-desmos-titration-curve", "chem-lab-notebook"],
    optional: ["chem-element-builder", "chem-molecule-builder", "chem-stoichiometry-coach", "chem-ph-calculator", "chem-safety-cards", "chem-review-queue"],
    defaultVisible: ["lesson", "private-notes", "chem-periodic-table", "chem-reaction-balancer", "chem-desmos-titration-curve", "chem-lab-notebook"],
    compactVisible: ["chem-periodic-table", "chem-reaction-balancer", "lesson", "private-notes"],
    smallScreenVisible: ["chem-periodic-table", "lesson", "private-notes"],
    collapsedByDefault: ["chem-element-builder", "chem-molecule-builder", "chem-stoichiometry-coach", "chem-ph-calculator", "chem-safety-cards", "chem-review-queue"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
    fitStrategy: "preserve-composition",
  },
  "chemistry-lab": {
    id: "chemistry-lab",
    purpose: "Run a chemistry lab or stoichiometry check with source context and structured notebook capture.",
    primary: ["chem-titration-lab"],
    secondary: ["lesson", "chem-lab-notebook", "chem-stoichiometry-coach"],
    optional: ["chem-reference-safety", "private-notes", "recent-highlights"],
    defaultVisible: ["lesson", "chem-titration-lab", "chem-lab-notebook"],
    compactVisible: ["chem-titration-lab", "chem-lab-notebook", "lesson"],
    smallScreenVisible: ["chem-titration-lab"],
    collapsedByDefault: ["chem-stoichiometry-coach", "chem-reference-safety", "private-notes", "recent-highlights"],
    desktopRecipe: "chemistry-lab-zones",
    smallScreenRecipe: "chemistry-lab-zones",
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
  "recall-lab": "Recall Lab should dominate the workspace, with source, notes, and highlights available without cramming the practice card.",
  "chem-guided-study": "Chemistry guided study keeps the lesson and notes central while concept cards and quick tools stay compact.",
  "chem-element-explorer": "Element exploration should make the periodic table the flagship surface with builder and trend tools supporting it.",
  "chem-bonding-studio": "Bonding work needs the molecule builder dominant while source, geometry, and notes stay readable.",
  "chem-reaction-studio": "Reaction study connects symbolic balancing to particle-level and observable evidence without clutter.",
  "chem-stoichiometry-lab": "Stoichiometry needs the unit ladder primary, with molar mass, source context, and notes close by.",
  "chem-solutions-molarity-lab": "Solution work needs a virtual bench, concentration graph, and notebook checkpoint surface.",
  "chem-acid-base-titration-lab": "Titration work needs the bench and curve visible together with pH and notebook support.",
  "chem-kinetics-graph-lab": "Kinetics study centers graph and data interpretation while simulator controls stay nearby.",
  "chem-thermochemistry-studio": "Thermochemistry pairs calorimetry calculation with energy diagrams and lab reasoning.",
  "chem-full-studio": "The full chemistry studio exposes major tools while preserving readable zones and collapsing optional tools first.",
  "chemistry-lab": "Chemistry work needs a live lab or stoichiometry surface, a readable source, and structured notebook capture without saving every small interaction.",
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
  "chemistry-lab-zones": {
    desktop: "Lab work sits at the center with source context and notebook capture beside it.",
    laptop: "Lab, notes, and source keep priority while optional reference tools collapse.",
    tablet: "Chemistry work stacks into lab, notes, and lesson sections before shrinking.",
    phone: "Lesson, Lab, Notes, and Tools tabs replace the full desktop lab canvas.",
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
  studentCommand?: FaceliftWorkspacePresetDesign["studentCommand"];
  performanceBudget?: Partial<FaceliftWorkspacePresetDesign["performanceBudget"]>;
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

const heavyWorkspaceModules = new Set<WorkspaceModuleId>([
  "desmos-graph",
  "scientific-calculator",
  "saved-graphs",
  "whiteboard",
  "chem-periodic-table",
  "chem-periodic-trends-graph",
  "chem-molecule-builder",
  "chem-tri-reaction-view",
  "chem-solution-mixer",
  "chem-desmos-concentration-graph",
  "chem-titration-lab",
  "chem-desmos-titration-curve",
  "chem-kinetics-simulator",
  "chem-desmos-kinetics-plot",
  "chem-calorimetry-lab",
  "history-timeline",
  "history-evidence",
  "history-argument",
  "history-myth-checks",
  "flashcards",
]);

const defaultStudentCommands: Record<WorkspacePresetId, FaceliftWorkspacePresetDesign["studentCommand"]> = {
  "focused-reading": {
    intent: "read",
    label: "Read",
    primaryAction: "Read the next section",
    followUpAction: "Mark one sentence that carries the main idea.",
  },
  "split-study": {
    intent: "write",
    label: "Read + write",
    primaryAction: "Read one paragraph",
    followUpAction: "Rewrite it once in your own words.",
  },
  "notes-focus": {
    intent: "write",
    label: "Write",
    primaryAction: "Build your explanation",
    followUpAction: "Use the lesson only when you need evidence or wording.",
  },
  "annotation-mode": {
    intent: "read",
    label: "Annotate",
    primaryAction: "Select one important source line",
    followUpAction: "Add why it matters before moving on.",
  },
  "math-study": {
    intent: "graph",
    label: "Study graph",
    primaryAction: "Compare formula and graph",
    followUpAction: "Write the pattern you notice in notes.",
  },
  "math-simple-presentation": {
    intent: "read",
    label: "Follow",
    primaryAction: "Follow the worked explanation",
    followUpAction: "Open the graph only when the formula needs a visual.",
  },
  "math-guided-study": {
    intent: "graph",
    label: "Guided math",
    primaryAction: "Move from lesson to graph",
    followUpAction: "Explain the relationship in your notes.",
  },
  "math-graph-lab": {
    intent: "graph",
    label: "Graph lab",
    primaryAction: "Change one graph idea",
    followUpAction: "Record what moved, stretched, or stayed fixed.",
  },
  "math-proof-concept": {
    intent: "work",
    label: "Reason",
    primaryAction: "Name the rule",
    followUpAction: "Test it against one example or counterexample.",
  },
  "math-practice-mode": {
    intent: "work",
    label: "Practice",
    primaryAction: "Work one problem on the board",
    followUpAction: "Check the formula and write the hinge step.",
  },
  "full-math-canvas": {
    intent: "work",
    label: "Math studio",
    primaryAction: "Use the largest work surface first",
    followUpAction: "Open extra tools only when they answer the next question.",
  },
  "recall-lab": {
    intent: "work",
    label: "Recall",
    primaryAction: "Start with due cards",
    followUpAction: "After a miss, open the source and record why it slipped.",
  },
  "chem-guided-study": {
    intent: "lab",
    label: "Chem guide",
    primaryAction: "Read the next chemistry idea",
    followUpAction: "Use one concept card and write the rule in your own words.",
  },
  "chem-element-explorer": {
    intent: "lab",
    label: "Explore elements",
    primaryAction: "Select an element and inspect its trend behavior",
    followUpAction: "Build the isotope or ion that matches the lesson prompt.",
  },
  "chem-bonding-studio": {
    intent: "work",
    label: "Build bonds",
    primaryAction: "Build the Lewis structure",
    followUpAction: "Check geometry and formal charge before moving on.",
  },
  "chem-reaction-studio": {
    intent: "work",
    label: "React",
    primaryAction: "Balance the equation",
    followUpAction: "Explain the same reaction in particle and observation views.",
  },
  "chem-stoichiometry-lab": {
    intent: "work",
    label: "Mole bridge",
    primaryAction: "Complete the unit ladder",
    followUpAction: "Check that every unit cancels before rounding.",
  },
  "chem-solutions-molarity-lab": {
    intent: "lab",
    label: "Mix solution",
    primaryAction: "Calculate the stock volume",
    followUpAction: "Record the dilution setup and safety note.",
  },
  "chem-acid-base-titration-lab": {
    intent: "lab",
    label: "Titrate",
    primaryAction: "Add a controlled titrant increment",
    followUpAction: "Record the pH change and endpoint evidence.",
  },
  "chem-kinetics-graph-lab": {
    intent: "graph",
    label: "Rate graph",
    primaryAction: "Change one kinetics variable",
    followUpAction: "Record which graph shape or linearization changed.",
  },
  "chem-thermochemistry-studio": {
    intent: "lab",
    label: "Heat flow",
    primaryAction: "Calculate q from calorimetry data",
    followUpAction: "Classify the process as endothermic or exothermic.",
  },
  "chem-full-studio": {
    intent: "lab",
    label: "Chem studio",
    primaryAction: "Start with the main challenge card",
    followUpAction: "Open optional tools only when the challenge needs them.",
  },
  "chemistry-lab": {
    intent: "lab",
    label: "Run lab",
    primaryAction: "Add one controlled titrant increment",
    followUpAction: "Record the pH change and explain the endpoint evidence.",
  },
  "history-guided": {
    intent: "timeline",
    label: "History loop",
    primaryAction: "Read the source in context",
    followUpAction: "Place it in time, then save one useful piece of evidence.",
  },
  "history-timeline-focus": {
    intent: "timeline",
    label: "Timeline",
    primaryAction: "Find the next event",
    followUpAction: "Explain what changed and why it mattered.",
  },
  "history-source-evidence": {
    intent: "evidence",
    label: "Evidence",
    primaryAction: "Collect one strong source detail",
    followUpAction: "Write what it proves, not just what it says.",
  },
  "history-argument-builder": {
    intent: "argue",
    label: "Argument",
    primaryAction: "Write the claim first",
    followUpAction: "Attach only the evidence that actually supports it.",
  },
  "history-full-studio": {
    intent: "timeline",
    label: "History studio",
    primaryAction: "Start with chronology",
    followUpAction: "Move through source, evidence, and argument in order.",
  },
};

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
      compact: ["history-timeline", "lesson", "history-evidence", "history-argument"],
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
    performanceBudget: {
      maxComfortableModules: 4,
      maxCompactModules: 3,
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
  const mobilePrimaryModule = getMobileModuleOrder(presetId).find((moduleId) =>
    appendUnique([...visibleModules, ...collapsedModules]).includes(moduleId),
  ) ?? resolvedPrimaryModule;
  const defaultPerformanceBudget: FaceliftWorkspacePresetDesign["performanceBudget"] = {
    maxComfortableModules: presetId === "full-math-canvas" || presetId === "history-full-studio" ? 5 : 4,
    maxCompactModules: 3,
    mobilePrimaryModule,
    lazyModules: appendUnique([...visibleModules, ...collapsedModules]).filter((moduleId) =>
      heavyWorkspaceModules.has(moduleId),
    ),
  };

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
    studentCommand: override.studentCommand ?? defaultStudentCommands[presetId],
    performanceBudget: {
      ...defaultPerformanceBudget,
      ...override.performanceBudget,
      lazyModules: override.performanceBudget?.lazyModules ?? defaultPerformanceBudget.lazyModules,
    },
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

  if (presetId === "chemistry-lab") {
    return buildChemistryLabFrames(width, height);
  }

  if (presetId.startsWith("chem-")) {
    return buildChemistryShowcaseFrames(presetId, width, height);
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

function buildChemistryShowcaseFrames(
  presetId: WorkspacePresetId,
  width: number,
  height: number,
): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const design = getWorkspacePresetDesign(presetId);
  const visible = design.defaultVisible.slice(0, 6);
  const gap = 16;
  const frames: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> = {};
  const primary = design.primary[0] ?? visible[0];
  const leftWidth = Math.max(360, Math.round(width * 0.28));
  const rightWidth = Math.max(360, Math.round(width * 0.28));
  const centerWidth = Math.max(520, width - leftWidth - rightWidth - gap * 2);
  const leftModules = visible.filter((moduleId) => moduleId !== primary).slice(0, 2);
  const rightModules = visible.filter((moduleId) => moduleId !== primary && !leftModules.includes(moduleId)).slice(0, 3);

  frames[primary] = faceliftFrame(leftWidth + gap, 0, centerWidth, height, 3);

  leftModules.forEach((moduleId, index) => {
    frames[moduleId] = faceliftFrame(
      0,
      index === 0 ? 0 : Math.round(height * 0.52) + gap,
      leftWidth,
      index === 0 ? Math.round(height * 0.52) : Math.max(260, Math.round(height * 0.48) - gap),
      index + 1,
    );
  });

  rightModules.forEach((moduleId, index) => {
    const slotHeight = Math.max(220, Math.floor((height - gap * (rightModules.length - 1)) / Math.max(rightModules.length, 1)));
    frames[moduleId] = faceliftFrame(
      leftWidth + centerWidth + gap * 2,
      index * (slotHeight + gap),
      rightWidth,
      slotHeight,
      index + 4,
    );
  });

  return frames;
}

function buildChemistryLabFrames(width: number, height: number): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;
  const compact = width < 1280;
  const sourceWidth = compact ? Math.max(360, Math.round(width * 0.28)) : Math.max(420, Math.round(width * 0.26));
  const notebookWidth = compact ? Math.max(360, Math.round(width * 0.28)) : Math.max(460, Math.round(width * 0.28));
  const labWidth = Math.max(520, width - sourceWidth - notebookWidth - gap * 2);
  const notebookX = sourceWidth + labWidth + gap * 2;
  const sourceHeight = Math.max(320, Math.round(height * 0.58));

  return {
    lesson: faceliftFrame(0, 0, sourceWidth, sourceHeight, 1),
    "chem-reference-safety": faceliftFrame(
      0,
      sourceHeight + gap,
      sourceWidth,
      Math.max(260, height - sourceHeight - gap),
      2,
    ),
    "chem-titration-lab": faceliftFrame(sourceWidth + gap, 0, labWidth, height, 3),
    "chem-lab-notebook": faceliftFrame(notebookX, 0, Math.max(0, width - notebookX), height, 4),
    "chem-stoichiometry-coach": faceliftFrame(
      sourceWidth + gap,
      Math.max(0, Math.round(height * 0.58)),
      labWidth,
      Math.max(320, Math.round(height * 0.4)),
      5,
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
  const argumentWidth = Math.max(520, Math.round(width * 0.38));
  const supportWidth = Math.max(420, Math.floor((width - argumentWidth - gap * 2) / 2));
  const evidenceX = supportWidth + gap;
  const argumentX = evidenceX + supportWidth + gap;

  return {
    "history-timeline": faceliftFrame(0, 0, width, timelineHeight, 1),
    lesson: faceliftFrame(0, timelineHeight + gap, supportWidth, lowerHeight, 2),
    "history-evidence": faceliftFrame(evidenceX, timelineHeight + gap, supportWidth, lowerHeight, 3),
    "history-argument": faceliftFrame(argumentX, timelineHeight + gap, width - argumentX, lowerHeight, 4),
  };
}

function buildGeneralFaceliftFrames(
  presetId: WorkspacePresetId,
  width: number,
  height: number,
): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const gap = 16;

  if (presetId === "recall-lab") {
    const leftWidth = Math.max(260, Math.round(width * 0.16));
    const rightWidth = Math.max(320, Math.round(width * 0.2));
    const centerX = leftWidth + gap;
    const centerWidth = Math.max(620, width - leftWidth - rightWidth - gap * 2);
    const rightX = centerX + centerWidth + gap;
    return {
      lesson: faceliftFrame(0, 0, leftWidth, height, 1),
      flashcards: faceliftFrame(centerX, 0, centerWidth, height, 2),
      "private-notes": faceliftFrame(rightX, 0, rightWidth, Math.round(height * 0.58), 3),
      "recent-highlights": faceliftFrame(rightX, Math.round(height * 0.58) + gap, rightWidth, Math.round(height * 0.42) - gap, 4),
    };
  }

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

export function getWorkspaceStarterChoices(options: {
  binderSubject?: string | null;
  historyEnabled?: boolean;
} = {}): WorkspaceStarterChoice[] {
  const subject = options.binderSubject?.toLowerCase() ?? "";
  const isMath = subject.includes("math") || subject.includes("algebra") || subject.includes("geometry");
  const isChemistry = subject.includes("chem") || subject.includes("stoich") || subject.includes("titration");
  const isHistory = Boolean(options.historyEnabled) || subject.includes("history");
  const choices: WorkspaceStarterChoice[] = [
    {
      id: "read",
      label: "Read",
      description: "Open a calm lesson-first workspace with only the essentials visible.",
      presetId: "focused-reading",
      presentation: "facelift-simple",
      recommendedFor: "all",
    },
    {
      id: "notes",
      label: "Take notes",
      description: "Put writing first while keeping the source close enough to reference.",
      presetId: "notes-focus",
      presentation: "facelift-simple",
      recommendedFor: "all",
    },
  ];

  if (isMath) {
    choices.push({
      id: "math",
      label: "Work math",
      description: "Start with the whiteboard, formulas, and graph-ready math tools.",
      presetId: "math-practice-mode",
      presentation: "facelift-simple",
      recommendedFor: "math",
    });
  }

  if (isChemistry) {
    choices.push({
      id: "chemistry",
      label: "Chemistry tools",
      description: "Open the new chemistry showcase tools with source context and notes.",
      presetId: "chem-guided-study",
      presentation: "facelift-simple",
      recommendedFor: "chemistry",
    });
  }

  if (isHistory) {
    choices.push({
      id: "history",
      label: "Build history",
      description: "Move through source, timeline, evidence, and argument in a guided loop.",
      presetId: "history-guided",
      presentation: "facelift-simple",
      recommendedFor: "history",
    });
  }

  choices.push({
    id: "canvas",
    label: "Use canvas",
    description: "Open the redesigned movable workspace when you want full layout power.",
    presetId: isMath ? "math-graph-lab" : isChemistry ? "chem-full-studio" : isHistory ? "history-full-studio" : "split-study",
    presentation: "facelift-canvas",
    recommendedFor: "all",
  });

  return choices;
}

const compactMobileToolModules = new Set<WorkspaceModuleId>([
  "scientific-calculator",
  "saved-graphs",
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
  "chem-concept-cards": "Review",
  "chem-quick-tools": "Tools",
  "chem-periodic-table": "Table",
  "chem-element-builder": "Element",
  "chem-electron-config-builder": "Orbitals",
  "chem-periodic-trends-graph": "Trends",
  "chem-molecule-builder": "Builder",
  "chem-geometry-viewer": "Geometry",
  "chem-reaction-balancer": "Balance",
  "chem-tri-reaction-view": "Reaction",
  "chem-stoichiometry-coach": "Tools",
  "chem-molar-mass-calculator": "Mass",
  "chem-solution-mixer": "Lab",
  "chem-molarity-calculator": "Molarity",
  "chem-desmos-concentration-graph": "Graph",
  "chem-ph-calculator": "pH",
  "chem-titration-lab": "Lab",
  "chem-desmos-titration-curve": "Curve",
  "chem-kinetics-simulator": "Sim",
  "chem-desmos-kinetics-plot": "Graph",
  "chem-data-table": "Data",
  "chem-calorimetry-lab": "Lab",
  "chem-energy-diagram": "Energy",
  "chem-calculation-sheet": "Calc",
  "chem-safety-cards": "Safety",
  "chem-review-queue": "Review",
  "chem-lab-notebook": "Notes",
  "chem-reference-safety": "Tools",
  "history-timeline": "Timeline",
  "history-evidence": "Evidence",
  "history-argument": "Argument",
  "history-myth-checks": "Myth checks",
  tasks: "Tasks",
  search: "Search",
  flashcards: "Recall Lab",
  "mini-tools": "Tools",
};

function getMobileModuleOrder(presetId: WorkspacePresetId): WorkspaceModuleId[] {
  if (presetId === "chemistry-lab" || presetId.startsWith("chem-")) {
    return [
      "lesson",
      "private-notes",
      "chem-periodic-table",
      "chem-element-builder",
      "chem-molecule-builder",
      "chem-reaction-balancer",
      "chem-titration-lab",
      "chem-desmos-titration-curve",
      "chem-solution-mixer",
      "chem-kinetics-simulator",
      "chem-lab-notebook",
      "chem-stoichiometry-coach",
      "chem-quick-tools",
      "chem-reference-safety",
    ];
  }

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
