import type {
  CalculatorMode,
  MathDifficulty,
  MathModule,
  QuestionBankItem,
} from "@/types/math-learning";

export const JACOB_MATH_COURSE_ID = "course-jacob-math-notes";

const topicIds = {
  geometry: "topic-jacob-math-notes-geometry",
  algebra2: "topic-jacob-math-notes-algebra-2",
  precalculus: "topic-jacob-math-notes-precalculus",
  calculus: "topic-jacob-math-notes-calculus",
  multivariable: "topic-jacob-math-notes-multivariable-calculus",
  linearAlgebra: "topic-jacob-math-notes-linear-algebra",
  differentialEquations: "topic-jacob-math-notes-differential-equations",
  realAnalysis: "topic-jacob-math-notes-real-analysis",
} as const;

export type JacobPresetRecommendation =
  | "Math Simple Presentation"
  | "Math Guided Study"
  | "Math Graph Lab"
  | "Math Proof / Concept Mode"
  | "Math Practice Mode"
  | "Full Math Canvas";

export type JacobFormulaCard = {
  id: string;
  label: string;
  latex: string;
  explanation: string;
};

export type JacobGraphCard = {
  id: string;
  label: string;
  mode: Exclude<CalculatorMode, "none">;
  description: string;
  expressions: string[];
  viewport?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
};

export type JacobPracticeSeed = {
  id: string;
  type: QuestionBankItem["type"];
  title: string;
  prompt: string;
  answer: QuestionBankItem["answer_json"];
  explanation: string;
};

export type JacobCoverageSection = {
  sectionNumber: number;
  title: string;
  slug: string;
  lessonId: string;
  topicId: string;
  sourceCoverageStatus: "source-backed starter" | "source-backed expanded";
  sourceSubsections: string[];
  overview: string;
  contentBlocks: string[];
  formulas: JacobFormulaCard[];
  graphs: JacobGraphCard[];
  practice: JacobPracticeSeed[];
  relatedConcepts: string[];
  presetRecommendation: JacobPresetRecommendation;
  remainingTodos: string[];
  difficulty: MathDifficulty;
};

const graph2d = (input: Omit<JacobGraphCard, "mode">): JacobGraphCard => ({ ...input, mode: "2d" });
const graph3d = (input: Omit<JacobGraphCard, "mode">): JacobGraphCard => ({ ...input, mode: "3d" });

const shortAnswer = (
  id: string,
  title: string,
  prompt: string,
  acceptedAnswers: string[],
  explanation: string,
): JacobPracticeSeed => ({
  id,
  type: "short_answer",
  title,
  prompt,
  answer: {
    acceptedAnswers,
    caseSensitive: false,
    normalizeWhitespace: true,
  },
  explanation,
});

const numeric = (
  id: string,
  title: string,
  prompt: string,
  expected: number,
  explanation: string,
  tolerance = 0.001,
): JacobPracticeSeed => ({
  id,
  type: "numeric",
  title,
  prompt,
  answer: { expected, tolerance, units: null },
  explanation,
});

const freeResponse = (
  id: string,
  title: string,
  prompt: string,
  rubric: string,
  explanation: string,
): JacobPracticeSeed => ({
  id,
  type: "free_response",
  title,
  prompt,
  answer: { completionPoints: 1, rubric },
  explanation,
});

const trueFalse = (
  id: string,
  title: string,
  prompt: string,
  expectedBoolean: boolean,
  explanation: string,
): JacobPracticeSeed => ({
  id,
  type: "true_false",
  title,
  prompt,
  answer: { expectedBoolean },
  explanation,
});

const stepOrdering = (
  id: string,
  title: string,
  prompt: string,
  correctOrder: string[],
  explanation: string,
): JacobPracticeSeed => ({
  id,
  type: "step_ordering",
  title,
  prompt,
  answer: { correctOrder },
  explanation,
});

