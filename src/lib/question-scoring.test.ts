import { describe, expect, it } from "vitest";
import { scoreQuestion } from "@/lib/question-scoring";
import type { QuestionBankItem } from "@/types/math-learning";

describe("scoreQuestion", () => {
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

  it.each([{}, { numeric: "" }, { numeric: "   " }])("never converts a blank numeric answer to zero: %j", (answer) => {
    const result = scoreQuestion(question("numeric", { expected: 0 }), answer);
    expect(result.status).toBe("incomplete");
    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it.each([0, "0", " 0 "])("accepts explicit zero: %j", (numeric) => {
    expect(scoreQuestion(question("numeric", { expected: 0 }), { numeric }).status).toBe("correct");
  });

  it.each(["invalid", "Infinity", "NaN", "1"])("rejects invalid or wrong numeric values: %s", (numeric) => {
    expect(scoreQuestion(question("numeric", { expected: 0 }), { numeric }).status).toBe("incorrect");
  });

  it.each(["it moves along the curve", "The line moves to the new point and matches the derivative there.", "wrong explanation"])("saves explanations for honest self-review: %s", (text) => {
    const result = scoreQuestion({ ...question("short_answer", { acceptedAnswers: ["it moves along the curve"] }), prompt_markdown: "What happens to the tangent line as a changes?", explanation_markdown: "The tangency point and local slope update." }, { text });
    expect(result.status).toBe("ungraded");
    expect(result.isCorrect).toBeNull();
    expect(result.pointsAwarded).toBeNull();
    expect(result.feedback.expected).toBe("The tangency point and local slope update.");
  });

  it("does not award completion credit for an empty explanation", () => {
    expect(scoreQuestion(question("free_response", { completionPoints: 1 }), {}).status).toBe("incomplete");
    expect(scoreQuestion(question("free_response", { completionPoints: 1 }), {}).pointsAwarded).toBe(0);
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
    expect(result.pointsAwarded).toBeNull();
    expect(result.status).toBe("ungraded");
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
