import type { QuestionBankItem, QuestionChoice, QuestionType } from "@/types/math-learning";
import { parseFiniteDecimal, withinDecimalTolerance } from "@/lib/finite-number";

export type SubmittedQuestionAnswer = {
  selectedChoiceId?: string;
  selectedChoiceIds?: string[];
  booleanAnswer?: boolean;
  text?: string;
  numeric?: string | number;
  orderedStepIds?: string[];
  freeResponse?: string;
};

export type QuestionScoreResult = {
  autoGraded: boolean;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  totalPoints: number;
  feedback: {
    message: string;
    expected?: unknown;
  };
};

export function scoreQuestion(
  question: Pick<QuestionBankItem, "type" | "answer_json"> & {
    choices?: QuestionChoice[];
  },
  submitted: SubmittedQuestionAnswer,
): QuestionScoreResult {
  const totalPoints = 1;

  switch (question.type) {
    case "multiple_choice": {
      const expected = resolveCorrectChoiceId(question);
      if (!expected?.trim()) return invalidAnswerKey(totalPoints);
      return scoreBooleanResult(
        submitted.selectedChoiceId === expected,
        totalPoints,
        "Choose the single correct answer.",
        expected,
      );
    }

    case "multiple_select": {
      const expected = resolveCorrectChoiceIds(question);
      if (!isNonemptyStringArray(expected)) return invalidAnswerKey(totalPoints);
      return scoreBooleanResult(
        sameStringSet(submitted.selectedChoiceIds ?? [], expected),
        totalPoints,
        "Choose every correct answer and no extra answers.",
        [...new Set(expected)],
      );
    }

    case "true_false": {
      const expected = question.answer_json.expectedBoolean;
      if (typeof expected !== "boolean") return invalidAnswerKey(totalPoints);
      return scoreBooleanResult(
        submitted.booleanAnswer === expected,
        totalPoints,
        "Choose true or false.",
        expected,
      );
    }

    case "numeric":
      return scoreNumeric(question, submitted, totalPoints);

    case "short_answer":
    case "fill_blank":
      return scoreShortAnswer(question, submitted, totalPoints);

    case "step_ordering": {
      const expected = question.answer_json.correctOrder;
      if (!isNonemptyStringArray(expected) || new Set(expected).size !== expected.length) return invalidAnswerKey(totalPoints);
      return scoreBooleanResult(
        arraysEqual(submitted.orderedStepIds ?? [], expected),
        totalPoints,
        "Put the steps in the exact correct order.",
        expected,
      );
    }

    case "free_response":
      return {
        autoGraded: false,
        isCorrect: null,
        pointsAwarded:
          typeof question.answer_json.completionPoints === "number" &&
          Number.isFinite(question.answer_json.completionPoints) &&
          question.answer_json.completionPoints >= 0 &&
          question.answer_json.completionPoints <= totalPoints &&
          Boolean((submitted.freeResponse ?? submitted.text ?? "").trim())
            ? question.answer_json.completionPoints
            : null,
        totalPoints,
        feedback: {
          message: "Free responses are saved for review. Completion credit is for a non-empty response, not mathematical correctness. No AI grading is used.",
          expected: question.answer_json.rubric,
        },
      };

    case "matching":
      return {
        autoGraded: false,
        isCorrect: null,
        pointsAwarded: null,
        totalPoints,
        feedback: {
          message: "Matching questions are stored now and can be manually reviewed in this version.",
        },
      };

    default:
      return exhaustiveQuestionType(question.type);
  }
}