export const jacobMathCoverage: JacobCoverageSection[] = [
  {
    sectionNumber: 1,
    title: "Geometry Language, Rigid Motions, and Dilation",
    slug: "01-geometry-language-rigid-motions-dilation",
    lessonId: "lesson-jacob-geometry-foundations",
    topicId: topicIds.geometry,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Terms & Labels", "Rigid Transformations", "Dilation"],
    overview:
      "Jacob starts geometry by making the vocabulary usable, then turns transformations into coordinate actions students can see.",
    contentBlocks: [
      "Points, lines, rays, transversals, congruence, similarity, LHS/RHS, and AROC vocabulary are introduced as working language.",
      "Translations, rotations, and reflections preserve lengths and angles, so they become the engine for congruence arguments.",
      "Dilations scale distances from a center, changing size while preserving shape.",
    ],
    formulas: [
      {
        id: "jacob-01-rotation-90",
        label: "90 degree rotation",
        latex: "(x,y)\\mapsto(-y,x)",
        explanation: "A counterclockwise quarter-turn around the origin swaps the coordinates and negates the new x-coordinate.",
      },
      {
        id: "jacob-01-dilation",
        label: "Dilation from origin",
        latex: "(x,y)\\mapsto(kx,ky)",
        explanation: "A scale factor k multiplies every coordinate when the center is the origin.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-01-dilation-demo",
        label: "Rigid motion and dilation coordinates",
        description: "Move a triangle through rotation and dilation rules from Jacob's geometry opening.",
        expressions: ["A=(1,1)", "B=(3,1)", "C=(2,3)", "A'=(-1,1)", "B'=(-1,3)", "C'=(-3,2)", "D=(2,2)", "E=(6,2)", "F=(4,6)"],
        viewport: { xMin: -6, xMax: 8, yMin: -4, yMax: 8 },
      }),
    ],
    practice: [
      shortAnswer(
        "rotation-rule",
        "Rotation rule",
        "What is the image of (3,2) after a 90 degree counterclockwise rotation around the origin?",
        ["(-2,3)", "(-2, 3)"],
        "Jacob calls out the pattern (x,y) -> (-y,x), so (3,2) becomes (-2,3).",
      ),
      freeResponse(
        "dilation-meaning",
        "Dilation meaning",
        "Explain what a dilation with scale factor 3 does to distances from the center.",
        "Mentions distances from the center being multiplied by 3.",
        "Dilations multiply every distance from the center by the scale factor.",
      ),
    ],
    relatedConcepts: ["congruence", "similarity", "coordinate geometry", "matrix transformations"],
    presetRecommendation: "Math Guided Study",
    remainingTodos: ["Add draggable point construction for arbitrary centers of dilation."],
    difficulty: "foundational",
  },
  {
    sectionNumber: 2,
    title: "Triangle Congruence, Similarity, and Angle Bisectors",
    slug: "02-triangle-congruence-similarity-angle-bisectors",
    lessonId: "lesson-jacob-triangles-similarity",
    topicId: topicIds.geometry,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Justifying Congruence in Triangles", "Similarity", "Angle Bisector Theorem"],
    overview:
      "This section turns rigid motions and dilations into proof tools for triangles, similarity ratios, and angle bisectors.",
    contentBlocks: [
      "Congruence can be justified by mapping one triangle to another with rigid transformations.",
      "Jacob distinguishes trustworthy congruence patterns such as SSS, SAS, ASA, AAS, and HL from AAA and SSA traps.",
      "Similarity depends on proportional sides or angle information and is connected back to dilation.",
    ],
    formulas: [
      {
        id: "jacob-02-similarity-ratio",
        label: "Similarity side ratios",
        latex: "\\frac{AB}{DE}=\\frac{BC}{EF}=\\frac{AC}{DF}",
        explanation: "Corresponding sides of similar triangles share a common scale ratio.",
      },
      {
        id: "jacob-02-angle-bisector",
        label: "Angle bisector theorem",
        latex: "\\frac{BD}{DC}=\\frac{AB}{AC}",
        explanation: "An angle bisector splits the opposite side in the same ratio as the adjacent sides.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-02-angle-bisector-demo",
        label: "Angle bisector ratio picture",
        description: "A triangle split by an angle bisector so students can connect side lengths to ratios.",
        expressions: ["A=(0,0)", "B=(5,0)", "C=(1.5,3)", "D=(2,0)", "polygon(A,B,C)", "segment(C,D)"],
        viewport: { xMin: -1, xMax: 6, yMin: -1, yMax: 5 },
      }),
    ],
    practice: [
      trueFalse(
        "aaa-congruence",
        "AAA trap",
        "AAA is enough to prove two triangles are congruent.",
        false,
        "AAA proves similarity, not congruence, because the side lengths can scale.",
      ),
      shortAnswer(
        "angle-bisector-ratio",
        "Angle bisector ratio",
        "If AB=6 and AC=9, what ratio does the angle bisector create on the opposite side?",
        ["2:3", "6:9", "2/3"],
        "The opposite side is split in the same ratio as AB:AC, which simplifies to 2:3.",
      ),
    ],
    relatedConcepts: ["rigid motions", "dilation", "right triangle trig", "proof writing"],
    presetRecommendation: "Math Proof / Concept Mode",
    remainingTodos: ["Add visual proof cards for each congruence postulate."],
    difficulty: "foundational",
  },
  {
    sectionNumber: 3,
    title: "Right-Triangle Trig, Inverse Trig, and Special Triangles",
    slug: "03-right-triangle-trig-inverse-trig-special-triangles",
    lessonId: "lesson-jacob-right-triangle-trig",
    topicId: topicIds.geometry,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Sine/Cosine/Tangent", "Special Right Triangles", "Cute Tricks and Elevating/Depressing Angles", "Reciprocal Trig Ratios"],
    overview:
      "Jacob builds trig from right-triangle side ratios, inverse trig, special triangles, and the Pythagorean identity.",
    contentBlocks: [
      "SOHCAHTOA is introduced as a way to turn angle information into side ratios.",
      "Inverse trig undoes a trig ratio to recover the angle.",
      "Special right triangles and angle-of-elevation/depression problems create repeatable shortcuts.",
    ],
    formulas: [
      {
        id: "jacob-03-sohcahtoa",
        label: "SOHCAHTOA",
        latex: "\\sin\\theta=\\frac{opp}{hyp},\\quad \\cos\\theta=\\frac{adj}{hyp},\\quad \\tan\\theta=\\frac{opp}{adj}",
        explanation: "Jacob uses these as the basic bridge between a right-triangle angle and side lengths.",
      },
      {
        id: "jacob-03-pythagorean-identity",
        label: "Pythagorean identity",
        latex: "\\sin^2\\theta+\\cos^2\\theta=1",
        explanation: "The identity follows from dividing the Pythagorean theorem by the hypotenuse squared.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-03-unit-circle-ratios",
        label: "Unit circle from triangle ratios",
        description: "Connect right-triangle trig ratios to unit-circle coordinates.",
        expressions: ["x^2+y^2=1", "a=45", "P=(\\cos(a^\\circ),\\sin(a^\\circ))", "segment((0,0),P)"],
        viewport: { xMin: -1.4, xMax: 1.4, yMin: -1.4, yMax: 1.4 },
      }),
    ],
    practice: [
      numeric("inverse-tangent", "Inverse tangent", "If opposite=3 and adjacent=4, tan(theta)=0.75. Approximate theta in degrees.", 36.87, "theta is arctan(3/4), about 36.87 degrees.", 0.05),
      shortAnswer("special-45", "45-45-90 ratio", "What is the side ratio in a 45-45-90 triangle?", ["1:1:sqrt(2)", "1:1:√2", "x:x:x√2"], "The legs match and the hypotenuse is leg times sqrt(2)."),
    ],
    relatedConcepts: ["similarity", "unit circle", "trig identities", "derivatives of trig"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add triangle diagram controls for elevation/depression problems."],
    difficulty: "foundational",
  },
  {
    sectionNumber: 4,
    title: "Coordinate Geometry, Segment Division, and Conic Basics",
    slug: "04-coordinate-geometry-segment-division-conic-basics",
    lessonId: "lesson-jacob-circles-conics",
    topicId: topicIds.geometry,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Dividing Line Segments", "Conic Sections", "Focus and Directrix of a parabola"],
    overview:
      "This section makes coordinate formulas visual: divide segments, name conics, and connect parabolas to focus/directrix distance.",
    contentBlocks: [
      "Jacob first divides a segment graphically, then one coordinate at a time.",
      "Conics are introduced as slices of cones and then translated into standard equations.",
      "The parabola proof comes from equal distance to focus and directrix.",
    ],
    formulas: [
      {
        id: "jacob-04-segment-division",
        label: "Segment division",
        latex: "B=A+\\frac{AB}{AC}(C-A)",
        explanation: "Start at A, then move the desired fraction of the vector from A to C.",
      },
      {
        id: "jacob-04-parabola",
        label: "Vertical parabola",
        latex: "(x-h)^2=4p(y-k)",
        explanation: "p controls the distance from vertex to focus and directrix.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-04-conic-basics",
        label: "Conic and segment division lab",
        description: "Plot segment division alongside basic circle/parabola conics.",
        expressions: ["A=(-1,4)", "C=(4,-6)", "B=A+\\frac{3}{5}(C-A)", "(x-1)^2+(y+1)^2=9", "(x-2)^2=4(y+1)"],
        viewport: { xMin: -6, xMax: 8, yMin: -8, yMax: 8 },
      }),
    ],
    practice: [
      shortAnswer("segment-point", "Segment point", "Using Jacob's example, what point lies 3/5 of the way from (-1,4) to (4,-6)?", ["(2,-2)", "(2, -2)"], "Move 3/5 of the change (5,-10), giving (-1,4)+(3,-6)=(2,-2)."),
      trueFalse("parabola-focus", "Parabola definition", "A parabola can be defined by equal distance to a focus and a directrix.", true, "That equal-distance condition is the geometric definition Jacob uses for the proof."),
    ],
    relatedConcepts: ["distance formula", "circles", "polar coordinates", "quadratic functions"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add separate ellipse and hyperbola sliders for a, b, and c."],
    difficulty: "foundational",
  },
  {
    sectionNumber: 5,
    title: "Circles, Radians, and Laws of Sines and Cosines",
    slug: "05-circles-radians-laws-sines-cosines",
    lessonId: "lesson-jacob-circles-laws",
    topicId: topicIds.geometry,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Circles", "Actual Radian measurements", "Sectors", "Law of Sines & Cosines", "Ellipses"],
    overview:
      "Jacob moves from circle vocabulary to radians, sector formulas, triangle laws, and ellipse/hyperbola standard forms.",
    contentBlocks: [
      "Tangents, secants, chords, arcs, sectors, and inscribed angles become a circle toolkit.",
      "Radians are introduced by comparing arc length to radius.",
      "The Law of Sines and Law of Cosines extend right-triangle trigonometry to general triangles.",
    ],
    formulas: [
      {
        id: "jacob-05-arc-length",
        label: "Arc length",
        latex: "s=r\\theta",
        explanation: "Radians measure how many radii fit along an arc.",
      },
      {
        id: "jacob-05-law-cosines",
        label: "Law of cosines",
        latex: "c^2=a^2+b^2-2ab\\cos C",
        explanation: "This generalizes the Pythagorean theorem when the included angle is not 90 degrees.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-05-circle-radians",
        label: "Circle radians and ellipse forms",
        description: "Compare a unit circle, a sector angle, and an ellipse standard form.",
        expressions: ["x^2+y^2=1", "a=1", "\\frac{x^2}{9}+\\frac{y^2}{4}=1", "P=(\\cos(a),\\sin(a))"],
        viewport: { xMin: -4, xMax: 4, yMin: -3, yMax: 3 },
      }),
    ],
    practice: [
      numeric("arc-length", "Arc length", "If r=5 and theta=2 radians, what is the arc length?", 10, "Use s=r theta, so s=5*2=10."),
      shortAnswer("law-sines-purpose", "Law of sines purpose", "What kind of triangle problem does the Law of Sines help solve?", ["non-right triangles", "general triangles", "triangles that are not right triangles"], "The Law of Sines works beyond right triangles when angle-side pairs are known."),
    ],
    relatedConcepts: ["right triangle trig", "unit circle", "polar coordinates", "conics"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add circle theorem proof-step cards from the source diagrams."],
    difficulty: "foundational",
  },
  {
    sectionNumber: 6,
    title: "Polynomial Operations, Cubes, and Finite Series",
    slug: "06-polynomial-operations-cubes-finite-series",
    lessonId: "lesson-jacob-polynomials-series",
    topicId: topicIds.algebra2,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Polynomial Operations", "Sum of and Difference of Cubes", "Polynomial Remainder Theorem", "I and Sum of Series"],
    overview:
      "This lesson turns polynomial structure, special factoring, synthetic division, and finite series into reusable algebra tools.",
    contentBlocks: [
      "Jacob emphasizes degree, standard form, constants, and the structure of polynomial division.",
      "Sum and difference of cubes are special factor patterns worth recognizing quickly.",
      "Finite geometric series are derived by multiplying by r and subtracting.",
    ],
    formulas: [
      {
        id: "jacob-06-difference-cubes",
        label: "Difference of cubes",
        latex: "a^3-b^3=(a-b)(a^2+ab+b^2)",
        explanation: "A special cubic pattern that turns a hard expression into a product.",
      },
      {
        id: "jacob-06-geometric-series",
        label: "Finite geometric series",
        latex: "S_n=a\\frac{1-r^n}{1-r}",
        explanation: "Jacob derives this by aligning the original series with r times the series.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-06-polynomial-zeros",
        label: "Polynomial zeros and factors",
        description: "See how a factored polynomial makes roots visible.",
        expressions: ["f(x)=(x-2)(x+1)(x-4)", "y=f(x)"],
        viewport: { xMin: -4, xMax: 6, yMin: -12, yMax: 12 },
      }),
    ],
    practice: [
      shortAnswer("cube-factor", "Cube factor pattern", "Factor a^3-b^3.", ["(a-b)(a^2+ab+b^2)", "(a - b)(a^2 + ab + b^2)"], "Use Jacob's difference of cubes pattern."),
      numeric("finite-series", "Finite geometric sum", "Find 1+2+4+8.", 15, "This is a geometric series with four terms: 1+2+4+8=15."),
    ],
    relatedConcepts: ["graphing polynomials", "rational functions", "series", "Taylor series"],
    presetRecommendation: "Math Guided Study",
    remainingTodos: ["Add synthetic division table interaction."],
    difficulty: "foundational",
  },
  {
    sectionNumber: 7,
    title: "Graphing Polynomials, Rational Exponents, and Logarithms",
    slug: "07-graphing-polynomials-rational-exponents-logarithms",
    lessonId: "lesson-jacob-logs-transformations",
    topicId: topicIds.algebra2,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Graphing Polynomials", "Rational Exponents", "Logarithms", "Logarithm properties"],
    overview:
      "This lesson connects end behavior, exponent rewriting, and logarithm rules as ways to read algebraic structure.",
    contentBlocks: [
      "Polynomial graphs reveal zeros, multiplicity behavior, and long-term direction.",
      "Rational exponents are rewritten as roots and powers.",
      "Jacob derives logarithm properties from exponent laws rather than treating them as magic rules.",
    ],
    formulas: [
      {
        id: "jacob-07-rational-exponent",
        label: "Rational exponent",
        latex: "a^{m/n}=\\sqrt[n]{a^m}",
        explanation: "Fractional exponents encode roots and powers in one notation.",
      },
      {
        id: "jacob-07-log-product",
        label: "Log product rule",
        latex: "\\log_b(MN)=\\log_b(M)+\\log_b(N)",
        explanation: "Products inside a logarithm become sums because exponents add when like bases multiply.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-07-log-polynomial",
        label: "Polynomial and log behavior",
        description: "Compare polynomial end behavior with logarithmic growth.",
        expressions: ["f(x)=x^3-3x", "g(x)=\\log(x)", "h(x)=\\sqrt{x}"],
        viewport: { xMin: -4, xMax: 8, yMin: -8, yMax: 8 },
      }),
    ],
    practice: [
      shortAnswer("rational-exponent", "Rewrite exponent", "Rewrite x^(3/2) using radicals.", ["sqrt(x^3)", "\\sqrt{x^3}", "x sqrt(x)", "x\\sqrt{x}"], "x^(3/2) means the square root of x cubed."),
      shortAnswer("log-product", "Log rule", "Expand log_b(xy).", ["log_b(x)+log_b(y)", "\\log_b(x)+\\log_b(y)"], "The product rule turns multiplication into addition."),
    ],
    relatedConcepts: ["polynomial division", "parent functions", "limits", "exponential growth"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add multiplicity toggles for repeated roots."],
    difficulty: "foundational",
  },
  {
    sectionNumber: 8,
    title: "Parent Functions, Unit Circle, Rational Functions, and Matrices",
    slug: "08-parent-functions-unit-circle-rational-functions-matrices",
    lessonId: "lesson-jacob-rational-matrices",
    topicId: topicIds.algebra2,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Parent Functions with Transformations of Functions", "Trigonometry-Unit Circle", "Rational Functions", "Binomial Expansion Theorem", "Matrices"],
    overview:
      "Jacob ties parent graph transformations, unit-circle coordinates, rational-function behavior, binomial expansion, and matrices into a pre-calculus toolkit.",
    contentBlocks: [
      "The transformation form y=a f(b(x-h))+k controls shifting, stretching, and reflecting.",
      "The unit circle turns cosine into x-coordinate and sine into y-coordinate.",
      "Matrices are introduced as organized multiplication rules and transformations.",
    ],
    formulas: [
      {
        id: "jacob-08-transform-form",
        label: "Parent transformation",
        latex: "g(x)=a f(b(x-h))+k",
        explanation: "a and b scale/reflect, while h and k shift the parent function.",
      },
      {
        id: "jacob-08-binomial",
        label: "Binomial theorem",
        latex: "(a+b)^n=\\sum_{k=0}^{n}\\binom{n}{k}a^{n-k}b^k",
        explanation: "The theorem organizes every term in a binomial expansion.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-08-parent-transformations",
        label: "Parent function transformation lab",
        description: "Compare a parent function to shifted and scaled versions.",
        expressions: ["f(x)=x^2", "a=1", "h=2", "k=3", "g(x)=a f(x-h)+k", "x^2+y^2=1"],
        viewport: { xMin: -6, xMax: 8, yMin: -4, yMax: 10 },
      }),
    ],
    practice: [
      freeResponse("transform-meaning", "Transformation meaning", "In g(x)=a f(b(x-h))+k, explain what h and k control.", "Mentions horizontal and vertical shifts.", "h shifts horizontally and k shifts vertically."),
      shortAnswer("unit-circle-point", "Unit circle point", "What is the unit-circle point for angle theta?", ["(cos theta, sin theta)", "(cos(theta), sin(theta))"], "Cosine is the x-coordinate and sine is the y-coordinate."),
    ],
    relatedConcepts: ["trig identities", "matrix transformations", "complex plane", "limits"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add rational asymptote graph cards with removable holes."],
    difficulty: "intermediate",
  },
  {
    sectionNumber: 9,
    title: "Composite Functions, Trig Identities, and Complex Numbers",
    slug: "09-composite-functions-trig-identities-complex-numbers",
    lessonId: "lesson-jacob-functions-trig-identities",
    topicId: topicIds.precalculus,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Composite Functions", "Trig identity families", "Complex numbers"],
    overview:
      "This section links function composition, inverse reasoning, trig identity structure, and complex numbers in rectangular/polar form.",
    contentBlocks: [
      "Composition feeds one function's output into another function.",
      "Trig identities are built from reciprocal, quotient, Pythagorean, and angle-addition families.",
      "Complex polar form makes multiplication feel like scaling plus rotation.",
    ],
    formulas: [
      {
        id: "jacob-09-composition",
        label: "Function composition",
        latex: "(f\\circ g)(x)=f(g(x))",
        explanation: "The output of g becomes the input of f.",
      },
      {
        id: "jacob-09-complex-polar",
        label: "Complex polar form",
        latex: "z=r(\\cos\\theta+i\\sin\\theta)",
        explanation: "r gives size, theta gives direction.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-09-complex-plane",
        label: "Complex multiplication picture",
        description: "Use the complex plane to see rotation and scaling.",
        expressions: ["r=2", "a=45", "P=(r\\cos(a^\\circ),r\\sin(a^\\circ))", "segment((0,0),P)"],
        viewport: { xMin: -4, xMax: 4, yMin: -4, yMax: 4 },
      }),
    ],
    practice: [
      shortAnswer("composition", "Composition notation", "Write the notation for f applied after g.", ["(f o g)(x)", "(f∘g)(x)", "f(g(x))", "(f\\circ g)(x)"], "Composition means f(g(x))."),
      trueFalse("polar-rotation", "Complex polar meaning", "In polar form, the angle controls direction in the complex plane.", true, "The radius gives size and the angle gives direction."),
    ],
    relatedConcepts: ["unit circle", "vectors", "matrix rotations", "Euler form"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add an identity-matching practice set."],
    difficulty: "intermediate",
  },
  {
    sectionNumber: 10,
    title: "Vectors, Matrices Continued, Probability, Growth, Series, and Precalculus Limits",
    slug: "10-vectors-matrices-probability-growth-series-precalc-limits",
    lessonId: "lesson-jacob-complex-vectors",
    topicId: topicIds.precalculus,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Vectors", "Matrices Continued", "Probability", "Growth and decay", "Series and limits"],
    overview:
      "Jacob closes precalculus by grouping vector magnitude, probability counting, exponential models, series, and informal limits.",
    contentBlocks: [
      "Vectors are quantities with direction and magnitude.",
      "Combinations and probability count possible selections.",
      "Growth and decay models connect exponential notation to changing quantities over time.",
    ],
    formulas: [
      {
        id: "jacob-10-vector-magnitude",
        label: "Vector magnitude",
        latex: "\\|\\vec v\\|=\\sqrt{x^2+y^2}",
        explanation: "Magnitude is the distance from the origin to the vector tip.",
      },
      {
        id: "jacob-10-growth",
        label: "Exponential growth model",
        latex: "A(t)=A_0(1+r)^t",
        explanation: "The initial amount is repeatedly multiplied by the same growth factor.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-10-vector-growth",
        label: "Vectors and growth curves",
        description: "Compare vector magnitude to exponential growth behavior.",
        expressions: ["v=(3,4)", "segment((0,0),v)", "A(t)=2(1.2)^t"],
        viewport: { xMin: -1, xMax: 8, yMin: -1, yMax: 8 },
      }),
    ],
    practice: [
      numeric("vector-magnitude", "Vector magnitude", "Find the magnitude of vector <3,4>.", 5, "Use sqrt(3^2+4^2)=5."),
      shortAnswer("combination", "Combination formula", "What formula counts combinations of n things taken r at a time?", ["n!/(r!(n-r)!)", "\\frac{n!}{r!(n-r)!}", "C(n,r)"], "Jacob uses n choose r for selection without order."),
    ],
    relatedConcepts: ["complex numbers", "limits", "differential equations", "linear algebra"],
    presetRecommendation: "Math Guided Study",
    remainingTodos: ["Add probability matching questions for permutations versus combinations."],
    difficulty: "intermediate",
  },
  {
    sectionNumber: 11,
    title: "Calculus Limits and the Derivative Definition",
    slug: "11-calculus-limits-derivative-definition",
    lessonId: "lesson-jacob-calculus-limits",
    topicId: topicIds.calculus,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Limits", "Epsilon-delta", "Derivative definition", "Important limits", "L'Hopital"],
    overview:
      "Calculus begins with local behavior: what functions approach, how epsilon-delta formalizes it, and how derivatives are born from difference quotients.",
    contentBlocks: [
      "Limits are local predictions near a point, not necessarily the value at the point.",
      "The derivative definition takes average rate of change and lets h approach zero.",
      "Important trig limits and L'Hopital's rule become tools for indeterminate forms.",
    ],
    formulas: [
      {
        id: "jacob-11-derivative-definition",
        label: "Derivative definition",
        latex: "f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}",
        explanation: "Average slope becomes instantaneous slope as h shrinks.",
      },
      {
        id: "jacob-11-sin-limit",
        label: "Sine limit",
        latex: "\\lim_{x\\to0}\\frac{\\sin x}{x}=1",
        explanation: "This limit anchors derivatives of trig functions.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-11-secant-to-tangent",
        label: "Secant line to tangent line",
        description: "Shrink h to see the derivative definition become tangent slope.",
        expressions: ["f(x)=x^2", "a=1", "h=1", "A=(a,f(a))", "B=(a+h,f(a+h))", "y=\\frac{f(a+h)-f(a)}{h}(x-a)+f(a)"],
        viewport: { xMin: -3, xMax: 5, yMin: -2, yMax: 10 },
      }),
    ],
    practice: [
      freeResponse("limit-local", "Limit as local behavior", "Explain why a limit can exist even if f(a) is undefined.", "Mentions nearby behavior rather than value at the point.", "A limit tracks what values approach around a, not what happens exactly at a."),
      stepOrdering("derivative-definition-steps", "Derivative definition steps", "Order the derivative-definition workflow.", ["start with average rate of change", "replace second point with x+h", "divide by h", "take the limit as h goes to 0"], "This is the path from secant slope to tangent slope."),
    ],
    relatedConcepts: ["precalculus limits", "derivative rules", "tangent lines", "real analysis continuity"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add epsilon-delta proof-step practice with draggable epsilon bands."],
    difficulty: "intermediate",
  },
  {
    sectionNumber: 12,
    title: "Derivative Rules and Core Techniques",
    slug: "12-derivative-rules-core-techniques",
    lessonId: "lesson-jacob-calculus-derivatives",
    topicId: topicIds.calculus,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Power rule", "Product rule", "Quotient rule", "Chain rule", "Implicit differentiation"],
    overview:
      "This lesson collects the core derivative rules so students can choose the right rule rather than memorize disconnected formulas.",
    contentBlocks: [
      "The power rule gives a fast path for polynomial-style functions.",
      "Product, quotient, and chain rules protect structure that simple term-by-term rules cannot handle.",
      "Implicit differentiation treats y as a function when x and y are tangled together.",
    ],
    formulas: [
      {
        id: "jacob-12-power-rule",
        label: "Power rule",
        latex: "\\frac{d}{dx}x^n=nx^{n-1}",
        explanation: "Bring down the exponent and reduce it by one.",
      },
      {
        id: "jacob-12-chain-rule",
        label: "Chain rule",
        latex: "\\frac{d}{dx}f(g(x))=f'(g(x))g'(x)",
        explanation: "Differentiate the outside, keep the inside, then multiply by the inside derivative.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-12-derivative-rules",
        label: "Derivative rule comparison",
        description: "Compare a function with its derivative graph.",
        expressions: ["f(x)=x^3-3x", "g(x)=f'(x)"],
        viewport: { xMin: -4, xMax: 4, yMin: -8, yMax: 8 },
      }),
    ],
    practice: [
      shortAnswer("power-rule", "Power rule", "Differentiate x^5.", ["5x^4", "5*x^4"], "The power rule gives 5x^4."),
      shortAnswer("product-rule", "Product rule", "Write the product rule for (fg)'.", ["f'g+fg'", "f'g + fg'", "f' g + f g'"], "Differentiate one factor at a time and add the two products."),
    ],
    relatedConcepts: ["derivative definition", "implicit differentiation", "optimization", "Taylor series"],
    presetRecommendation: "Math Practice Mode",
    remainingTodos: ["Add rule-identification flash practice."],
    difficulty: "intermediate",
  },
  {
    sectionNumber: 13,
    title: "Applications of Differential Calculus",
    slug: "13-applications-differential-calculus",
    lessonId: "lesson-jacob-diff-calc-applications",
    topicId: topicIds.calculus,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Implicit differentiation", "Linearization", "Mean Value Theorem", "Optimization", "Second derivatives"],
    overview:
      "Jacob turns derivatives into tools for prediction, optimization, curve behavior, and theorem-based reasoning.",
    contentBlocks: [
      "Linearization uses the tangent line as a nearby estimate.",
      "The Mean Value Theorem connects an average slope over an interval to an instantaneous slope inside it.",
      "Optimization and second derivatives use derivative signs to reason about shape.",
    ],
    formulas: [
      {
        id: "jacob-13-linearization",
        label: "Linearization",
        latex: "L(x)=f(a)+f'(a)(x-a)",
        explanation: "A tangent-line approximation near x=a.",
      },
      {
        id: "jacob-13-mvt",
        label: "Mean Value Theorem",
        latex: "f'(c)=\\frac{f(b)-f(a)}{b-a}",
        explanation: "Some instantaneous slope matches the average slope when the hypotheses hold.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-13-linearization-mvt",
        label: "Linearization and MVT visual",
        description: "Compare tangent-line prediction to secant slope over an interval.",
        expressions: ["f(x)=\\sqrt{x+4}", "a=0", "L(x)=f(a)+f'(a)(x-a)", "A=(-1,f(-1))", "B=(3,f(3))"],
        viewport: { xMin: -4, xMax: 6, yMin: -1, yMax: 5 },
      }),
    ],
    practice: [
      freeResponse("linearization-purpose", "Linearization purpose", "Why is linearization useful?", "Mentions tangent-line approximation near a point.", "Linearization gives a simple local model for nearby inputs."),
      trueFalse("mvt-continuity", "MVT requirements", "The Mean Value Theorem requires continuity on the closed interval and differentiability inside.", true, "Those are the standard MVT hypotheses."),
    ],
    relatedConcepts: ["derivative rules", "optimization", "integrals", "Taylor theory"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add optimization scenario templates from source examples."],
    difficulty: "intermediate",
  },
  {
    sectionNumber: 14,
    title: "Integrals, Antiderivatives, and the Fundamental Theorem of Calculus",
    slug: "14-integrals-antiderivatives-ftc",
    lessonId: "lesson-jacob-integrals-ftc",
    topicId: topicIds.calculus,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Antiderivatives", "Definite integrals", "Fundamental Theorem of Calculus", "Substitution", "Integration by parts"],
    overview:
      "This section makes integration feel like accumulation and connects area, antiderivatives, and technique choices.",
    contentBlocks: [
      "Definite integrals represent signed accumulation over an interval.",
      "The Fundamental Theorem connects accumulation back to antiderivatives.",
      "Substitution and integration by parts are structure-aware techniques.",
    ],
    formulas: [
      {
        id: "jacob-14-ftc",
        label: "Fundamental Theorem of Calculus",
        latex: "\\int_a^b f(x)\\,dx=F(b)-F(a)",
        explanation: "When F is an antiderivative of f, net accumulation is the change in F.",
      },
      {
        id: "jacob-14-parts",
        label: "Integration by parts",
        latex: "\\int u\\,dv=uv-\\int v\\,du",
        explanation: "A product-rule reversal for integration.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-14-riemann-sum",
        label: "Accumulation and Riemann rectangles",
        description: "See definite integrals as accumulated area.",
        expressions: ["f(x)=x^2+1", "a=0", "b=3", "\\int_a^b f(x)dx"],
        viewport: { xMin: -1, xMax: 4, yMin: 0, yMax: 12 },
      }),
    ],
    practice: [
      numeric("ftc-simple", "FTC evaluation", "If F(x)=x^3 and f=F', compute integral from 1 to 2 of f(x) dx.", 7, "FTC gives F(2)-F(1)=8-1=7."),
      shortAnswer("substitution-purpose", "Substitution purpose", "What derivative pattern does u-substitution look for?", ["inside function derivative", "derivative of the inside", "g'(x) next to g(x)"], "Substitution works when a function and its derivative structure appear together."),
    ],
    relatedConcepts: ["derivatives", "differential equations", "integral applications", "Riemann integration"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add actual rectangle count slider for Riemann sums."],
    difficulty: "intermediate",
  },
  {
    sectionNumber: 15,
    title: "Differential Equations and Applications of Integral Calculus",
    slug: "15-differential-equations-integral-applications",
    lessonId: "lesson-jacob-diffeq-integral-apps",
    topicId: topicIds.calculus,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Separable equations", "Logistic differential equation", "Average value", "Volumes", "Arc length"],
    overview:
      "Jacob links differential equations and integral applications through change, accumulation, volume, and length.",
    contentBlocks: [
      "Separable equations can be solved by isolating variables and integrating.",
      "Logistic models show growth that slows near carrying capacity.",
      "Average value, volume, and arc length all reinterpret integrals geometrically.",
    ],
    formulas: [
      {
        id: "jacob-15-logistic",
        label: "Logistic equation",
        latex: "\\frac{dP}{dt}=kP\\left(1-\\frac{P}{M}\\right)",
        explanation: "Growth is fast at first and slows as P approaches carrying capacity M.",
      },
      {
        id: "jacob-15-arc-length",
        label: "Arc length",
        latex: "L=\\int_a^b\\sqrt{1+(f'(x))^2}\\,dx",
        explanation: "Arc length adds tiny Pythagorean pieces along a curve.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-15-logistic-graph",
        label: "Logistic solution family",
        description: "A growth curve approaching carrying capacity.",
        expressions: ["M=10", "k=0.7", "P(t)=\\frac{M}{1+9e^{-kt}}", "y=M"],
        viewport: { xMin: -1, xMax: 10, yMin: -1, yMax: 12 },
      }),
    ],
    practice: [
      numeric("logistic-capacity", "Carrying capacity", "In dP/dt=kP(1-P/20), what is the carrying capacity?", 20, "The carrying capacity is M=20."),
      shortAnswer("average-value", "Average value formula", "What is the average value of f on [a,b]?", ["1/(b-a) integral_a^b f(x) dx", "\\frac{1}{b-a}\\int_a^b f(x)dx"], "Average value divides total accumulation by interval length."),
    ],
    relatedConcepts: ["integrals", "differential equations", "series", "applications of calculus"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add slope field renderer for separable equations."],
    difficulty: "intermediate",
  },
  {
    sectionNumber: 16,
    title: "Parametric Equations, Polar Coordinates, Infinite Series, and Taylor Series",
    slug: "16-parametric-polar-infinite-series-taylor",
    lessonId: "lesson-jacob-parametric-polar-series",
    topicId: topicIds.calculus,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Parametric equations", "Polar coordinates", "Infinite series", "Taylor series", "Maclaurin series"],
    overview:
      "This lesson moves beyond y=f(x): curves can be parameterized, polar, or approximated by infinite polynomial behavior.",
    contentBlocks: [
      "Parametric equations describe x and y using a shared parameter.",
      "Polar area uses radius as a function of angle.",
      "Taylor series use derivative information to build polynomial approximations.",
    ],
    formulas: [
      {
        id: "jacob-16-parametric-derivative",
        label: "Parametric derivative",
        latex: "\\frac{dy}{dx}=\\frac{dy/dt}{dx/dt}",
        explanation: "Compare y-change and x-change through the shared parameter t.",
      },
      {
        id: "jacob-16-taylor",
        label: "Taylor series",
        latex: "f(x)=\\sum_{n=0}^{\\infty}\\frac{f^{(n)}(a)}{n!}(x-a)^n",
        explanation: "Derivative data at a center builds a power series model.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-16-taylor-polar",
        label: "Taylor and polar explorer",
        description: "Compare sin(x) with Taylor polynomials and a polar curve.",
        expressions: ["f(x)=\\sin(x)", "P_3(x)=x-\\frac{x^3}{6}", "P_5(x)=x-\\frac{x^3}{6}+\\frac{x^5}{120}", "r=1+\\sin(\\theta)"],
        viewport: { xMin: -8, xMax: 8, yMin: -4, yMax: 4 },
      }),
    ],
    practice: [
      shortAnswer("parametric-derivative", "Parametric derivative", "Write dy/dx for parametric x(t), y(t).", ["(dy/dt)/(dx/dt)", "\\frac{dy/dt}{dx/dt}"], "Differentiate y and x with respect to t, then divide."),
      shortAnswer("maclaurin-sine", "Sine Maclaurin P3", "Write the degree 3 Maclaurin polynomial for sin x.", ["x-x^3/6", "x - x^3/6"], "The sine series begins x - x^3/6 + ..."),
    ],
    relatedConcepts: ["integrals", "polar conics", "power series", "real analysis series"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add convergence interval practice for power series."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 17,
    title: "Multivariable Foundations and Vector Algebra",
    slug: "17-multivariable-foundations-vector-algebra",
    lessonId: "lesson-jacob-multivar-foundations",
    topicId: topicIds.multivariable,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Vector algebra", "Dot product", "Cross product", "3D coordinates"],
    overview:
      "Multivariable calculus starts by extending vectors and coordinate reasoning into 3D space.",
    contentBlocks: [
      "Dot products measure projection and angle information.",
      "Cross products create perpendicular vectors with area magnitude.",
      "3D coordinates become the language for surfaces, planes, and vector fields.",
    ],
    formulas: [
      {
        id: "jacob-17-dot-product",
        label: "Dot product",
        latex: "\\mathbf u\\cdot\\mathbf v=u_1v_1+u_2v_2+u_3v_3",
        explanation: "Dot product measures alignment and supports angle/projection calculations.",
      },
      {
        id: "jacob-17-cross-product",
        label: "Cross product",
        latex: "\\mathbf u\\times\\mathbf v",
        explanation: "The cross product returns a vector perpendicular to both inputs.",
      },
    ],
    graphs: [
      graph3d({
        id: "jacob-17-vectors-3d",
        label: "3D vectors and planes",
        description: "A 3D setup for vectors, planes, and cross-product intuition.",
        expressions: ["u=(1,2,1)", "v=(2,-1,1)", "z=x+y"],
      }),
    ],
    practice: [
      numeric("dot-product", "Dot product", "Compute <1,2,3> dot <4,0,-1>.", 1, "1*4 + 2*0 + 3*(-1)=1."),
      freeResponse("cross-meaning", "Cross product meaning", "What geometric direction does u x v point?", "Mentions perpendicular/normal direction.", "The cross product points perpendicular to both vectors."),
    ],
    relatedConcepts: ["vectors", "partial derivatives", "linear algebra", "surface integrals"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add 3D vector arrow styling once Desmos 3D supports the needed helpers."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 18,
    title: "Partial Derivatives, Gradient, Divergence, Curl, and Jacobian",
    slug: "18-partial-derivatives-gradient-divergence-curl-jacobian",
    lessonId: "lesson-jacob-multivar-operators",
    topicId: topicIds.multivariable,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Partial derivatives", "Gradient", "Divergence", "Curl", "Jacobian", "Hessian"],
    overview:
      "This is Jacob's operator toolbox: each symbol records a different kind of multivariable change.",
    contentBlocks: [
      "Partial derivatives measure change in one variable direction at a time.",
      "The gradient packages the direction of steepest increase.",
      "Divergence, curl, and the Jacobian describe vector-field and coordinate-change behavior.",
    ],
    formulas: [
      {
        id: "jacob-18-gradient",
        label: "Gradient",
        latex: "\\nabla f=\\left\\langle f_x,f_y,f_z\\right\\rangle",
        explanation: "A vector of first partial derivatives pointing toward steepest increase.",
      },
      {
        id: "jacob-18-divergence",
        label: "Divergence",
        latex: "\\nabla\\cdot\\mathbf F=P_x+Q_y+R_z",
        explanation: "Divergence measures local source or sink behavior in a vector field.",
      },
    ],
    graphs: [
      graph3d({
        id: "jacob-18-gradient-surface",
        label: "Gradient surface and tangent plane",
        description: "A 3D bowl with a movable tangent plane for partial derivatives.",
        expressions: ["z=x^2+y^2", "a=1", "b=1", "z=2a(x-a)+2b(y-b)+a^2+b^2"],
      }),
    ],
    practice: [
      shortAnswer("gradient-components", "Gradient components", "What entries go inside the gradient of f(x,y,z)?", ["f_x, f_y, f_z", "partial derivatives", "<f_x,f_y,f_z>"], "The gradient stores all first partial derivatives."),
      freeResponse("jacobian-purpose", "Jacobian purpose", "What does the Jacobian record for a multivariable map?", "Mentions first-order change/partial derivatives.", "The Jacobian matrix stores first partial derivatives of a vector-valued map."),
    ],
    relatedConcepts: ["tangent planes", "optimization", "Green's theorem", "linear transformations"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add 2D vector-field cards for divergence and curl intuition."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 19,
    title: "Multivariable Applications, Optimization, Integration, Green, and Stokes",
    slug: "19-multivariable-applications-optimization-integration-green-stokes",
    lessonId: "lesson-jacob-multivar-apps-integration",
    topicId: topicIds.multivariable,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Tangent planes", "Lagrange multipliers", "Multiple integrals", "Line integrals", "Green's theorem", "Stokes' theorem", "Divergence theorem"],
    overview:
      "This lesson uses multivariable derivatives and integrals to optimize, accumulate over regions, and translate boundaries into interiors.",
    contentBlocks: [
      "Lagrange multipliers compare gradients at constrained extrema.",
      "Multiple integrals accumulate over regions, volumes, and surfaces.",
      "Green, Stokes, and Divergence theorems connect boundary information to region or surface information.",
    ],
    formulas: [
      {
        id: "jacob-19-lagrange",
        label: "Lagrange multiplier condition",
        latex: "\\nabla f=\\lambda\\nabla g",
        explanation: "At constrained extrema, the objective and constraint gradients line up.",
      },
      {
        id: "jacob-19-stokes",
        label: "Stokes' theorem",
        latex: "\\oint_{\\partial S}\\mathbf F\\cdot d\\mathbf r=\\iint_S(\\nabla\\times\\mathbf F)\\cdot d\\mathbf S",
        explanation: "Boundary circulation equals curl flux through the surface.",
      },
    ],
    graphs: [
      graph3d({
        id: "jacob-19-lagrange-surface",
        label: "Constraint on a surface",
        description: "A 3D surface and circular constraint for constrained optimization.",
        expressions: ["z=x^2+y^2", "x^2+y^2=4", "z=4"],
      }),
    ],
    practice: [
      shortAnswer("lagrange-condition", "Lagrange condition", "Write the gradient condition for Lagrange multipliers.", ["nabla f = lambda nabla g", "\\nabla f=\\lambda\\nabla g"], "The gradients align at a constrained optimum."),
      freeResponse("green-meaning", "Green's theorem meaning", "What kind of relationship does Green's theorem create?", "Mentions boundary integral and double integral over a region.", "Green's theorem converts a line integral around a boundary into a double integral over the region."),
    ],
    relatedConcepts: ["gradient", "line integrals", "surface integrals", "differential equations heat flow"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add theorem comparison cards for Green/Stokes/Divergence."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 20,
    title: "Linear Systems, Matrix Operations, Inverses, and Determinants",
    slug: "20-linear-systems-matrix-operations-inverses-determinants",
    lessonId: "lesson-jacob-linear-systems-determinants",
    topicId: topicIds.linearAlgebra,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Linear systems", "Row operations", "Matrix operations", "Inverses", "Determinants", "Cramer's rule"],
    overview:
      "Jacob starts linear algebra with systems and matrices as tools for encoding and solving many equations at once.",
    contentBlocks: [
      "Row operations transform systems while preserving solution sets.",
      "Matrix multiplication organizes linear combinations.",
      "Determinants and inverses signal when a system has a unique solution.",
    ],
    formulas: [
      {
        id: "jacob-20-det-2x2",
        label: "2x2 determinant",
        latex: "\\det\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}=ad-bc",
        explanation: "The determinant measures signed area scaling in 2D.",
      },
      {
        id: "jacob-20-inverse",
        label: "Inverse via adjugate",
        latex: "A^{-1}=\\frac{1}{\\det(A)}\\operatorname{adj}(A)",
        explanation: "An inverse exists only when the determinant is nonzero.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-20-matrix-transform",
        label: "Matrix transformation area",
        description: "A 2D transformation showing determinant as area scaling.",
        expressions: ["A=(0,0)", "B=(1,0)", "C=(1,1)", "D=(0,1)", "polygon(A,B,C,D)", "E=(2,1)", "F=(3,3)", "G=(1,2)", "polygon(A,E,F,G)"],
        viewport: { xMin: -2, xMax: 5, yMin: -2, yMax: 5 },
      }),
    ],
    practice: [
      numeric("det-2x2", "2x2 determinant", "Find det [[2,1],[3,4]].", 5, "2*4 - 1*3 = 5."),
      trueFalse("inverse-det", "Inverse condition", "A square matrix with determinant 0 has an inverse.", false, "A determinant of zero means the matrix is singular."),
    ],
    relatedConcepts: ["matrix transformations", "vector spaces", "eigenvalues", "least squares"],
    presetRecommendation: "Math Proof / Concept Mode",
    remainingTodos: ["Add row-reduction stepper for REF/RREF."],
    difficulty: "intermediate",
  },
  {
    sectionNumber: 21,
    title: "Vector Spaces, Bases, Change of Basis, and Eigenvalues",
    slug: "21-vector-spaces-bases-change-of-basis-eigenvalues",
    lessonId: "lesson-jacob-vector-spaces-eigenvalues",
    topicId: topicIds.linearAlgebra,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Vector spaces", "Bases", "Coordinate mappings", "Change of basis", "Eigenvalues", "Similarity"],
    overview:
      "This section shifts from computing with matrices to understanding spaces, coordinates, and invariant directions.",
    contentBlocks: [
      "A basis is a coordinate language for a vector space.",
      "Change of basis rewrites the same vector in a different coordinate system.",
      "Eigenvectors are directions that a transformation stretches without rotating away.",
    ],
    formulas: [
      {
        id: "jacob-21-rank-nullity",
        label: "Rank-nullity",
        latex: "\\dim(\\operatorname{Col}A)+\\dim(\\operatorname{Nul}A)=n",
        explanation: "The input dimension splits into column-space dimension and null-space dimension.",
      },
      {
        id: "jacob-21-eigenvalue",
        label: "Eigenvalue equation",
        latex: "A\\mathbf v=\\lambda\\mathbf v",
        explanation: "The matrix sends v to a scalar multiple of itself.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-21-eigenvector-transform",
        label: "Eigenvector direction",
        description: "A matrix transformation with one direction preserved.",
        expressions: ["u=(1,1)", "v=(1,-1)", "segment((0,0),u)", "segment((0,0),v)", "A=2u"],
        viewport: { xMin: -4, xMax: 4, yMin: -4, yMax: 4 },
      }),
    ],
    practice: [
      shortAnswer("eigen-equation", "Eigen equation", "Write the equation that defines an eigenvector v of A.", ["Av=lambda v", "A v = lambda v", "A\\mathbf v=\\lambda\\mathbf v"], "Eigenvectors keep their direction under the transformation."),
      freeResponse("basis-purpose", "Basis purpose", "What does a basis let you do in a vector space?", "Mentions coordinates/spanning independent directions.", "A basis gives independent directions that span the whole space."),
    ],
    relatedConcepts: ["determinants", "orthogonality", "spectral theorem", "SVD"],
    presetRecommendation: "Math Proof / Concept Mode",
    remainingTodos: ["Add change-of-basis coordinate conversion practice."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 22,
    title: "Orthogonality, Least Squares, Spectral Theorem, and SVD",
    slug: "22-orthogonality-least-squares-spectral-svd",
    lessonId: "lesson-jacob-orthogonality-svd",
    topicId: topicIds.linearAlgebra,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Orthogonality", "Projections", "Least squares", "QR", "Spectral theorem", "SVD"],
    overview:
      "Jacob's advanced linear algebra section organizes approximation and decomposition through orthogonality.",
    contentBlocks: [
      "Projections drop a vector onto a direction or subspace.",
      "Least squares solves inconsistent systems by minimizing residual error.",
      "Spectral theorem and SVD decompose matrices into interpretable pieces.",
    ],
    formulas: [
      {
        id: "jacob-22-projection",
        label: "Projection formula",
        latex: "\\operatorname{proj}_{\\mathbf u}\\mathbf v=\\frac{\\mathbf v\\cdot\\mathbf u}{\\mathbf u\\cdot\\mathbf u}\\mathbf u",
        explanation: "Projection measures the part of v that lies along u.",
      },
      {
        id: "jacob-22-svd",
        label: "Singular value decomposition",
        latex: "A=U\\Sigma V^T",
        explanation: "SVD decomposes a matrix into rotations/reflections and axis scalings.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-22-projection-demo",
        label: "Projection and least-squares geometry",
        description: "A vector projection picture for orthogonality and approximation.",
        expressions: ["u=(3,1)", "v=(2,4)", "p=\\frac{v.xu.x+v.yu.y}{u.x^2+u.y^2}u", "segment((0,0),u)", "segment((0,0),v)", "segment((0,0),p)"],
        viewport: { xMin: -1, xMax: 5, yMin: -1, yMax: 5 },
      }),
    ],
    practice: [
      freeResponse("least-squares", "Least squares goal", "What does least squares minimize?", "Mentions squared residual/error distance.", "Least squares minimizes the squared residual error."),
      shortAnswer("svd-form", "SVD form", "Write the compact symbolic form of the singular value decomposition.", ["A=U Sigma V^T", "A=U\\Sigma V^T", "U Sigma V^T"], "SVD writes A as U Sigma V^T."),
    ],
    relatedConcepts: ["eigenvalues", "projections", "optimization", "data approximation"],
    presetRecommendation: "Math Proof / Concept Mode",
    remainingTodos: ["Add matrix-decomposition comparison cards."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 23,
    title: "Differential Equations, Systems, Fourier Series, and Heat Flow",
    slug: "23-differential-equations-systems-fourier-heat-flow",
    lessonId: "lesson-jacob-differential-equations-fourier",
    topicId: topicIds.differentialEquations,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["First order equations", "Integrating factors", "Second order equations", "Systems", "Fourier series", "Heat equation"],
    overview:
      "The differential equations chapter treats equations as descriptions of motion, solution families, oscillation, and heat flow.",
    contentBlocks: [
      "Integrating factors solve first-order linear equations.",
      "Characteristic equations solve constant-coefficient second-order equations.",
      "Fourier series and the heat equation connect functions to waves and diffusion.",
    ],
    formulas: [
      {
        id: "jacob-23-integrating-factor",
        label: "Integrating factor",
        latex: "\\mu(x)=e^{\\int p(x)\\,dx}",
        explanation: "The integrating factor turns a first-order linear ODE into a product derivative.",
      },
      {
        id: "jacob-23-heat-equation",
        label: "Heat equation",
        latex: "u_t=ku_{xx}",
        explanation: "Time change is proportional to spatial curvature.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-23-slope-field",
        label: "Slope field and solution behavior",
        description: "A solution family view for first-order differential equations.",
        expressions: ["M=10", "k=0.7", "P(t)=\\frac{M}{1+9e^{-kt}}", "y=M"],
        viewport: { xMin: -1, xMax: 10, yMin: -1, yMax: 12 },
      }),
    ],
    practice: [
      shortAnswer("integrating-factor", "Integrating factor", "For y'+p(x)y=q(x), what integrating factor does Jacob use?", ["e^(integral p(x) dx)", "e^{\\int p(x) dx}", "\\mu(x)=e^{\\int p(x)dx}"], "The integrating factor is exp(integral p(x) dx)."),
      shortAnswer("heat-equation", "Heat equation", "Write the one-dimensional heat equation form.", ["u_t=ku_xx", "u_t = k u_xx", "u_t=ku_{xx}"], "The heat equation is u_t = k u_xx."),
    ],
    relatedConcepts: ["integrals", "linear algebra systems", "Fourier series", "partial derivatives"],
    presetRecommendation: "Math Graph Lab",
    remainingTodos: ["Add Fourier partial-sum graph with adjustable number of terms."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 24,
    title: "Real Analysis Foundations: Sets, Fields, Real Numbers, and Completeness",
    slug: "24-real-analysis-sets-fields-completeness",
    lessonId: "lesson-jacob-analysis-foundations",
    topicId: topicIds.realAnalysis,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Sets", "Natural numbers", "Integers", "Rationals", "Real numbers", "Ordered fields", "Completeness"],
    overview:
      "Real analysis begins by making the number system precise: sets, fields, order, bounds, and completeness.",
    contentBlocks: [
      "Sets and operations create the language for proof statements.",
      "Ordered-field properties make arithmetic and inequality arguments legal.",
      "Supremum and infimum turn bounded sets into precise completeness statements.",
    ],
    formulas: [
      {
        id: "jacob-24-supremum",
        label: "Supremum",
        latex: "\\sup S",
        explanation: "The least upper bound of a set when it exists.",
      },
      {
        id: "jacob-24-completeness",
        label: "Completeness idea",
        latex: "S\\neq\\varnothing,\\ S\\text{ bounded above}\\Rightarrow \\sup S\\in\\mathbb R",
        explanation: "Every nonempty real set bounded above has a least upper bound.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-24-bounds-number-line",
        label: "Bounds on the number line",
        description: "A visual line for upper bounds and supremum.",
        expressions: ["S=\\left\\{1-\\frac{1}{n}:n=1...20\\right\\}", "x=1"],
        viewport: { xMin: -0.2, xMax: 1.2, yMin: -1, yMax: 1 },
      }),
    ],
    practice: [
      shortAnswer("supremum", "Supremum meaning", "What does sup S mean?", ["least upper bound", "the least upper bound"], "The supremum is the smallest upper bound."),
      freeResponse("completeness", "Completeness", "What does completeness guarantee for nonempty bounded-above sets of real numbers?", "Mentions existence of a least upper bound/supremum.", "Completeness guarantees a supremum in the real numbers."),
    ],
    relatedConcepts: ["sequences", "metric spaces", "continuity", "Riemann integration"],
    presetRecommendation: "Math Proof / Concept Mode",
    remainingTodos: ["Add proof-step practice for least-upper-bound arguments."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 25,
    title: "Real Analysis: Sequences, Metric Spaces, and Continuity",
    slug: "25-real-analysis-sequences-metric-spaces-continuity",
    lessonId: "lesson-jacob-analysis-sequences-continuity",
    topicId: topicIds.realAnalysis,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Sequences", "Cauchy sequences", "Subsequences", "Metric spaces", "Compactness", "Continuity", "Uniform continuity"],
    overview:
      "This lesson makes limit behavior precise for sequences, spaces, compactness, and continuous functions.",
    contentBlocks: [
      "Sequences approach limits through epsilon definitions.",
      "Metric spaces generalize distance beyond the real line.",
      "Continuity and uniform continuity describe how function outputs respond to input closeness.",
    ],
    formulas: [
      {
        id: "jacob-25-sequence-limit",
        label: "Sequence limit",
        latex: "\\lim_{n\\to\\infty}a_n=L",
        explanation: "Eventually the sequence terms stay within every epsilon band around L.",
      },
      {
        id: "jacob-25-continuity",
        label: "Epsilon-delta continuity",
        latex: "\\forall\\varepsilon>0\\ \\exists\\delta>0: |x-a|<\\delta\\Rightarrow |f(x)-f(a)|<\\varepsilon",
        explanation: "Inputs close to a force outputs close to f(a).",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-25-sequence-convergence",
        label: "Sequence convergence picture",
        description: "Terms of a convergent sequence plotted against its limiting value.",
        expressions: ["a_n=1+\\frac{1}{n}", "y=1"],
        viewport: { xMin: 0, xMax: 20, yMin: 0.8, yMax: 2.2 },
      }),
    ],
    practice: [
      numeric("sequence-limit", "Sequence limit", "What is the limit of a_n=1+1/n?", 1, "1/n tends to 0, so the sequence tends to 1."),
      stepOrdering("continuity-proof", "Continuity proof order", "Order the skeleton of an epsilon-delta continuity proof.", ["start with epsilon greater than 0", "choose a delta", "assume |x-a|<delta", "prove |f(x)-f(a)|<epsilon"], "That is the standard epsilon-delta proof flow."),
    ],
    relatedConcepts: ["completeness", "series", "uniform convergence", "derivatives"],
    presetRecommendation: "Math Proof / Concept Mode",
    remainingTodos: ["Add compactness and subsequence theorem cards."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 26,
    title: "Real Analysis: Series, Power Series, and Uniform Convergence",
    slug: "26-real-analysis-series-power-series-uniform-convergence",
    lessonId: "lesson-jacob-analysis-series-functions",
    topicId: topicIds.realAnalysis,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Series", "Power series", "Radius of convergence", "Uniform convergence", "Weierstrass M-test"],
    overview:
      "Jacob's series chapter connects infinite sums, power series, and when convergence behaves well across an interval.",
    contentBlocks: [
      "Series convergence asks whether partial sums settle down.",
      "Power series behave like functions inside an interval of convergence.",
      "Uniform convergence controls an entire domain at once, not just one point at a time.",
    ],
    formulas: [
      {
        id: "jacob-26-power-series",
        label: "Power series",
        latex: "\\sum_{n=0}^{\\infty}a_n(x-c)^n",
        explanation: "A series of powers centered at c.",
      },
      {
        id: "jacob-26-m-test",
        label: "Weierstrass M-test",
        latex: "|f_n(x)|\\le M_n,\\ \\sum M_n\\text{ converges}",
        explanation: "A comparison test for uniform convergence.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-26-uniform-convergence",
        label: "Uniform convergence bands",
        description: "Visualize function sequences tightening around a limit function.",
        expressions: ["f_n(x)=x/n", "g(x)=0", "n=5"],
        viewport: { xMin: -5, xMax: 5, yMin: -2, yMax: 2 },
      }),
    ],
    practice: [
      freeResponse("uniform-vs-pointwise", "Uniform vs pointwise", "How is uniform convergence stronger than pointwise convergence?", "Mentions one N working across the whole domain.", "Uniform convergence controls the entire domain with one threshold."),
      shortAnswer("m-test", "M-test condition", "What kind of numerical series must converge in the Weierstrass M-test?", ["sum M_n", "\\sum M_n", "the series of M_n"], "The bounding numerical series must converge."),
    ],
    relatedConcepts: ["sequences", "Taylor series", "continuity", "integration"],
    presetRecommendation: "Math Proof / Concept Mode",
    remainingTodos: ["Add convergence-test classification practice."],
    difficulty: "advanced",
  },
  {
    sectionNumber: 27,
    title: "Real Analysis: Differentiation, Taylor Theory, Riemann Integration, and Improper Integrals",
    slug: "27-real-analysis-differentiation-taylor-riemann-improper-integrals",
    lessonId: "lesson-jacob-analysis-derivatives-integration",
    topicId: topicIds.realAnalysis,
    sourceCoverageStatus: "source-backed expanded",
    sourceSubsections: ["Differentiation", "Taylor theory", "Riemann integration", "Riemann-Stieltjes", "Improper integrals"],
    overview:
      "The final Jacob section rebuilds calculus with analysis-level definitions and proof habits.",
    contentBlocks: [
      "Differentiability is a limit statement about local linear behavior.",
      "Taylor theory measures approximation plus remainder.",
      "Riemann and improper integrals make accumulation precise using partitions and limits.",
    ],
    formulas: [
      {
        id: "jacob-27-differentiability",
        label: "Differentiability definition",
        latex: "f'(a)=\\lim_{x\\to a}\\frac{f(x)-f(a)}{x-a}",
        explanation: "The derivative is the limiting slope around a point.",
      },
      {
        id: "jacob-27-improper-integral",
        label: "Improper integral",
        latex: "\\int_a^{\\infty}f(x)\\,dx=\\lim_{b\\to\\infty}\\int_a^b f(x)\\,dx",
        explanation: "An infinite interval integral is defined by a limit of finite interval integrals.",
      },
    ],
    graphs: [
      graph2d({
        id: "jacob-27-riemann-improper",
        label: "Riemann and improper integral view",
        description: "Compare finite accumulation with an improper tail.",
        expressions: ["f(x)=1/x^2", "a=1", "\\int_a^{10}f(x)dx"],
        viewport: { xMin: 0, xMax: 10, yMin: 0, yMax: 3 },
      }),
    ],
    practice: [
      stepOrdering("improper-integral", "Improper integral order", "Order the definition of an improper integral over [a,infinity).", ["integrate from a to b", "let b go to infinity", "evaluate the resulting limit"], "Improper integrals are limits of ordinary definite integrals."),
      freeResponse("taylor-remainder", "Taylor remainder", "Why does Taylor theory keep a remainder term?", "Mentions measuring approximation error.", "The remainder tracks what the finite Taylor polynomial has not captured."),
    ],
    relatedConcepts: ["derivative definition", "Taylor series", "uniform convergence", "FTC"],
    presetRecommendation: "Math Proof / Concept Mode",
    remainingTodos: ["Add proof cards for Riemann integrability criteria."],
    difficulty: "advanced",
  },
];

