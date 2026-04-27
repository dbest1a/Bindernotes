import type {
  FullCanvasSnapBehavior,
  WorkspaceModuleId,
  WorkspacePresetId,
  WorkspaceWindowFrame,
} from "@/types";
import {
  getWorkspaceModuleMinimumSize as getDesignedWorkspaceModuleMinimumSize,
  getWorkspacePresetDesign,
  validateDesignedLayout,
} from "@/lib/workspace-preset-designs";

export const WORKSPACE_LAYOUT_GAP = 16;
export const WORKSPACE_SNAP_THRESHOLD = 12;
export const WORKSPACE_SAFE_EDGE_PADDING = 8;
export const WORKSPACE_CANVAS_EXPAND_THRESHOLD = 180;
export const WORKSPACE_CANVAS_EXPAND_STEP = 640;
export const WORKSPACE_CANVAS_BOTTOM_PADDING = 320;
export const WORKSPACE_MAX_CANVAS_HEIGHT = 120_000;

export type WorkspaceSnapGuide = {
  axis: "x" | "y";
  kind: "canvas-edge" | "module-gap" | "module-align" | "module-center";
  label: string;
  position: number;
  start: number;
  end: number;
};

type Viewport = {
  width: number;
  height: number;
};

type ViewportBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type SnapCandidate = {
  axis: "x" | "y";
  kind: WorkspaceSnapGuide["kind"];
  label: string;
  position: number;
  target: number;
  current: number;
  start: number;
  end: number;
};

export function extendWorkspaceCanvasForFrame({
  bottomPadding = WORKSPACE_CANVAS_BOTTOM_PADDING,
  canvasHeight,
  expandBy = WORKSPACE_CANVAS_EXPAND_STEP,
  frame,
  maxCanvasHeight = WORKSPACE_MAX_CANVAS_HEIGHT,
  threshold = WORKSPACE_CANVAS_EXPAND_THRESHOLD,
  viewportHeight,
}: {
  bottomPadding?: number;
  canvasHeight: number;
  expandBy?: number;
  frame: WorkspaceWindowFrame;
  maxCanvasHeight?: number;
  threshold?: number;
  viewportHeight: number;
}) {
  const currentHeight = clamp(
    Math.round(Math.max(canvasHeight, viewportHeight)),
    Math.max(0, viewportHeight),
    maxCanvasHeight,
  );
  const frameBottom = Math.round(frame.y + frame.h);
  if (frameBottom < currentHeight - threshold) {
    return {
      canvasHeight: currentHeight,
      changed: currentHeight !== Math.round(canvasHeight),
    };
  }

  const nextHeight = clamp(
    Math.max(currentHeight + expandBy, frameBottom + bottomPadding, viewportHeight),
    viewportHeight,
    maxCanvasHeight,
  );

  return {
    canvasHeight: nextHeight,
    changed: nextHeight !== Math.round(canvasHeight),
  };
}

export function getWorkspaceModuleMinimumSize(moduleId: WorkspaceModuleId) {
  return getDesignedWorkspaceModuleMinimumSize(moduleId);
}

export function snapWindowFrame({
  frame,
  interaction = "move",
  moduleId,
  peerFrames,
  safeEdgePadding,
  snapBehavior,
  threshold = WORKSPACE_SNAP_THRESHOLD,
  viewport,
  viewportBounds,
}: {
  frame: WorkspaceWindowFrame;
  interaction?: "move" | "resize";
  moduleId?: WorkspaceModuleId;
  peerFrames: WorkspaceWindowFrame[];
  safeEdgePadding: boolean;
  snapBehavior: FullCanvasSnapBehavior;
  threshold?: number;
  viewport: Viewport;
  viewportBounds?: ViewportBounds;
}) {
  const bounds = resolveViewportBounds(viewport, safeEdgePadding, viewportBounds);
  const minSize = moduleId ? getWorkspaceModuleMinimumSize(moduleId) : { width: 160, height: 160 };
  const boundedFrame =
    interaction === "move"
      ? clampMovedFrame(frame, bounds)
      : clampResizedFrame(frame, bounds, minSize);

  if (snapBehavior === "off") {
    return {
      frame: boundedFrame,
      guides: [] as WorkspaceSnapGuide[],
    };
  }

  const horizontalCandidates = buildHorizontalSnapCandidates(
    boundedFrame,
    peerFrames,
    bounds,
    snapBehavior,
    interaction,
  );
  const verticalCandidates = buildVerticalSnapCandidates(
    boundedFrame,
    peerFrames,
    bounds,
    snapBehavior,
    interaction,
  );
  const bestHorizontal = findBestCandidate(horizontalCandidates, threshold);
  const bestVertical = findBestCandidate(verticalCandidates, threshold);
  let nextFrame = { ...boundedFrame };

  if (bestHorizontal) {
    if (interaction === "resize") {
      nextFrame.w = Math.max(minSize.width, bestHorizontal.target - nextFrame.x);
    } else {
      nextFrame.x = bestHorizontal.target;
    }
  }

  if (bestVertical) {
    if (interaction === "resize") {
      nextFrame.h = Math.max(minSize.height, bestVertical.target - nextFrame.y);
    } else {
      nextFrame.y = bestVertical.target;
    }
  }

  nextFrame =
    interaction === "move"
      ? clampMovedFrame(nextFrame, bounds)
      : clampResizedFrame(nextFrame, bounds, minSize);

  return {
    frame: nextFrame,
    guides: [bestHorizontal, bestVertical]
      .filter((candidate): candidate is SnapCandidate => Boolean(candidate))
      .map((candidate) => ({
        axis: candidate.axis,
        kind: candidate.kind,
        label: candidate.label,
        position: candidate.position,
        start: candidate.start,
        end: candidate.end,
      })),
  };
}

