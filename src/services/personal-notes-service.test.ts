import { describe, expect, it, afterEach, vi } from "vitest";
import type { JSONContent } from "@tiptap/react";

const supabaseCalls = vi.hoisted(() => ({
  tables: [] as string[],
  inserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  upserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
}));

const binderServiceMocks = vi.hoisted(() => ({
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
  upsertLearnerNote: binderServiceMocks.upsertLearnerNote,
}));

import {
  createLoosePersonalNote,
  createPersonalBinder,
  createPersonalDocument,
  createPersonalNoteFolder,
  updateBinderLinkedPersonalNote,
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
    binderServiceMocks.upsertLearnerNote.mockClear();
  });

  it("creates loose notes in personal_notes with the signed-in owner id", async () => {
    await createLoosePersonalNote({
      ownerId: "user-1",
      title: " Quick thought ",
      content,
      tags: ["review", "review"],
    });

    expect(supabaseCalls.upserts[0]).toMatchObject({
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

    expect(supabaseCalls.upserts[0]).toMatchObject({
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
});
