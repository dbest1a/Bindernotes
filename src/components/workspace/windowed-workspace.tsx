import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BringToFront,
  Eye,
  Grid2X2,
  Layers3,
  Minimize2,
  Move,
  PanelRightOpen,
  Plus,
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
import { recordWhiteboardPerformanceDiagnostic, setWorkspaceMovementActive } from "@/lib/whiteboard-performance-diagnostics";
import { resolveVerticalWorkspaceMetrics } from "@/lib/workspace-preferences";
import { cn } from "@/lib/utils";
import type { WorkspaceModuleId, WorkspacePreferences, WorkspacePresetId, WorkspaceWindowFrame } from "@/types";

const EDIT_LAYOUT_HINT_DURATION_MS = 30_000;

export function WindowedWorkspace({
  canvasStarterLayouts = false,
  canvasReworkEnabled = false,
  compactExcalidrawToolsEnabled = false,
  context,
  desmosV2Enabled = false,
  layoutScope = "lesson",
  mode,
  preferences,
  onAddSpaceBelow,
  onApplyStarterPreset,
  onBackToSimple,
  onCommitFrame,
  onCanvasHeightChange,
  onFitViewport,
  onOpenModule,
  onRemoveModule,
  onResetLayout,
  onResetView,
  onTidyLayout,
  onToggleGrid,
  onToggleGuides,
  onToggleCollapsed,
  whiteboardPerformanceDiagnosticsEnabled = false,
  whiteboardSmoothMoveEnabled = false,
}: {
  canvasStarterLayouts?: boolean;
  canvasReworkEnabled?: boolean;
  compactExcalidrawToolsEnabled?: boolean;
  context: WorkspaceModuleContext;
  desmosV2Enabled?: boolean;
  layoutScope?: "global" | "binder" | "lesson";
  mode: "study" | "setup";
  onAddSpaceBelow?: () => void;
  onApplyStarterPreset?: (presetId: WorkspacePresetId) => void;
  onBackToSimple?: () => void;
  preferences: WorkspacePreferences;
  onCanvasHeightChange?: (canvasHeight: number) => void;
  onCommitFrame: (moduleId: WorkspaceModuleId, frame: WorkspaceWindowFrame) => void;
  onFitViewport: (viewport: { width: number; height: number }) => void;
  onOpenModule?: (moduleId: WorkspaceModuleId) => void;
  onRemoveModule?: (moduleId: WorkspaceModuleId) => void;
  onResetLayout?: () => void;
  onResetView?: () => void;
  onTidyLayout?: () => void;
  onToggleGrid?: () => void;
  onToggleGuides?: () => void;
  onToggleCollapsed: (moduleId: WorkspaceModuleId, collapsed: boolean) => void;
  whiteboardPerformanceDiagnosticsEnabled?: boolean;
  whiteboardSmoothMoveEnabled?: boolean;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const pendingSnapGuidesRef = useRef<WorkspaceSnapGuide[] | null>(null);
  const snapGuidesRafRef = useRef<number | null>(null);
  const isFaceliftCanvas =
    preferences.workspacePresentationMode === "facelift" &&
    preferences.facelift.surfaceMode === "canvas";
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [draftCanvasHeight, setDraftCanvasHeight] = useState(preferences.canvas.canvasHeight);
  const [snapGuides, setSnapGuides] = useState<WorkspaceSnapGuide[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<WorkspaceModuleId | null>(null);
  const [activeMobileModuleId, setActiveMobileModuleId] = useState<WorkspaceModuleId | null>(null);
  const [movingModuleId, setMovingModuleId] = useState<WorkspaceModuleId | null>(null);
  const [showEditHints, setShowEditHints] = useState(mode === "setup" && !isFaceliftCanvas);
  const stickyComments = context.comments ?? [];
  const smoothMovementEnabled = desmosV2Enabled || whiteboardSmoothMoveEnabled;

  useEffect(
    () => () => {
      setWorkspaceMovementActive(false);
    },
    [],
  );

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
    if (mode !== "setup" || isFaceliftCanvas) {
      setShowEditHints(false);
      return;
    }

    setShowEditHints(true);
    const timeoutId = window.setTimeout(() => {
      setShowEditHints(false);
    }, EDIT_LAYOUT_HINT_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isFaceliftCanvas, mode]);

  const isCanvasReworkCustomLayout =
    canvasReworkEnabled && preferences.canvas.layoutSource === "custom";
  const shouldLockSplitCanvasToViewport =
    mode === "study" &&
    preferences.locked &&
    preferences.preset === "split-study" &&
    !isCanvasReworkCustomLayout;
  const splitStudyViewportLayout = useMemo(
    () =>
      shouldLockSplitCanvasToViewport && viewportSize.width > 0 && viewportSize.height > 0
        ? createSplitStudyViewportLayout(preferences.windowLayout, viewportSize)
        : null,
    [preferences.windowLayout, shouldLockSplitCanvasToViewport, viewportSize],
  );
  const getRenderFrame = useCallback(
    (moduleId: WorkspaceModuleId) =>
      splitStudyViewportLayout?.[moduleId] ??
      preferences.windowLayout[moduleId],
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
  const isJacobMathCanvasContext = useMemo(
    () => canvasStarterLayouts && isJacobMathContext(context),
    [canvasStarterLayouts, context],
  );
  const launcherModuleIds = useMemo(
    () =>
      isJacobMathCanvasContext
        ? allModuleIds.filter((moduleId) => !isIrrelevantJacobMathModule(moduleId))
        : allModuleIds,
    [allModuleIds, isJacobMathCanvasContext],
  );
  const launcherGroups = useMemo(
    () => groupCanvasModuleShelf(launcherModuleIds, context),
    [context, launcherModuleIds],
  );
  const showCollapsedWindowTray =
    collapsedModules.length > 0 && !preferences.theme.focusMode && !isFaceliftCanvas;
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
  const shouldLockCanvasToViewport = shouldLockSplitCanvasToViewport;
  const canvasWidth = shouldLockCanvasToViewport
    ? Math.max(viewportSize.width > 0 ? viewportSize.width : 0, frameBounds.maxX)
    : Math.max(
        viewportSize.width > 0 ? viewportSize.width : 0,
        frameBounds.maxX + 8,
      );
  const canvasHeight = shouldLockCanvasToViewport
    ? Math.max(viewportSize.height > 0 ? viewportSize.height : 0, frameBounds.maxY)
    : Math.max(
        preferences.canvas.canvasHeight,
        draftCanvasHeight,
        viewportSize.height > 0 ? verticalMetrics.canvasFloor : 0,
        frameBounds.maxY + verticalMetrics.canvasPadding,
      );
  const canvasWidthStyle = shouldLockCanvasToViewport
    ? `${canvasWidth}px`
    : "100%";
  const topZ = Math.max(1, ...frames.map((frame) => frame?.z ?? 1));
  const selectedFrame = selectedModuleId ? preferences.windowLayout[selectedModuleId] : null;
  const selectedModule = selectedModuleId ? workspaceModuleRegistry[selectedModuleId] : null;
  const activeMobileModule =
    activeMobileModuleId && visibleModules.includes(activeMobileModuleId)
      ? activeMobileModuleId
      : visibleModules[0] ?? null;
  const isMobileCanvasRework = canvasReworkEnabled && viewportSize.width > 0 && viewportSize.width < 700;
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

  const handleInteractionChange = useCallback(
    (state: { active: boolean; mode: "move" | "resize"; moduleId: WorkspaceModuleId }) => {
      setMovingModuleId(state.active ? state.moduleId : null);
      setWorkspaceMovementActive(state.active);
      recordWhiteboardPerformanceDiagnostic(state.active ? "whiteboard-drag-start" : "whiteboard-drag-commit", {
        mode: state.mode,
        moduleId: state.moduleId,
      });
    },
    [],
  );

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

  const layoutSourceLabel =
    mode === "setup"
      ? preferences.canvas.layoutSource === "custom"
        ? "Unsaved edits"
        : "Starter layout"
      : preferences.canvas.layoutSource === "custom"
        ? "Custom layout"
        : "Starter layout";
  const activeLayoutName = starterLayoutName(preferences.preset);
  const renderShelfButton = (moduleId: WorkspaceModuleId) => {
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
  };

  useEffect(() => {
    if (
      canvasReworkEnabled ||
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
    canvasReworkEnabled,
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
      className="flex min-h-0 w-full flex-1 flex-col gap-4"
      data-maximize-module-space={preferences.theme.compactMode ? "true" : "false"}
      data-facelift-density={preferences.workspacePresentationMode === "facelift" ? preferences.facelift.density : undefined}
      data-facelift-module-chrome={
        preferences.workspacePresentationMode === "facelift" ? preferences.facelift.moduleChrome : undefined
      }
      data-facelift-surface={preferences.workspacePresentationMode === "facelift" ? preferences.facelift.surfaceMode : undefined}
      data-workspace-mode={mode}
      data-workspace-preset={preferences.preset}
      data-workspace-presentation={preferences.workspacePresentationMode}
      data-workspace-reduced-chrome={preferences.theme.reducedChrome ? "true" : "false"}
      data-workspace-style={preferences.workspaceStyle}
      data-workspace-vertical-space={preferences.theme.verticalSpace}
      data-workspace-snap-mode={snapBehavior}
      data-workspace-focus-mode={preferences.theme.focusMode ? "on" : "off"}
      data-workspace-edit-hints={showEditHints ? "on" : "off"}
      data-canvas-starter-layouts={canvasStarterLayouts ? "true" : "false"}
      data-beta-canvas-rework={canvasReworkEnabled ? "true" : "false"}
      data-beta-compact-excalidraw-tools={compactExcalidrawToolsEnabled ? "true" : "false"}
      data-beta-desmos-v2={desmosV2Enabled ? "true" : "false"}
      data-beta-whiteboard-performance-diagnostics={whiteboardPerformanceDiagnosticsEnabled ? "true" : "false"}
      data-beta-whiteboard-smooth-move={whiteboardSmoothMoveEnabled ? "true" : "false"}
      data-canvas-layout-source={preferences.canvas.layoutSource}
      data-canvas-layout-scope={layoutScope}
      data-workspace-dragging={movingModuleId ? "true" : "false"}
      data-workspace-dragging-module={movingModuleId ?? undefined}
    >
      {canvasReworkEnabled ? (
        <section className="canvas-rework-topbar" aria-label="Canvas Rework workspace controls">
          <div className="canvas-rework-topbar__summary">
            <p className="canvas-rework-topbar__eyebrow">Canvas Rework</p>
            <div className="canvas-rework-topbar__title-row">
              <h2>{activeLayoutName}</h2>
              <span className="canvas-rework-badge" data-layout-source={preferences.canvas.layoutSource}>
                {layoutSourceLabel}
              </span>
            </div>
          </div>
          <div className="canvas-rework-topbar__actions">
            {onApplyStarterPreset ? (
              <Button
                onClick={() => onApplyStarterPreset(preferences.canvas.activePresetId ?? preferences.preset)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Sparkles data-icon="inline-start" />
                Starter
              </Button>
            ) : null}
            {onResetView ? (
              <Button onClick={onResetView} size="sm" type="button" variant="outline">
                <PanelRightOpen data-icon="inline-start" />
                Fit visible
              </Button>
            ) : null}
            {onTidyLayout ? (
              <Button onClick={onTidyLayout} size="sm" type="button" variant="outline">
                <Move data-icon="inline-start" />
                Tidy
              </Button>
            ) : null}
            {onResetLayout ? (
              <Button onClick={onResetLayout} size="sm" type="button" variant="ghost">
                <RotateCcw data-icon="inline-start" />
                Reset to starter
              </Button>
            ) : null}
            {mode === "setup" && onAddSpaceBelow ? (
              <Button onClick={onAddSpaceBelow} size="sm" type="button" variant="outline">
                <Plus data-icon="inline-start" />
                Add space below
              </Button>
            ) : null}
            {mode === "setup" && onToggleGrid ? (
              <Button
                onClick={onToggleGrid}
                size="sm"
                type="button"
                variant={preferences.canvas.gridEnabled ? "default" : "outline"}
              >
                <Grid2X2 data-icon="inline-start" />
                Grid {preferences.canvas.gridEnabled ? "on" : "off"}
              </Button>
            ) : null}
            {mode === "setup" && onToggleGuides ? (
              <Button
                onClick={onToggleGuides}
                size="sm"
                type="button"
                variant={preferences.canvas.guidesEnabled ? "default" : "outline"}
              >
                <Layers3 data-icon="inline-start" />
                Guides {preferences.canvas.guidesEnabled ? "on" : "off"}
              </Button>
            ) : null}
            {onBackToSimple ? (
              <Button onClick={onBackToSimple} size="sm" type="button" variant="ghost">
                Back to Simple
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {mode === "setup" && preferences.theme.showUtilityUi ? (
        <section
          className="workspace-layout-builder-panel"
          aria-label={canvasReworkEnabled ? "Canvas Rework module shelf" : "Edit layout module launcher"}
          data-testid={canvasReworkEnabled ? "canvas-rework-module-shelf" : undefined}
        >
          <div className="workspace-layout-builder-panel__main">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {canvasReworkEnabled ? "Module shelf" : "Module launcher"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {canvasReworkEnabled
                  ? "Add modules as building blocks. Starter layouts will not reapply unless you ask."
                  : "Add, restore, or select modules without changing the whole layout."}
              </p>
            </div>
            <div className="workspace-layout-builder-panel__modules">
              {canvasReworkEnabled
                ? launcherGroups.map((group) => (
                    <div className="canvas-rework-module-group" key={group.label}>
                      <p className="canvas-rework-module-group__label">{group.label}</p>
                      <div className="canvas-rework-module-group__items">
                        {group.moduleIds.map(renderShelfButton)}
                      </div>
                    </div>
                  ))
                : launcherModuleIds.map(renderShelfButton)}
            </div>
          </div>

          <div
            className="workspace-layout-builder-panel__inspector"
            data-selected-module={selectedModuleId ?? "none"}
            data-testid={canvasReworkEnabled ? "canvas-rework-module-inspector" : undefined}
          >
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
                {canvasReworkEnabled ? (
                  <div className="canvas-rework-inspector-grid">
                    {([
                      ["x", "Selected module X"],
                      ["y", "Selected module Y"],
                      ["w", "Selected module width"],
                      ["h", "Selected module height"],
                    ] as const).map(([key, label]) => (
                      <label key={key}>
                        <span>{key.toUpperCase()}</span>
                        <input
                          aria-label={label}
                          min={key === "w" || key === "h" ? 120 : 0}
                          onChange={(event) => {
                            const value = Number(event.currentTarget.value);
                            if (!Number.isFinite(value)) {
                              return;
                            }
                            commitSelectedFrame((currentFrame) => ({
                              ...currentFrame,
                              [key]: Math.round(value),
                              z: Math.max(currentFrame.z, topZ + 1),
                            }));
                          }}
                          type="number"
                          value={Math.round(selectedFrame[key])}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
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
                  {onRemoveModule ? (
                    <Button
                      aria-label={`Remove ${selectedModule.title} from canvas`}
                      onClick={() => onRemoveModule(selectedModuleId)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  ) : null}
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
          "workspace-canvas-shell relative min-h-[calc(100svh-7.25rem)] w-full flex-1 overflow-auto rounded-[22px] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--background)/0.94),hsl(var(--secondary)/0.32))] shadow-soft",
          `workspace-canvas-shell--${preferences.theme.backgroundStyle}`,
          mode === "setup" && "workspace-canvas-shell-setup",
          preferences.theme.focusMode && "workspace-canvas-shell--focus",
        )}
        ref={shellRef}
      >
        {visibleModules.length === 0 ? (
          <div className="flex h-full min-h-[720px] items-center justify-center p-8">
            {canvasReworkEnabled ? (
              <div className="canvas-rework-empty-state">
                <EmptyState
                  description="Choose a starter or add modules from the shelf to shape this study workspace."
                  title="Build your study workspace"
                />
                <div className="canvas-rework-empty-state__actions">
                  {([
                    ["split-study", "Start with Source + Notes"],
                    ["math-study", "Start with Math workspace"],
                    ["math-graph-lab", "Start with Graph Lab"],
                    ["math-practice-mode", "Start with Whiteboard"],
                    ["history-source-evidence", "Start with History Evidence"],
                  ] as Array<[WorkspacePresetId, string]>).map(([presetId, label]) => (
                    <Button
                      key={presetId}
                      onClick={() => onApplyStarterPreset?.(presetId)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                description="Turn modules back on from layout edit mode to rebuild this workspace."
                title="No modules are visible"
              />
            )}
          </div>
        ) : isMobileCanvasRework && activeMobileModule ? (
          <div className="canvas-rework-mobile-stack" data-testid="canvas-rework-mobile-stack">
            <p className="canvas-rework-mobile-stack__note">
              Canvas editing works best on tablet or desktop.
            </p>
            <div className="canvas-rework-mobile-tabs" role="tablist" aria-label="Canvas modules">
              {visibleModules.map((moduleId) => (
                <button
                  aria-selected={moduleId === activeMobileModule}
                  className="canvas-rework-mobile-tabs__tab"
                  key={moduleId}
                  onClick={() => setActiveMobileModuleId(moduleId)}
                  role="tab"
                  type="button"
                >
                  {mobileModuleLabel(moduleId)}
                </button>
              ))}
            </div>
            <section className="canvas-rework-mobile-module">
              {workspaceModuleRegistry[activeMobileModule]?.render(context)}
            </section>
          </div>
        ) : (
          <div
            className={cn(
              "workspace-canvas relative",
              `workspace-canvas--${preferences.theme.backgroundStyle}`,
              mode === "setup" && "workspace-canvas--setup",
              canvasReworkEnabled && mode === "setup" && preferences.canvas.gridEnabled && "workspace-canvas--grid-enabled",
            )}
            style={{
              height: canvasHeight,
              minWidth: canvasWidth,
              width: canvasWidthStyle,
            }}
          >
            {mode === "setup" && !isFaceliftCanvas ? (
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

            {mode === "setup" && preferences.canvas.guidesEnabled
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
                  onInteractionChange={smoothMovementEnabled ? handleInteractionChange : undefined}
                  onSelect={setSelectedModuleId}
                  onSnapGuidesChange={handleSnapGuidesChange}
                  onToggleCollapsed={onToggleCollapsed}
                  peerFrames={peerFramesByModuleId.get(moduleId) ?? []}
                  snapBehavior={snapBehavior}
                  snapEnabled={snapBehavior !== "off"}
                  safeEdgePadding={preferences.canvas.safeEdgePadding}
                  smoothMovementEnabled={smoothMovementEnabled}
                  topZ={topZ}
                  workspaceStyle={preferences.workspaceStyle}
                >
                  {module.render(context)}
                </WorkspaceWindow>
              );
            })}

            {stickyComments.length > 0 ? (
              <WorkspaceStickyOverlay
                canvasHeight={canvasHeight}
                canvasWidth={canvasWidth}
                comments={stickyComments}
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

function starterLayoutName(presetId: WorkspacePresetId) {
  const names: Partial<Record<WorkspacePresetId, string>> = {
    "split-study": "Source + Notes",
    "notes-focus": "Notes Focus",
    "annotation-mode": "Annotation",
    "math-study": "Math Study",
    "math-graph-lab": "Graph Lab",
    "math-proof-concept": "Proof / Concept",
    "math-practice-mode": "Problem Solving",
    "full-math-canvas": "Full Math Canvas",
    "history-guided": "History Guided",
    "history-timeline-focus": "Timeline Focus",
    "history-source-evidence": "Source Evidence",
    "history-argument-builder": "Argument Builder",
    "history-full-studio": "Full History Studio",
  };

  return names[presetId] ?? "Canvas Workspace";
}

function groupCanvasModuleShelf(moduleIds: WorkspaceModuleId[], context: WorkspaceModuleContext) {
  const isMath = isJacobMathContext(context);
  const groups = [
    {
      label: "General",
      moduleIds: [
        "lesson",
        "private-notes",
        "binder-notebook",
        "formula-sheet",
        "whiteboard",
        "recent-highlights",
        "comments",
        "related-concepts",
      ] as WorkspaceModuleId[],
    },
    {
      label: "Math",
      moduleIds: [
        "math-blocks",
        "desmos-graph",
        "scientific-calculator",
        "saved-graphs",
        "formula-sheet",
      ] as WorkspaceModuleId[],
    },
    {
      label: "History",
      moduleIds: [
        "history-timeline",
        "history-evidence",
        "history-argument",
        "history-myth-checks",
      ] as WorkspaceModuleId[],
    },
    {
      label: "Advanced",
      moduleIds: moduleIds.filter(
        (moduleId) =>
          !moduleId.startsWith("history-") &&
          ![
            "lesson",
            "private-notes",
            "binder-notebook",
            "formula-sheet",
            "whiteboard",
            "recent-highlights",
            "comments",
            "related-concepts",
            "math-blocks",
            "desmos-graph",
            "scientific-calculator",
            "saved-graphs",
          ].includes(moduleId),
      ),
    },
  ];

  const used = new Set<WorkspaceModuleId>();
  return groups
    .map((group) => {
      const nextModuleIds = group.moduleIds.filter((moduleId, index, list) => {
        const include =
          moduleIds.includes(moduleId) &&
          list.indexOf(moduleId) === index &&
          !used.has(moduleId) &&
          (!isMath || group.label !== "History");
        if (include) {
          used.add(moduleId);
        }
        return include;
      });

      return {
        ...group,
        moduleIds: nextModuleIds,
      };
    })
    .filter((group) => group.moduleIds.length > 0);
}

function mobileModuleLabel(moduleId: WorkspaceModuleId) {
  if (moduleId === "lesson") {
    return "Lesson";
  }
  if (moduleId === "private-notes" || moduleId === "binder-notebook") {
    return "Notes";
  }
  if (moduleId === "desmos-graph" || moduleId === "graph-panel") {
    return "Graph";
  }
  if (moduleId === "whiteboard" || moduleId === "math-blocks") {
    return "Board";
  }
  if (moduleId === "history-timeline") {
    return "Timeline";
  }
  if (moduleId === "history-evidence") {
    return "Evidence";
  }
  if (moduleId === "history-argument") {
    return "Argument";
  }

  return workspaceModuleRegistry[moduleId]?.title ?? "Tools";
}

function isJacobMathContext(context: WorkspaceModuleContext) {
  const binderTitle = context.binder?.title?.toLowerCase() ?? "";
  const binderSubject = context.binder?.subject?.toLowerCase() ?? "";
  const lessonTitle = context.selectedLesson?.title?.toLowerCase() ?? "";

  return (
    binderTitle.includes("jacob") ||
    binderSubject.includes("math") ||
    binderSubject.includes("geometry") ||
    lessonTitle.includes("geometry")
  );
}

function isIrrelevantJacobMathModule(moduleId: WorkspaceModuleId) {
  return moduleId.startsWith("history-") || moduleId.startsWith("chem-");
}
