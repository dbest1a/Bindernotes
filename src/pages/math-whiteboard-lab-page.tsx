import { useCallback, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { Navigate, useNavigate } from "react-router-dom";
import type {
  GraphExpressionRequest,
  GraphLoadRequest,
} from "@/components/math/math-workspace-modules";
import { WhiteboardModule } from "@/components/whiteboard/whiteboard-module";
import {
  type WorkspaceModuleContext,
  workspaceModuleRegistry,
} from "@/components/workspace/workspace-modules";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/hooks/use-binders";
import { useMathWorkspace } from "@/hooks/use-math-workspace";
import { prepareExpressionForGraph } from "@/lib/scientific-calculator";
import { emptyDoc } from "@/lib/utils";
import type {
  Binder,
  BinderLesson,
  Comment,
  Highlight,
  HighlightColor,
  LessonTextSelection,
  MathBlock,
  SaveStatusSnapshot,
  WorkspaceModuleId,
} from "@/types";

type ScopedLessonTextSelection = LessonTextSelection & {
  binderId?: string;
  lessonId?: string;
};

const mathLabTimestamp = new Date(0).toISOString();

const mathLabBinder: Binder = {
  id: "math-lab",
  owner_id: "system",
  title: "Math Lab",
  slug: "math-lab",
  description: "A BinderNotes math scratch workspace.",
  subject: "Math",
  level: "Open lab",
  status: "published",
  price_cents: 0,
  cover_url: null,
  pinned: false,
  created_at: mathLabTimestamp,
  updated_at: mathLabTimestamp,
};

const mathLabLesson: BinderLesson = {
  id: "math-lab-whiteboard",
  binder_id: "math-lab",
  title: "Math Whiteboard Lab",
  order_index: 1,
  content: emptyDoc(
    "Use this lab as scratch paper for equations, graph ideas, proofs, and notes before moving work into a binder lesson.",
  ),
  math_blocks: [],
  is_preview: false,
  created_at: mathLabTimestamp,
  updated_at: mathLabTimestamp,
};

const savedStatus: SaveStatusSnapshot = {
  state: "saved",
  detail: "Local lab draft",
  lastSavedAt: null,
  error: null,
};

function appendParagraph(content: JSONContent, text: string): JSONContent {
  const cleanText = text.trim();
  if (!cleanText) {
    return content;
  }

  return {
    type: "doc",
    content: [
      ...((content.content as JSONContent[] | undefined) ?? []),
      {
        type: "paragraph",
        content: [{ type: "text", text: cleanText }],
      },
    ],
  };
}

function getSelectionSourceScope(selection: ScopedLessonTextSelection) {
  return {
    binderId: selection.binderId ?? mathLabBinder.id,
    lessonId: selection.lessonId ?? mathLabLesson.id,
  };
}

export function MathWhiteboardLabPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    state,
    setGraphExpanded,
    setGraphMode,
    setGraphVisible,
    savedFunctionMap,
    ...mathWorkspace
  } = useMathWorkspace(profile?.id, "math-lab");
  const [snapshotName, setSnapshotName] = useState("");
  const [pendingExpression, setPendingExpression] = useState<GraphExpressionRequest | null>(null);
  const [pendingGraphLoad, setPendingGraphLoad] = useState<GraphLoadRequest | null>(null);
  const [noteTitle, setNoteTitle] = useState("Math Lab scratch notes");
  const [noteContent, setNoteContent] = useState<JSONContent>(() => emptyDoc());
  const [noteMath, setNoteMath] = useState<MathBlock[]>([]);
  const [hasUnsavedNoteChanges, setHasUnsavedNoteChanges] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentAnchor, setCommentAnchor] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const dashboardQuery = useDashboard(profile, {
    enabled: Boolean(profile),
    includeSystemStatus: false,
  });

  if (!profile) {
    return <Navigate replace to="/auth?next=%2Fmath%2Flab%2Fwhiteboard" />;
  }

  const pushExpressionToGraph = (expression?: string) => {
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
  };

  const bindings = {
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
  };

  const updateNoteContent = useCallback((value: JSONContent) => {
    setNoteContent(value);
    setHasUnsavedNoteChanges(true);
  }, []);

  const createComment = useCallback(
    (anchorText: string | null, body?: string) => {
      const timestamp = new Date().toISOString();
      const nextBody = body?.trim() || (anchorText ? `Comment on: ${anchorText}` : "Whiteboard note");
      setComments((current) => [
        {
          id: `whiteboard-comment-${crypto.randomUUID()}`,
          owner_id: profile.id,
          binder_id: mathLabBinder.id,
          lesson_id: mathLabLesson.id,
          anchor_text: anchorText,
          body: nextBody,
          parent_id: null,
          resolved_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        },
        ...current,
      ]);
    },
    [profile.id],
  );

  const handlePrepareComment = useCallback(
    (anchorText?: string | null) => {
      const anchor = anchorText?.trim() || null;
      setCommentAnchor(anchor);
      setCommentDraft(anchor ? `Comment on: ${anchor}` : "Whiteboard note");
      createComment(anchor);
    },
    [createComment],
  );

  const handleAddComment = useCallback(() => {
    createComment(commentAnchor, commentDraft);
    setCommentDraft("");
    setCommentAnchor(null);
  }, [commentAnchor, commentDraft, createComment]);

  const handleAddHighlight = useCallback(
    (selection: LessonTextSelection, color: HighlightColor) => {
      const scopedSelection = selection as ScopedLessonTextSelection;
      const scope = getSelectionSourceScope(scopedSelection);
      const timestamp = new Date().toISOString();
      setHighlights((current) => [
        {
          id: `whiteboard-highlight-${crypto.randomUUID()}`,
          owner_id: profile.id,
          binder_id: scope.binderId,
          lesson_id: scope.lessonId,
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
        },
        ...current,
      ]);
    },
    [profile.id],
  );

  const handleRemoveHighlight = useCallback((_selection: LessonTextSelection, highlightIds: string[]) => {
    setHighlights((current) => current.filter((highlight) => !highlightIds.includes(highlight.id)));
  }, []);

  const appendSelectionToNotes = useCallback((anchorText?: string, prefix = "Source quote") => {
    const text = anchorText?.trim();
    if (!text) {
      return;
    }
    setNoteContent((current) => appendParagraph(current, `${prefix}: ${text}`));
    setHasUnsavedNoteChanges(true);
  }, []);

  const appendToolBlockToNotes = useCallback((text: string) => {
    setNoteContent((current) => appendParagraph(current, text));
    setHasUnsavedNoteChanges(true);
  }, []);

  const whiteboardContext: WorkspaceModuleContext = {
    ownerId: profile.id,
    binder: mathLabBinder,
    lessons: [mathLabLesson],
    selectedLesson: mathLabLesson,
    filteredLessons: [mathLabLesson],
    binderNotebookEntries: [],
    binderNotebookSections: [],
    currentNotebookSection: null,
    library: {
      folders: dashboardQuery.data?.folders ?? [],
      folderBinders: dashboardQuery.data?.folderBinders ?? [],
      binders: dashboardQuery.data?.binders ?? [],
      lessons: dashboardQuery.data?.lessons ?? [],
      loading: dashboardQuery.isLoading,
      error: dashboardQuery.error instanceof Error ? dashboardQuery.error.message : null,
    },
    query: "",
    noteTitle,
    noteContent,
    noteMath,
    commentDraft,
    commentAnchor,
    comments,
    highlights,
    defaultHighlightColor: "yellow",
    conceptNodes: [],
    conceptEdges: [],
    stickyLayouts: {},
    mathSuggestions: [],
    isSetupMode: false,
    workspaceStyle: "full-studio",
    autosaveStatus: "saved",
    highlightStatus: savedStatus,
    noteSaveLabel: "Local lab draft",
    noteSaveDetail: "Whiteboard lab notes stay in this local review session.",
    noteSaveError: null,
    canRetryNoteSave: false,
    noteInsertRequest: null,
    mathModules: bindings,
    stickyManagerVisible: false,
    hasUnsavedNoteChanges,
    history: {
      enabled: false,
      seedHealthMessage: null,
      templateEvents: [],
      events: [],
      templateSources: [],
      sources: [],
      evidenceCards: [],
      argumentChains: [],
      argumentNodes: [],
      argumentEdges: [],
      templateMythChecks: [],
      mythChecks: [],
      activeEventId: null,
      activeSourceId: null,
      status: {
        timeline: savedStatus,
        evidence: savedStatus,
        argument: savedStatus,
        myth: savedStatus,
      },
    },
    onApplyPreset: () => {},
    onEnterNotebookFocus: () => {},
    onSelectLesson: () => {},
    onQueryChange: () => {},
    onNoteTitleChange: setNoteTitle,
    onNoteContentChange: updateNoteContent,
    onNoteMathChange: (value) => {
      setNoteMath(value);
      setHasUnsavedNoteChanges(true);
    },
    onCommentDraftChange: setCommentDraft,
    onSaveNoteNow: () => setHasUnsavedNoteChanges(false),
    onRetryNoteSave: () => {},
    onPrepareComment: handlePrepareComment,
    onClearPreparedComment: () => {
      setCommentAnchor(null);
      setCommentDraft("");
    },
    onAddComment: handleAddComment,
    onCreateLooseSticky: () => createComment(null, "Whiteboard note"),
    onToggleStickyManager: () => {},
    onDeleteComment: (commentId) => {
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    },
    onUpdateComment: (commentId, body) => {
      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                body,
                updated_at: new Date().toISOString(),
              }
            : comment,
        ),
      );
    },
    onAddHighlight: handleAddHighlight,
    onRemoveHighlight: handleRemoveHighlight,
    onSaveSelectionAsEvidence: () => {},
    onStickyMove: () => {},
    onSendStickyToNotes: (comment) => appendSelectionToNotes(comment.anchor_text ?? comment.body, "Sticky note"),
    onAcceptMathSuggestion: () => {},
    onGraphMathSuggestion: () => {},
    onDismissMathSuggestion: () => {},
    onSendSelectionToNotes: (anchorText) => appendSelectionToNotes(anchorText, "Source quote"),
    onCreateQuoteExcerpt: (anchorText) => appendSelectionToNotes(anchorText, "Quote block"),
    onInsertCallout: () => appendToolBlockToNotes("Callout: "),
    onInsertChecklist: () => appendToolBlockToNotes("Checklist:\n- "),
    onInsertDefinition: () => appendToolBlockToNotes("Definition: "),
    onInsertTheorem: () => appendToolBlockToNotes("Theorem: "),
    onInsertProof: () => appendToolBlockToNotes("Proof: "),
    onInsertFormulaReference: () => appendToolBlockToNotes("Formula reference: "),
    onInsertGraphNote: () => appendToolBlockToNotes("Graph observation: "),
    onInsertWorkedExample: () => appendToolBlockToNotes("Worked example: "),
    onInsertMathBlock: () => appendToolBlockToNotes("Math block: "),
    onInsertGraphBlock: () => appendToolBlockToNotes("Graph block: "),
    onNoteInsertApplied: () => {},
    onJumpToHighlight: () => {},
    onJumpToMathSource: () => {},
    onOpenGraphBlock: () => {},
    onSelectHistoryEvent: () => {},
    onSelectHistorySource: () => {},
    onReplayHistoryTimeline: () => {},
    onCreateHistoryStarterEvent: () => {},
    onCreateHistoryEvidenceFromSource: () => {},
    onUseHistorySourceInArgument: () => {},
    onCreateHistoryStarterChain: () => {},
    onUpdateHistoryArgumentChain: () => {},
    onUseHistoryEvidencePrompt: () => {},
    onCreateHistoryMythCheck: () => {},
  };

  const renderWhiteboardModule = (moduleId: WorkspaceModuleId, embeddedContext: WorkspaceModuleContext) => {
    if (moduleId === "whiteboard") {
      return null;
    }

    return workspaceModuleRegistry[moduleId]?.render(embeddedContext) ?? null;
  };

  return (
    <WhiteboardModule
      context={whiteboardContext}
      onBack={() => navigate("/math/lab")}
      renderModule={renderWhiteboardModule}
      variant="lab"
    />
  );
}
