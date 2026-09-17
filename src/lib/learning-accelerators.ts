import type { JSONContent } from "@tiptap/react";
import type { BinderLesson, Highlight, LearnerNote, MathBlock } from "@/types";

export type LearningAcceleratorFeatureId =
  | "transferForge"
  | "evidenceLock"
  | "misstepMuseum"
  | "conceptWeather"
  | "representationSwitchboard"
  | "examGhostMode"
  | "whiteboardReplay"
  | "prereqXray"
  | "memoryWeave"
  | "oneMinuteLab";

export type LearningAcceleratorCard = {
  id: LearningAcceleratorFeatureId;
  title: string;
  tagline: string;
  studentPrompt: string;
  evidence: string[];
  actions: string[];
  source: "deterministic";
  tone: "practice" | "evidence" | "repair" | "forecast" | "experiment";
};

export type LearningAcceleratorInput = {
  binderTitle: string;
  subject: string;
  selectedLesson: BinderLesson;
  lessons: BinderLesson[];
  learnerNote?: LearnerNote | null;
  highlights: Highlight[];
  conceptLabels: string[];
  enabledFeatures: LearningAcceleratorFeatureId[];
};

export const defaultLearningAcceleratorFeatures: LearningAcceleratorFeatureId[] = [
  "transferForge",
  "evidenceLock",
  "misstepMuseum",
  "conceptWeather",
  "representationSwitchboard",
  "examGhostMode",
  "whiteboardReplay",
  "prereqXray",
  "memoryWeave",
  "oneMinuteLab",
];

const featureOrder = new Map(defaultLearningAcceleratorFeatures.map((feature, index) => [feature, index]));

