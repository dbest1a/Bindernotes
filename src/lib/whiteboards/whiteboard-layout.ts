import {
  getDefaultWhiteboardModuleAnchorMode,
  getWhiteboardModuleDefinition,
  type WhiteboardModuleDefinition,
} from "@/lib/whiteboards/whiteboard-module-registry";
import {
  getViewportCenterBoardPoint,
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

export function findOpenWhiteboardModuleFrameNearViewport(
  _existingModules: WhiteboardModuleElement[],
  definition: WhiteboardModuleDefinition,
  transform: WhiteboardViewportTransform,
) {
  const center = getViewportCenterBoardPoint(transform);
  const width = definition.defaultWidth;
  const height = definition.defaultHeight;

  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
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
