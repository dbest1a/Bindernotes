// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { listStudyItems } from "@/services/study-items-service";
import {
  addProblemMistakeToReview,
  createFormulaTheoremCard,
  createProblemLogEntry,
  listFormulaTheoremCards,
  listProblemLogEntries,
  mathStudyGraphLinksStorageKey,
  mathStudyProblemLogsStorageKey,
  restoreGraphStateFromStudyLink,
  saveStudyGraphLink,
} from "@/services/math-study-loop-service";

describe("math study loop service", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("requires the Math Study Loop beta gate before writing problem logs", () => {
    expect(() =>
      createProblemLogEntry({
        attempt: "I tried substitution first.",
        betaEnabled: false,
        confidence: 2,
        finalAnswer: "x = 4",
        mistakeType: "setup_error",
        ownerId: "user-1",
        problemTitle: "Derivative setup",
        source: "Unit 2 review",
      }),
    ).toThrow(/Math Study Loop beta/i);
  });

  it("saves and reloads complete problem log fields account-scoped", () => {
    window.localStorage.setItem(
      mathStudyProblemLogsStorageKey("user-1"),
      JSON.stringify([{ id: "wrong-owner", owner_id: "user-2", problem_title: "Hidden" }]),
    );

    const entry = createProblemLogEntry({
      attempt: "I expanded before checking the structure.",
      betaEnabled: true,
      binderId: "binder-calc",
      binderTitle: "Calculus",
      conceptTags: ["limits", "derivatives"],
      confidence: 3,
      finalAnswer: "f'(x) = 2x",
      formulaCardIds: ["formula-power-rule"],
      graphLinkId: "graph-link-1",
      mistakeType: "formula_misuse",
      ownerId: "user-1",
      problemTitle: "Power rule derivative",
      reviewDueAt: "2026-05-15T12:00:00.000Z",
      source: "Jacob Math Notes / Derivatives",
    });

    expect(listProblemLogEntries("user-1")).toHaveLength(1);
    expect(listProblemLogEntries("user-1")[0]).toMatchObject({
      id: entry.id,
      attempt: "I expanded before checking the structure.",
      binder_id: "binder-calc",
      binder_title: "Calculus",
      concept_tags: ["limits", "derivatives"],
      confidence: 3,
      final_answer: "f'(x) = 2x",
      formula_card_ids: ["formula-power-rule"],
      graph_link_id: "graph-link-1",
      mistake_type: "formula_misuse",
      owner_id: "user-1",
      problem_title: "Power rule derivative",
      review_due_at: "2026-05-15T12:00:00.000Z",
      source: "Jacob Math Notes / Derivatives",
    });
  });

  it("stores formula and theorem cards with examples, mistakes, proof ideas, graph links, and review links", () => {
    createFormulaTheoremCard({
      betaEnabled: true,
      commonMistake: "Using the rule before checking the exponent.",
      exampleProblem: "Differentiate x^4.",
      graphLinkId: "graph-link-power",
      kind: "formula",
      ownerId: "user-1",
      plainEnglishMeaning: "The exponent becomes the multiplier.",
      proofIdea: "Compare the difference quotient terms.",
      reviewItemId: "study-item-power",
      statement: "d/dx x^n = n x^(n-1)",
      title: "Power rule",
    });

    expect(listFormulaTheoremCards("user-1")[0]).toMatchObject({
      common_mistake: "Using the rule before checking the exponent.",
      example_problem: "Differentiate x^4.",
      graph_link_id: "graph-link-power",
      kind: "formula",
      linked_review_item_id: "study-item-power",
      plain_english_meaning: "The exponent becomes the multiplier.",
      proof_idea: "Compare the difference quotient terms.",
      statement: "d/dx x^n = n x^(n-1)",
      title: "Power rule",
    });
  });

  it("saves graph links and restores the linked graph state without mounting a calculator", () => {
    window.localStorage.setItem(
      mathStudyGraphLinksStorageKey("user-1"),
      JSON.stringify([{ id: "wrong-owner", owner_id: "user-2", title: "Hidden graph" }]),
    );
    const graphState = { expressions: { list: [{ latex: "y=x^2" }] } };

    const link = saveStudyGraphLink({
      betaEnabled: true,
      desmosState: graphState,
      expressions: [{ id: "expr-1", latex: "y=x^2" }],
      graphStateId: "graph-state-1",
      mode: "2d",
      ownerId: "user-1",
      problemLogId: "problem-1",
      reflection: "The tangent slope grows as x increases.",
      title: "Quadratic slope graph",
    });

    expect(restoreGraphStateFromStudyLink("user-1", link.id)).toEqual(graphState);
    expect(JSON.parse(window.localStorage.getItem(mathStudyGraphLinksStorageKey("user-1")) ?? "[]")).toHaveLength(1);
  });

  it("creates a mistake review item from a problem log without storing broad homework AI behavior", () => {
    const problem = createProblemLogEntry({
      attempt: "I used the wrong sign in the derivative.",
      betaEnabled: true,
      conceptTags: ["derivatives"],
      confidence: 1,
      finalAnswer: "f'(x) = -2x",
      mistakeType: "algebra_error",
      ownerId: "user-1",
      problemTitle: "Derivative sign mistake",
      source: "Quiz attempt",
    });

    const item = addProblemMistakeToReview({
      betaEnabled: true,
      ownerId: "user-1",
      problemLog: problem,
      reviewQueueBetaEnabled: true,
    });

    expect(item).toMatchObject({
      owner_id: "user-1",
      source_id: problem.id,
      source_kind: "mistake",
      type: "mistake_review",
    });
    expect(listStudyItems("user-1")[0].prompt).toContain("Derivative sign mistake");
    expect(JSON.stringify(listStudyItems("user-1"))).not.toMatch(/solve my homework|open-ended tutor/i);
  });
});
