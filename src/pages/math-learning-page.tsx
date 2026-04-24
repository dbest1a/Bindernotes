import katex from "katex";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cuboid,
  FileQuestion,
  FunctionSquare,
  LibraryBig,
  ListChecks,
  Plus,
  Save,
  Sparkles,
} from "lucide-react";
import { Desmos3DGraph, DesmosGraph } from "@/components/math/desmos-graph";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  useCompleteQuizAttempt,
  useCreateQuizSet,
  useMathCourseBundle,
  useMathCourses,
  useMathModuleBundle,
  useMathModules,
  useQuestionBank,
  useQuizSet,
  useSaveMathGraphState,
  useSaveQuestion,
  useStartQuizAttempt,
  useSubmitQuestionAttempt,
} from "@/hooks/use-math-learning";
import type { SubmittedQuestionAnswer } from "@/lib/question-scoring";
import { cn } from "@/lib/utils";
import type {
  MathCourse,
  MathModule,
  QuestionBankItem,
  QuestionChoice,
  QuestionType,
} from "@/types/math-learning";

const questionTypes: QuestionType[] = [
  "multiple_choice",
  "multiple_select",
  "true_false",
  "short_answer",
  "numeric",
  "free_response",
  "fill_blank",
  "matching",
  "step_ordering",
];

type ActiveGraphMode = Exclude<MathModule["calculator_mode"], "none">;

