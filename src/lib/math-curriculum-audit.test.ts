import { describe, expect, it } from "vitest";
import { jacobMathCoverage } from "@/lib/jacob-math-coverage";
import { mathSeedChoices, mathSeedCourses, mathSeedQuestions } from "@/lib/math-learning-seeds";
import { scoreQuestion, type SubmittedQuestionAnswer } from "@/lib/question-scoring";

// Independently worked answers, not generated from the production answer keys.
// Explanatory responses have human review exemplars; their completion score is not correctness validation.
const cases: Array<[number, string, SubmittedQuestionAnswer, RegExp?]> = [
  [1, "rotation-rule", { text: "(-2,3)" }],
  [
    1,
    "dilation-meaning",
    { freeResponse: "Every radius from the center becomes three times as long." },
    /distance/,
  ],
  [2, "aaa-congruence", { booleanAnswer: false }],
  [2, "angle-bisector-ratio", { text: "2:3" }],
  [3, "inverse-tangent", { numeric: (Math.atan2(3, 4) * 180) / Math.PI }],
  [3, "special-45", { text: "1:1:sqrt(2)" }],
  [4, "segment-point", { text: `(${-1 + (3 / 5) * (4 - -1)},${4 + (3 / 5) * (-6 - 4)})` }],
  [4, "parabola-focus", { booleanAnswer: true }],
  [5, "arc-length", { numeric: 5 * 2 }],
  [5, "law-sines-purpose", { text: "non-right triangles" }],
  [6, "cube-factor", { text: "(a-b)(a^2+ab+b^2)" }],
  [6, "finite-series", { numeric: (2 ** 4 - 1) / (2 - 1) }],
  [7, "rational-exponent", { text: "x sqrt(x)" }],
  [7, "log-product", { text: "log_b(x)+log_b(y)" }],
  [
    8,
    "transform-meaning",
    { freeResponse: "h moves the input origin horizontally; k adds a vertical displacement." },
    /horizontal.*vertical/,
  ],
  [8, "unit-circle-point", { text: "(cos(theta), sin(theta))" }],
  [9, "composition", { text: "f(g(x))" }],
  [9, "polar-rotation", { booleanAnswer: true }],
  [10, "vector-magnitude", { numeric: Math.hypot(3, 4) }],
  [10, "combination", { text: "n!/(r!(n-r)!)" }],
  [
    11,
    "limit-local",
    { freeResponse: "The punctured neighborhood controls the limit; the value at a need not be defined." },
    /approach/,
  ],
  [
    11,
    "derivative-definition-steps",
    {
      orderedStepIds: ["compute f(a+h)-f(a)", "divide by h with h nonzero", "take the limit as h goes to 0"],
    },
  ],
  [12, "power-rule", { text: "5x^4" }],
  [12, "product-rule", { text: "f'g+fg'" }],
  [
    13,
    "linearization-purpose",
    { freeResponse: "A tangent line estimates nearby function values from the derivative." },
    /local/,
  ],
  [13, "mvt-continuity", { booleanAnswer: true }],
  [14, "ftc-simple", { numeric: 2 ** 3 - 1 ** 3 }],
  [14, "substitution-purpose", { text: "derivative of the inside" }],
  [15, "logistic-capacity", { numeric: 20 }],
  [15, "average-value", { text: "1/(b-a) integral_a^b f(x) dx" }],
  [16, "parametric-derivative", { text: "(dy/dt)/(dx/dt)" }],
  [16, "maclaurin-sine", { text: "x-x^3/6" }],
  [
    17,
    "dot-product",
    { numeric: [1, 2, 3].reduce((sum, value, index) => sum + value * [4, 0, -1][index], 0) },
  ],
  [
    17,
    "cross-meaning",
    { freeResponse: "For nonparallel vectors, the normal follows the right-hand rule." },
    /right-hand.*zero cross product/,
  ],
  [18, "gradient-components", { text: "<f_x,f_y,f_z>" }],
  [
    18,
    "jacobian-purpose",
    {
      freeResponse:
        "Each row contains first partial derivatives of an output component, giving the local linear map.",
    },
    /first partial/,
  ],
  [19, "lagrange-condition", { text: "nabla f = lambda nabla g" }],
  [
    19,
    "green-meaning",
    {
      freeResponse:
        "It relates oriented circulation on a boundary to a double integral over its planar region.",
    },
    /line integral.*double integral/,
  ],
  [20, "det-2x2", { numeric: 2 * 4 - 1 * 3 }],
  [20, "inverse-det", { booleanAnswer: false }],
  [21, "eigen-equation", { text: "Av=lambda v" }],
  [
    21,
    "basis-purpose",
    { freeResponse: "Independent spanning vectors give each vector a unique list of coordinates." },
    /independent.*span/,
  ],
  [
    22,
    "least-squares",
    { freeResponse: "It minimizes the sum of squared residuals, ||Ax-b||^2." },
    /squared residual/,
  ],
  [22, "svd-form", { text: "A=U Sigma V^T" }],
  [23, "integrating-factor", { text: "e^(integral p(x) dx)" }],
  [23, "heat-equation", { text: "u_t=ku_xx" }],
  [24, "supremum", { text: "least upper bound" }],
  [
    24,
    "completeness",
    { freeResponse: "Every nonempty bounded-above subset of R has a real least upper bound." },
    /supremum/,
  ],
  [25, "sequence-limit", { numeric: 1 }],
  [
    25,
    "continuity-proof",
    {
      orderedStepIds: [
        "start with epsilon greater than 0",
        "choose a delta",
        "assume |x-a|<delta",
        "prove |f(x)-f(a)|<epsilon",
      ],
    },
  ],
  [
    26,
    "uniform-vs-pointwise",
    { freeResponse: "For each epsilon, one N must work simultaneously for all x in the domain." },
    /entire domain.*one threshold/,
  ],
  [26, "m-test", { text: "sum M_n" }],
  [
    27,
    "improper-integral",
    { orderedStepIds: ["integrate from a to b", "let b go to infinity", "evaluate the resulting limit"] },
  ],
  [
    27,
    "taylor-remainder",
    {
      freeResponse:
        "The remainder is the difference between f and its finite Taylor polynomial and bounds approximation error.",
    },
    /not captured/,
  ],
];

