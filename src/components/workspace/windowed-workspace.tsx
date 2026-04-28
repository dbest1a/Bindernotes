import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BringToFront,
  Eye,
  Layers3,
  Minimize2,
  RotateCcw,
  SendToBack,
  Sparkles,
} from "lucide-react";
import { WorkspaceStickyOverlay } from "@/components/workspace/workspace-sticky-overlay";
import { WorkspaceWindow } from "@/components/workspace/workspace-window";
import {
  type WorkspaceModuleContext,
  workspaceModuleRegistry,
} from "@/components/workspace/workspace-modules";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  extendWorkspaceCanvasForFrame,
  getWorkspaceModuleMinimumSize,
  type WorkspaceSnapGuide,
} from "@/lib/workspace-layout-engine";
import { resolveVerticalWorkspaceMetrics } from "@/lib/workspace-preferences";
import { cn } from "@/lib/utils";
import type { WorkspaceModuleId, WorkspacePreferences, WorkspaceWindowFrame } from "@/types";

const EDIT_LAYOUT_HINT_DURATION_MS = 30_000;

export function WindowedWorkspace({
  context,
  mode,
  preferences,
  onCommitFrame,
  onCanvasHeightChange,
  onFitViewport,
  onOpenModule,
  onToggleCollapsed,
}: {
  context: WorkspaceModuleContext;
  mode: "study" | "setup";
  preferences: WorkspacePreferences;
  onCanvasHeightChange?: (canvasHeight: number) => void;
  onCommitFrame: (moduleId: WorkspaceModuleId, frame: WorkspaceWindowFrame) => void;
  onFitViewport: (viewport: { width: number; height: number }) => void;
  onOpenModule?: (moduleId: WorkspaceModuleId) => void;
  onToggleCollapsed: (moduleId: WorkspaceModuleId, collapsed: boolean) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const pendingSnapGuidesRef = useRef<WorkspaceSnapGuide[] | null>(null);
  const snapGuidesRafRef = useRef<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [draftCanvasHeight, setDraftCanvasHeight] = useState(preferences.canvas.canvasHeight);
  const [snapGuides, setSnapGuides] = useState<WorkspaceSnapGuide[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<WorkspaceModuleId | null>(null);
  const [showEditHints, setShowEditHints] = useState(mode === "setup");

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

  useEffect(() => {
    if (mode !== "setup") {
      setShowEditHints(false);
      return;
    }

    setShowEditHints(true);
    const timeoutId = window.setTimeout(() => {
      setShowEditHints(false);
    }, EDIT_LAYOUT_HINT_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [mode]);

  const shouldLockSplitCanvasToViewport =
    mode === "study" && preferences.locked && preferences.preset === "split-study";
  const splitStudyViewportLayout = useMemo(
    () =>
      shouldLockSplitCanvasToViewport && viewportSize.width > 0 && viewportSize.height > 0
        ? createSplitStudyViewportLayout(preferences.windowLayout, viewportSize)
        : null,
    [preferences.windowLayout, shouldLockSplitCanvasToViewport, viewportSize],
  );
  const getRenderFrame = useCallback(
    (moduleId: WorkspaceModuleId) => splitStudyViewportLayout?.[moduleId] ?? preferences.windowLayout[moduleId],
    [preferences.windowLayout, splitStudyViewportLayout],
  );

  const visibleModules = useMemo(
    () =>
      preferences.enabledModules
        .filter((moduleId) => Boolean(workspaceModuleRegistry[moduleId]))
        .filter((moduleId) => !preferences.moduleLayout[moduleId]?.collapsed)
        .sort((left, right) => {
          const leftZ = getRenderFrame(left)?.z ?? 0;
          const rightZ = getRenderFrame(right)?.z ?? 0;
          return leftZ - rightZ;
        }),
    [getRenderFrame, preferences.enabledModules, preferences.moduleLayout],
  );
  const collapsedModules = useMemo(
    () => preferences.enabledModules.filter((moduleId) => preferences.moduleLayout[moduleId]?.collapsed),
    [preferences.enabledModules, preferences.moduleLayout],
  );
  const allModuleIds = useMemo(
    () => Object.keys(workspaceModuleRegistry) as WorkspaceModuleId[],
    [],
  );
  const showCollapsedWindowTray = collapsedModules.length > 0 && !preferences.theme.focusMode;
  const frameByModuleId = useMemo(
    () => new Map(visibleModules.map((moduleId) => [moduleId, getRenderFrame(moduleId)])),
    [getRenderFrame, visibleModules],
  );
  const frames = useMemo(
    () =>
      Array.from(frameByModuleId.values()).filter(
        (frame): frame is WorkspaceWindowFrame => Boolean(frame),
      ),
    [frameByModuleId],
  );
  const peerFramesByModuleId = useMemo(() => {
    const nextMap = new Map<WorkspaceModuleId, WorkspaceWindowFrame[]>();
    for (const moduleId of visibleModules) {
      nextMap.set(
        moduleId,
        visibleModules
          .filter((candidateId) => candidateId !== moduleId)
          .map((candidateId) => frameByModuleId.get(candidateId))
          .filter((candidateFrame): candidateFrame is WorkspaceWindowFrame => Boolean(candidateFrame)),
      );
    }
    return nextMap;
  }, [frameByModuleId, visibleModules]);
  const frameBounds = useMemo(
    () =>
      frames.length
        ? {
            maxX: Math.max(...frames.map((frame) => frame.x + frame.w)),
            maxY: Math.max(...frames.map((frame) => frame.y + frame.h)),
          }
        : { maxX: 0, maxY: 0 },
    [frames],
  );
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
  const selectedFrame = selectedModuleId ? preferences.windowLayout[selectedModuleId] : null;
  const selectedModule = selectedModuleId ? workspaceModuleRegistry[selectedModuleId] : null;
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

  const handleSnapGuidesChange = useCallback((_: WorkspaceModuleId, guides: WorkspaceSnapGuide[]) => {
    pendingSnapGuidesRef.current = guides;
    if (snapGuidesRafRef.current !== null) {
      return;
    }

    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      setSnapGuides((currentGuides) => (snapGuidesEqual(currentGuides, guides) ? currentGuides : guides));
      pendingSnapGuidesRef.current = null;
      return;
    }

    snapGuidesRafRef.current = window.requestAnimationFrame(() => {
      snapGuidesRafRef.current = null;
      const nextGuides = pendingSnapGuidesRef.current ?? [];
      pendingSnapGuidesRef.current = null;
      setSnapGuides((currentGuides) => (snapGuidesEqual(currentGuides, nextGuides) ? currentGuides : nextGuides));
    });
  }, []);

  useEffect(
    () => () => {
      if (snapGuidesRafRef.current !== null) {
        window.cancelAnimationFrame(snapGuidesRafRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedModuleId) {
      return;
    }

    if (!preferences.enabledModules.includes(selectedModuleId)) {
      setSelectedModuleId(visibleModules[0] ?? null);
      return;
    }

    if (preferences.moduleLayout[selectedModuleId]?.collapsed) {
      setSelectedModuleId(visibleModules[0] ?? null);
    }
  }, [preferences.enabledModules, preferences.moduleLayout, selectedModuleId, visibleModules]);

  const commitSelectedFrame = useCallback(
    (resolveFrame: (frame: WorkspaceWindowFrame) => WorkspaceWindowFrame) => {
      if (!selectedModuleId) {
        return;
      }

      const currentFrame = preferences.windowLayout[selectedModuleId];
      if (!currentFrame) {
        return;
      }

      onCommitFrame(selectedModuleId, resolveFrame(currentFrame));
    },
    [onCommitFrame, preferences.windowLayout, selectedModuleId],
  );

  const resetSelectedModuleSize = useCallback(() => {
    if (!selectedModuleId) {
      return;
    }

    const minimum = getWorkspaceModuleMinimumSize(selectedModuleId);
    commitSelectedFrame((currentFrame) => ({
      ...currentFrame,
      w: Math.max(minimum.width, selectedModuleId === "desmos-graph" ? 720 : minimum.width + 160),
      h: Math.max(minimum.height, selectedModuleId === "lesson" || selectedModuleId === "private-notes" ? 640 : minimum.height + 120),
      z: topZ + 1,
    }));
  }, [commitSelectedFrame, selectedModuleId, topZ]);

  useEffect(() => {
    if (
      mode !== "study" ||
      !preferences.locked ||
      preferences.activeMode === "simple" ||
      preferences.preset !== "split-study" ||
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
      data-workspace-edit-hints={showEditHints ? "on" : "off"}
    >
      {mode === "setup" && preferences.theme.showUtilityUi ? (
        <section className="workspace-layout-builder-panel" aria-label="Edit layout module launcher">
          <div className="workspace-layout-builder-panel__main">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Module launcher
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add, restore, or select modules without changing the whole layout.
              </p>
            </div>
            <div className="workspace-layout-builder-panel__modules">
              {allModuleIds.map((moduleId) => {
                const module = workspaceModuleRegistry[moduleId];
                const enabled = preferences.enabledModules.includes(moduleId);
                const collapsed = collapsedModules.includes(moduleId);
                const visible = visibleModules.includes(moduleId);
                const title = module?.title ?? moduleId;
                const actionLabel = collapsed
                  ? `Restore ${title}`
                  : visible
                    ? `Select ${title}`
                    : `Add ${title}`;

                return (
                  <Button
                    aria-label={actionLabel}
                    className="workspace-layout-builder-panel__module-button"
                    disabled={!enabled && !onOpenModule}
                    key={moduleId}
                    onClick={() => {
                      if (collapsed) {
                        onToggleCollapsed(moduleId, false);
                        setSelectedModuleId(moduleId);
                        return;
                      }

                      if (visible) {
                        setSelectedModuleId(moduleId);
                        return;
                      }

                      onOpenModule?.(moduleId);
                      setSelectedModuleId(moduleId);
                    }}
                    size="sm"
                    type="button"
                    variant={visible ? "default" : collapsed ? "outline" : "ghost"}
                  >
                    <Layers3 data-icon="inline-start" />
                    <span>{title}</span>
                    <span className="workspace-layout-builder-panel__status">
                      {visible ? "Visible" : collapsed ? "Minimized" : "Add"}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="workspace-layout-builder-panel__inspector" data-selected-module={selectedModuleId ?? "none"}>
            {selectedModuleId && selectedFrame && selectedModule ? (
              <>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Selected module
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedModule.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    x {Math.round(selectedFrame.x)} / y {Math.round(selectedFrame.y)} / w {Math.round(selectedFrame.w)} / h {Math.round(selectedFrame.h)}
                  </p>
                </div>
                <div className="workspace-layout-builder-panel__actions">
                  <Button
                    aria-label={`Minimize ${selectedModule.title}`}
                    onClick={() => onToggleCollapsed(selectedModuleId, true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Minimize2 data-icon="inline-start" />
                    Minimize
                  </Button>
                  <Button
                    aria-label={`Bring ${selectedModule.title} forward`}
                    onClick={() =>
                      commitSelectedFrame((currentFrame) => ({
                        ...currentFrame,
                        z: topZ + 1,
                      }))
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <BringToFront data-icon="inline-start" />
                    Forward
                  </Button>
                  <Button
                    aria-label={`Send ${selectedModule.title} backward`}
                    onClick={() =>
                      commitSelectedFrame((currentFrame) => ({
                        ...currentFrame,
                        z: 1,
                      }))
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <SendToBack data-icon="inline-start" />
                    Back
                  </Button>
                  <Button
                    aria-label={`Reset ${selectedModule.title} size`}
                    onClick={resetSelectedModuleSize}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <RotateCcw data-icon="inline-start" />
                    Reset size
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a module to see its position, size, and layer controls.
              </p>
            )}
          </div>
        </section>
      ) : null}

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
              const frame = frameByModuleId.get(moduleId);
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
                    setSelectedModuleId(committedModuleId);
                    extendCanvasForFrame(nextFrame);
                    onCommitFrame(committedModuleId, nextFrame);
                  }}
                  onSelect={setSelectedModuleId}
                  onSnapGuidesChange={handleSnapGuidesChange}
                  onToggleCollapsed={onToggleCollapsed}
                  peerFrames={peerFramesByModuleId.get(moduleId) ?? []}
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

function snapGuidesEqual(left: WorkspaceSnapGuide[], right: WorkspaceSnapGuide[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((guide, index) => {
    const other = right[index];
    return (
      guide.axis === other?.axis &&
      guide.kind === other.kind &&
      guide.position === other.position &&
      guide.start === other.start &&
      guide.end === other.end
    );
  });
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
