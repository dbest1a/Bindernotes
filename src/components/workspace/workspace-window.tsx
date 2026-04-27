import { useEffect, useRef, useState, type ReactNode } from "react";
import { Grip, Minus, MoveDiagonal2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WORKSPACE_CANVAS_BOTTOM_PADDING,
  WORKSPACE_CANVAS_EXPAND_STEP,
  WORKSPACE_CANVAS_EXPAND_THRESHOLD,
  getWorkspaceModuleMinimumSize,
  snapWindowFrame,
  type WorkspaceSnapGuide,
} from "@/lib/workspace-layout-engine";
import { cn } from "@/lib/utils";
import type { FullCanvasSnapBehavior, WorkspaceModuleId, WorkspaceWindowFrame } from "@/types";

type WorkspaceWindowProps = {
  boundsHeight: number;
  boundsWidth: number;
  children: ReactNode;
  canvasHeight: number;
  canvasWidth: number;
  frame: WorkspaceWindowFrame;
  locked: boolean;
  moduleId: WorkspaceModuleId;
  peerFrames: WorkspaceWindowFrame[];
  safeEdgePadding: boolean;
  snapBehavior: FullCanvasSnapBehavior;
  snapEnabled: boolean;
  workspaceStyle: "guided" | "flexible" | "full-studio";
  onCanvasHeightRequest?: (frame: WorkspaceWindowFrame) => void;
  onCommit: (moduleId: WorkspaceModuleId, frame: WorkspaceWindowFrame) => void;
  onSnapGuidesChange?: (moduleId: WorkspaceModuleId, guides: WorkspaceSnapGuide[]) => void;
  onToggleCollapsed: (moduleId: WorkspaceModuleId, collapsed: boolean) => void;
  topZ: number;
};

type ResizeMode = "move" | "corner" | "right" | "bottom";
type SnapPreview = {
  frame: WorkspaceWindowFrame;
  guides: WorkspaceSnapGuide[];
  label: string;
};

const SNAP_UI_UPDATE_INTERVAL_MS = 48;
type WorkspacePointerStartEvent = {
  clientX: number;
  clientY: number;
  currentTarget: HTMLElement;
  pointerId: number;
  target: EventTarget | null;
  preventDefault: () => void;
};