describe("independent Jacob practice answer audit", () => {
  it("accounts for exactly all 54 question IDs, including manual review items", () => {
    expect(cases).toHaveLength(54);
    const covered = cases.map(([section, id]) => `${section}:${id}`).sort();
    expect(covered).toEqual(
      jacobMathCoverage
        .flatMap((section) => section.practice.map((question) => `${section.sectionNumber}:${question.id}`))
        .sort(),
    );
  });
  it.each(cases)(
    "checks section %i / %s against its independent worked answer",
    (section, id, answer, explanation) => {
      const question = jacobMathCoverage
        .find((entry) => entry.sectionNumber === section)
        ?.practice.find((entry) => entry.id === id);
      expect(question).toBeDefined();
      if (!question) return;
      const scored = scoreQuestion({ type: question.type, answer_json: question.answer }, answer);
      if (answer.freeResponse) {
        expect(scored).toMatchObject({ autoGraded: false, isCorrect: null });
        expect(question.explanation).toMatch(explanation!);
        expect(scored.feedback.message).toMatch(/not mathematical correctness/);
      } else {
        expect(scored).toMatchObject({ autoGraded: true, isCorrect: true, pointsAwarded: 1 });
        if (typeof answer.numeric === "number")
          expect(Math.abs(Number(question.answer.expected) - answer.numeric)).toBeLessThanOrEqual(
            Number(question.answer.tolerance),
          );
      }
    },
  );
  it("independently checks the algebra behind selected symbolic answers and their domain restrictions", () => {
    for (const [a, b] of [
      [3, 2],
      [-2, 5],
      [0, -4],
    ])
      expect((a - b) * (a * a + a * b + b * b)).toBe(a ** 3 - b ** 3);
    for (const x of [0, 0.5, 4, 100]) expect(x ** 1.5).toBeCloseTo(x * Math.sqrt(x), 12);
    const product = (x: number) => x ** 2 * Math.sin(x);
    const x = 1.2,
      h = 1e-5;
    expect((product(x + h) - product(x - h)) / (2 * h)).toBeCloseTo(
      2 * x * Math.sin(x) + x ** 2 * Math.cos(x),
      7,
    );
    // Unit circle and degree-3 sine approximation, derived without reading either key.
    expect(Math.cos(0.7) ** 2 + Math.sin(0.7) ** 2).toBeCloseTo(1, 14);
    expect(Math.abs(Math.sin(0.1) - (0.1 - 0.1 ** 3 / 6))).toBeLessThan(0.1 ** 5 / 120);
  });
  it("corrects the angle-bisector diagram and does not teach uniform convergence on all real numbers", () => {
    const section2 = jacobMathCoverage[1];
    const ca = Math.hypot(1.5, 3),
      cb = Math.hypot(5 - 1.5, 3);
    const d = (5 * ca) / (ca + cb);
    expect(d / (5 - d)).toBeCloseTo(ca / cb, 14);
    expect(Math.abs(2 / 3 - ca / cb)).toBeGreaterThan(0.05); // The old D=(2,0) was not the bisector.
    expect(section2.graphs[0].expressions).toContain("D=(5\\sqrt{11.25}/(\\sqrt{11.25}+\\sqrt{21.25}),0)");
    expect(jacobMathCoverage[25].graphs[0].description).toMatch(/On all of R, it is only pointwise/);
    expect(jacobMathCoverage[25].graphs[0].expressions[0]).toContain("-5\\le x\\le 5");
  });
  it("states the conditions that prevent false generalizations", () => {
    const lookup = (section: number, id: string) =>
      jacobMathCoverage[section - 1].practice.find((entry) => entry.id === id)!;
    expect(lookup(7, "log-product").prompt).toMatch(/x>0, y>0, b>0 and b!=1/);
    expect(lookup(16, "parametric-derivative").prompt).toMatch(/dx\/dt != 0/);
    expect(lookup(19, "lagrange-condition").prompt).toMatch(/gradient g nonzero/);
    expect(lookup(21, "eigen-equation").explanation).toMatch(
      /negative lambda reverses direction.*lambda=0 sends v to zero/,
    );
    expect(lookup(22, "svd-form").prompt).toMatch(/real matrix/);
    expect(
      jacobMathCoverage.every((section) => section.sourceCoverageStatus === "starter; provenance pending"),
    ).toBe(true);
  });
});

