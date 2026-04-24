import type {
  MathCourse,
  MathDifficulty,
  MathModule,
  MathTopic,
  QuestionBankItem,
  QuestionChoice,
} from "@/types/math-learning";

const SEED_TIME = "2026-01-01T00:00:00.000Z";

export const mathSeedCourses: MathCourse[] = [
  {
    id: "course-ap-calculus-ab",
    slug: "ap-calculus-ab",
    title: "AP Calculus AB",
    description: "Limits, derivatives, integrals, and AP-style practice.",
    order_index: 1,
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "course-ap-calculus-bc",
    slug: "ap-calculus-bc",
    title: "AP Calculus BC",
    description: "AB foundations plus series, parametric, polar, and advanced integration.",
    order_index: 2,
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "course-calculus-1",
    slug: "calculus-1",
    title: "Calculus 1",
    description: "A student-first path through limits, derivatives, and integrals.",
    order_index: 3,
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "course-calculus-2",
    slug: "calculus-2",
    title: "Calculus 2",
    description: "Integration techniques, series, Taylor polynomials, and curves.",
    order_index: 4,
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "course-calculus-3",
    slug: "calculus-3",
    title: "Calculus 3",
    description: "Vectors, surfaces, partial derivatives, multiple integrals, and vector fields.",
    order_index: 5,
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
];

const topicGroups: Record<string, string[]> = {
  "course-calculus-1": [
    "Limits",
    "Continuity",
    "Derivatives",
    "Applications of Derivatives",
    "Integrals",
    "Applications of Integrals",
  ],
  "course-calculus-2": [
    "Integration Techniques",
    "Sequences and Series",
    "Taylor Polynomials",
    "Parametric Equations",
    "Polar Coordinates",
    "Volumes and Arc Length",
  ],
  "course-calculus-3": [
    "Vectors",
    "Lines and Planes",
    "Partial Derivatives",
    "Multiple Integrals",
    "Vector Fields",
    "Line Integrals",
    "Surface Integrals",
  ],
};

export const mathSeedTopics: MathTopic[] = Object.entries(topicGroups).flatMap(
  ([courseId, topics]) =>
    topics.map((title, index) => ({
      id: `topic-${courseId.replace("course-", "")}-${slugifySeed(title)}`,
      course_id: courseId,
      parent_topic_id: null,
      slug: slugifySeed(title),
      title,
      description: topicDescription(title),
      order_index: index + 1,
      created_at: SEED_TIME,
      updated_at: SEED_TIME,
    })),
);

const foundational = "foundational" satisfies MathDifficulty;

export const mathSeedModules: MathModule[] = [
  {
    id: "module-derivative-as-slope",
    course_id: "course-calculus-1",
    topic_id: "topic-calculus-1-derivatives",
    slug: "derivative-as-slope",
    title: "Derivative as Slope",
    description: "Use a live graph to connect secant slopes, tangent lines, and f'(a).",
    difficulty: foundational,
    calculator_mode: "2d",
    visibility: "published",
    module_json: {
      overview:
        "A derivative is not just a symbolic rule. It measures the slope of the curve at one exact input.",
      learningGoals: [
        "Describe f'(a) as the slope of the tangent line.",
        "Use a graph to compare secant and tangent behavior.",
        "Connect algebraic derivatives to local linear predictions.",
      ],
      graphNotes:
        "Move a to watch the tangent line touch f(x)=x^2 at different points.",
      expressions: [
        { id: "f", latex: "f(x)=x^2" },
        { id: "a", latex: "a=1" },
        { id: "tangent", latex: "y=f'(a)(x-a)+f(a)" },
        { id: "point", latex: "(a,f(a))" },
      ],
      viewport: {
        xMin: -6,
        xMax: 6,
        yMin: -2,
        yMax: 16,
      },
      sections: [
        {
          title: "What the graph is showing",
          body:
            "The point (a, f(a)) sits on the parabola. The line through that point uses f'(a) as its slope, so it becomes the tangent line at x = a.",
        },
        {
          title: "Why it matters",
          body:
            "Derivative rules become easier to remember when each symbol has a geometric job. f'(a) tells you the instantaneous steepness of the curve.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "module-taylor-polynomial-explorer",
    course_id: "course-calculus-2",
    topic_id: "topic-calculus-2-taylor-polynomials",
    slug: "taylor-polynomial-explorer",
    title: "Taylor Polynomial Explorer",
    description: "Compare sin(x) against Taylor polynomials near the center.",
    difficulty: foundational,
    calculator_mode: "2d",
    visibility: "published",
    module_json: {
      overview:
        "Taylor polynomials use derivative information at a center point to build a local algebraic model of a curved function.",
      learningGoals: [
        "Compare approximation quality near and far from x = 0.",
        "Recognize how higher-degree terms improve local fit.",
        "Explain why Taylor polynomials are local models.",
      ],
      graphNotes:
        "Zoom near zero first, then pan outward to see where the polynomial models stop matching sin(x).",
      expressions: [
        { id: "f", latex: "f(x)=\\sin(x)" },
        { id: "p1", latex: "P_1(x)=x" },
        { id: "p3", latex: "P_3(x)=x-\\frac{x^3}{6}" },
        { id: "p5", latex: "P_5(x)=x-\\frac{x^3}{6}+\\frac{x^5}{120}" },
      ],
      viewport: {
        xMin: -8,
        xMax: 8,
        yMin: -4,
        yMax: 4,
      },
      sections: [
        {
          title: "Near the center",
          body:
            "All three polynomials are built from information at x = 0, so the best comparison starts near the origin.",
        },
        {
          title: "Farther away",
          body:
            "A higher-degree Taylor polynomial usually tracks the curve longer, but every polynomial here is still a local approximation.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "module-surface-and-tangent-plane-explorer",
    course_id: "course-calculus-3",
    topic_id: "topic-calculus-3-partial-derivatives",
    slug: "surface-and-tangent-plane-explorer",
    title: "Surface and Tangent Plane Explorer",
    description: "Explore z=x^2+y^2 and tangent planes in three dimensions.",
    difficulty: foundational,
    calculator_mode: "3d",
    visibility: "published",
    module_json: {
      overview:
        "Partial derivatives measure how a surface changes as you move in one coordinate direction while holding the other direction fixed.",
      learningGoals: [
        "Interpret partial derivatives as directional slopes on a surface.",
        "Build the tangent plane at a point.",
        "Use parameters a and b to move the tangent point.",
      ],
      graphNotes:
        "If 3D is enabled for your Desmos key, move a and b to see the tangent plane follow the surface.",
      expressions: [
        { id: "surface", latex: "z=x^2+y^2" },
        { id: "a", latex: "a=1" },
        { id: "b", latex: "b=1" },
        { id: "plane", latex: "z=2a(x-a)+2b(y-b)+a^2+b^2" },
      ],
      sections: [
        {
          title: "The surface",
          body:
            "The graph z = x^2 + y^2 is a bowl. At each point, the surface has an x-direction slope and a y-direction slope.",
        },
        {
          title: "The tangent plane",
          body:
            "The tangent plane is the best flat approximation near a chosen point. It uses both partial derivatives at that point.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
];

export const mathSeedQuestions: QuestionBankItem[] = [
  question({
    id: "question-derivative-meaning",
    moduleId: "module-derivative-as-slope",
    courseId: "course-calculus-1",
    topicId: "topic-calculus-1-derivatives",
    type: "multiple_choice",
    title: "Graphical meaning of f'(a)",
    prompt: "What does f'(a) represent graphically?",
    answer: { correctChoiceId: "choice-derivative-meaning-b" },
    explanation:
      "The derivative at a point is the slope of the tangent line to the curve at that input.",
  }),
  question({
    id: "question-slope-x2-at-3",
    moduleId: "module-derivative-as-slope",
    courseId: "course-calculus-1",
    topicId: "topic-calculus-1-derivatives",
    type: "numeric",
    title: "Slope of x squared at 3",
    prompt: "Find the slope of f(x)=x^2 at x=3.",
    answer: { expected: 6, tolerance: 0.001, units: null },
    explanation: "For f(x)=x^2, f'(x)=2x. At x=3, the slope is 6.",
  }),
  question({
    id: "question-tangent-a-changes",
    moduleId: "module-derivative-as-slope",
    courseId: "course-calculus-1",
    topicId: "topic-calculus-1-derivatives",
    type: "short_answer",
    title: "Moving the tangent point",
    prompt: "What happens to the tangent line as a changes?",
    answer: {
      acceptedAnswers: ["it moves along the curve", "the tangent line moves along the curve"],
      caseSensitive: false,
      normalizeWhitespace: true,
    },
    explanation:
      "Changing a changes the point of tangency, so the line follows the curve and its slope updates.",
  }),
  question({
    id: "question-best-taylor-near-zero",
    moduleId: "module-taylor-polynomial-explorer",
    courseId: "course-calculus-2",
    topicId: "topic-calculus-2-taylor-polynomials",
    type: "multiple_choice",
    title: "Best Taylor approximation near zero",
    prompt: "Which polynomial gives the best approximation to sin(x) near x=0?",
    answer: { correctChoiceId: "choice-best-taylor-c" },
    explanation:
      "P5 includes more matching derivative information at the center, so it usually stays closest near zero.",
  }),
  question({
    id: "question-taylor-far-from-center",
    moduleId: "module-taylor-polynomial-explorer",
    courseId: "course-calculus-2",
    topicId: "topic-calculus-2-taylor-polynomials",
    type: "free_response",
    title: "Why approximations get worse",
    prompt: "Why does the Taylor approximation get worse far from x=0?",
    answer: { completionPoints: 1, rubric: "Mentions local approximation or distance from center." },
    explanation:
      "Taylor polynomials are built from behavior at the center, so they are most trustworthy near that center.",
  }),
  question({
    id: "question-degree-three-sin",
    moduleId: "module-taylor-polynomial-explorer",
    courseId: "course-calculus-2",
    topicId: "topic-calculus-2-taylor-polynomials",
    type: "short_answer",
    title: "Degree 3 Taylor polynomial for sine",
    prompt: "Find the degree 3 Taylor polynomial for sin(x) centered at 0.",
    answer: {
      acceptedAnswers: ["x-x^3/6", "x - x^3/6", "x - (x^3)/6"],
      caseSensitive: false,
      normalizeWhitespace: true,
    },
    explanation: "The Maclaurin polynomial through degree 3 is x - x^3/6.",
  }),
  question({
    id: "question-partials-meaning",
    moduleId: "module-surface-and-tangent-plane-explorer",
    courseId: "course-calculus-3",
    topicId: "topic-calculus-3-partial-derivatives",
    type: "multiple_choice",
    title: "Partial derivative meaning",
    prompt: "What do the partial derivatives represent on the surface?",
    answer: { correctChoiceId: "choice-partials-meaning-b" },
    explanation:
      "They measure slope in the x and y directions while holding the other variable fixed.",
  }),
  question({
    id: "question-tangent-plane",
    moduleId: "module-surface-and-tangent-plane-explorer",
    courseId: "course-calculus-3",
    topicId: "topic-calculus-3-partial-derivatives",
    type: "short_answer",
    title: "Tangent plane at (1,1,2)",
    prompt: "Find the tangent plane to z=x^2+y^2 at (1,1,2).",
    answer: {
      acceptedAnswers: ["z=2x+2y-2", "z = 2x + 2y - 2"],
      caseSensitive: false,
      normalizeWhitespace: true,
    },
    explanation: "At (1,1), f_x=2 and f_y=2, so z=2+2(x-1)+2(y-1)=2x+2y-2.",
  }),
  question({
    id: "question-plane-parameters",
    moduleId: "module-surface-and-tangent-plane-explorer",
    courseId: "course-calculus-3",
    topicId: "topic-calculus-3-partial-derivatives",
    type: "free_response",
    title: "Moving a and b",
    prompt: "What happens as a and b change?",
    answer: { completionPoints: 1, rubric: "Mentions the tangent point and plane moving." },
    explanation:
      "The tangent point moves across the surface and the tangent plane updates to match the local slopes there.",
  }),
];

export const mathSeedChoices: QuestionChoice[] = [
  choice("choice-derivative-meaning-a", "question-derivative-meaning", "The y-intercept of the graph", false, 1),
  choice("choice-derivative-meaning-b", "question-derivative-meaning", "The slope of the tangent line at x=a", true, 2),
  choice("choice-derivative-meaning-c", "question-derivative-meaning", "The area under the curve", false, 3),
  choice("choice-best-taylor-a", "question-best-taylor-near-zero", "P1(x)=x", false, 1),
  choice("choice-best-taylor-b", "question-best-taylor-near-zero", "P3(x)=x-x^3/6", false, 2),
  choice("choice-best-taylor-c", "question-best-taylor-near-zero", "P5(x)=x-x^3/6+x^5/120", true, 3),
  choice("choice-partials-meaning-a", "question-partials-meaning", "The total volume under the surface", false, 1),
  choice("choice-partials-meaning-b", "question-partials-meaning", "The x-direction and y-direction slopes", true, 2),
  choice("choice-partials-meaning-c", "question-partials-meaning", "The equation of every level curve", false, 3),
];

export function getSeedQuestionChoices(questionId: string) {
  return mathSeedChoices.filter((choiceItem) => choiceItem.question_id === questionId);
}

export function getSeedQuestionById(questionId: string) {
  return mathSeedQuestions.find((candidate) => candidate.id === questionId) ?? null;
}

export function getSeedModuleBySlug(moduleSlug: string) {
  return mathSeedModules.find((module) => module.slug === moduleSlug) ?? null;
}

function question(input: {
  id: string;
  courseId: string;
  topicId: string;
  moduleId: string;
  type: QuestionBankItem["type"];
  title: string;
  prompt: string;
  answer: QuestionBankItem["answer_json"];
  explanation: string;
}): QuestionBankItem {
  return {
    id: input.id,
    course_id: input.courseId,
    topic_id: input.topicId,
    module_id: input.moduleId,
    note_id: null,
    graph_state_id: null,
    type: input.type,
    title: input.title,
    prompt_markdown: input.prompt,
    prompt_latex: null,
    answer_json: input.answer,
    explanation_markdown: input.explanation,
    explanation_latex: null,
    difficulty: foundational,
    calculator_allowed: true,
    estimated_time_seconds: 90,
    source_type: "module_seed",
    status: "published",
    created_by: null,
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  };
}

function choice(
  id: string,
  questionId: string,
  text: string,
  isCorrect: boolean,
  orderIndex: number,
): QuestionChoice {
  return {
    id,
    question_id: questionId,
    choice_text: text,
    choice_latex: null,
    is_correct: isCorrect,
    order_index: orderIndex,
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  };
}

function topicDescription(title: string) {
  return `${title} concepts, visual modules, and practice questions.`;
}

function slugifySeed(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
