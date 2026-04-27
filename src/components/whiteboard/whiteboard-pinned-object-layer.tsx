import { memo, useMemo, useState, type ReactElement } from "react";
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
import type { Binder, BinderLesson } from "@/types";

const lessonScopedWhiteboardModules = new Set<WhiteboardModuleElement["moduleId"]>([
  "lesson",
  "comments",
  "recent-highlights",
  "related-concepts",
  "formula-sheet",
  "math-blocks",
]);

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

function sortLessonsByOrder(lessons: BinderLesson[]) {
  return [...lessons].sort((left, right) => {
    const orderDelta = (left.order_index ?? 0) - (right.order_index ?? 0);
    if (orderDelta !== 0) {
      return orderDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

function getSourceLessonModuleContext(
  context: WorkspaceModuleContext,
  moduleElement: WhiteboardModuleElement,
): WorkspaceModuleContext {
  if (!lessonScopedWhiteboardModules.has(moduleElement.moduleId) || !context.library) {
    return {
      ...context,
      surface: "whiteboard",
    };
  }

  const binder =
    context.library.binders.find((candidate) => candidate.id === moduleElement.binderId) ??
    context.binder;
  const lessons = sortLessonsByOrder(
    context.library.lessons.filter((lesson) => lesson.binder_id === binder.id),
  );
  const selectedLesson =
    lessons.find((lesson) => lesson.id === moduleElement.lessonId) ??
    lessons[0] ??
    context.selectedLesson;
  const highlights = context.highlights ?? [];
  const conceptNodes = context.conceptNodes ?? [];
  const conceptEdges = context.conceptEdges ?? [];
  const binderConceptNodeIds = new Set(
    conceptNodes.filter((node) => node.binder_id === binder.id).map((node) => node.id),
  );

  return {
    ...context,
    surface: "whiteboard",
    binder,
    lessons,
    filteredLessons: lessons,
    selectedLesson,
    highlights: highlights.filter((highlight) => {
      if (highlight.binder_id !== binder.id) {
        return false;
      }

      return selectedLesson ? highlight.lesson_id === selectedLesson.id : true;
    }),
    conceptNodes: conceptNodes.filter((node) => node.binder_id === binder.id),
    conceptEdges: conceptEdges.filter(
      (edge) => binderConceptNodeIds.has(edge.source_id) || binderConceptNodeIds.has(edge.target_id),
    ),
  };
}

type SourceLessonPickerProps = {
  context: WorkspaceModuleContext;
  moduleElement: WhiteboardModuleElement;
  onChangeModule: (moduleElement: WhiteboardModuleElement) => void;
};

function WhiteboardSourceLessonPicker({
  context,
  moduleElement,
  onChangeModule,
}: SourceLessonPickerProps) {
  const library = context.library;
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() => {
    if (!library) {
      return null;
    }

    return (
      library.folderBinders.find((link) => link.binder_id === moduleElement.binderId)?.folder_id ??
      library.folders[0]?.id ??
      null
    );
  });
  const [selectedBinderId, setSelectedBinderId] = useState<string | null>(() => moduleElement.binderId ?? null);

  if (!library) {
    return null;
  }

  if (library.loading) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        Loading your binders...
      </div>
    );
  }

  if (library.error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        Binder list unavailable: {library.error}
      </div>
    );
  }

  const folders = library.folders;
  const bindersById = new Map(library.binders.map((binder) => [binder.id, binder]));
  const activeFolderId = selectedFolderId ?? folders[0]?.id ?? null;
  const folderBinderIds = new Set(
    library.folderBinders
      .filter((link) => link.folder_id === activeFolderId)
      .map((link) => link.binder_id),
  );
  const folderBinders = library.binders.filter((binder) => folderBinderIds.has(binder.id));
  const unfiledBinders =
    activeFolderId || folderBinders.length > 0
      ? []
      : library.binders.filter(
          (binder) => !library.folderBinders.some((link) => link.binder_id === binder.id),
        );
  const visibleBinders = folderBinders.length > 0 ? folderBinders : unfiledBinders;
  const activeBinder =
    bindersById.get(selectedBinderId ?? "") ??
    visibleBinders.find((binder) => binder.id === moduleElement.binderId) ??
    visibleBinders[0] ??
    bindersById.get(moduleElement.binderId ?? "");
  const activeLessons = activeBinder
    ? sortLessonsByOrder(library.lessons.filter((lesson) => lesson.binder_id === activeBinder.id))
    : [];

  const updateModuleLesson = (binder: Binder, lesson: BinderLesson | null) => {
    onChangeModule({
      ...moduleElement,
      binderId: binder.id,
      lessonId: lesson?.id,
      title: lesson?.title ?? binder.title,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div
      className="mb-3 grid gap-2 rounded-md border border-border bg-card p-2 text-card-foreground"
      data-testid="whiteboard-source-lesson-picker"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {getWhiteboardModuleDefinition(moduleElement.moduleId)?.label ?? "Source lesson"}
        </p>
        {library.binders.length > 0 ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
            {library.binders.length} binders
          </span>
        ) : null}
      </div>

      {folders.length > 0 ? (
        <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Folders">
          {folders.map((folder) => (
            <button
              className={cn(
                "shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition",
                folder.id === activeFolderId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-secondary",
              )}
              key={folder.id}
              onClick={() => {
                setSelectedFolderId(folder.id);
                const firstBinderId = library.folderBinders.find((link) => link.folder_id === folder.id)?.binder_id ?? null;
                setSelectedBinderId(firstBinderId);
              }}
              type="button"
            >
              {folder.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
          No folders yet. Binders will appear here as you create them.
        </p>
      )}

      {visibleBinders.length > 0 ? (
        <div className="grid gap-1" aria-label="Binders">
          {visibleBinders.map((binder) => (
            <button
              className={cn(
                "rounded-md border px-2 py-1.5 text-left text-xs font-semibold transition",
                binder.id === activeBinder?.id
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              key={binder.id}
              onClick={() => {
                setSelectedBinderId(binder.id);
                updateModuleLesson(binder, sortLessonsByOrder(library.lessons.filter((lesson) => lesson.binder_id === binder.id))[0] ?? null);
              }}
              type="button"
            >
              {binder.title}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
          No binders in this folder yet.
        </p>
      )}

      {activeLessons.length > 0 ? (
        <div className="grid max-h-28 gap-1 overflow-y-auto pr-1" aria-label="Lessons">
          {activeLessons.map((lesson) => (
            <button
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-xs transition",
                lesson.id === moduleElement.lessonId
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              key={lesson.id}
              onClick={() => updateModuleLesson(activeBinder!, lesson)}
              type="button"
            >
              {lesson.title}
            </button>
          ))}
        </div>
      ) : activeBinder ? (
        <p className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
          This binder has no lessons yet.
        </p>
      ) : null}
    </div>
  );
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
  return (
    <div className={className} data-testid={testId}>
      {modules.map((moduleElement) => {
        const embeddedContext = getSourceLessonModuleContext(context, moduleElement);
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
            {lessonScopedWhiteboardModules.has(moduleElement.moduleId) ? (
              <WhiteboardSourceLessonPicker
                context={context}
                moduleElement={moduleElement}
                onChangeModule={onChangeModule}
              />
            ) : null}
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
