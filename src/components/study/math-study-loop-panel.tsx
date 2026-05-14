import { lazy, Suspense, useMemo, useState, type FormEvent } from "react";
import { BookOpenCheck, BrainCircuit, FunctionSquare, Link2, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hasDesmosApiKey } from "@/lib/desmos-loader";
import {
  addProblemMistakeToReview,
  createProblemLogEntry,
  formatMistakeType,
  listProblemLogEntries,
  mathMistakeTypeOptions,
  saveStudyGraphLink,
  type MathMistakeType,
  type MathProblemLogEntry,
  type MathStudyGraphLink,
} from "@/services/math-study-loop-service";
import { createStudyItem } from "@/services/study-items-service";
import type { CalculatorMode, MathGraphState, MathModuleJson, ModuleExpression, QuestionBankItem } from "@/types/math-learning";

const LazyDesmosGraph = lazy(async () => {
  const module = await import("@/components/math/desmos-graph");
  return { default: module.DesmosGraph };
});

const LazyDesmos3DGraph = lazy(async () => {
  const module = await import("@/components/math/desmos-graph");
  return { default: module.Desmos3DGraph };
});

type FormulaCardInput = NonNullable<MathModuleJson["formulaCards"]>[number];
type PanelQuestion = Pick<QuestionBankItem, "id" | "title" | "prompt_markdown" | "explanation_markdown">;