export function fitWindowFramesToViewport({
  force = false,
  frames,
  moduleIds,
  presetId,
  safeEdgePadding,
  viewport,
}: {
  force?: boolean;
  frames: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
  moduleIds: WorkspaceModuleId[];
  presetId?: WorkspacePresetId;
  safeEdgePadding: boolean;
  viewport: Viewport;
}) {
  const visibleModules = moduleIds.filter((moduleId) => frames[moduleId]);
  const original = pickFrames(frames, visibleModules);
  const bounds = getFrameBounds(Object.values(original));
  if (!bounds || viewport.width < 320 || viewport.height < 240) {
    return { frames, changed: false };
  }

  const validation = validateWindowFrameLayout({ frames, moduleIds: visibleModules, viewport });
  if (!force && validation.valid) {
    return { frames, changed: false };
  }

  const padding = safeEdgePadding ? WORKSPACE_SAFE_EDGE_PADDING : 0;
  const availableWidth = Math.max(320, viewport.width - padding * 2);
  const availableHeight = Math.max(240, viewport.height - padding * 2);
  const overflowScale = Math.min(
    availableWidth / Math.max(bounds.width, 1),
    availableHeight / Math.max(bounds.height, 1),
  );
  const underfilled =
    bounds.width < availableWidth * 0.68 && bounds.height < availableHeight * 0.74;
  const scale = bounds.width > availableWidth || bounds.height > availableHeight
    ? Math.min(1, overflowScale)
    : underfilled
      ? Math.min(1.16, overflowScale)
      : 1;
  const scaledFrames: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> = { ...frames };
  const fittedWidth = bounds.width * scale;
  const fittedHeight = bounds.height * scale;
  const offsetX = padding + Math.max(0, (availableWidth - fittedWidth) / 2);
  const offsetY = padding + Math.max(0, (availableHeight - fittedHeight) / 2);

  visibleModules.forEach((moduleId) => {
    const current = frames[moduleId];
    if (!current) {
      return;
    }

    const minimum = getWorkspaceModuleMinimumSize(moduleId);
    const next = clampResizedFrame(
      {
        x: Math.round(offsetX + (current.x - bounds.minX) * scale),
        y: Math.round(offsetY + (current.y - bounds.minY) * scale),
        w: Math.max(minimum.width, Math.round(current.w * scale)),
        h: Math.max(minimum.height, Math.round(current.h * scale)),
        z: current.z,
      },
      {
        minX: padding,
        maxX: viewport.width - padding,
        minY: padding,
        maxY: viewport.height - padding,
      },
      minimum,
    );
    scaledFrames[moduleId] = next;
  });

  const fittedValidation = validateWindowFrameLayout({
    frames: scaledFrames,
    moduleIds: visibleModules,
    viewport,
  });
  if (
    fittedValidation.errors.some((error) => error.includes("overlaps")) ||
    fittedValidation.errors.some((error) => error.includes("offscreen"))
  ) {
    return tidyWorkspaceFrames({
      frames,
      moduleIds: visibleModules,
      presetId: presetId ?? inferPresetForModules(visibleModules),
      safeEdgePadding,
      viewport,
    });
  }

  return {
    frames: scaledFrames,
    changed: !sameFrames(original, pickFrames(scaledFrames, visibleModules)),
  };
}

