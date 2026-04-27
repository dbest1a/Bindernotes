import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Editor, JSONContent } from "@tiptap/react";
import {
  BookOpenText,
  ChevronDown,
  ChevronRight,
  Command,
  FileText,
  Highlighter,
  Layers2,
  Quote,
  Save,
  Sigma,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { MathBlocks } from "@/components/math/math-blocks";
import {
  buildLessonContentSelector,
  LessonContentRenderer,
} from "@/components/workspace/lesson-content-renderer";
import { LessonSelectionToolbar } from "@/components/workspace/lesson-selection-toolbar";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatusPill } from "@/components/ui/save-status-pill";
import type { MathSuggestion } from "@/lib/math-detection";
import { extractPlainText } from "@/lib/math-detection";
import type { NoteInsertRequest } from "@/lib/note-blocks";
import { cn } from "@/lib/utils";
import type {
  Binder,
  BinderLesson,
  BinderNotebookLessonEntry,
  BinderNotebookSection,
  Highlight,
  HighlightColor,
  LessonTextSelection,
  MathBlock,
  SaveStatusSnapshot,
} from "@/types";

export const SourceLessonModule = memo(function SourceLessonModule({
  binder,
  defaultHighlightColor,
  highlights,
  highlightStatus,
  lesson,
  onHighlight,
  onJumpToMathSource,
  onRemoveHighlight,
  onSaveSelectionAsEvidence,
  onQuoteToNotes,
  onSendToNotes,
  onOpenGraphBlock,
  onSendToGraph,
  surface = "workspace",
  whiteboardDensity = "compact",
  whiteboardDisplayMode = "compact",
  whiteboardShowMathInline = false,
  whiteboardTextSize = "normal",
  onStickyNote,
}: {
  binder: Binder;
  defaultHighlightColor: HighlightColor;
  highlights: Highlight[];
  highlightStatus: SaveStatusSnapshot;
  lesson: BinderLesson;
  onHighlight: (selection: LessonTextSelection, color: HighlightColor) => void;
  onJumpToMathSource: (block: MathBlock) => void;
  onRemoveHighlight: (selection: LessonTextSelection, highlightIds: string[]) => void;
  onSaveSelectionAsEvidence: (selection: LessonTextSelection) => void;
  onQuoteToNotes: (anchorText?: string) => void;
  onOpenGraphBlock?: (block: Extract<MathBlock, { type: "graph" }>) => void;
  onSendToNotes: (anchorText?: string) => void;
  onSendToGraph?: (expression: string) => void;
  surface?: "workspace" | "whiteboard";
  whiteboardDensity?: "compact" | "comfortable";
  whiteboardDisplayMode?: "compact" | "full" | "summary" | "header-hidden";
  whiteboardShowMathInline?: boolean;
  whiteboardTextSize?: "small" | "normal" | "large";
  onStickyNote: (anchorText?: string | null) => void;
}) {
  const readingStats = createReadingStats(lesson.content);
  const lessonMathBlocks = lesson.math_blocks ?? [];
  const whiteboard = surface === "whiteboard";
  const compactWhiteboard = whiteboard && whiteboardDisplayMode !== "full";
  const showHero = !whiteboard || whiteboardDisplayMode === "full" || whiteboardDisplayMode === "summary";
  const showStats = !whiteboard || whiteboardDisplayMode === "full";
  const showInlineMathBlocks = lessonMathBlocks.length > 0 && (!whiteboard || whiteboardShowMathInline);

  return (
    <WorkspacePanel
      className={surface === "whiteboard" ? "h-full min-h-0" : "min-h-[720px]"}
      description={binder.title}
      title={lesson.title}
    >
      <div
        className={cn(
          "source-lesson-content flex flex-col",
          whiteboard
            ? "h-full min-h-0 max-w-none gap-3 overflow-y-auto px-3 py-3"
            : "mx-auto max-w-[80ch] gap-5",
          whiteboardDensity === "compact" && "text-sm",
          whiteboardTextSize === "small" && "text-[0.82rem]",
          whiteboardTextSize === "large" && "text-base",
        )}
        data-source-display-mode={whiteboardDisplayMode}
        data-source-density={whiteboardDensity}
        data-source-text-size={whiteboardTextSize}
        data-maximize-module-space-target="source-shell"
      >
        {showHero ? (
          <div
            className={cn(
              "source-lesson-hero rounded-[18px] border border-border bg-card p-3 shadow-sm",
              !whiteboard && "rounded-[22px] bg-background/72 p-4",
            )}
            data-compact-module-header="source-lesson"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Source lesson
                </p>
                {whiteboardDisplayMode !== "header-hidden" ? (
                  <h4 className={cn("mt-1 font-semibold tracking-tight", whiteboard ? "text-base" : "mt-2 text-xl")}>
                    {lesson.title}
                  </h4>
                ) : null}
                {whiteboardDisplayMode === "summary" || !whiteboard ? (
                  <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground sm:text-sm">
                    Read here, highlight what matters, and send it into notes or stickies without losing the lesson thread.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{binder.subject}</Badge>
                <Badge variant="secondary">{binder.level}</Badge>
                {lesson.is_preview ? <Badge variant="secondary">Preview lesson</Badge> : null}
              </div>
            </div>

            {highlightStatus.state !== "idle" ? (
              <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2">
                <SaveStatusPill snapshot={highlightStatus} />
                {highlightStatus.error ? (
                  <p className="mt-2 text-xs leading-5 text-destructive">{highlightStatus.error}</p>
                ) : null}
              </div>
            ) : null}

            {showStats ? (
              <div className="source-lesson-stats mt-3 grid gap-2 sm:grid-cols-3" data-compact-module-detail="source-stats">
                <StatTile label="Reading time" value={`${readingStats.minutes} min`} />
                <StatTile label="Words" value={String(readingStats.words)} />
                <StatTile label="Highlights" value={String(highlights.length)} />
              </div>
            ) : null}
          </div>
        ) : null}

        {compactWhiteboard && whiteboardDisplayMode === "summary" ? (
          <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs leading-5 text-secondary-foreground">
            Highlight, quote, or turn a passage into a sticky note while you sketch beside it.
          </div>
        ) : null}

        <div
          className={cn(
            "source-lesson-body-card relative rounded-[18px] border border-border bg-card text-card-foreground shadow-sm",
            whiteboard ? "min-h-0 flex-1 overflow-visible px-3 py-3" : "rounded-[26px] px-5 py-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:px-7",
          )}
          data-maximize-module-space-target="source-body"
        >
          <div className="absolute inset-y-0 left-0 hidden w-1 rounded-l-[26px] bg-primary/70 lg:block" />
            <LessonContentRenderer content={lesson.content} highlights={highlights} lessonId={lesson.id} />
            <LessonSelectionToolbar
              containerSelector={buildLessonContentSelector(lesson.id)}
              defaultHighlightColor={defaultHighlightColor}
              highlights={highlights}
              onHighlight={onHighlight}
            onRemoveHighlight={onRemoveHighlight}
            onSaveAsEvidence={onSaveSelectionAsEvidence}
            onQuoteToNotes={onQuoteToNotes}
            onSendToNotes={onSendToNotes}
            onStickyNote={onStickyNote}
          />
        </div>

        {lessonMathBlocks.length > 0 && whiteboard && !whiteboardShowMathInline ? (
          <div className="source-lesson-formula-chip flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground">
            <div>
              <p className="font-semibold">Formula Sheet</p>
              <p className="text-muted-foreground">{lessonMathBlocks.length} math blocks available</p>
            </div>
            <Badge variant="outline">{lessonMathBlocks.length} blocks</Badge>
          </div>
        ) : null}

        {showInlineMathBlocks ? (
          <div className="rounded-[18px] border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Lesson math and study blocks</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Graph sets now route through live Desmos instead of fake inline charts.
                </p>
              </div>
              <Badge variant="outline">{lessonMathBlocks.length} blocks</Badge>
            </div>
            <div className="mt-4">
              <MathBlocks
                blocks={lessonMathBlocks}
                onJumpToSource={onJumpToMathSource}
                onOpenGraphBlock={onOpenGraphBlock}
                onSendToGraph={onSendToGraph}
              />
            </div>
          </div>
        ) : null}
      </div>
    </WorkspacePanel>
  );
});

export const PrivateNotesModule = memo(function PrivateNotesModule({
  autosaveStatus,
  canRetryNoteSave,
  currentNotebookSection,
  hasUnsavedNoteChanges,
  noteSaveDetail,
  noteSaveError,
  noteSaveLabel,
  mathSuggestions,
  noteContent,
  noteInsertRequest,
  noteMath,
  noteTitle,
  selectedLessonTitle,
  onAcceptMathSuggestion,
  onCreateSticky,
  onDismissMathSuggestion,
  onEnterNotebookFocus,
  onGraphMathSuggestion,
  onInsertCallout,
  onInsertChecklist,
  onInsertDefinition,
  onInsertFormulaReference,
  onInsertGraphBlock,
  onInsertGraphNote,
  onInsertMathBlock,
  onInsertProof,
  onInsertTheorem,
  onInsertWorkedExample,
  onNoteInsertApplied,
  onNoteContentChange,
  onNoteMathChange,
  onRetryNoteSave,
  onNoteTitleChange,
  onOpenGraphBlock,
  onSaveNoteNow,
  onSendToGraph,
  surface = "workspace",
}: {
  autosaveStatus: "saved" | "saving" | "unsaved" | "offline" | "error";
  canRetryNoteSave: boolean;
  currentNotebookSection: BinderNotebookSection | null;
  hasUnsavedNoteChanges: boolean;
  noteSaveDetail: string;
  noteSaveError: string | null;
  noteSaveLabel: string;
  mathSuggestions: MathSuggestion[];
  noteContent: JSONContent;
  noteInsertRequest: NoteInsertRequest | null;
  noteMath: MathBlock[];
  noteTitle: string;
  selectedLessonTitle: string;
  onAcceptMathSuggestion: (suggestion: MathSuggestion) => void;
  onCreateSticky: () => void;
  onDismissMathSuggestion: (key: string) => void;
  onEnterNotebookFocus: () => void;
  onGraphMathSuggestion: (suggestion: MathSuggestion) => void;
  onInsertCallout: () => void;
  onInsertChecklist: () => void;
  onInsertDefinition: () => void;
  onInsertFormulaReference: () => void;
  onInsertGraphBlock: () => void;
  onInsertGraphNote: () => void;
  onInsertMathBlock: () => void;
  onInsertProof: () => void;
  onInsertTheorem: () => void;
  onInsertWorkedExample: () => void;
  onNoteInsertApplied: (id: string) => void;
  onNoteContentChange: (value: JSONContent) => void;
  onNoteMathChange: (value: MathBlock[]) => void;
  onRetryNoteSave: () => void;
  onNoteTitleChange: (value: string) => void;
  onOpenGraphBlock?: (block: Extract<MathBlock, { type: "graph" }>) => void;
  onSaveNoteNow: () => void;
  onSendToGraph?: (expression: string) => void;
  surface?: "workspace" | "whiteboard";
}) {
  const [showGuide, setShowGuide] = useState(true);
  const [showInsertTools, setShowInsertTools] = useState(false);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [commandValue, setCommandValue] = useState("");
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  const noteLooksBlank =
    noteMath.length === 0 &&
    noteTitle.trim().length === 0 &&
    extractPlainText(noteContent).trim().length === 0;

  useEffect(() => {
    setShowGuide(noteLooksBlank);
    setShowInsertTools(noteLooksBlank);
    setShowSlashCommands(false);
    setCommandValue("");
  }, [currentNotebookSection?.id, selectedLessonTitle]);

  const slashCommands = useMemo(
    () => [
      {
        id: "definition",
        command: "/definition",
        label: "Definition",
        hint: "Drop in a term, meaning, and why-it-matters template.",
        action: onInsertDefinition,
      },
      {
        id: "theorem",
        command: "/theorem",
        label: "Theorem",
        hint: "Capture the statement and the exact conditions for use.",
        action: onInsertTheorem,
      },
      {
        id: "proof",
        command: "/proof",
        label: "Proof",
        hint: "Lay out the claim, strategy, and proof steps in order.",
        action: onInsertProof,
      },
      {
        id: "example",
        command: "/example",
        label: "Worked example",
        hint: "Turn a procedure into a worked example with a takeaway.",
        action: onInsertWorkedExample,
      },
      {
        id: "formula",
        command: "/formula",
        label: "Formula reference",
        hint: "Add a formula note and pair it with a reusable math block.",
        action: onInsertFormulaReference,
      },
      {
        id: "graph",
        command: "/graph",
        label: "Graph note",
        hint: "Capture the graph focus and open a matching graph block.",
        action: onInsertGraphNote,
      },
    ],
    [
      onInsertDefinition,
      onInsertFormulaReference,
      onInsertGraphNote,
      onInsertProof,
      onInsertTheorem,
      onInsertWorkedExample,
    ],
  );

  const matchingSlashCommands = useMemo(() => {
    const normalized = commandValue.trim().toLowerCase().replace(/^\//, "");
    if (!normalized) {
      return slashCommands;
    }

    return slashCommands.filter(
      (item) =>
        item.command.includes(normalized) ||
        item.label.toLowerCase().includes(normalized) ||
        item.hint.toLowerCase().includes(normalized),
    );
  }, [commandValue, slashCommands]);

  const runSlashCommand = (value?: string) => {
    const normalized = (value ?? commandValue).trim().toLowerCase().replace(/^\//, "");
    if (!normalized) {
      return;
    }

    const match = slashCommands.find(
      (item) =>
        item.command.slice(1) === normalized ||
        item.label.toLowerCase() === normalized,
    );

    if (!match) {
      return;
    }

    match.action();
    setCommandValue("");
  };

  return (
    <WorkspacePanel
      actions={
        <Button onClick={onEnterNotebookFocus} size="sm" type="button" variant="outline">
          <FileText data-icon="inline-start" />
          Notebook focus
        </Button>
      }
      className={surface === "whiteboard" ? "h-full min-h-0" : "min-h-[680px]"}
      description={
        currentNotebookSection
          ? `Private lesson notes inside ${currentNotebookSection.title}`
          : "Private lesson notes for this lesson"
      }
      title="Private notes"
    >
      <div
        className="private-notes-content mx-auto flex max-w-[104ch] flex-col gap-4"
        data-maximize-module-space-target="notes-shell"
      >
        <div
          className="private-notes-overview rounded-[22px] border border-border/70 bg-background/72 p-3.5 shadow-sm"
          data-compact-module-header="private-notes"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Current lesson note
              </p>
              <h4 className="mt-1.5 text-lg font-semibold tracking-tight">
                {selectedLessonTitle}
              </h4>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                This stays beside the source, but it writes into the larger notebook structure behind it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={autosaveStatus === "saved" ? "secondary" : "outline"}>{noteSaveLabel}</Badge>
              {currentNotebookSection ? (
                <Badge variant="outline">{currentNotebookSection.title}</Badge>
              ) : null}
              {noteMath.length > 0 ? <Badge variant="secondary">{noteMath.length} math blocks</Badge> : null}
              <Button
                disabled={autosaveStatus === "saving" || !hasUnsavedNoteChanges}
                onClick={onSaveNoteNow}
                size="sm"
                type="button"
                variant={hasUnsavedNoteChanges ? "default" : "outline"}
              >
                <Save data-icon="inline-start" />
                Save now
              </Button>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              className={toggleChipClass(showGuide)}
              onClick={() => setShowGuide((current) => !current)}
              type="button"
            >
              Guide
            </button>
            <button
              className={toggleChipClass(showInsertTools)}
              onClick={() => setShowInsertTools((current) => !current)}
              type="button"
            >
              Insert tools
            </button>
            <button
              className={toggleChipClass(showSlashCommands)}
              onClick={() => setShowSlashCommands((current) => !current)}
              type="button"
            >
              <Command className="size-3.5" />
              Slash bar
            </button>
            <p
              className={cn(
                "text-xs leading-5",
                autosaveStatus === "error" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {noteSaveError ?? noteSaveDetail}
            </p>
            {canRetryNoteSave ? (
              <Button onClick={onRetryNoteSave} size="sm" type="button" variant="outline">
                Retry save
              </Button>
            ) : null}
          </div>
        </div>

        <div
          className="private-notes-editor-hero rounded-[26px] border border-border/70 bg-card/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-5"
          data-maximize-module-space-target="notes-editor"
          onClick={() => editorInstance?.chain().focus().run()}
          role="presentation"
        >
          <div className="private-notes-editor-intro flex flex-wrap items-start justify-between gap-3" data-compact-module-detail="private-notes-intro">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Notebook slice
              </p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                Write beside the lesson here, then open notebook focus when you want the broader section trail.
              </p>
            </div>
            {currentNotebookSection ? (
              <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
                <p className="font-semibold text-foreground">{currentNotebookSection.title}</p>
                <p>
                  {currentNotebookSection.noteCount}/{currentNotebookSection.lessons.length} lesson notes saved in this section
                </p>
              </div>
            ) : null}
          </div>
          <Input
            className="mb-3 mt-3 border-0 px-0 text-[1.8rem] font-semibold tracking-tight shadow-none focus-visible:ring-0"
            onChange={(event) => onNoteTitleChange(event.target.value)}
            placeholder={`${selectedLessonTitle} notes`}
            value={noteTitle}
          />
          <div className="private-notes-editor-frame rounded-[22px] border border-border/65 bg-background/65 p-3.5 shadow-inner sm:p-4">
            <RichTextEditor
              className="private-notes-editor"
              insertRequest={noteInsertRequest}
              onChange={onNoteContentChange}
              onEditorReady={setEditorInstance}
              onInsertApplied={onNoteInsertApplied}
              value={noteContent}
            />
          </div>
        </div>

        {showGuide ? (
          <div className="rounded-[22px] border border-border/70 bg-background/70 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <BookOpenText className="mt-0.5 size-4 text-primary" />
              <div className="grid gap-2 sm:grid-cols-2">
                <p className="text-sm leading-6 text-muted-foreground">
                  Keep this panel short and focused while you read. Definitions, proofs, formulas, and worked examples can all live here without opening the bigger notebook yet.
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  When you want the full picture, notebook focus keeps this lesson connected to its section notebook instead of throwing you into a separate notes app.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {showInsertTools ? (
          <div className="rounded-[22px] border border-border/70 bg-background/72 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Insert tools</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Keep study blocks close by without letting them crowd the writing surface.
                </p>
              </div>
              <Badge variant="outline">Templates + math</Badge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <QuickInsertButton icon={<Quote className="size-4" />} label="Callout" onClick={onInsertCallout} />
              <QuickInsertButton icon={<Sparkles className="size-4" />} label="Checklist" onClick={onInsertChecklist} />
              <QuickInsertButton icon={<FileText className="size-4" />} label="Worked example" onClick={onInsertWorkedExample} />
              <QuickInsertButton icon={<BookOpenText className="size-4" />} label="Definition" onClick={onInsertDefinition} />
              <QuickInsertButton icon={<Sigma className="size-4" />} label="Theorem" onClick={onInsertTheorem} />
              <QuickInsertButton icon={<Layers2 className="size-4" />} label="Proof" onClick={onInsertProof} />
              <QuickInsertButton icon={<Highlighter className="size-4" />} label="Formula ref" onClick={onInsertFormulaReference} />
              <QuickInsertButton icon={<BookOpenText className="size-4" />} label="Graph note" onClick={onInsertGraphNote} />
              <QuickInsertButton icon={<Highlighter className="size-4" />} label="LaTeX block" onClick={onInsertMathBlock} />
              <QuickInsertButton icon={<BookOpenText className="size-4" />} label="Graph block" onClick={onInsertGraphBlock} />
              <QuickInsertButton icon={<StickyNote className="size-4" />} label="Sticky note" onClick={onCreateSticky} />
            </div>
          </div>
        ) : null}

        {showSlashCommands ? (
          <div className="rounded-[22px] border border-border/70 bg-background/72 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Slash insert</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Type a command like /definition or /graph to insert a structured note block fast.
                </p>
              </div>
              <Badge variant="outline">Serious note flow</Badge>
            </div>

            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                runSlashCommand();
              }}
            >
              <Input
                onChange={(event) => setCommandValue(event.target.value)}
                placeholder="/definition"
                value={commandValue}
              />
              <Button type="submit" variant="outline">
                <Command data-icon="inline-start" />
                Run command
              </Button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {matchingSlashCommands.map((item) => (
                <button
                  className="rounded-full border border-border/70 bg-card/88 px-3 py-2 text-left text-sm font-medium transition hover:border-primary/35 hover:bg-accent/55"
                  key={item.id}
                  onClick={() => runSlashCommand(item.command)}
                  type="button"
                >
                  <span className="font-mono text-xs text-primary">{item.command}</span>
                  <span className="ml-2 text-foreground">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {mathSuggestions.length > 0 ? (
          <div className="rounded-[22px] border border-border/70 bg-background/72 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">Math detected in your notes</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Turn these lines into reusable math blocks or send them straight into Desmos without leaving the notebook.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {mathSuggestions.map((suggestion) => (
                <div className="rounded-xl border border-border/70 bg-card/85 p-3 shadow-sm" key={suggestion.key}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{suggestion.source}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{suggestion.helper}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestion.kind === "latex" ? (
                        <Button onClick={() => onAcceptMathSuggestion(suggestion)} size="sm" type="button">
                          {suggestion.label}
                        </Button>
                      ) : (
                        <Button onClick={() => onGraphMathSuggestion(suggestion)} size="sm" type="button">
                          {suggestion.label}
                        </Button>
                      )}
                      <Button onClick={() => onDismissMathSuggestion(suggestion.key)} size="sm" type="button" variant="outline">
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {noteMath.length > 0 ? (
          <div className="rounded-[22px] border border-border/70 bg-background/72 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">Math and graph blocks</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  LaTeX and graph references stay attached to this lesson note and can reopen in Desmos.
                </p>
              </div>
            </div>
            <MathBlocks
              blocks={noteMath}
              editable
              onChange={onNoteMathChange}
              onOpenGraphBlock={onOpenGraphBlock}
              onSendToGraph={onSendToGraph}
            />
          </div>
        ) : null}
      </div>
    </WorkspacePanel>
  );
});

export const BinderNotebookModule = memo(function BinderNotebookModule({
  currentNotebookSection,
  entries,
  onEnterNotebookFocus,
  onSelectLesson,
  sections,
  selectedLessonId,
}: {
  currentNotebookSection: BinderNotebookSection | null;
  entries: BinderNotebookLessonEntry[];
  onEnterNotebookFocus: () => void;
  onSelectLesson: (lesson: BinderLesson) => void;
  sections: BinderNotebookSection[];
  selectedLessonId: string;
}) {
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);
  const [activeSectionId, setActiveSectionId] = useState(currentNotebookSection?.id ?? sections[0]?.id ?? "");
  const [activeLessonId, setActiveLessonId] = useState(selectedLessonId);
  const [viewMode, setViewMode] = useState<"section" | "lesson">("section");

  useEffect(() => {
    setExpandedSectionIds((current) => {
      if (sections.length === 0) {
        return [];
      }

      if (current.length > 0) {
        return current.filter((sectionId) => sections.some((section) => section.id === sectionId));
      }

      return currentNotebookSection ? [currentNotebookSection.id] : [sections[0].id];
    });
  }, [currentNotebookSection?.id, sections]);

  useEffect(() => {
    setActiveLessonId(selectedLessonId);
    if (currentNotebookSection) {
      setActiveSectionId(currentNotebookSection.id);
      setExpandedSectionIds((current) =>
        current.includes(currentNotebookSection.id) ? current : [...current, currentNotebookSection.id],
      );
      setViewMode("section");
      return;
    }

    if (sections[0]) {
      setActiveSectionId(sections[0].id);
    }
  }, [currentNotebookSection, sections, selectedLessonId]);

  const activeSection =
    sections.find((section) => section.id === activeSectionId) ?? currentNotebookSection ?? sections[0] ?? null;
  const activeEntry =
    entries.find((entry) => entry.lesson.id === activeLessonId) ??
    activeSection?.lessons.find((entry) => entry.lesson.id === selectedLessonId) ??
    activeSection?.lessons[0] ??
    entries[0] ??
    null;

  const notebookStats = useMemo(() => {
    const noteCount = entries.filter((entry) => entry.note).length;
    const totalWords = entries.reduce((sum, entry) => sum + entry.wordCount, 0);
    return {
      noteCount,
      totalWords,
      sectionCount: sections.length,
    };
  }, [entries, sections.length]);

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  };

  const selectSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setViewMode("section");
    setExpandedSectionIds((current) => (current.includes(sectionId) ? current : [...current, sectionId]));
  };

  const selectLesson = (entry: BinderNotebookLessonEntry) => {
    setActiveSectionId(entry.sectionId);
    setActiveLessonId(entry.lesson.id);
    setViewMode("lesson");
    setExpandedSectionIds((current) => (current.includes(entry.sectionId) ? current : [...current, entry.sectionId]));
  };

  return (
    <WorkspacePanel
      actions={
        <Button onClick={onEnterNotebookFocus} size="sm" type="button" variant="outline">
          <FileText data-icon="inline-start" />
          Notebook focus
        </Button>
      }
      className="min-h-[720px]"
      description="A full-picture notebook view across the binder, section by section."
      title="Binder notebook"
    >
      <div className="grid gap-4 2xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <aside className="binder-notebook-nav flex min-h-0 flex-col gap-3 rounded-[22px] border border-border/70 bg-background/72 p-3 shadow-sm 2xl:p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Notebook hierarchy
            </p>
            <h4 className="mt-1.5 text-lg font-semibold tracking-tight">Binder to section to lesson notes</h4>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Keep the side note panel light, then use this outline when you want the broader notebook trail and section-level structure.
            </p>
          </div>

          <div className="hidden gap-2 sm:grid sm:grid-cols-3 2xl:grid-cols-1">
            <StatTile label="Sections" value={String(notebookStats.sectionCount)} />
            <StatTile label="Notes saved" value={`${notebookStats.noteCount}/${entries.length}`} />
            <StatTile label="Words captured" value={String(notebookStats.totalWords)} />
          </div>

          <div className="flex min-h-0 flex-col gap-2 2xl:overflow-y-auto 2xl:pr-1">
            {sections.map((section) => {
              const expanded = expandedSectionIds.includes(section.id);
              const isActiveSection = activeSection?.id === section.id;
              return (
                <section
                  className={cn(
                    "rounded-2xl border px-3.5 py-3 transition",
                    isActiveSection
                      ? "border-primary/35 bg-accent/55 shadow-sm"
                      : "border-border/70 bg-card/86",
                  )}
                  key={section.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <button
                        className="mt-0.5 rounded-full border border-border/70 bg-background/70 p-1 text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                        onClick={() => toggleSection(section.id)}
                        type="button"
                      >
                        {expanded ? (
                          <ChevronDown className="size-4 shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0" />
                        )}
                      </button>
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => selectSection(section.id)}
                        type="button"
                      >
                        <p className="text-sm font-semibold leading-6">{section.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {section.description}
                        </p>
                      </button>
                    </div>
                    <Badge variant={section.noteCount > 0 ? "secondary" : "outline"}>
                      {section.noteCount}/{section.lessons.length}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span>{section.totalWords} words</span>
                    <span>{section.totalMathBlocks} math blocks</span>
                    {section.updatedAt ? <span>Updated {formatNotebookTimestamp(section.updatedAt)}</span> : null}
                  </div>

                  {expanded ? (
                    <div className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3">
                      {section.lessons.map((entry, index) => {
                        const isActiveLesson = entry.lesson.id === activeEntry?.lesson.id && viewMode === "lesson";
                        return (
                          <button
                            className={cn(
                              "rounded-xl border px-3 py-2 text-left transition",
                              isActiveLesson
                                ? "border-primary/35 bg-background/90 shadow-sm"
                                : "border-transparent bg-background/45 hover:border-primary/20 hover:bg-background/80",
                            )}
                            key={entry.lesson.id}
                            onClick={() => selectLesson(entry)}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Lesson {String(index + 1).padStart(2, "0")}
                                </p>
                                <p className="mt-1 text-sm font-medium leading-6">{entry.lesson.title}</p>
                              </div>
                              <Badge variant={entry.note ? "secondary" : "outline"}>
                                {entry.note ? "Saved" : "Empty"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {entry.excerpt || "This lesson is ready for notes."}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </aside>

        <section className="binder-notebook-view flex min-h-0 flex-col gap-4 rounded-[24px] border border-border/70 bg-card/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-5">
          {viewMode === "section" && activeSection ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Section notebook
                  </p>
                  <h4 className="mt-2 text-2xl font-semibold tracking-tight">{activeSection.title}</h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {activeSection.description} This is the broader notebook lane behind the lesson-local note panel, so you can read the full study trail without losing the section structure.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{activeSection.noteCount}/{activeSection.lessons.length} notes saved</Badge>
                  <Badge variant="outline">{activeSection.totalWords} words</Badge>
                  {activeSection.updatedAt ? (
                    <Badge variant="outline">Updated {formatNotebookTimestamp(activeSection.updatedAt)}</Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <StatTile label="Saved notes" value={`${activeSection.noteCount}/${activeSection.lessons.length}`} />
                <StatTile label="Math blocks" value={String(activeSection.totalMathBlocks)} />
                <StatTile label="Latest activity" value={activeSection.updatedAt ? formatNotebookTimestamp(activeSection.updatedAt) : "Waiting"} />
              </div>

              <div className="binder-notebook-stream flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                {activeSection.lessons.map((entry, index) => (
                  <article
                    className="binder-notebook-stream-card rounded-[22px] border border-border/70 bg-background/72 p-4 shadow-sm"
                    key={entry.lesson.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Lesson {String(index + 1).padStart(2, "0")}
                        </p>
                        <h5 className="mt-1 text-lg font-semibold tracking-tight">{entry.lesson.title}</h5>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={entry.note ? "secondary" : "outline"}>
                          {entry.note ? "Saved note" : "Ready for notes"}
                        </Badge>
                        {entry.updatedAt ? (
                          <Badge variant="outline">{formatNotebookTimestamp(entry.updatedAt)}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {entry.excerpt || "Use the lesson-local panel to start this note, then come back here for the full section view."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span>{entry.wordCount} words</span>
                      <span>{entry.mathBlockCount} math blocks</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={() => selectLesson(entry)} size="sm" type="button">
                        <FileText data-icon="inline-start" />
                        View full note
                      </Button>
                      <Button onClick={() => onSelectLesson(entry.lesson)} size="sm" type="button" variant="outline">
                        <BookOpenText data-icon="inline-start" />
                        Open lesson panel
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : activeEntry ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Full lesson note
                  </p>
                  <h4 className="mt-2 text-2xl font-semibold tracking-tight">{activeEntry.lesson.title}</h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    This is the deeper notebook view for the current lesson. Use it when you want the full note, then jump back to the split-study panel when you are reading beside the source again.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeSection ? <Badge variant="outline">{activeSection.title}</Badge> : null}
                  {activeEntry.note ? <Badge variant="secondary">{activeEntry.wordCount} words</Badge> : null}
                  {activeEntry.note?.updated_at ? (
                    <Badge variant="outline">Saved {formatNotebookTimestamp(activeEntry.note.updated_at)}</Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeSection ? (
                  <Button onClick={() => selectSection(activeSection.id)} size="sm" type="button" variant="outline">
                    <Layers2 data-icon="inline-start" />
                    Back to section notebook
                  </Button>
                ) : null}
                <Button onClick={() => onSelectLesson(activeEntry.lesson)} size="sm" type="button">
                  <BookOpenText data-icon="inline-start" />
                  Open lesson note
                </Button>
              </div>

              {activeEntry.note ? (
                <>
                  <div className="rounded-[22px] border border-border/70 bg-background/70 p-4 shadow-inner sm:p-5">
                    <p className="text-lg font-semibold tracking-tight">{activeEntry.note.title}</p>
                    <div className="mt-4">
                      <RichTextEditor
                        className="binder-notebook-editor"
                        editable={false}
                        placeholder=""
                        surface="lesson"
                        value={activeEntry.note.content}
                      />
                    </div>
                  </div>

                  {activeEntry.note.math_blocks.length > 0 ? (
                    <div className="rounded-[22px] border border-border/70 bg-background/72 p-5 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold">Math and graph blocks</h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Saved with this lesson note and ready to reopen in the lesson workspace.
                          </p>
                        </div>
                        <Badge variant="outline">{activeEntry.note.math_blocks.length} blocks</Badge>
                      </div>
                      <MathBlocks blocks={activeEntry.note.math_blocks} />
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-[22px] border border-dashed border-border/70 bg-background/65 p-6 text-sm leading-6 text-muted-foreground">
                  This lesson is in the notebook outline, but the private note is still empty. Open the lesson-local panel to start writing and it will appear here automatically.
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>
    </WorkspacePanel>
  );
});

function QuickInsertButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/88 px-3 py-2 text-sm font-medium transition hover:border-primary/35 hover:bg-accent/55"
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/85 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function createReadingStats(content: JSONContent) {
  const words = extractPlainText(content)
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    words,
    minutes: Math.max(1, Math.round(words / 190) || 1),
  };
}

function formatNotebookTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function toggleChipClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
    active
      ? "border-primary/30 bg-accent/70 text-foreground"
      : "border-border/70 bg-card/88 text-muted-foreground hover:border-primary/25 hover:text-foreground",
  );
}

