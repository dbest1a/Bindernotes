import type { WorkspaceWindowFrame } from "@/types";

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasRectLike = {
  left?: number;
  top?: number;
  width: number;
  height?: number;
};

export type MovementMode = "move" | "corner" | "right" | "bottom";

export function getEffectiveCanvasScale(
  canvasRect: Pick<CanvasRectLike, "width">,
  expectedCanvasWidth: number,
) {
  if (
    !Number.isFinite(canvasRect.width) ||
    !Number.isFinite(expectedCanvasWidth) ||
    canvasRect.width <= 0 ||
    expectedCanvasWidth <= 0
  ) {
    return 1;
  }

  const scale = canvasRect.width / expectedCanvasWidth;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function viewportToCanvasPoint({
  clientX,
  clientY,
  canvasRect,
  scrollLeft = 0,
  scrollTop = 0,
  scale = 1,
}: {
  clientX: number;
  clientY: number;
  canvasRect: CanvasRectLike;
  scrollLeft?: number;
  scrollTop?: number;
  scale?: number;
}): CanvasPoint {
  const effectiveScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const left = canvasRect.left ?? 0;
  const top = canvasRect.top ?? 0;
  return {
    x: (clientX - left) / effectiveScale + scrollLeft,
    y: (clientY - top) / effectiveScale + scrollTop,
  };
}

export function getFrameFromPointerDelta({
  currentPointer,
  minimumSize,
  mode,
  scale = 1,
  startFrame,
  startPointer,
}: {
  currentPointer: CanvasPoint;
  minimumSize: { width: number; height: number };
  mode: MovementMode;
  scale?: number;
  startFrame: WorkspaceWindowFrame;
  startPointer: CanvasPoint;
}): WorkspaceWindowFrame {
  const effectiveScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const dx = (currentPointer.x - startPointer.x) / effectiveScale;
  const dy = (currentPointer.y - startPointer.y) / effectiveScale;

  if (mode === "move") {
    return {
      ...startFrame,
      x: startFrame.x + dx,
      y: startFrame.y + dy,
    };
  }

  return {
    ...startFrame,
    w: Math.max(minimumSize.width, startFrame.w + dx),
    h: Math.max(minimumSize.height, startFrame.h + dy),
  };
}

export function applySafeEdgePaddingToFrame(
  frame: WorkspaceWindowFrame,
  {
    canvasHeight,
    canvasWidth,
    enabled,
    padding,
  }: {
    canvasHeight: number;
    canvasWidth: number;
    enabled: boolean;
    padding: number;
  },
): WorkspaceWindowFrame {
  const inset = enabled ? Math.max(0, padding) : 0;
  const maxX = Math.max(inset, canvasWidth - inset - frame.w);
  const maxY = Math.max(inset, canvasHeight - inset - frame.h);
  return {
    ...frame,
    x: clamp(frame.x, inset, maxX),
    y: clamp(frame.y, inset, maxY),
  };
}

export function getScrollAdjustedPointerPosition({
  clientX,
  clientY,
  scrollLeft,
  scrollTop,
  startClientX,
  startClientY,
  startScrollLeft,
  startScrollTop,
}: {
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
}): CanvasPoint {
  return {
    x: clientX + scrollLeft - startScrollLeft - startClientX,
    y: clientY + scrollTop - startScrollTop - startClientY,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
