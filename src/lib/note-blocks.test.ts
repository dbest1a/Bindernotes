import { describe, expect, it } from "vitest";
import { buildInsertNodes } from "@/lib/note-blocks";

describe("note block source references", () => {
  it("serializes linked excerpts with a structured source marker that survives reload", () => {
    const nodes = buildInsertNodes({
      id: "insert-1",
      kind: "linked-excerpt",
      excerpt: "The calculus section reopens limits with more precision.",
      sourceLabel: "Jacob Math Notes / Limits and Continuity",
      source: {
        binderId: "binder-calculus",
        binderTitle: "Jacob Math Notes",
        lessonId: "lesson-limits",
        lessonTitle: "Limits and Continuity",
        sectionLabel: "Derivative definition",
        pageLabel: "p. 12",
        excerpt: "The calculus section reopens limits with more precision.",
        sourceUrl: "/binders/binder-calculus/documents/lesson-limits#derivative-definition",
      },
    });

    const roundTripped = JSON.parse(JSON.stringify(nodes));
    const sourceLine = roundTripped.find((node: { type?: string; content?: Array<{ marks?: unknown[] }> }) =>
      JSON.stringify(node).includes("sourceMarker"),
    );
    const marker = sourceLine?.content?.[0]?.marks?.find((mark: { type?: string }) => mark.type === "sourceMarker");

    expect(marker).toMatchObject({
      type: "sourceMarker",
      attrs: {
        binderId: "binder-calculus",
        binderTitle: "Jacob Math Notes",
        lessonId: "lesson-limits",
        lessonTitle: "Limits and Continuity",
        sectionLabel: "Derivative definition",
        pageLabel: "p. 12",
        excerpt: "The calculus section reopens limits with more precision.",
        sourceUrl: "/binders/binder-calculus/documents/lesson-limits#derivative-definition",
      },
    });
  });
});