describe("broader seed content review", () => {
  it("checks all 17 overview-question keys separately from the 54 Jacob section questions", () => {
    const answers: Record<string, SubmittedQuestionAnswer> = {
      "question-derivative-meaning": { selectedChoiceId: "choice-derivative-meaning-b" },
      "question-slope-x2-at-3": { numeric: 2 * 3 },
      "question-tangent-a-changes": { text: "it moves along the curve" },
      "question-best-taylor-near-zero": { selectedChoiceId: "choice-best-taylor-c" },
      "question-taylor-far-from-center": {
        freeResponse: "Derivative data are local to the expansion point.",
      },
      "question-degree-three-sin": { text: "x-x^3/6" },
      "question-partials-meaning": { selectedChoiceId: "choice-partials-meaning-b" },
      "question-tangent-plane": { text: "z=2x+2y-2" },
      "question-plane-parameters": { freeResponse: "The point and plane move with a and b." },
      "question-jacob-dilation-meaning": { text: "it doubles every coordinate" },
      "question-jacob-transform-form": {
        freeResponse: "h translates horizontally and k translates vertically.",
      },
      "question-jacob-unit-circle": { text: "(cos(theta), sin(theta))" },
      "question-jacob-tangent-purpose": {
        freeResponse: "The tangent matches the local slope for nearby estimates.",
      },
      "question-jacob-partials-tangent-plane": { text: "f_x and f_y" },
      "question-jacob-determinant-area": { freeResponse: "Signed area multiplication factor." },
      "question-jacob-logistic-capacity": { numeric: 10 },
      "question-jacob-sequence-limit": { numeric: 1 },
    };
    expect(mathSeedQuestions).toHaveLength(71);
    expect(Object.keys(answers)).toHaveLength(17);
    for (const [id, answer] of Object.entries(answers)) {
      const question = mathSeedQuestions.find((entry) => entry.id === id)!;
      expect(question).toBeDefined();
      const score = scoreQuestion(
        { ...question, choices: mathSeedChoices.filter((entry) => entry.question_id === id) },
        answer,
      );
      expect(score.isCorrect).toBe(answer.freeResponse ? null : true);
    }
    expect(
      mathSeedCourses
        .filter((course) => course.slug.startsWith("ap-"))
        .every((course) => course.description?.includes("No AP Calculus")),
    ).toBe(true);
  });
});
