import { useEffect, useRef, useState, type ReactNode } from "react";
import { Grip, Minus, MoveDiagonal2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceModuleId, WorkspaceWindowFrame } from "@/types";

type WorkspaceWindowProps = {
  boundsHeight: number;
  boundsWidth: number;
  children: ReactNode;
  canvasHeight: number;
  canvasWidth: number;
  frame: WorkspaceWindowFrame;
  locked: boolean;
  moduleId: WorkspaceModuleId;
  snapEnabled: boolean;
  workspaceStyle: "guided" | "flexible" | "full-studio";
  onCommit: (moduleId: WorkspaceModuleId, frame: WorkspaceWindowFrame) => void;
  onToggleCollapsed: (moduleId: WorkspaceModuleId, collapsed: boolean) => void;
  topZ: number;
};

type ResizeMode = "move" | "corner" | "right" | "bottom";
type SnapPreview = {
  frame: WorkspaceWindowFrame;
  label: string;
};

const minSizes: Partial<Record<WorkspaceModuleId, { width: number; height: number }>> = {
  lesson: { width: 620, height: 460 },
  "private-notes": { width: 640, height: 500 },
  "binder-notebook": { width: 560, height: 460 },
  "desmos-graph": { width: 720, height: 520 },
  "scientific-calculator": { width: 320, height: 320 },
  "saved-graphs": { width: 320, height: 260 },
  "formula-sheet": { width: 320, height: 260 },
  "math-blocks": { width: 420, height: 260 },
  "lesson-outline": { width: 220, height: 220 },
  "recent-highlights": { width: 300, height: 240 },
  "related-concepts": { width: 300, height: 240 },
  tasks: { width: 300, height: 220 },
  comments: { width: 320, height: 320 },
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
  snapEnabled,
  workspaceStyle,
  onCommit,
  onToggleCollapsed,
  topZ,
}: WorkspaceWindowProps) {
  const [activeMode, setActiveMode] = useState<ResizeMode | null>(null);
  const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(frame);
  const rafRef = useRef<number | null>(null);
  const snapPreviewRef = useRef<SnapPreview | null>(null);
  const interactionActiveRef = useRef(false);

  useEffect(() => {
    if (interactionActiveRef.current) {
      return;
    }
    frameRef.current = frame;
    applyFrameToElement(windowRef.current, frame);
  }, [frame, activeMode]);

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

  const beginPointerAction = (event: React.PointerEvent<HTMLDivElement>, mode: ResizeMode) => {
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
    const minWidth = minSizes[moduleId]?.width ?? 280;
    const minHeight = minSizes[moduleId]?.height ?? 220;
    const canvasLimitWidth = Math.max(minWidth, canvasWidth);
    const canvasLimitHeight = Math.max(minHeight, canvasHeight);
    const shell = event.currentTarget.closest(".workspace-canvas-shell");
    setActiveMode(mode);
    setSnapPreview(null);
    interactionActiveRef.current = true;
    source.setPointerCapture?.(pointerId);

    const getViewportBounds = () => {
      if (shell instanceof HTMLElement) {
        return {
          minX: shell.scrollLeft,
          maxX: shell.scrollLeft + Math.max(minWidth, shell.clientWidth - 8),
          minY: 0,
          maxY: canvasLimitHeight,
        };
      }

      return {
        minX: 0,
        maxX: Math.max(minWidth, boundsWidth),
        minY: 0,
        maxY: Math.max(minHeight, boundsHeight),
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
              { width: canvasLimitWidth, height: canvasLimitHeight },
              { minWidth, minHeight },
            );

      const nextPreview =
        snapEnabled && mode === "move"
          ? resolveSnapPreview(shell, moveEvent, viewportBounds, startFrame)
          : null;
      const next = nextPreview?.frame ?? movedFrame;

      frameRef.current = next;
      snapPreviewRef.current = nextPreview;
      setSnapPreview((current) =>
        current?.label === nextPreview?.label &&
        current?.frame?.x === nextPreview?.frame?.x &&
        current?.frame?.y === nextPreview?.frame?.y &&
        current?.frame?.w === nextPreview?.frame?.w &&
        current?.frame?.h === nextPreview?.frame?.h
          ? current
          : nextPreview,
      );
      scheduleFrameRender();
    };

    const onUp = () => {
      source.releasePointerCapture?.(pointerId);
      const resolvedFrame = resolveCommittedFrame({
        frame: snapPreviewRef.current?.frame ?? frameRef.current,
        moduleId,
        snapEnabled,
        canvasWidth,
        canvasHeight,
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

  return (
    <div
      className={cn(
        "workspace-window absolute min-h-0 min-w-0 transition-shadow duration-150",
        !locked && "cursor-default",
        !locked && "workspace-window--editable",
        activeMode === "move" && "workspace-window--dragging",
        activeMode === "corner" && "workspace-window--resizing",
      )}
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
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;
            const handle = target.closest("[data-window-drag-handle='true']");
            const interactive = target.closest(
              "button, input, textarea, select, a, [role='button']",
            );
            if (interactive) {
              return;
            }
            if (handle) {
              beginPointerAction(event, "move");
            }
          }}
        >
          {children}
        </div>
      </div>

      {!locked ? (
        <div
          className="absolute bottom-2 right-2 z-30 flex size-9 cursor-nwse-resize items-center justify-center rounded-full border border-border/70 bg-background/94 shadow-sm backdrop-blur"
          data-window-resize="corner"
          onPointerDown={(event) => beginPointerAction(event, "corner")}
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

function resolveSnapPreview(
  shell: Element | null,
  moveEvent: PointerEvent,
  viewportBounds: { minX: number; maxX: number; minY: number; maxY: number },
  startFrame: WorkspaceWindowFrame,
): SnapPreview | null {
  if (!(shell instanceof HTMLElement)) {
    return null;
  }

  const rect = shell.getBoundingClientRect();
  const localX = moveEvent.clientX - rect.left + shell.scrollLeft;
  const localY = moveEvent.clientY - rect.top + shell.scrollTop;
  const edgeThreshold = Math.max(40, Math.min(84, Math.round(shell.clientWidth * 0.065)));
  const gutter = 8;
  const splitGap = 8;
  const snappedHeight = snapToFrame(Math.max(240, shell.clientHeight - gutter * 2), 8);
  const snappedY = snapToFrame(shell.scrollTop + gutter, 8);
  const fullWidth = snapToFrame(Math.max(320, shell.clientWidth - gutter * 2), 8);
  const halfWidth = snapToFrame(
    Math.max(320, Math.round((shell.clientWidth - gutter * 2 - splitGap) / 2)),
    8,
  );

  if (localY <= shell.scrollTop + edgeThreshold) {
    return {
      label: "Release for full-width layout",
      frame: clampResizedFrame(
        {
          ...startFrame,
          x: snapToFrame(shell.scrollLeft + gutter),
          y: snappedY,
          w: fullWidth,
          h: snappedHeight,
        },
        { width: Math.max(viewportBounds.maxX, shell.scrollLeft + shell.clientWidth), height: viewportBounds.maxY },
        { minWidth: 320, minHeight: 220 },
      ),
    };
  }

  if (localX <= shell.scrollLeft + edgeThreshold) {
    return {
      label: "Release for left split",
      frame: clampResizedFrame(
        {
          ...startFrame,
          x: snapToFrame(shell.scrollLeft + gutter),
          y: snappedY,
          w: halfWidth,
          h: snappedHeight,
        },
        { width: Math.max(viewportBounds.maxX, shell.scrollLeft + shell.clientWidth), height: viewportBounds.maxY },
        { minWidth: 320, minHeight: 220 },
      ),
    };
  }

  if (localX >= shell.scrollLeft + shell.clientWidth - edgeThreshold) {
    return {
      label: "Release for right split",
      frame: clampResizedFrame(
        {
          ...startFrame,
          x: snapToFrame(shell.scrollLeft + shell.clientWidth - gutter - halfWidth),
          y: snappedY,
          w: halfWidth,
          h: snappedHeight,
        },
        { width: Math.max(viewportBounds.maxX, shell.scrollLeft + shell.clientWidth), height: viewportBounds.maxY },
        { minWidth: 320, minHeight: 220 },
      ),
    };
  }

  return null;
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
  bounds: { width: number; height: number },
  minimums: { minWidth: number; minHeight: number },
) {
  const width = clamp(frame.w, minimums.minWidth, bounds.width);
  const height = clamp(frame.h, minimums.minHeight, bounds.height);
  const maxX = Math.max(0, bounds.width - width);
  const maxY = Math.max(0, bounds.height - height);

  return {
    ...frame,
    x: clamp(frame.x, 0, maxX),
    y: clamp(frame.y, 0, maxY),
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
  snapEnabled: boolean;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const minimums = minSizes[input.moduleId] ?? { width: 280, height: 220 };
  const effectiveMinimums =
    input.snapEnabled
      ? {
          minWidth: Math.min(minimums.width, 320),
          minHeight: Math.min(minimums.height, 220),
        }
      : {
          minWidth: minimums.width,
          minHeight: minimums.height,
        };
  const bounded = clampResizedFrame(
    input.frame,
    {
      width: Math.max(minimums.width, input.canvasWidth),
      height: Math.max(minimums.height, input.canvasHeight),
    },
    effectiveMinimums,
  );

  if (!input.snapEnabled) {
    return bounded;
  }

  return clampResizedFrame(
    {
      ...bounded,
      x: snapToFrame(bounded.x, 8),
      y: snapToFrame(bounded.y, 8),
      w: snapToFrame(bounded.w, 8),
      h: snapToFrame(bounded.h, 8),
    },
    {
      width: Math.max(minimums.width, input.canvasWidth),
      height: Math.max(minimums.height, input.canvasHeight),
    },
    effectiveMinimums,
  );
}
