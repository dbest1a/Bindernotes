import { Clock3, FlaskConical, ListChecks, Pin, Search, Send, Sparkles, StickyNote, X } from "lucide-react";
import { Suspense, lazy, useMemo, type ReactElement, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";
import type { MathWorkspaceModuleBindings } from "@/components/math/math-workspace-modules";
import {
  BinderNotebookModule,
  PrivateNotesModule,
  SourceLessonModule,
} from "@/components/workspace/study-core-modules";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { MathSuggestion } from "@/lib/math-detection";
import type { NoteInsertRequest } from "@/lib/note-blocks";
import type {
  Binder,
  BinderLesson,
  BinderNotebookLessonEntry,
  BinderNotebookSection,
  Comment,
  ConceptEdge,
  ConceptNode,
  Folder,
  FolderBinderLink,
  HistoryArgumentChain,
  HistoryArgumentEdge,
  HistoryArgumentNode,
  HistoryEvidenceCard,
  HistoryEvent,
  HistoryEventTemplate,
  HistoryMythCheck,
  HistoryMythCheckTemplate,
  HistorySource,
  HistorySourceTemplate,
  Highlight,
  HighlightColor,
  LessonTextSelection,
  MathBlock,
  SaveStatusSnapshot,
  StickyNoteLayout,
  WorkspaceModuleId,
  WorkspacePresetId,
  WorkspaceStyle,
} from "@/types";

const LazyDesmosGraphModule = lazy(() =>
  import("@/components/math/math-workspace-modules").then((module) => ({ default: module.DesmosGraphModule })),
);
const LazySavedGraphsModule = lazy(() =>
  import("@/components/math/math-workspace-modules").then((module) => ({ default: module.SavedGraphsModule })),
);
const LazyScientificCalculatorModule = lazy(() =>
  import("@/components/math/math-workspace-modules").then((module) => ({
    default: module.ScientificCalculatorModule,
  })),
);
const LazyHistoryTimelineModule = lazy(() =>
  import("@/components/history/history-suite-modules").then((module) => ({
    default: module.HistoryTimelineModule,
  })),
);
const LazySourceEvidenceModule = lazy(() =>
  import("@/components/history/history-suite-modules").then((module) => ({
    default: module.SourceEvidenceModule,
  })),
);
const LazyArgumentBuilderModule = lazy(() =>
  import("@/components/history/history-suite-modules").then((module) => ({
    default: module.ArgumentBuilderModule,
  })),
);
const LazyMythHistoryModule = lazy(() =>
  import("@/components/history/history-suite-modules").then((module) => ({ default: module.MythHistoryModule })),
);
const LazyMathBlocks = lazy(() =>
  import("@/components/math/math-blocks").then((module) => ({ default: module.MathBlocks })),
);
const LazyWhiteboardModule = lazy(() =>
  import("@/components/whiteboard/whiteboard-module").then((module) => ({ default: module.WhiteboardModule })),
);
const LazyChemistryStoichiometryCoachModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryStoichiometryCoachModule,
  })),
);
const LazyChemistryLabCoachModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryLabCoachModule,
  })),
);
const LazyChemistryTitrationLabModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryTitrationLabModule,
  })),
);
const LazyChemistryLabNotebookModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryLabNotebookModule,
  })),
);
const LazyChemistryReferenceSafetyModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryReferenceSafetyModule,
  })),
);
const LazyInteractivePeriodicTableModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.InteractivePeriodicTableModule,
  })),
);
const LazyElementBuilderModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ElementBuilderModule,
  })),
);
const LazyElectronConfigurationBuilderModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ElectronConfigurationBuilderModule,
  })),
);
const LazyPeriodicTrendsGraphModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.PeriodicTrendsGraphModule,
  })),
);
const LazyMoleculeLewisBuilderModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.MoleculeLewisBuilderModule,
  })),
);
const LazyReactionBalancerModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ReactionBalancerModule,
  })),
);
const LazyTriRepresentationReactionViewModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.TriRepresentationReactionViewModule,
  })),
);
const LazyChemistryMolarMassCalculatorModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryMolarMassCalculatorModule,
  })),
);
const LazySolutionMixerModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.SolutionMixerModule,
  })),
);
const LazyAcidBaseCalculatorModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.AcidBaseCalculatorModule,
  })),
);
const LazyChemistryGraphModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryGraphModule,
  })),
);
const LazyKineticsSimulatorModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.KineticsSimulatorModule,
  })),
);
const LazyThermochemistryModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ThermochemistryModule,
  })),
);
const LazyChemistryConceptCardsModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryConceptCardsModule,
  })),
);
const LazyChemistryQuickToolsModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryQuickToolsModule,
  })),
);
const LazySafetyReagentCardsModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.SafetyReagentCardsModule,
  })),
);
const LazyChemistryChallengeReviewModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryChallengeReviewModule,
  })),
);
const LazyChemistryDataTableModule = lazy(() =>
  import("@/components/chemistry/chemistry-workspace-modules").then((module) => ({
    default: module.ChemistryDataTableModule,
  })),
);
const LazyRecallLab = lazy(() =>
  import("@/components/workspace/recall-lab").then((module) => ({ default: module.RecallLab })),
);

export type WorkspaceLibraryContext = {
  folders: Folder[];
  folderBinders: FolderBinderLink[];
  binders: Binder[];
  lessons: BinderLesson[];
  loading?: boolean;
  error?: string | null;
};

