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
    rpc: mockLearnerNoteSingle,
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

  it("saves the captured original revision and stable operation identity through the atomic RPC", async () => {
    mockLearnerNoteSingle.mockImplementationOnce(async (_name, args) => ({ data: { ...args.p_record, revision: 5, created_at: "2026-09-17T00:00:00Z", updated_at: "2026-09-17T00:00:00Z" }, error: null }));
    const saved = await upsertLearnerNote({ id: "note-1", ownerId: "user-1", binderId: "custom-binder", lessonId: "lesson-1", folderId: "folder-math", title: "Limits notes", content: emptyDoc("saved"), mathBlocks: [], pinned: true, expectedRevision: 4, operationId: "stable-operation" });
    expect(saved.id).toBe("note-1");
    expect(mockLearnerNoteSingle).toHaveBeenCalledWith("save_personal_content", expect.objectContaining({ p_kind: "learner-note", p_expected_revision: 4, p_operation_id: "stable-operation", p_record: expect.objectContaining({ id: "note-1", pinned: true, folder_id: "folder-math" }) }));
    expect(mockLearnerNoteUpsert).not.toHaveBeenCalled();
  });

  it("requires an original revision for updates and surfaces stale or concurrent creation conflicts", async () => {
    const input = { id: "note-1", ownerId: "user-1", binderId: "custom-binder", lessonId: "lesson-1", title: "Draft", content: emptyDoc("draft"), mathBlocks: [] };
    await expect(upsertLearnerNote(input)).rejects.toThrow(/original saved revision/);
    expect(mockLearnerNoteSingle).not.toHaveBeenCalled();
    for (const code of ["40001", "23505"]) {
      mockLearnerNoteSingle.mockResolvedValueOnce({ data: null, error: { code, message: "Conflict" } });
      await expect(upsertLearnerNote({ ...input, expectedRevision: 4, operationId: "same-operation" })).rejects.toThrow(/changed on another tab/);
    }
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
    expect(mockLearnerNoteSingle).toHaveBeenCalledTimes(1);
    expect(mockLearnerNoteUpsert).not.toHaveBeenCalled();
  });

  it("materializes the account-visible Chemistry course in Supabase before saving its private notes", async () => {
    const chemistryLesson = chemistryShowcaseLessons.find(
      (lesson) => lesson.title === "Electrolysis and Faraday's Law",
    ) ?? chemistryShowcaseLessons[0];

    mockLearnerNoteSingle.mockResolvedValueOnce({
      data: {
        id: "note-chem-1",
        revision: 1,
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
      id: "note-chem-1",
      expectedRevision: 0,
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
    expect(mockLearnerNoteSingle).toHaveBeenCalledTimes(1);
    expect(mockLearnerNoteUpsert).not.toHaveBeenCalled();

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
