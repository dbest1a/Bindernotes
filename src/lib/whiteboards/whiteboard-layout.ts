import {
  getDefaultWhiteboardModuleAnchorMode,
  getWhiteboardModuleDefinition,
  type WhiteboardModuleDefinition,
} from "@/lib/whiteboards/whiteboard-module-registry";
import {
  getViewportCenterBoardPoint,
  getWhiteboardModuleScreenRect,
  type WhiteboardViewportTransform,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import type { WhiteboardModuleAnchorMode, WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

type ViewportSize = {
  width: number;
  height: number;
};

type Frame = Pick<WhiteboardModuleElement, "x" | "y" | "width" | "height">;

const labMargin = 96;
const labTopClearance = 128;
const moduleGap = 28;
const rowGap = 36;
const fallbackModuleWidth = 360;
const fallbackModuleHeight = 260;

function getViewportSize(): ViewportSize {
  if (typeof window === "undefined") {
    return { width: 1440, height: 900 };
  }

  return {
    width: Math.max(1024, window.innerWidth || 1440),
    height: Math.max(720, window.innerHeight || 900),
  };
}

function intersectionArea(left: Frame, right: Frame) {
  const xOverlap = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const yOverlap = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return xOverlap * yOverlap;
}

function isMeaningfullyOverlapping(candidate: Frame, existing: Frame) {
  const area = intersectionArea(candidate, existing);
  if (area <= 0) {
    return false;
  }

  const smallerArea = Math.min(candidate.width * candidate.height, existing.width * existing.height);
  return area / smallerArea > 0.14;
}

function isStacked(candidate: Frame, existing: Frame) {
  return Math.abs(candidate.x - existing.x) < 84 && Math.abs(candidate.y - existing.y) < 84;
}

function collides(candidate: Frame, existing: Frame[]) {
  return existing.some((frame) => isMeaningfullyOverlapping(candidate, frame) || isStacked(candidate, frame));
}

function candidateSlots(definition: WhiteboardModuleDefinition, viewport: ViewportSize) {
  const usableWidth = Math.max(720, viewport.width - labMargin * 2);
  const columnStep = Math.max(640, Math.min(760, definition.defaultWidth + moduleGap));
  const columns = Math.max(1, Math.floor((usableWidth + moduleGap) / columnStep));
  const rows = 12;
  const slots: Array<{ x: number; y: number }> = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      slots.push({
        x: labMargin + column * columnStep,
        y: labTopClearance + row * (Math.max(420, Math.min(600, definition.defaultHeight)) + rowGap),
      });
    }
  }

  return slots;
}

export function findOpenWhiteboardModuleFrame(
  existingModules: WhiteboardModuleElement[],
  definition: WhiteboardModuleDefinition,
  viewport: ViewportSize = getViewportSize(),
) {
  const existing = existingModules.map((moduleElement) => ({
    x: moduleElement.x,
    y: moduleElement.y,
    width: moduleElement.width,
    height: moduleElement.mode === "collapsed" ? 64 : moduleElement.height,
  }));
  const width = definition.defaultWidth;
  const height = definition.defaultHeight;

  for (const slot of candidateSlots(definition, viewport)) {
    const candidate = { ...slot, width, height };
    if (!collides(candidate, existing)) {
      return candidate;
    }
  }

  const last = existingModules.reduce(
    (bottom, moduleElement) => Math.max(bottom, moduleElement.y + moduleElement.height),
    labTopClearance,
  );

  return {
    x: labMargin,
    y: last + rowGap,
    width,
    height,
  };
}

const placementGap = 24;

/**
 * Where a new card goes on the board: centered on the current view, unless that spot would
 * cover a card already there. Then it tries spots right beside each existing card and in
 * widening rings around the center, and takes the free spot that shows the most of the new
 * card, nearest first. Collisions are judged on screen, so board-pinned, fixed-size and
 * floating cards are all compared by what the student actually sees.
 */
