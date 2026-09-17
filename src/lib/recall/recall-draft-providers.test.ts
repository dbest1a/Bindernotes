import { describe, expect, it } from "vitest";
import {
  createDraftsFromProvider,
  deterministicRecallDraftProviders,
  highlightDraftProvider,
  manualCardProvider,
  noteDraftProvider,
  selectedTextDraftProvider,
  stickyDraftProvider,
  subjectToolDraftProvider,
} from "@/lib/recall/recall-draft-providers";
import type { RecallDraftContext } from "@/lib/recall/recall-types";

const context: RecallDraftContext = {
  binderId: "binder-1",
  documentId: "lesson-1",
  lessonId: "lesson-1",
  subject: "math",
  tags: ["geometry"],
  userId: "user-1",
};

describe("Recall Lab deterministic draft providers", () => {
  it("registers only manual and source-controlled draft providers", () => {
    expect(deterministicRecallDraftProviders.map((provider) => provider.id)).toEqual([
      "manualCardProvider",
      "selectedTextDraftProvider",
      "highlightDraftProvider",
      "noteDraftProvider",
      "stickyDraftProvider",
      "subjectToolDraftProvider",
    ]);

    for (const provider of deterministicRecallDraftProviders) {
      expect(provider.capabilities).toContain("requiresUserReview");
    }
  });

  it("manual provider creates editable drafts that require review", () => {
    const [draft] = manualCardProvider.createDrafts(
      { front: "What is a ray?", back: "A line with one endpoint." },
      context,
    );

    expect(draft.front).toBe("What is a ray?");
    expect(draft.back).toBe("A line with one endpoint.");
    expect(draft.sourceType).toBe("manual");
    expect(draft.createdVia).toBe("manual");
    expect(draft.draftStatus).toBe("needs_review");
    expect(draft.status).toBe("Draft");
  });

  it("selected text provider creates source-linked editable drafts without inventing an answer", () => {
    const [draft] = selectedTextDraftProvider.createDrafts(
      { text: "A dilation rescales a figure from a center point." },
      context,
    );

    expect(draft.sourceType).toBe("selected_text");
    expect(draft.sourceExcerpt).toContain("dilation");
    expect(draft.front).toContain("source passage");
    expect(draft.back).toBe("");
    expect(draft.draftStatus).toBe("needs_review");
  });

  it("highlight, note, sticky, and subject tool providers preserve source ids", () => {
    const providers = [
      highlightDraftProvider,
      noteDraftProvider,
      stickyDraftProvider,
      subjectToolDraftProvider,
    ];

    for (const provider of providers) {
      const [draft] = provider.createDrafts(
        {
          sources: [
            {
              id: `${provider.id}-source`,
              text: "Corresponding angles are congruent after a translation.",
              sourceType: provider.id === "subjectToolDraftProvider" ? "math_tool" : undefined,
            },
          ],
        },
        context,
      );

      expect(draft.sourceId).toBe(`${provider.id}-source`);
      expect(draft.sourceExcerpt).toContain("Corresponding angles");
      expect(draft.draftStatus).toBe("needs_review");
    }
  });

  it("provider registry can create drafts without changing practice UI", () => {
    const [draft] = createDraftsFromProvider(
      "selectedTextDraftProvider",
      { text: "The slope formula compares vertical change to horizontal change." },
      context,
    );

    expect(draft.cardType).toBe("source_evidence");
    expect(draft.tags).toContain("geometry");
  });
});