function scoreNumeric(
  question: Pick<QuestionBankItem, "answer_json">,
  submitted: SubmittedQuestionAnswer,
  totalPoints: number,
): QuestionScoreResult {
  const expected = parseFiniteDecimal(question.answer_json.expected);
  const tolerance = question.answer_json.tolerance === undefined ? 0 : parseFiniteDecimal(question.answer_json.tolerance);
  if (expected === null || tolerance === null || tolerance < 0) return invalidAnswerKey(totalPoints);
  const submittedValue = parseFiniteDecimal(submitted.numeric);

  if (submittedValue === null) {
    return {
      autoGraded: true,
      isCorrect: false,
      pointsAwarded: 0,
      totalPoints,
      feedback: {
        message: "Enter a valid number.",
        expected,
      },
    };
  }

  return scoreBooleanResult(
    withinDecimalTolerance(submittedValue, expected, tolerance),
    totalPoints,
    `Answer within ${tolerance} of the expected value.`,
    expected,
  );
}

function scoreShortAnswer(
  question: Pick<QuestionBankItem, "answer_json">,
  submitted: SubmittedQuestionAnswer,
  totalPoints: number,
): QuestionScoreResult {
  const acceptedAnswers = question.answer_json.acceptedAnswers;
  if (!isNonemptyStringArray(acceptedAnswers)) return invalidAnswerKey(totalPoints);
  const normalizeWhitespace = question.answer_json.normalizeWhitespace !== false;
  const caseSensitive = question.answer_json.caseSensitive === true;
  const submittedText = normalizeText(submitted.text ?? submitted.freeResponse ?? "", {
    caseSensitive,
    normalizeWhitespace,
  });
  const accepted = acceptedAnswers.map((answer) =>
    normalizeText(answer, {
      caseSensitive,
      normalizeWhitespace,
    }),
  );

  return scoreBooleanResult(
    accepted.includes(submittedText),
    totalPoints,
    "This is an exact-text check against accepted forms, not a symbolic or meaning-based check. Compare the explanation if an equivalent answer was not matched.",
    acceptedAnswers,
  );
}

function scoreBooleanResult(
  isCorrect: boolean,
  totalPoints: number,
  message: string,
  expected?: unknown,
): QuestionScoreResult {
  return {
    autoGraded: true,
    isCorrect,
    pointsAwarded: isCorrect ? totalPoints : 0,
    totalPoints,
    feedback: {
      message,
      expected,
    },
  };
}

function resolveCorrectChoiceId(
  question: Pick<QuestionBankItem, "answer_json"> & {
    choices?: QuestionChoice[];
  },
) {
  if (typeof question.answer_json.correctChoiceId === "string") {
    return question.answer_json.correctChoiceId;
  }

  return question.choices?.find((choice) => choice.is_correct === true)?.id;
}

function resolveCorrectChoiceIds(
  question: Pick<QuestionBankItem, "answer_json"> & {
    choices?: QuestionChoice[];
  },
) {
  if (Array.isArray(question.answer_json.correctChoiceIds)) {
    return question.answer_json.correctChoiceIds;
  }

  return question.choices?.filter((choice) => choice.is_correct === true).map((choice) => choice.id) ?? [];
}

function normalizeText(
  value: string,
  options: {
    caseSensitive: boolean;
    normalizeWhitespace: boolean;
  },
) {
  const whitespaceNormalized = options.normalizeWhitespace ? value.trim().replace(/\s+/g, " ") : value;
  return options.caseSensitive ? whitespaceNormalized : whitespaceNormalized.toLowerCase();
}

function sameStringSet(left: string[], right: string[]) {
  if (!isNonemptyStringArray(left)) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}

function isNonemptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item: unknown) => typeof item === "string" && item.trim().length > 0);
}

function invalidAnswerKey(totalPoints: number): QuestionScoreResult {
  return {
    autoGraded: false,
    isCorrect: null,
    pointsAwarded: null,
    totalPoints,
    feedback: { message: "This question needs a valid answer key before it can be scored." },
  };
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function exhaustiveQuestionType(type: never): QuestionScoreResult {
  return {
    autoGraded: false,
    isCorrect: null,
    pointsAwarded: null,
    totalPoints: 1,
    feedback: {
      message: `Unsupported question type: ${String(type satisfies QuestionType)}`,
    },
  };
}
