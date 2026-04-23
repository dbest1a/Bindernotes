import { describe, expect, it, vi } from "vitest";
import {
  buildHighlightSegments,
  buildHighlightSelector,
  createLessonSelection,
  dedupeHighlights,
  mergeStoredHighlightMetadata,
  persistHighlightMetadata,
  removeStoredHighlightMetadata,
  removeStoredHighlightMetadataByScope,
  resolveHighlightRange,
  selectionExactlyMatchesHighlight,
  selectionMatchesHighlight,
} from "@/lib/highlights";
import type { Highlight } from "@/types";

function withMockWindowStorage(run: () => void) {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  try {
    run();
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
}

describe("highlight helpers", () => {
  it("matches highlights by stored offsets when available", () => {
    const selection = createLessonSelection("same phrase", 24, 35);
    const highlight: Highlight = {
      id: "hl-1",
      owner_id: "user-1",
      binder_id: "binder-1",
      lesson_id: "lesson-1",
      anchor_text: "same phrase",
      color: "yellow",
      note_id: null,
      start_offset: 20,
      end_offset: 40,
      created_at: new Date().toISOString(),
    };

    expect(selectionMatchesHighlight(selection, highlight)).toBe(true);
    expect(
      selectionMatchesHighlight(createLessonSelection("same phrase", 41, 52), highlight),
    ).toBe(false);
  });

  it("builds distinct segments for repeated phrases when offsets are present", () => {
    const plainText = "Solve x+1. Then solve x+1 again.";
    const highlights: Highlight[] = [
      {
        id: "hl-first",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "x+1",
        color: "blue",
        note_id: null,
        start_offset: 6,
        end_offset: 9,
        created_at: new Date().toISOString(),
      },
      {
        id: "hl-second",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "x+1",
        color: "green",
        note_id: null,
        start_offset: 22,
        end_offset: 25,
        created_at: new Date().toISOString(),
      },
    ];

    expect(buildHighlightSegments(highlights, plainText)).toEqual([
      { id: "hl-first", color: "blue", start: 6, end: 9 },
      { id: "hl-second", color: "green", start: 22, end: 25 },
    ]);
  });

  it("deduplicates exact same ranges and keeps the latest highlight record", () => {
    const earlier = "2026-04-22T08:00:00.000Z";
    const later = "2026-04-22T09:00:00.000Z";
    const highlights: Highlight[] = [
      {
        id: "hl-old",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "like term",
        color: "yellow",
        note_id: null,
        start_offset: 10,
        end_offset: 19,
        created_at: earlier,
      },
      {
        id: "hl-new",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "like term",
        color: "blue",
        note_id: null,
        start_offset: 10,
        end_offset: 19,
        created_at: later,
      },
    ];

    expect(dedupeHighlights(highlights)).toEqual([highlights[1]]);
    expect(
      selectionExactlyMatchesHighlight(createLessonSelection("like term", 10, 19), highlights[1]),
    ).toBe(true);
  });

  it("resolves overlapping ranges without duplicating rendered text", () => {
    const plainText = "abcdef";
    const highlights: Highlight[] = [
      {
        id: "hl-old",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "abcd",
        color: "yellow",
        note_id: null,
        start_offset: 0,
        end_offset: 4,
        created_at: "2026-04-22T08:00:00.000Z",
      },
      {
        id: "hl-new",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "cdef",
        color: "blue",
        note_id: null,
        start_offset: 2,
        end_offset: 6,
        created_at: "2026-04-22T09:00:00.000Z",
      },
    ];

    expect(buildHighlightSegments(highlights, plainText)).toEqual([
      { id: "hl-old", color: "yellow", start: 0, end: 2 },
      { id: "hl-new", color: "blue", start: 2, end: 6 },
    ]);
  });

  it("reanchors a highlight from selector metadata when offsets are unavailable", () => {
    const selection = createLessonSelection(
      "Storming of the Bastille",
      48,
      72,
      {
        prefixText: "The ",
        suffixText: " became",
        blockId: "lesson-french-revolution-overview",
      },
    );
    const plainText =
      "Chronology matters. The Storming of the Bastille became a symbol of revolutionary momentum.";
    const highlight: Highlight = {
      id: "hl-bastille",
      owner_id: "user-1",
      binder_id: "binder-history",
      lesson_id: "lesson-1",
      anchor_text: selection.text,
      selected_text: selection.text,
      prefix_text: selection.prefixText,
      suffix_text: selection.suffixText,
      selector_json: buildHighlightSelector(selection),
      color: "orange",
      note_id: null,
      start_offset: null,
      end_offset: null,
      status: "active",
      reanchor_confidence: null,
      created_at: new Date().toISOString(),
    };

    expect(resolveHighlightRange(highlight, plainText)).toEqual({
      range: { start: 24, end: 48 },
      confidence: 0.92,
      needsReview: false,
    });
  });

  it("marks unresolved highlights as needing review instead of guessing wildly", () => {
    const selection = createLessonSelection("missing quote", 0, 13);
    const highlight: Highlight = {
      id: "hl-missing",
      owner_id: "user-1",
      binder_id: "binder-history",
      lesson_id: "lesson-1",
      anchor_text: selection.text,
      selected_text: selection.text,
      selector_json: buildHighlightSelector(selection),
      color: "pink",
      note_id: null,
      start_offset: null,
      end_offset: null,
      status: "active",
      reanchor_confidence: null,
      created_at: new Date().toISOString(),
    };

    expect(resolveHighlightRange(highlight, "This lesson does not contain that quote.")).toEqual({
      range: null,
      confidence: 0,
      needsReview: true,
    });
  });

  it("keeps highlights from different users distinct even when the text range matches", () => {
    const highlights: Highlight[] = [
      {
        id: "hl-user-1",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "same phrase",
        color: "yellow",
        note_id: null,
        start_offset: 4,
        end_offset: 15,
        created_at: "2026-04-22T08:00:00.000Z",
      },
      {
        id: "hl-user-2",
        owner_id: "user-2",
        binder_id: "binder-2",
        lesson_id: "lesson-1",
        anchor_text: "same phrase",
        color: "blue",
        note_id: null,
        start_offset: 4,
        end_offset: 15,
        created_at: "2026-04-22T08:30:00.000Z",
      },
    ];

    expect(dedupeHighlights(highlights)).toEqual(highlights);
  });

  it("keeps highlights from different binders distinct even when the text range matches", () => {
    const highlights: Highlight[] = [
      {
        id: "hl-binder-1",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-shared",
        anchor_text: "same phrase",
        color: "yellow",
        note_id: null,
        start_offset: 4,
        end_offset: 15,
        created_at: "2026-04-22T08:00:00.000Z",
      },
      {
        id: "hl-binder-2",
        owner_id: "user-1",
        binder_id: "binder-2",
        lesson_id: "lesson-shared",
        anchor_text: "same phrase",
        color: "blue",
        note_id: null,
        start_offset: 4,
        end_offset: 15,
        created_at: "2026-04-22T08:30:00.000Z",
      },
    ];

    expect(dedupeHighlights(highlights)).toEqual(highlights);
  });

  it("does not render deleted highlights back into the lesson", () => {
    const highlights: Highlight[] = [
      {
        id: "hl-active",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "important",
        color: "yellow",
        note_id: null,
        start_offset: 0,
        end_offset: 9,
        status: "active",
        created_at: "2026-04-22T08:00:00.000Z",
      },
      {
        id: "hl-deleted",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "important",
        color: "pink",
        note_id: null,
        start_offset: 10,
        end_offset: 19,
        status: "deleted",
        created_at: "2026-04-22T09:00:00.000Z",
      },
    ];

    expect(buildHighlightSegments(highlights, "important again important")).toEqual([
      { id: "hl-active", color: "yellow", start: 0, end: 9 },
    ]);
  });

  it("stores highlight metadata so refreshed rows can recover offsets", () => {
    withMockWindowStorage(() => {
      const saved: Highlight = {
        id: "hl-refresh",
        owner_id: "user-1",
        binder_id: "binder-history",
        lesson_id: "lesson-1",
        anchor_text: "Storming of the Bastille",
        color: "orange",
        note_id: null,
        start_offset: 24,
        end_offset: 48,
        created_at: "2026-04-22T10:00:00.000Z",
      };

      persistHighlightMetadata(saved);

      expect(
        mergeStoredHighlightMetadata([
          {
            ...saved,
            start_offset: null,
            end_offset: null,
          },
        ]),
      ).toEqual([saved]);
    });
  });

  it("updates stored metadata when a highlight is recolored and removes it on delete", () => {
    withMockWindowStorage(() => {
      const highlight: Highlight = {
        id: "hl-color",
        owner_id: "user-1",
        binder_id: "binder-history",
        lesson_id: "lesson-1",
        anchor_text: "Republic",
        color: "yellow",
        note_id: null,
        start_offset: 10,
        end_offset: 18,
        created_at: "2026-04-22T10:00:00.000Z",
      };

      persistHighlightMetadata(highlight);
      persistHighlightMetadata({
        ...highlight,
        color: "blue",
      });

      const raw = globalThis.window?.localStorage.getItem("binder-notes:highlight-metadata:v1");
      expect(raw).toContain("\"color\":\"blue\"");

      removeStoredHighlightMetadata(highlight.id);
      expect(globalThis.window?.localStorage.getItem("binder-notes:highlight-metadata:v1")).not.toContain("hl-color");
    });
  });

  it("clears stored metadata only for the matching binder and lesson scope", () => {
    withMockWindowStorage(() => {
      persistHighlightMetadata({
        id: "hl-same-lesson-other-binder",
        owner_id: "user-1",
        binder_id: "binder-other",
        lesson_id: "lesson-shared",
        anchor_text: "Republic",
        color: "yellow",
        note_id: null,
        start_offset: 0,
        end_offset: 8,
        created_at: "2026-04-22T10:00:00.000Z",
      });
      persistHighlightMetadata({
        id: "hl-target",
        owner_id: "user-1",
        binder_id: "binder-target",
        lesson_id: "lesson-shared",
        anchor_text: "Republic",
        color: "blue",
        note_id: null,
        start_offset: 10,
        end_offset: 18,
        created_at: "2026-04-22T10:00:01.000Z",
      });

      removeStoredHighlightMetadataByScope({
        binderId: "binder-target",
        lessonId: "lesson-shared",
      });

      const raw = globalThis.window?.localStorage.getItem("binder-notes:highlight-metadata:v1");
      expect(raw).toContain("hl-same-lesson-other-binder");
      expect(raw).not.toContain("hl-target");
    });
  });

  it("renders selector_json-only highlights without legacy offsets", () => {
    const selection = createLessonSelection(
      "Storming of the Bastille",
      24,
      48,
      { prefixText: "The ", suffixText: " became", blockId: "block-1" },
    );
    const highlight: Highlight = {
      id: "hl-selector",
      owner_id: "user-1",
      binder_id: "binder-history",
      lesson_id: "lesson-1",
      anchor_text: selection.text,
      selected_text: selection.text,
      prefix_text: selection.prefixText,
      suffix_text: selection.suffixText,
      selector_json: buildHighlightSelector(selection),
      color: "orange",
      note_id: null,
      start_offset: null,
      end_offset: null,
      status: "active",
      reanchor_confidence: null,
      created_at: "2026-04-22T11:00:00.000Z",
    };

    expect(
      buildHighlightSegments(
        [highlight],
        "Chronology matters. The Storming of the Bastille became a symbol of revolutionary momentum.",
      ),
    ).toEqual([{ id: "hl-selector", color: "orange", start: 24, end: 48 }]);
  });

  it("does not fall back to quote scanning when exact offsets already match", () => {
    const indexOfSpy = vi.spyOn(String.prototype, "indexOf");
    const highlight: Highlight = {
      id: "hl-fast-path",
      owner_id: "user-1",
      binder_id: "binder-history",
      lesson_id: "lesson-1",
      anchor_text: "Storming of the Bastille",
      color: "orange",
      note_id: null,
      start_offset: 24,
      end_offset: 48,
      created_at: "2026-04-22T11:00:00.000Z",
    };

    expect(
      resolveHighlightRange(
        highlight,
        "Chronology matters. The Storming of the Bastille became a symbol of revolutionary momentum.",
      ),
    ).toEqual({
      range: { start: 24, end: 48 },
      confidence: 1,
      needsReview: false,
    });
    expect(indexOfSpy).not.toHaveBeenCalled();
    indexOfSpy.mockRestore();
  });
});
