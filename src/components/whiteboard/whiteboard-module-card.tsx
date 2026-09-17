import { BookOpenText, Grip, Minus, MoreHorizontal, PanelTopOpen, Pin, PinOff, RotateCcw, Sigma, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  getWhiteboardModuleDefinition,
  isAlwaysLiveWhiteboardModule,
  isHeavyWhiteboardModule,
  isViewportFloatingWhiteboardModule,
} from "@/lib/whiteboards/whiteboard-module-registry";
import {
  convertWhiteboardCardAnchor,
  defaultWhiteboardViewportTransform,
  getWhiteboardModuleAnchorMode,
  getWhiteboardModuleMinimumSize,
  getWhiteboardViewportToolResetFrame,
  getWhiteboardModuleScreenRect,
  isWhiteboardModuleBoardPositioned,
  isWhiteboardModuleZoomScaled,
  screenDeltaToBoardDelta,
  screenToBoardPoint,
  type EmbeddedModulePresentation,
  type WhiteboardScreenRect,
  type WhiteboardViewportTransform,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import type {
  WhiteboardModuleAnchorMode,
  WhiteboardModuleElement,
} from "@/lib/whiteboards/whiteboard-types";
import {
  recordWhiteboardPerformanceDiagnostic,
  setWorkspaceMovementActive,
} from "@/lib/whiteboard-performance-diagnostics";
import { cn } from "@/lib/utils";

type WhiteboardModuleCardProps = {
  moduleElement: WhiteboardModuleElement;
  live: boolean;
  children: ReactNode;
  onChange: (moduleElement: WhiteboardModuleElement) => void;
  onBringToFront: () => void;
  onRemove: (moduleId: string) => void;
  onEditSource?: () => void;
  onOpenFormulaSheet?: () => void;
  onResetSource?: () => void;
  presentation?: EmbeddedModulePresentation;
  viewportTransform?: WhiteboardViewportTransform;
  getViewportTransform?: () => WhiteboardViewportTransform;
  renderLayer?: "board" | "viewport";
};

type PointerStart = {
  pointerId: number;
  startX: number;
  startY: number;
  frame: WhiteboardModuleElement;
  action: "drag" | "resize";
  viewportTransform: WhiteboardViewportTransform;
};

type StylePatch = Partial<Record<"left" | "top" | "width" | "height" | "transform", string>>;
type PointerCaptureTarget = Element & {
  hasPointerCapture?: (pointerId: number) => boolean;
  releasePointerCapture?: (pointerId: number) => void;
  setPointerCapture?: (pointerId: number) => void;
};

const WHITEBOARD_MODULE_BASE_LAYER_MAX = 70;
const WHITEBOARD_MODULE_FOREGROUND_LAYER_BASE = 80;
const WHITEBOARD_MODULE_FOREGROUND_LAYER_MAX = 98;

function getModuleScreenFrame(
  moduleElement: WhiteboardModuleElement,
  viewportTransform: WhiteboardViewportTransform,
): WhiteboardScreenRect {
  return getWhiteboardModuleScreenRect(moduleElement, viewportTransform);
}

function getBoardObjectTransform(screenFrame: WhiteboardScreenRect, viewportTransform: WhiteboardViewportTransform) {
  return `translate3d(${screenFrame.x}px, ${screenFrame.y}px, 0) scale(${viewportTransform.zoom})`;
}

function getBoardRenderPoint(moduleElement: WhiteboardModuleElement, viewportTransform: WhiteboardViewportTransform) {
  return {
    x: (moduleElement.x + viewportTransform.scrollX) * viewportTransform.zoom + (viewportTransform.offsetLeft ?? 0),
    y: (moduleElement.y + viewportTransform.scrollY) * viewportTransform.zoom + (viewportTransform.offsetTop ?? 0),
  };
}

function getModuleCardStyle(
  moduleElement: WhiteboardModuleElement,
  screenFrame: WhiteboardScreenRect,
  viewportTransform: WhiteboardViewportTransform,
): CSSProperties {
  const visualHeight = moduleElement.mode === "collapsed" ? 72 : moduleElement.height;

  if (isWhiteboardModuleZoomScaled(moduleElement)) {
    const renderPoint = getBoardRenderPoint(moduleElement, viewportTransform);
    return {
      left: 0,
      top: 0,
      width: moduleElement.width,
      height: visualHeight,
      boxSizing: "border-box",
      transform: getBoardObjectTransform(
        {
          ...screenFrame,
          x: renderPoint.x,
          y: renderPoint.y,
        },
        viewportTransform,
      ),
      transformOrigin: "top left",
      zIndex: moduleElement.zIndex,
    };
  }

  return {
    left: screenFrame.x,
    top: screenFrame.y,
    width: screenFrame.width,
    height: screenFrame.height,
    boxSizing: "border-box",
    transform: "none",
    transformOrigin: "top left",
    zIndex: moduleElement.zIndex,
  };
}

function getFiniteVisualZIndex(zIndex: number) {
  return Number.isFinite(zIndex) ? Math.max(0, Math.floor(zIndex)) : 0;
}

function getModuleCardVisualZIndex(zIndex: number, foreground: boolean) {
  const safeZIndex = getFiniteVisualZIndex(zIndex);
  if (foreground) {
    return Math.min(
      WHITEBOARD_MODULE_FOREGROUND_LAYER_BASE + safeZIndex,
      WHITEBOARD_MODULE_FOREGROUND_LAYER_MAX,
    );
  }

  return Math.min(safeZIndex, WHITEBOARD_MODULE_BASE_LAYER_MAX);
}

function isWhiteboardCardControlTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "label",
        "[role='button']",
        "[role='menuitem']",
        "[role='menuitemradio']",
        "[contenteditable='true']",
        "[data-whiteboard-card-control='true']",
      ].join(","),
    ),
  );
}