export function tidyWorkspaceFrames({
  frames,
  moduleIds,
  presetId,
  safeEdgePadding,
  viewport,
}: {
  frames: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
  moduleIds: WorkspaceModuleId[];
  presetId: WorkspacePresetId;
  safeEdgePadding: boolean;
  viewport: Viewport;
}) {
  const visibleModules = moduleIds.filter((moduleId) => frames[moduleId] || moduleIds.includes(moduleId));
  if (visibleModules.length === 0 || viewport.width < 320 || viewport.height < 240) {
    return { frames, changed: false };
  }

  const padding = safeEdgePadding ? WORKSPACE_SAFE_EDGE_PADDING : 0;
  const gap = WORKSPACE_LAYOUT_GAP;
  const usableWidth = Math.max(320, viewport.width - padding * 2);
  const usableHeight = Math.max(280, viewport.height - padding * 2);
  const nextFrames: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> = { ...frames };

  if (
    presetId === "split-study" &&
    visibleModules.includes("lesson") &&
    visibleModules.includes("private-notes")
  ) {
    const width = Math.floor(viewport.width / 2);
    const height = viewport.height;
    nextFrames.lesson = makeFrame(0, 0, width, height, frames.lesson?.z ?? 1);
    nextFrames["private-notes"] = makeFrame(
      width,
      0,
      viewport.width - width,
      height,
      frames["private-notes"]?.z ?? 2,
    );
    return {
      frames: nextFrames,
      changed: !sameFrames(pickFrames(frames, visibleModules), pickFrames(nextFrames, visibleModules)),
    };
  }

  const designedPreset = layoutDesignedPreset({
    frames,
    gap,
    moduleIds: visibleModules,
    padding,
    presetId,
    usableHeight,
    usableWidth,
  });
  if (designedPreset) {
    Object.assign(nextFrames, designedPreset);
    return {
      frames: nextFrames,
      changed: !sameFrames(pickFrames(frames, visibleModules), pickFrames(nextFrames, visibleModules)),
    };
  }

  const primary = resolvePrimaryModule(presetId, visibleModules);
  const secondary = visibleModules.filter((moduleId) => moduleId !== primary);
  if (!primary) {
    return { frames, changed: false };
  }

  if (secondary.length === 0) {
    nextFrames[primary] = makeFrame(
      padding,
      padding,
      usableWidth,
      usableHeight,
      frames[primary]?.z ?? 1,
    );
    return {
      frames: nextFrames,
      changed: !sameFrames(pickFrames(frames, visibleModules), pickFrames(nextFrames, visibleModules)),
    };
  }

  if (secondary.length > 3) {
    const primaryHeight = Math.max(360, Math.round(usableHeight * 0.62));
    const helperHeight = Math.max(180, usableHeight - primaryHeight - gap);
    const helperWidth = Math.max(
      160,
      Math.floor((usableWidth - gap * (secondary.length - 1)) / secondary.length),
    );
    nextFrames[primary] = makeFrame(
      padding,
      padding,
      usableWidth,
      Math.min(primaryHeight, usableHeight - helperHeight - gap),
      frames[primary]?.z ?? 1,
    );
    secondary.forEach((moduleId, index) => {
      nextFrames[moduleId] = makeFrame(
        padding + index * (helperWidth + gap),
        padding + usableHeight - helperHeight,
        index === secondary.length - 1
          ? usableWidth - helperWidth * index - gap * index
          : helperWidth,
        helperHeight,
        frames[moduleId]?.z ?? index + 2,
      );
    });
    return {
      frames: nextFrames,
      changed: !sameFrames(pickFrames(frames, visibleModules), pickFrames(nextFrames, visibleModules)),
    };
  }

  const railWidth = clamp(Math.round(usableWidth * 0.34), 340, Math.min(520, usableWidth - 440));
  const primaryWidth = Math.max(420, usableWidth - railWidth - gap);
  const railX = padding + primaryWidth + gap;
  nextFrames[primary] = makeFrame(
    padding,
    padding,
    primaryWidth,
    usableHeight,
    frames[primary]?.z ?? 1,
  );

  const weights = secondary.map((moduleId) => secondaryModuleWeight(moduleId));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const weightedHeight = Math.max(1, usableHeight - gap * (secondary.length - 1));
  let nextY = padding;
  secondary.forEach((moduleId, index) => {
    const isLast = index === secondary.length - 1;
    const helperHeight = isLast
      ? padding + usableHeight - nextY
      : Math.round((weightedHeight * weights[index]) / totalWeight);
    nextFrames[moduleId] = makeFrame(
      railX,
      nextY,
      usableWidth - primaryWidth - gap,
      helperHeight,
      frames[moduleId]?.z ?? index + 2,
    );
    nextY += helperHeight + gap;
  });

  return {
    frames: nextFrames,
    changed: !sameFrames(pickFrames(frames, visibleModules), pickFrames(nextFrames, visibleModules)),
  };
}

function secondaryModuleWeight(moduleId: WorkspaceModuleId) {
  if (
    moduleId === "private-notes" ||
    moduleId === "binder-notebook" ||
    moduleId === "desmos-graph" ||
    moduleId === "history-evidence" ||
    moduleId === "history-argument"
  ) {
    return 1.8;
  }

  return 1;
}