export function buildJacobMathModules(seedTime: string): MathModule[] {
  return jacobMathCoverage.map((section) => {
    const primaryGraph = section.graphs[0] ?? null;
    const calculatorMode = primaryGraph?.mode ?? "none";
    return {
      id: getJacobModuleId(section),
      course_id: JACOB_MATH_COURSE_ID,
      topic_id: section.topicId,
      slug: `jacob-${section.slug}`,
      title: `${String(section.sectionNumber).padStart(2, "0")} ${section.title}`,
      description: section.overview,
      difficulty: section.difficulty,
      calculator_mode: calculatorMode,
      visibility: "published",
      module_json: {
        overview: section.overview,
        learningGoals: [
          `Read the source subsections: ${section.sourceSubsections.join(", ")}.`,
          "Use the formula/theorem cards as study references.",
          section.graphs.length > 0
            ? "Open the graph demo and save a graph state after exploring it."
            : "Use proof and concept cards to organize the lesson.",
          "Answer the linked practice before moving forward.",
        ],
        graphNotes:
          primaryGraph?.description ??
          "This proof-heavy section uses concept cards and practice more than a live graph.",
        expressions: primaryGraph?.expressions.map((latex, index) => ({
          id: `${primaryGraph.id}-${index + 1}`,
          latex,
        })),
        viewport: primaryGraph?.viewport,
        sections: [
          {
            title: "Source coverage",
            body: section.sourceSubsections.join(" | "),
          },
          {
            title: "Jacob's teaching path",
            body: section.contentBlocks.join(" "),
          },
          {
            title: "Formula and theorem cards",
            body: section.formulas.map((formula) => `${formula.label}: ${formula.explanation}`).join(" "),
          },
          {
            title: "Related concepts",
            body: section.relatedConcepts.join(" -> "),
          },
        ],
        formulaCards: section.formulas,
        graphCards: section.graphs,
        relatedConcepts: section.relatedConcepts,
        sourceSubsections: section.sourceSubsections,
        presetRecommendation: section.presetRecommendation,
        lessonId: section.lessonId,
        coverageStatus: section.sourceCoverageStatus,
      },
      created_at: seedTime,
      updated_at: seedTime,
    };
  });
}

export function buildJacobPracticeQuestions(seedTime: string): QuestionBankItem[] {
  return jacobMathCoverage.flatMap((section) =>
    section.practice.map((practice) => ({
      id: `question-jacob-${section.slug}-${practice.id}`,
      course_id: JACOB_MATH_COURSE_ID,
      topic_id: section.topicId,
      module_id: getJacobModuleId(section),
      note_id: null,
      graph_state_id: null,
      type: practice.type,
      title: practice.title,
      prompt_markdown: practice.prompt,
      prompt_latex: null,
      answer_json: practice.answer,
      explanation_markdown: practice.explanation,
      explanation_latex: null,
      difficulty: section.difficulty,
      calculator_allowed: section.graphs.length > 0,
      estimated_time_seconds: practice.type === "free_response" || practice.type === "step_ordering" ? 150 : 90,
      source_type: "module_seed",
      status: "published",
      created_by: null,
      created_at: seedTime,
      updated_at: seedTime,
    })),
  );
}

export function getJacobModuleId(section: Pick<JacobCoverageSection, "slug">) {
  return `module-jacob-${section.slug}`;
}