function applyStylePatch(root: HTMLElement, patch: StylePatch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      root.style.setProperty(key, value);
    }
  }
}

function syncCommittedFrameDataset(
  root: HTMLElement,
  moduleElement: WhiteboardModuleElement,
  viewportTransform: WhiteboardViewportTransform,
) {
  const screenFrame = getModuleScreenFrame(moduleElement, viewportTransform);
  const zoomScaled = isWhiteboardModuleZoomScaled(moduleElement);
  const boardPositioned = isWhiteboardModuleBoardPositioned(moduleElement);
  const renderPoint = zoomScaled ? getBoardRenderPoint(moduleElement, viewportTransform) : screenFrame;

  root.dataset.cardSceneX = boardPositioned ? String(moduleElement.x) : "";
  root.dataset.cardSceneY = boardPositioned ? String(moduleElement.y) : "";
  root.dataset.cardSceneWidth = boardPositioned ? String(moduleElement.width) : "";
  root.dataset.cardSceneHeight = boardPositioned ? String(moduleElement.height) : "";
  root.dataset.cardViewportX = String(screenFrame.x);
  root.dataset.cardViewportY = String(screenFrame.y);
  root.dataset.cardRenderX = String(renderPoint.x);
  root.dataset.cardRenderY = String(renderPoint.y);
  root.dataset.cardRenderZoom = String(zoomScaled ? viewportTransform.zoom : 1);
}

function getPointerStylePatch(active: PointerStart, dx: number, dy: number): StylePatch {
  if (active.action === "drag") {
    const baseFrame = getModuleScreenFrame(active.frame, active.viewportTransform);
    if (isWhiteboardModuleZoomScaled(active.frame)) {
      return {
        transform: getBoardObjectTransform(
          {
            ...baseFrame,
            x: baseFrame.x + dx,
            y: baseFrame.y + dy,
          },
          active.viewportTransform,
        ),
      };
    }

    return {
      left: `${baseFrame.x + dx}px`,
      top: `${baseFrame.y + dy}px`,
    };
  }

  const zoomScaled = isWhiteboardModuleZoomScaled(active.frame);
  const sizeDelta = zoomScaled
    ? screenDeltaToBoardDelta({ x: dx, y: dy }, active.viewportTransform)
    : { x: dx, y: dy };
  const minSize = getWhiteboardModuleMinimumSize(active.frame.moduleId, active.frame.mode);
  return {
    width: `${Math.max(minSize.width, active.frame.width + sizeDelta.x)}px`,
    height: `${Math.max(minSize.height, active.frame.height + sizeDelta.y)}px`,
  };
}

