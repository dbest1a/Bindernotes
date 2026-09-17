import { describe, expect, it, afterEach, vi } from "vitest";
import type { JSONContent } from "@tiptap/react";

const supabaseCalls = vi.hoisted(() => ({
  tables: [] as string[],
  inserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  upserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  rpc: vi.fn(async (_name: string, args: { p_record: Record<string, unknown>; p_expected_revision: number }) => ({ data: { ...args.p_record, revision: args.p_expected_revision + 1 }, error: null as { code: string; message: string } | null })),
}));

const binderServiceMocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  upsertLearnerNote: vi.fn(async (input: {
    id?: string;
    ownerId: string;
    binderId: string;
    lessonId: string;
    folderId?: string | null;
    title: string;
    content: JSONContent;
    mathBlocks: unknown[];
  }) => ({
    id: input.id ?? "learner-note-1",
    owner_id: input.ownerId,
    binder_id: input.binderId,
    lesson_id: input.lessonId,
    folder_id: input.folderId ?? null,
    title: input.title,
    content: input.content,
    math_blocks: input.mathBlocks,
    pinned: false,
    created_at: "2026-04-29T12:00:00.000Z",
    updated_at: "2026-04-29T12:00:00.000Z",
  })),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: supabaseCalls.rpc,
    from: (table: string) => {
      supabaseCalls.tables.push(table);
      let payload: Record<string, unknown> = {};
      const chain = {
        insert: (value: Record<string, unknown>) => {
          payload = value;
          supabaseCalls.inserts.push({ table, payload: value });
          return chain;
        },
        upsert: (value: Record<string, unknown>) => {
          payload = value;
          supabaseCalls.upserts.push({ table, payload: value });
          return chain;
        },
        select: () => chain,
        single: async () => ({
          data: {
            id: `${table}-row`,
            ...payload,
          },
          error: null,
        }),
      };
      return chain;
    },
  },
}));

vi.mock("@/services/binder-service", () => ({
  getDashboard: binderServiceMocks.getDashboard,
  upsertLearnerNote: binderServiceMocks.upsertLearnerNote,
}));

import {
  createLoosePersonalNote,
  createPersonalBinder,
  createPersonalDocument,
  createPersonalNoteFolder,
  updateBinderLinkedPersonalNote,
  updateLoosePersonalNote,
  updatePersonalDocument,
} from "@/services/personal-notes-service";

const content: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Start" }] }],
};

describe("Personal Notes service writes", () => {
  afterEach(() => {
    supabaseCalls.tables.length = 0;
    supabaseCalls.inserts.length = 0;
    supabaseCalls.upserts.length = 0;
    supabaseCalls.rpc.mockClear();
    binderServiceMocks.getDashboard.mockClear();
    binderServiceMocks.upsertLearnerNote.mockClear();
  });

  it("creates loose notes in personal_notes with the signed-in owner id", async () => {
    await createLoosePersonalNote({
      ownerId: "user-1",
      title: " Quick thought ",
      content,
      tags: ["review", "review"],
    });

    expect(supabaseCalls.inserts[0]).toMatchObject({
      table: "personal_notes",
      payload: {
        owner_id: "user-1",
        folder_id: null,
        binder_id: null,
        document_id: null,
        title: "Quick thought",
        content,
        tags: ["review"],
      },
    });
    expect(supabaseCalls.upserts).toEqual([]);
    expect(supabaseCalls.inserts[0].payload).not.toHaveProperty("updated_at");
  });

  it("creates folders in personal_note_folders with owner-scoped rows", async () => {
    await createPersonalNoteFolder({ ownerId: "user-1", name: " Research ", color: "blue" });

    expect(supabaseCalls.inserts[0]).toMatchObject({
      table: "personal_note_folders",
      payload: {
        owner_id: "user-1",
        name: "Research",
        color: "blue",
      },
    });
  });

  it("creates binders in personal_note_binders without requiring a folder", async () => {
    await createPersonalBinder({ ownerId: "user-1", title: "Class notebook" });

    expect(supabaseCalls.inserts[0]).toMatchObject({
      table: "personal_note_binders",
      payload: {
        owner_id: "user-1",
        folder_id: null,
        title: "Class notebook",
      },
    });
  });

  it("creates documents in personal_note_documents under a personal binder", async () => {
    await createPersonalDocument({
      ownerId: "user-1",
      binderId: "personal-binder-1",
      title: "Evidence log",
      content,
    });

    expect(supabaseCalls.inserts[0]).toMatchObject({
      table: "personal_note_documents",
      payload: {
        owner_id: "user-1",
        binder_id: "personal-binder-1",
        title: "Evidence log",
        content,
      },
    });
  });

  it("saves binder-linked notes through learner_notes instead of personal_notes", async () => {
    await updateBinderLinkedPersonalNote({
      ownerId: "user-1",
      binderId: "binder-history",
      lessonId: "lesson-russia",
      folderId: null,
      title: "Binder private note",
      content,
      mathBlocks: [],
    });

    expect(binderServiceMocks.upsertLearnerNote).toHaveBeenCalledWith({
      ownerId: "user-1",
      binderId: "binder-history",
      lessonId: "lesson-russia",
      folderId: null,
      title: "Binder private note",
      content,
      mathBlocks: [],
    });
    expect(supabaseCalls.tables).not.toContain("personal_notes");
  });

  it("requires captured revisions and uses atomic RPC for both legacy update wrappers", async () => {
    const note = { id: "note-1", ownerId: "user-1", title: "Updated note", content };
    await expect(updateLoosePersonalNote(note)).rejects.toThrow(/original saved revision/);
    await updateLoosePersonalNote({ ...note, expectedRevision: 2, operationId: "same-operation" });
    expect(supabaseCalls.rpc).toHaveBeenLastCalledWith("save_personal_content", expect.objectContaining({ p_kind: "note", p_expected_revision: 2, p_operation_id: "same-operation" }));
    await updatePersonalDocument({ ...note, binderId: "binder-1", expectedRevision: 4, operationId: "document-operation" });
    expect(supabaseCalls.rpc).toHaveBeenLastCalledWith("save_personal_content", expect.objectContaining({ p_kind: "document", p_expected_revision: 4, p_operation_id: "document-operation" }));
    expect(supabaseCalls.upserts).toEqual([]);
  });
});
