import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { JSONContent } from "@tiptap/react";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  GraphExpressionRequest,
  GraphLoadRequest,
} from "@/components/math/math-workspace-modules";
import {
  getWhiteboardModuleDefinition,
  isAlwaysLiveWhiteboardModule,
  isViewportFloatingWhiteboardModule,
  shouldRenderWhiteboardModuleLive,
} from "@/lib/whiteboards/whiteboard-module-registry";
import {
  clampWhiteboardViewportToolFrame,
  defaultWhiteboardViewportTransform,
  getEmbeddedModulePresentation,
  getWhiteboardModuleMinimumSize,
  getWhiteboardModuleAnchorMode,
  getWhiteboardModuleScreenRect,
  isWhiteboardModuleVisibleInViewport,
  type WhiteboardViewportTransform,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import { WhiteboardModuleCard } from "@/components/whiteboard/whiteboard-module-card";
import { useMathWorkspace } from "@/hooks/use-math-workspace";
import { prepareExpressionForGraph } from "@/lib/scientific-calculator";
import { cn } from "@/lib/utils";
import type { Binder, BinderLesson, Comment, Highlight, HighlightColor, LessonTextSelection, MathBlock } from "@/types";

const lessonScopedWhiteboardModules = new Set<WhiteboardModuleElement["moduleId"]>([
  "lesson",
  "comments",
  "recent-highlights",
  "related-concepts",
  "formula-sheet",
  "math-blocks",
]);

const syntheticMathLabBinderId = "math-lab";
const syntheticMathLabLessonId = "math-lab-whiteboard";

type ScopedLessonTextSelection = LessonTextSelection & {
  binderId?: string;
  lessonId?: string;
};

type WhiteboardPinnedObjectLayerProps = {
  context: WorkspaceModuleContext;
  fixed?: boolean;
  modules: WhiteboardModuleElement[];
  onAddLinkedModule?: (moduleElement: Partial<WhiteboardModuleElement> & Pick<WhiteboardModuleElement, "moduleId">) => void;
  renderModule: (moduleId: WhiteboardModuleElement["moduleId"], context: WorkspaceModuleContext) => ReactElement | null;
  onChangeModule: (moduleElement: WhiteboardModuleElement) => void;
  onRemoveModule: (moduleId: string) => void;
  onRouteSelectionToNotes?: (request: {
    anchorText?: string;
    prefix: "Source quote" | "Quote block" | "Sticky note";
    sourceModuleId: string;
  }) => void;
  viewportTransform?: WhiteboardViewportTransform;
  getViewportTransform?: () => WhiteboardViewportTransform;
};

function emptyNoteDoc(): JSONContent {
  return { type: "doc", content: [] };
}

function appendParagraph(content: JSONContent | undefined, text: string): JSONContent {
  const cleanText = text.trim();
  if (!cleanText) {
    return content ?? emptyNoteDoc();
  }

  return {
    type: "doc",
    content: [
      ...(((content ?? emptyNoteDoc()).content as JSONContent[] | undefined) ?? []),
      {
        type: "paragraph",
        content: [{ type: "text", text: cleanText }],
      },
    ],
  };
}

function createWhiteboardHighlight({
  binder,
  color,
  ownerId,
  selectedLesson,
  selection,
}: {
  binder: Binder;
  color: HighlightColor;
  ownerId?: string | null;
  selectedLesson: BinderLesson;
  selection: LessonTextSelection;
}): Highlight {
  const timestamp = new Date().toISOString();
  return {
    id: `whiteboard-highlight-${crypto.randomUUID()}`,
    owner_id: ownerId ?? "whiteboard-local",
    binder_id: binder.id,
    lesson_id: selectedLesson.id,
    document_id: null,
    source_version_id: null,
    anchor_text: selection.text,
    selected_text: selection.text,
    prefix_text: selection.prefixText ?? null,
    suffix_text: selection.suffixText ?? null,
    selector_json: {
      selectors: [
        {
          type: "TextQuoteSelector",
          exact: selection.text,
          prefix: selection.prefixText,
          suffix: selection.suffixText,
        },
        {
          type: "TextPositionSelector",
          start: selection.startOffset,
          end: selection.endOffset,
        },
      ],
    },
    color,
    note_id: null,
    start_offset: selection.startOffset,
    end_offset: selection.endOffset,
    status: "active",
    reanchor_confidence: 1,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function createWhiteboardComment({
  anchorText,
  binder,
  body,
  ownerId,
  selectedLesson,
}: {
  anchorText: string | null;
  binder: Binder;
  body?: string;
  ownerId?: string | null;
  selectedLesson: BinderLesson;
}): Comment {
  const timestamp = new Date().toISOString();
  return {
    id: `whiteboard-comment-${crypto.randomUUID()}`,
    owner_id: ownerId ?? "whiteboard-local",
    binder_id: binder.id,
    lesson_id: selectedLesson.id,
    anchor_text: anchorText,
    body: body?.trim() || (anchorText ? `Comment on: ${anchorText}` : "Whiteboard note"),
    parent_id: null,
    resolved_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

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

function moduleFrameSignature(moduleElement: WhiteboardModuleElement) {
  return [
    moduleElement.id,
    getWhiteboardModuleAnchorMode(moduleElement),
    moduleElement.x,
    moduleElement.y,
    moduleElement.width,
    moduleElement.height,
    moduleElement.mode,
  ].join(":");
}

function normalizeFloatingToolModule(
  moduleElement: WhiteboardModuleElement,
  floatingTransform: WhiteboardViewportTransform,
) {
  if (!isViewportFloatingWhiteboardModule(moduleElement.moduleId)) {
    return { moduleElement, needsCommit: false };
  }

  const anchorMode = getWhiteboardModuleAnchorMode(moduleElement);
  const minSize = getWhiteboardModuleMinimumSize(moduleElement.moduleId, moduleElement.mode);

  if (anchorMode !== "viewport") {
    return { moduleElement, needsCommit: false };
  }

  const currentScreenFrame = getWhiteboardModuleScreenRect(moduleElement, floatingTransform);
  const preferredFrame = {
    x: currentScreenFrame.x,
    y: currentScreenFrame.y,
    width: Math.max(moduleElement.width, currentScreenFrame.width, minSize.width),
    height: Math.max(moduleElement.height, currentScreenFrame.height, minSize.height),
  };
  const clampedFrame = clampWhiteboardViewportToolFrame(preferredFrame, floatingTransform);
  const normalizedModule: WhiteboardModuleElement = {
    ...moduleElement,
    anchorMode: "viewport",
    pinned: false,
    x: clampedFrame.x,
    y: clampedFrame.y,
    width: clampedFrame.width,
    height: clampedFrame.height,
  };
  const needsCommit =
    moduleElement.pinned !== false ||
    moduleElement.x !== normalizedModule.x ||
    moduleElement.y !== normalizedModule.y ||
    moduleElement.width !== normalizedModule.width ||
    moduleElement.height !== normalizedModule.height;

  return {
    moduleElement: normalizedModule,
    needsCommit,
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

function isSyntheticMathLabSource(moduleElement: Pick<WhiteboardModuleElement, "binderId" | "lessonId">) {
  return moduleElement.binderId === syntheticMathLabBinderId && moduleElement.lessonId === syntheticMathLabLessonId;
}

function scopeSelectionToSource(
  selection: LessonTextSelection,
  binder: Binder,
  lesson: BinderLesson,
): ScopedLessonTextSelection {
  return {
    ...selection,
    binderId: binder.id,
    lessonId: lesson.id,
  };
}

function getSourceLessonModuleContext(
  context: WorkspaceModuleContext,
  moduleElement: WhiteboardModuleElement,
  onChangeModule: (moduleElement: WhiteboardModuleElement) => void,
  onRouteSelectionToNotes?: WhiteboardPinnedObjectLayerProps["onRouteSelectionToNotes"],
): WorkspaceModuleContext {
  if (moduleElement.moduleId === "private-notes") {
    const appendToModuleNote = (text: string) => {
      onChangeModule({
        ...moduleElement,
        noteContent: appendParagraph(moduleElement.noteContent, text),
        updatedAt: new Date().toISOString(),
      });
    };

    return {
      ...context,
      surface: "whiteboard",
      noteTitle: moduleElement.noteTitle ?? moduleElement.title ?? context.noteTitle,
      noteContent: moduleElement.noteContent ?? emptyNoteDoc(),
      autosaveStatus: "saved",
      noteSaveLabel: "Saved with board",
      noteSaveDetail: "This Private Notes card saves with the whiteboard.",
      noteSaveError: null,
      canRetryNoteSave: false,
      hasUnsavedNoteChanges: false,
      onNoteTitleChange: (value: string) =>
        onChangeModule({
          ...moduleElement,
          noteTitle: value,
          title: value.trim() || moduleElement.title,
          updatedAt: new Date().toISOString(),
        }),
      onNoteContentChange: (value: JSONContent) =>
        onChangeModule({
          ...moduleElement,
          noteContent: value,
          updatedAt: new Date().toISOString(),
        }),
      onSaveNoteNow: () => {},
      onRetryNoteSave: () => {},
      onInsertCallout: () => appendToModuleNote("Callout: "),
      onInsertChecklist: () => appendToModuleNote("Checklist:\n- "),
      onInsertDefinition: () => appendToModuleNote("Definition: "),
      onInsertTheorem: () => appendToModuleNote("Theorem: "),
      onInsertProof: () => appendToModuleNote("Proof: "),
      onInsertFormulaReference: () => appendToModuleNote("Formula reference: "),
      onInsertGraphNote: () => appendToModuleNote("Graph observation: "),
      onInsertWorkedExample: () => appendToModuleNote("Worked example: "),
      onInsertMathBlock: () => appendToModuleNote("Math block: "),
      onInsertGraphBlock: () => appendToModuleNote("Graph block: "),
    };
  }

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
  const comments = context.comments ?? [];
  const moduleHighlights = moduleElement.whiteboardHighlights ?? [];
  const moduleComments = moduleElement.whiteboardComments ?? [];
  const conceptNodes = context.conceptNodes ?? [];
  const conceptEdges = context.conceptEdges ?? [];
  const binderConceptNodeIds = new Set(
    conceptNodes.filter((node) => node.binder_id === binder.id).map((node) => node.id),
  );

  return {
    ...context,
    surface: "whiteboard",
    whiteboardModuleId: moduleElement.id,
    binder,
    lessons,
    filteredLessons: lessons,
    selectedLesson,
    comments: [
      ...moduleComments.filter((comment) => comment.binder_id === binder.id && comment.lesson_id === selectedLesson.id),
      ...comments.filter((comment) => comment.binder_id === binder.id && comment.lesson_id === selectedLesson.id),
    ],
    highlights: [
      ...moduleHighlights.filter((highlight) => highlight.binder_id === binder.id && highlight.lesson_id === selectedLesson.id),
      ...highlights.filter((highlight) => {
        if (highlight.binder_id !== binder.id) {
          return false;
        }

        return selectedLesson ? highlight.lesson_id === selectedLesson.id : true;
      }),
    ],
    conceptNodes: conceptNodes.filter((node) => node.binder_id === binder.id),
    conceptEdges: conceptEdges.filter(
      (edge) => binderConceptNodeIds.has(edge.source_id) || binderConceptNodeIds.has(edge.target_id),
    ),
    whiteboardCardDensity: moduleElement.cardDensity ?? "compact",
    whiteboardShowMathInline: moduleElement.showMathInline ?? false,
    whiteboardSourceDisplayMode: moduleElement.sourceDisplayMode ?? "compact",
    whiteboardTextSize: moduleElement.textSize ?? "normal",
    onAddHighlight: (selection: LessonTextSelection, color: HighlightColor) => {
      const highlight = createWhiteboardHighlight({
        binder,
        color,
        ownerId: context.ownerId,
        selectedLesson,
        selection,
      });
      onChangeModule({
        ...moduleElement,
        whiteboardHighlights: [highlight, ...(moduleElement.whiteboardHighlights ?? [])],
        updatedAt: new Date().toISOString(),
      });
    },
    onRemoveHighlight: (selection: LessonTextSelection, highlightIds: string[]) =>
      onChangeModule({
        ...moduleElement,
        whiteboardHighlights: (moduleElement.whiteboardHighlights ?? []).filter(
          (highlight) => !highlightIds.includes(highlight.id),
        ),
        updatedAt: new Date().toISOString(),
      }),
    onPrepareComment: (anchorText?: string | null) => {
      const comment = createWhiteboardComment({
        anchorText: anchorText?.trim() || null,
        binder,
        ownerId: context.ownerId,
        selectedLesson,
      });
      onChangeModule({
        ...moduleElement,
        whiteboardComments: [comment, ...(moduleElement.whiteboardComments ?? [])],
        updatedAt: new Date().toISOString(),
      });
    },
    onAddCommentForSelection: (selection: LessonTextSelection, body: string) => {
      const scopedSelection = scopeSelectionToSource(selection, binder, selectedLesson);
      const comment = createWhiteboardComment({
        anchorText: scopedSelection.text,
        binder,
        body,
        ownerId: context.ownerId,
        selectedLesson,
      });
      onChangeModule({
        ...moduleElement,
        whiteboardComments: [comment, ...(moduleElement.whiteboardComments ?? [])],
        updatedAt: new Date().toISOString(),
      });
    },
    onSendSelectionToNotes: (anchorText?: string) => {
      if (onRouteSelectionToNotes) {
        onRouteSelectionToNotes({
          anchorText,
          prefix: "Source quote",
          sourceModuleId: moduleElement.id,
        });
        return;
      }

      context.onSendSelectionToNotes(anchorText);
    },
    onCreateQuoteExcerpt: (anchorText?: string) => {
      if (onRouteSelectionToNotes) {
        onRouteSelectionToNotes({
          anchorText,
          prefix: "Quote block",
          sourceModuleId: moduleElement.id,
        });
        return;
      }

      context.onCreateQuoteExcerpt(anchorText);
    },
    onSaveSelectionAsEvidence: (selection: LessonTextSelection) =>
      context.onSaveSelectionAsEvidence(scopeSelectionToSource(selection, binder, selectedLesson)),
  };
}

function isSourceConfirmed(moduleElement: WhiteboardModuleElement) {
  if (isSyntheticMathLabSource(moduleElement)) {
    return false;
  }

  return moduleElement.sourceConfirmed ?? Boolean(moduleElement.binderId && moduleElement.lessonId);
}

function getDesmosGraphInstanceId(moduleElement: WhiteboardModuleElement) {
  return moduleElement.graphInstanceId?.trim() || `whiteboard-desmos-${moduleElement.id}`;
}

function WhiteboardScopedDesmosGraphModule({
  context,
  moduleElement,
  renderModule,
}: {
  context: WorkspaceModuleContext;
  moduleElement: WhiteboardModuleElement;
  renderModule: (moduleId: WhiteboardModuleElement["moduleId"], context: WorkspaceModuleContext) => ReactElement | null;
}) {
  const {
    state,
    setGraphExpanded,
    setGraphMode,
    setGraphVisible,
    savedFunctionMap,
    ...mathWorkspace
  } = useMathWorkspace(context.ownerId ?? undefined, getDesmosGraphInstanceId(moduleElement));
  const [snapshotName, setSnapshotName] = useState("");
  const [pendingExpression, setPendingExpression] = useState<GraphExpressionRequest | null>(null);
  const [pendingGraphLoad, setPendingGraphLoad] = useState<GraphLoadRequest | null>(null);

  const pushExpressionToGraph = useCallback(
    (expression?: string) => {
      const latex = prepareExpressionForGraph(expression ?? state.calculatorExpression, savedFunctionMap);
      if (!latex) {
        return;
      }

      setGraphVisible(true);
      setGraphMode("2d");
      setPendingGraphLoad(null);
      setPendingExpression({
        id: crypto.randomUUID(),
        latex,
      });
    },
    [savedFunctionMap, setGraphMode, setGraphVisible, state.calculatorExpression],
  );

  return renderModule(moduleElement.moduleId, {
    ...context,
    surface: "whiteboard",
    mathModules: {
      controller: { state, setGraphExpanded, setGraphMode, setGraphVisible, savedFunctionMap, ...mathWorkspace },
      lessonGraphs: [] as Extract<MathBlock, { type: "graph" }>[],
      pendingGraphLoad,
      pendingExpression,
      snapshotName,
      jumpToGraphSource: () => {},
      loadLessonGraph: () => {},
      setSnapshotName,
      pushExpressionToGraph,
      onExpressionApplied: (id: string) => {
        setPendingExpression((current) => (current?.id === id ? null : current));
      },
      onGraphLoadApplied: (id: string) => {
        setPendingGraphLoad((current) => (current?.id === id ? null : current));
      },
    },
  });
}

function WhiteboardLiveModuleContent({
  context,
  moduleElement,
  renderModule,
}: {
  context: WorkspaceModuleContext;
  moduleElement: WhiteboardModuleElement;
  renderModule: (moduleId: WhiteboardModuleElement["moduleId"], context: WorkspaceModuleContext) => ReactElement | null;
}) {
  if (moduleElement.moduleId === "desmos-graph") {
    return (
      <WhiteboardScopedDesmosGraphModule
        context={context}
        moduleElement={moduleElement}
        renderModule={renderModule}
      />
    );
  }

  return renderModule(moduleElement.moduleId, context);
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
  const initialBinderId = isSyntheticMathLabSource(moduleElement) ? undefined : moduleElement.binderId;
  const initialLessonId = isSyntheticMathLabSource(moduleElement) ? undefined : moduleElement.lessonId;
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() => {
    if (!library) {
      return null;
    }

    return (
      library.folderBinders.find((link) => link.binder_id === initialBinderId)?.folder_id ??
      library.folders[0]?.id ??
      null
    );
  });
  const [selectedBinderId, setSelectedBinderId] = useState<string | null>(() => initialBinderId ?? null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(() => initialLessonId ?? null);

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
  const activeLesson =
    activeLessons.find((lesson) => lesson.id === selectedLessonId) ??
    activeLessons.find((lesson) => lesson.id === moduleElement.lessonId) ??
    activeLessons[0] ??
    null;

  const confirmModuleLesson = () => {
    if (!activeBinder) {
      return;
    }

    onChangeModule({
      ...moduleElement,
      binderId: activeBinder.id,
      lessonId: activeLesson?.id,
      sourceConfirmed: true,
      title: activeLesson?.title ?? activeBinder.title,
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
                const firstLesson = firstBinderId
                  ? sortLessonsByOrder(library.lessons.filter((lesson) => lesson.binder_id === firstBinderId))[0] ?? null
                  : null;
                setSelectedLessonId(firstLesson?.id ?? null);
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
                setSelectedLessonId(sortLessonsByOrder(library.lessons.filter((lesson) => lesson.binder_id === binder.id))[0]?.id ?? null);
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
                lesson.id === activeLesson?.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              key={lesson.id}
              onClick={() => setSelectedLessonId(lesson.id)}
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

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <p className="min-w-0 truncate text-[11px] text-muted-foreground">
          {activeBinder ? activeBinder.title : "Choose a binder"}
          {activeLesson ? ` / ${activeLesson.title}` : ""}
        </p>
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          disabled={!activeBinder}
          onClick={confirmModuleLesson}
          type="button"
        >
          Use this lesson
        </button>
      </div>
    </div>
  );
}

function WhiteboardSourceSummary({
  binder,
  lesson,
  onEdit,
}: {
  binder: Binder;
  lesson: BinderLesson;
  onEdit: () => void;
}) {
  return (
    <div
      className="whiteboard-source-summary mb-2 flex items-center justify-between gap-2 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground"
      data-testid="whiteboard-source-summary"
    >
      <span className="min-w-0 truncate">
        <span className="font-semibold">{lesson.title}</span>
        <span className="text-muted-foreground"> / {binder.title}</span>
      </span>
      <button className="shrink-0 font-semibold text-primary hover:underline" onClick={onEdit} type="button">
        Change
      </button>
    </div>
  );
}

function WhiteboardFormulaSheetLauncher({
  lesson,
  onOpen,
}: {
  lesson: BinderLesson;
  onOpen: () => void;
}) {
  const mathBlocks = lesson.math_blocks ?? [];
  if (mathBlocks.length === 0) {
    return null;
  }

  return (
    <button
      className="whiteboard-formula-sheet-button mt-2 flex w-full items-center justify-between gap-3 rounded-md border border-primary/35 bg-primary/10 px-3 py-2 text-left text-xs text-foreground transition hover:border-primary hover:bg-primary/15"
      onClick={onOpen}
      type="button"
    >
      <span>
        <span className="block font-semibold">Formula Sheet</span>
        <span className="block text-muted-foreground">{mathBlocks.length} math blocks ready</span>
      </span>
      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
        Open
      </span>
    </button>
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
  onAddLinkedModule,
  onChangeModule,
  onRemoveModule,
  onRouteSelectionToNotes,
  renderLayer,
  renderModule,
  testId,
  viewportTransform = defaultWhiteboardViewportTransform,
}: WhiteboardObjectOverlayProps) {
  return (
    <div className={className} data-testid={testId}>
      {modules.map((moduleElement) => {
        const embeddedContext = getSourceLessonModuleContext(
          context,
          moduleElement,
          onChangeModule,
          onRouteSelectionToNotes,
        );
        const sourceScoped = lessonScopedWhiteboardModules.has(moduleElement.moduleId);
        const confirmedSource = sourceScoped ? isSourceConfirmed(moduleElement) : true;
        const definition = getWhiteboardModuleDefinition(moduleElement.moduleId);
        const alwaysLive = isAlwaysLiveWhiteboardModule(moduleElement.moduleId);
        const visible = alwaysLive ? true : isWhiteboardModuleVisibleInViewport(moduleElement, viewportTransform);
        const presentation = getEmbeddedModulePresentation(moduleElement, viewportTransform, visible);
        const live =
          presentation === "live" &&
          shouldRenderWhiteboardModuleLive(moduleElement, { visible });
        const liveContent =
          live && confirmedSource ? (
            <WhiteboardLiveModuleContent
              context={embeddedContext}
              moduleElement={moduleElement}
              renderModule={renderModule}
            />
          ) : null;
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
            onEditSource={
              sourceScoped
                ? () =>
                    onChangeModule({
                      ...moduleElement,
                      sourceConfirmed: false,
                      updatedAt: new Date().toISOString(),
                    })
                : undefined
            }
            onOpenFormulaSheet={
              moduleElement.moduleId === "lesson" && (embeddedContext.selectedLesson?.math_blocks?.length ?? 0) > 0
                ? () =>
                    onAddLinkedModule?.({
                      moduleId: "formula-sheet",
                      binderId: embeddedContext.binder.id,
                      lessonId: embeddedContext.selectedLesson.id,
                      title: `${embeddedContext.selectedLesson.title} formulas`,
                    })
                : undefined
            }
            onRemove={onRemoveModule}
            onResetSource={
              sourceScoped
                ? () =>
                    onChangeModule({
                      ...moduleElement,
                      binderId: undefined,
                      lessonId: undefined,
                      sourceConfirmed: false,
                      title: definition?.label ?? moduleElement.title,
                      updatedAt: new Date().toISOString(),
                    })
                : undefined
            }
            presentation={presentation}
            renderLayer={renderLayer}
            getViewportTransform={getViewportTransform}
            viewportTransform={viewportTransform}
          >
            {sourceScoped && !confirmedSource ? (
              <WhiteboardSourceLessonPicker
                context={context}
                moduleElement={moduleElement}
                onChangeModule={onChangeModule}
              />
            ) : null}
            {sourceScoped && confirmedSource && embeddedContext.selectedLesson ? (
              <WhiteboardSourceSummary
                binder={embeddedContext.binder}
                lesson={embeddedContext.selectedLesson}
                onEdit={() =>
                  onChangeModule({
                    ...moduleElement,
                    sourceConfirmed: false,
                    updatedAt: new Date().toISOString(),
                  })
                }
              />
            ) : null}
            {confirmedSource && liveContent ? liveContent : confirmedSource ? (
              <EmptyState
                description={previewDescription}
                title={definition?.label ?? moduleElement.title ?? "BinderNotes module"}
              />
            ) : null}
            {moduleElement.moduleId === "lesson" && confirmedSource && embeddedContext.selectedLesson ? (
              <WhiteboardFormulaSheetLauncher
                lesson={embeddedContext.selectedLesson}
                onOpen={() =>
                  onAddLinkedModule?.({
                    moduleId: "formula-sheet",
                    binderId: embeddedContext.binder.id,
                    lessonId: embeddedContext.selectedLesson.id,
                    title: `${embeddedContext.selectedLesson.title} formulas`,
                  })
                }
              />
            ) : null}
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
  onAddLinkedModule,
  renderModule,
  onChangeModule,
  onRemoveModule,
  onRouteSelectionToNotes,
  viewportTransform = defaultWhiteboardViewportTransform,
}: WhiteboardPinnedObjectLayerProps) {
  const normalizedFloatingCommitRef = useRef(new Set<string>());
  const maxZIndex = modules.reduce((max, moduleElement) => Math.max(max, moduleElement.zIndex), 0);
  const pinnedTransform = getLayerTransform(viewportTransform, fixed);
  const floatingTransform = useMemo(
    () => getFloatingTransform(viewportTransform),
    [viewportTransform.viewportWidth, viewportTransform.viewportHeight],
  );
  const floatingNormalizationResults = useMemo(
    () =>
      modules.map((moduleElement) => normalizeFloatingToolModule(moduleElement, floatingTransform)),
    [floatingTransform, modules],
  );
  const normalizedModules = useMemo(
    () => floatingNormalizationResults.map((result) => result.moduleElement),
    [floatingNormalizationResults],
  );
  const boardModules = useMemo(
    () =>
      normalizedModules.filter(
        (moduleElement) => getWhiteboardModuleAnchorMode(moduleElement) !== "viewport",
      ),
    [normalizedModules],
  );
  const viewportModules = useMemo(
    () =>
      normalizedModules.filter((moduleElement) => getWhiteboardModuleAnchorMode(moduleElement) === "viewport"),
    [normalizedModules],
  );
  const pendingFloatingNormalizations = useMemo(
    () => floatingNormalizationResults.filter((result) => result.needsCommit),
    [floatingNormalizationResults],
  );

  useEffect(() => {
    pendingFloatingNormalizations.forEach((result) => {
      const signature = moduleFrameSignature(result.moduleElement);
      if (normalizedFloatingCommitRef.current.has(signature)) {
        return;
      }
      normalizedFloatingCommitRef.current.add(signature);
      onChangeModule({
        ...result.moduleElement,
        updatedAt: new Date().toISOString(),
      });
    });
  }, [onChangeModule, pendingFloatingNormalizations]);

  return (
    <div
      className={cn("pointer-events-none inset-0 z-[55]", fixed ? "fixed" : "absolute")}
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
        onAddLinkedModule={onAddLinkedModule}
        onChangeModule={onChangeModule}
        onRemoveModule={onRemoveModule}
        onRouteSelectionToNotes={onRouteSelectionToNotes}
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
        modules={[]}
        onAddLinkedModule={onAddLinkedModule}
        onChangeModule={onChangeModule}
        onRemoveModule={onRemoveModule}
        onRouteSelectionToNotes={onRouteSelectionToNotes}
        renderModule={renderModule}
        renderLayer="viewport"
        testId="whiteboard-floating-board-tool-overlay"
        getViewportTransform={getViewportTransform}
        viewportTransform={pinnedTransform}
      />
      <WhiteboardViewportToolOverlay
        className="pointer-events-none absolute inset-0"
        context={context}
        maxZIndex={maxZIndex}
        modules={viewportModules}
        onAddLinkedModule={onAddLinkedModule}
        onChangeModule={onChangeModule}
        onRemoveModule={onRemoveModule}
        onRouteSelectionToNotes={onRouteSelectionToNotes}
        renderModule={renderModule}
        renderLayer="viewport"
        testId="whiteboard-viewport-tool-overlay"
        getViewportTransform={getViewportTransform}
        viewportTransform={floatingTransform}
      />
    </div>
  );
}
