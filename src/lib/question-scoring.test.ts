import { describe, expect, it } from "vitest";
import { scoreQuestion } from "@/lib/question-scoring";
import type { QuestionBankItem } from "@/types/math-learning";

describe("scoreQuestion", () => {
  it.each([undefined, "", "  \t\n", "NaN", "Infinity", "-Infinity", "0x0", "0b0", "1.2.3", "1e309", "1e-999", NaN, Infinity, -Infinity])(
    "does not award a blank or invalid numeric response %j credit for zero",
    (numeric) => {
      expect(scoreQuestion(question("numeric", { expected: 0 }), { numeric })).toMatchObject({
        autoGraded: true, isCorrect: false, pointsAwarded: 0,
      });
    },
  );

  it.each([0, "0", "-0", "  +0.0e2  "])("accepts an explicitly entered zero %j", (numeric) => {
    expect(scoreQuestion(question("numeric", { expected: 0 }), { numeric }).isCorrect).toBe(true);
  });

  it.each([{}, { expected: "" }, { expected: null }, { expected: NaN }, { expected: Infinity },
    { expected: 1, tolerance: -1 }, { expected: 1, tolerance: NaN }, { expected: 1, tolerance: Infinity }])(
    "does not grade an invalid numeric answer key %j", (answer) => {
      expect(scoreQuestion(question("numeric", answer), { numeric: 0 })).toMatchObject({
        autoGraded: false, isCorrect: null, pointsAwarded: null,
      });
    },
  );

  it("includes decimal tolerance boundaries without accepting nearby answers outside them", () => {
    for (const numeric of [5.99, 6.01]) {
      expect(scoreQuestion(question("numeric", { expected: 6, tolerance: 0.01 }), { numeric }).isCorrect).toBe(true);
    }
    expect(scoreQuestion(question("numeric", { expected: 0.3, tolerance: 0.1 }), { numeric: 0.4 }).isCorrect).toBe(true);
    expect(scoreQuestion(question("numeric", { expected: 6, tolerance: 0.01 }), { numeric: 6.010000001 }).isCorrect).toBe(false);
    expect(scoreQuestion(question("numeric", { expected: 1, tolerance: 0 }), { numeric: 1 + Number.EPSILON }).isCorrect).toBe(false);
    expect(scoreQuestion(question("numeric", { expected: 1e16, tolerance: 0.01 }), { numeric: 1e16 + 2 }).isCorrect).toBe(false);
  });

  it("normalizes multiple selections as sets without letting duplicates replace a missing answer", () => {
    const item = question("multiple_select", { correctChoiceIds: ["a", "c"] });
    expect(scoreQuestion(item, { selectedChoiceIds: ["a", "a"] }).isCorrect).toBe(false);
    expect(scoreQuestion(item, { selectedChoiceIds: ["c", "a", "a"] }).isCorrect).toBe(true);
    expect(scoreQuestion(question("multiple_select", { correctChoiceIds: ["a", "a", "c"] }), { selectedChoiceIds: ["c", "a"] }).isCorrect).toBe(true);
  });

  it.each(["multiple_choice", "multiple_select", "true_false", "step_ordering", "short_answer"] as const)(
    "does not award missing answers credit against an absent %s answer key", (type) => {
      expect(scoreQuestion(question(type, {}), {})).toMatchObject({ autoGraded: false, isCorrect: null, pointsAwarded: null });
    },
  );

  it("rejects malformed accepted text and empty completion responses", () => {
    expect(scoreQuestion(question("short_answer", { acceptedAnswers: [1] }), { text: "1" })).toMatchObject({ autoGraded: false });
    expect(scoreQuestion(question("free_response", { completionPoints: 1 }), { freeResponse: "   " }).pointsAwarded).toBeNull();
    expect(scoreQuestion(question("free_response", { completionPoints: Infinity }), { freeResponse: "A response" }).pointsAwarded).toBeNull();
  });

  it("scores numeric answers using tolerance", () => {
    const result = scoreQuestion(
      question("numeric", { expected: 6, tolerance: 0.01 }),
      { numeric: "6.005" },
    );

    expect(result.isCorrect).toBe(true);
    expect(result.pointsAwarded).toBe(1);
  });

  it("rejects numeric answers outside tolerance", () => {
    const result = scoreQuestion(
      question("numeric", { expected: 6, tolerance: 0.01 }),
      { numeric: "6.2" },
    );

    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it("normalizes short answers", () => {
    const result = scoreQuestion(
      question("short_answer", {
        acceptedAnswers: ["x - x^3/6"],
        caseSensitive: false,
        normalizeWhitespace: true,
      }),
      { text: "  X   -   X^3/6  " },
    );

    expect(result.isCorrect).toBe(true);
  });

  it("requires exact multiple-select sets", () => {
    const correct = scoreQuestion(
      question("multiple_select", { correctChoiceIds: ["a", "c"] }),
      { selectedChoiceIds: ["c", "a"] },
    );
    const extra = scoreQuestion(
      question("multiple_select", { correctChoiceIds: ["a", "c"] }),
      { selectedChoiceIds: ["a", "b", "c"] },
    );

    expect(correct.isCorrect).toBe(true);
    expect(extra.isCorrect).toBe(false);
  });

  it("scores exact step ordering", () => {
    const result = scoreQuestion(
      question("step_ordering", { correctOrder: ["step-1", "step-2", "step-3"] }),
      { orderedStepIds: ["step-1", "step-2", "step-3"] },
    );

    expect(result.isCorrect).toBe(true);
  });

  it("does not AI-grade free responses", () => {
    const result = scoreQuestion(
      question("free_response", { completionPoints: 1, rubric: "Explain local approximation." }),
      { freeResponse: "Because the polynomial is built near the center." },
    );

    expect(result.autoGraded).toBe(false);
    expect(result.isCorrect).toBeNull();
    expect(result.pointsAwarded).toBe(1);
  });
});

function question(
  type: QuestionBankItem["type"],
  answer_json: QuestionBankItem["answer_json"],
): Pick<QuestionBankItem, "type" | "answer_json"> {
  return {
    type,
    answer_json,
  };
}