export type WorkspaceModuleContext = {
  surface?: "workspace" | "whiteboard";
  whiteboardModuleId?: string;
  ownerId?: string | null;
  library?: WorkspaceLibraryContext;
  binder: Binder;
  lessons: BinderLesson[];
  selectedLesson: BinderLesson;
  filteredLessons: BinderLesson[];
  binderNotebookEntries: BinderNotebookLessonEntry[];
  binderNotebookSections: BinderNotebookSection[];
  currentNotebookSection: BinderNotebookSection | null;
  query: string;
  noteTitle: string;
  noteId?: string;
  noteContent: JSONContent;
  noteMath: MathBlock[];
  commentDraft: string;
  commentAnchor: string | null;
  comments: Comment[];
  highlights: Highlight[];
  defaultHighlightColor: HighlightColor;
  conceptNodes: ConceptNode[];
  conceptEdges: ConceptEdge[];
  stickyLayouts: Record<string, StickyNoteLayout>;
  mathSuggestions: MathSuggestion[];
  isSetupMode: boolean;
  workspaceStyle: WorkspaceStyle;
  autosaveStatus: "saved" | "saving" | "unsaved" | "offline" | "error";
  highlightStatus: SaveStatusSnapshot;
  noteSaveLabel: string;
  noteSaveDetail: string;
  noteSaveError: string | null;
  canRetryNoteSave: boolean;
  noteInsertRequest: NoteInsertRequest | null;
  mathModules?: MathWorkspaceModuleBindings;
  whiteboardSourceDisplayMode?: "compact" | "full" | "summary" | "header-hidden";
  whiteboardCardDensity?: "compact" | "comfortable";
  whiteboardTextSize?: "small" | "normal" | "large";
  whiteboardShowMathInline?: boolean;
  whiteboardSidebarDefaultCollapsed?: boolean;
  compactWhiteboardTools?: boolean;
  canvasStarterLayouts?: boolean;
  graphKeypad?: boolean;
  mathPerformanceLazyLoading?: boolean;
  recallLabEnabled?: boolean;
  reviewQueueBeta?: boolean;
  sourceLinkedNotesBeta?: boolean;
  studentCalmMode?: boolean;
  studyPanelsV2?: boolean;
  onEnterWhiteboardFocus?: () => void;
  onExitWhiteboardFocus?: () => void;
  stickyManagerVisible: boolean;
  hasUnsavedNoteChanges: boolean;
  history: {
    enabled: boolean;
    seedHealthMessage: string | null;
    templateEvents: HistoryEventTemplate[];
    events: HistoryEvent[];
    templateSources: HistorySourceTemplate[];
    sources: HistorySource[];
    evidenceCards: HistoryEvidenceCard[];
    argumentChains: HistoryArgumentChain[];
    argumentNodes: HistoryArgumentNode[];
    argumentEdges: HistoryArgumentEdge[];
    templateMythChecks: HistoryMythCheckTemplate[];
    mythChecks: HistoryMythCheck[];
    activeEventId: string | null;
    activeSourceId: string | null;
    status: {
      timeline: SaveStatusSnapshot;
      evidence: SaveStatusSnapshot;
      argument: SaveStatusSnapshot;
      myth: SaveStatusSnapshot;
    };
  };
  onApplyPreset: (presetId: WorkspacePresetId) => void;
  onEnterNotebookFocus: () => void;
  onSelectLesson: (lesson: BinderLesson) => void;
  onQueryChange: (query: string) => void;
  onNoteTitleChange: (value: string) => void;
  onNoteContentChange: (value: JSONContent) => void;
  onNoteMathChange: (value: MathBlock[]) => void;
  onCommentDraftChange: (value: string) => void;
  onSaveNoteNow: () => void;
  onRetryNoteSave: () => void;
  onPrepareComment: (anchorText?: string | null) => void;
  onClearPreparedComment: () => void;
  onAddComment: () => void;
  onAddCommentForSelection?: (selection: LessonTextSelection, body: string) => void;
  onCreateLooseSticky: () => void;
  onToggleStickyManager: () => void;
  onDeleteComment: (commentId: string) => void;
  onUpdateComment: (commentId: string, body: string) => void;
  onAddHighlight: (selection: LessonTextSelection, color: HighlightColor) => void;
  onAddSelectionToReview?: (selection: LessonTextSelection) => void;
  onRemoveHighlight: (selection: LessonTextSelection, highlightIds: string[]) => void;
  onSaveSelectionAsEvidence: (selection: LessonTextSelection) => void;
  onStickyMove: (commentId: string, layout: StickyNoteLayout) => void;
  onSendStickyToNotes: (comment: Comment) => void;
  onAcceptMathSuggestion: (suggestion: MathSuggestion) => void;
  onGraphMathSuggestion: (suggestion: MathSuggestion) => void;
  onDismissMathSuggestion: (key: string) => void;
  onSendSelectionToNotes: (anchorText?: string) => void;
  onCreateQuoteExcerpt: (anchorText?: string) => void;
  onInsertCallout: () => void;
  onInsertChecklist: () => void;
  onInsertDefinition: () => void;
  onInsertTheorem: () => void;
  onInsertProof: () => void;
  onInsertFormulaReference: () => void;
  onInsertGraphNote: () => void;
  onInsertWorkedExample: () => void;
  onInsertMathBlock: () => void;
  onInsertGraphBlock: () => void;
  onNoteInsertApplied: (id: string) => void;
  onJumpToHighlight: (highlightId: string) => void;
  onJumpToMathSource: (block: MathBlock) => void;
  onOpenGraphBlock: (block: Extract<MathBlock, { type: "graph" }>) => void;
  onSelectHistoryEvent: (eventId: string) => void;
  onSelectHistorySource: (sourceId: string) => void;
  onReplayHistoryTimeline: () => void;
  onCreateHistoryStarterEvent: () => void;
  onCreateHistoryEvidenceFromSource: (source: HistorySourceTemplate | HistorySource) => void;
  onUseHistorySourceInArgument: (sourceId: string) => void;
  onCreateHistoryStarterChain: () => void;
  onUpdateHistoryArgumentChain: (
    chainId: string,
    patch: Partial<
      Pick<HistoryArgumentChain, "prompt" | "thesis" | "context" | "counterargument" | "conclusion">
    >,
  ) => void;
  onUseHistoryEvidencePrompt: () => void;
  onCreateHistoryMythCheck: () => void;
  onOpenWorkspaceTool?: (moduleId: WorkspaceModuleId) => void;
};

