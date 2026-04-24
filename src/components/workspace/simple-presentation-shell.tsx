import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Maximize2,
  Minimize2,
  Route,
  Save,
  Settings2,
  StickyNote,
} from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { MathBlocks } from "@/components/math/math-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatusPill } from "@/components/ui/save-status-pill";
import {
  buildLessonContentSelector,
  LessonContentRenderer,
} from "@/components/workspace/lesson-content-renderer";
import { LessonSelectionToolbar } from "@/components/workspace/lesson-selection-toolbar";
import {
  mergeHistorySources,
  mergeMythChecks,
  mergeTimelineEvents,
} from "@/components/history/history-suite-modules";
import { formatHistoricalDateLabel } from "@/lib/history-dates";
import { extractPlainText } from "@/lib/math-detection";
import { simplePresentationThemeOptions } from "@/lib/workspace-preferences";
import { cn } from "@/lib/utils";
import type { MathBlock, SimplePresentationTheme, WorkspacePreferences } from "@/types";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";

export function SimplePresentationShell({
  context,
  onChange,
  onOpenSettings,
  preferences,
}: {
  context: WorkspaceModuleContext;
  preferences: WorkspacePreferences;
  onChange: (preferences: WorkspacePreferences) => void;
  onOpenSettings: () => void;
}) {
  const settings = preferences.simple;
  const lessonIndex = Math.max(
    0,
    context.lessons.findIndex((lesson) => lesson.id === context.selectedLesson.id),
  );
  const previousLesson = lessonIndex > 0 ? context.lessons[lessonIndex - 1] : null;
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < context.lessons.length - 1
      ? context.lessons[lessonIndex + 1]
      : null;
  const readingStats = useMemo(() => createReadingStats(context.selectedLesson.content), [
    context.selectedLesson.content,
  ]);
  const timelineEvents = useMemo(
    () => mergeTimelineEvents(context.history.templateEvents, context.history.events),
    [context.history.events, context.history.templateEvents],
  );
  const activeEvent =
    timelineEvents.find((event) => event.id === context.history.activeEventId) ??
    timelineEvents[lessonIndex] ??
    timelineEvents[0] ??
    null;
  const sources = useMemo(
    () => mergeHistorySources(context.history.templateSources, context.history.sources),
    [context.history.sources, context.history.templateSources],
  );
  const myths = useMemo(
    () => mergeMythChecks(context.history.templateMythChecks, context.history.mythChecks),
    [context.history.mythChecks, context.history.templateMythChecks],
  );
  const mathBlocks = context.selectedLesson.math_blocks;
  const formulaBlocks = mathBlocks.filter((block): block is Extract<MathBlock, { type: "latex" }> =>
    block.type === "latex",
  );
  const graphBlocks = mathBlocks.filter((block): block is Extract<MathBlock, { type: "graph" }> =>
    block.type === "graph",
  );

  const setSimple = (patch: Partial<WorkspacePreferences["simple"]>) => {
    onChange({
      ...preferences,
      simple: {
        ...settings,
        ...patch,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const setSimpleTheme = (theme: SimplePresentationTheme) => {
    setSimple({
      accentColor:
        theme === "history-gold"
          ? "history-gold"
          : theme === "math-blue"
            ? "math-blue"
            : settings.accentColor,
      theme,
    });
  };

  const showDrawer = settings.showSideNotes || settings.showStudyDrawer;

  return (
    <section
      className="simple-presentation-shell"
      data-simple-accent={settings.accentColor}
      data-simple-contrast={settings.highContrast ? "high" : "normal"}
      data-simple-focus-mode={settings.focusMode ? "on" : "off"}
      data-simple-font-size={settings.fontSize}
      data-simple-motion={settings.motion}
      data-simple-reading-width={settings.readingWidth}
      data-simple-theme={settings.theme}
      data-testid="simple-presentation-shell"
    >
      <div className="simple-presentation-shell__body">
        <article className="simple-presentation-main" data-testid="simple-primary-module">
          <header className="simple-presentation-hero">
            <div className="min-w-0">
              <p className="simple-presentation-kicker">
                {context.history.enabled ? "History story" : "Study lesson"}
              </p>
              <h2>{context.selectedLesson.title}</h2>
              <p>
                {context.history.enabled
                  ? "Follow the story, compare evidence, and trace causes instead of memorizing isolated facts."
                  : "Read the source, work the example, and keep your own explanation beside it."}
              </p>
            </div>
            <div className="simple-presentation-actions">
              <Button asChild size="sm" type="button" variant="outline">
                <Link aria-label="Workspace home" to="/dashboard">
                  <Home data-icon="inline-start" />
                  Workspace
                </Link>
              </Button>
              <label className="simple-theme-select">
                <span>Study color</span>
                <select
                  aria-label="Study color theme"
                  onChange={(event) => setSimpleTheme(event.target.value as SimplePresentationTheme)}
                  value={settings.theme}
                >
                  {simplePresentationThemeOptions.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={onOpenSettings} size="sm" type="button" variant="outline">
                <Settings2 data-icon="inline-start" />
                Settings
              </Button>
              <Button
                onClick={() => setSimple({ focusMode: !settings.focusMode })}
                size="sm"
                type="button"
                variant={settings.focusMode ? "default" : "outline"}
              >
                {settings.focusMode ? (
                  <Minimize2 data-icon="inline-start" />
                ) : (
                  <Maximize2 data-icon="inline-start" />
                )}
                {settings.focusMode ? "Exit focus" : "Focus"}
              </Button>
            </div>
          </header>

          <div className="simple-presentation-stats">
            <SimpleStat label="Progress" value={`${lessonIndex + 1}/${context.lessons.length}`} />
            <SimpleStat label="Reading" value={`${readingStats.minutes} min`} />
            <SimpleStat label="Highlights" value={String(context.highlights.length)} />
            {context.history.enabled && activeEvent ? (
              <SimpleStat label="Now" value={formatHistoricalDateLabel(activeEvent)} />
            ) : null}
          </div>

          <section className="simple-reading-card">
            <div className="simple-reading-card__meta">
              <Badge variant="secondary">{context.binder.subject}</Badge>
              <Badge variant="outline">{context.binder.level}</Badge>
              {context.highlightStatus.state !== "idle" ? (
                <SaveStatusPill snapshot={context.highlightStatus} />
              ) : null}
            </div>
            <div className="simple-reading-surface">
              <LessonContentRenderer
                content={context.selectedLesson.content}
                highlights={context.highlights}
                lessonId={context.selectedLesson.id}
              />
              <LessonSelectionToolbar
                containerSelector={buildLessonContentSelector(context.selectedLesson.id)}
                defaultHighlightColor={context.defaultHighlightColor}
                highlights={context.highlights}
                onHighlight={context.onAddHighlight}
                onQuoteToNotes={context.onCreateQuoteExcerpt}
                onRemoveHighlight={context.onRemoveHighlight}
                onSaveAsEvidence={context.onSaveSelectionAsEvidence}
                onSendToNotes={context.onSendSelectionToNotes}
                onStickyNote={context.onPrepareComment}
              />
            </div>
          </section>

          <div className="simple-lesson-nav">
            <Button
              disabled={!previousLesson}
              onClick={() => previousLesson && context.onSelectLesson(previousLesson)}
              type="button"
              variant="outline"
            >
              <ChevronLeft data-icon="inline-start" />
              Previous
            </Button>
            <Button onClick={() => context.onCreateLooseSticky()} type="button" variant="outline">
              <StickyNote data-icon="inline-start" />
              New sticky
            </Button>
            <Button
              disabled={!nextLesson}
              onClick={() => nextLesson && context.onSelectLesson(nextLesson)}
              type="button"
            >
              Next
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </article>

        {showDrawer ? (
          <aside className="simple-study-drawer" data-testid="simple-study-drawer">
            {settings.showSideNotes ? (
              <section className="simple-drawer-card simple-drawer-card--notes">
                <div className="simple-drawer-card__header">
                  <div>
                    <p className="simple-presentation-kicker">Notes</p>
                    <h3>Build your explanation</h3>
                  </div>
                  <Button
                    disabled={context.autosaveStatus === "saving" || !context.hasUnsavedNoteChanges}
                    onClick={context.onSaveNoteNow}
                    size="sm"
                    type="button"
                    variant={context.hasUnsavedNoteChanges ? "default" : "outline"}
                  >
                    <Save data-icon="inline-start" />
                    Save
                  </Button>
                </div>
                <Input
                  className="simple-notes-title"
                  onChange={(event) => context.onNoteTitleChange(event.target.value)}
                  placeholder={`${context.selectedLesson.title} notes`}
                  value={context.noteTitle}
                />
                <RichTextEditor
                  className="simple-notes-editor"
                  insertRequest={context.noteInsertRequest}
                  onChange={context.onNoteContentChange}
                  onInsertApplied={context.onNoteInsertApplied}
                  value={context.noteContent}
                />
                <p
                  className={cn(
                    "simple-save-note",
                    context.autosaveStatus === "error" && "text-destructive",
                  )}
                >
                  {context.noteSaveError ?? context.noteSaveDetail}
                </p>
              </section>
            ) : null}

            {settings.showStudyDrawer ? (
              <section className="simple-drawer-card">
                {context.history.enabled ? (
                  <HistoryStudyDrawer
                    activeEvent={activeEvent}
                    context={context}
                    myths={myths}
                    sources={sources}
                    timelineEvents={timelineEvents}
                  />
                ) : (
                  <MathStudyDrawer
                    context={context}
                    formulaBlocks={formulaBlocks}
                    graphBlocks={graphBlocks}
                  />
                )}
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>

      {settings.showProgressBar ? (
        <nav className="simple-progress-strip" aria-label="Lesson progress">
          {context.history.enabled && timelineEvents.length > 0
            ? timelineEvents.slice(0, 10).map((event, index) => (
                <button
                  className={cn(event.id === activeEvent?.id && "is-active")}
                  key={event.id}
                  onClick={() => context.onSelectHistoryEvent(event.id)}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {event.title}
                </button>
              ))
            : context.lessons.map((lesson, index) => (
                <button
                  className={cn(lesson.id === context.selectedLesson.id && "is-active")}
                  key={lesson.id}
                  onClick={() => context.onSelectLesson(lesson)}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {lesson.title}
                </button>
              ))}
        </nav>
      ) : null}
    </section>
  );
}

function HistoryStudyDrawer({
  activeEvent,
  context,
  myths,
  sources,
  timelineEvents,
}: {
  activeEvent: ReturnType<typeof mergeTimelineEvents>[number] | null;
  context: WorkspaceModuleContext;
  myths: ReturnType<typeof mergeMythChecks>;
  sources: ReturnType<typeof mergeHistorySources>;
  timelineEvents: ReturnType<typeof mergeTimelineEvents>;
}) {
  const activeSource =
    sources.find((source) => source.id === context.history.activeSourceId) ?? sources[0] ?? null;

  return (
    <>
      <div className="simple-drawer-card__header">
        <div>
          <p className="simple-presentation-kicker">History helper</p>
          <h3>Timeline, evidence, interpretation</h3>
        </div>
        <Badge variant="secondary">{timelineEvents.length} events</Badge>
      </div>
      {activeEvent ? (
        <article className="simple-reference-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="simple-presentation-kicker">Current event</p>
              <h4>{activeEvent.title}</h4>
            </div>
            <Badge variant="outline">{formatHistoricalDateLabel(activeEvent)}</Badge>
          </div>
          <p>{activeEvent.significance || activeEvent.summary}</p>
          <Button
            onClick={context.onReplayHistoryTimeline}
            size="sm"
            type="button"
            variant="outline"
          >
            <Route data-icon="inline-start" />
            Start timeline
          </Button>
        </article>
      ) : null}
      {activeSource ? (
        <article className="simple-reference-card">
          <p className="simple-presentation-kicker">Evidence</p>
          <h4>{activeSource.title}</h4>
          <p>{activeSource.claim_supports ?? activeSource.context_note ?? "Use this source as evidence."}</p>
          <Button
            onClick={() => context.onCreateHistoryEvidenceFromSource(activeSource)}
            size="sm"
            type="button"
          >
            <FileText data-icon="inline-start" />
            Save evidence
          </Button>
        </article>
      ) : null}
      {myths[0] ? (
        <article className="simple-reference-card">
          <p className="simple-presentation-kicker">Myth vs history</p>
          <h4>{myths[0].myth_text}</h4>
          <p>{myths[0].corrected_claim}</p>
        </article>
      ) : null}
    </>
  );
}

function MathStudyDrawer({
  context,
  formulaBlocks,
  graphBlocks,
}: {
  context: WorkspaceModuleContext;
  formulaBlocks: Extract<MathBlock, { type: "latex" }>[];
  graphBlocks: Extract<MathBlock, { type: "graph" }>[];
}) {
  return (
    <>
      <div className="simple-drawer-card__header">
        <div>
          <p className="simple-presentation-kicker">Math helper</p>
          <h3>Formula, graph, notes</h3>
        </div>
        <Badge variant="secondary">{formulaBlocks.length + graphBlocks.length} blocks</Badge>
      </div>
      {formulaBlocks.length > 0 ? (
        <div className="simple-reference-card">
          <p className="simple-presentation-kicker">Formula cards</p>
          <MathBlocks blocks={formulaBlocks} onJumpToSource={context.onJumpToMathSource} />
        </div>
      ) : null}
      {graphBlocks.length > 0 ? (
        <div className="simple-reference-card">
          <p className="simple-presentation-kicker">Graphs</p>
          <MathBlocks
            blocks={graphBlocks}
            onOpenGraphBlock={context.onOpenGraphBlock}
            onSendToGraph={context.mathModules?.pushExpressionToGraph}
          />
        </div>
      ) : (
        <article className="simple-reference-card">
          <Calculator className="size-4 text-primary" />
          <h4>Graph and calculator drawer</h4>
          <p>Open a graph block or add one from notes when the lesson needs a visual check.</p>
          <Button onClick={context.onInsertGraphBlock} size="sm" type="button" variant="outline">
            Add graph note
          </Button>
        </article>
      )}
    </>
  );
}

function SimpleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="simple-stat">
      <span>{label}</span>
      <strong>{value}</strong>
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
