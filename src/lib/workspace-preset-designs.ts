import type { WorkspaceModuleId, WorkspacePresetId, WorkspaceWindowFrame } from "@/types";

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

function appendUnique<T>(base: T[], additions: T[]) {
  return [...base, ...additions.filter((item) => !base.includes(item))];
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
