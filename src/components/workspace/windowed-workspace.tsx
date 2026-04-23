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
import { resolveVerticalWorkspaceMetrics } from "@/lib/workspace-preferences";
import { cn } from "@/lib/utils";
import type { WorkspaceModuleId, WorkspacePreferences, WorkspaceWindowFrame } from "@/types";

export function WindowedWorkspace({
  context,
  mode,
  preferences,
  onCommitFrame,
  onFitViewport,
  onToggleCollapsed,
}: {
  context: WorkspaceModuleContext;
  mode: "study" | "setup";
  preferences: WorkspacePreferences;
  onCommitFrame: (moduleId: WorkspaceModuleId, frame: WorkspaceWindowFrame) => void;
  onFitViewport: (viewport: { width: number; height: number }) => void;
  onToggleCollapsed: (moduleId: WorkspaceModuleId, collapsed: boolean) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onFitViewport(viewportSize);
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [mode, onFitViewport, viewportSize]);

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

  const visibleModules = preferences.enabledModules
    .filter((moduleId) => Boolean(workspaceModuleRegistry[moduleId]))
    .filter((moduleId) => !preferences.moduleLayout[moduleId]?.collapsed)
    .sort((left, right) => {
      const leftZ = preferences.windowLayout[left]?.z ?? 0;
      const rightZ = preferences.windowLayout[right]?.z ?? 0;
      return leftZ - rightZ;
    });
  const collapsedModules = preferences.enabledModules.filter(
    (moduleId) => preferences.moduleLayout[moduleId]?.collapsed,
  );
  const frames = visibleModules
    .map((moduleId) => preferences.windowLayout[moduleId])
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
  const canvasWidth = Math.max(
    viewportSize.width > 0 ? viewportSize.width : 0,
    frameBounds.maxX + 8,
  );
  const canvasHeight = Math.max(
    viewportSize.height > 0 ? verticalMetrics.canvasFloor : 0,
    frameBounds.maxY + verticalMetrics.canvasPadding,
  );
  const topZ = Math.max(1, ...frames.map((frame) => frame?.z ?? 1));

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-4"
      data-workspace-mode={mode}
      data-workspace-reduced-chrome={preferences.theme.reducedChrome ? "true" : "false"}
      data-workspace-style={preferences.workspaceStyle}
      data-workspace-vertical-space={preferences.theme.verticalSpace}
      data-workspace-snap-mode={preferences.theme.snapMode ? "on" : "off"}
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
                  {preferences.theme.snapMode
                    ? "Snap is on - drag to an edge for clean split layouts."
                    : "Snap is off - windows move freely while you arrange them."}
                </span>
              </div>
            ) : null}

            {visibleModules.map((moduleId) => {
              const module = workspaceModuleRegistry[moduleId];
              const frame = preferences.windowLayout[moduleId];
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
                  onCommit={onCommitFrame}
                  onToggleCollapsed={onToggleCollapsed}
                  snapEnabled={preferences.theme.snapMode}
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

      {collapsedModules.length > 0 ? (
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
