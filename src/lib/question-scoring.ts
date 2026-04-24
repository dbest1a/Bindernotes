import type { QuestionBankItem, QuestionChoice, QuestionType } from "@/types/math-learning";

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
    case "multiple_choice":
      return scoreBooleanResult(
        submitted.selectedChoiceId === resolveCorrectChoiceId(question),
        totalPoints,
        "Choose the single correct answer.",
        resolveCorrectChoiceId(question),
      );

    case "multiple_select":
      return scoreBooleanResult(
        sameStringSet(submitted.selectedChoiceIds ?? [], resolveCorrectChoiceIds(question)),
        totalPoints,
        "Choose every correct answer and no extra answers.",
        resolveCorrectChoiceIds(question),
      );

    case "true_false":
      return scoreBooleanResult(
        submitted.booleanAnswer === resolveExpectedBoolean(question),
        totalPoints,
        "Choose true or false.",
        resolveExpectedBoolean(question),
      );

    case "numeric":
      return scoreNumeric(question, submitted, totalPoints);

    case "short_answer":
    case "fill_blank":
      return scoreShortAnswer(question, submitted, totalPoints);

    case "step_ordering":
      return scoreBooleanResult(
        arraysEqual(submitted.orderedStepIds ?? [], resolveCorrectOrder(question)),
        totalPoints,
        "Put the steps in the exact correct order.",
        resolveCorrectOrder(question),
      );

    case "free_response":
      return {
        autoGraded: false,
        isCorrect: null,
        pointsAwarded:
          typeof question.answer_json.completionPoints === "number"
            ? question.answer_json.completionPoints
            : null,
        totalPoints,
        feedback: {
          message: "Free responses are saved for review. No AI grading is used.",
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
  const expected = Number(question.answer_json.expected);
  const tolerance =
    typeof question.answer_json.tolerance === "number" ? question.answer_json.tolerance : 0;
  const submittedValue =
    typeof submitted.numeric === "number" ? submitted.numeric : Number(String(submitted.numeric ?? "").trim());

  if (!Number.isFinite(expected) || !Number.isFinite(submittedValue)) {
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
    Math.abs(submittedValue - expected) <= tolerance,
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
  const acceptedAnswers = Array.isArray(question.answer_json.acceptedAnswers)
    ? question.answer_json.acceptedAnswers
    : [];
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
    "Match one of the accepted answers.",
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

  return question.choices?.find((choice) => choice.is_correct)?.id;
}

function resolveCorrectChoiceIds(
  question: Pick<QuestionBankItem, "answer_json"> & {
    choices?: QuestionChoice[];
  },
) {
  if (Array.isArray(question.answer_json.correctChoiceIds)) {
    return question.answer_json.correctChoiceIds;
  }

  return question.choices?.filter((choice) => choice.is_correct).map((choice) => choice.id) ?? [];
}

function resolveExpectedBoolean(question: Pick<QuestionBankItem, "answer_json">) {
  return Boolean(question.answer_json.expectedBoolean);
}

function resolveCorrectOrder(question: Pick<QuestionBankItem, "answer_json">) {
  return Array.isArray(question.answer_json.correctOrder)
    ? question.answer_json.correctOrder
    : [];
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
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
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
