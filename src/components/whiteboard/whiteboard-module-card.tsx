import { BookOpenText, Grip, Minus, MoreHorizontal, PanelTopOpen, Pin, PinOff, Sigma, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  getWhiteboardModuleDefinition,
  isHeavyWhiteboardModule,
} from "@/lib/whiteboards/whiteboard-module-registry";
import {
  convertWhiteboardCardAnchor,
  defaultWhiteboardViewportTransform,
  getWhiteboardModuleAnchorMode,
  getWhiteboardModuleMinimumSize,
  getWhiteboardModuleScreenRect,
  isWhiteboardModuleBoardPositioned,
  isWhiteboardModuleZoomScaled,
  screenDeltaToBoardDelta,
  type EmbeddedModulePresentation,
  type WhiteboardScreenRect,
  type WhiteboardViewportTransform,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import type {
  WhiteboardModuleAnchorMode,
  WhiteboardModuleElement,
} from "@/lib/whiteboards/whiteboard-types";
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

function isPinned(moduleElement: WhiteboardModuleElement) {
  return getWhiteboardModuleAnchorMode(moduleElement) !== "viewport";
}

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
  const styleRafRef = useRef<number | null>(null);
  const pendingStyleRef = useRef<StylePatch>({});
  const [anchorMenuOpen, setAnchorMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const definition = getWhiteboardModuleDefinition(moduleElement.moduleId);
  const heavy = isHeavyWhiteboardModule(moduleElement.moduleId);
  const anchorMode = getWhiteboardModuleAnchorMode(moduleElement);
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
    zIndex: foreground ? 10000 + moduleElement.zIndex : moduleElement.zIndex,
  };

  useEffect(
    () => () => {
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
      for (const [key, value] of Object.entries(nextPatch)) {
        if (value) {
          root.style.setProperty(key, value);
        }
      }
    });
  };

  const beginPointerAction = (event: React.PointerEvent, action: PointerStart["action"]) => {
    event.preventDefault();
    event.stopPropagation();
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      frame: moduleElement,
      action,
      viewportTransform: latestViewportTransform(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
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

  const updatePointerAction = (event: React.PointerEvent) => {
    const active = pointerRef.current;
    const root = rootRef.current;
    if (!active || active.pointerId !== event.pointerId || !root) {
      return;
    }

    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (active.action === "drag") {
      const baseFrame = getModuleScreenFrame(active.frame, active.viewportTransform);
      if (isWhiteboardModuleZoomScaled(active.frame)) {
        scheduleStylePatch({
          transform: getBoardObjectTransform(
            {
              ...baseFrame,
              x: baseFrame.x + dx,
              y: baseFrame.y + dy,
            },
            active.viewportTransform,
          ),
        });
      } else {
        scheduleStylePatch({
          left: `${baseFrame.x + dx}px`,
          top: `${baseFrame.y + dy}px`,
        });
      }
      return;
    }

    const zoomScaled = isWhiteboardModuleZoomScaled(active.frame);
    const sizeDelta = zoomScaled
      ? screenDeltaToBoardDelta({ x: dx, y: dy }, active.viewportTransform)
      : { x: dx, y: dy };
    const minSize = getWhiteboardModuleMinimumSize(active.frame.moduleId, active.frame.mode);
    const nextWidth = Math.max(minSize.width, active.frame.width + sizeDelta.x);
    const nextHeight = Math.max(minSize.height, active.frame.height + sizeDelta.y);
    scheduleStylePatch({
      width: `${nextWidth}px`,
      height: `${nextHeight}px`,
    });
  };

  const finishPointerAction = (event: React.PointerEvent) => {
    const active = pointerRef.current;
    const root = rootRef.current;
    if (!active || active.pointerId !== event.pointerId || !root) {
      return;
    }

    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    pointerRef.current = null;
    if (styleRafRef.current) {
      window.cancelAnimationFrame(styleRafRef.current);
      styleRafRef.current = null;
    }
    pendingStyleRef.current = {};
    const positionDelta = isWhiteboardModuleBoardPositioned(active.frame)
      ? screenDeltaToBoardDelta({ x: dx, y: dy }, active.viewportTransform)
      : { x: dx, y: dy };
    const sizeDelta = isWhiteboardModuleZoomScaled(active.frame)
      ? screenDeltaToBoardDelta({ x: dx, y: dy }, active.viewportTransform)
      : { x: dx, y: dy };
    const nextAnchorMode = getWhiteboardModuleAnchorMode(active.frame);

    if (active.action === "drag") {
      onChange({
        ...moduleElement,
        anchorMode: nextAnchorMode,
        pinned: nextAnchorMode !== "viewport",
        x: active.frame.x + positionDelta.x,
        y: active.frame.y + positionDelta.y,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const minSize = getWhiteboardModuleMinimumSize(active.frame.moduleId, active.frame.mode);
    onChange({
      ...moduleElement,
      anchorMode: nextAnchorMode,
      pinned: nextAnchorMode !== "viewport",
      width: Math.max(minSize.width, active.frame.width + sizeDelta.x),
      height: Math.max(minSize.height, active.frame.height + sizeDelta.y),
      updatedAt: new Date().toISOString(),
    });
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
      data-whiteboard-module-anchor={anchorMode}
      data-whiteboard-module={moduleElement.moduleId}
      data-whiteboard-module-pinned={String(pinned)}
      data-whiteboard-module-presentation={presentation}
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
      onPointerDownCapture={() => {
        setSelected(true);
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
          {heavy && moduleElement.mode !== "live" ? (
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
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
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
          <Button
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
