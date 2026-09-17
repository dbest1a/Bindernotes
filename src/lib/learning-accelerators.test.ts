import { describe, expect, it } from "vitest";
import {
  buildLearningAcceleratorDeck,
  defaultLearningAcceleratorFeatures,
  extractPlainTextFromJson,
  type LearningAcceleratorFeatureId,
} from "@/lib/learning-accelerators";
import type { BinderLesson, Highlight, LearnerNote, MathBlock } from "@/types";

const lessonContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Factoring quadratics" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "The factored form shows zeros. The expanded form shows the y-intercept and middle coefficient.",
        },
      ],
    },
  ],
};

const lesson: BinderLesson = {
  id: "lesson-1",
  binder_id: "binder-1",
  title: "Polynomials and Trinomials",
  order_index: 1,
  content: lessonContent,
  math_blocks: [
    {
      id: "formula-1",
      type: "latex",
      latex: "(x + 2)(x + 3)=x^2+5x+6",
      label: "FOIL example",
      description: "Use distribution to find each term.",
    } satisfies MathBlock,
    {
      id: "graph-1",
      type: "graph",
      expressions: ["y=x^2+5x+6", "y=(x+2)(x+3)"],
      xMin: -6,
      xMax: 4,
      yMin: -5,
      yMax: 12,
    } satisfies MathBlock,
  ],
  is_preview: false,
  created_at: "2026-05-24T00:00:00.000Z",
  updated_at: "2026-05-24T00:00:00.000Z",
};

const note: LearnerNote = {
  id: "note-1",
  owner_id: "user-1",
  binder_id: "binder-1",
  lesson_id: "lesson-1",
  folder_id: null,
  title: "Polynomial notes",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "I can factor this but I need to explain why the graph crosses there." }],
      },
    ],
  },
  math_blocks: [],
  pinned: false,
  created_at: "2026-05-24T00:00:00.000Z",
  updated_at: "2026-05-24T00:00:00.000Z",
};

const highlight: Highlight = {
  id: "highlight-1",
  owner_id: "user-1",
  binder_id: "binder-1",
  lesson_id: "lesson-1",
  anchor_text: "The factored form shows zeros.",
  color: "blue",
  note_id: null,
  created_at: "2026-05-24T00:00:00.000Z",
};

describe("learning accelerators", () => {
  it("extracts readable lesson and note text from TipTap JSON without browser APIs", () => {
    expect(extractPlainTextFromJson(lessonContent)).toContain("Factoring quadratics");
    expect(extractPlainTextFromJson(note.content)).toContain("need to explain");
  });

  it("builds one deterministic card for each enabled learning accelerator without AI calls", () => {
    const cards = buildLearningAcceleratorDeck({
      binderTitle: "Jacob Math Notes",
      subject: "Math",
      selectedLesson: lesson,
      lessons: [lesson],
      learnerNote: note,
      highlights: [highlight],
      conceptLabels: ["factored form", "zeros", "y-intercept"],
      enabledFeatures: defaultLearningAcceleratorFeatures,
    });

    expect(cards.map((card) => card.id)).toEqual(defaultLearningAcceleratorFeatures);
    expect(cards).toHaveLength(10);
    for (const card of cards) {
      expect(card.source).toBe("deterministic");
      expect(card.studentPrompt).not.toMatch(/\bAI\b|OpenAI|API/i);
      expect(card.actions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns only explicitly enabled accelerator cards", () => {
    const enabledFeatures: LearningAcceleratorFeatureId[] = ["transferForge", "evidenceLock", "oneMinuteLab"];
    const cards = buildLearningAcceleratorDeck({
      binderTitle: "Jacob Math Notes",
      subject: "Math",
      selectedLesson: lesson,
      lessons: [lesson],
      learnerNote: note,
      highlights: [highlight],
      conceptLabels: ["factored form"],
      enabledFeatures,
    });

    expect(cards.map((card) => card.id)).toEqual(enabledFeatures);
  });

  it("uses workspace signals to make the cards feel lesson-specific", () => {
    const cards = buildLearningAcceleratorDeck({
      binderTitle: "Jacob Math Notes",
      subject: "Math",
      selectedLesson: lesson,
      lessons: [lesson],
      learnerNote: note,
      highlights: [highlight],
      conceptLabels: ["factored form"],
      enabledFeatures: ["transferForge", "misstepMuseum", "prereqXray"],
    });

    expect(cards.find((card) => card.id === "transferForge")?.studentPrompt).toContain("Polynomials and Trinomials");
    expect(cards.find((card) => card.id === "misstepMuseum")?.studentPrompt).toContain("almost-right");
    expect(cards.find((card) => card.id === "prereqXray")?.evidence).toEqual(
      expect.arrayContaining([expect.stringContaining("FOIL example")]),
    );
  });
});
