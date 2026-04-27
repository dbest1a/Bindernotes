import { useEffect, useRef, useState } from "react";
import { Eye, Sparkles } from "lucide-react";
import { WorkspaceStickyOverlay } from "@/components/workspace/workspace-sticky-overlay";
import { WorkspaceWindow } from "@/components/workspace/workspace-window";
import {
  type WorkspaceModuleContext,
  workspaceModuleRegistry,
} from "@/components/workspace/workspace-modules";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { WorkspaceSnapGuide } from "@/lib/workspace-layout-engine";
import { extendWorkspaceCanvasForFrame } from "@/lib/workspace-layout-engine";
import { resolveVerticalWorkspaceMetrics } from "@/lib/workspace-preferences";
import { cn } from "@/lib/utils";
import type { WorkspaceModuleId, WorkspacePreferences, WorkspaceWindowFrame } from "@/types";

export function WindowedWorkspace({
  context,
  mode,
  preferences,
  onCommitFrame,
  onCanvasHeightChange,
  onFitViewport,
  onToggleCollapsed,
}: {
  context: WorkspaceModuleContext;
  mode: "study" | "setup";
  preferences: WorkspacePreferences;
  onCanvasHeightChange?: (canvasHeight: number) => void;
  onCommitFrame: (moduleId: WorkspaceModuleId, frame: WorkspaceWindowFrame) => void;
  onFitViewport: (viewport: { width: number; height: number }) => void;
  onToggleCollapsed: (moduleId: WorkspaceModuleId, collapsed: boolean) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [draftCanvasHeight, setDraftCanvasHeight] = useState(preferences.canvas.canvasHeight);
  const [snapGuides, setSnapGuides] = useState<WorkspaceSnapGuide[]>([]);

  useEffect(() => {
    setDraftCanvasHeight((current) => Math.max(current, preferences.canvas.canvasHeight));
  }, [preferences.canvas.canvasHeight]);

  useEffect(() => {
    const node = shellRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const update = () => {
      const nextWidth = node.clientWidth;
      const nextHeight = node.clientHeight;
      setViewportSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : {
              width: nextWidth,
              height: nextHeight,
            },
      );
    };

    const observer = new ResizeObserver(update);
    observer.observe(node);
    update();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSnapGuides([]);
  }, [mode, preferences.canvas.snapBehavior]);

  const shouldLockSplitCanvasToViewport =
    mode === "study" && preferences.locked && preferences.preset === "split-study";
  const splitStudyViewportLayout =
    shouldLockSplitCanvasToViewport && viewportSize.width > 0 && viewportSize.height > 0
      ? createSplitStudyViewportLayout(preferences.windowLayout, viewportSize)
      : null;
  const getRenderFrame = (moduleId: WorkspaceModuleId) =>
    splitStudyViewportLayout?.[moduleId] ?? preferences.windowLayout[moduleId];

  const visibleModules = preferences.enabledModules
    .filter((moduleId) => Boolean(workspaceModuleRegistry[moduleId]))
    .filter((moduleId) => !preferences.moduleLayout[moduleId]?.collapsed)
    .sort((left, right) => {
      const leftZ = getRenderFrame(left)?.z ?? 0;
      const rightZ = getRenderFrame(right)?.z ?? 0;
      return leftZ - rightZ;
    });
  const collapsedModules = preferences.enabledModules.filter(
    (moduleId) => preferences.moduleLayout[moduleId]?.collapsed,
  );
  const showCollapsedWindowTray = collapsedModules.length > 0 && !preferences.theme.focusMode;
  const frames = visibleModules
    .map((moduleId) => getRenderFrame(moduleId))
    .filter(Boolean);
  const frameBounds = frames.length
    ? {
        maxX: Math.max(...frames.map((frame) => (frame ? frame.x + frame.w : 0))),
        maxY: Math.max(...frames.map((frame) => (frame ? frame.y + frame.h : 0))),
      }
    : { maxX: 0, maxY: 0 };
  const verticalMetrics = resolveVerticalWorkspaceMetrics(
    preferences.theme.verticalSpace,
    viewportSize.height,
  );
  const canvasWidth = shouldLockSplitCanvasToViewport
    ? Math.max(viewportSize.width > 0 ? viewportSize.width : 0, frameBounds.maxX)
    : Math.max(
        viewportSize.width > 0 ? viewportSize.width : 0,
        frameBounds.maxX + 8,
      );
  const canvasHeight = shouldLockSplitCanvasToViewport
    ? Math.max(viewportSize.height > 0 ? viewportSize.height : 0, frameBounds.maxY)
    : Math.max(
        preferences.canvas.canvasHeight,
        draftCanvasHeight,
        viewportSize.height > 0 ? verticalMetrics.canvasFloor : 0,
        frameBounds.maxY + verticalMetrics.canvasPadding,
      );
  const topZ = Math.max(1, ...frames.map((frame) => frame?.z ?? 1));
  const snapBehavior =
    preferences.canvas.snapBehavior !== "off"
      ? preferences.canvas.snapBehavior
      : preferences.theme.snapMode
        ? "edges"
        : "off";
  const extendCanvasForFrame = (frame: WorkspaceWindowFrame) => {
    const result = extendWorkspaceCanvasForFrame({
      canvasHeight,
      frame,
      viewportHeight: viewportSize.height,
    });
    if (!result.changed) {
      return;
    }
    setDraftCanvasHeight((current) => Math.max(current, result.canvasHeight));
    onCanvasHeightChange?.(result.canvasHeight);
  };

  useEffect(() => {
    if (
      mode !== "study" ||
      !preferences.locked ||
      preferences.activeMode === "simple" ||
      viewportSize.width <= 0 ||
      viewportSize.height <= 0
    ) {
      return;
    }

    const previousFit = preferences.viewportFit;
    const viewportChanged =
      !previousFit ||
      Math.abs(previousFit.width - viewportSize.width) > 64 ||
      Math.abs(previousFit.height - viewportSize.height) > 64;
    const splitStudyUnderfilled = isSplitStudyUnderfilled(preferences, viewportSize);

    if (!viewportChanged && !splitStudyUnderfilled) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onFitViewport(viewportSize);
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [
    mode,
    onFitViewport,
    preferences.activeMode,
    preferences.locked,
    preferences.preset,
    preferences.viewportFit,
    preferences.windowLayout,
    viewportSize,
  ]);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-4"
      data-maximize-module-space={preferences.theme.compactMode ? "true" : "false"}
      data-workspace-mode={mode}
      data-workspace-preset={preferences.preset}
      data-workspace-reduced-chrome={preferences.theme.reducedChrome ? "true" : "false"}
      data-workspace-style={preferences.workspaceStyle}
      data-workspace-vertical-space={preferences.theme.verticalSpace}
      data-workspace-snap-mode={snapBehavior}
      data-workspace-focus-mode={preferences.theme.focusMode ? "on" : "off"}
    >
      <div
        className={cn(
          "workspace-canvas-shell relative min-h-[calc(100svh-7.25rem)] flex-1 overflow-auto rounded-[22px] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--background)/0.94),hsl(var(--secondary)/0.32))] shadow-soft",
          `workspace-canvas-shell--${preferences.theme.backgroundStyle}`,
          mode === "setup" && "workspace-canvas-shell-setup",
          preferences.theme.focusMode && "workspace-canvas-shell--focus",
        )}
        ref={shellRef}
      >
        {visibleModules.length === 0 ? (
          <div className="flex h-full min-h-[720px] items-center justify-center p-8">
            <EmptyState
              description="Turn modules back on from layout edit mode to rebuild this workspace."
              title="No modules are visible"
            />
          </div>
        ) : (
          <div
            className={cn(
              "workspace-canvas relative",
              `workspace-canvas--${preferences.theme.backgroundStyle}`,
              mode === "setup" && "workspace-canvas--setup",
            )}
            style={{
              height: canvasHeight,
              minWidth: canvasWidth,
              width: canvasWidth,
            }}
          >
            {mode === "setup" ? (
              <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-4 rounded-full border border-border/60 bg-background/88 px-4 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
                <span className="inline-flex items-center gap-2 font-medium text-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  Drag windows, resize them, then lock the workspace when it feels right.
                </span>
                <span>
                  {snapBehavior !== "off"
                    ? snapBehavior === "modules"
                      ? "Snap is on - drag near edges or another module for clean alignment."
                      : "Snap is on - drag near canvas edges for clean alignment."
                    : "Snap is off - windows move freely while you arrange them."}
                </span>
              </div>
            ) : null}

            {mode === "setup"
              ? snapGuides.map((guide, index) => (
                  <div
                    className="pointer-events-none absolute z-[90] bg-primary/80 shadow-[0_0_0_1px_hsl(var(--background)/0.85)]"
                    data-snap-guide={guide.kind}
                    key={`${guide.axis}:${guide.position}:${index}`}
                    style={
                      guide.axis === "x"
                        ? {
                            height: Math.max(24, guide.end - guide.start),
                            left: guide.position,
                            top: guide.start,
                            width: 2,
                          }
                        : {
                            height: 2,
                            left: guide.start,
                            top: guide.position,
                            width: Math.max(24, guide.end - guide.start),
                          }
                    }
                  />
                ))
              : null}

            {visibleModules.map((moduleId) => {
              const module = workspaceModuleRegistry[moduleId];
              const frame = getRenderFrame(moduleId);
              if (!module || !frame) {
                return null;
              }

              return (
                <WorkspaceWindow
                  boundsHeight={Math.max(240, viewportSize.height > 0 ? viewportSize.height - 8 : canvasHeight)}
                  boundsWidth={Math.max(320, viewportSize.width > 0 ? viewportSize.width - 8 : canvasWidth)}
                  canvasHeight={canvasHeight}
                  canvasWidth={canvasWidth}
                  frame={frame}
                  key={moduleId}
                  locked={mode === "study"}
                  moduleId={moduleId}
                  onCanvasHeightRequest={extendCanvasForFrame}
                  onCommit={(committedModuleId, nextFrame) => {
                    extendCanvasForFrame(nextFrame);
                    onCommitFrame(committedModuleId, nextFrame);
                  }}
                  onSnapGuidesChange={(_, guides) => setSnapGuides(guides)}
                  onToggleCollapsed={onToggleCollapsed}
                  peerFrames={visibleModules
                    .filter((candidateId) => candidateId !== moduleId)
                    .map((candidateId) => getRenderFrame(candidateId))
                    .filter((candidateFrame): candidateFrame is WorkspaceWindowFrame => Boolean(candidateFrame))}
                  snapBehavior={snapBehavior}
                  snapEnabled={snapBehavior !== "off"}
                  safeEdgePadding={preferences.canvas.safeEdgePadding}
                  topZ={topZ}
                  workspaceStyle={preferences.workspaceStyle}
                >
                  {module.render(context)}
                </WorkspaceWindow>
              );
            })}

            {preferences.enabledModules.includes("comments") && context.comments.length > 0 ? (
              <WorkspaceStickyOverlay
                canvasHeight={canvasHeight}
                canvasWidth={canvasWidth}
                comments={context.comments}
                onDeleteSticky={context.onDeleteComment}
                onLayoutChange={context.onStickyMove}
                onSendToNotes={context.onSendStickyToNotes}
                onUpdateSticky={context.onUpdateComment}
                stickyLayouts={context.stickyLayouts}
              />
            ) : null}
          </div>
        )}
      </div>

      {showCollapsedWindowTray ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/86 p-3 shadow-sm backdrop-blur">
          <span className="mr-1 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Eye className="size-4" />
            Collapsed windows
          </span>
          {collapsedModules.map((moduleId) => (
            <Button
              key={moduleId}
              onClick={() => onToggleCollapsed(moduleId, false)}
              size="sm"
              type="button"
              variant="outline"
            >
              {workspaceModuleRegistry[moduleId]?.title ?? moduleId}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function isSplitStudyUnderfilled(
  preferences: WorkspacePreferences,
  viewportSize: { width: number; height: number },
) {
  if (preferences.preset !== "split-study" || viewportSize.width <= 0 || viewportSize.height <= 0) {
    return false;
  }

  const lessonFrame = preferences.windowLayout.lesson;
  const notesFrame = preferences.windowLayout["private-notes"];
  if (
    !lessonFrame ||
    !notesFrame ||
    preferences.moduleLayout.lesson?.collapsed ||
    preferences.moduleLayout["private-notes"]?.collapsed
  ) {
    return false;
  }

  const rightEdge = Math.max(lessonFrame.x + lessonFrame.w, notesFrame.x + notesFrame.w);
  const leftEdge = Math.min(lessonFrame.x, notesFrame.x);
  const usedWidth = rightEdge - leftEdge;
  const expectedHalfWidth = viewportSize.width * 0.5;
  const lessonRight = lessonFrame.x + lessonFrame.w;
  const notesBottom = notesFrame.y + notesFrame.h;
  const lessonBottom = lessonFrame.y + lessonFrame.h;

  return (
    leftEdge > 1 ||
    rightEdge < viewportSize.width - 1 ||
    lessonFrame.y > 1 ||
    notesFrame.y > 1 ||
    lessonBottom < viewportSize.height - 1 ||
    notesBottom < viewportSize.height - 1 ||
    Math.abs(lessonRight - notesFrame.x) > 1 ||
    usedWidth < viewportSize.width * 0.9 ||
    lessonFrame.w < expectedHalfWidth * 0.82 ||
    notesFrame.w < expectedHalfWidth * 0.82
  );
}

function createSplitStudyViewportLayout(
  frames: WorkspacePreferences["windowLayout"],
  viewportSize: { width: number; height: number },
): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const lessonWidth = Math.floor(viewportSize.width / 2);
  const notesWidth = viewportSize.width - lessonWidth;
  return {
    lesson: {
      x: 0,
      y: 0,
      w: lessonWidth,
      h: viewportSize.height,
      z: frames.lesson?.z ?? 1,
    },
    "private-notes": {
      x: lessonWidth,
      y: 0,
      w: notesWidth,
      h: viewportSize.height,
      z: frames["private-notes"]?.z ?? 2,
    },
  };
}