function layoutDesignedPreset({
  frames,
  gap,
  moduleIds,
  padding,
  presetId,
  usableHeight,
  usableWidth,
}: {
  frames: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
  gap: number;
  moduleIds: WorkspaceModuleId[];
  padding: number;
  presetId: WorkspacePresetId;
  usableHeight: number;
  usableWidth: number;
}) {
  const design = getWorkspacePresetDesign(presetId);
  if (!design) {
    return null;
  }

  const has = (moduleId: WorkspaceModuleId) => moduleIds.includes(moduleId);
  const next: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> = {};
  const place = (
    moduleId: WorkspaceModuleId,
    x: number,
    y: number,
    width: number,
    height: number,
    z: number,
  ) => {
    if (!has(moduleId)) {
      return;
    }

    const role = (design.primary as readonly WorkspaceModuleId[]).includes(moduleId)
      ? "primary"
      : "secondary";
    const minimum = getDesignedWorkspaceModuleMinimumSize(moduleId, role);
    next[moduleId] = makeFrame(
      padding + x,
      padding + y,
      Math.max(minimum.width, width),
      Math.max(minimum.height, height),
      frames[moduleId]?.z ?? z,
    );
  };

  const commit = () => {
    if (Object.keys(next).length === 0) {
      return null;
    }

    const validation = validateDesignedLayout({
      design,
      frames: next,
      moduleIds,
      viewport: {
        width: usableWidth + padding * 2,
        height: usableHeight + padding * 2,
      },
    });

    return validation.valid ? next : null;
  };

  const placeRightRail = (
    primaryModule: WorkspaceModuleId,
    railModules: WorkspaceModuleId[],
    primaryWidthRatio: number,
    minPrimaryWidth: number,
    minRailWidth: number,
    weights?: Partial<Record<WorkspaceModuleId, number>>,
  ) => {
    const railWidth = clamp(
      usableWidth - Math.max(minPrimaryWidth, Math.round(usableWidth * primaryWidthRatio)) - gap,
      minRailWidth,
      Math.max(minRailWidth, usableWidth - minPrimaryWidth - gap),
    );
    const primaryWidth = usableWidth - railWidth - gap;
    place(primaryModule, 0, 0, primaryWidth, usableHeight, 1);
    placeVerticalStack(
      railModules,
      primaryWidth + gap,
      0,
      railWidth,
      usableHeight,
      2,
      weights,
    );
  };

  const placeVerticalStack = (
    stackModules: WorkspaceModuleId[],
    x: number,
    y: number,
    width: number,
    height: number,
    startZ: number,
    weights: Partial<Record<WorkspaceModuleId, number>> = {},
  ) => {
    const present = stackModules.filter(has);
    if (present.length === 0) {
      return;
    }

    const availableHeight = height - gap * (present.length - 1);
    const totalWeight = present.reduce((total, moduleId) => total + (weights[moduleId] ?? 1), 0);
    let nextY = y;
    present.forEach((moduleId, index) => {
      const isLast = index === present.length - 1;
      const moduleHeight = isLast
        ? y + height - nextY
        : Math.round((availableHeight * (weights[moduleId] ?? 1)) / totalWeight);
      place(moduleId, x, nextY, width, moduleHeight, startZ + index);
      nextY += moduleHeight + gap;
    });
  };

  const placeTwoByTwo = (
    topLeft: WorkspaceModuleId,
    topRight: WorkspaceModuleId,
    bottomLeft: WorkspaceModuleId,
    bottomRight: WorkspaceModuleId,
    leftRatio = 0.55,
    topRatio = 0.55,
  ) => {
    const leftWidth = Math.round((usableWidth - gap) * leftRatio);
    const rightWidth = usableWidth - leftWidth - gap;
    const topHeight = Math.round((usableHeight - gap) * topRatio);
    const bottomHeight = usableHeight - topHeight - gap;
    place(topLeft, 0, 0, leftWidth, topHeight, 1);
    place(topRight, leftWidth + gap, 0, rightWidth, topHeight, 2);
    place(bottomLeft, 0, topHeight + gap, leftWidth, bottomHeight, 3);
    place(bottomRight, leftWidth + gap, topHeight + gap, rightWidth, bottomHeight, 4);
  };

  if (presetId === "focused-reading") {
    if (has("lesson-outline")) {
      const outlineWidth = 240;
      place("lesson-outline", 0, 0, outlineWidth, usableHeight, 1);
      place("lesson", outlineWidth + gap, 0, usableWidth - outlineWidth - gap, usableHeight, 2);
    } else {
      place("lesson", 0, 0, usableWidth, usableHeight, 1);
    }
    return commit();
  }

  if (presetId === "notes-focus") {
    placeRightRail("private-notes", ["lesson", "binder-notebook", "recent-highlights"], 0.66, 560, 420, {
      lesson: 1,
      "binder-notebook": 1.6,
      "recent-highlights": 0.8,
    });
    return commit();
  }

  if (presetId === "annotation-mode") {
    placeRightRail("lesson", ["private-notes", "comments", "recent-highlights"], 0.66, 560, 480, {
      "private-notes": 1.8,
      comments: 1.1,
      "recent-highlights": 1,
    });
    return commit();
  }

  if (presetId === "math-study") {
    if (has("lesson") && has("private-notes") && has("formula-sheet") && usableHeight >= 856) {
      const railWidth = clamp(Math.round(usableWidth * 0.34), 480, Math.max(480, usableWidth - 620 - gap));
      const leftWidth = usableWidth - railWidth - gap;
      const notesHeight = 360;
      const formulaHeight = 260;
      place("desmos-graph", 0, 0, leftWidth, usableHeight - notesHeight - gap, 1);
      place("private-notes", 0, usableHeight - notesHeight, leftWidth, notesHeight, 2);
      place("lesson", leftWidth + gap, 0, railWidth, usableHeight - formulaHeight - gap, 3);
      place("formula-sheet", leftWidth + gap, usableHeight - formulaHeight, railWidth, formulaHeight, 4);
    } else {
      placeRightRail("desmos-graph", ["formula-sheet", "private-notes", "lesson"], 0.64, 620, 480, {
        "formula-sheet": 0.8,
        "private-notes": 1.2,
        lesson: 1,
      });
    }
    return commit();
  }

  if (presetId === "math-proof-concept") {
    placeRightRail("lesson", ["math-blocks", "related-concepts", "private-notes"], 0.54, 560, 480, {
      "math-blocks": 1.1,
      "related-concepts": 0.85,
      "private-notes": 1.25,
    });
    return commit();
  }

  if (presetId === "math-graph-lab") {
    if (has("lesson") && has("private-notes") && has("formula-sheet") && usableHeight >= 856) {
      const railWidth = clamp(Math.round(usableWidth * 0.34), 480, Math.max(480, usableWidth - 620 - gap));
      const leftWidth = usableWidth - railWidth - gap;
      const notesHeight = 360;
      const formulaHeight = 260;
      place("desmos-graph", 0, 0, leftWidth, usableHeight - notesHeight - gap, 1);
      place("private-notes", 0, usableHeight - notesHeight, leftWidth, notesHeight, 2);
      place("lesson", leftWidth + gap, 0, railWidth, usableHeight - formulaHeight - gap, 3);
      place("formula-sheet", leftWidth + gap, usableHeight - formulaHeight, railWidth, formulaHeight, 4);
    } else {
      placeRightRail("desmos-graph", ["formula-sheet", "private-notes", "lesson"], 0.64, 620, 480, {
        "formula-sheet": 0.8,
        "private-notes": 1.2,
        lesson: 1,
      });
    }
    return commit();
  }

  if (presetId === "math-guided-study" || presetId === "math-simple-presentation") {
    const railMinimum = has("private-notes") ? 480 : 420;
    const lessonMinimum = usableWidth < 1320 ? 420 : 580;
    placeRightRail("lesson", ["private-notes", "math-blocks", "formula-sheet", "desmos-graph"], 0.58, lessonMinimum, railMinimum, {
      "private-notes": 1.25,
      "math-blocks": 1,
      "formula-sheet": 0.9,
      "desmos-graph": 1,
    });
    return commit();
  }

  if (presetId === "math-practice-mode") {
    if (has("whiteboard")) {
      placeRightRail("whiteboard", ["math-blocks", "private-notes", "formula-sheet", "lesson"], 0.58, 640, 420, {
        "math-blocks": 1.15,
        "private-notes": 1.2,
        "formula-sheet": 0.85,
        lesson: 0.8,
      });
      return commit();
    }

    placeRightRail("math-blocks", ["private-notes", "formula-sheet", "lesson"], 0.58, 420, 480, {
      "private-notes": 1.25,
      "formula-sheet": 0.9,
      lesson: 0.9,
    });
    return commit();
  }

  if (presetId === "full-math-canvas") {
    if (has("whiteboard") && !has("desmos-graph")) {
      placeRightRail("whiteboard", ["private-notes", "formula-sheet", "math-blocks", "lesson", "related-concepts"], 0.6, 640, has("private-notes") ? 480 : 320, {
        "private-notes": 1.25,
        "formula-sheet": 0.9,
        "math-blocks": 1,
        lesson: 1,
        "related-concepts": 0.85,
      });
      return commit();
    }

    if (has("whiteboard") && has("desmos-graph") && moduleIds.length <= 2) {
      const leftWidth = Math.floor((usableWidth - gap) / 2);
      place("desmos-graph", 0, 0, leftWidth, usableHeight, 1);
      place("whiteboard", leftWidth + gap, 0, usableWidth - leftWidth - gap, usableHeight, 2);
      return commit();
    }

    if (!has("math-blocks") || !has("lesson") || !has("related-concepts")) {
      placeRightRail("desmos-graph", ["private-notes", "formula-sheet", "math-blocks", "lesson", "related-concepts"], 0.56, 620, has("private-notes") ? 480 : 320, {
        "private-notes": 1.25,
        "formula-sheet": 0.9,
        "math-blocks": 1,
        lesson: 1,
        "related-concepts": 0.85,
      });
      return commit();
    }

    const primaryWidth = clamp(Math.round(usableWidth * 0.54), 620, usableWidth - 560 - gap);
    const railX = primaryWidth + gap;
    const railWidth = usableWidth - primaryWidth - gap;
    const graphHeight = Math.round((usableHeight - gap) * 0.58);
    const blocksHeight = usableHeight - graphHeight - gap;
    const sideHeight = usableHeight - gap * 2;
    const notesHeight = Math.round(sideHeight * 0.34);
    const lessonHeight = Math.round(sideHeight * 0.28);
    const bottomHeight = sideHeight - notesHeight - lessonHeight;
    const splitWidth = Math.floor((railWidth - gap) / 2);

    place("desmos-graph", 0, 0, primaryWidth, graphHeight, 1);
    place(has("whiteboard") ? "whiteboard" : "math-blocks", 0, graphHeight + gap, primaryWidth, blocksHeight, 2);
    if (has("whiteboard")) {
      place("math-blocks", railX, 0, railWidth, notesHeight, 3);
    }
    place("private-notes", railX, has("whiteboard") ? notesHeight + gap : 0, railWidth, notesHeight, 3);
    place("lesson", railX, (has("whiteboard") ? notesHeight * 2 : notesHeight) + gap, railWidth, lessonHeight, 4);
    place("formula-sheet", railX, notesHeight + lessonHeight + gap * 2, splitWidth, bottomHeight, 5);
    place(
      "related-concepts",
      railX + splitWidth + gap,
      notesHeight + lessonHeight + gap * 2,
      railWidth - splitWidth - gap,
      bottomHeight,
      6,
    );
    return commit();
  }

  if (presetId === "history-guided") {
    if (
      has("lesson") &&
      has("history-timeline") &&
      has("history-evidence") &&
      has("private-notes")
    ) {
      const leftWidth = Math.floor((usableWidth - gap) / 2);
      const rightWidth = usableWidth - leftWidth - gap;
      const topMinimum = Math.max(
        getDesignedWorkspaceModuleMinimumSize("lesson", "primary").height,
        getDesignedWorkspaceModuleMinimumSize("history-timeline").height,
      );
      const bottomMinimum = Math.max(
        getDesignedWorkspaceModuleMinimumSize("history-evidence").height,
        getDesignedWorkspaceModuleMinimumSize("private-notes").height,
      );
      const topHeight = clamp(
        Math.round((usableHeight - gap) * 0.54),
        topMinimum,
        Math.max(topMinimum, usableHeight - gap - bottomMinimum),
      );
      const bottomHeight = usableHeight - topHeight - gap;
      place("lesson", 0, 0, leftWidth, topHeight, 1);
      place("history-timeline", leftWidth + gap, 0, rightWidth, topHeight, 2);
      place("history-evidence", 0, topHeight + gap, leftWidth, bottomHeight, 3);
      place("private-notes", leftWidth + gap, topHeight + gap, rightWidth, bottomHeight, 4);
      return commit();
    }

    placeRightRail("lesson", ["history-timeline", "history-evidence", "private-notes"], 0.58, 520, 480, {
      "history-timeline": 1.2,
      "history-evidence": 1,
      "private-notes": 1,
    });
    return commit();
  }

  if (presetId === "history-timeline-focus") {
    placeRightRail("history-timeline", ["lesson", "private-notes"], 0.62, 620, 480, {
      lesson: 1,
      "private-notes": 1,
    });
    return commit();
  }

  if (presetId === "history-source-evidence") {
    if (has("private-notes")) {
      const notesHeight = 360;
      const mainHeight = usableHeight - notesHeight - gap;
      const leftWidth = Math.floor((usableWidth - gap) / 2);
      place("lesson", 0, 0, leftWidth, mainHeight, 1);
      place("history-evidence", leftWidth + gap, 0, usableWidth - leftWidth - gap, mainHeight, 2);
      place("private-notes", 0, mainHeight + gap, usableWidth, notesHeight, 3);
    } else {
      const leftWidth = Math.floor((usableWidth - gap) / 2);
      place("lesson", 0, 0, leftWidth, usableHeight, 1);
      place("history-evidence", leftWidth + gap, 0, usableWidth - leftWidth - gap, usableHeight, 2);
    }
    return commit();
  }

  if (presetId === "history-argument-builder") {
    placeRightRail("history-argument", ["history-evidence", "lesson"], 0.58, 620, 420, {
      "history-evidence": 1,
      lesson: 1,
    });
    return commit();
  }

  if (presetId === "history-full-studio") {
    placeTwoByTwo("lesson", "history-timeline", "history-evidence", "history-argument", 0.5, 0.52);
    return commit();
  }

  return null;
}

