// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  createStudyItem,
  listStudyItems,
  listStudyReviewEvents,
  recordStudyReviewEvent,
  studyItemsStorageKey,
} from "@/services/study-items-service";

describe("study items service", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("requires the Review Queue beta gate before creating study items", () => {
    expect(() =>
      createStudyItem({
        answer: "Limits describe local behavior.",
        betaEnabled: false,
        ownerId: "user-1",
        prompt: "Explain limits.",
        sourceKind: "note",
        type: "free_response",
      }),
    ).toThrow(/Review Queue beta/i);
  });

  it("creates study items from note, highlight, formula, problem, and mistake inputs", () => {
    const common = { betaEnabled: true, ownerId: "user-1" };
    createStudyItem({
      ...common,
      answer: "My own explanation of the note.",
      binderId: "binder-calc",
      binderTitle: "Calculus",
      prompt: "Explain this note without looking.",
      sourceKind: "note",
      sourceTitle: "Limits note",
      type: "free_response",
    });
    createStudyItem({
      ...common,
      answer: "The highlighted claim supports the definition.",
      prompt: "What should this highlight help you remember?",
      sourceExcerpt: "A derivative is a local rate of change.",
      sourceKind: "highlight",
      type: "highlight_recall",
    });
    createStudyItem({
      ...common,
      answer: "Use f'(x) for instantaneous rate of change.",
      prompt: "When do you use this formula?",
      sourceKind: "formula",
      type: "formula_card",
    });
    createStudyItem({
      ...common,
      answer: "Set up the units before calculating.",
      prompt: "What is the first move in this problem?",
      sourceKind: "problem",
      type: "numeric_problem",
    });
    createStudyItem({
      ...common,
      answer: "Check the sign before simplifying.",
      prompt: "What mistake should you catch next time?",
      sourceKind: "mistake",
      type: "mistake_review",
    });

    expect(listStudyItems("user-1").map((item) => item.type)).toEqual(expect.arrayContaining([
      "mistake_review",
      "numeric_problem",
      "formula_card",
      "highlight_recall",
      "free_response",
    ]));
  });

  it("keeps stored items account-scoped and filters out another owner", () => {
    window.localStorage.setItem(
      studyItemsStorageKey("user-1"),
      JSON.stringify([
        {
          id: "wrong-owner",
          owner_id: "user-2",
          prompt: "Should stay hidden",
        },
      ]),
    );

    createStudyItem({
      answer: "Visible",
      betaEnabled: true,
      ownerId: "user-1",
      prompt: "Visible item",
      sourceKind: "note",
      type: "free_response",
    });

    expect(listStudyItems("user-1").map((item) => item.prompt)).toEqual(["Visible item"]);
  });

  it("records ratings as review events without storing student response content", () => {
    const item = createStudyItem({
      answer: "Derivative means local rate.",
      betaEnabled: true,
      ownerId: "user-1",
      prompt: "Explain derivative.",
      sourceKind: "note",
      type: "free_response",
    });

    const result = recordStudyReviewEvent({
      betaEnabled: true,
      itemId: item.id,
      now: new Date("2026-05-14T12:00:00.000Z"),
      ownerId: "user-1",
      rating: "hard",
      response: "This is my private wording and should not be persisted in the event.",
    });

    expect(result.item.due_at).toBe("2026-05-15T12:00:00.000Z");
    expect(result.event).toMatchObject({
      item_id: item.id,
      owner_id: "user-1",
      rating: "hard",
      response_length: "This is my private wording and should not be persisted in the event.".length,
    });
    expect(JSON.stringify(listStudyReviewEvents("user-1"))).not.toContain("private wording");
  });
});
