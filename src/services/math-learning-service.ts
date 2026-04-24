import { supabase } from "@/lib/supabase";
import {
  getSeedModuleBySlug,
  getSeedQuestionChoices,
  mathSeedChoices,
  mathSeedCourses,
  mathSeedModules,
  mathSeedQuestions,
  mathSeedTopics,
} from "@/lib/math-learning-seeds";
import { scoreQuestion, type SubmittedQuestionAnswer } from "@/lib/question-scoring";
import type {
  CalculatorMode,
  MathCourse,
  MathCourseBundle,
  MathGraphState,
  MathModule,
  MathModuleBundle,
  MathTopic,
  QuestionBankItem,
  QuestionChoice,
  QuestionType,
  QuizAttempt,
  QuizSet,
} from "@/types/math-learning";

type QuestionFilters = {
  courseId?: string;
  topicId?: string;
  moduleId?: string;
  noteId?: string;
  status?: QuestionBankItem["status"];
  type?: QuestionType;
  difficulty?: QuestionBankItem["difficulty"];
  search?: string;
};

export type SaveGraphStateInput = {
  id?: string;
  userId: string;
  moduleId?: string | null;
  noteId?: string | null;
  questionId?: string | null;
  calculatorMode: Exclude<CalculatorMode, "none">;
  title: string;
  desmosState: DesmosState;
  expressions?: MathGraphState["expressions"];
};

export type QuestionInput = {
  id?: string;
  userId: string;
  courseId?: string | null;
  topicId?: string | null;
  moduleId?: string | null;
  noteId?: string | null;
  graphStateId?: string | null;
  type: QuestionType;
  title?: string | null;
  promptMarkdown: string;
  promptLatex?: string | null;
  answerJson: QuestionBankItem["answer_json"];
  explanationMarkdown?: string | null;
  explanationLatex?: string | null;
  difficulty: QuestionBankItem["difficulty"];
  calculatorAllowed: boolean;
  estimatedTimeSeconds?: number | null;
  status: QuestionBankItem["status"];
  choices?: Array<{
    id?: string;
    choiceText: string;
    choiceLatex?: string | null;
    isCorrect: boolean;
    orderIndex: number;
  }>;
};

const LOCAL_STORAGE_KEY = "binder-notes:math-learning-local:v1";

type LocalMathState = {
  graphStates: MathGraphState[];
  questions: QuestionBankItem[];
  choices: QuestionChoice[];
  quizSets: QuizSet[];
  quizLinks: Array<{ quiz_set_id: string; question_id: string; order_index: number }>;
  attempts: QuizAttempt[];
};

export async function listMathCourses(): Promise<MathCourse[]> {
  if (!supabase) {
    return [...mathSeedCourses].sort(byOrder);
  }

  const { data, error } = await supabase
    .from("math_courses")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) {
    console.warn("Falling back to bundled math courses.", error.message);
    return [...mathSeedCourses].sort(byOrder);
  }

  return (data ?? []) as MathCourse[];
}

export async function getMathCourseBundle(courseSlug: string): Promise<MathCourseBundle | null> {
  const courses = await listMathCourses();
  const course = courses.find((candidate) => candidate.slug === courseSlug) ?? null;
  if (!course) {
    return null;
  }

  const [topics, modules, questions] = await Promise.all([
    listMathTopics(course.id),
    listMathModules({ courseId: course.id }),
    listQuestions({ courseId: course.id, status: "published" }),
  ]);

  return {
    course,
    topics,
    modules,
    questions,
  };
}