export function extractPlainTextFromJson(content: JSONContent | null | undefined): string {
  if (!content) {
    return "";
  }

  const parts: string[] = [];
  const visit = (node: JSONContent | null | undefined) => {
    if (!node) {
      return;
    }

    if (typeof node.text === "string") {
      parts.push(node.text);
    }

    if (Array.isArray(node.content)) {
      node.content.forEach(visit);
    }
  };

  visit(content);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function buildLearningAcceleratorDeck(input: LearningAcceleratorInput): LearningAcceleratorCard[] {
  const context = buildAcceleratorContext(input);
  const cardsByFeature: Record<LearningAcceleratorFeatureId, LearningAcceleratorCard> = {
    transferForge: buildTransferForge(context),
    evidenceLock: buildEvidenceLock(context),
    misstepMuseum: buildMisstepMuseum(context),
    conceptWeather: buildConceptWeather(context),
    representationSwitchboard: buildRepresentationSwitchboard(context),
    examGhostMode: buildExamGhostMode(context),
    whiteboardReplay: buildWhiteboardReplay(context),
    prereqXray: buildPrereqXray(context),
    memoryWeave: buildMemoryWeave(context),
    oneMinuteLab: buildOneMinuteLab(context),
  };

  return [...new Set(input.enabledFeatures)]
    .filter((feature) => cardsByFeature[feature])
    .sort((left, right) => (featureOrder.get(left) ?? 0) - (featureOrder.get(right) ?? 0))
    .map((feature) => cardsByFeature[feature]);
}

type AcceleratorContext = {
  binderTitle: string;
  subjectLabel: string;
  lessonTitle: string;
  lessonText: string;
  noteTitle: string;
  noteText: string;
  previousLessonTitle: string | null;
  nextLessonTitle: string | null;
  highlightTexts: string[];
  formulaLabels: string[];
  graphExpressions: string[];
  conceptLabels: string[];
  focusConcept: string;
};

function buildAcceleratorContext(input: LearningAcceleratorInput): AcceleratorContext {
  const lessonIndex = input.lessons.findIndex((lesson) => lesson.id === input.selectedLesson.id);
  const lessonText = extractPlainTextFromJson(input.selectedLesson.content);
  const noteText = extractPlainTextFromJson(input.learnerNote?.content);
  const formulaLabels = [...input.selectedLesson.math_blocks, ...(input.learnerNote?.math_blocks ?? [])]
    .filter((block) => block.type === "latex")
    .map((block) => block.label || block.description || block.latex)
    .filter(isUsefulText)
    .slice(0, 4);
  const graphExpressions = [...input.selectedLesson.math_blocks, ...(input.learnerNote?.math_blocks ?? [])]
    .filter((block): block is Extract<MathBlock, { type: "graph" }> => block.type === "graph")
    .flatMap((block) => block.expressions)
    .filter(isUsefulText)
    .slice(0, 4);
  const highlightTexts = input.highlights
    .map((highlight) => highlight.selected_text || highlight.anchor_text)
    .filter(isUsefulText)
    .slice(0, 5);
  const conceptLabels = input.conceptLabels.filter(isUsefulText).slice(0, 6);

  return {
    binderTitle: input.binderTitle,
    subjectLabel: normalizeSubject(input.subject),
    lessonTitle: input.selectedLesson.title,
    lessonText,
    noteTitle: input.learnerNote?.title || `${input.selectedLesson.title} notes`,
    noteText,
    previousLessonTitle: lessonIndex > 0 ? (input.lessons[lessonIndex - 1]?.title ?? null) : null,
    nextLessonTitle:
      lessonIndex >= 0 && lessonIndex < input.lessons.length - 1
        ? (input.lessons[lessonIndex + 1]?.title ?? null)
        : null,
    highlightTexts,
    formulaLabels,
    graphExpressions,
    conceptLabels,
    focusConcept: chooseFocusConcept(input.selectedLesson.title, lessonText, conceptLabels),
  };
}

function buildTransferForge(context: AcceleratorContext): LearningAcceleratorCard {
  const surface = context.graphExpressions.length > 0 ? "a graph check" : "a worked example";
  return card(
    "transferForge",
    "Transfer Forge",
    "Same idea, new surface",
    "practice",
    [
      `Use ${context.lessonTitle} as the source, then rebuild the idea through ${surface}.`,
      `Change one number, representation, or context, but keep the core move: ${context.focusConcept}.`,
      "Write what stayed the same and what changed before checking the answer.",
    ],
    evidenceFrom(context, [context.lessonTitle, ...context.formulaLabels, ...context.graphExpressions]),
  );
}

function buildEvidenceLock(context: AcceleratorContext): LearningAcceleratorCard {
  const claim = firstSentence(context.noteText) || `I understand ${context.focusConcept}.`;
  return card(
    "evidenceLock",
    "Evidence Lock",
    "Every important claim needs proof",
    "evidence",
    [
      `Lock this claim to a source: "${claim}"`,
      "Attach one lesson line, highlight, formula, graph, note, or board step that proves it.",
      "If you cannot point to evidence, rewrite the claim as a question.",
    ],
    evidenceFrom(context, [...context.highlightTexts, ...context.formulaLabels, context.noteTitle]),
  );
}

function buildMisstepMuseum(context: AcceleratorContext): LearningAcceleratorCard {
  return card(
    "misstepMuseum",
    "Misstep Museum",
    "Save the almost-right answer",
    "repair",
    [
      `Create an almost-right answer for ${context.lessonTitle}, then repair it.`,
      `Trap: confuse the surface detail with the reason ${context.focusConcept} works.`,
      "Repair: name the wrong step, cite the source, then solve a nearby version correctly.",
    ],
    evidenceFrom(context, [context.lessonTitle, ...context.highlightTexts]),
  );
}

function buildConceptWeather(context: AcceleratorContext): LearningAcceleratorCard {
  const weather =
    context.highlightTexts.length > 2 && !context.noteText ? "foggy" : context.noteText ? "clearing" : "new";
  return card(
    "conceptWeather",
    "Concept Weather",
    "Forecast what needs attention",
    "forecast",
    [
      `${context.focusConcept} is marked ${weather}: compare highlights, notes, and examples before moving on.`,
      "Sunny means you can explain, prove, and transfer it. Foggy means you recognize it but cannot use it cold.",
      "Pick one small repair action and update the forecast after you try it.",
    ],
    evidenceFrom(context, [context.noteTitle, ...context.highlightTexts, ...context.conceptLabels]),
  );
}

function buildRepresentationSwitchboard(context: AcceleratorContext): LearningAcceleratorCard {
  const modes =
    context.subjectLabel === "History"
      ? "source quote, timeline, argument sentence, and counterexample"
      : context.subjectLabel === "Chemistry"
        ? "particle picture, equation, data table, and written explanation"
        : "words, formula, graph, table, and whiteboard sketch";
  return card(
    "representationSwitchboard",
    "Representation Switchboard",
    "One idea, many forms",
    "practice",
    [
      `Explain ${context.focusConcept} using ${modes}.`,
      "Do not move to the next form until the current one says something precise.",
      "Circle the form that exposed the weakest part of your understanding.",
    ],
    evidenceFrom(context, [...context.formulaLabels, ...context.graphExpressions, ...context.highlightTexts]),
  );
}

function buildExamGhostMode(context: AcceleratorContext): LearningAcceleratorCard {
  return card(
    "examGhostMode",
    "Exam Ghost Mode",
    "Cold recall before comfort",
    "practice",
    [
      `Hide the lesson and write everything you remember about ${context.focusConcept} in ninety seconds.`,
      "Reveal the source and mark what was missing, guessed, or unsupported.",
      "Rewrite the answer once with no source visible.",
    ],
    evidenceFrom(context, [context.lessonTitle, context.noteTitle]),
  );
}

function buildWhiteboardReplay(context: AcceleratorContext): LearningAcceleratorCard {
  return card(
    "whiteboardReplay",
    "Whiteboard Replay",
    "Narrate the path, not just the answer",
    "practice",
    [
      `Rebuild ${context.lessonTitle} as a board replay: setup, first move, check, and conclusion.`,
      "Add a timestamp label beside each major board step.",
      "Replay the board out loud and stop wherever a step lacks a reason.",
    ],
    evidenceFrom(context, [...context.formulaLabels, ...context.graphExpressions, context.noteTitle]),
  );
}

function buildPrereqXray(context: AcceleratorContext): LearningAcceleratorCard {
  const prereq = inferPrerequisite(context);
  return card(
    "prereqXray",
    "Prereq X-Ray",
    "Find the hidden weak link",
    "forecast",
    [
      `Before blaming ${context.lessonTitle}, test the prerequisite: ${prereq}.`,
      "Do one tiny warmup that uses only the prerequisite skill.",
      "If the warmup is slow, repair that first; if it is easy, return to the lesson challenge.",
    ],
    evidenceFrom(context, [...context.formulaLabels, context.previousLessonTitle ?? context.binderTitle]),
  );
}

function buildMemoryWeave(context: AcceleratorContext): LearningAcceleratorCard {
  const neighbor = context.previousLessonTitle ?? context.nextLessonTitle ?? context.binderTitle;
  return card(
    "memoryWeave",
    "Memory Weave",
    "Connect this lesson to another one",
    "evidence",
    [
      `Connect ${context.lessonTitle} to ${neighbor}.`,
      "Write one sentence that names the relationship, then attach one source from each side.",
      "Mark the connection as cause, contrast, formula reuse, vocabulary reuse, or strategy reuse.",
    ],
    evidenceFrom(context, [neighbor, ...context.conceptLabels, ...context.highlightTexts]),
  );
}

function buildOneMinuteLab(context: AcceleratorContext): LearningAcceleratorCard {
  const labSurface =
    context.graphExpressions.length > 0
      ? "change one graph expression and predict the visual effect"
      : context.formulaLabels.length > 0
        ? "change one formula value and predict the result"
        : "change one example condition and predict what should happen";
  return card(
    "oneMinuteLab",
    "One-Minute Lab",
    "A tiny experiment inside the lesson",
    "experiment",
    [
      `Run a sixty-second experiment: ${labSurface}.`,
      "Write the prediction before using the tool.",
      "Record what surprised you and turn it into one review question.",
    ],
    evidenceFrom(context, [...context.graphExpressions, ...context.formulaLabels, context.lessonTitle]),
  );
}

function card(
  id: LearningAcceleratorFeatureId,
  title: string,
  tagline: string,
  tone: LearningAcceleratorCard["tone"],
  prompts: string[],
  evidence: string[],
): LearningAcceleratorCard {
  return {
    id,
    title,
    tagline,
    studentPrompt: prompts.join(" "),
    evidence,
    actions: [
      "Write a one-sentence attempt.",
      "Attach one source-backed check.",
      "Save the weakest step for review.",
    ],
    source: "deterministic",
    tone,
  };
}

function evidenceFrom(context: AcceleratorContext, values: Array<string | null | undefined>) {
  const fallback = [context.lessonTitle, context.noteTitle, context.binderTitle];
  return Array.from(new Set([...values, ...fallback].filter(isUsefulText))).slice(0, 5);
}

function normalizeSubject(subject: string) {
  const lowered = subject.toLowerCase();
  if (lowered.includes("chem")) {
    return "Chemistry";
  }
  if (lowered.includes("history")) {
    return "History";
  }
  if (lowered.includes("math") || lowered.includes("algebra") || lowered.includes("calculus")) {
    return "Math";
  }
  return "General";
}

function chooseFocusConcept(lessonTitle: string, lessonText: string, conceptLabels: string[]) {
  return (
    conceptLabels[0] ||
    lessonTitle.split(/[:,-]/)[0]?.trim() ||
    firstSentence(lessonText).split(" ").slice(0, 5).join(" ") ||
    "the main idea"
  );
}

function firstSentence(text: string) {
  return (
    text
      .split(/(?<=[.!?])\s+/)
      .find((sentence) => sentence.trim().length > 0)
      ?.trim() ?? ""
  );
}

function inferPrerequisite(context: AcceleratorContext) {
  const combined =
    `${context.lessonTitle} ${context.lessonText} ${context.formulaLabels.join(" ")}`.toLowerCase();
  if (combined.includes("polynomial") || combined.includes("factor")) {
    return "distribution, combining like terms, and graph intercept meaning";
  }
  if (combined.includes("derivative") || combined.includes("calculus")) {
    return "rate of change, slope, and function notation";
  }
  if (combined.includes("stoichiometry") || combined.includes("mole")) {
    return "unit conversion, molar mass, and ratio setup";
  }
  if (combined.includes("evidence") || combined.includes("argument")) {
    return "claim, evidence, and reasoning separation";
  }
  return "vocabulary, source evidence, and the first worked example";
}

function isUsefulText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}
