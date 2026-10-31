import type { WorkspaceModuleId } from "@/types";
import type { WhiteboardModuleAnchorMode, WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

export type WhiteboardModuleDefinition = {
  moduleId: WorkspaceModuleId;
  label: string;
  description: string;
  heavy: boolean;
  defaultWidth: number;
  defaultHeight: number;
  defaultAnchorMode?: WhiteboardModuleAnchorMode;
};

export type WhiteboardModuleContextKind = "general" | "math" | "history";

const embeddableWhiteboardModules: WhiteboardModuleDefinition[] = [
  {
    moduleId: "lesson",
    label: "Source Lesson",
    description: "Open the current lesson as a live reference card.",
    heavy: false,
    defaultWidth: 560,
    defaultHeight: 420,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "private-notes",
    label: "Private Notes",
    description: "Write beside the board without copying note content into the board file.",
    heavy: false,
    defaultWidth: 560,
    defaultHeight: 440,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "comments",
    label: "Annotations",
    description: "Open sticky notes, comments, and source annotation tools for any lesson.",
    heavy: false,
    defaultWidth: 420,
    defaultHeight: 360,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "recent-highlights",
    label: "Highlights",
    description: "Review saved highlights from the selected lesson set.",
    heavy: false,
    defaultWidth: 420,
    defaultHeight: 360,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "formula-sheet",
    label: "Formula Sheet",
    description: "Keep lesson and note formulas near the sketch.",
    heavy: false,
    defaultWidth: 360,
    defaultHeight: 360,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "math-blocks",
    label: "Math Blocks",
    description: "Use lesson equations and graph blocks while you draw.",
    heavy: false,
    defaultWidth: 460,
    defaultHeight: 360,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "desmos-graph",
    label: "Desmos Graph",
    description: "Open a live graph card on the whiteboard.",
    heavy: true,
    defaultWidth: 720,
    defaultHeight: 560,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "scientific-calculator",
    label: "Scientific Calculator",
    description: "Open a live calculator card on the whiteboard.",
    heavy: true,
    defaultWidth: 360,
    defaultHeight: 420,
    defaultAnchorMode: "viewport",
  },
  {
    moduleId: "related-concepts",
    label: "Related Concepts",
    description: "Connect the board to nearby ideas in the binder.",
    heavy: false,
    defaultWidth: 360,
    defaultHeight: 320,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "saved-graphs",
    label: "Saved Graphs",
    description: "Open reusable graph states as a lightweight board companion.",
    heavy: false,
    defaultWidth: 360,
    defaultHeight: 320,
    defaultAnchorMode: "board-fixed-size",
  },
  // Chemistry tools for the math and science board. Each renders its live module lazily.
  {
    moduleId: "chem-periodic-table",
    label: "Periodic Table",
    description: "Look up elements, groups and trends beside your work.",
    heavy: false,
    defaultWidth: 640,
    defaultHeight: 480,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "chem-ph-calculator",
    label: "pH Calculator",
    description: "Work out pH and the species in a solution.",
    heavy: false,
    defaultWidth: 460,
    defaultHeight: 480,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "chem-titration-lab",
    label: "Titration Lab",
    description: "Run a titration and read pH at any volume.",
    heavy: false,
    defaultWidth: 620,
    defaultHeight: 520,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "chem-kinetics-simulator",
    label: "Kinetics Simulator",
    description: "Simulate rate laws and mechanisms over time.",
    heavy: false,
    defaultWidth: 600,
    defaultHeight: 500,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "chem-reaction-balancer",
    label: "Reaction Balancer",
    description: "Balance a chemical equation step by step.",
    heavy: false,
    defaultWidth: 480,
    defaultHeight: 400,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "history-timeline",
    label: "Timeline",
    description: "Keep the lesson timeline beside the whiteboard.",
    heavy: false,
    defaultWidth: 500,
    defaultHeight: 360,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "history-evidence",
    label: "Evidence",
    description: "Open source evidence and claim support while you sketch.",
    heavy: false,
    defaultWidth: 500,
    defaultHeight: 380,
    defaultAnchorMode: "board-fixed-size",
  },
  {
    moduleId: "history-argument",
    label: "Argument Builder",
    description: "Draft claim, evidence, and reasoning alongside the board.",
    heavy: false,
    defaultWidth: 520,
    defaultHeight: 400,
    defaultAnchorMode: "board-fixed-size",
  },
];

const mathWhiteboardModuleIds = new Set<WorkspaceModuleId>([
  "formula-sheet",
  "math-blocks",
  "desmos-graph",
  "scientific-calculator",
  "saved-graphs",
]);

// Chemistry tools sit on the math and science board (and general boards), not history boards.
const chemistryWhiteboardModuleIds = new Set<WorkspaceModuleId>([
  "chem-periodic-table",
  "chem-ph-calculator",
  "chem-titration-lab",
  "chem-kinetics-simulator",
  "chem-reaction-balancer",
]);

const historyWhiteboardModuleIds = new Set<WorkspaceModuleId>([
  "history-timeline",
  "history-evidence",
  "history-argument",
]);

export function getEmbeddableWhiteboardModules(contextKind: WhiteboardModuleContextKind = "math") {
  return embeddableWhiteboardModules.filter((definition) => {
    if (historyWhiteboardModuleIds.has(definition.moduleId)) {
      return contextKind === "history";
    }

    if (mathWhiteboardModuleIds.has(definition.moduleId)) {
      return contextKind === "math";
    }

    if (chemistryWhiteboardModuleIds.has(definition.moduleId)) {
      return contextKind !== "history";
    }

    return true;
  });
}

export function getWhiteboardModuleDefinition(moduleId: WorkspaceModuleId) {
  return embeddableWhiteboardModules.find((definition) => definition.moduleId === moduleId) ?? null;
}

export const alwaysLiveWhiteboardModules = new Set<WorkspaceModuleId>([
  "desmos-graph",
  "private-notes",
  "scientific-calculator",
]);

export const viewportFloatingWhiteboardModules = new Set<WorkspaceModuleId>([
  "desmos-graph",
]);

export function isAlwaysLiveWhiteboardModule(moduleId: WorkspaceModuleId) {
  return alwaysLiveWhiteboardModules.has(moduleId);
}

export function isViewportFloatingWhiteboardModule(moduleId: WorkspaceModuleId) {
  return viewportFloatingWhiteboardModules.has(moduleId);
}

export function shouldRenderWhiteboardModuleLive(
  moduleElement: WhiteboardModuleElement,
  options: { visible: boolean },
) {
  if (isAlwaysLiveWhiteboardModule(moduleElement.moduleId)) {
    return moduleElement.mode !== "collapsed";
  }

  if (moduleElement.mode !== "live" || !options.visible) {
    return false;
  }

  const definition = getWhiteboardModuleDefinition(moduleElement.moduleId);
  return Boolean(definition);
}

export function isHeavyWhiteboardModule(moduleId: WorkspaceModuleId) {
  return getWhiteboardModuleDefinition(moduleId)?.heavy ?? false;
}

export function getDefaultWhiteboardModuleAnchorMode(moduleId: WorkspaceModuleId): WhiteboardModuleAnchorMode {
  return getWhiteboardModuleDefinition(moduleId)?.defaultAnchorMode ?? "board";
}
