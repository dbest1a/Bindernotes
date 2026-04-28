import type { WorkspaceModuleId } from "@/types";
import { isAlwaysLiveWhiteboardModule } from "@/lib/whiteboards/whiteboard-module-registry";
import type {
  WhiteboardModuleAnchorMode,
  WhiteboardModuleElement,
} from "@/lib/whiteboards/whiteboard-types";

export type WhiteboardViewportTransform = {
  scrollX: number;
  scrollY: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  offsetLeft?: number;
  offsetTop?: number;
};

export type WhiteboardFrame = Pick<WhiteboardModuleElement, "x" | "y" | "width" | "height">;

export type WhiteboardPoint = {
  x: number;
  y: number;
};

export type EmbeddedModulePresentation = "live" | "preview" | "chip";

export type WhiteboardScreenRect = WhiteboardFrame;

export const defaultWhiteboardViewportTransform: WhiteboardViewportTransform = {
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
  viewportWidth: 1440,
  viewportHeight: 900,
};

export const WHITEBOARD_FLOATING_TOOL_SAFE_TOP_INSET = 104;
export const WHITEBOARD_FLOATING_TOOL_VIEWPORT_PADDING = 8;

const compactChipZoom = 0.35;
const previewZoom = 0.55;

const moduleMinimumSizes: Partial<Record<WorkspaceModuleId, { width: number; height: number }>> = {
  lesson: { width: 360, height: 260 },
  "private-notes": { width: 360, height: 260 },
  "desmos-graph": { width: 420, height: 320 },
  "scientific-calculator": { width: 320, height: 320 },
  "formula-sheet": { width: 300, height: 220 },
  "saved-graphs": { width: 300, height: 220 },
  "math-blocks": { width: 360, height: 240 },
  "related-concepts": { width: 300, height: 220 },
};

