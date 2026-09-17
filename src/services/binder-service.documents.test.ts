import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDoc } from "@/lib/utils";

const { mockFrom, mockLessonSingle, mockLessonSelect, mockLessonUpsert } = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));
  const from = vi.fn((table: string) => {
    if (table === "binder_lessons") {
      return { upsert };
    }

    throw new Error(`Unexpected table access in document test: ${table}`);
  });

  return {
    mockFrom: from,
    mockLessonSingle: single,
    mockLessonSelect: select,
    mockLessonUpsert: upsert,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
  isSupabaseConfigured: true,
  supabaseProjectRef: "test-project",
}));

import { createWorkspaceDocument } from "@/services/binder-service";

describe("binder-service workspace document creation", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockLessonUpsert.mockClear();
    mockLessonSelect.mockClear();
    mockLessonSingle.mockReset();
  });

  it("creates a compact draft document inside the selected binder", async () => {
    mockLessonSingle.mockResolvedValueOnce({
      data: {
        id: "lesson-chem-intro",
        binder_id: "binder-chemistry",
        title: "Intro to Stoichiometry",
        order_index: 4,
        content: emptyDoc("Start writing this document."),
        math_blocks: [],
        is_preview: false,
        created_at: "2026-05-07T00:00:00.000Z",
        updated_at: "2026-05-07T00:00:00.000Z",
      },
      error: null,
    });

    const lesson = await createWorkspaceDocument({
      binderId: "binder-chemistry",
      orderIndex: 4,
      title: "Intro to Stoichiometry",
    });

    expect(lesson.id).toBe("lesson-chem-intro");
    expect(mockFrom).toHaveBeenCalledWith("binder_lessons");
    expect(mockLessonUpsert).toHaveBeenCalledTimes(1);
    const upsertCalls = mockLessonUpsert.mock.calls as unknown[][];
    expect(upsertCalls[0]?.[0]).toMatchObject({
      binder_id: "binder-chemistry",
      title: "Intro to Stoichiometry",
      order_index: 4,
      is_preview: false,
      math_blocks: [],
    });
  });

  it("requires a real binder before creating a document", async () => {
    await expect(
      createWorkspaceDocument({
        binderId: "",
        title: "No Binder",
      }),
    ).rejects.toThrow("Choose a binder before creating a document.");
    expect(mockLessonUpsert).not.toHaveBeenCalled();
  });
});