export function MathStudyLoopPanel({
  activeExpressions,
  activeGraphMode,
  activeGraphState,
  betaEnabled,
  binderId = null,
  binderTitle = null,
  courseId = null,
  courseTitle = null,
  formulaCards,
  graphLinks,
  graphStates,
  moduleId,
  moduleTitle,
  narrowAiBetaEnabled,
  onRestoreGraphState,
  ownerId,
  questions,
  reviewQueueBetaEnabled,
}: {
  activeExpressions: ModuleExpression[];
  activeGraphMode: Exclude<CalculatorMode, "none">;
  activeGraphState: DesmosState | null;
  betaEnabled: boolean;
  binderId?: string | null;
  binderTitle?: string | null;
  courseId?: string | null;
  courseTitle?: string | null;
  formulaCards: FormulaCardInput[];
  graphLinks: MathStudyGraphLink[];
  graphStates: MathGraphState[];
  moduleId: string;
  moduleTitle: string;
  narrowAiBetaEnabled: boolean;
  onRestoreGraphState: (state: DesmosState) => void;
  ownerId: string;
  questions: PanelQuestion[];
  reviewQueueBetaEnabled: boolean;
}) {
  const [problemTitle, setProblemTitle] = useState("");
  const [source, setSource] = useState(moduleTitle);
  const [conceptTags, setConceptTags] = useState("");
  const [attempt, setAttempt] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [mistakeType, setMistakeType] = useState<MathMistakeType>("setup_error");
  const [confidence, setConfidence] = useState("3");
  const [selectedFormulaCardIds, setSelectedFormulaCardIds] = useState<string[]>([]);
  const [selectedGraphLinkId, setSelectedGraphLinkId] = useState("");
  const [graphReflection, setGraphReflection] = useState("");
  const [graphTitle, setGraphTitle] = useState(`${moduleTitle} graph`);
  const [localGraphLinks, setLocalGraphLinks] = useState<MathStudyGraphLink[]>(() => graphLinks);
  const [problemLogs, setProblemLogs] = useState<MathProblemLogEntry[]>(() => listProblemLogEntries(ownerId));
  const [message, setMessage] = useState<string | null>(null);
  const combinedGraphLinks = useMemo(
    () => [...localGraphLinks, ...graphStates.map(graphStateToStudyLink(ownerId))],
    [graphStates, localGraphLinks, ownerId],
  );
  const firstQuestion = questions[0] ?? null;

  if (!betaEnabled) {
    return null;
  }

  const createProblemLog = (event: FormEvent) => {
    event.preventDefault();
    const entry = createProblemLogEntry({
      attempt,
      betaEnabled,
      binderId,
      binderTitle,
      conceptTags,
      confidence: Number(confidence),
      courseId,
      courseTitle,
      finalAnswer,
      formulaCardIds: selectedFormulaCardIds,
      graphLinkId: selectedGraphLinkId || null,
      mistakeType,
      ownerId,
      problemTitle,
      source,
    });
    setProblemLogs((current) => [entry, ...current]);
    setProblemTitle("");
    setAttempt("");
    setFinalAnswer("");
    setSelectedFormulaCardIds([]);
    setSelectedGraphLinkId("");
    setMessage("Problem log saved.");
  };

  const toggleFormulaLink = (formulaId: string, checked: boolean) => {
    setSelectedFormulaCardIds((current) =>
      checked ? [...new Set([...current, formulaId])] : current.filter((id) => id !== formulaId),
    );
  };

  const saveCurrentGraph = () => {
    if (!activeGraphState) {
      setMessage("Open or edit a graph before saving graph context.");
      return;
    }
    const link = saveStudyGraphLink({
      betaEnabled,
      desmosState: activeGraphState,
      expressions: activeExpressions,
      graphStateId: `${moduleId}:active`,
      mode: activeGraphMode,
      ownerId,
      reflection: graphReflection || "What this graph shows is still being written.",
      title: graphTitle || `${moduleTitle} graph`,
    });
    setLocalGraphLinks((current) => [link, ...current]);
    setGraphReflection("");
    setMessage("Graph context saved to the Math Study Loop.");
  };

  const addFormulaToReview = (formula: FormulaCardInput) => {
    if (!reviewQueueBetaEnabled) {
      setMessage("Turn on Beta Revamp - Review Queue before adding formula cards to review.");
      return;
    }
    createStudyItem({
      answer: formula.explanation?.trim() || formula.latex,
      betaEnabled: reviewQueueBetaEnabled,
      courseId,
      courseTitle,
      ownerId,
      prompt: `Explain ${formula.label} and name one common mistake.`,
      sourceExcerpt: formula.latex,
      sourceId: formula.id,
      sourceKind: "formula",
      sourceTitle: formula.label,
      type: "formula_card",
    });
    setMessage(`${formula.label} added to Review Queue.`);
  };

  const addMistakeToReview = (problemLog: MathProblemLogEntry) => {
    if (!reviewQueueBetaEnabled) {
      setMessage("Turn on Beta Revamp - Review Queue before reviewing mistakes.");
      return;
    }
    addProblemMistakeToReview({
      betaEnabled,
      ownerId,
      problemLog,
      reviewQueueBetaEnabled,
    });
    setProblemLogs(listProblemLogEntries(ownerId));
    setMessage("Mistake review item added.");
  };

  const activeGraphLink: MathStudyGraphLink | null = activeGraphState
    ? {
        created_at: new Date(0).toISOString(),
        desmos_state: activeGraphState,
        expressions: activeExpressions,
        formula_card_id: null,
        graph_state_id: `${moduleId}:active`,
        id: `${moduleId}:active-preview`,
        mode: activeGraphMode,
        note_id: null,
        owner_id: ownerId,
        problem_log_id: null,
        reflection: graphReflection || "Save a reflection to explain what this graph shows.",
        title: "Current module graph",
        updated_at: new Date(0).toISOString(),
      }
    : null;

  return (
    <section
      className="page-shell grid gap-5 p-5"
      data-beta-revamp-math-study-loop="true"
      data-testid="math-study-loop-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant="secondary">Beta Revamp</Badge>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Math Study Loop</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Connect problem attempts, formulas, graph context, mistakes, notes, and review without turning BinderNotes into a calculator clone.
          </p>
        </div>
        <Badge variant="outline">{moduleTitle}</Badge>
      </div>

      {message ? <p className="rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm" role="status">{message}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Math Problem Log</CardTitle>
            <CardDescription>Capture the attempt, mistake pattern, graph/formula context, and review target.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={createProblemLog}>
              <label className="grid gap-1.5 text-sm font-medium">
                Problem title
                <Input onChange={(event) => setProblemTitle(event.target.value)} required value={problemTitle} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Source
                <Input onChange={(event) => setSource(event.target.value)} required value={source} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Concept tags
                <Input onChange={(event) => setConceptTags(event.target.value)} placeholder="limits, derivatives" value={conceptTags} />
              </label>
              {combinedGraphLinks.length ? (
                <label className="grid gap-1.5 text-sm font-medium">
                  Graph link
                  <select
                    aria-label="Graph link"
                    className="appearance-select h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    onChange={(event) => setSelectedGraphLinkId(event.target.value)}
                    value={selectedGraphLinkId}
                  >
                    <option value="">No graph linked</option>
                    {combinedGraphLinks.map((link) => (
                      <option key={link.id} value={link.id}>
                        {link.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {formulaCards.length ? (
                <fieldset className="grid gap-2 rounded-lg border border-border/70 p-3">
                  <legend className="px-1 text-sm font-medium">Formula links</legend>
                  {formulaCards.map((formula) => (
                    <label className="flex items-center gap-2 text-sm" key={formula.id}>
                      <input
                        aria-label={`Link formula ${formula.label}`}
                        checked={selectedFormulaCardIds.includes(formula.id)}
                        className="size-4"
                        onChange={(event) => toggleFormulaLink(formula.id, event.target.checked)}
                        type="checkbox"
                      />
                      {formula.label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <label className="grid gap-1.5 text-sm font-medium">
                Attempt
                <Textarea onChange={(event) => setAttempt(event.target.value)} required value={attempt} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Final answer
                <Input onChange={(event) => setFinalAnswer(event.target.value)} value={finalAnswer} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Mistake type
                  <select
                    aria-label="Mistake type"
                    className="appearance-select h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    onChange={(event) => setMistakeType(event.target.value as MathMistakeType)}
                    value={mistakeType}
                  >
                    {mathMistakeTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Confidence
                  <Input max={5} min={1} onChange={(event) => setConfidence(event.target.value)} type="number" value={confidence} />
                </label>
              </div>
              <Button className="justify-self-start" type="submit">
                <Save data-icon="inline-start" />
                Create problem log
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved graph states</CardTitle>
            <CardDescription>Save graph context with a reflection, then restore it from study cards.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Graph title
              <Input onChange={(event) => setGraphTitle(event.target.value)} value={graphTitle} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              What this graph shows
              <Textarea onChange={(event) => setGraphReflection(event.target.value)} value={graphReflection} />
            </label>
            <Button onClick={saveCurrentGraph} type="button" variant="outline">
              <FunctionSquare data-icon="inline-start" />
              Save graph to Math Study Loop
            </Button>
            {activeGraphLink ? (
              <GraphStudyCard graphLink={activeGraphLink} onRestoreGraphState={onRestoreGraphState} />
            ) : (
              <EmptyState description="Open or edit a graph to save it with a reflection." title="No active graph state" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formula and theorem cards</CardTitle>
          <CardDescription>Math references stay useful when they carry meaning, examples, mistakes, proof ideas, and graph links.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {formulaCards.length ? (
            formulaCards.map((formula) => (
              <FormulaStudyCard
                firstGraphLink={combinedGraphLinks[0] ?? null}
                firstQuestion={firstQuestion}
                formula={formula}
                key={formula.id}
                onAddToReview={() => addFormulaToReview(formula)}
                reviewQueueBetaEnabled={reviewQueueBetaEnabled}
              />
            ))
          ) : (
            <EmptyState description="Create formula or theorem cards from math notes first." title="No formula cards yet" />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Problem links and mistakes</CardTitle>
          <CardDescription>Problem to formula to graph to mistake to review item.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {problemLogs.length ? (
              problemLogs.map((entry) => (
                <ProblemLogCard entry={entry} key={entry.id} onAddMistakeToReview={addMistakeToReview} reviewQueueBetaEnabled={reviewQueueBetaEnabled} />
              ))
            ) : (
              <EmptyState description="Create a problem log to start a mistake pattern." title="No problem logs yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quiz attempt history</CardTitle>
            <CardDescription>Scored quiz attempts can feed weak concepts and mistake review.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>{questions.length} linked practice questions are available for this module.</p>
            <p>Completed attempts will surface here by question, concept, and mistake pattern when the scored quiz history is available.</p>
          </CardContent>
        </Card>
      </div>

      {combinedGraphLinks.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Graph study cards</CardTitle>
            <CardDescription>Read-only graph context stays compact until a student chooses to restore it.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {combinedGraphLinks.map((link) => (
              <GraphStudyCard graphLink={link} key={link.id} onRestoreGraphState={onRestoreGraphState} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {narrowAiBetaEnabled ? <NarrowAiPlaceholder /> : null}
    </section>
  );
}

function FormulaStudyCard({
  firstGraphLink,
  firstQuestion,
  formula,
  onAddToReview,
  reviewQueueBetaEnabled,
}: {
  firstGraphLink: MathStudyGraphLink | null;
  firstQuestion: PanelQuestion | null;
  formula: FormulaCardInput;
  onAddToReview: () => void;
  reviewQueueBetaEnabled: boolean;
}) {
  const example = firstQuestion?.prompt_markdown ?? `Use ${formula.label} in a worked example.`;
  const proofIdea = formula.explanation
    ? "Connect the statement back to the definition before memorizing the shortcut."
    : "Write the proof idea beside the formula before review.";

  return (
    <article className="rounded-lg border border-border/70 bg-background/82 p-4" data-testid={`math-formula-card-${formula.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge variant="secondary">Formula/theorem</Badge>
          <h3 className="mt-2 text-lg font-semibold">{formula.label}</h3>
        </div>
        {reviewQueueBetaEnabled ? (
          <Button onClick={onAddToReview} size="sm" type="button" variant="outline">
            <BookOpenCheck data-icon="inline-start" />
            Add to Review
          </Button>
        ) : null}
      </div>
      <p className="mt-3 rounded-md bg-secondary/35 px-3 py-2 font-mono text-sm">{formula.latex}</p>
      <dl className="mt-3 grid gap-2 text-sm leading-6">
        <div>
          <dt className="font-semibold">Plain-English meaning</dt>
          <dd className="text-muted-foreground">{formula.explanation ?? "Explain what this statement does in your own words."}</dd>
        </div>
        <div>
          <dt className="font-semibold">Example problem</dt>
          <dd className="text-muted-foreground">{example}</dd>
        </div>
        <div>
          <dt className="font-semibold">Common mistake</dt>
          <dd className="text-muted-foreground">Formula misuse: applying the shortcut before checking the setup.</dd>
        </div>
        <div>
          <dt className="font-semibold">Proof idea</dt>
          <dd className="text-muted-foreground">{proofIdea}</dd>
        </div>
        {firstGraphLink ? (
          <div>
            <dt className="font-semibold">Graph link</dt>
            <dd className="text-muted-foreground">{firstGraphLink.title}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export function GraphStudyCard({
  graphLink,
  onRestoreGraphState,
}: {
  graphLink: MathStudyGraphLink;
  onRestoreGraphState: (state: DesmosState) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const desmosAvailable = hasDesmosApiKey();

  return (
    <article className="rounded-lg border border-border/70 bg-background/82 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge variant="outline">Compact graph preview</Badge>
          <h3 className="mt-2 font-semibold">{graphLink.title}</h3>
        </div>
        <Button onClick={() => onRestoreGraphState(graphLink.desmos_state)} size="sm" type="button" variant="outline">
          <RotateCcw data-icon="inline-start" />
          Restore graph
        </Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{graphLink.reflection}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {graphLink.expressions.map((expression, index) => (
          <Badge key={`${expression.id ?? "expr"}-${index}`} variant="secondary">
            {expression.latex}
          </Badge>
        ))}
      </div>
      {!desmosAvailable ? (
        <p className="mt-3 rounded-md border border-border/70 bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
          Desmos key is missing, so BinderNotes keeps this as a compact saved graph preview.
        </p>
      ) : (
        <Button className="mt-3" onClick={() => setExpanded((current) => !current)} size="sm" type="button" variant="ghost">
          <Link2 data-icon="inline-start" />
          {expanded ? "Collapse read-only graph" : "Open read-only graph"}
        </Button>
      )}
      {expanded && desmosAvailable ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-border/70">
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading graph preview...</div>}>
            {graphLink.mode === "3d" ? (
              <LazyDesmos3DGraph height="320px" state={graphLink.desmos_state} />
            ) : (
              <LazyDesmosGraph height="320px" state={graphLink.desmos_state} />
            )}
          </Suspense>
        </div>
      ) : null}
    </article>
  );
}

function ProblemLogCard({
  entry,
  onAddMistakeToReview,
  reviewQueueBetaEnabled,
}: {
  entry: MathProblemLogEntry;
  onAddMistakeToReview: (entry: MathProblemLogEntry) => void;
  reviewQueueBetaEnabled: boolean;
}) {
  return (
    <article className="rounded-lg border border-border/70 bg-background/82 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{entry.problem_title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{entry.source}</p>
        </div>
        <Badge variant="outline">{formatMistakeType(entry.mistake_type)}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{entry.attempt}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {entry.concept_tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
        {entry.graph_link_id ? <Badge variant="outline">graph linked</Badge> : null}
        {entry.formula_card_ids.length ? <Badge variant="outline">formula linked</Badge> : null}
      </div>
      {reviewQueueBetaEnabled ? (
        <Button className="mt-3" onClick={() => onAddMistakeToReview(entry)} size="sm" type="button" variant="outline">
          <BookOpenCheck data-icon="inline-start" />
          Review mistake
        </Button>
      ) : null}
    </article>
  );
}

function NarrowAiPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="size-5 text-primary" />
          Source-grounded AI study helpers
        </CardTitle>
        <CardDescription>Placeholders only: each helper must work from selected notes, attempts, formulas, or source links.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <p>Generate 5 recall questions from selected notes or sources</p>
        <p>Explain a mistake using the student's attempt</p>
        <p>Suggest review tags from saved problem logs</p>
        <p>Create editable formula cards with source links</p>
      </CardContent>
    </Card>
  );
}

function graphStateToStudyLink(ownerId: string) {
  return (graph: MathGraphState): MathStudyGraphLink => ({
    created_at: graph.created_at,
    desmos_state: graph.desmos_state,
    expressions: graph.expressions ?? [],
    formula_card_id: null,
    graph_state_id: graph.id,
    id: `saved:${graph.id}`,
    mode: graph.calculator_mode,
    note_id: graph.note_id,
    owner_id: ownerId,
    problem_log_id: null,
    reflection: "Saved graph state from this account.",
    title: graph.title,
    updated_at: graph.updated_at,
  });
}