const liveScreenMinimumSizes: Partial<Record<WorkspaceModuleId, { width: number; height: number }>> = {
  "desmos-graph": { width: 420, height: 320 },
  "scientific-calculator": { width: 320, height: 320 },
};

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampValue(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function getWindowWhiteboardViewportSize() {
  if (typeof window === "undefined") {
    return {
      width: defaultWhiteboardViewportTransform.viewportWidth,
      height: defaultWhiteboardViewportTransform.viewportHeight,
    };
  }

  return {
    width: Math.max(1, window.innerWidth || defaultWhiteboardViewportTransform.viewportWidth),
    height: Math.max(1, window.innerHeight || defaultWhiteboardViewportTransform.viewportHeight),
  };
}

export function getZoomValue(rawZoom: unknown) {
  if (typeof rawZoom === "number" && Number.isFinite(rawZoom) && rawZoom > 0) {
    return rawZoom;
  }

  if (rawZoom && typeof rawZoom === "object" && "value" in rawZoom) {
    const value = (rawZoom as { value?: unknown }).value;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 1;
}

export const normalizeExcalidrawZoom = getZoomValue;

export function extractWhiteboardViewportTransform(
  appState: unknown,
  viewportSize: { width: number; height: number; offsetLeft?: number; offsetTop?: number } = getWindowWhiteboardViewportSize(),
): WhiteboardViewportTransform {
  const state = appState && typeof appState === "object" ? (appState as Record<string, unknown>) : {};

  return {
    scrollX: finiteNumber(state.scrollX, 0),
    scrollY: finiteNumber(state.scrollY, 0),
    zoom: getZoomValue(state.zoom),
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    offsetLeft: viewportSize.offsetLeft ?? finiteNumber(state.offsetLeft, 0),
    offsetTop: viewportSize.offsetTop ?? finiteNumber(state.offsetTop, 0),
  };
}

export function whiteboardViewportTransformsEqual(
  left: WhiteboardViewportTransform,
  right: WhiteboardViewportTransform,
) {
  return (
    left.scrollX === right.scrollX &&
    left.scrollY === right.scrollY &&
    left.zoom === right.zoom &&
    left.viewportWidth === right.viewportWidth &&
    left.viewportHeight === right.viewportHeight &&
    (left.offsetLeft ?? 0) === (right.offsetLeft ?? 0) &&
    (left.offsetTop ?? 0) === (right.offsetTop ?? 0)
  );
}

export function boardToScreenPoint(point: WhiteboardPoint, transform: WhiteboardViewportTransform) {
  return {
    x: (point.x + transform.scrollX) * transform.zoom + (transform.offsetLeft ?? 0),
    y: (point.y + transform.scrollY) * transform.zoom + (transform.offsetTop ?? 0),
  };
}

export function boardToScreenRect(
  frame: WhiteboardFrame,
  transform: WhiteboardViewportTransform,
): WhiteboardScreenRect {
  const point = boardToScreenPoint(frame, transform);

  return {
    x: point.x,
    y: point.y,
    width: frame.width * transform.zoom,
    height: frame.height * transform.zoom,
  };
}

export const boardToScreenFrame = boardToScreenRect;

export function getWhiteboardModuleAnchorMode(
  moduleElement: Pick<WhiteboardModuleElement, "anchorMode" | "pinned">,
): WhiteboardModuleAnchorMode {
  if (
    moduleElement.anchorMode === "board" ||
    moduleElement.anchorMode === "board-fixed-size" ||
    moduleElement.anchorMode === "viewport"
  ) {
    return moduleElement.anchorMode;
  }

  return moduleElement.pinned === false ? "viewport" : "board";
}

export function isWhiteboardModuleBoardPositioned(
  moduleElement: Pick<WhiteboardModuleElement, "anchorMode" | "pinned">,
) {
  const anchorMode = getWhiteboardModuleAnchorMode(moduleElement);
  return anchorMode === "board" || anchorMode === "board-fixed-size";
}

export function isWhiteboardModuleZoomScaled(
  moduleElement: Pick<WhiteboardModuleElement, "anchorMode" | "pinned">,
) {
  return getWhiteboardModuleAnchorMode(moduleElement) === "board";
}

export function getWhiteboardModuleScreenRect(
  moduleElement: WhiteboardModuleElement,
  transform: WhiteboardViewportTransform,
): WhiteboardScreenRect {
  const visualHeight = moduleElement.mode === "collapsed" ? 72 : moduleElement.height;
  const anchorMode = getWhiteboardModuleAnchorMode(moduleElement);

  if (anchorMode === "viewport") {
    return {
      x: moduleElement.x,
      y: moduleElement.y,
      width: moduleElement.width,
      height: visualHeight,
    };
  }

  const point = boardToScreenPoint(moduleElement, transform);
  if (anchorMode === "board-fixed-size") {
    return {
      x: point.x,
      y: point.y,
      width: moduleElement.width,
      height: visualHeight,
    };
  }

  return {
    x: point.x,
    y: point.y,
    width: moduleElement.width * transform.zoom,
    height: visualHeight * transform.zoom,
  };
}

export function convertWhiteboardCardAnchor(
  moduleElement: WhiteboardModuleElement,
  nextAnchorMode: WhiteboardModuleAnchorMode,
  transform: WhiteboardViewportTransform,
  updatedAt = new Date().toISOString(),
): WhiteboardModuleElement {
  const currentScreenRect = getWhiteboardModuleScreenRect(moduleElement, transform);
  const rawNextSize =
    nextAnchorMode === "board"
      ? screenDeltaToBoardDelta(
          {
            x: currentScreenRect.width,
            y: currentScreenRect.height,
          },
          transform,
        )
      : {
          x: currentScreenRect.width,
          y: currentScreenRect.height,
        };
  const minimumSize =
    nextAnchorMode === "board"
      ? getWhiteboardModuleMinimumSize(moduleElement.moduleId, moduleElement.mode)
      : { width: 1, height: 1 };
  const nextSize = {
    x: Math.max(minimumSize.width, rawNextSize.x),
    y: Math.max(minimumSize.height, rawNextSize.y),
  };
  const nextPoint =
    nextAnchorMode === "viewport"
      ? {
          x: currentScreenRect.x,
          y: currentScreenRect.y,
        }
      : nextAnchorMode === "board"
        ? (() => {
            const center = screenToBoardPoint(
              {
                x: currentScreenRect.x + currentScreenRect.width / 2,
                y: currentScreenRect.y + currentScreenRect.height / 2,
              },
              transform,
            );

            return {
              x: center.x - nextSize.x / 2,
              y: center.y - nextSize.y / 2,
            };
          })()
        : screenToBoardPoint(
            {
              x: currentScreenRect.x,
              y: currentScreenRect.y,
            },
            transform,
          );
  return {
    ...moduleElement,
    anchorMode: nextAnchorMode,
    pinned: nextAnchorMode !== "viewport",
    x: nextPoint.x,
    y: nextPoint.y,
    width: Math.max(1, nextSize.x),
    height: Math.max(1, nextSize.y),
    updatedAt,
  };
}

export function screenToBoardPoint(point: WhiteboardPoint, transform: WhiteboardViewportTransform) {
  return {
    x: (point.x - (transform.offsetLeft ?? 0)) / transform.zoom - transform.scrollX,
    y: (point.y - (transform.offsetTop ?? 0)) / transform.zoom - transform.scrollY,
  };
}

export function screenDeltaToBoardDelta(delta: WhiteboardPoint, transform: WhiteboardViewportTransform) {
  return {
    x: delta.x / transform.zoom,
    y: delta.y / transform.zoom,
  };
}

export function getViewportCenterBoardPoint(transform: WhiteboardViewportTransform) {
  return screenToBoardPoint(
    {
      x: (transform.offsetLeft ?? 0) + transform.viewportWidth / 2,
      y: (transform.offsetTop ?? 0) + transform.viewportHeight / 2,
    },
    transform,
  );
}

export const viewportCenterToBoardPoint = getViewportCenterBoardPoint;

export function isBoardObjectVisibleInViewport(
  frame: WhiteboardFrame,
  transform: WhiteboardViewportTransform,
  buffer = 160,
) {
  const screenFrame = boardToScreenRect(frame, transform);
  return (
    screenFrame.x + screenFrame.width >= -buffer &&
    screenFrame.y + screenFrame.height >= -buffer &&
    screenFrame.x <= transform.viewportWidth + buffer &&
    screenFrame.y <= transform.viewportHeight + buffer
  );
}

export function isWhiteboardModuleVisibleInViewport(
  moduleElement: WhiteboardModuleElement,
  transform: WhiteboardViewportTransform,
  buffer = 160,
) {
  const screenFrame = getWhiteboardModuleScreenRect(moduleElement, transform);
  return (
    screenFrame.x + screenFrame.width >= -buffer &&
    screenFrame.y + screenFrame.height >= -buffer &&
    screenFrame.x <= transform.viewportWidth + buffer &&
    screenFrame.y <= transform.viewportHeight + buffer
  );
}

export function getWhiteboardModuleMinimumSize(moduleId: WorkspaceModuleId, mode: WhiteboardModuleElement["mode"]) {
  if (mode === "collapsed") {
    return { width: 180, height: 72 };
  }

  return moduleMinimumSizes[moduleId] ?? { width: 260, height: 180 };
}

export function clampWhiteboardViewportToolFrame(
  frame: WhiteboardFrame,
  transform: Pick<WhiteboardViewportTransform, "viewportWidth" | "viewportHeight">,
  {
    padding = WHITEBOARD_FLOATING_TOOL_VIEWPORT_PADDING,
    safeTopInset = WHITEBOARD_FLOATING_TOOL_SAFE_TOP_INSET,
  }: { padding?: number; safeTopInset?: number } = {},
): WhiteboardFrame {
  const maxWidth = Math.max(1, transform.viewportWidth - padding * 2);
  const maxHeight = Math.max(1, transform.viewportHeight - safeTopInset - padding);
  const width = Math.min(Math.max(1, frame.width), maxWidth);
  const height = Math.min(Math.max(1, frame.height), maxHeight);

  return {
    x: clampValue(frame.x, padding, transform.viewportWidth - width - padding),
    y: clampValue(frame.y, safeTopInset, transform.viewportHeight - height - padding),
    width,
    height,
  };
}

export function getWhiteboardViewportToolResetFrame(
  moduleElement: WhiteboardModuleElement,
  transform: Pick<WhiteboardViewportTransform, "viewportWidth" | "viewportHeight">,
): WhiteboardFrame {
  const minSize = getWhiteboardModuleMinimumSize(moduleElement.moduleId, moduleElement.mode);
  const preferredFrame = {
    x: WHITEBOARD_FLOATING_TOOL_VIEWPORT_PADDING,
    y: WHITEBOARD_FLOATING_TOOL_SAFE_TOP_INSET,
    width: Math.max(moduleElement.width, minSize.width),
    height: Math.max(moduleElement.height, minSize.height),
  };

  return clampWhiteboardViewportToolFrame(preferredFrame, transform);
}

export function getEmbeddedModulePresentation(
  moduleElement: WhiteboardModuleElement,
  transform: WhiteboardViewportTransform,
  visible: boolean,
): EmbeddedModulePresentation {
  if (moduleElement.mode === "collapsed") {
    return "chip";
  }

  if (isAlwaysLiveWhiteboardModule(moduleElement.moduleId)) {
    return "live";
  }

  const anchorMode = getWhiteboardModuleAnchorMode(moduleElement);
  if (anchorMode === "board" && transform.zoom < compactChipZoom) {
    return "chip";
  }

  const liveMinimum = liveScreenMinimumSizes[moduleElement.moduleId];
  const screenFrame = liveMinimum ? getWhiteboardModuleScreenRect(moduleElement, transform) : null;
  const tooSmallForLive =
    Boolean(liveMinimum && screenFrame) &&
    (screenFrame!.width < liveMinimum!.width || screenFrame!.height < liveMinimum!.height);

  if (!visible || (anchorMode === "board" && transform.zoom < previewZoom) || moduleElement.mode !== "live" || tooSmallForLive) {
    return "preview";
  }

  return "live";
}
