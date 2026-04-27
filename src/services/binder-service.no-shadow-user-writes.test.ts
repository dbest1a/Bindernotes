import { describe, expect, it, vi } from "vitest";
import { emptyDoc } from "@/lib/utils";

const mocks = vi.hoisted(() => {
  const learnerNoteUpsert = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === "binders") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    }

    if (table === "binder_lessons") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      };
    }

    if (table === "learner_notes") {
      return {
        upsert: learnerNoteUpsert,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    from,
    learnerNoteUpsert,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
  },
  isSupabaseConfigured: true,
  supabaseProjectRef: "test-project",
}));

import { upsertLearnerNote } from "@/services/binder-service";

describe("binder-service shadow write safety", () => {
  it("does not silently save private notes to shadow local storage when bundled content is missing", async () => {
    await expect(
      upsertLearnerNote({
        ownerId: "user-1",
        binderId: "binder-jacob-math-notes",
        lessonId: "lesson-jacob-calculus-limits",
        title: "Cloud only",
        content: emptyDoc("This should not become a shadow note."),
        mathBlocks: [],
      }),
    ).rejects.toThrow(/could not save.*supabase/i);

    expect(mocks.learnerNoteUpsert).not.toHaveBeenCalled();
  });
});
