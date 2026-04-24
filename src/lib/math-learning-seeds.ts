import type {
  MathCourse,
  MathDifficulty,
  MathModule,
  MathTopic,
  QuestionBankItem,
  QuestionChoice,
} from "@/types/math-learning";
import { buildJacobMathModules, buildJacobPracticeQuestions } from "@/lib/jacob-math-coverage";

const SEED_TIME = "2026-01-01T00:00:00.000Z";
const jacobSectionModules = buildJacobMathModules(SEED_TIME);
const jacobSectionQuestions = buildJacobPracticeQuestions(SEED_TIME);

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
  {
    id: "course-jacob-math-notes",
    slug: "jacob-math-notes",
    title: "Jacob Math Notes",
    description: "Geometry through real analysis as one interactive graph, formula, and practice path.",
    order_index: 6,
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
  "course-jacob-math-notes": [
    "Geometry",
    "Algebra 2",
    "Precalculus",
    "Calculus",
    "Multivariable Calculus",
    "Linear Algebra",
    "Differential Equations",
    "Real Analysis",
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
const intermediate = "intermediate" satisfies MathDifficulty;
const advanced = "advanced" satisfies MathDifficulty;

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
  {
    id: "module-jacob-geometry-transformations",
    course_id: "course-jacob-math-notes",
    topic_id: "topic-jacob-math-notes-geometry",
    slug: "jacob-geometry-transformations",
    title: "Jacob Geometry: Transformations and Conics",
    description: "Rigid motions, dilations, circle equations, and conic pictures from Jacob's notes.",
    difficulty: foundational,
    calculator_mode: "2d",
    visibility: "published",
    module_json: {
      overview:
        "Geometry becomes easier when vocabulary, congruence, and coordinate pictures all point to the same object.",
      learningGoals: [
        "Use coordinate rules for rotations, reflections, translations, and dilations.",
        "Connect circle and conic equations to visible shapes.",
        "Use graph references as checks for geometric claims.",
      ],
      graphNotes: "Explore a triangle dilation beside a circle and ellipse reference set.",
      expressions: [
        { id: "triangle-a", latex: "A=(1,1)" },
        { id: "triangle-b", latex: "B=(3,1)" },
        { id: "triangle-c", latex: "C=(2,3)" },
        { id: "image-a", latex: "A'=(2,2)" },
        { id: "circle", latex: "x^2+y^2=9" },
        { id: "ellipse", latex: "\\frac{x^2}{16}+\\frac{y^2}{9}=1" },
      ],
      viewport: { xMin: -6, xMax: 8, yMin: -4, yMax: 8 },
      sections: [
        {
          title: "Start with movement",
          body:
            "Translations slide, rotations turn, reflections flip, and dilations scale. The coordinates are not decoration; they are the proof trail.",
        },
        {
          title: "Use equations as shape machines",
          body:
            "Circle and ellipse equations let students check whether a geometric description matches the picture they expect.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "module-jacob-algebra-functions",
    course_id: "course-jacob-math-notes",
    topic_id: "topic-jacob-math-notes-algebra-2",
    slug: "jacob-algebra-functions",
    title: "Jacob Algebra 2: Functions and Structure",
    description: "Parent transformations, polynomial behavior, rational functions, logs, and matrices.",
    difficulty: foundational,
    calculator_mode: "2d",
    visibility: "published",
    module_json: {
      overview:
        "Algebra 2 is a pattern course: forms, transformations, roots, asymptotes, and rules all describe structure.",
      learningGoals: [
        "Compare parent functions with shifted and scaled versions.",
        "Read polynomial zeros and rational asymptotes from graphs.",
        "Use formulas as compact summaries of algebraic structure.",
      ],
      graphNotes: "Use sliders to change a transformed quadratic and compare it to parent functions.",
      expressions: [
        { id: "a", latex: "a=1" },
        { id: "h", latex: "h=2" },
        { id: "k", latex: "k=3" },
        { id: "quadratic", latex: "y=a(x-h)^2+k" },
        { id: "absolute", latex: "y=|x|" },
        { id: "rational", latex: "y=\\frac{1}{x-1}+2" },
      ],
      viewport: { xMin: -8, xMax: 8, yMin: -6, yMax: 12 },
      sections: [
        {
          title: "Transformations first",
          body:
            "The form y=a f(b(x-h))+k tells the graph story before any arithmetic starts.",
        },
        {
          title: "Structure as a shortcut",
          body:
            "Zeros, holes, asymptotes, and log rules are faster when students can see what each symbol controls.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "module-jacob-precalculus-trig-vectors",
    course_id: "course-jacob-math-notes",
    topic_id: "topic-jacob-math-notes-precalculus",
    slug: "jacob-precalculus-trig-vectors",
    title: "Jacob Precalculus: Trig, Complex Numbers, and Vectors",
    description: "Unit circle habits, trig identities, polar complex form, vectors, growth, and limits.",
    difficulty: intermediate,
    calculator_mode: "2d",
    visibility: "published",
    module_json: {
      overview:
        "Precalculus ties together circular motion, function composition, vectors, and early limiting behavior.",
      learningGoals: [
        "Use the unit circle as the source for trig ratios and identities.",
        "Interpret complex multiplication as rotation and scaling.",
        "Use vector magnitude and direction to prepare for calculus.",
      ],
      graphNotes: "Compare sine, cosine, tangent, and a rotating complex-number point.",
      expressions: [
        { id: "unit-circle", latex: "x^2+y^2=1" },
        { id: "theta", latex: "\\theta=1" },
        { id: "point", latex: "(\\cos(\\theta),\\sin(\\theta))" },
        { id: "sine", latex: "y=\\sin(x)" },
        { id: "cosine", latex: "y=\\cos(x)" },
      ],
      viewport: { xMin: -7, xMax: 7, yMin: -2, yMax: 2 },
      sections: [
        {
          title: "The unit circle is the organizer",
          body:
            "Trig identities, inverse trig, and radian measure become much less mysterious when the circle stays visible.",
        },
        {
          title: "Complex and vector thinking",
          body:
            "A complex number in polar form and a vector in component form both encode magnitude plus direction.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "module-jacob-calculus-tangent-integral",
    course_id: "course-jacob-math-notes",
    topic_id: "topic-jacob-math-notes-calculus",
    slug: "jacob-calculus-tangent-integral",
    title: "Jacob Calculus: Tangents, Accumulation, and Series",
    description: "Limits, derivative rules, integrals, differential equations, parametric curves, and Taylor series.",
    difficulty: intermediate,
    calculator_mode: "2d",
    visibility: "published",
    module_json: {
      overview:
        "Calculus is a pair of ideas: local change through derivatives and total accumulation through integrals.",
      learningGoals: [
        "Read derivatives as tangent slopes and local predictions.",
        "Read integrals as accumulation and signed area.",
        "Use Taylor polynomials as local models.",
      ],
      graphNotes: "Move the tangent point and compare a function with its local linear model.",
      expressions: [
        { id: "f", latex: "f(x)=x^3-3x" },
        { id: "a", latex: "a=1" },
        { id: "tangent", latex: "y=f'(a)(x-a)+f(a)" },
        { id: "area", latex: "0<y<f(x)\\left\\{0<x<2\\right\\}" },
      ],
      viewport: { xMin: -4, xMax: 4, yMin: -8, yMax: 8 },
      sections: [
        {
          title: "Derivative as a local lens",
          body:
            "Every derivative rule should still answer one geometric question: what is the curve doing right here?",
        },
        {
          title: "Integral as reconstruction",
          body:
            "If a rate describes change, an integral rebuilds the total amount from those tiny changes.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "module-jacob-multivariable-surfaces",
    course_id: "course-jacob-math-notes",
    topic_id: "topic-jacob-math-notes-multivariable-calculus",
    slug: "jacob-multivariable-surfaces",
    title: "Jacob Multivariable: Surfaces and Vector Operators",
    description: "Surfaces, tangent planes, gradients, divergence, curl, Jacobians, and the big integral theorems.",
    difficulty: advanced,
    calculator_mode: "3d",
    visibility: "published",
    module_json: {
      overview:
        "Multivariable calculus asks students to keep geometry, algebra, and motion in view at the same time.",
      learningGoals: [
        "Use a 3D surface to interpret partial derivatives.",
        "Connect gradients to steepest ascent and tangent planes.",
        "Separate divergence, curl, and Jacobian roles.",
      ],
      graphNotes: "Switch to 3D, then move a and b to watch the tangent plane follow the surface.",
      expressions: [
        { id: "surface", latex: "z=x^2+y^2" },
        { id: "a", latex: "a=1" },
        { id: "b", latex: "b=1" },
        { id: "plane", latex: "z=2a(x-a)+2b(y-b)+a^2+b^2" },
      ],
      sections: [
        {
          title: "Partial derivatives are slices",
          body:
            "Hold one direction still and inspect slope in the other. The tangent plane combines both directions into one local model.",
        },
        {
          title: "Operators describe fields",
          body:
            "Gradient points uphill, divergence measures source-like behavior, and curl measures rotation-like behavior.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "module-jacob-linear-algebra-transformations",
    course_id: "course-jacob-math-notes",
    topic_id: "topic-jacob-math-notes-linear-algebra",
    slug: "jacob-linear-algebra-transformations",
    title: "Jacob Linear Algebra: Transformations and Eigenvectors",
    description: "Systems, determinants, vector spaces, orthogonality, eigenvalues, least squares, and SVD.",
    difficulty: intermediate,
    calculator_mode: "2d",
    visibility: "published",
    module_json: {
      overview:
        "Linear algebra is the study of transformations that respect addition and scaling.",
      learningGoals: [
        "Interpret matrix columns as transformed basis vectors.",
        "Use determinants as area scale factors in 2D.",
        "Read eigenvectors as directions that keep their line.",
      ],
      graphNotes: "Compare a starting grid vector with transformed basis directions.",
      expressions: [
        { id: "v1", latex: "(1,0)" },
        { id: "v2", latex: "(0,1)" },
        { id: "av1", latex: "(2,1)" },
        { id: "av2", latex: "(1,2)" },
        { id: "line-one", latex: "y=x" },
        { id: "line-two", latex: "y=-x" },
      ],
      viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      sections: [
        {
          title: "Matrices move space",
          body:
            "A matrix is not just a table. It tells every point where to go, starting with the basis vectors.",
        },
        {
          title: "Eigenvectors are stable directions",
          body:
            "When a transformation keeps a direction on the same line, the stretch factor is the eigenvalue.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "module-jacob-differential-equations-slope-fields",
    course_id: "course-jacob-math-notes",
    topic_id: "topic-jacob-math-notes-differential-equations",
    slug: "jacob-differential-equations-slope-fields",
    title: "Jacob Differential Equations: Solution Behavior",
    description: "First-order equations, second-order equations, systems, Fourier series, and heat flow.",
    difficulty: intermediate,
    calculator_mode: "2d",
    visibility: "published",
    module_json: {
      overview:
        "Differential equations study functions by describing how they change instead of giving the function first.",
      learningGoals: [
        "Recognize separable and linear first-order equations.",
        "Use characteristic equations for common second-order problems.",
        "Connect solution curves to long-term behavior.",
      ],
      graphNotes: "Use the logistic curve to see carrying capacity and flattening behavior.",
      expressions: [
        { id: "M", latex: "M=10" },
        { id: "k", latex: "k=0.7" },
        { id: "solution", latex: "P(t)=\\frac{M}{1+9e^{-kt}}" },
        { id: "capacity", latex: "y=M" },
      ],
      viewport: { xMin: -1, xMax: 10, yMin: -1, yMax: 12 },
      sections: [
        {
          title: "Behavior before formula",
          body:
            "Ask whether solutions grow, decay, oscillate, or settle before diving into symbolic methods.",
        },
        {
          title: "Fourier as a basis idea",
          body:
            "Fourier series use orthogonality to rebuild functions from sine and cosine pieces.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  {
    id: "module-jacob-real-analysis-sequence-limits",
    course_id: "course-jacob-math-notes",
    topic_id: "topic-jacob-math-notes-real-analysis",
    slug: "jacob-real-analysis-sequence-limits",
    title: "Jacob Real Analysis: Limits and Proof Habits",
    description: "Sets, sequences, metric spaces, series, continuity, uniform convergence, differentiation, and integration.",
    difficulty: advanced,
    calculator_mode: "2d",
    visibility: "published",
    module_json: {
      overview:
        "Real analysis turns calculus statements into precise definitions and proof patterns.",
      learningGoals: [
        "Read limits through epsilon-style definitions.",
        "Use sequences as a testing language for continuity and convergence.",
        "Separate pointwise ideas from uniform ideas.",
      ],
      graphNotes: "Plot a sequence settling toward its limit, then use the picture to support the definition.",
      expressions: [
        { id: "sequence", latex: "a_n=1+\\frac{1}{n}" },
        { id: "limit", latex: "y=1" },
      ],
      viewport: { xMin: 0, xMax: 20, yMin: 0.8, yMax: 2.2 },
      sections: [
        {
          title: "Definitions are tools",
          body:
            "Epsilon, delta, metric, compactness, and uniform convergence all exist to control how close objects can get.",
        },
        {
          title: "Proof practice is the module",
          body:
            "The goal is not to memorize one proof. It is to recognize which definition gives you the right lever.",
        },
      ],
    },
    created_at: SEED_TIME,
    updated_at: SEED_TIME,
  },
  ...jacobSectionModules,
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
  question({
    id: "question-jacob-dilation-meaning",
    moduleId: "module-jacob-geometry-transformations",
    courseId: "course-jacob-math-notes",
    topicId: "topic-jacob-math-notes-geometry",
    type: "short_answer",
    title: "Dilation effect",
    prompt: "What does a dilation with scale factor 2 from the origin do to every coordinate?",
    answer: {
      acceptedAnswers: ["it doubles every coordinate", "doubles every coordinate", "multiplies each coordinate by 2"],
      caseSensitive: false,
      normalizeWhitespace: true,
    },
    explanation: "A dilation from the origin with scale factor 2 sends (x,y) to (2x,2y).",
  }),
  question({
    id: "question-jacob-transform-form",
    moduleId: "module-jacob-algebra-functions",
    courseId: "course-jacob-math-notes",
    topicId: "topic-jacob-math-notes-algebra-2",
    type: "free_response",
    title: "Reading a transformed parent function",
    prompt: "In y=a f(b(x-h))+k, what do h and k control on the graph?",
    answer: { completionPoints: 1, rubric: "Mentions horizontal and vertical shifting." },
    explanation: "h shifts the graph horizontally and k shifts it vertically.",
  }),
  question({
    id: "question-jacob-unit-circle",
    moduleId: "module-jacob-precalculus-trig-vectors",
    courseId: "course-jacob-math-notes",
    topicId: "topic-jacob-math-notes-precalculus",
    type: "short_answer",
    title: "Unit circle coordinates",
    prompt: "What point on the unit circle corresponds to angle theta?",
    answer: {
      acceptedAnswers: ["(cos theta, sin theta)", "(cos(theta), sin(theta))", "(\\cos\\theta,\\sin\\theta)"],
      caseSensitive: false,
      normalizeWhitespace: true,
    },
    explanation: "The unit-circle point is (cos theta, sin theta), which makes trig ratios geometric.",
  }),
  question({
    id: "question-jacob-tangent-purpose",
    moduleId: "module-jacob-calculus-tangent-integral",
    courseId: "course-jacob-math-notes",
    topicId: "topic-jacob-math-notes-calculus",
    type: "free_response",
    title: "Tangent line purpose",
    prompt: "Why is the tangent line useful for local prediction?",
    answer: { completionPoints: 1, rubric: "Mentions matching local slope or nearby approximation." },
    explanation: "The tangent line uses the current point and derivative to approximate nearby function values.",
  }),
  question({
    id: "question-jacob-partials-tangent-plane",
    moduleId: "module-jacob-multivariable-surfaces",
    courseId: "course-jacob-math-notes",
    topicId: "topic-jacob-math-notes-multivariable-calculus",
    type: "short_answer",
    title: "Two slopes make a plane",
    prompt: "What two pieces of derivative information does a tangent plane use?",
    answer: {
      acceptedAnswers: ["partial derivatives in x and y", "the x partial and y partial", "f_x and f_y"],
      caseSensitive: false,
      normalizeWhitespace: true,
    },
    explanation: "A tangent plane uses the x-direction and y-direction partial derivatives at the point.",
  }),
  question({
    id: "question-jacob-determinant-area",
    moduleId: "module-jacob-linear-algebra-transformations",
    courseId: "course-jacob-math-notes",
    topicId: "topic-jacob-math-notes-linear-algebra",
    type: "free_response",
    title: "Determinant meaning",
    prompt: "What geometric idea does the determinant of a 2D matrix measure?",
    answer: { completionPoints: 1, rubric: "Mentions signed area scaling." },
    explanation: "The determinant measures signed area scaling under the linear transformation.",
  }),
  question({
    id: "question-jacob-logistic-capacity",
    moduleId: "module-jacob-differential-equations-slope-fields",
    courseId: "course-jacob-math-notes",
    topicId: "topic-jacob-math-notes-differential-equations",
    type: "numeric",
    title: "Logistic carrying capacity",
    prompt: "In the seeded graph P(t)=M/(1+9e^(-kt)) with M=10, what value does P(t) approach?",
    answer: { expected: 10, tolerance: 0.001, units: null },
    explanation: "M is the carrying capacity, so the logistic solution approaches 10.",
  }),
  question({
    id: "question-jacob-sequence-limit",
    moduleId: "module-jacob-real-analysis-sequence-limits",
    courseId: "course-jacob-math-notes",
    topicId: "topic-jacob-math-notes-real-analysis",
    type: "numeric",
    title: "Sequence limit",
    prompt: "What is the limit of a_n = 1 + 1/n as n goes to infinity?",
    answer: { expected: 1, tolerance: 0.001, units: null },
    explanation: "The term 1/n goes to 0, so the sequence approaches 1.",
  }),
  ...jacobSectionQuestions,
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