export function WorkspaceWindow({
  boundsHeight,
  boundsWidth,
  children,
  canvasHeight,
  canvasWidth,
  frame,
  locked,
  moduleId,
  onCanvasHeightRequest,
  onSnapGuidesChange,
  onToggleCollapsed,
  peerFrames,
  safeEdgePadding,
  snapBehavior,
  snapEnabled,
  workspaceStyle,
  onCommit,
  topZ,
}: WorkspaceWindowProps) {
  const [activeMode, setActiveMode] = useState<ResizeMode | null>(null);
  const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(frame);
  const rafRef = useRef<number | null>(null);
  const snapPreviewRef = useRef<SnapPreview | null>(null);
  const lastSnapUiUpdateAtRef = useRef<number>(Number.NEGATIVE_INFINITY);
  const interactionActiveRef = useRef(false);

  useEffect(() => {
    if (interactionActiveRef.current) {
      return;
    }
    frameRef.current = frame;
    applyFrameToElement(windowRef.current, frame);
  }, [frame]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  const scheduleFrameRender = () => {
    if (rafRef.current !== null) {
      return;
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      applyFrameToElement(windowRef.current, frameRef.current);
    });
  };

  const focusWindow = () => {
    if (locked) {
      return;
    }

    if (frameRef.current.z > topZ) {
      return;
    }

    const next = { ...frameRef.current, z: topZ + 1 };
    frameRef.current = next;
    applyFrameToElement(windowRef.current, next);
    onCommit(moduleId, next);
  };

  const beginPointerAction = (event: WorkspacePointerStartEvent, mode: ResizeMode) => {
    if (locked) {
      focusWindow();
      return;
    }

    event.preventDefault();
    focusWindow();

    const startFrame = frameRef.current;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const source = event.currentTarget;
    const minimum = getWorkspaceModuleMinimumSize(moduleId);
    const minWidth = minimum.width;
    const minHeight = minimum.height;
    const shell = event.currentTarget.closest(".workspace-canvas-shell");
    let interactionCanvasHeight = canvasHeight;
    setActiveMode(mode);
    setSnapPreview(null);
    lastSnapUiUpdateAtRef.current = Number.NEGATIVE_INFINITY;
    interactionActiveRef.current = true;
    source.setPointerCapture?.(pointerId);

    const getViewportBounds = () => {
      const padding = safeEdgePadding ? 8 : 0;
      if (shell instanceof HTMLElement) {
        const minX = shell.scrollLeft + padding;
        const minY = padding;
        return {
          minX,
          maxX: minX + Math.max(minWidth, shell.clientWidth - padding * 2),
          minY,
          maxY: Math.max(minY + minHeight, interactionCanvasHeight - padding),
        };
      }

      const minX = padding;
      const minY = padding;
      return {
        minX,
        maxX: minX + Math.max(minWidth, boundsWidth - padding * 2),
        minY,
        maxY: Math.max(minY + minHeight, interactionCanvasHeight - padding),
      };
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const viewportBounds = getViewportBounds();
      const movedFrame =
        mode === "move"
          ? clampMovedFrame(
              {
                ...startFrame,
                x: startFrame.x + dx,
                y: startFrame.y + dy,
              },
              viewportBounds,
            )
          : clampResizedFrame(
              {
                ...startFrame,
                w: Math.max(minWidth, snapToFrame(startFrame.w + dx, 8)),
                h: Math.max(minHeight, snapToFrame(startFrame.h + dy, 8)),
              },
              viewportBounds,
              { minWidth, minHeight },
            );

      const nextPreview =
        snapEnabled
          ? resolveSnapPreview({
              interaction: mode === "move" ? "move" : "resize",
              movedFrame,
              peerFrames,
              safeEdgePadding,
              snapBehavior,
              viewportBounds,
            })
          : null;
      const next = nextPreview?.frame ?? movedFrame;
      if (next.y + next.h > interactionCanvasHeight - WORKSPACE_CANVAS_EXPAND_THRESHOLD) {
        interactionCanvasHeight = Math.max(
          interactionCanvasHeight + WORKSPACE_CANVAS_EXPAND_STEP,
          next.y + next.h + WORKSPACE_CANVAS_BOTTOM_PADDING,
        );
        onCanvasHeightRequest?.(next);
      }

      frameRef.current = next;
      const previousPreview = snapPreviewRef.current;
      snapPreviewRef.current = nextPreview;
      const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      const previewChanged = !areSnapPreviewsEqual(previousPreview, nextPreview);
      const shouldFlushSnapUi =
        previewChanged &&
        (nextPreview === null ||
          nowMs - lastSnapUiUpdateAtRef.current >= SNAP_UI_UPDATE_INTERVAL_MS);
      if (shouldFlushSnapUi) {
        lastSnapUiUpdateAtRef.current = nowMs;
        onSnapGuidesChange?.(moduleId, nextPreview?.guides ?? []);
        setSnapPreview(nextPreview);
      }
      scheduleFrameRender();
    };

    const onUp = () => {
      source.releasePointerCapture?.(pointerId);
      const resolvedFrame = resolveCommittedFrame({
        frame: snapPreviewRef.current?.frame ?? frameRef.current,
        moduleId,
        safeEdgePadding,
        snapEnabled,
        snapBehavior,
        peerFrames,
        canvasWidth,
        canvasHeight,
        viewportBounds: getViewportBounds(),
      });
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      frameRef.current = resolvedFrame;
      applyFrameToElement(windowRef.current, resolvedFrame);
      setActiveMode(null);
      interactionActiveRef.current = false;
      snapPreviewRef.current = null;
      setSnapPreview(null);
      onSnapGuidesChange?.(moduleId, []);
      onCommit(moduleId, resolvedFrame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = mode === "move" ? "grabbing" : "nwse-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  useEffect(() => {
    const node = windowRef.current;
    if (!node || locked) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const resizeHandle = target.closest("[data-window-resize='corner']");
      const dragHandle = target.closest("[data-window-drag-handle='true']");
      const interactive = target.closest("button, input, textarea, select, a, [role='button']");
      if (interactive && !resizeHandle) {
        return;
      }
      if (resizeHandle) {
        beginPointerAction(
          {
            clientX: event.clientX,
            clientY: event.clientY,
            currentTarget: node,
            pointerId: event.pointerId,
            target: event.target,
            preventDefault: () => event.preventDefault(),
          },
          "corner",
        );
        return;
      }
      if (!dragHandle) {
        return;
      }

      beginPointerAction(
        {
          clientX: event.clientX,
          clientY: event.clientY,
          currentTarget: node,
          pointerId: event.pointerId,
          target: event.target,
          preventDefault: () => event.preventDefault(),
        },
        "move",
      );
    };

    node.addEventListener("pointerdown", onPointerDown, true);
    return () => node.removeEventListener("pointerdown", onPointerDown, true);
  });

  return (
    <div
      className={cn(
        "workspace-window absolute min-h-0 min-w-0 transition-shadow duration-150",
        !locked && "cursor-default",
        !locked && "workspace-window--editable",
        activeMode === "move" && "workspace-window--dragging",
        activeMode === "corner" && "workspace-window--resizing",
      )}
      data-window-module-id={moduleId}
      onMouseDown={!locked ? focusWindow : undefined}
      ref={windowRef}
      style={{
        height: frame.h,
        left: frame.x,
        top: frame.y,
        width: frame.w,
        zIndex: frame.z,
      }}
    >
      {!locked ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-between px-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/92 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-sm backdrop-blur">
            <Grip className="size-3" />
            {activeMode === "move"
              ? snapPreview?.label ?? "Move window"
              : workspaceStyle === "full-studio"
                ? "Drag header"
                : "Move header"}
          </div>
          {workspaceStyle === "full-studio" ? (
            <Button
              className="pointer-events-auto rounded-full bg-background/88 shadow-sm backdrop-blur"
              onClick={() => onToggleCollapsed(moduleId, true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Minus data-icon="inline-start" />
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "workspace-window-frame absolute inset-0 rounded-[var(--workspace-radius,18px)]",
          !locked &&
            "ring-1 ring-primary/10 ring-offset-2 ring-offset-background/60 transition-shadow duration-200",
        )}
      >
        {snapPreview ? (
          <div
            className="pointer-events-none absolute inset-0 rounded-[var(--workspace-radius,18px)] border-2 border-dashed border-primary/65 bg-primary/10"
            data-window-snap-preview="true"
          />
        ) : null}
        <div
          className={cn("h-full", !locked && "cursor-move")}
        >
          {children}
        </div>
      </div>

      {!locked ? (
        <div
          className="absolute bottom-2 right-2 z-30 flex size-9 cursor-nwse-resize items-center justify-center rounded-full border border-border/70 bg-background/94 shadow-sm backdrop-blur"
          data-window-resize="corner"
          title="Resize window"
        >
          <MoveDiagonal2 className="size-3.5 text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}

function snapToFrame(value: number, grid = 16) {
  return Math.round(value / grid) * grid;
}

function areSnapPreviewsEqual(left: SnapPreview | null, right: SnapPreview | null) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.label === right.label &&
    left.frame.x === right.frame.x &&
    left.frame.y === right.frame.y &&
    left.frame.w === right.frame.w &&
    left.frame.h === right.frame.h &&
    left.guides.length === right.guides.length
  );
}

function applyFrameToElement(node: HTMLDivElement | null, frame: WorkspaceWindowFrame) {
  if (!node) {
    return;
  }

  node.style.left = `${frame.x}px`;
  node.style.top = `${frame.y}px`;
  node.style.width = `${frame.w}px`;
  node.style.height = `${frame.h}px`;
  node.style.zIndex = `${frame.z}`;
}

function resolveSnapPreview({
  interaction,
  movedFrame,
  peerFrames,
  safeEdgePadding,
  snapBehavior,
  viewportBounds,
}: {
  interaction: "move" | "resize";
  movedFrame: WorkspaceWindowFrame;
  peerFrames: WorkspaceWindowFrame[];
  safeEdgePadding: boolean;
  snapBehavior: FullCanvasSnapBehavior;
  viewportBounds: { minX: number; maxX: number; minY: number; maxY: number };
}): SnapPreview | null {
  const result = snapWindowFrame({
    frame: movedFrame,
    interaction,
    peerFrames,
    safeEdgePadding,
    snapBehavior,
    viewport: {
      width: viewportBounds.maxX - viewportBounds.minX,
      height: viewportBounds.maxY - viewportBounds.minY,
    },
    viewportBounds,
  });

  if (result.guides.length === 0) {
    return null;
  }

  return {
    frame: result.frame,
    guides: result.guides,
    label: result.guides.some((guide) => guide.kind.startsWith("module"))
      ? "Aligning to module"
      : "Aligning to canvas edge",
  };
}

function clampMovedFrame(
  frame: WorkspaceWindowFrame,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const maxX = Math.max(bounds.minX, bounds.maxX - frame.w);
  const maxY = Math.max(bounds.minY, bounds.maxY - frame.h);

  return {
    ...frame,
    x: clamp(frame.x, bounds.minX, maxX),
    y: clamp(frame.y, bounds.minY, maxY),
  };
}

function clampResizedFrame(
  frame: WorkspaceWindowFrame,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  minimums: { minWidth: number; minHeight: number },
) {
  const width = clamp(frame.w, minimums.minWidth, bounds.maxX - bounds.minX);
  const height = clamp(frame.h, minimums.minHeight, bounds.maxY - bounds.minY);
  const maxX = Math.max(bounds.minX, bounds.maxX - width);
  const maxY = Math.max(bounds.minY, bounds.maxY - height);

  return {
    ...frame,
    x: clamp(frame.x, bounds.minX, maxX),
    y: clamp(frame.y, bounds.minY, maxY),
    w: width,
    h: height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveCommittedFrame(input: {
  frame: WorkspaceWindowFrame;
  moduleId: WorkspaceModuleId;
  peerFrames: WorkspaceWindowFrame[];
  safeEdgePadding: boolean;
  snapBehavior: FullCanvasSnapBehavior;
  snapEnabled: boolean;
  canvasWidth: number;
  canvasHeight: number;
  viewportBounds: { minX: number; maxX: number; minY: number; maxY: number };
}) {
  const minimums = getWorkspaceModuleMinimumSize(input.moduleId);
  const effectiveMinimums = {
    minWidth: minimums.width,
    minHeight: minimums.height,
  };
  const bounded = clampResizedFrame(
    input.frame,
    input.viewportBounds,
    effectiveMinimums,
  );

  if (!input.snapEnabled) {
    return bounded;
  }

  const snapped = snapWindowFrame({
    frame: bounded,
    interaction: "move",
    moduleId: input.moduleId,
    peerFrames: input.peerFrames,
    safeEdgePadding: input.safeEdgePadding,
    snapBehavior: input.snapBehavior,
    viewport: {
      width: input.canvasWidth,
      height: input.canvasHeight,
    },
    viewportBounds: input.viewportBounds,
  }).frame;

  return clampResizedFrame(
    snapped,
    input.viewportBounds,
    effectiveMinimums,
  );
}
