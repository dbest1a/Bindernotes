import { memo, useMemo, type ReactElement } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getWhiteboardModuleDefinition,
  shouldRenderWhiteboardModuleLive,
} from "@/lib/whiteboards/whiteboard-module-registry";
import {
  defaultWhiteboardViewportTransform,
  getEmbeddedModulePresentation,
  getWhiteboardModuleAnchorMode,
  isWhiteboardModuleVisibleInViewport,
  type WhiteboardViewportTransform,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import { WhiteboardModuleCard } from "@/components/whiteboard/whiteboard-module-card";
import { cn } from "@/lib/utils";

type WhiteboardPinnedObjectLayerProps = {
  context: WorkspaceModuleContext;
  fixed?: boolean;
  modules: WhiteboardModuleElement[];
  renderModule: (moduleId: WhiteboardModuleElement["moduleId"], context: WorkspaceModuleContext) => ReactElement | null;
  onChangeModule: (moduleElement: WhiteboardModuleElement) => void;
  onRemoveModule: (moduleId: string) => void;
  viewportTransform?: WhiteboardViewportTransform;
  getViewportTransform?: () => WhiteboardViewportTransform;
};

function getLayerTransform(transform: WhiteboardViewportTransform, fixed: boolean): WhiteboardViewportTransform {
  if (fixed) {
    return transform;
  }

  return {
    ...transform,
    offsetLeft: 0,
    offsetTop: 0,
  };
}

function getFloatingTransform(transform: WhiteboardViewportTransform): WhiteboardViewportTransform {
  return {
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
    viewportWidth: transform.viewportWidth,
    viewportHeight: transform.viewportHeight,
    offsetLeft: 0,
    offsetTop: 0,
  };
}

type WhiteboardObjectOverlayProps = Omit<WhiteboardPinnedObjectLayerProps, "fixed"> & {
  className: string;
  maxZIndex: number;
  renderLayer: "board" | "viewport";
  testId: string;
};

function WhiteboardObjectOverlay({
  className,
  context,
  getViewportTransform,
  maxZIndex,
  modules,
  onChangeModule,
  onRemoveModule,
  renderLayer,
  renderModule,
  testId,
  viewportTransform = defaultWhiteboardViewportTransform,
}: WhiteboardObjectOverlayProps) {
  const embeddedContext: WorkspaceModuleContext = {
    ...context,
    surface: "whiteboard",
  };

  return (
    <div className={className} data-testid={testId}>
      {modules.map((moduleElement) => {
        const definition = getWhiteboardModuleDefinition(moduleElement.moduleId);
        const visible = isWhiteboardModuleVisibleInViewport(moduleElement, viewportTransform);
        const presentation = getEmbeddedModulePresentation(moduleElement, viewportTransform, visible);
        const live =
          presentation === "live" &&
          shouldRenderWhiteboardModuleLive(moduleElement, { visible });
        const liveContent = live ? renderModule(moduleElement.moduleId, embeddedContext) : null;
        const previewDescription =
          presentation === "chip"
            ? "Zoom in to reopen this board tool."
            : moduleElement.mode !== "live"
              ? definition?.description ?? "Open this module live when you need it."
              : "Zoom in or enlarge this card to run the live module.";

        return (
          <WhiteboardModuleCard
            key={moduleElement.id}
            live={live}
            moduleElement={moduleElement}
            onChange={onChangeModule}
            onBringToFront={() => {
              if (moduleElement.zIndex >= maxZIndex) {
                return;
              }
              onChangeModule({
                ...moduleElement,
                zIndex: maxZIndex + 1,
                updatedAt: new Date().toISOString(),
              });
            }}
            onRemove={onRemoveModule}
            presentation={presentation}
            renderLayer={renderLayer}
            getViewportTransform={getViewportTransform}
            viewportTransform={viewportTransform}
          >
            {liveContent ?? (
              <EmptyState
                description={previewDescription}
                title={definition?.label ?? moduleElement.title ?? "BinderNotes module"}
              />
            )}
          </WhiteboardModuleCard>
        );
      })}
    </div>
  );
}

export function WhiteboardBoardObjectOverlay(props: WhiteboardObjectOverlayProps) {
  return <WhiteboardObjectOverlay {...props} />;
}

export const WhiteboardViewportToolOverlay = memo(function WhiteboardViewportToolOverlay(
  props: WhiteboardObjectOverlayProps,
) {
  return <WhiteboardObjectOverlay {...props} />;
});

export function WhiteboardPinnedObjectLayer({
  context,
  fixed = false,
  getViewportTransform,
  modules,
  renderModule,
  onChangeModule,
  onRemoveModule,
  viewportTransform = defaultWhiteboardViewportTransform,
}: WhiteboardPinnedObjectLayerProps) {
  const maxZIndex = modules.reduce((max, moduleElement) => Math.max(max, moduleElement.zIndex), 0);
  const pinnedTransform = getLayerTransform(viewportTransform, fixed);
  const floatingTransform = useMemo(
    () => getFloatingTransform(viewportTransform),
    [viewportTransform.viewportWidth, viewportTransform.viewportHeight],
  );
  const boardModules = useMemo(
    () => modules.filter((moduleElement) => getWhiteboardModuleAnchorMode(moduleElement) !== "viewport"),
    [modules],
  );
  const viewportModules = useMemo(
    () => modules.filter((moduleElement) => getWhiteboardModuleAnchorMode(moduleElement) === "viewport"),
    [modules],
  );

  return (
    <div
      className={cn("pointer-events-none inset-0 z-20", fixed ? "fixed" : "absolute")}
      data-whiteboard-viewport-scroll-x={viewportTransform.scrollX}
      data-whiteboard-viewport-scroll-y={viewportTransform.scrollY}
      data-whiteboard-viewport-zoom={viewportTransform.zoom}
      data-testid="whiteboard-pinned-object-layer"
    >
      <WhiteboardBoardObjectOverlay
        className="pointer-events-none absolute inset-0"
        context={context}
        maxZIndex={maxZIndex}
        modules={boardModules}
        onChangeModule={onChangeModule}
        onRemoveModule={onRemoveModule}
        renderModule={renderModule}
        renderLayer="board"
        testId="whiteboard-board-object-overlay"
        getViewportTransform={getViewportTransform}
        viewportTransform={pinnedTransform}
      />
      <WhiteboardViewportToolOverlay
        className="pointer-events-none absolute inset-0"
        context={context}
        maxZIndex={maxZIndex}
        modules={viewportModules}
        onChangeModule={onChangeModule}
        onRemoveModule={onRemoveModule}
        renderModule={renderModule}
        renderLayer="viewport"
        testId="whiteboard-viewport-tool-overlay"
        getViewportTransform={getViewportTransform}
        viewportTransform={floatingTransform}
      />
    </div>
  );
}