export function MathLandingPage() {
  const coursesQuery = useMathCourses();
  const modulesQuery = useMathModules();

  if (coursesQuery.isLoading || modulesQuery.isLoading) {
    return <MathPageSkeleton />;
  }

  const courses = coursesQuery.data ?? [];
  const modules = modulesQuery.data ?? [];

  return (
    <main className="app-page max-w-[1540px]">
      <Breadcrumbs items={[{ label: "Workspace", to: "/dashboard" }, { label: "Math" }]} />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.55fr)]">
        <div className="page-shell p-6 sm:p-8">
          <Badge variant="outline">Math learning</Badge>
          <h1 className="mt-4 page-heading max-w-4xl text-4xl sm:text-5xl">
            Jacob's Math Notes, upgraded with Desmos graphs and practice that saves.
          </h1>
          <p className="mt-4 max-w-2xl page-copy">
            Move from Geometry to Real Analysis with formula cards, 2D and 3D graph modules,
            saved graph states, and linked practice.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/math/modules/derivative-as-slope">
                <FunctionSquare data-icon="inline-start" />
                Start a Math Module
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/math/questions">
                <FileQuestion data-icon="inline-start" />
                Open Question Bank
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/math/lab">Free math lab</Link>
            </Button>
          </div>
        </div>

        <aside className="hero-aside">
          <p className="page-kicker">What is live now</p>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>Jacob Math Notes modules from Geometry through Real Analysis.</p>
            <p>2D and 3D Desmos modules with safe unavailable fallbacks.</p>
            <p>Manual question authoring, scoring, quiz attempts, and saved graph states.</p>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {courses.map((course) => (
          <CourseCard course={course} key={course.id} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {modules.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </section>
    </main>
  );
}

export function MathCoursePage() {
  const { courseSlug } = useParams();
  const bundleQuery = useMathCourseBundle(courseSlug);

  if (bundleQuery.isLoading) {
    return <MathPageSkeleton />;
  }

  const bundle = bundleQuery.data;
  if (!bundle) {
    return <Navigate replace to="/math" />;
  }

  return (
    <main className="app-page">
      <Breadcrumbs
        items={[
          { label: "Workspace", to: "/dashboard" },
          { label: "Math", to: "/math" },
          { label: bundle.course.title },
        ]}
      />
      <section className="page-shell p-6">
        <Badge variant="outline">Course</Badge>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{bundle.course.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          {bundle.course.description}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Topics</CardTitle>
            <CardDescription>Move through the course by concept.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {bundle.topics.map((topic) => (
              <div
                className="rounded-lg border border-border/70 bg-background/75 px-3 py-2 text-sm"
                key={topic.id}
              >
                {topic.title}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {bundle.modules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </section>
    </main>
  );
}

export function MathModulesPage() {
  const modulesQuery = useMathModules();

  if (modulesQuery.isLoading) {
    return <MathPageSkeleton />;
  }

  return (
    <main className="app-page">
      <Breadcrumbs
        items={[
          { label: "Workspace", to: "/dashboard" },
          { label: "Math", to: "/math" },
          { label: "Modules" },
        ]}
      />
      <section className="page-shell p-6">
        <h1 className="text-3xl font-semibold tracking-tight">Math modules</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose a visual lesson, explore the graph, then practice the linked questions.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(modulesQuery.data ?? []).map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </section>
    </main>
  );
}

export function MathModulePage() {
  const { moduleSlug } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const bundleQuery = useMathModuleBundle(moduleSlug, profile?.id);
  const createQuiz = useCreateQuizSet();
  const saveGraph = useSaveMathGraphState();
  const [activeGraphMode, setActiveGraphMode] = useState<ActiveGraphMode>("2d");
  const [graphStatesByMode, setGraphStatesByMode] = useState<Record<ActiveGraphMode, DesmosState | null>>({
    "2d": null,
    "3d": null,
  });
  const [selectedGraphCardId, setSelectedGraphCardId] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const loadedModule = bundleQuery.data?.module;

  useEffect(() => {
    if (!loadedModule) {
      return;
    }

    setActiveGraphMode(defaultGraphMode(loadedModule.calculator_mode));
    setGraphStatesByMode({ "2d": null, "3d": null });
    setSelectedGraphCardId(null);
    setSnapshotName("");
    setSaveMessage(null);
  }, [loadedModule?.calculator_mode, loadedModule?.id]);

  if (bundleQuery.isLoading) {
    return <MathPageSkeleton />;
  }

  const bundle = bundleQuery.data;
  if (!bundle || !profile) {
    return <Navigate replace to="/math" />;
  }

  const module = bundle.module;
  const graphCards = module.module_json.graphCards ?? [];
  const selectedGraphCard = graphCards.find((graph) => graph.id === selectedGraphCardId) ?? null;
  const expressions = selectedGraphCard
    ? selectedGraphCard.expressions.map((latex, index) => ({ id: `${selectedGraphCard.id}-${index + 1}`, latex }))
    : module.module_json.expressions ?? [];
  const activeGraphState = graphStatesByMode[activeGraphMode];
  const canSaveGraph = module.calculator_mode !== "none" && Boolean(activeGraphState);
  const setActiveGraphState = (nextState: DesmosState) => {
    setGraphStatesByMode((current) => ({
      ...current,
      [activeGraphMode]: nextState,
    }));
  };

  const startPractice = async () => {
    if (bundle.questions.length === 0) {
      return;
    }
    const quiz = await createQuiz.mutateAsync({
      userId: profile.id,
      questionIds: bundle.questions.map((question) => question.id),
      title: `${module.title} practice`,
      courseId: module.course_id,
      topicId: module.topic_id,
      moduleId: module.id,
    });
    navigate(`/math/quizzes/${quiz.id}/attempt`);
  };

  const saveCurrentGraph = async () => {
    if (!activeGraphState || module.calculator_mode === "none") {
      return;
    }

    const graph = await saveGraph.mutateAsync({
      userId: profile.id,
      moduleId: module.id,
      calculatorMode: activeGraphMode,
      title: snapshotName.trim() || selectedGraphCard?.label || `${module.title} graph`,
      desmosState: activeGraphState,
      expressions,
    });
    setSnapshotName("");
    setSaveMessage(`Saved ${graph.title}`);
  };

  return (
    <main className="app-page max-w-[1680px]">
      <Breadcrumbs
        items={[
          { label: "Workspace", to: "/dashboard" },
          { label: "Math", to: "/math" },
          { label: bundle.course?.title ?? "Course", to: bundle.course ? `/math/courses/${bundle.course.slug}` : "/math" },
          { label: module.title },
        ]}
      />

      <section className="page-shell p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">{bundle.course?.title ?? "Math module"}</Badge>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{module.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              {module.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={startPractice} type="button">
              <ListChecks data-icon="inline-start" />
              Start practice quiz
            </Button>
            <Button asChild variant="outline">
              <Link to={`/math/questions/new?moduleId=${module.id}`}>
                <Plus data-icon="inline-start" />
                Create question
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(560px,1.18fr)]">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Lesson path</CardTitle>
              <CardDescription>{module.module_json.overview}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {(module.module_json.learningGoals ?? []).length > 0 ? (
                <div className="grid gap-2">
                  {(module.module_json.learningGoals ?? []).map((goal) => (
                    <div className="flex gap-2 text-sm leading-6" key={goal}>
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{goal}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {(module.module_json.sections ?? []).map((section) => (
                <div className="rounded-lg border border-border/70 bg-background/80 p-4" key={section.title}>
                  <h2 className="font-semibold tracking-tight">{section.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{section.body}</p>
                </div>
              ))}
              {module.module_json.presetRecommendation ? (
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm">
                  <span className="font-semibold">Recommended workspace: </span>
                  {module.module_json.presetRecommendation}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <FormulaCardGrid formulas={module.module_json.formulaCards ?? []} />
          <GraphCardList
            graphs={graphCards}
            onOpenGraph={(graph) => {
              setSelectedGraphCardId(graph.id);
              setActiveGraphMode(graph.mode);
              setGraphStatesByMode((current) => ({ ...current, [graph.mode]: null }));
              setSaveMessage(null);
            }}
            selectedGraphId={selectedGraphCard?.id ?? null}
          />
          <RelatedConcepts concepts={module.module_json.relatedConcepts ?? []} />
          <PracticeList questions={bundle.questions} />
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {activeGraphMode === "3d" ? (
                    <Cuboid className="size-5 text-primary" />
                  ) : (
                    <FunctionSquare className="size-5 text-primary" />
                  )}
                  Desmos {activeGraphMode === "3d" ? "3D" : "2D"} module
                </CardTitle>
                <CardDescription>{module.module_json.graphNotes}</CardDescription>
              </div>
              {module.calculator_mode !== "none" ? (
                <div className="flex items-center gap-1 rounded-md border border-border/70 bg-background/70 p-1">
                  <Button
                    onClick={() => {
                      setActiveGraphMode("2d");
                      setSaveMessage(null);
                    }}
                    size="sm"
                    type="button"
                    variant={activeGraphMode === "2d" ? "default" : "ghost"}
                  >
                    2D Graph
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveGraphMode("3d");
                      setSaveMessage(null);
                    }}
                    size="sm"
                    type="button"
                    variant={activeGraphMode === "3d" ? "default" : "ghost"}
                  >
                    3D Graph
                  </Button>
                </div>
              ) : (
                <Badge variant="outline">{getModeLabel(module.calculator_mode)}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ModuleDesmos
              expressions={expressions.map((expression) => expression.latex)}
              mode={module.calculator_mode === "none" ? "none" : activeGraphMode}
              onStateChange={setActiveGraphState}
              state={activeGraphState}
              viewport={selectedGraphCard?.viewport ?? module.module_json.viewport}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-xs"
                onChange={(event) => setSnapshotName(event.target.value)}
                placeholder="Name this graph state"
                value={snapshotName}
              />
              <Button disabled={!canSaveGraph || saveGraph.isPending} onClick={saveCurrentGraph} type="button">
                <Save data-icon="inline-start" />
                Save graph state
              </Button>
              {saveMessage ? (
                <span className="text-sm text-muted-foreground">{saveMessage}</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export function MathQuestionBankPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const questionsQuery = useQuestionBank({ search: search || undefined });
  const createQuiz = useCreateQuizSet();

  if (questionsQuery.isLoading) {
    return <MathPageSkeleton />;
  }

  const questions = questionsQuery.data ?? [];

  const createSelectedQuiz = async () => {
    if (!profile || selectedIds.length === 0) {
      return;
    }

    const quiz = await createQuiz.mutateAsync({
      userId: profile.id,
      questionIds: selectedIds,
      title: "Custom math practice",
    });
    navigate(`/math/quizzes/${quiz.id}/attempt`);
  };

  return (
    <main className="app-page">
      <Breadcrumbs
        items={[
          { label: "Workspace", to: "/dashboard" },
          { label: "Math", to: "/math" },
          { label: "Question bank" },
        ]}
      />
      <section className="page-shell p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Question bank</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Build, filter, and launch practice sets from manual math questions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={selectedIds.length === 0} onClick={createSelectedQuiz} type="button">
              <ListChecks data-icon="inline-start" />
              Quiz selected
            </Button>
            <Button asChild variant="outline">
              <Link to="/math/questions/new">
                <Plus data-icon="inline-start" />
                New question
              </Link>
            </Button>
          </div>
        </div>
        <Input
          className="mt-5 max-w-lg"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search prompts"
          value={search}
        />
      </section>

      <section className="grid gap-3">
        {questions.map((question) => (
          <QuestionBankRow
            key={question.id}
            onToggle={(checked) => {
              setSelectedIds((current) =>
                checked
                  ? [...current, question.id]
                  : current.filter((id) => id !== question.id),
              );
            }}
            question={question}
            selected={selectedIds.includes(question.id)}
          />
        ))}
      </section>
    </main>
  );
}

export function MathQuestionEditorPage() {
  const { questionId } = useParams();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const { profile } = useAuth();
  const navigate = useNavigate();
  const coursesQuery = useMathCourses();
  const modulesQuery = useMathModules();
  const questionsQuery = useQuestionBank({});
  const saveQuestionMutation = useSaveQuestion();
  const existingQuestion = (questionsQuery.data ?? []).find((question) => question.id === questionId);
  const [draft, setDraft] = useState(() =>
    createQuestionDraft({
      moduleId: searchParams.get("moduleId"),
      noteId: searchParams.get("noteId"),
    }),
  );

  useEffect(() => {
    if (!existingQuestion) {
      return;
    }
    setDraft({
      id: existingQuestion.id,
      courseId: existingQuestion.course_id ?? "",
      topicId: existingQuestion.topic_id ?? "",
      moduleId: existingQuestion.module_id ?? "",
      noteId: existingQuestion.note_id ?? "",
      type: existingQuestion.type,
      title: existingQuestion.title ?? "",
      promptMarkdown: existingQuestion.prompt_markdown,
      promptLatex: existingQuestion.prompt_latex ?? "",
      explanationMarkdown: existingQuestion.explanation_markdown ?? "",
      difficulty: existingQuestion.difficulty,
      calculatorAllowed: existingQuestion.calculator_allowed,
      status: existingQuestion.status,
      numericExpected: String(existingQuestion.answer_json.expected ?? ""),
      numericTolerance: String(existingQuestion.answer_json.tolerance ?? "0.001"),
      shortAnswers: Array.isArray(existingQuestion.answer_json.acceptedAnswers)
        ? existingQuestion.answer_json.acceptedAnswers.join("\n")
        : "",
      correctBoolean: Boolean(existingQuestion.answer_json.expectedBoolean),
      stepOrder: Array.isArray(existingQuestion.answer_json.correctOrder)
        ? existingQuestion.answer_json.correctOrder.join("\n")
        : "",
      rubric: String(existingQuestion.answer_json.rubric ?? ""),
      choices:
        existingQuestion.choices?.map((choice) => ({
          id: choice.id,
          choiceText: choice.choice_text,
          isCorrect: choice.is_correct,
          orderIndex: choice.order_index,
        })) ?? createDefaultChoices(),
    });
  }, [existingQuestion]);

  if (!profile) {
    return <Navigate replace to="/auth" />;
  }

  const modules = modulesQuery.data ?? [];
  const selectedModule = modules.find((module) => module.id === draft.moduleId) ?? null;

  const saveDraft = async () => {
    const saved = await saveQuestionMutation.mutateAsync({
      id: draft.id || undefined,
      userId: profile.id,
      courseId: draft.courseId || selectedModule?.course_id || null,
      topicId: draft.topicId || selectedModule?.topic_id || null,
      moduleId: draft.moduleId || null,
      noteId: draft.noteId || null,
      type: draft.type,
      title: draft.title || null,
      promptMarkdown: draft.promptMarkdown,
      promptLatex: draft.promptLatex || null,
      answerJson: buildAnswerJson(draft),
      explanationMarkdown: draft.explanationMarkdown || null,
      difficulty: draft.difficulty,
      calculatorAllowed: draft.calculatorAllowed,
      status: draft.status,
      choices: usesChoices(draft.type)
        ? draft.choices.map((choice, index) => ({
            id: choice.id,
            choiceText: choice.choiceText,
            isCorrect: choice.isCorrect,
            orderIndex: index + 1,
          }))
        : [],
    });
    navigate(`/math/questions/${saved.id}/edit`);
  };

  return (
    <main className="app-page max-w-[1380px]">
      <Breadcrumbs
        items={[
          { label: "Workspace", to: "/dashboard" },
          { label: "Math", to: "/math" },
          { label: "Questions", to: "/math/questions" },
          { label: existingQuestion ? "Edit question" : "New question" },
        ]}
      />
      <section className="page-shell p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="outline">Manual authoring</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {existingQuestion ? "Edit math question" : "Create math question"}
            </h1>
          </div>
          <Button onClick={saveDraft} type="button">
            <Save data-icon="inline-start" />
            Save question
          </Button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.55fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Question setup</CardTitle>
            <CardDescription>Manual questions can be linked to a course, module, or note later.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <LabelledField label="Title">
                <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              </LabelledField>
              <LabelledField label="Question type">
                <select
                  className="appearance-select h-11 rounded-lg border border-input/85 bg-background/92 px-3 text-sm"
                  onChange={(event) => setDraft({ ...draft, type: event.target.value as QuestionType })}
                  value={draft.type}
                >
                  {questionTypes.map((type) => (
                    <option key={type} value={type}>
                      {formatQuestionType(type)}
                    </option>
                  ))}
                </select>
              </LabelledField>
              <LabelledField label="Course">
                <select
                  className="appearance-select h-11 rounded-lg border border-input/85 bg-background/92 px-3 text-sm"
                  onChange={(event) => setDraft({ ...draft, courseId: event.target.value })}
                  value={draft.courseId}
                >
                  <option value="">No course</option>
                  {(coursesQuery.data ?? []).map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </LabelledField>
              <LabelledField label="Module">
                <select
                  className="appearance-select h-11 rounded-lg border border-input/85 bg-background/92 px-3 text-sm"
                  onChange={(event) => setDraft({ ...draft, moduleId: event.target.value })}
                  value={draft.moduleId}
                >
                  <option value="">No module</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </LabelledField>
            </div>
            <LabelledField label="Prompt">
              <Textarea
                className="min-h-[150px]"
                onChange={(event) => setDraft({ ...draft, promptMarkdown: event.target.value })}
                value={draft.promptMarkdown}
              />
            </LabelledField>
            <LabelledField label="Optional prompt LaTeX">
              <Input
                onChange={(event) => setDraft({ ...draft, promptLatex: event.target.value })}
                placeholder="\\lim_{x\\to 2}(x^2+1)"
                value={draft.promptLatex}
              />
            </LabelledField>
            <AnswerEditor draft={draft} setDraft={setDraft} />
            <LabelledField label="Explanation">
              <Textarea
                onChange={(event) => setDraft({ ...draft, explanationMarkdown: event.target.value })}
                value={draft.explanationMarkdown}
              />
            </LabelledField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>This is how students will see the question.</CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionRenderer
              onAnswerChange={() => undefined}
              question={{
                ...createPreviewQuestion(draft, profile.id),
                choices: draft.choices.map((choice, index) => ({
                  id: choice.id,
                  question_id: draft.id || "preview",
                  choice_text: choice.choiceText,
                  choice_latex: null,
                  is_correct: choice.isCorrect,
                  order_index: index + 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })),
              }}
              value={{}}
            />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export function MathQuizPage() {
  const { quizId } = useParams();
  const quizQuery = useQuizSet(quizId);

  if (quizQuery.isLoading) {
    return <MathPageSkeleton />;
  }

  const quiz = quizQuery.data;
  if (!quiz) {
    return <Navigate replace to="/math/questions" />;
  }

  return (
    <main className="app-page">
      <Breadcrumbs items={[{ label: "Math", to: "/math" }, { label: quiz.title }]} />
      <Card>
        <CardHeader>
          <CardTitle>{quiz.title}</CardTitle>
          <CardDescription>{quiz.questions?.length ?? 0} questions ready.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to={`/math/quizzes/${quiz.id}/attempt`}>
              Start attempt
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export function MathQuizAttemptPage() {
  const { quizId } = useParams();
  const { profile } = useAuth();
  const quizQuery = useQuizSet(quizId);
  const startAttempt = useStartQuizAttempt();
  const submitAttempt = useSubmitQuestionAttempt();
  const completeAttempt = useCompleteQuizAttempt();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, SubmittedQuestionAnswer>>({});
  const [results, setResults] = useState<Array<{ question: QuestionBankItem; isCorrect: boolean | null; points: number | null; total: number }>>([]);

  if (quizQuery.isLoading) {
    return <MathPageSkeleton />;
  }

  const quiz = quizQuery.data;
  if (!quiz || !profile) {
    return <Navigate replace to="/math/questions" />;
  }

  const begin = async () => {
    const attempt = await startAttempt.mutateAsync({
      quizSetId: quiz.id,
      userId: profile.id,
    });
    setAttemptId(attempt.id);
  };

  const finish = async () => {
    const activeAttemptId =
      attemptId ??
      (
        await startAttempt.mutateAsync({
          quizSetId: quiz.id,
          userId: profile.id,
        })
      ).id;
    setAttemptId(activeAttemptId);

    const nextResults = [];
    for (const question of quiz.questions ?? []) {
      const answer = answers[question.id] ?? {};
      const submitted = await submitAttempt.mutateAsync({
        attemptId: activeAttemptId,
        userId: profile.id,
        question,
        answer,
      });
      nextResults.push({
        question,
        isCorrect: submitted.score.isCorrect,
        points: submitted.score.pointsAwarded,
        total: submitted.score.totalPoints,
      });
    }

    await completeAttempt.mutateAsync({
      attemptId: activeAttemptId,
      quizSet: quiz,
      userId: profile.id,
      scores: nextResults.map((result) => ({
        pointsAwarded: result.points,
        totalPoints: result.total,
      })),
    });
    setResults(nextResults);
  };

  return (
    <main className="app-page max-w-[1120px]">
      <Breadcrumbs items={[{ label: "Math", to: "/math" }, { label: quiz.title }]} />
      <section className="page-shell p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="outline">Practice quiz</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{quiz.title}</h1>
          </div>
          {!attemptId ? (
            <Button onClick={begin} type="button">Start attempt</Button>
          ) : (
            <Badge variant="outline">Attempt started</Badge>
          )}
        </div>
      </section>

      {results.length > 0 ? (
        <QuizResultSummary results={results} />
      ) : (
        <section className="grid gap-4">
          {(quiz.questions ?? []).map((question) => (
            <QuestionRenderer
              key={question.id}
              onAnswerChange={(answer) =>
                setAnswers((current) => ({ ...current, [question.id]: answer }))
              }
              question={question}
              value={answers[question.id] ?? {}}
            />
          ))}
          <Button className="justify-self-start" onClick={finish} type="button">
            Submit answers
          </Button>
        </section>
      )}
    </main>
  );
}

export function MathQuizResultsPage() {
  const { quizId } = useParams();
  const quizQuery = useQuizSet(quizId);

  if (quizQuery.isLoading) {
    return <MathPageSkeleton />;
  }

  const quiz = quizQuery.data;
  if (!quiz) {
    return <Navigate replace to="/math/questions" />;
  }

  return (
    <main className="app-page">
      <EmptyState
        action={
          <Button asChild>
            <Link to={`/math/quizzes/${quiz.id}/attempt`}>Start another attempt</Link>
          </Button>
        }
        description="Open the attempt page to see a fresh scored result summary after submitting answers."
        title={`${quiz.title} results`}
      />
    </main>
  );
}

function CourseCard({ course }: { course: MathCourse }) {
  return (
    <Link className="ui-click-tile" to={`/math/courses/${course.slug}`}>
      <Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/45">
        <CardHeader>
          <LibraryBig className="size-5 text-primary" />
          <CardTitle className="text-lg">{course.title}</CardTitle>
          <CardDescription>{course.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

function ModuleCard({ module }: { module: MathModule }) {
  return (
    <Link className="ui-click-tile" to={`/math/modules/${module.slug}`}>
      <Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/45">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <Badge variant="outline">{getModeLabel(module.calculator_mode)}</Badge>
            <Badge variant="secondary">{module.difficulty}</Badge>
          </div>
          <CardTitle>{module.title}</CardTitle>
          <CardDescription>{module.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

function ModuleDesmos({
  expressions,
  mode,
  onStateChange,
  state,
  viewport,
}: {
  expressions: string[];
  mode: MathModule["calculator_mode"];
  onStateChange: (state: DesmosState) => void;
  state: DesmosState | null;
  viewport?: MathModule["module_json"]["viewport"];
}) {
  const loadRequest = useMemo(
    () => ({
      id: `${mode}:${expressions.join("|")}`,
      expressions,
      viewport,
    }),
    [expressions, mode, viewport],
  );

  if (mode === "3d") {
    return (
      <Desmos3DGraph
        height="clamp(520px, 70vh, 760px)"
        loadRequest={loadRequest}
        onStateChange={onStateChange}
        state={state}
      />
    );
  }

  if (mode === "2d") {
    return (
      <DesmosGraph
        height="clamp(520px, 70vh, 760px)"
        loadRequest={loadRequest}
        onStateChange={onStateChange}
        state={state}
      />
    );
  }

  return <EmptyState description="This module does not need a calculator." title="No graph needed" />;
}

function FormulaCardGrid({
  formulas,
}: {
  formulas: NonNullable<MathModule["module_json"]["formulaCards"]>;
}) {
  if (formulas.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formula and theorem cards</CardTitle>
        <CardDescription>Study references connected to this Jacob section.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {formulas.map((formula) => (
          <div className="rounded-lg border border-border/70 bg-background/80 p-4" key={formula.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Formula card</Badge>
              <h2 className="font-semibold tracking-tight">{formula.label}</h2>
            </div>
            <LatexBlock latex={formula.latex} />
            {formula.explanation ? (
              <p className="text-sm leading-6 text-muted-foreground">{formula.explanation}</p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GraphCardList({
  graphs,
  onOpenGraph,
  selectedGraphId,
}: {
  graphs: NonNullable<MathModule["module_json"]["graphCards"]>;
  onOpenGraph: (graph: NonNullable<MathModule["module_json"]["graphCards"]>[number]) => void;
  selectedGraphId: string | null;
}) {
  if (graphs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Graph demos</CardTitle>
        <CardDescription>Open a 2D or 3D graph built for this lesson.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {graphs.map((graph) => (
          <div className="rounded-lg border border-border/70 bg-background/80 p-4" key={graph.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={graph.mode === "3d" ? "default" : "secondary"}>
                    {graph.mode === "3d" ? "3D Graph" : "2D Graph"}
                  </Badge>
                  {selectedGraphId === graph.id ? <Badge variant="outline">Open</Badge> : null}
                </div>
                <h2 className="mt-2 font-semibold tracking-tight">{graph.label}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{graph.description}</p>
              </div>
              <Button onClick={() => onOpenGraph(graph)} size="sm" type="button" variant="outline">
                {graph.mode === "3d" ? "Switch to 3D" : "Explore in 2D"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RelatedConcepts({ concepts }: { concepts: string[] }) {
  if (concepts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related concepts</CardTitle>
        <CardDescription>Use these links as a map through Jacob's course.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {concepts.map((concept) => (
          <Badge key={concept} variant="outline">
            {concept}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function PracticeList({ questions }: { questions: QuestionBankItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked practice</CardTitle>
        <CardDescription>Questions attached to this module.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {questions.length === 0 ? (
          <EmptyState description="No questions are linked yet." title="Practice coming soon" />
        ) : (
          questions.map((question) => (
            <div
              className="rounded-lg border border-border/70 bg-background/75 p-3"
              key={question.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{formatQuestionType(question.type)}</Badge>
                <Badge variant="outline">{question.difficulty}</Badge>
              </div>
              <p className="mt-2 text-sm font-medium">{question.title ?? question.prompt_markdown}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function QuestionBankRow({
  onToggle,
  question,
  selected,
}: {
  onToggle: (checked: boolean) => void;
  question: QuestionBankItem;
  selected: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-start gap-4 p-4">
        <input
          checked={selected}
          className="mt-1 size-4"
          onChange={(event) => onToggle(event.target.checked)}
          type="checkbox"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{formatQuestionType(question.type)}</Badge>
            <Badge variant="outline">{question.status}</Badge>
          </div>
          <h2 className="mt-2 font-semibold tracking-tight">{question.title ?? "Untitled question"}</h2>
          <MarkdownLite className="mt-2 text-sm text-muted-foreground" text={question.prompt_markdown} />
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={`/math/questions/${question.id}/edit`}>Edit</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function QuestionRenderer({
  onAnswerChange,
  question,
  value,
}: {
  onAnswerChange: (answer: SubmittedQuestionAnswer) => void;
  question: QuestionBankItem;
  value: SubmittedQuestionAnswer;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{formatQuestionType(question.type)}</Badge>
          {question.calculator_allowed ? <Badge variant="outline">Calculator allowed</Badge> : null}
        </div>
        <CardTitle>{question.title ?? "Practice question"}</CardTitle>
        <CardDescription>
          <MarkdownLite text={question.prompt_markdown} />
        </CardDescription>
        {question.prompt_latex ? <LatexBlock latex={question.prompt_latex} /> : null}
      </CardHeader>
      <CardContent>
        <QuestionInput question={question} value={value} onAnswerChange={onAnswerChange} />
      </CardContent>
    </Card>
  );
}

function QuestionInput({
  onAnswerChange,
  question,
  value,
}: {
  onAnswerChange: (answer: SubmittedQuestionAnswer) => void;
  question: QuestionBankItem;
  value: SubmittedQuestionAnswer;
}) {
  if (question.type === "multiple_choice" || question.type === "true_false") {
    const choices =
      question.type === "true_false"
        ? [
            { id: "true", choice_text: "True" },
            { id: "false", choice_text: "False" },
          ]
        : question.choices ?? [];
    return (
      <div className="grid gap-2">
        {choices.map((choice) => (
          <label
            className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/80 p-3 text-sm"
            key={choice.id}
          >
            <input
              checked={
                question.type === "true_false"
                  ? value.booleanAnswer === (choice.id === "true")
                  : value.selectedChoiceId === choice.id
              }
              onChange={() =>
                onAnswerChange(
                  question.type === "true_false"
                    ? { ...value, booleanAnswer: choice.id === "true" }
                    : { ...value, selectedChoiceId: choice.id },
                )
              }
              type="radio"
            />
            {choice.choice_text}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "multiple_select") {
    const selected = new Set(value.selectedChoiceIds ?? []);
    return (
      <div className="grid gap-2">
        {(question.choices ?? []).map((choice) => (
          <label
            className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/80 p-3 text-sm"
            key={choice.id}
          >
            <input
              checked={selected.has(choice.id)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) {
                  next.add(choice.id);
                } else {
                  next.delete(choice.id);
                }
                onAnswerChange({ ...value, selectedChoiceIds: [...next] });
              }}
              type="checkbox"
            />
            {choice.choice_text}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "numeric") {
    return (
      <Input
        onChange={(event) => onAnswerChange({ ...value, numeric: event.target.value })}
        placeholder="Enter a number"
        value={String(value.numeric ?? "")}
      />
    );
  }

  if (question.type === "step_ordering") {
    return (
      <Textarea
        onChange={(event) =>
          onAnswerChange({
            ...value,
            orderedStepIds: event.target.value.split(/\r?\n/).filter(Boolean),
          })
        }
        placeholder="Enter step IDs in order, one per line"
        value={(value.orderedStepIds ?? []).join("\n")}
      />
    );
  }

  return (
    <Textarea
      onChange={(event) =>
        onAnswerChange(
          question.type === "free_response"
            ? { ...value, freeResponse: event.target.value }
            : { ...value, text: event.target.value },
        )
      }
      placeholder="Write your answer"
      value={value.freeResponse ?? value.text ?? ""}
    />
  );
}

function AnswerEditor({
  draft,
  setDraft,
}: {
  draft: QuestionDraft;
  setDraft: (draft: QuestionDraft) => void;
}) {
  if (usesChoices(draft.type)) {
    return (
      <LabelledField label="Choices">
        <div className="grid gap-2">
          {draft.choices.map((choice, index) => (
            <div className="grid gap-2 rounded-lg border border-border/70 bg-background/75 p-3 md:grid-cols-[1fr_auto]" key={choice.id}>
              <Input
                onChange={(event) => {
                  const choices = [...draft.choices];
                  choices[index] = { ...choice, choiceText: event.target.value };
                  setDraft({ ...draft, choices });
                }}
                value={choice.choiceText}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={choice.isCorrect}
                  onChange={(event) => {
                    const choices = draft.choices.map((candidate, candidateIndex) => ({
                      ...candidate,
                      isCorrect:
                        draft.type === "multiple_choice"
                          ? candidateIndex === index && event.target.checked
                          : candidateIndex === index
                            ? event.target.checked
                            : candidate.isCorrect,
                    }));
                    setDraft({ ...draft, choices });
                  }}
                  type={draft.type === "multiple_choice" ? "radio" : "checkbox"}
                />
                Correct
              </label>
            </div>
          ))}
          <Button
            onClick={() =>
              setDraft({
                ...draft,
                choices: [
                  ...draft.choices,
                  {
                    id: crypto.randomUUID(),
                    choiceText: `Choice ${draft.choices.length + 1}`,
                    isCorrect: false,
                    orderIndex: draft.choices.length + 1,
                  },
                ],
              })
            }
            type="button"
            variant="outline"
          >
            <Plus data-icon="inline-start" />
            Add choice
          </Button>
        </div>
      </LabelledField>
    );
  }

  if (draft.type === "true_false") {
    return (
      <LabelledField label="Correct answer">
        <select
          className="appearance-select h-11 rounded-lg border border-input/85 bg-background/92 px-3 text-sm"
          onChange={(event) => setDraft({ ...draft, correctBoolean: event.target.value === "true" })}
          value={String(draft.correctBoolean)}
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      </LabelledField>
    );
  }

  if (draft.type === "numeric") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <LabelledField label="Expected number">
          <Input
            onChange={(event) => setDraft({ ...draft, numericExpected: event.target.value })}
            value={draft.numericExpected}
          />
        </LabelledField>
        <LabelledField label="Tolerance">
          <Input
            onChange={(event) => setDraft({ ...draft, numericTolerance: event.target.value })}
            value={draft.numericTolerance}
          />
        </LabelledField>
      </div>
    );
  }

  if (draft.type === "step_ordering") {
    return (
      <LabelledField label="Correct step order">
        <Textarea
          onChange={(event) => setDraft({ ...draft, stepOrder: event.target.value })}
          placeholder="step_1&#10;step_2&#10;step_3"
          value={draft.stepOrder}
        />
      </LabelledField>
    );
  }

  if (draft.type === "free_response" || draft.type === "matching") {
    return (
      <LabelledField label="Rubric">
        <Textarea
          onChange={(event) => setDraft({ ...draft, rubric: event.target.value })}
          value={draft.rubric}
        />
      </LabelledField>
    );
  }

  return (
    <LabelledField label="Accepted answers">
      <Textarea
        onChange={(event) => setDraft({ ...draft, shortAnswers: event.target.value })}
        placeholder="One accepted answer per line"
        value={draft.shortAnswers}
      />
    </LabelledField>
  );
}

function QuizResultSummary({
  results,
}: {
  results: Array<{ question: QuestionBankItem; isCorrect: boolean | null; points: number | null; total: number }>;
}) {
  const score = results.reduce((sum, result) => sum + (result.points ?? 0), 0);
  const total = results.reduce((sum, result) => sum + result.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score: {score} / {total}</CardTitle>
        <CardDescription>Review explanations and retry anything that felt shaky.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {results.map((result) => (
          <div className="rounded-lg border border-border/70 bg-background/75 p-4" key={result.question.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={result.isCorrect ? "secondary" : "outline"}>
                {result.isCorrect === null ? "Saved" : result.isCorrect ? "Correct" : "Review"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {result.points ?? 0} / {result.total}
              </span>
            </div>
            <p className="mt-2 font-medium">{result.question.title ?? result.question.prompt_markdown}</p>
            {result.question.explanation_markdown ? (
              <MarkdownLite className="mt-2 text-sm text-muted-foreground" text={result.question.explanation_markdown} />
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MarkdownLite({ className, text }: { className?: string; text: string }) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.every((line) => line.trim().startsWith("- "))) {
    return (
      <ul className={cn("list-disc space-y-1 pl-5", className)}>
        {lines.map((line) => (
          <li key={line}>{line.replace(/^- /, "")}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {lines.length > 0 ? lines.map((line) => <p key={line}>{line}</p>) : <p>{text}</p>}
    </div>
  );
}

function LatexBlock({ latex }: { latex: string }) {
  const html = katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
  });

  return (
    <div
      className="mt-3 overflow-x-auto rounded-lg bg-background/80 p-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function LabelledField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MathPageSkeleton() {
  return (
    <main className="app-page">
      <Skeleton className="h-16" />
      <Skeleton className="h-[520px]" />
    </main>
  );
}

function getModeLabel(mode: MathModule["calculator_mode"]) {
  if (mode === "3d") return "Desmos 3D";
  if (mode === "2d") return "Desmos 2D";
  return "No calculator";
}

function defaultGraphMode(mode: MathModule["calculator_mode"]): ActiveGraphMode {
  return mode === "3d" ? "3d" : "2d";
}

function formatQuestionType(type: QuestionType) {
  return type
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

type QuestionDraft = {
  id: string;
  courseId: string;
  topicId: string;
  moduleId: string;
  noteId: string;
  type: QuestionType;
  title: string;
  promptMarkdown: string;
  promptLatex: string;
  explanationMarkdown: string;
  difficulty: QuestionBankItem["difficulty"];
  calculatorAllowed: boolean;
  status: QuestionBankItem["status"];
  numericExpected: string;
  numericTolerance: string;
  shortAnswers: string;
  correctBoolean: boolean;
  stepOrder: string;
  rubric: string;
  choices: Array<{
    id: string;
    choiceText: string;
    isCorrect: boolean;
    orderIndex: number;
  }>;
};

function createQuestionDraft(input: { moduleId: string | null; noteId: string | null }): QuestionDraft {
  return {
    id: "",
    courseId: "",
    topicId: "",
    moduleId: input.moduleId ?? "",
    noteId: input.noteId ?? "",
    type: "multiple_choice",
    title: "",
    promptMarkdown: "Write the question prompt.",
    promptLatex: "",
    explanationMarkdown: "",
    difficulty: "foundational",
    calculatorAllowed: false,
    status: "draft",
    numericExpected: "",
    numericTolerance: "0.001",
    shortAnswers: "",
    correctBoolean: true,
    stepOrder: "",
    rubric: "",
    choices: createDefaultChoices(),
  };
}

function createDefaultChoices() {
  return [
    { id: crypto.randomUUID(), choiceText: "Choice A", isCorrect: true, orderIndex: 1 },
    { id: crypto.randomUUID(), choiceText: "Choice B", isCorrect: false, orderIndex: 2 },
    { id: crypto.randomUUID(), choiceText: "Choice C", isCorrect: false, orderIndex: 3 },
  ];
}

function usesChoices(type: QuestionType) {
  return type === "multiple_choice" || type === "multiple_select";
}

function buildAnswerJson(draft: QuestionDraft): QuestionBankItem["answer_json"] {
  if (draft.type === "multiple_choice") {
    return { correctChoiceId: draft.choices.find((choice) => choice.isCorrect)?.id };
  }
  if (draft.type === "multiple_select") {
    return { correctChoiceIds: draft.choices.filter((choice) => choice.isCorrect).map((choice) => choice.id) };
  }
  if (draft.type === "true_false") {
    return { expectedBoolean: draft.correctBoolean };
  }
  if (draft.type === "numeric") {
    return {
      expected: Number(draft.numericExpected),
      tolerance: Number(draft.numericTolerance || 0),
      units: null,
    };
  }
  if (draft.type === "step_ordering") {
    return { correctOrder: draft.stepOrder.split(/\r?\n/).filter(Boolean) };
  }
  if (draft.type === "free_response" || draft.type === "matching") {
    return { completionPoints: 1, rubric: draft.rubric };
  }
  return {
    acceptedAnswers: draft.shortAnswers.split(/\r?\n/).filter(Boolean),
    caseSensitive: false,
    normalizeWhitespace: true,
  };
}

function createPreviewQuestion(draft: QuestionDraft, userId: string): QuestionBankItem {
  const now = new Date().toISOString();
  return {
    id: draft.id || "preview",
    course_id: draft.courseId || null,
    topic_id: draft.topicId || null,
    module_id: draft.moduleId || null,
    note_id: draft.noteId || null,
    graph_state_id: null,
    type: draft.type,
    title: draft.title || null,
    prompt_markdown: draft.promptMarkdown,
    prompt_latex: draft.promptLatex || null,
    answer_json: buildAnswerJson(draft),
    explanation_markdown: draft.explanationMarkdown || null,
    explanation_latex: null,
    difficulty: draft.difficulty,
    calculator_allowed: draft.calculatorAllowed,
    estimated_time_seconds: null,
    source_type: "manual",
    status: draft.status,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };
}