export function validateWindowFrameLayout({
  frames,
  moduleIds,
  viewport,
}: {
  frames: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
  moduleIds: WorkspaceModuleId[];
  viewport: Viewport;
}) {
  const errors: string[] = [];
  const visibleFrames = moduleIds
    .map((moduleId) => ({ moduleId, frame: frames[moduleId] }))
    .filter((entry): entry is { moduleId: WorkspaceModuleId; frame: WorkspaceWindowFrame } =>
      Boolean(entry.frame),
    );

  visibleFrames.forEach(({ frame, moduleId }) => {
    if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > viewport.width || frame.y + frame.h > viewport.height) {
      errors.push(`Panel ${moduleId} is offscreen for the current viewport.`);
    }
  });

  visibleFrames.forEach((entry, index) => {
    visibleFrames.slice(index + 1).forEach((other) => {
      if (framesOverlap(entry.frame, other.frame)) {
        errors.push(`Panel ${entry.moduleId} overlaps ${other.moduleId}.`);
      }
    });
  });

  const visibleArea = visibleFrames.reduce(
    (total, entry) => total + intersectionArea(entry.frame, viewport),
    0,
  );
  const viewportArea = viewport.width * viewport.height;
  if (visibleArea < viewportArea * 0.34) {
    errors.push("Layout leaves a huge unused visible workspace area.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildHorizontalSnapCandidates(
  frame: WorkspaceWindowFrame,
  peerFrames: WorkspaceWindowFrame[],
  bounds: ViewportBounds,
  snapBehavior: FullCanvasSnapBehavior,
  interaction: "move" | "resize",
) {
  const candidates: SnapCandidate[] = [];
  const left = frame.x;
  const right = frame.x + frame.w;
  const center = frame.x + frame.w / 2;

  candidates.push(
    {
      axis: "x",
      kind: "canvas-edge",
      label: "Canvas left edge",
      position: bounds.minX,
      target: interaction === "resize" ? bounds.minX : bounds.minX,
      current: interaction === "resize" ? right : left,
      start: bounds.minY,
      end: bounds.maxY,
    },
    {
      axis: "x",
      kind: "canvas-edge",
      label: "Canvas right edge",
      position: bounds.maxX,
      target: interaction === "resize" ? bounds.maxX : bounds.maxX - frame.w,
      current: right,
      start: bounds.minY,
      end: bounds.maxY,
    },
  );

  if (snapBehavior !== "modules") {
    return candidates;
  }

  peerFrames.forEach((peer) => {
    const peerLeft = peer.x;
    const peerRight = peer.x + peer.w;
    const peerCenter = peer.x + peer.w / 2;
    const guideStart = Math.min(frame.y, peer.y);
    const guideEnd = Math.max(frame.y + frame.h, peer.y + peer.h);

    if (interaction === "move") {
      candidates.push(
        candidate("x", "module-gap", "Module right gap", peerRight + WORKSPACE_LAYOUT_GAP, peerRight + WORKSPACE_LAYOUT_GAP, left, guideStart, guideEnd),
        candidate("x", "module-gap", "Module left gap", peerLeft - WORKSPACE_LAYOUT_GAP, peerLeft - WORKSPACE_LAYOUT_GAP - frame.w, right, guideStart, guideEnd),
        candidate("x", "module-align", "Align left edges", peerLeft, peerLeft, left, guideStart, guideEnd),
        candidate("x", "module-align", "Align right edges", peerRight, peerRight - frame.w, right, guideStart, guideEnd),
        candidate("x", "module-center", "Align centers", peerCenter, peerCenter - frame.w / 2, center, guideStart, guideEnd),
      );
      return;
    }

    candidates.push(
      candidate("x", "module-gap", "Resize to module gap", peerLeft - WORKSPACE_LAYOUT_GAP, peerLeft - WORKSPACE_LAYOUT_GAP, right, guideStart, guideEnd),
      candidate("x", "module-align", "Align right edges", peerRight, peerRight, right, guideStart, guideEnd),
      candidate("x", "module-center", "Resize to center", peerCenter, peerCenter, right, guideStart, guideEnd),
    );
  });

  return candidates;
}

function buildVerticalSnapCandidates(
  frame: WorkspaceWindowFrame,
  peerFrames: WorkspaceWindowFrame[],
  bounds: ViewportBounds,
  snapBehavior: FullCanvasSnapBehavior,
  interaction: "move" | "resize",
) {
  const candidates: SnapCandidate[] = [];
  const top = frame.y;
  const bottom = frame.y + frame.h;
  const center = frame.y + frame.h / 2;

  candidates.push(
    {
      axis: "y",
      kind: "canvas-edge",
      label: "Canvas top edge",
      position: bounds.minY,
      target: interaction === "resize" ? bounds.minY : bounds.minY,
      current: interaction === "resize" ? bottom : top,
      start: bounds.minX,
      end: bounds.maxX,
    },
    {
      axis: "y",
      kind: "canvas-edge",
      label: "Canvas bottom edge",
      position: bounds.maxY,
      target: interaction === "resize" ? bounds.maxY : bounds.maxY - frame.h,
      current: bottom,
      start: bounds.minX,
      end: bounds.maxX,
    },
  );

  if (snapBehavior !== "modules") {
    return candidates;
  }

  peerFrames.forEach((peer) => {
    const peerTop = peer.y;
    const peerBottom = peer.y + peer.h;
    const peerCenter = peer.y + peer.h / 2;
    const guideStart = Math.min(frame.x, peer.x);
    const guideEnd = Math.max(frame.x + frame.w, peer.x + peer.w);

    if (interaction === "move") {
      candidates.push(
        candidate("y", "module-gap", "Module bottom gap", peerBottom + WORKSPACE_LAYOUT_GAP, peerBottom + WORKSPACE_LAYOUT_GAP, top, guideStart, guideEnd),
        candidate("y", "module-gap", "Module top gap", peerTop - WORKSPACE_LAYOUT_GAP, peerTop - WORKSPACE_LAYOUT_GAP - frame.h, bottom, guideStart, guideEnd),
        candidate("y", "module-align", "Align top edges", peerTop, peerTop, top, guideStart, guideEnd),
        candidate("y", "module-align", "Align bottom edges", peerBottom, peerBottom - frame.h, bottom, guideStart, guideEnd),
        candidate("y", "module-center", "Align centers", peerCenter, peerCenter - frame.h / 2, center, guideStart, guideEnd),
      );
      return;
    }

    candidates.push(
      candidate("y", "module-gap", "Resize to module gap", peerTop - WORKSPACE_LAYOUT_GAP, peerTop - WORKSPACE_LAYOUT_GAP, bottom, guideStart, guideEnd),
      candidate("y", "module-align", "Align bottom edges", peerBottom, peerBottom, bottom, guideStart, guideEnd),
      candidate("y", "module-center", "Resize to center", peerCenter, peerCenter, bottom, guideStart, guideEnd),
    );
  });

  return candidates;
}

function candidate(
  axis: "x" | "y",
  kind: WorkspaceSnapGuide["kind"],
  label: string,
  position: number,
  target: number,
  current: number,
  start: number,
  end: number,
): SnapCandidate {
  return { axis, kind, label, position, target, current, start, end };
}

function findBestCandidate(candidates: SnapCandidate[], threshold: number) {
  return candidates.reduce<SnapCandidate | null>((best, next) => {
    const delta = Math.abs(next.current - next.position);
    if (delta > threshold) {
      return best;
    }

    if (!best || delta < Math.abs(best.current - best.position)) {
      return next;
    }

    return best;
  }, null);
}

function resolveViewportBounds(
  viewport: Viewport,
  safeEdgePadding: boolean,
  bounds?: ViewportBounds,
): ViewportBounds {
  const padding = safeEdgePadding ? WORKSPACE_SAFE_EDGE_PADDING : 0;
  if (bounds) {
    return {
      minX: bounds.minX + padding,
      maxX: Math.max(bounds.minX + padding, bounds.maxX - padding),
      minY: bounds.minY + padding,
      maxY: Math.max(bounds.minY + padding, bounds.maxY - padding),
    };
  }

  return {
    minX: padding,
    maxX: Math.max(padding, viewport.width - padding),
    minY: padding,
    maxY: Math.max(padding, viewport.height - padding),
  };
}

function clampMovedFrame(frame: WorkspaceWindowFrame, bounds: ViewportBounds) {
  return {
    ...frame,
    x: clamp(Math.round(frame.x), bounds.minX, Math.max(bounds.minX, bounds.maxX - frame.w)),
    y: clamp(Math.round(frame.y), bounds.minY, Math.max(bounds.minY, bounds.maxY - frame.h)),
  };
}

function clampResizedFrame(
  frame: WorkspaceWindowFrame,
  bounds: ViewportBounds,
  minimums: { width: number; height: number },
) {
  const width = clamp(Math.round(frame.w), minimums.width, Math.max(minimums.width, bounds.maxX - bounds.minX));
  const height = clamp(Math.round(frame.h), minimums.height, Math.max(minimums.height, bounds.maxY - bounds.minY));

  return {
    ...frame,
    x: clamp(Math.round(frame.x), bounds.minX, Math.max(bounds.minX, bounds.maxX - width)),
    y: clamp(Math.round(frame.y), bounds.minY, Math.max(bounds.minY, bounds.maxY - height)),
    w: width,
    h: height,
  };
}

function resolvePrimaryModule(
  presetId: WorkspacePresetId,
  moduleIds: WorkspaceModuleId[],
): WorkspaceModuleId | null {
  const priorities: Partial<Record<WorkspacePresetId, WorkspaceModuleId[]>> = {
    "notes-focus": ["private-notes", "binder-notebook", "lesson"],
    "math-study": ["desmos-graph", "lesson", "private-notes"],
    "math-guided-study": ["lesson", "desmos-graph", "private-notes"],
    "math-graph-lab": ["desmos-graph", "formula-sheet", "scientific-calculator"],
    "math-proof-concept": ["lesson", "related-concepts", "private-notes"],
    "math-practice-mode": ["private-notes", "formula-sheet", "desmos-graph"],
    "full-math-canvas": ["desmos-graph", "lesson", "private-notes"],
    "history-guided": ["history-timeline", "lesson", "history-evidence"],
    "history-timeline-focus": ["history-timeline", "history-evidence", "history-argument"],
    "history-source-evidence": ["history-evidence", "lesson", "history-timeline"],
    "history-argument-builder": ["history-argument", "history-evidence", "history-timeline"],
    "history-full-studio": ["history-timeline", "history-argument", "lesson"],
    "focused-reading": ["lesson", "lesson-outline"],
    "annotation-mode": ["lesson", "private-notes"],
  };
  const preferred = priorities[presetId] ?? ["lesson", "private-notes", "desmos-graph"];
  return preferred.find((moduleId) => moduleIds.includes(moduleId)) ?? moduleIds[0] ?? null;
}

function inferPresetForModules(moduleIds: WorkspaceModuleId[]): WorkspacePresetId {
  if (moduleIds.includes("history-argument")) {
    return "history-argument-builder";
  }
  if (moduleIds.includes("history-evidence")) {
    return "history-source-evidence";
  }
  if (moduleIds.includes("history-timeline")) {
    return "history-timeline-focus";
  }
  if (moduleIds.includes("desmos-graph")) {
    return "math-graph-lab";
  }
  if (moduleIds.includes("private-notes")) {
    return "notes-focus";
  }
  return "focused-reading";
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
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function pickFrames(
  frames: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>,
  moduleIds: WorkspaceModuleId[],
) {
  return Object.fromEntries(
    moduleIds.flatMap((moduleId) => {
      const frame = frames[moduleId];
      return frame ? [[moduleId, frame]] : [];
    }),
  ) as Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
}

function sameFrames(
  left: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>,
  right: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>,
) {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const id of ids) {
    const leftFrame = left[id as WorkspaceModuleId];
    const rightFrame = right[id as WorkspaceModuleId];
    if (!leftFrame || !rightFrame) {
      return false;
    }
    if (
      leftFrame.x !== rightFrame.x ||
      leftFrame.y !== rightFrame.y ||
      leftFrame.w !== rightFrame.w ||
      leftFrame.h !== rightFrame.h ||
      leftFrame.z !== rightFrame.z
    ) {
      return false;
    }
  }

  return true;
}

function makeFrame(x: number, y: number, w: number, h: number, z: number): WorkspaceWindowFrame {
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
    z,
  };
}

function framesOverlap(left: WorkspaceWindowFrame, right: WorkspaceWindowFrame) {
  return !(
    left.x + left.w <= right.x ||
    right.x + right.w <= left.x ||
    left.y + left.h <= right.y ||
    right.y + right.h <= left.y
  );
}

function intersectionArea(frame: WorkspaceWindowFrame, viewport: Viewport) {
  const width = Math.max(0, Math.min(frame.x + frame.w, viewport.width) - Math.max(frame.x, 0));
  const height = Math.max(0, Math.min(frame.y + frame.h, viewport.height) - Math.max(frame.y, 0));
  return width * height;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