type WorkspaceModuleDefinition = {
  id: WorkspaceModuleId;
  title: string;
  description: string;
  render: (context: WorkspaceModuleContext) => ReactElement;
};

function LazyModuleBoundary({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Suspense
      fallback={
        <WorkspacePanel description="Loading this workspace module." title={title}>
          <div className="grid min-h-[180px] place-items-center text-sm text-muted-foreground">
            Loading module...
          </div>
        </WorkspacePanel>
      }
    >
      {children}
    </Suspense>
  );
}

export const workspaceModuleRegistry: Record<WorkspaceModuleId, WorkspaceModuleDefinition> = {
  lesson: {
    id: "lesson",
    title: "Source lesson",
    description: "Published study source",
    render: (context) => (
      <SourceLessonModule
        binder={context.binder}
        defaultHighlightColor={context.defaultHighlightColor}
        highlights={context.highlights}
        highlightStatus={context.highlightStatus}
        lesson={context.selectedLesson}
        lessons={context.lessons}
        onAddSelectionToReview={context.onAddSelectionToReview}
        onHighlight={context.onAddHighlight}
        onJumpToMathSource={context.onJumpToMathSource}
        onRemoveHighlight={context.onRemoveHighlight}
        onSaveSelectionAsEvidence={context.onSaveSelectionAsEvidence}
        onQuoteToNotes={context.onCreateQuoteExcerpt}
        onCommentSelection={context.onAddCommentForSelection}
        onOpenGraphBlock={context.onOpenGraphBlock}
        onSendToGraph={context.mathModules?.pushExpressionToGraph}
        onSendToNotes={context.onSendSelectionToNotes}
        reviewQueueBeta={context.reviewQueueBeta}
        sourceLinkedNotesBeta={context.sourceLinkedNotesBeta}
        surface={context.surface ?? "workspace"}
        whiteboardDensity={context.whiteboardCardDensity}
        whiteboardDisplayMode={context.whiteboardSourceDisplayMode}
        whiteboardModuleId={context.whiteboardModuleId}
        whiteboardShowMathInline={context.whiteboardShowMathInline}
        whiteboardTextSize={context.whiteboardTextSize}
        onSelectLesson={context.onSelectLesson}
        onStickyNote={context.onPrepareComment}
      />
    ),
  },
  "private-notes": {
    id: "private-notes",
    title: "Private notes",
    description: "Your personal study workspace",
    render: (context) => (
      <PrivateNotesModule
        mathSuggestions={context.mathSuggestions}
        noteContent={context.noteContent}
        noteInsertRequest={context.noteInsertRequest}
        noteMath={context.noteMath}
        noteTitle={context.noteTitle}
        selectedLessonTitle={context.selectedLesson.title}
        autosaveStatus={context.autosaveStatus}
        canRetryNoteSave={context.canRetryNoteSave}
        noteSaveDetail={context.noteSaveDetail}
        noteSaveError={context.noteSaveError}
        noteSaveLabel={context.noteSaveLabel}
        currentNotebookSection={context.currentNotebookSection}
        hasUnsavedNoteChanges={context.hasUnsavedNoteChanges}
        onAcceptMathSuggestion={context.onAcceptMathSuggestion}
        onCreateSticky={context.onCreateLooseSticky}
        onDismissMathSuggestion={context.onDismissMathSuggestion}
        onEnterNotebookFocus={context.onEnterNotebookFocus}
        onGraphMathSuggestion={context.onGraphMathSuggestion}
        onInsertCallout={context.onInsertCallout}
        onInsertChecklist={context.onInsertChecklist}
        onInsertDefinition={context.onInsertDefinition}
        onInsertFormulaReference={context.onInsertFormulaReference}
        onInsertGraphBlock={context.onInsertGraphBlock}
        onInsertGraphNote={context.onInsertGraphNote}
        onInsertMathBlock={context.onInsertMathBlock}
        onInsertProof={context.onInsertProof}
        onInsertTheorem={context.onInsertTheorem}
        onInsertWorkedExample={context.onInsertWorkedExample}
        onNoteInsertApplied={context.onNoteInsertApplied}
        onNoteContentChange={context.onNoteContentChange}
        onNoteMathChange={context.onNoteMathChange}
        onSaveNoteNow={context.onSaveNoteNow}
        onRetryNoteSave={context.onRetryNoteSave}
        onNoteTitleChange={context.onNoteTitleChange}
        onOpenGraphBlock={context.onOpenGraphBlock}
        onSendToGraph={context.mathModules?.pushExpressionToGraph}
        surface={context.surface ?? "workspace"}
        studentCalmMode={context.studentCalmMode}
      />
    ),
  },
  "binder-notebook": {
    id: "binder-notebook",
    title: "Binder notebook",
    description: "Combined private notes across this binder",
    render: (context) => (
      <BinderNotebookModule
        currentNotebookSection={context.currentNotebookSection}
        entries={context.binderNotebookEntries}
        onEnterNotebookFocus={context.onEnterNotebookFocus}
        onSelectLesson={context.onSelectLesson}
        sections={context.binderNotebookSections}
        selectedLessonId={context.selectedLesson.id}
      />
    ),
  },
  "history-timeline": {
    id: "history-timeline",
    title: "History timeline",
    description: "Chronology, location, and turning points",
    render: (context) =>
      context.history.enabled ? (
        <LazyModuleBoundary title="History timeline">
          <LazyHistoryTimelineModule
          activeEventId={context.history.activeEventId}
          evidenceCards={context.history.evidenceCards}
          events={context.history.events}
          onCreateStarterEvent={context.onCreateHistoryStarterEvent}
          onReplayTimeline={context.onReplayHistoryTimeline}
          onSelectEvent={context.onSelectHistoryEvent}
          status={context.history.status.timeline}
          templateEvents={context.history.templateEvents}
          />
        </LazyModuleBoundary>
      ) : (
        <WorkspacePanel description="Available in history-enabled binders" title="History timeline">
          <EmptyState
            description={context.history.seedHealthMessage ?? "Open a history-enabled suite to use timeline study tools."}
            title="Timeline unavailable"
          />
        </WorkspacePanel>
      ),
  },
  "history-evidence": {
    id: "history-evidence",
    title: "Source evidence",
    description: "Evidence locker and source investigation",
    render: (context) =>
      context.history.enabled ? (
        <LazyModuleBoundary title="Source evidence">
          <LazySourceEvidenceModule
          activeSourceId={context.history.activeSourceId}
          evidenceCards={context.history.evidenceCards}
          onCreateEvidenceFromActiveSource={context.onCreateHistoryEvidenceFromSource}
          onSelectSource={context.onSelectHistorySource}
          onUseSourceInArgument={context.onUseHistorySourceInArgument}
          sources={context.history.sources}
          status={context.history.status.evidence}
          templateSources={context.history.templateSources}
          />
        </LazyModuleBoundary>
      ) : (
        <WorkspacePanel description="Available in history-enabled binders" title="Source evidence">
          <EmptyState
            description={context.history.seedHealthMessage ?? "Open a history-enabled suite to use evidence cards."}
            title="Evidence unavailable"
          />
        </WorkspacePanel>
      ),
  },
  "history-argument": {
    id: "history-argument",
    title: "Argument builder",
    description: "Cause and effect chains",
    render: (context) =>
      context.history.enabled ? (
        <LazyModuleBoundary title="Argument builder">
          <LazyArgumentBuilderModule
          activeChain={context.history.argumentChains[0] ?? null}
          edges={context.history.argumentEdges}
          nodes={context.history.argumentNodes}
          onCreateStarterChain={context.onCreateHistoryStarterChain}
          onUpdateChain={context.onUpdateHistoryArgumentChain}
          onUseEvidencePrompt={context.onUseHistoryEvidencePrompt}
          starterTopic={
            context.binder.id === "binder-rise-of-rome"
              ? "rome"
              : context.binder.id === "binder-russian-revolution"
                ? "russian"
                : "french"
          }
          status={context.history.status.argument}
          />
        </LazyModuleBoundary>
      ) : (
        <WorkspacePanel description="Available in history-enabled binders" title="Argument builder">
          <EmptyState
            description={context.history.seedHealthMessage ?? "Open a history-enabled suite to build historical arguments."}
            title="Argument builder unavailable"
          />
        </WorkspacePanel>
      ),
  },
  "history-myth-checks": {
    id: "history-myth-checks",
    title: "Myth vs history",
    description: "Evaluate claims against evidence",
    render: (context) =>
      context.history.enabled ? (
        <LazyModuleBoundary title="Myth vs history">
          <LazyMythHistoryModule
          mythChecks={context.history.mythChecks}
          onCreateStarterMythCheck={context.onCreateHistoryMythCheck}
          status={context.history.status.myth}
          templateMythChecks={context.history.templateMythChecks}
          />
        </LazyModuleBoundary>
      ) : (
        <WorkspacePanel description="Available in history-enabled binders" title="Myth vs history">
          <EmptyState
            description={context.history.seedHealthMessage ?? "Open a history-enabled suite to compare myth and evidence."}
            title="Myth checks unavailable"
          />
        </WorkspacePanel>
      ),
  },
  comments: {
    id: "comments",
    title: "Sticky-note manager",
    description: "Floating sticky notes and quick capture",
    render: (context) => (
      <WorkspacePanel description="Create, review, and clean up lesson stickies" title="Sticky-note manager">
        <div className="grid gap-4">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Floating notes for this lesson</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Pin a reminder, anchor a question to source text, or send a sticky into your lesson notes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={context.onCreateLooseSticky} size="sm" type="button">
                  <StickyNote data-icon="inline-start" />
                  New sticky
                </Button>
                <Button onClick={context.onToggleStickyManager} size="sm" type="button" variant="outline">
                  {context.stickyManagerVisible ? "Hide manager" : "Show manager"}
                </Button>
              </div>
            </div>
            {context.commentAnchor ? (
              <div className="mt-3 rounded-xl border border-border/60 bg-card/85 px-3 py-2 text-xs text-muted-foreground">
                Ready to anchor next sticky to "{context.commentAnchor}"
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            {context.comments.map((comment) => (
              <article className="rounded-2xl border border-border/70 bg-card/88 p-3 shadow-sm" key={comment.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">
                      {comment.body.trim() || "New sticky note"}
                    </p>
                    {comment.anchor_text ? (
                      <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                        <Pin className="mt-0.5 size-3.5 shrink-0" />
                        <span className="break-words">Anchored to "{comment.anchor_text}"</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Free-floating workspace note</p>
                    )}
                  </div>
                  <Badge variant={comment.anchor_text ? "default" : "secondary"}>
                    {comment.anchor_text ? "Anchored" : "Loose"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => context.onSendStickyToNotes(comment)} size="sm" type="button" variant="outline">
                    <Send data-icon="inline-start" />
                    Send to notes
                  </Button>
                  <Button onClick={() => context.onDeleteComment(comment.id)} size="sm" type="button" variant="ghost">
                    <X data-icon="inline-start" />
                    Dismiss
                  </Button>
                </div>
              </article>
            ))}
            {context.comments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 p-4 text-sm text-muted-foreground">
                No sticky notes yet. Create one or pin a passage from the source.
              </div>
            ) : null}
          </div>
        </div>
      </WorkspacePanel>
    ),
  },
  "lesson-outline": {
    id: "lesson-outline",
    title: "Lesson outline",
    description: "Navigate this binder",
    render: (context) => (
      <WorkspacePanel description={`${context.lessons.length} lessons`} title="Outline">
        <nav className="flex flex-col gap-1">
          {context.filteredLessons.map((lesson, index) => (
            <button
              className={`rounded-xl border px-3 py-3 text-left text-sm transition hover:bg-secondary/80 ${
                lesson.id === context.selectedLesson.id
                  ? "border-primary/35 bg-accent/60 text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground"
              }`}
              key={lesson.id}
              onClick={() => context.onSelectLesson(lesson)}
              type="button"
            >
              <span className="mr-2 font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>
              {lesson.title}
            </button>
          ))}
        </nav>
      </WorkspacePanel>
    ),
  },
  search: {
    id: "search",
    title: "Search",
    description: "Find lesson text fast",
    render: (context) => (
      <WorkspacePanel description="Within this binder" title="Search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-icon="inline-start" />
          <Input
            className="pl-10"
            onChange={(event) => context.onQueryChange(event.target.value)}
            placeholder="Search lessons"
            value={context.query}
          />
        </div>
      </WorkspacePanel>
    ),
  },
  "formula-sheet": {
    id: "formula-sheet",
    title: "Formula sheet",
    description: "Math blocks from lesson and notes",
    render: (context) => {
      const formulaBlocks = [...context.selectedLesson.math_blocks, ...context.noteMath].filter(
        (block) => block.type === "latex",
      );
      return (
        <WorkspacePanel description="Reusable equations" title="Formula sheet">
          <div className="formula-sheet-readable">
            <LazyModuleBoundary title="Formula sheet">
              <LazyMathBlocks
                blocks={formulaBlocks}
                onJumpToSource={context.onJumpToMathSource}
                onSendFormulaToNotes={context.onSendSelectionToNotes}
              />
            </LazyModuleBoundary>
          </div>
          {formulaBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add LaTeX blocks to build a formula sheet.</p>
          ) : null}
        </WorkspacePanel>
      );
    },
  },
  "math-blocks": {
    id: "math-blocks",
    title: "Math blocks",
    description: "Lesson equations and graph sets",
    render: (context) => (
      <WorkspacePanel description="Published lesson math" title="Math blocks">
        <LazyModuleBoundary title="Math blocks">
          <LazyMathBlocks
            blocks={context.selectedLesson.math_blocks}
            onJumpToSource={context.onJumpToMathSource}
            onOpenGraphBlock={context.onOpenGraphBlock}
            onSendFormulaToNotes={context.onSendSelectionToNotes}
            onSendToGraph={context.mathModules ? context.mathModules.pushExpressionToGraph : undefined}
          />
        </LazyModuleBoundary>
        {context.selectedLesson.math_blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">This lesson has no math blocks yet.</p>
        ) : null}
      </WorkspacePanel>
    ),
  },
  "graph-panel": {
    id: "graph-panel",
    title: "Interactive graph",
    description: "Live Desmos graphing",
    render: (context) =>
      context.mathModules ? (
        <LazyModuleBoundary title="Interactive graph">
          <LazyDesmosGraphModule
            bindings={context.mathModules}
            description="Legacy graph cards now route through a real Desmos graphing surface."
            mathPerformanceLazyLoading={context.mathPerformanceLazyLoading}
            surface={context.surface ?? "workspace"}
            title="Interactive graph"
          />
        </LazyModuleBoundary>
      ) : (
        <WorkspacePanel description="Math workspace only" title="Interactive graph">
          <EmptyState
            description="Attach the math workspace to open a live Desmos graph window."
            title="Graph unavailable"
          />
        </WorkspacePanel>
      ),
  },
  "desmos-graph": {
    id: "desmos-graph",
    title: "Desmos graph",
    description: "Live graphing calculator",
    render: (context) =>
      context.mathModules ? (
        <LazyModuleBoundary title="Desmos graph">
          <LazyDesmosGraphModule
            bindings={context.mathModules}
            mathPerformanceLazyLoading={context.mathPerformanceLazyLoading}
            showKeypad={context.graphKeypad !== false}
            surface={context.surface ?? "workspace"}
          />
        </LazyModuleBoundary>
      ) : (
        <WorkspacePanel description="Math workspace only" title="Desmos graph">
          <EmptyState
            description="Enable the math workspace state for this binder to use the live Desmos module."
            title="Graph module unavailable"
          />
        </WorkspacePanel>
      ),
  },
  "scientific-calculator": {
    id: "scientific-calculator",
    title: "Scientific calculator",
    description: "Numeric work and reusable function input",
    render: (context) =>
      context.mathModules ? (
        <LazyModuleBoundary title="Scientific calculator">
          <LazyScientificCalculatorModule
            bindings={context.mathModules}
            mathPerformanceLazyLoading={context.mathPerformanceLazyLoading}
            surface={context.surface ?? "workspace"}
          />
        </LazyModuleBoundary>
      ) : (
        <WorkspacePanel description="Math workspace only" title="Scientific calculator">
          <EmptyState
            description="This module becomes active when a math workspace is attached to the current study environment."
            title="Calculator unavailable"
          />
        </WorkspacePanel>
      ),
  },
  "saved-graphs": {
    id: "saved-graphs",
    title: "Saved graphs",
    description: "Reusable graph states",
    render: (context) =>
      context.mathModules ? (
        <LazyModuleBoundary title="Saved graphs">
          <LazySavedGraphsModule
            bindings={context.mathModules}
            mathPerformanceLazyLoading={context.mathPerformanceLazyLoading}
            surface={context.surface ?? "workspace"}
          />
        </LazyModuleBoundary>
      ) : (
        <WorkspacePanel description="Math workspace only" title="Saved graphs">
          <EmptyState
            description="Graph snapshots appear here once the live Desmos module is active."
            title="No graph state library"
          />
        </WorkspacePanel>
      ),
  },
  whiteboard: {
    id: "whiteboard",
    title: "Whiteboard",
    description: "Graph-paper study board with live BinderNotes modules",
    render: (context) => (
      <LazyModuleBoundary title="Whiteboard">
        <LazyWhiteboardModule
          context={context}
          renderModule={(moduleId, embeddedContext) => {
            if (moduleId === "whiteboard") {
              return null;
            }

            return workspaceModuleRegistry[moduleId]?.render(embeddedContext) ?? null;
          }}
        />
      </LazyModuleBoundary>
    ),
  },
  "chem-concept-cards": {
    id: "chem-concept-cards",
    title: "Chemistry concept cards",
    description: "Concept, formula, misconception, and alignment cards",
    render: () => (
      <LazyModuleBoundary title="Chemistry concept cards">
        <LazyChemistryConceptCardsModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-quick-tools": {
    id: "chem-quick-tools",
    title: "Chemistry quick tools",
    description: "Molar mass, ions, solubility, pH, and sig-fig helpers",
    render: () => (
      <LazyModuleBoundary title="Chemistry quick tools">
        <LazyChemistryQuickToolsModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-periodic-table": {
    id: "chem-periodic-table",
    title: "Interactive periodic table",
    description: "Search, compare, and explore periodic trends",
    render: (context) => (
      <LazyModuleBoundary title="Interactive periodic table">
        <LazyInteractivePeriodicTableModule
          onOpenPractice={() => context.onOpenWorkspaceTool?.("chem-review-queue")}
          onSendToNotes={context.onCreateQuoteExcerpt}
          onSendToWhiteboard={context.onPrepareComment}
        />
      </LazyModuleBoundary>
    ),
  },
  "chem-element-builder": {
    id: "chem-element-builder",
    title: "Element builder",
    description: "Build isotopes, ions, charge, and shell models",
    render: () => (
      <LazyModuleBoundary title="Element builder">
        <LazyElementBuilderModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-electron-config-builder": {
    id: "chem-electron-config-builder",
    title: "Electron configuration builder",
    description: "Aufbau-style orbital filling practice",
    render: () => (
      <LazyModuleBoundary title="Electron configuration builder">
        <LazyElectronConfigurationBuilderModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-periodic-trends-graph": {
    id: "chem-periodic-trends-graph",
    title: "Periodic trends graph",
    description: "Desmos-ready trend graph with fallback chart",
    render: () => (
      <LazyModuleBoundary title="Periodic trends graph">
        <LazyPeriodicTrendsGraphModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-molecule-builder": {
    id: "chem-molecule-builder",
    title: "Molecule / Lewis builder",
    description: "Lewis structures, valence, formal charge, and VSEPR MVP",
    render: () => (
      <LazyModuleBoundary title="Molecule / Lewis builder">
        <LazyMoleculeLewisBuilderModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-geometry-viewer": {
    id: "chem-geometry-viewer",
    title: "Geometry viewer",
    description: "Simple VSEPR geometry suggestions",
    render: () => (
      <LazyModuleBoundary title="Geometry viewer">
        <LazyMoleculeLewisBuilderModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-reaction-balancer": {
    id: "chem-reaction-balancer",
    title: "Reaction balancer",
    description: "Balance equations with conservation feedback",
    render: () => (
      <LazyModuleBoundary title="Reaction balancer">
        <LazyReactionBalancerModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-tri-reaction-view": {
    id: "chem-tri-reaction-view",
    title: "Tri-representation reaction view",
    description: "Symbolic, particle, and macroscopic reaction views",
    render: () => (
      <LazyModuleBoundary title="Tri-representation reaction view">
        <LazyTriRepresentationReactionViewModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-lab-coach": {
    id: "chem-lab-coach",
    title: "Chemistry Lab Coach",
    description: "Guided lab steps with safety, observations, calculations, and tool handoffs",
    render: (context) => (
      <LazyModuleBoundary title="Chemistry Lab Coach">
        <LazyChemistryLabCoachModule onOpenTool={context.onOpenWorkspaceTool} />
      </LazyModuleBoundary>
    ),
  },
  "chem-stoichiometry-coach": {
    id: "chem-stoichiometry-coach",
    title: "Chemistry Stoichiometry Coach",
    description: "Deterministic equation, mole ratio, and unit ladder practice",
    render: () => (
      <LazyModuleBoundary title="Chemistry Stoichiometry Coach">
        <LazyChemistryStoichiometryCoachModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-molar-mass-calculator": {
    id: "chem-molar-mass-calculator",
    title: "Molar mass calculator",
    description: "Fast formula mass calculator",
    render: () => (
      <LazyModuleBoundary title="Molar mass calculator">
        <LazyChemistryMolarMassCalculatorModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-solution-mixer": {
    id: "chem-solution-mixer",
    title: "Solution mixer",
    description: "Molarity and dilution bench",
    render: () => (
      <LazyModuleBoundary title="Solution mixer">
        <LazySolutionMixerModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-molarity-calculator": {
    id: "chem-molarity-calculator",
    title: "Molarity calculator",
    description: "M1V1 and molarity calculations",
    render: () => (
      <LazyModuleBoundary title="Molarity calculator">
        <LazySolutionMixerModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-desmos-concentration-graph": {
    id: "chem-desmos-concentration-graph",
    title: "Desmos concentration graph",
    description: "Concentration graph with fallback chart",
    render: () => (
      <LazyModuleBoundary title="Desmos concentration graph">
        <LazyChemistryGraphModule kind="concentration" />
      </LazyModuleBoundary>
    ),
  },
  "chem-ph-calculator": {
    id: "chem-ph-calculator",
    title: "pH calculator",
    description: "Strong acid/base pH and buffer preview",
    render: () => (
      <LazyModuleBoundary title="pH calculator">
        <LazyAcidBaseCalculatorModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-titration-lab": {
    id: "chem-titration-lab",
    title: "Acid-base titration lab",
    description: "Controlled strong acid and base titration simulation",
    render: () => (
      <LazyModuleBoundary title="Acid-base titration lab">
        <LazyChemistryTitrationLabModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-desmos-titration-curve": {
    id: "chem-desmos-titration-curve",
    title: "Desmos titration curve",
    description: "Titration curve with compact fallback",
    render: () => (
      <LazyModuleBoundary title="Desmos titration curve">
        <LazyChemistryGraphModule kind="titration" />
      </LazyModuleBoundary>
    ),
  },
  "chem-kinetics-simulator": {
    id: "chem-kinetics-simulator",
    title: "Kinetics simulator",
    description: "Reaction order and concentration-time simulator",
    render: () => (
      <LazyModuleBoundary title="Kinetics simulator">
        <LazyKineticsSimulatorModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-desmos-kinetics-plot": {
    id: "chem-desmos-kinetics-plot",
    title: "Desmos kinetics plot",
    description: "Kinetics graph with fallback chart",
    render: () => (
      <LazyModuleBoundary title="Desmos kinetics plot">
        <LazyChemistryGraphModule kind="kinetics" />
      </LazyModuleBoundary>
    ),
  },
  "chem-data-table": {
    id: "chem-data-table",
    title: "Chemistry data table",
    description: "Compact lab data table",
    render: () => (
      <LazyModuleBoundary title="Chemistry data table">
        <LazyChemistryDataTableModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-calorimetry-lab": {
    id: "chem-calorimetry-lab",
    title: "Calorimetry lab",
    description: "q = mc delta T calculator and energy behavior",
    render: () => (
      <LazyModuleBoundary title="Calorimetry lab">
        <LazyThermochemistryModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-energy-diagram": {
    id: "chem-energy-diagram",
    title: "Energy diagram",
    description: "Endothermic and exothermic energy view",
    render: () => (
      <LazyModuleBoundary title="Energy diagram">
        <LazyThermochemistryModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-calculation-sheet": {
    id: "chem-calculation-sheet",
    title: "Calculation sheet",
    description: "Thermochemistry calculation sheet",
    render: () => (
      <LazyModuleBoundary title="Calculation sheet">
        <LazyThermochemistryModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-safety-cards": {
    id: "chem-safety-cards",
    title: "Safety + reagent cards",
    description: "Safety cards for virtual lab reagents",
    render: () => (
      <LazyModuleBoundary title="Safety + reagent cards">
        <LazySafetyReagentCardsModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-review-queue": {
    id: "chem-review-queue",
    title: "Chem challenge queue",
    description: "Deterministic review challenges",
    render: () => (
      <LazyModuleBoundary title="Chem challenge queue">
        <LazyChemistryChallengeReviewModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-lab-notebook": {
    id: "chem-lab-notebook",
    title: "Chemistry lab notebook",
    description: "Structured hypothesis, data, calculations, and conclusion sections",
    render: () => (
      <LazyModuleBoundary title="Chemistry lab notebook">
        <LazyChemistryLabNotebookModule />
      </LazyModuleBoundary>
    ),
  },
  "chem-reference-safety": {
    id: "chem-reference-safety",
    title: "Chemistry reference",
    description: "Safety, conservation, and misconception tags",
    render: () => (
      <LazyModuleBoundary title="Chemistry reference">
        <LazyChemistryReferenceSafetyModule />
      </LazyModuleBoundary>
    ),
  },
  "recent-highlights": {
    id: "recent-highlights",
    title: "Recent highlights",
    description: "Saved anchors",
    render: (context) => (
      <HighlightsCollectionModule
        highlights={context.highlights}
        onJumpToHighlight={context.onJumpToHighlight}
      />
    ),
  },
  tasks: {
    id: "tasks",
    title: "Tasks",
    description: "Study checklist",
    render: () => (
      <WorkspacePanel description="Local checklist placeholder" title="Tasks">
        <div className="flex flex-col gap-2">
          {["Review lesson", "Write one explanation", "Graph one example", "Create two recall prompts"].map((task) => (
            <label className="flex items-center gap-2 rounded-xl bg-secondary/80 px-3 py-2 text-sm" key={task}>
              <input type="checkbox" />
              {task}
            </label>
          ))}
        </div>
      </WorkspacePanel>
    ),
  },
  "related-concepts": {
    id: "related-concepts",
    title: "Related concepts",
    description: "Connected ideas",
    render: (context) => {
      const nodeById = new Map(context.conceptNodes.map((node) => [node.id, node]));
      const linkedLabels = new Map<string, string[]>();
      const degreeByNodeId = new Map<string, number>();

      context.conceptEdges.forEach((edge) => {
        const source = nodeById.get(edge.source_id);
        const target = nodeById.get(edge.target_id);
        if (!source || !target) {
          return;
        }

        linkedLabels.set(source.id, [...(linkedLabels.get(source.id) ?? []), target.label]);
        linkedLabels.set(target.id, [...(linkedLabels.get(target.id) ?? []), source.label]);
        degreeByNodeId.set(source.id, (degreeByNodeId.get(source.id) ?? 0) + 1);
        degreeByNodeId.set(target.id, (degreeByNodeId.get(target.id) ?? 0) + 1);
      });

      const prioritizedNodes = [...context.conceptNodes]
        .filter((node) => {
          const label = node.label.trim().toLowerCase();
          if (!label || label === "concept" || label === "untitled") {
            return false;
          }

          const linked = linkedLabels.get(node.id)?.length ?? 0;
          const hasDescription = Boolean(node.description?.trim());
          return linked > 0 || hasDescription;
        })
        .sort((left, right) => {
          const degreeDelta =
            (degreeByNodeId.get(right.id) ?? 0) - (degreeByNodeId.get(left.id) ?? 0);
          if (degreeDelta !== 0) {
            return degreeDelta;
          }
          return left.label.localeCompare(right.label);
        })
        .slice(0, 8);

      return (
        <WorkspacePanel description="Key people, institutions, and turning points" title="Related concepts">
          {prioritizedNodes.length > 0 ? (
            <div className="grid gap-3">
              {prioritizedNodes.map((node) => {
                const related = Array.from(new Set(linkedLabels.get(node.id) ?? [])).slice(0, 4);
                return (
                  <article
                    className="rounded-2xl border border-border/70 bg-card/88 p-3 shadow-sm"
                    key={node.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{node.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{node.description}</p>
                      </div>
                      {related.length > 0 ? <Badge variant="outline">{related.length} links</Badge> : null}
                    </div>
                    {related.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {related.map((label) => (
                          <Badge key={`${node.id}-${label}`} variant="secondary">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              description="Related terms appear here once events, sources, or notes create useful links."
              title="No connected concepts yet"
            />
          )}
        </WorkspacePanel>
      );
    },
  },
  flashcards: {
    id: "flashcards",
    title: "Recall Lab",
    description: "Source-linked active recall",
    render: (context) => (
      <LazyModuleBoundary title="Recall Lab">
        <LazyRecallLab
          betaEnabled={context.recallLabEnabled}
          binder={context.binder}
          comments={context.comments}
          highlights={context.highlights}
          lesson={context.selectedLesson}
          lessons={context.lessons}
          noteContent={context.noteContent}
          noteTitle={context.noteTitle}
          onOpenSource={() => context.onOpenWorkspaceTool?.("lesson")}
          subject={context.binder.subject}
          userId={context.ownerId}
        />
      </LazyModuleBoundary>
    ),
  },
  "mini-tools": {
    id: "mini-tools",
    title: "Mini tools",
    description: "Focus helpers",
    render: () => (
      <WorkspacePanel description="Small utilities" title="Mini tools">
        <div className="grid gap-2">
          <p className="flex items-center gap-2 rounded-xl bg-secondary/80 px-3 py-2 text-sm">
            <Clock3 data-icon="inline-start" />
            Focus timer placeholder
          </p>
          <p className="flex items-center gap-2 rounded-xl bg-secondary/80 px-3 py-2 text-sm">
            <FlaskConical data-icon="inline-start" />
            Math lab ready
          </p>
          <p className="flex items-center gap-2 rounded-xl bg-secondary/80 px-3 py-2 text-sm">
            <ListChecks data-icon="inline-start" />
            Checklist ready
          </p>
          <p className="flex items-center gap-2 rounded-xl bg-secondary/80 px-3 py-2 text-sm">
            <Sparkles data-icon="inline-start" />
            Distraction-free mode next
          </p>
        </div>
      </WorkspacePanel>
    ),
  },
};

const highlightGroupMeta: Record<HighlightColor, { label: string; tone: string }> = {
  yellow: { label: "Important", tone: "border-amber-300/50 bg-amber-100/70 text-amber-950 dark:border-amber-300/20 dark:bg-amber-300/15 dark:text-amber-50" },
  blue: { label: "Definitions", tone: "border-sky-300/50 bg-sky-100/70 text-sky-950 dark:border-sky-300/20 dark:bg-sky-300/15 dark:text-sky-50" },
  green: { label: "Methods", tone: "border-emerald-300/50 bg-emerald-100/70 text-emerald-950 dark:border-emerald-300/20 dark:bg-emerald-300/15 dark:text-emerald-50" },
  pink: { label: "Review later", tone: "border-rose-300/50 bg-rose-100/70 text-rose-950 dark:border-rose-300/20 dark:bg-rose-300/15 dark:text-rose-50" },
  orange: { label: "Questions", tone: "border-orange-300/50 bg-orange-100/70 text-orange-950 dark:border-orange-300/20 dark:bg-orange-300/15 dark:text-orange-50" },
};

function HighlightsCollectionModule({
  highlights,
  onJumpToHighlight,
}: {
  highlights: Highlight[];
  onJumpToHighlight: (highlightId: string) => void;
}) {
  const grouped = useMemo(() => {
    const order: HighlightColor[] = ["yellow", "blue", "green", "pink", "orange"];
    return order
      .map((color) => ({
        color,
        items: highlights.filter((highlight) => highlight.color === color),
      }))
      .filter((group) => group.items.length > 0);
  }, [highlights]);

  return (
    <WorkspacePanel
      description="Grouped by meaning so you can revisit the important parts fast."
      title="Highlights"
    >
      <div className="flex flex-col gap-4">
        {grouped.map((group) => (
          <section className="flex flex-col gap-2" key={group.color}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {highlightGroupMeta[group.color].label}
              </p>
              <Badge variant="secondary">{group.items.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {group.items.map((highlight) => (
                <button
                  className={`rounded-xl border px-3 py-2 text-left text-sm leading-6 shadow-sm transition hover:-translate-y-px hover:shadow-md ${highlightGroupMeta[highlight.color].tone}`}
                  key={highlight.id}
                  onClick={() => onJumpToHighlight(highlight.id)}
                  type="button"
                >
                  {highlight.anchor_text}
                </button>
              ))}
            </div>
          </section>
        ))}
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">Select text in the lesson and save a highlight.</p>
        ) : null}
      </div>
    </WorkspacePanel>
  );
}
