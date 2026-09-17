import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDoc } from "@/lib/utils";
import type { Profile } from "@/types";

const mocks = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], reads: [] as Array<{ table: string; select: string; from: number; to: number; owner: unknown; id?: unknown }>, failPage: false }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: (table: string) => {
  const read = { table, select: "", from: 0, to: 0, owner: undefined as unknown, id: undefined as unknown };
  const query = {
    select: (select: string) => { read.select = select; return query; },
    eq: (key: string, value: unknown) => { if (key === "owner_id") read.owner = value; if (key === "id") read.id = value; return query; },
    is: () => query, order: () => query, abortSignal: () => query,
    range: (from: number, to: number) => { read.from = from; read.to = to; mocks.reads.push(read); return query; },
    single: async () => { mocks.reads.push(read); return { data: mocks.rows.find((row) => row.id === read.id), error: null }; },
    then: (resolve: (result: unknown) => unknown) => {
      const data = table === "personal_notes" ? mocks.rows.slice(read.from, read.to + 1).map((row) => Object.fromEntries(read.select.split(",").map((key) => [key, row[key]]))) : [];
      return Promise.resolve({ data, error: mocks.failPage && table === "personal_notes" && read.from > 0 ? { message: "offline" } : null }).then(resolve);
    },
  }; return query;
} } }));
vi.mock("@/services/binder-service", () => ({ getDashboard: async () => ({ binders: [], lessons: [], folders: [], folderBinders: [] }), upsertLearnerNote: vi.fn() }));
import { getPersonalNotesWorkspace, getPersonalNoteEntryContent } from "./personal-notes-service";

const profile = { id: "owner" } as Profile;
beforeEach(() => {
  mocks.reads.length = 0; mocks.failPage = false;
  mocks.rows = Array.from({ length: 1201 }, (_, index) => ({ id: `note-${index}`, owner_id: "owner", title: `Note ${index}`, content: emptyDoc("Large rich body"), math_blocks: [], tags: ["class"], folder_id: null, binder_id: null, document_id: null, revision: 7, pinned: false, archived_at: null, created_at: "2026-01-01", updated_at: "2026-09-17" }));
});
describe("metadata-first Personal Notes", () => {
  it("lists 1201 notes in bounded metadata pages and fetches only the selected body", async () => {
    const workspace = await getPersonalNotesWorkspace(profile);
    expect(workspace.entries).toHaveLength(1201);
    expect(workspace.entries.every((entry) => entry.contentLoaded === false)).toBe(true);
    expect(mocks.reads.filter((read) => read.table === "personal_notes")).toHaveLength(7);
    expect(mocks.reads.every((read) => !read.select.includes("content") && !read.select.includes("math_blocks") && read.to - read.from === 199)).toBe(true);
    expect(JSON.stringify(workspace)).not.toContain("Large rich body");
    const selected = workspace.entries.find((entry) => entry.id === "note-880")!;
    const full = await getPersonalNoteEntryContent(selected, "owner");
    expect(full.contentLoaded).toBe(true);
    expect(full.note).toMatchObject({ id: "note-880", revision: 7 });
    expect(JSON.stringify(full.content)).toContain("Large rich body");
    expect(mocks.reads.at(-1)).toMatchObject({ select: "*", owner: "owner", id: "note-880" });
    await expect(getPersonalNoteEntryContent(selected, "other")).rejects.toThrow("different account");
  });
  it("reports a failed later page instead of presenting the first 200 as a complete list", async () => {
    mocks.failPage = true;
    const workspace = await getPersonalNotesWorkspace(profile);
    expect(workspace.entries).toHaveLength(0);
    expect(workspace.loadIssues).toEqual([expect.objectContaining({ table: "personal_notes", code: "personal_query_failed" })]);
  });
});
