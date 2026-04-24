import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom, mockLearnerNoteSingle, mockLearnerNoteSelect, mockLearnerNoteUpsert } =
  vi.hoisted(() => {
    const single = vi.fn();
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn((table: string) => {
      if (table === "learner_notes") {
        return { upsert };
      }

      throw new Error(`Unexpected table access in test: ${table}`);
    });

    return {
      mockFrom: from,
      mockLearnerNoteSingle: single,
      mockLearnerNoteSelect: select,
      mockLearnerNoteUpsert: upsert,
    };
  });

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
  isSupabaseConfigured: true,
  supabaseProjectRef: "test-project",
}));

import { upsertLearnerNote } from "@/services/binder-service";
import { emptyDoc } from "@/lib/utils";

describe("binder-service learner note persistence", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockLearnerNoteUpsert.mockClear();
    mockLearnerNoteSelect.mockClear();
    mockLearnerNoteSingle.mockReset();
  });

  it("retries without an optional folder id when a synthetic UI folder fails the foreign key", async () => {
    mockLearnerNoteSingle
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "23503",
          message:
            'insert or update on table "learner_notes" violates foreign key constraint "learner_notes_folder_id_fkey"',
          details: 'Key is not present in table "folders".',
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "note-1",
          owner_id: "user-1",
          binder_id: "custom-binder",
          lesson_id: "lesson-1",
          folder_id: null,
          title: "Limits notes",
          content: emptyDoc("saved"),
          math_blocks: [],
          pinned: false,
          created_at: "2026-04-23T10:00:00.000Z",
          updated_at: "2026-04-23T10:01:00.000Z",
        },
        error: null,
      });

    const saved = await upsertLearnerNote({
      ownerId: "user-1",
      binderId: "custom-binder",
      lessonId: "lesson-1",
      folderId: "folder-math",
      title: "Limits notes",
      content: emptyDoc("saved"),
      mathBlocks: [],
    });

    expect(saved.folder_id).toBeNull();
    expect(mockLearnerNoteUpsert).toHaveBeenCalledTimes(2);
    const upsertCalls = mockLearnerNoteUpsert.mock.calls as unknown[][];
    const firstUpsertPayload = upsertCalls[0]?.[0] as Record<string, unknown>;
    const secondUpsertPayload = upsertCalls[1]?.[0] as Record<string, unknown>;

    expect(firstUpsertPayload).toMatchObject({
      owner_id: "user-1",
      binder_id: "custom-binder",
      lesson_id: "lesson-1",
      folder_id: "folder-math",
    });
    expect(secondUpsertPayload).toMatchObject({
      owner_id: "user-1",
      binder_id: "custom-binder",
      lesson_id: "lesson-1",
      folder_id: null,
    });
  });

  it("does not hide required binder or lesson reference failures", async () => {
    mockLearnerNoteSingle.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23503",
        message:
          'insert or update on table "learner_notes" violates foreign key constraint "learner_notes_lesson_id_fkey"',
        details: 'Key is not present in table "binder_lessons".',
      },
    });

    await expect(
      upsertLearnerNote({
        ownerId: "user-1",
        binderId: "custom-binder",
        lessonId: "missing-lesson",
        folderId: "folder-math",
        title: "Missing lesson notes",
        content: emptyDoc("not saved"),
        mathBlocks: [],
      }),
    ).rejects.toMatchObject({
      code: "23503",
    });
    expect(mockLearnerNoteUpsert).toHaveBeenCalledTimes(1);
  });
});