export function findOpenWhiteboardModuleFrameNearViewport(
  existingModules: WhiteboardModuleElement[],
  definition: WhiteboardModuleDefinition,
  transform: WhiteboardViewportTransform,
) {
  const center = getViewportCenterBoardPoint(transform);
  const width = definition.defaultWidth;
  const height = definition.defaultHeight;
  const centered = { x: center.x - width / 2, y: center.y - height / 2, width, height };
  if (!existingModules.length) {
    return centered;
  }

  const probe: WhiteboardModuleElement = {
    id: "placement-probe",
    type: "bindernotes-module",
    moduleId: definition.moduleId,
    anchorMode: definition.defaultAnchorMode ?? getDefaultWhiteboardModuleAnchorMode(definition.moduleId),
    mode: "live",
    zIndex: 0,
    createdAt: "",
    updatedAt: "",
    ...centered,
  };
  const obstacles = existingModules.map((moduleElement) => getWhiteboardModuleScreenRect(moduleElement, transform));
  const start = getWhiteboardModuleScreenRect(probe, transform);
  if (!collides(start, obstacles)) {
    return centered;
  }

  const zoom = transform.zoom > 0 ? transform.zoom : 1;
  const view = { x: transform.offsetLeft ?? 0, y: transform.offsetTop ?? 0, width: transform.viewportWidth, height: transform.viewportHeight };
  const positions: Array<{ x: number; y: number }> = [];
  for (const obstacle of obstacles) {
    positions.push(
      { x: obstacle.x - placementGap - start.width, y: start.y },
      { x: obstacle.x + obstacle.width + placementGap, y: start.y },
      { x: start.x, y: obstacle.y - placementGap - start.height },
      { x: start.x, y: obstacle.y + obstacle.height + placementGap },
    );
  }
  const stepX = start.width + placementGap;
  const stepY = start.height + placementGap;
  for (let ring = 1; ring <= 3; ring += 1) {
    for (let column = -ring; column <= ring; column += 1) {
      for (let row = -ring; row <= ring; row += 1) {
        if (Math.max(Math.abs(column), Math.abs(row)) === ring) positions.push({ x: start.x + column * stepX, y: start.y + row * stepY });
      }
    }
  }
  const candidates = positions.map((position) => {
    const frame = { ...position, width: start.width, height: start.height };
    return {
      ...frame,
      // Visible share in 5% steps, so "about as visible" ties go to the nearer spot.
      shown: Math.round((intersectionArea(frame, view) / (frame.width * frame.height)) * 20),
      distance: Math.hypot(position.x - start.x, position.y - start.y),
    };
  });
  candidates.sort((first, second) => second.shown - first.shown || first.distance - second.distance);
  // A spot that hides most of the new card is no better than stacking it, so it must show
  // at least half; otherwise (a packed board) cascade in view instead of stacking exactly on top.
  const free = candidates.find((candidate) => candidate.shown >= 10 && !collides(candidate, obstacles));
  const screenOffset = free ? { x: free.x - start.x, y: free.y - start.y } : { x: 40, y: 40 };

  return {
    ...centered,
    x: centered.x + screenOffset.x / zoom,
    y: centered.y + screenOffset.y / zoom,
  };
}

export function findOpenWhiteboardViewportModuleFrame(
  _existingModules: WhiteboardModuleElement[],
  definition: WhiteboardModuleDefinition,
  transform: WhiteboardViewportTransform,
) {
  const width = definition.defaultWidth;
  const height = definition.defaultHeight;

  return {
    x: Math.max(24, transform.viewportWidth / 2 - width / 2),
    y: Math.max(24, transform.viewportHeight / 2 - height / 2),
    width,
    height,
  };
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeModuleMode(
  value: WhiteboardModuleElement["mode"] | string | undefined,
  fallback: WhiteboardModuleElement["mode"],
): WhiteboardModuleElement["mode"] {
  if (value === "live" || value === "preview" || value === "collapsed") {
    return value;
  }

  return fallback;
}

function normalizeAnchorMode(
  moduleElement: WhiteboardModuleElement,
  definition: WhiteboardModuleDefinition | null,
): WhiteboardModuleAnchorMode {
  if (
    moduleElement.anchorMode === "board" ||
    moduleElement.anchorMode === "board-fixed-size" ||
    moduleElement.anchorMode === "viewport"
  ) {
    return moduleElement.anchorMode;
  }

  if (moduleElement.pinned === true) {
    return "board";
  }

  if (moduleElement.pinned === false) {
    return "viewport";
  }

  return definition?.defaultAnchorMode ?? getDefaultWhiteboardModuleAnchorMode(moduleElement.moduleId);
}

export function normalizeWhiteboardLabModules(
  modules: WhiteboardModuleElement[],
  _viewport: ViewportSize = getViewportSize(),
) {
  return modules.map((moduleElement, index) => {
    const definition = getWhiteboardModuleDefinition(moduleElement.moduleId);
    const fallbackMode: WhiteboardModuleElement["mode"] = definition?.heavy ? "preview" : "live";
    const anchorMode = normalizeAnchorMode(moduleElement, definition);

    return {
      ...moduleElement,
      id:
        typeof moduleElement.id === "string" && moduleElement.id.trim().length > 0
          ? moduleElement.id
          : `module-${moduleElement.moduleId}-${index + 1}`,
      x: finiteNumber(moduleElement.x, 0),
      y: finiteNumber(moduleElement.y, 0),
      width: positiveNumber(moduleElement.width, definition?.defaultWidth ?? fallbackModuleWidth),
      height: positiveNumber(moduleElement.height, definition?.defaultHeight ?? fallbackModuleHeight),
      zIndex: finiteNumber(moduleElement.zIndex, index + 1),
      mode: normalizeModuleMode(moduleElement.mode, fallbackMode),
      anchorMode,
      pinned: anchorMode !== "viewport",
      title: moduleElement.title,
    };
  });
}
