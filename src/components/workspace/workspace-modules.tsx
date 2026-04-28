import { Clock3, FlaskConical, ListChecks, Search, Sparkles, StickyNote } from "lucide-react";
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
        onHighlight={context.onAddHighlight}
        onJumpToMathSource={context.onJumpToMathSource}
        onRemoveHighlight={context.onRemoveHighlight}
        onSaveSelectionAsEvidence={context.onSaveSelectionAsEvidence}
        onQuoteToNotes={context.onCreateQuoteExcerpt}
        onCommentSelection={context.onAddCommentForSelection}
        onOpenGraphBlock={context.onOpenGraphBlock}
        onSendToGraph={context.mathModules?.pushExpressionToGraph}
        onSendToNotes={context.onSendSelectionToNotes}
        surface={context.surface ?? "workspace"}
        whiteboardDensity={context.whiteboardCardDensity}
        whiteboardDisplayMode={context.whiteboardSourceDisplayMode}
        whiteboardModuleId={context.whiteboardModuleId}
        whiteboardShowMathInline={context.whiteboardShowMathInline}
        whiteboardTextSize={context.whiteboardTextSize}
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
      <WorkspacePanel description="Sticky notes now float above the workspace" title="Sticky-note manager">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Sticky notes live above the workspace now</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Create a free-floating note, or select lesson text to anchor one directly from the source module.
                </p>
              </div>
              <Button onClick={context.onCreateLooseSticky} size="sm" type="button">
                <StickyNote data-icon="inline-start" />
                New sticky
              </Button>
              <Button onClick={context.onToggleStickyManager} size="sm" type="button" variant="outline">
                {context.stickyManagerVisible ? "Hide manager" : "Show manager"}
              </Button>
            </div>
            {context.commentAnchor ? (
              <div className="mt-3 rounded-xl border border-border/60 bg-card/85 px-3 py-2 text-xs text-muted-foreground">
                Ready to anchor next sticky to "{context.commentAnchor}"
              </div>
            ) : null}
          </div>

          <div className="grid gap-3">
            {context.comments.slice(0, 4).map((comment) => (
              <article className="rounded-2xl border border-border/70 bg-card/88 p-3 shadow-sm" key={comment.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{comment.body || "Sticky note"}</p>
                    {comment.anchor_text ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Anchored to "{comment.anchor_text}"
                      </p>
                    ) : (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Free-floating workspace note</p>
                    )}
                  </div>
                  <Badge variant="secondary">Floating</Badge>
                </div>
              </article>
            ))}
            {context.comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sticky notes yet. Create one or pin a passage from the source.</p>
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
              <LazyMathBlocks blocks={formulaBlocks} onJumpToSource={context.onJumpToMathSource} />
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
          <LazyDesmosGraphModule bindings={context.mathModules} surface={context.surface ?? "workspace"} />
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
          <LazyScientificCalculatorModule bindings={context.mathModules} surface={context.surface ?? "workspace"} />
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
          <LazySavedGraphsModule bindings={context.mathModules} surface={context.surface ?? "workspace"} />
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
    title: "Flashcards",
    description: "Recall practice",
    render: () => (
      <WorkspacePanel description="Future recall module" title="Flashcards">
        <EmptyState
          description="Turn highlights and private notes into recall cards in a later pass."
          title="Flashcards placeholder"
        />
      </WorkspacePanel>
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
