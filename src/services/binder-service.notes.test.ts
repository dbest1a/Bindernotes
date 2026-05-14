import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockBinderLessonsSelectEq,
  mockBinderLessonsUpsert,
  mockBindersMaybeSingle,
  mockBindersUpsert,
  mockFrom,
  mockLearnerNoteSingle,
  mockLearnerNoteSelect,
  mockLearnerNoteUpsert,
} =
  vi.hoisted(() => {
    const bindersMaybeSingle = vi.fn();
    const bindersSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: bindersMaybeSingle,
      })),
    }));
    const bindersUpsert = vi.fn();
    const binderLessonsSelectEq = vi.fn();
    const binderLessonsSelect = vi.fn(() => ({
      eq: binderLessonsSelectEq,
    }));
    const binderLessonsUpsert = vi.fn();
    const single = vi.fn();
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn((table: string) => {
      if (table === "binders") {
        return {
          select: bindersSelect,
          upsert: bindersUpsert,
        };
      }

      if (table === "binder_lessons") {
        return {
          select: binderLessonsSelect,
          upsert: binderLessonsUpsert,
        };
      }

      if (table === "learner_notes") {
        return { upsert };
      }

      throw new Error(`Unexpected table access in test: ${table}`);
    });

    return {
      mockBinderLessonsSelectEq: binderLessonsSelectEq,
      mockBinderLessonsUpsert: binderLessonsUpsert,
      mockBindersMaybeSingle: bindersMaybeSingle,
      mockBindersUpsert: bindersUpsert,
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
import {
  CHEMISTRY_SHOWCASE_BINDER_ID,
  chemistryShowcaseLessons,
} from "@/lib/chemistry/chemistry-showcase-content";
import { emptyDoc } from "@/lib/utils";

describe("binder-service learner note persistence", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockBindersMaybeSingle.mockReset();
    mockBindersMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockBindersUpsert.mockReset();
    mockBindersUpsert.mockResolvedValue({ error: null });
    mockBinderLessonsSelectEq.mockReset();
    mockBinderLessonsSelectEq.mockResolvedValue({ data: [], error: null });
    mockBinderLessonsUpsert.mockReset();
    mockBinderLessonsUpsert.mockResolvedValue({ error: null });
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

  it("materializes the account-visible Chemistry course in Supabase before saving its private notes", async () => {
    const chemistryLesson = chemistryShowcaseLessons.find(
      (lesson) => lesson.title === "Electrolysis and Faraday's Law",
    ) ?? chemistryShowcaseLessons[0];

    mockLearnerNoteSingle.mockResolvedValueOnce({
      data: {
        id: "note-chem-1",
        owner_id: "admin-1",
        binder_id: CHEMISTRY_SHOWCASE_BINDER_ID,
        lesson_id: chemistryLesson.id,
        folder_id: null,
        title: "Electrolysis notes",
        content: emptyDoc("saved chemistry note"),
        math_blocks: [],
        pinned: false,
        created_at: "2026-05-10T10:00:00.000Z",
        updated_at: "2026-05-10T10:01:00.000Z",
      },
      error: null,
    });

    const saved = await upsertLearnerNote({
      ownerId: "admin-1",
      binderId: CHEMISTRY_SHOWCASE_BINDER_ID,
      lessonId: chemistryLesson.id,
      folderId: "folder-chemistry",
      title: "Electrolysis notes",
      content: emptyDoc("saved chemistry note"),
      mathBlocks: [],
    });

    expect(saved.lesson_id).toBe(chemistryLesson.id);
    expect(mockBindersMaybeSingle).toHaveBeenCalledTimes(1);
    expect(mockBindersUpsert).toHaveBeenCalledTimes(1);
    expect(mockBinderLessonsUpsert).toHaveBeenCalledTimes(1);
    expect(mockLearnerNoteUpsert).toHaveBeenCalledTimes(1);

    const binderPayload = mockBindersUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(binderPayload).toMatchObject({
      id: CHEMISTRY_SHOWCASE_BINDER_ID,
      owner_id: "admin-1",
      status: "published",
    });

    const lessonRows = mockBinderLessonsUpsert.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(lessonRows).toHaveLength(chemistryShowcaseLessons.length);
    expect(lessonRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: chemistryLesson.id,
          binder_id: CHEMISTRY_SHOWCASE_BINDER_ID,
        }),
      ]),
    );
  });
});