export async function listMathTopics(courseId?: string): Promise<MathTopic[]> {
  if (!supabase) {
    return mathSeedTopics
      .filter((topic) => !courseId || topic.course_id === courseId)
      .sort(byOrder);
  }

  let query = supabase
    .from("math_topics")
    .select("*")
    .order("order_index", { ascending: true });

  if (courseId) {
    query = query.eq("course_id", courseId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("Falling back to bundled math topics.", error.message);
    return mathSeedTopics
      .filter((topic) => !courseId || topic.course_id === courseId)
      .sort(byOrder);
  }

  return (data ?? []) as MathTopic[];
}

export async function listMathModules(options: { courseId?: string; topicId?: string } = {}) {
  if (!supabase) {
    return mathSeedModules
      .filter((module) => module.visibility === "published")
      .filter((module) => !options.courseId || module.course_id === options.courseId)
      .filter((module) => !options.topicId || module.topic_id === options.topicId)
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  let query = supabase
    .from("math_modules")
    .select("*")
    .eq("visibility", "published")
    .order("title", { ascending: true });

  if (options.courseId) {
    query = query.eq("course_id", options.courseId);
  }
  if (options.topicId) {
    query = query.eq("topic_id", options.topicId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("Falling back to bundled math modules.", error.message);
    return mathSeedModules
      .filter((module) => module.visibility === "published")
      .filter((module) => !options.courseId || module.course_id === options.courseId)
      .filter((module) => !options.topicId || module.topic_id === options.topicId);
  }

  return (data ?? []) as MathModule[];
}

export async function getMathModuleBundle(
  moduleSlug: string,
  userId?: string,
): Promise<MathModuleBundle | null> {
  const module = await getMathModuleBySlug(moduleSlug);
  if (!module) {
    return null;
  }

  const [courses, topics, questions, graphStates] = await Promise.all([
    listMathCourses(),
    listMathTopics(module.course_id),
    listQuestions({ moduleId: module.id, status: "published" }),
    listGraphStates({ userId, moduleId: module.id }).catch((error: unknown) => {
      console.warn("Continuing without saved graph states.", getErrorMessage(error));
      return [];
    }),
  ]);

  return {
    course: courses.find((course) => course.id === module.course_id) ?? null,
    topic: topics.find((topic) => topic.id === module.topic_id) ?? null,
    module,
    questions,
    graphStates,
  };
}

export async function getMathModuleBySlug(moduleSlug: string): Promise<MathModule | null> {
  if (!supabase) {
    return getSeedModuleBySlug(moduleSlug);
  }

  const { data, error } = await supabase
    .from("math_modules")
    .select("*")
    .eq("slug", moduleSlug)
    .maybeSingle();

  if (error) {
    console.warn("Falling back to bundled math module.", error.message);
    return getSeedModuleBySlug(moduleSlug);
  }

  return (data as MathModule | null) ?? getSeedModuleBySlug(moduleSlug);
}

export async function listGraphStates(options: {
  userId?: string;
  moduleId?: string;
  noteId?: string;
  questionId?: string;
}): Promise<MathGraphState[]> {
  if (!options.userId) {
    return [];
  }

  if (!supabase) {
    return getLocalGraphStates(options);
  }

  let query = supabase
    .from("math_graph_states")
    .select("*")
    .eq("user_id", options.userId)
    .order("updated_at", { ascending: false });

  if (options.moduleId) {
    query = query.eq("module_id", options.moduleId);
  }
  if (options.noteId) {
    query = query.eq("note_id", options.noteId);
  }
  if (options.questionId) {
    query = query.eq("question_id", options.questionId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("Falling back to local math graph states.", error.message);
    return getLocalGraphStates(options);
  }

  return (data ?? []) as MathGraphState[];
}

export async function saveGraphState(input: SaveGraphStateInput): Promise<MathGraphState> {
  const now = new Date().toISOString();
  const row = {
    id: input.id ?? crypto.randomUUID(),
    user_id: input.userId,
    module_id: input.moduleId ?? null,
    note_id: input.noteId ?? null,
    question_id: input.questionId ?? null,
    calculator_mode: input.calculatorMode,
    title: input.title,
    desmos_state: input.desmosState,
    expressions: input.expressions ?? null,
    thumbnail_url: null,
    created_at: now,
    updated_at: now,
  } satisfies MathGraphState;

  if (!supabase) {
    const local = loadLocalState();
    saveLocalState({
      ...local,
      graphStates: [row, ...local.graphStates.filter((graph) => graph.id !== row.id)],
    });
    return row;
  }

  const { data, error } = await supabase
    .from("math_graph_states")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not save graph state: ${error.message}`);
  }

  return data as MathGraphState;
}

export async function listQuestions(filters: QuestionFilters = {}): Promise<QuestionBankItem[]> {
  if (!supabase) {
    return attachChoices([...mathSeedQuestions, ...loadLocalState().questions], [
      ...mathSeedChoices,
      ...loadLocalState().choices,
    ]).filter((question) => questionMatchesFilters(question, filters));
  }

  let query = supabase.from("question_bank").select("*, question_choices(*)");

  if (filters.courseId) query = query.eq("course_id", filters.courseId);
  if (filters.topicId) query = query.eq("topic_id", filters.topicId);
  if (filters.moduleId) query = query.eq("module_id", filters.moduleId);
  if (filters.noteId) query = query.eq("note_id", filters.noteId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.search) query = query.ilike("prompt_markdown", `%${filters.search}%`);

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) {
    console.warn("Falling back to bundled math questions.", error.message);
    return attachChoices(mathSeedQuestions, mathSeedChoices).filter((question) =>
      questionMatchesFilters(question, filters),
    );
  }

  return normalizeQuestionRows(data ?? []);
}

export async function getQuestion(questionId: string): Promise<QuestionBankItem | null> {
  const questions = await listQuestions({});
  return questions.find((question) => question.id === questionId) ?? null;
}

export async function saveQuestion(input: QuestionInput): Promise<QuestionBankItem> {
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const questionRow: QuestionBankItem = {
    id,
    course_id: input.courseId ?? null,
    topic_id: input.topicId ?? null,
    module_id: input.moduleId ?? null,
    note_id: input.noteId ?? null,
    graph_state_id: input.graphStateId ?? null,
    type: input.type,
    title: input.title ?? null,
    prompt_markdown: input.promptMarkdown,
    prompt_latex: input.promptLatex ?? null,
    answer_json: input.answerJson,
    explanation_markdown: input.explanationMarkdown ?? null,
    explanation_latex: input.explanationLatex ?? null,
    difficulty: input.difficulty,
    calculator_allowed: input.calculatorAllowed,
    estimated_time_seconds: input.estimatedTimeSeconds ?? null,
    source_type: "manual",
    status: input.status,
    created_by: input.userId,
    created_at: now,
    updated_at: now,
  };
  const choices: QuestionChoice[] = (input.choices ?? []).map((choice, index) => ({
    id: choice.id ?? crypto.randomUUID(),
    question_id: id,
    choice_text: choice.choiceText,
    choice_latex: choice.choiceLatex ?? null,
    is_correct: choice.isCorrect,
    order_index: choice.orderIndex || index + 1,
    created_at: now,
    updated_at: now,
  }));

  if (!supabase) {
    const local = loadLocalState();
    saveLocalState({
      ...local,
      questions: [questionRow, ...local.questions.filter((question) => question.id !== id)],
      choices: [
        ...choices,
        ...local.choices.filter((choice) => choice.question_id !== id),
      ],
    });
    return { ...questionRow, choices };
  }

  const { data, error } = await supabase
    .from("question_bank")
    .upsert(questionRow, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not save question: ${error.message}`);
  }

  const { error: deleteError } = await supabase
    .from("question_choices")
    .delete()
    .eq("question_id", id);
  if (deleteError) {
    throw new Error(`Could not replace question choices: ${deleteError.message}`);
  }

  if (choices.length > 0) {
    const { error: choicesError } = await supabase.from("question_choices").insert(choices);
    if (choicesError) {
      throw new Error(`Could not save question choices: ${choicesError.message}`);
    }
  }

  return { ...(data as QuestionBankItem), choices };
}

export async function createQuizSet(input: {
  userId: string;
  questionIds: string[];
  title: string;
  courseId?: string | null;
  topicId?: string | null;
  moduleId?: string | null;
}): Promise<QuizSet> {
  const now = new Date().toISOString();
  const quiz: QuizSet = {
    id: crypto.randomUUID(),
    user_id: input.userId,
    course_id: input.courseId ?? null,
    topic_id: input.topicId ?? null,
    module_id: input.moduleId ?? null,
    title: input.title,
    description: null,
    settings_json: { mode: "practice" },
    created_at: now,
    updated_at: now,
  };

  if (!supabase) {
    const local = loadLocalState();
    saveLocalState({
      ...local,
      quizSets: [quiz, ...local.quizSets],
      quizLinks: [
        ...input.questionIds.map((questionId, index) => ({
          quiz_set_id: quiz.id,
          question_id: questionId,
          order_index: index + 1,
        })),
        ...local.quizLinks,
      ],
    });
    return quiz;
  }

  const { data, error } = await supabase
    .from("quiz_sets")
    .insert(quiz)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create quiz: ${error.message}`);
  }

  const { error: linksError } = await supabase.from("quiz_set_questions").insert(
    input.questionIds.map((questionId, index) => ({
      id: crypto.randomUUID(),
      quiz_set_id: quiz.id,
      question_id: questionId,
      order_index: index + 1,
      created_at: now,
      updated_at: now,
    })),
  );

  if (linksError) {
    throw new Error(`Could not attach quiz questions: ${linksError.message}`);
  }

  return data as QuizSet;
}

export async function getQuizSet(quizId: string): Promise<QuizSet | null> {
  if (!supabase) {
    const local = loadLocalState();
    const quiz = local.quizSets.find((candidate) => candidate.id === quizId) ?? null;
    if (!quiz) return null;
    const questionIds = local.quizLinks
      .filter((link) => link.quiz_set_id === quizId)
      .sort((left, right) => left.order_index - right.order_index)
      .map((link) => link.question_id);
    const questions = attachChoices([...mathSeedQuestions, ...local.questions], [
      ...mathSeedChoices,
      ...local.choices,
    ]).filter((question) => questionIds.includes(question.id));
    return { ...quiz, questions };
  }

  const { data, error } = await supabase
    .from("quiz_sets")
    .select("*")
    .eq("id", quizId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load quiz: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  const { data: links, error: linksError } = await supabase
    .from("quiz_set_questions")
    .select("question_id, order_index")
    .eq("quiz_set_id", quizId)
    .order("order_index", { ascending: true });

  if (linksError) {
    throw new Error(`Could not load quiz questions: ${linksError.message}`);
  }

  const questions = await listQuestions({});
  const orderedIds = (links ?? []).map((link) => String(link.question_id));
  return {
    ...(data as QuizSet),
    questions: orderedIds
      .map((questionId) => questions.find((question) => question.id === questionId))
      .filter(Boolean) as QuestionBankItem[],
  };
}

export async function startQuizAttempt(input: {
  quizSetId: string;
  userId: string;
}): Promise<QuizAttempt> {
  const attempt: QuizAttempt = {
    id: crypto.randomUUID(),
    quiz_set_id: input.quizSetId,
    user_id: input.userId,
    started_at: new Date().toISOString(),
    completed_at: null,
    score: null,
    total_points: null,
    metadata_json: null,
  };

  if (!supabase) {
    const local = loadLocalState();
    saveLocalState({ ...local, attempts: [attempt, ...local.attempts] });
    return attempt;
  }

  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert(attempt)
    .select("*")
    .single();
  if (error) {
    throw new Error(`Could not start quiz attempt: ${error.message}`);
  }

  return data as QuizAttempt;
}

export async function submitQuestionAttempt(input: {
  attemptId: string;
  userId: string;
  question: QuestionBankItem;
  answer: SubmittedQuestionAnswer;
}) {
  const score = scoreQuestion(input.question, input.answer);
  const row = {
    id: crypto.randomUUID(),
    quiz_attempt_id: input.attemptId,
    question_id: input.question.id,
    user_id: input.userId,
    submitted_answer_json: input.answer as Record<string, unknown>,
    is_correct: score.isCorrect,
    points_awarded: score.pointsAwarded,
    feedback_json: score.feedback,
    created_at: new Date().toISOString(),
  };

  if (!supabase) {
    return { attempt: row, score };
  }

  const { data, error } = await supabase
    .from("question_attempts")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not submit answer: ${error.message}`);
  }

  return { attempt: data, score };
}

