import { useState } from "react";
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
import { useMathWorkspace } from "@/hooks/use-math-workspace";
import { prepareExpressionForGraph } from "@/lib/scientific-calculator";
import { emptyDoc } from "@/lib/utils";
import type {
  Binder,
  BinderLesson,
  MathBlock,
  SaveStatusSnapshot,
  WorkspaceModuleId,
} from "@/types";

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

  const whiteboardContext: WorkspaceModuleContext = {
    ownerId: profile.id,
    binder: mathLabBinder,
    lessons: [mathLabLesson],
    selectedLesson: mathLabLesson,
    filteredLessons: [mathLabLesson],
    binderNotebookEntries: [],
    binderNotebookSections: [],
    currentNotebookSection: null,
    query: "",
    noteTitle,
    noteContent,
    noteMath,
    commentDraft: "",
    commentAnchor: null,
    comments: [],
    highlights: [],
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
    hasUnsavedNoteChanges: false,
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
    onNoteContentChange: setNoteContent,
    onNoteMathChange: setNoteMath,
    onCommentDraftChange: () => {},
    onSaveNoteNow: () => {},
    onRetryNoteSave: () => {},
    onPrepareComment: () => {},
    onClearPreparedComment: () => {},
    onAddComment: () => {},
    onCreateLooseSticky: () => {},
    onToggleStickyManager: () => {},
    onDeleteComment: () => {},
    onUpdateComment: () => {},
    onAddHighlight: () => {},
    onRemoveHighlight: () => {},
    onSaveSelectionAsEvidence: () => {},
    onStickyMove: () => {},
    onSendStickyToNotes: () => {},
    onAcceptMathSuggestion: () => {},
    onGraphMathSuggestion: () => {},
    onDismissMathSuggestion: () => {},
    onSendSelectionToNotes: () => {},
    onCreateQuoteExcerpt: () => {},
    onInsertCallout: () => {},
    onInsertChecklist: () => {},
    onInsertDefinition: () => {},
    onInsertTheorem: () => {},
    onInsertProof: () => {},
    onInsertFormulaReference: () => {},
    onInsertGraphNote: () => {},
    onInsertWorkedExample: () => {},
    onInsertMathBlock: () => {},
    onInsertGraphBlock: () => {},
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
