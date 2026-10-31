import {
  getDefaultWhiteboardModuleAnchorMode,
  getWhiteboardModuleDefinition,
  type WhiteboardModuleDefinition,
} from "@/lib/whiteboards/whiteboard-module-registry";
import {
  getViewportCenterBoardPoint,
  getWhiteboardModuleAnchorMode,
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

// A card's rectangle on the card layer, in screen pixels relative to the board viewport.
function layerRect(moduleElement: WhiteboardModuleElement, transform: WhiteboardViewportTransform): Frame {
  const rect = getWhiteboardModuleScreenRect(moduleElement, transform);
  if (getWhiteboardModuleAnchorMode(moduleElement) === "viewport") return rect;
  return { ...rect, x: rect.x - (transform.offsetLeft ?? 0), y: rect.y - (transform.offsetTop ?? 0) };
}

/**
 * The nearest spot for a new card of `start`'s size that does not cover an existing card:
 * `start` itself when free, otherwise spots right beside each existing card and in widening
 * rings around `start` (each also pulled inside the view). Spots clear of every card rank
 * first, then by how much of the card the view shows (5% steps), then nearest. `minShown` is
 * the visible share required (0-20 in 5% steps). Null when none fits.
 */
function findFreeLayerFrame(start: Frame, obstacles: Frame[], view: Frame, minShown: number): Frame | null {
  if (!collides(start, obstacles)) return start;
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
  // Each spot is also tried pulled inside the view, so a card can sit flush against the edge.
  const edge = 8;
  for (const position of [...positions]) {
    const x = Math.min(Math.max(position.x, view.x + edge), view.x + view.width - start.width - edge);
    const y = Math.min(Math.max(position.y, view.y + edge), view.y + view.height - start.height - edge);
    if (x !== position.x || y !== position.y) positions.push({ x, y });
  }
  const candidates = positions.map((position) => {
    const frame = { ...position, width: start.width, height: start.height };
    return {
      frame,
      touches: obstacles.some((obstacle) => intersectionArea(frame, obstacle) > 0),
      shown: Math.round((intersectionArea(frame, view) / (frame.width * frame.height)) * 20),
      distance: Math.hypot(position.x - start.x, position.y - start.y),
    };
  });
  // Clear of every card first, then the most visible, then the nearest.
  candidates.sort((first, second) => Number(first.touches) - Number(second.touches) || second.shown - first.shown || first.distance - second.distance);
  return candidates.find((candidate) => candidate.shown >= minShown && !collides(candidate.frame, obstacles))?.frame ?? null;
}

/**
 * Where a new board-pinned card goes: centered on the current view, unless that would cover a
 * card already there; then the nearest free spot that still shows at least half of it. Overlap
 * is judged on screen, so pinned, fixed-size and floating cards compare by what the student
 * sees. A packed board cascades the card into view instead of stacking it exactly on top.
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
  const start = layerRect(probe, transform);
  const view = { x: 0, y: 0, width: transform.viewportWidth, height: transform.viewportHeight };
  const free = findFreeLayerFrame(start, existingModules.map((moduleElement) => layerRect(moduleElement, transform)), view, 10);
  if (free === start) {
    return centered;
  }

  const zoom = transform.zoom > 0 ? transform.zoom : 1;
  const screenOffset = free ? { x: free.x - start.x, y: free.y - start.y } : { x: 40, y: 40 };
  return {
    ...centered,
    x: centered.x + screenOffset.x / zoom,
    y: centered.y + screenOffset.y / zoom,
  };
}

/**
 * Where a new screen-pinned card goes: centered in the view unless that would cover another
 * card; then the nearest free spot fully on screen (a screen card cannot be panned into view).
 */
export function findOpenWhiteboardViewportModuleFrame(
  existingModules: WhiteboardModuleElement[],
  definition: WhiteboardModuleDefinition,
  transform: WhiteboardViewportTransform,
) {
  const width = definition.defaultWidth;
  const height = definition.defaultHeight;
  const start = {
    x: Math.max(24, transform.viewportWidth / 2 - width / 2),
    y: Math.max(24, transform.viewportHeight / 2 - height / 2),
    width,
    height,
  };
  if (!existingModules.length) {
    return start;
  }

  const view = { x: 0, y: 0, width: transform.viewportWidth, height: transform.viewportHeight };
  const free = findFreeLayerFrame(start, existingModules.map((moduleElement) => layerRect(moduleElement, transform)), view, 20);
  return free ? { ...start, x: free.x, y: free.y } : { ...start, x: start.x + 40, y: start.y + 40 };
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