export async function completeQuizAttempt(input: {
  attemptId: string;
  quizSet: QuizSet;
  userId: string;
  scores: Array<{ pointsAwarded: number | null; totalPoints: number }>;
}): Promise<QuizAttempt> {
  const score = input.scores.reduce((sum, item) => sum + (item.pointsAwarded ?? 0), 0);
  const totalPoints = input.scores.reduce((sum, item) => sum + item.totalPoints, 0);
  const completedAt = new Date().toISOString();

  if (!supabase) {
    const local = loadLocalState();
    const attempt =
      local.attempts.find((candidate) => candidate.id === input.attemptId) ??
      ({
        id: input.attemptId,
        quiz_set_id: input.quizSet.id,
        user_id: input.userId,
        started_at: completedAt,
        metadata_json: null,
      } as QuizAttempt);
    const completed: QuizAttempt = {
      ...attempt,
      completed_at: completedAt,
      score,
      total_points: totalPoints,
    };
    saveLocalState({
      ...local,
      attempts: [completed, ...local.attempts.filter((item) => item.id !== input.attemptId)],
    });
    return completed;
  }

  const { data, error } = await supabase
    .from("quiz_attempts")
    .update({
      completed_at: completedAt,
      score,
      total_points: totalPoints,
    })
    .eq("id", input.attemptId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not complete quiz: ${error.message}`);
  }

  return data as QuizAttempt;
}

function normalizeQuestionRows(rows: Array<Record<string, unknown>>): QuestionBankItem[] {
  return rows.map((row) => {
    const question_choices = Array.isArray(row.question_choices)
      ? (row.question_choices as QuestionChoice[])
      : [];
    const { question_choices: _choices, ...question } = row;
    return {
      ...(question as QuestionBankItem),
      choices: question_choices.sort((left, right) => left.order_index - right.order_index),
    };
  });
}

function attachChoices(questions: QuestionBankItem[], choices: QuestionChoice[]) {
  return questions.map((question) => ({
    ...question,
    choices: choices
      .filter((choice) => choice.question_id === question.id)
      .sort((left, right) => left.order_index - right.order_index),
  }));
}

function questionMatchesFilters(question: QuestionBankItem, filters: QuestionFilters) {
  return (
    (!filters.courseId || question.course_id === filters.courseId) &&
    (!filters.topicId || question.topic_id === filters.topicId) &&
    (!filters.moduleId || question.module_id === filters.moduleId) &&
    (!filters.noteId || question.note_id === filters.noteId) &&
    (!filters.status || question.status === filters.status) &&
    (!filters.type || question.type === filters.type) &&
    (!filters.difficulty || question.difficulty === filters.difficulty) &&
    (!filters.search ||
      `${question.title ?? ""} ${question.prompt_markdown}`
        .toLowerCase()
        .includes(filters.search.toLowerCase()))
  );
}

function getLocalGraphStates(options: {
  userId?: string;
  moduleId?: string;
  noteId?: string;
  questionId?: string;
}) {
  if (!options.userId) {
    return [];
  }

  return loadLocalState().graphStates.filter(
    (graph) =>
      graph.user_id === options.userId &&
      (!options.moduleId || graph.module_id === options.moduleId) &&
      (!options.noteId || graph.note_id === options.noteId) &&
      (!options.questionId || graph.question_id === options.questionId),
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function loadLocalState(): LocalMathState {
  if (typeof window === "undefined") {
    return createLocalState();
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return createLocalState();
    }
    return { ...createLocalState(), ...(JSON.parse(raw) as Partial<LocalMathState>) };
  } catch {
    return createLocalState();
  }
}

function saveLocalState(state: LocalMathState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

function createLocalState(): LocalMathState {
  return {
    graphStates: [],
    questions: [],
    choices: [],
    quizSets: [],
    quizLinks: [],
    attempts: [],
  };
}

function byOrder(left: { order_index: number }, right: { order_index: number }) {
  return left.order_index - right.order_index;
}