function getCommittedStylePatch(
  moduleElement: WhiteboardModuleElement,
  viewportTransform: WhiteboardViewportTransform,
): StylePatch {
  const screenFrame = getModuleScreenFrame(moduleElement, viewportTransform);
  const visualHeight = moduleElement.mode === "collapsed" ? 72 : moduleElement.height;

  if (isWhiteboardModuleZoomScaled(moduleElement)) {
    const renderPoint = getBoardRenderPoint(moduleElement, viewportTransform);
    return {
      left: "0px",
      top: "0px",
      width: `${moduleElement.width}px`,
      height: `${visualHeight}px`,
      transform: getBoardObjectTransform(
        {
          ...screenFrame,
          x: renderPoint.x,
          y: renderPoint.y,
        },
        viewportTransform,
      ),
    };
  }

  return {
    left: `${screenFrame.x}px`,
    top: `${screenFrame.y}px`,
    width: `${screenFrame.width}px`,
    height: `${screenFrame.height}px`,
    transform: "none",
  };
}

function parseFiniteDatasetNumber(value: string | undefined) {
  if (value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function transformsShareRenderedCamera(
  rendered: Partial<WhiteboardViewportTransform>,
  candidate: WhiteboardViewportTransform,
) {
  const epsilon = 0.001;
  return (
    Math.abs((rendered.scrollX ?? candidate.scrollX) - candidate.scrollX) <= epsilon &&
    Math.abs((rendered.scrollY ?? candidate.scrollY) - candidate.scrollY) <= epsilon &&
    Math.abs((rendered.zoom ?? candidate.zoom) - candidate.zoom) <= epsilon &&
    Math.abs((rendered.offsetLeft ?? candidate.offsetLeft ?? 0) - (candidate.offsetLeft ?? 0)) <= epsilon &&
    Math.abs((rendered.offsetTop ?? candidate.offsetTop ?? 0) - (candidate.offsetTop ?? 0)) <= epsilon
  );
}

function getRenderedLayerTransform(root: HTMLElement): Partial<WhiteboardViewportTransform> | null {
  const layer = root.closest<HTMLElement>('[data-whiteboard-window-layer="modules"]');
  if (!layer) {
    return null;
  }

  return {
    scrollX: parseFiniteDatasetNumber(layer.dataset.whiteboardViewportScrollX) ?? undefined,
    scrollY: parseFiniteDatasetNumber(layer.dataset.whiteboardViewportScrollY) ?? undefined,
    zoom: parseFiniteDatasetNumber(layer.dataset.whiteboardViewportZoom) ?? undefined,
    offsetLeft: parseFiniteDatasetNumber(layer.dataset.whiteboardViewportOffsetLeft) ?? undefined,
    offsetTop: parseFiniteDatasetNumber(layer.dataset.whiteboardViewportOffsetTop) ?? undefined,
  };
}

function getDropCommitViewportTransform({
  activeTransform,
  latestTransform,
  root,
}: {
  activeTransform: WhiteboardViewportTransform;
  latestTransform: WhiteboardViewportTransform;
  root: HTMLElement;
}) {
  const renderedTransform = getRenderedLayerTransform(root);
  if (renderedTransform && transformsShareRenderedCamera(renderedTransform, latestTransform)) {
    return latestTransform;
  }

  return activeTransform;
}

const anchorLabels: Record<WhiteboardModuleAnchorMode, string> = {
  board: "Pin to board",
  "board-fixed-size": "Pin to board, keep size",
  viewport: "Pin to screen",
};

const anchorDescriptions: Record<WhiteboardModuleAnchorMode, string> = {
  board: "Behaves like a normal whiteboard object.",
  "board-fixed-size": "Moves with your work but stays readable.",
  viewport: "Stays visible while you move around the board.",
};

export function WhiteboardModuleCard({
  moduleElement,
  live,
  children,
  onChange,
  onBringToFront,
  onEditSource,
  onOpenFormulaSheet,
  onRemove,
  onResetSource,
  presentation = "live",
  viewportTransform = defaultWhiteboardViewportTransform,
  getViewportTransform,
  renderLayer = "board",
}: WhiteboardModuleCardProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerStart | null>(null);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const activePointerTargetRef = useRef<PointerCaptureTarget | null>(null);
  const movementSignalActiveRef = useRef(false);
  const latestModuleElementRef = useRef(moduleElement);
  const styleRafRef = useRef<number | null>(null);
  const pendingStyleRef = useRef<StylePatch>({});
  const [anchorMenuOpen, setAnchorMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const definition = getWhiteboardModuleDefinition(moduleElement.moduleId);
  const heavy = isHeavyWhiteboardModule(moduleElement.moduleId);
  const stabilizedHeavyCard = moduleElement.moduleId === "desmos-graph";
  const alwaysLive = isAlwaysLiveWhiteboardModule(moduleElement.moduleId);
  const anchorMode = getWhiteboardModuleAnchorMode(moduleElement);
  const floatingTool = anchorMode === "viewport" && isViewportFloatingWhiteboardModule(moduleElement.moduleId);
  const pinned = anchorMode !== "viewport";
  const boardPositioned = isWhiteboardModuleBoardPositioned(moduleElement);
  const zoomScaled = isWhiteboardModuleZoomScaled(moduleElement);
  const screenFrame = getModuleScreenFrame(moduleElement, viewportTransform);
  const boardRenderPoint = zoomScaled ? getBoardRenderPoint(moduleElement, viewportTransform) : screenFrame;
  const renderScale = zoomScaled ? viewportTransform.zoom : 1;
  const latestViewportTransform = () => getViewportTransform?.() ?? viewportTransform;
  const foreground = selected || anchorMenuOpen || optionsMenuOpen;
  const cardStyle = {
    ...getModuleCardStyle(moduleElement, screenFrame, viewportTransform),
    zIndex: getModuleCardVisualZIndex(moduleElement.zIndex, foreground),
  };
  latestModuleElementRef.current = moduleElement;

  const cleanupPointerListeners = () => {
    pointerCleanupRef.current?.();
    pointerCleanupRef.current = null;
  };

  const clearMovementSignal = () => {
    if (!movementSignalActiveRef.current) {
      return;
    }

    movementSignalActiveRef.current = false;
    rootRef.current?.removeAttribute("data-dragging");
    rootRef.current?.removeAttribute("data-drag-mode");
    setWorkspaceMovementActive(false);
    recordWhiteboardPerformanceDiagnostic("whiteboard-drag-commit", {
      action: "whiteboard-card",
      moduleId: latestModuleElementRef.current.moduleId,
    });
  };

  useEffect(
    () => () => {
      cleanupPointerListeners();
      pointerRef.current = null;
      activePointerTargetRef.current = null;
      clearMovementSignal();
      if (styleRafRef.current) {
        window.cancelAnimationFrame(styleRafRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selected && !anchorMenuOpen && !optionsMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root?.contains(event.target as Node)) {
        return;
      }
      setSelected(false);
      setAnchorMenuOpen(false);
      setOptionsMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [anchorMenuOpen, optionsMenuOpen, selected]);

  const scheduleStylePatch = (patch: StylePatch) => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    pendingStyleRef.current = {
      ...pendingStyleRef.current,
      ...patch,
    };

    if (styleRafRef.current) {
      return;
    }

    styleRafRef.current = window.requestAnimationFrame(() => {
      styleRafRef.current = null;
      const nextPatch = pendingStyleRef.current;
      pendingStyleRef.current = {};
      applyStylePatch(root, nextPatch);
    });
  };

  const beginPointerAction = (event: React.PointerEvent, action: PointerStart["action"]) => {
    event.preventDefault();
    event.stopPropagation();
    cleanupPointerListeners();
    const captureTarget = event.currentTarget as PointerCaptureTarget;
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      frame: moduleElement,
      action,
      viewportTransform: latestViewportTransform(),
    };
    activePointerTargetRef.current = captureTarget;
    movementSignalActiveRef.current = true;
    rootRef.current?.setAttribute("data-dragging", "true");
    rootRef.current?.setAttribute("data-drag-mode", action);
    setWorkspaceMovementActive(true);
    recordWhiteboardPerformanceDiagnostic("whiteboard-drag-start", {
      action,
      moduleId: moduleElement.moduleId,
      pinned,
    });
    try {
      captureTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Window-level listeners below keep the drag stable even if native pointer capture is unavailable.
    }

    const handleWindowPointerMove = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== event.pointerId) {
        return;
      }
      nativeEvent.preventDefault();
      updatePointerActionFromPoint(nativeEvent.pointerId, nativeEvent.clientX, nativeEvent.clientY);
    };
    const handleWindowPointerEnd = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== event.pointerId) {
        return;
      }
      nativeEvent.preventDefault();
      finishPointerActionFromPoint(nativeEvent.pointerId, nativeEvent.clientX, nativeEvent.clientY);
    };

    window.addEventListener("pointermove", handleWindowPointerMove, { passive: false });
    window.addEventListener("pointerup", handleWindowPointerEnd, { passive: false });
    window.addEventListener("pointercancel", handleWindowPointerEnd, { passive: false });
    pointerCleanupRef.current = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };
  };

  const selectAnchorMode = (nextAnchorMode: WhiteboardModuleAnchorMode) => {
    setSelected(true);
    setAnchorMenuOpen(false);
    setOptionsMenuOpen(false);
    if (nextAnchorMode === anchorMode) {
      return;
    }
    onChange(convertWhiteboardCardAnchor(moduleElement, nextAnchorMode, latestViewportTransform()));
  };

  const updateModuleSettings = (patch: Partial<WhiteboardModuleElement>) => {
    setSelected(true);
    setOptionsMenuOpen(false);
    onChange({
      ...moduleElement,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const resetFloatingToolPosition = () => {
    const transform = latestViewportTransform();
    const frame = getWhiteboardViewportToolResetFrame(moduleElement, transform);
    setSelected(true);
    if (anchorMode !== "viewport") {
      const boardPoint = screenToBoardPoint({ x: frame.x, y: frame.y }, transform);
      onChange({
        ...moduleElement,
        anchorMode: "board-fixed-size",
        pinned: true,
        x: boardPoint.x,
        y: boardPoint.y,
        width: frame.width,
        height: frame.height,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    onChange({
      ...moduleElement,
      anchorMode: "viewport",
      pinned: false,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      updatedAt: new Date().toISOString(),
    });
  };

  const updatePointerActionFromPoint = (pointerId: number, clientX: number, clientY: number) => {
    const active = pointerRef.current;
    const root = rootRef.current;
    if (!active || active.pointerId !== pointerId || !root) {
      return;
    }

    const dx = clientX - active.startX;
    const dy = clientY - active.startY;
    scheduleStylePatch(getPointerStylePatch(active, dx, dy));
  };

  const updatePointerAction = (event: React.PointerEvent) => {
    updatePointerActionFromPoint(event.pointerId, event.clientX, event.clientY);
  };

  const finishPointerActionFromPoint = (pointerId: number, clientX: number, clientY: number) => {
    const active = pointerRef.current;
    const root = rootRef.current;
    if (!active || active.pointerId !== pointerId || !root) {
      return;
    }

    const dx = clientX - active.startX;
    const dy = clientY - active.startY;
    const commitViewportTransform = getDropCommitViewportTransform({
      activeTransform: active.viewportTransform,
      latestTransform: latestViewportTransform(),
      root,
    });
    const finalScreenFrame = getModuleScreenFrame(active.frame, active.viewportTransform);
    const finalScreenPoint = {
      x: finalScreenFrame.x + dx,
      y: finalScreenFrame.y + dy,
    };
    const positionDelta = isWhiteboardModuleBoardPositioned(active.frame)
      ? screenDeltaToBoardDelta({ x: dx, y: dy }, active.viewportTransform)
      : { x: dx, y: dy };
    const sizeDelta = isWhiteboardModuleZoomScaled(active.frame)
      ? screenDeltaToBoardDelta({ x: dx, y: dy }, active.viewportTransform)
      : { x: dx, y: dy };
    const nextAnchorMode = getWhiteboardModuleAnchorMode(active.frame);
    const latestModuleElement =
      latestModuleElementRef.current.id === active.frame.id ? latestModuleElementRef.current : active.frame;
    const nextModuleElement =
      active.action === "drag"
        ? {
            ...latestModuleElement,
            anchorMode: nextAnchorMode,
            pinned: nextAnchorMode !== "viewport",
            ...(isWhiteboardModuleBoardPositioned(active.frame)
              ? screenToBoardPoint(finalScreenPoint, commitViewportTransform)
              : {
                  x: active.frame.x + positionDelta.x,
                  y: active.frame.y + positionDelta.y,
                }),
            updatedAt: new Date().toISOString(),
          }
        : (() => {
            const minSize = getWhiteboardModuleMinimumSize(active.frame.moduleId, active.frame.mode);
            return {
              ...latestModuleElement,
              anchorMode: nextAnchorMode,
              pinned: nextAnchorMode !== "viewport",
              width: Math.max(minSize.width, active.frame.width + sizeDelta.x),
              height: Math.max(minSize.height, active.frame.height + sizeDelta.y),
              updatedAt: new Date().toISOString(),
            };
          })();

    pointerRef.current = null;
    cleanupPointerListeners();
    const captureTarget = activePointerTargetRef.current;
    activePointerTargetRef.current = null;
    try {
      if (captureTarget?.releasePointerCapture && (!captureTarget.hasPointerCapture || captureTarget.hasPointerCapture(pointerId))) {
        captureTarget.releasePointerCapture(pointerId);
      }
    } catch {
      // Browsers can throw if the element lost capture during a rerender; the final frame is still committed below.
    }
    if (styleRafRef.current) {
      window.cancelAnimationFrame(styleRafRef.current);
      styleRafRef.current = null;
    }
    pendingStyleRef.current = {};
    applyStylePatch(root, getCommittedStylePatch(nextModuleElement, commitViewportTransform));
    syncCommittedFrameDataset(root, nextModuleElement, commitViewportTransform);
    onChange(nextModuleElement);
    clearMovementSignal();
  };

  const finishPointerAction = (event: React.PointerEvent) => {
    finishPointerActionFromPoint(event.pointerId, event.clientX, event.clientY);
  };

  const renderAnchorMenu = () => (
    <div
      className="whiteboard-card-anchor-menu grid max-h-72 w-full gap-1 overflow-auto bg-popover p-1.5 text-xs text-popover-foreground"
      data-testid="whiteboard-card-anchor-menu"
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
    >
      {(["board", "board-fixed-size", "viewport"] as WhiteboardModuleAnchorMode[]).map((mode) => (
        <button
          aria-pressed={anchorMode === mode}
          className={cn(
            "flex w-full flex-col rounded-md px-2.5 py-2 text-left text-xs transition hover:bg-secondary",
            anchorMode === mode && "bg-accent/75 text-accent-foreground",
          )}
          data-testid={
            mode === "board"
              ? "whiteboard-card-anchor-board"
              : mode === "board-fixed-size"
                ? "whiteboard-card-anchor-board-fixed"
                : "whiteboard-card-anchor-viewport"
          }
          key={mode}
          onClick={(event) => {
            event.stopPropagation();
            selectAnchorMode(mode);
          }}
          role="menuitemradio"
          type="button"
        >
          <span className="font-semibold">{anchorLabels[mode]}</span>
          <span className="mt-0.5 leading-4 text-muted-foreground">{anchorDescriptions[mode]}</span>
        </button>
      ))}
    </div>
  );

  const renderOptionsMenu = () => (
    <div
      className="whiteboard-card-options-menu grid max-h-80 w-full gap-1 overflow-auto bg-popover p-1.5 text-xs text-popover-foreground"
      data-testid="whiteboard-card-options-menu"
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
    >
      {moduleElement.moduleId === "lesson" ? (
        <>
          <button
            className="whiteboard-card-menu-item"
            onClick={() => {
              setOptionsMenuOpen(false);
              onEditSource?.();
            }}
            type="button"
          >
            <BookOpenText className="size-3.5" />
            Edit source
          </button>
          <button
            className="whiteboard-card-menu-item"
            onClick={() => {
              setOptionsMenuOpen(false);
              onResetSource?.();
            }}
            type="button"
          >
            Reset source
          </button>
          <div className="my-1 h-px bg-border" />
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Source display
          </p>
          <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ sourceDisplayMode: "compact" })} type="button">
            Compact reading
          </button>
          <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ sourceDisplayMode: "summary" })} type="button">
            Summary first
          </button>
          <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ sourceDisplayMode: "full" })} type="button">
            Full lesson
          </button>
          <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ sourceDisplayMode: "header-hidden" })} type="button">
            Hide lesson header
          </button>
          <button
            className="whiteboard-card-menu-item"
            onClick={() => {
              setOptionsMenuOpen(false);
              onOpenFormulaSheet?.();
            }}
            type="button"
          >
            <Sigma className="size-3.5" />
            Formula sheet
          </button>
        </>
      ) : null}
      <div className="my-1 h-px bg-border" />
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Card density
      </p>
      <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ cardDensity: "compact" })} type="button">
        Compact density
      </button>
      <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ cardDensity: "comfortable" })} type="button">
        Comfortable density
      </button>
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Text size
      </p>
      <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ textSize: "small" })} type="button">
        Small text
      </button>
      <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ textSize: "normal" })} type="button">
        Normal text
      </button>
      <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ textSize: "large" })} type="button">
        Large text
      </button>
      <div className="my-1 h-px bg-border" />
      <button className="whiteboard-card-menu-item" onClick={() => updateModuleSettings({ mode: moduleElement.mode === "collapsed" ? "preview" : "collapsed" })} type="button">
        Collapse card
      </button>
      <button className="whiteboard-card-menu-item text-destructive" onClick={() => onRemove(moduleElement.id)} type="button">
        Remove card
      </button>
    </div>
  );

  const activeCardMenu = anchorMenuOpen ? renderAnchorMenu() : optionsMenuOpen ? renderOptionsMenu() : null;

  return (
    <div
      className={cn(
        "whiteboard-module-card pointer-events-auto absolute flex flex-col overflow-visible rounded-lg border border-border bg-card text-card-foreground shadow-[0_16px_38px_rgba(15,23,42,0.18)] ring-0 transition-[box-shadow,border-color]",
        "hover:border-primary hover:shadow-[0_18px_46px_rgba(15,23,42,0.24)]",
        zoomScaled && "shadow-[0_8px_18px_rgba(15,23,42,0.14)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.18)]",
        selected && "border-primary/70 shadow-[0_22px_56px_rgba(15,23,42,0.28)] ring-2 ring-primary/45",
        moduleElement.mode === "collapsed" && "h-auto",
      )}
      data-card-anchor={anchorMode}
      data-card-mode={moduleElement.mode}
      data-card-density={moduleElement.cardDensity ?? "compact"}
      data-card-selected={String(selected)}
      data-card-text-size={moduleElement.textSize ?? "normal"}
      data-card-scene-x={boardPositioned ? moduleElement.x : ""}
      data-card-scene-y={boardPositioned ? moduleElement.y : ""}
      data-card-scene-width={boardPositioned ? moduleElement.width : ""}
      data-card-scene-height={boardPositioned ? moduleElement.height : ""}
      data-card-viewport-x={screenFrame.x}
      data-card-viewport-y={screenFrame.y}
      data-card-render-x={boardRenderPoint.x}
      data-card-render-y={boardRenderPoint.y}
      data-card-render-zoom={renderScale}
      data-card-render-layer={renderLayer}
      data-whiteboard-card="true"
      data-whiteboard-board-object="true"
      data-whiteboard-floating-tool={floatingTool ? moduleElement.moduleId : undefined}
      data-whiteboard-module-layer="window"
      data-whiteboard-module-anchor={anchorMode}
      data-whiteboard-module={moduleElement.moduleId}
      data-whiteboard-module-pinned={String(pinned)}
      data-whiteboard-module-presentation={presentation}
      data-window-module-id={moduleElement.moduleId}
      data-testid={`whiteboard-module-card-${moduleElement.id}`}
      onDoubleClick={() => {
        if (moduleElement.mode === "live") {
          return;
        }
        onChange({
          ...moduleElement,
          mode: "live",
          updatedAt: new Date().toISOString(),
        });
      }}
      onPointerDownCapture={(event) => {
        const cardControlTarget = isWhiteboardCardControlTarget(event.target);
        if (
          stabilizedHeavyCard &&
          !cardControlTarget &&
          event.target instanceof Element &&
          event.target.closest(".whiteboard-module-card__chrome,.whiteboard-module-card__resize-handle,.whiteboard-module-card__content")
        ) {
          return;
        }
        setSelected(true);
        if (cardControlTarget) {
          return;
        }
        onBringToFront();
      }}
      ref={rootRef}
      style={cardStyle}
    >
      <div
        className="whiteboard-module-card__chrome z-30 flex cursor-grab items-center justify-between gap-2 border-b border-border bg-popover px-2.5 py-2 text-sm text-popover-foreground active:cursor-grabbing"
        onPointerCancel={finishPointerAction}
        onPointerDown={(event) => beginPointerAction(event, "drag")}
        onPointerMove={updatePointerAction}
        onPointerUp={finishPointerAction}
        style={{ touchAction: "none" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Grip className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-semibold">{moduleElement.title ?? definition?.label ?? moduleElement.moduleId}</span>
          {presentation === "chip" ? (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              chip
            </span>
          ) : null}
          {heavy && moduleElement.mode !== "live" && !alwaysLive ? (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              preview
            </span>
          ) : null}
          {!pinned ? (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              screen
            </span>
          ) : anchorMode === "board-fixed-size" ? (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              board size
            </span>
          ) : (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              board
            </span>
          )}
        </div>
        <div className={cn("relative flex items-center gap-1", presentation === "chip" && "hidden")}>
          <Button
            aria-expanded={anchorMenuOpen}
            aria-label={`Card pin mode: ${anchorLabels[anchorMode]}. Change pin mode.`}
            data-whiteboard-card-control="true"
            data-testid="whiteboard-card-pin-button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setSelected(true);
              setOptionsMenuOpen(false);
              setAnchorMenuOpen((current) => !current);
            }}
            size="icon"
            title={anchorLabels[anchorMode]}
            type="button"
            variant="ghost"
          >
            {pinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}
          </Button>
          <Button
            data-whiteboard-card-control="true"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (alwaysLive) {
                onChange({
                  ...moduleElement,
                  mode: "live",
                  updatedAt: new Date().toISOString(),
                });
                return;
              }
              onChange({
                ...moduleElement,
                mode: moduleElement.mode === "live" ? "preview" : "live",
                updatedAt: new Date().toISOString(),
              });
            }}
            size="icon"
            title={live ? "Show preview" : "Open live module"}
            type="button"
            variant="ghost"
          >
            <PanelTopOpen className="size-4" />
          </Button>
          {floatingTool ? (
            <Button
              aria-label="Reset graph position"
              data-whiteboard-card-control="true"
              data-testid="whiteboard-card-reset-position"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                resetFloatingToolPosition();
              }}
              size="icon"
              title="Reset position"
              type="button"
              variant="ghost"
            >
              <RotateCcw className="size-4" />
            </Button>
          ) : null}
          <Button
            data-whiteboard-card-control="true"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onChange({
                ...moduleElement,
                mode: moduleElement.mode === "collapsed" ? "preview" : "collapsed",
                updatedAt: new Date().toISOString(),
              });
            }}
            size="icon"
            title="Collapse module"
            type="button"
            variant="ghost"
          >
            <Minus className="size-4" />
          </Button>
          <Button
            aria-label="Board card options"
            data-whiteboard-card-control="true"
            data-testid="whiteboard-card-options-button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setSelected(true);
              setAnchorMenuOpen(false);
              setOptionsMenuOpen((current) => !current);
            }}
            size="icon"
            title="Board card options"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal className="size-4" />
          </Button>
          <Button
            aria-label="Remove module"
            data-whiteboard-card-control="true"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(moduleElement.id);
            }}
            size="icon"
            title="Remove module"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {activeCardMenu ? (
        <div
          className="whiteboard-card-menu-dock z-20 shrink-0 border-b border-border bg-popover text-popover-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.8),0_12px_28px_rgb(15_23_42/0.12)]"
          data-testid="whiteboard-card-menu-dock"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {activeCardMenu}
        </div>
      ) : null}
      {moduleElement.mode === "collapsed" || presentation === "chip" ? null : (
        <div className="whiteboard-module-card__content z-10 flex-1 min-h-0 overflow-hidden bg-card p-0">
          {children}
        </div>
      )}
      {moduleElement.mode !== "collapsed" && presentation !== "chip" ? (
        <div
          className="whiteboard-module-card__resize-handle absolute bottom-0 right-0 z-50 size-6 cursor-se-resize rounded-tl-lg border-l border-t border-primary/45 bg-primary opacity-95 shadow-[0_0_0_2px_hsl(var(--card)),0_10px_24px_rgb(15_23_42/0.24)] transition hover:opacity-100"
          data-testid="whiteboard-card-resize-handle"
          onPointerCancel={finishPointerAction}
          onPointerDown={(event) => beginPointerAction(event, "resize")}
          onPointerMove={updatePointerAction}
          onPointerUp={finishPointerAction}
          style={{ touchAction: "none" }}
          title="Resize module"
        />
      ) : null}
    </div>
  );
}
