// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BinderWhiteboard } from "@/lib/whiteboards/whiteboard-types";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  capturedRecord: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
  },
  isSupabaseConfigured: true,
  supabaseProjectRef: "test-project",
}));

import { archiveWhiteboard, getWhiteboardStorageKey, listWhiteboards, loadWhiteboard, openLatestWhiteboardKeepingDraft, saveWhiteboard } from "@/lib/whiteboards/whiteboard-storage";
import { clearWhiteboardRecoveryDraft, readWhiteboardRecoveryDraft, writeWhiteboardRecoveryDraft } from "@/lib/whiteboards/whiteboard-recovery";

function board(overrides: Partial<BinderWhiteboard> = {}): BinderWhiteboard {
  return {
    id: "whiteboard-1",
    ownerId: "00000000-0000-0000-0000-000000000001",
    binderId: "binder-algebra-foundations",
    lessonId: "lesson-1",
    title: "Launch board",
    subject: "Math",
    moduleContext: "lesson",
    scene: {
      elements: [{ id: "rect-1", type: "rectangle", x: 20, y: 30 }],
      appState: {
        collaborators: new Map(),
        openMenu: "canvas",
        scrollX: 100,
        scrollY: 50,
        theme: "dark",
        viewBackgroundColor: "#11131a",
        zoom: { value: 1.4 },
      },
      files: {},
    },
    modules: [
      {
        id: "module-source",
        type: "bindernotes-module",
        moduleId: "lesson",
        binderId: "binder-algebra-foundations",
        lessonId: "lesson-1",
        anchorMode: "board",
        pinned: true,
        x: 200,
        y: 120,
        width: 560,
        height: 420,
        zIndex: 10,
        mode: "live",
        title: "Source Lesson",
        createdAt: "2026-04-26T00:00:00.000Z",
        updatedAt: "2026-04-26T00:00:00.000Z",
      },
    ],
    objectCount: 2,
    sceneSizeBytes: 0,
    assetSizeBytes: 0,
    storageMode: "local-draft",
    createdAt: "2026-04-26T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("whiteboard Supabase storage", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.capturedRecord = null;
    window.localStorage.clear();
    clearWhiteboardRecoveryDraft(board().ownerId, board().id);
  });
  afterEach(() => vi.restoreAllMocks());

  it("rejects a stale account revision without overwriting the newer board", async () => {
    const eq = vi.fn();
    const query = { eq, select: vi.fn(), single: vi.fn(async () => ({ data: null, error: { code: "PGRST116", message: "No matching row" } })) };
    eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const update = vi.fn(() => query);
    const upsert = vi.fn();
    mocks.from.mockReturnValue({ update, upsert });
    const stale = board({ storageRevision: "2026-10-01T10:00:00.000Z", storageMode: "supabase" });
    const result = await saveWhiteboard(stale);
    expect(eq).toHaveBeenCalledWith("updated_at", stale.storageRevision);
    expect(upsert).not.toHaveBeenCalled();
    expect(result.status).not.toBe("saved");
    expect(result.message).toContain("changed in another tab");
    expect(readWhiteboardRecoveryDraft(stale, stale.id)?.scene.elements).toEqual(stale.scene.elements);
  });

  it("keeps conflicted edits in a separate archive before opening the latest account revision", async () => {
    const draft = board({ title: "My unsynced draft" });
    writeWhiteboardRecoveryDraft(draft);
    const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(async () => ({ data: {
      id: draft.id, owner_id: draft.ownerId, binder_id: draft.binderId, lesson_id: draft.lessonId,
      title: "Newer account title", scene_json: { elements: [{ id: "new-drawing" }] }, module_elements: [],
      updated_at: "2026-10-02T14:00:00.000Z", archived_at: null,
    }, error: null })) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
    const result = await openLatestWhiteboardKeepingDraft(draft);
    expect(result.status).toBe("saved");
    expect(result.board.title).toBe("Newer account title");
    expect(readWhiteboardRecoveryDraft(draft, draft.id)).toBeNull();
    const archive = JSON.parse(localStorage.getItem(getWhiteboardStorageKey(draft))!);
    expect(archive).toHaveLength(1);
    expect(archive[0].id).not.toBe(draft.id);
    expect(archive[0].archivedAt).toBeTruthy();
    expect(archive[0].title).toContain("conflict recovery");
    expect(archive[0].modules).toEqual(draft.modules);
  });

  it("retains the active recovery draft when its conflict archive cannot be stored", async () => {
    const draft = board();
    writeWhiteboardRecoveryDraft(draft);
    const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(async () => ({ data: {
      id: draft.id, owner_id: draft.ownerId, binder_id: draft.binderId, lesson_id: draft.lessonId,
      scene_json: { elements: [] }, module_elements: [], updated_at: "2026-10-02T14:00:00.000Z",
    }, error: null })) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage is full"); });
    const result = await openLatestWhiteboardKeepingDraft(draft);
    expect(result.status).toBe("error");
    expect(result.board).toEqual(draft);
    expect(readWhiteboardRecoveryDraft(draft, draft.id)?.title).toBe(draft.title);
  });

  it("saves sanitized scene data and board-pinned module placements to Supabase", async () => {
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe("whiteboards");
      return {
        upsert: (record: Record<string, unknown>) => {
          mocks.capturedRecord = record;
          return {
            select: () => ({
              single: async () => ({
                data: {
                  ...record,
                  created_at: "2026-04-26T00:00:00.000Z",
                  updated_at: "2026-04-26T00:01:00.000Z",
                },
                error: null,
              }),
            }),
          };
        },
      };
    });

    const result = await saveWhiteboard(board(), { backend: "supabase" });

    expect(result.status).toBe("saved");
    expect(result.message).toBe("Saved");
    expect(mocks.capturedRecord?.scene_json).toMatchObject({
      elements: [{ id: "rect-1", type: "rectangle", x: 20, y: 30 }],
      appState: {
        theme: "dark",
        viewBackgroundColor: "#11131a",
        scrollX: 100,
        scrollY: 50,
        zoom: { value: 1.4 },
      },
    });
    expect(JSON.stringify(mocks.capturedRecord?.scene_json)).not.toContain("collaborators");
    expect(mocks.capturedRecord?.module_elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "module-source",
          anchorMode: "board",
          pinned: true,
          x: 200,
          y: 120,
          width: 560,
          height: 420,
        }),
      ]),
    );
  });

  it("reports Supabase unavailable instead of fake saved when the whiteboards table is missing", async () => {
    mocks.from.mockReturnValue({
      upsert: () => ({
        select: () => ({
          single: async () => ({
            data: null,
            error: { code: "42P01", message: "relation whiteboards does not exist" },
          }),
        }),
      }),
    });

    const result = await saveWhiteboard(board(), { backend: "supabase" });

    expect(result.status).toBe("unavailable");
    expect(result.backend).toBe("local");
    expect(result.message).toMatch(/changes are kept on this device/i);
    expect(readWhiteboardRecoveryDraft(board(), board().id)?.scene.elements).toEqual(board().scene.elements);
  });

  it("keeps the latest edit while an older save completes, and serializes writes to the same board", async () => {
    const pending: Array<{ record: Record<string, unknown>; resolve: (value: unknown) => void }> = [];
    mocks.from.mockReturnValue({
      upsert: (record: Record<string, unknown>) => ({
        select: () => ({ single: () => new Promise((resolve) => pending.push({ record, resolve })) }),
      }),
    });
    const first = saveWhiteboard(board({ title: "First edit" }), { backend: "supabase" });
    const secondBoard = board({ title: "Latest edit" });
    const second = saveWhiteboard(secondBoard, { backend: "supabase" });
    expect(pending).toHaveLength(1);
    expect(readWhiteboardRecoveryDraft(secondBoard, secondBoard.id)?.title).toBe("Latest edit");

    pending[0].resolve({ data: pending[0].record, error: null });
    await first;
    expect(pending).toHaveLength(2);
    expect(readWhiteboardRecoveryDraft(secondBoard, secondBoard.id)?.title).toBe("Latest edit");

    // A third local edit has not reached the debounce yet.
    writeWhiteboardRecoveryDraft(board({ title: "Still typing" }));
    pending[1].resolve({ data: pending[1].record, error: null });
    await second;
    expect(readWhiteboardRecoveryDraft(secondBoard, secondBoard.id)?.title).toBe("Still typing");
  });

  it("recovers unsynced edits before a cloud read can overwrite them", async () => {
    const edited = board({ title: "Recovered work" });
    writeWhiteboardRecoveryDraft(edited);
    const result = await loadWhiteboard(edited, edited.id);
    expect(result.boards[0].title).toBe("Recovered work");
    expect(result.status).toBe("local-draft");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects mismatched save acknowledgements and retains the original board draft", async () => {
    mocks.from.mockReturnValue({
      upsert: (record: Record<string, unknown>) => ({ select: () => ({
        single: async () => ({ data: { ...record, id: "another-board" }, error: null }),
      }) }),
    });
    const result = await saveWhiteboard(board(), { backend: "supabase" });
    expect(result.status).toBe("local-draft");
    expect(result.board.id).toBe(board().id);
    expect(result.error).toMatch(/did not match/i);
    expect(readWhiteboardRecoveryDraft(board(), board().id)).not.toBeNull();
  });

  it("does not claim a local draft exists when device storage and cloud saving both fail", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    mocks.from.mockReturnValue({
      upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("Offline") }) }) }),
    });
    const result = await saveWhiteboard(board(), { backend: "supabase" });
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/keep this tab open/i);
  });

  it("preserves metadata counts and prevents an unloaded list entry from being saved as an empty board", async () => {
    const metadata = { id: board().id, owner_id: board().ownerId, object_count: 148, scene_size_bytes: 9000 };
    const query = {
      select: () => query, eq: () => query, is: () => query, order: () => query,
      then: (resolve: (value: unknown) => void) => resolve({ data: [metadata], error: null }),
    };
    mocks.from.mockReturnValue(query);
    const result = await listWhiteboards(board());
    expect(result.boards[0]).toMatchObject({ objectCount: 148, sceneSizeBytes: 9000, contentLoaded: false });
    mocks.from.mockClear();
    const saved = await saveWhiteboard(result.boards[0], { backend: "supabase" });
    expect(saved.status).toBe("error");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects a load response for another board instead of activating it", async () => {
    const query = {
      select: () => query, eq: () => query, is: () => query,
      maybeSingle: async () => ({ data: { id: "another-board", owner_id: board().ownerId }, error: null }),
    };
    mocks.from.mockReturnValue(query);
    const result = await loadWhiteboard(board(), board().id);
    expect(result.status).toBe("error");
    expect(result.boards).toEqual([]);
    expect(result.error).toMatch(/did not match/i);
  });

  it("orders archive after pending writes and keeps later edits from silently unarchiving the board", async () => {
    let acknowledgeSave!: () => void;
    let acknowledgeArchive!: () => void;
    const mutations: string[] = [];
    mocks.from.mockReturnValue({
      upsert: (record: Record<string, unknown>) => {
        mutations.push("save");
        return { select: () => ({ single: () => new Promise((resolve) => {
          acknowledgeSave = () => resolve({ data: record, error: null });
        }) }) };
      },
      update: () => {
        mutations.push("archive");
        const query = { eq: () => query, then: (resolve: (result: unknown) => void) => {
          acknowledgeArchive = () => resolve({ error: null });
        } };
        return query;
      },
    });
    const first = saveWhiteboard(board({ title: "Before archive" }), { backend: "supabase" });
    const archived = archiveWhiteboard(board(), board().id);
    const later = saveWhiteboard(board({ title: "Edited while archiving" }), { backend: "supabase" });
    expect(mutations).toEqual(["save"]);
    acknowledgeSave();
    await first;
    await vi.waitFor(() => expect(acknowledgeArchive).toBeTypeOf("function"));
    acknowledgeArchive();
    expect((await archived).status).toBe("archived");
    expect((await later).status).toBe("error");
    expect(mutations).toEqual(["save", "archive"]);
    expect(readWhiteboardRecoveryDraft(board(), board().id)?.title).toBe("Edited while archiving");
  });

  it("reports the board as saved with a history warning if only the optional version snapshot fails", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "whiteboards") return {
        upsert: (record: Record<string, unknown>) => ({ select: () => ({ single: async () => ({ data: record, error: null }) }) }),
      };
      const query = { select: () => query, eq: () => query,
        then: (resolve: (value: unknown) => void) => resolve({ count: null, error: new Error("History unavailable") }) };
      return query;
    });
    const result = await saveWhiteboard(board(), { backend: "supabase", createVersion: true });
    expect(result.status).toBe("saved");
    expect(result.warning).toMatch(/board is saved.*history/i);
    expect(readWhiteboardRecoveryDraft(board(), board().id)).toBeNull();
  });

  it("archives the complete recovery snapshot after a failed cloud save before clearing the pending draft", async () => {
    mocks.from.mockReturnValue({
      upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("Offline save") }) }) }),
      update: () => {
        const query = { eq: () => query, then: (resolve: (value: unknown) => void) => resolve({ error: null }) };
        return query;
      },
    });
    const edited = board({ title: "Only complete copy is recovery" });
    const saving = saveWhiteboard(edited, { backend: "supabase" });
    const archiving = archiveWhiteboard(edited, edited.id);
    expect((await saving).status).toBe("local-draft");
    expect((await archiving).status).toBe("archived");
    const archived = JSON.parse(window.localStorage.getItem(getWhiteboardStorageKey(edited))!) as BinderWhiteboard[];
    expect(archived[0].archivedAt).toBeTruthy();
    expect(archived[0].title).toBe(edited.title);
    expect(archived[0].scene.elements).toEqual(edited.scene.elements);
    expect(archived[0].modules).toMatchObject(edited.modules);
    expect(readWhiteboardRecoveryDraft(edited, edited.id)).toBeNull();
  });

  it("keeps recovery and reports partial archive failure if the durable local archive cannot be written", async () => {
    const edited = board();
    writeWhiteboardRecoveryDraft(edited);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    mocks.from.mockReturnValue({ update: () => {
      const query = { eq: () => query, then: (resolve: (value: unknown) => void) => resolve({ error: null }) };
      return query;
    } });
    const archived = await archiveWhiteboard(edited, edited.id);
    expect(archived.status).toBe("error");
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.message).toMatch(/recovery draft has been kept/i);
    expect(readWhiteboardRecoveryDraft(edited, edited.id)?.scene.elements).toEqual(edited.scene.elements);
  });

  it("recovers the newest in-tab board after cloud and device storage both fail", async () => {
    const edited = board({ title: "Newest unsynced work", scene: { elements: [{ id: "new-stroke" }] } });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    mocks.from.mockReturnValue({
      upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("Offline") }) }) }),
    });
    expect((await saveWhiteboard(edited, { backend: "supabase" })).status).toBe("error");
    const loaded = await loadWhiteboard(edited, edited.id);
    expect(loaded.boards[0]).toMatchObject({ title: edited.title, recoveryStorage: "memory", scene: edited.scene });
    expect(loaded.message).toMatch(/in this tab.*keep this tab open/i);
    const listed = await listWhiteboards(edited);
    expect(listed.boards[0].title).toBe(edited.title);
    expect(listed.message).toMatch(/only in this tab/i);
  });

  it("does not let an older cloud acknowledgement clear a newer memory-only draft", async () => {
    let acknowledge!: () => void;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    mocks.from.mockReturnValue({ upsert: (record: Record<string, unknown>) => ({
      select: () => ({ single: () => new Promise((resolve) => { acknowledge = () => resolve({ data: record, error: null }); }) }),
    }) });
    const saving = saveWhiteboard(board({ title: "Older edit" }), { backend: "supabase" });
    writeWhiteboardRecoveryDraft(board({ title: "Newer edit" }));
    acknowledge();
    expect((await saving).status).toBe("saved");
    expect(readWhiteboardRecoveryDraft(board(), board().id)?.title).toBe("Newer edit");
  });

  it("removes only the superseded durable draft after its replacement memory-only draft syncs", async () => {
    writeWhiteboardRecoveryDraft(board({ title: "Old durable draft" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    mocks.from.mockReturnValue({ upsert: (record: Record<string, unknown>) => ({
      select: () => ({ single: async () => ({ data: record, error: null }) }),
    }) });
    expect((await saveWhiteboard(board({ title: "Newer memory edit" }), { backend: "supabase" })).status).toBe("saved");
    expect(readWhiteboardRecoveryDraft(board(), board().id)).toBeNull();
  });

  it("keeps an independently newer durable draft when acknowledging a memory-only save", async () => {
    writeWhiteboardRecoveryDraft(board({ title: "Old durable draft" }));
    let acknowledge!: () => void;
    const nativeSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    mocks.from.mockReturnValue({ upsert: (record: Record<string, unknown>) => ({
      select: () => ({ single: () => new Promise((resolve) => { acknowledge = () => resolve({ data: record, error: null }); }) }),
    }) });
    const saving = saveWhiteboard(board({ title: "Memory edit" }), { backend: "supabase" });
    const durableKey = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)!).find((key) => key.startsWith("bindernotes:whiteboard-recovery:"))!;
    nativeSetItem.call(window.localStorage, durableKey, JSON.stringify({ token: "other-tab-newer-token", board: board({ title: "Other tab edit" }) }));
    acknowledge();
    expect((await saving).status).toBe("saved");
    expect(readWhiteboardRecoveryDraft(board(), board().id)?.title).toBe("Other tab edit");
  });
});
