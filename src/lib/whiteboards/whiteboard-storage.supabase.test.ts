// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { BinderWhiteboard, WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";
import { MAX_WHITEBOARDS_PER_USER } from "@/lib/whiteboards/whiteboard-limits";

type WhiteboardRecord = Record<string, unknown>;

const mockDb = vi.hoisted(() => ({
  whiteboards: [] as WhiteboardRecord[],
  versions: [] as WhiteboardRecord[],
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

function matchesFilter(row: WhiteboardRecord, filter: { column: string; value: unknown; type: "eq" | "is" }) {
  if (filter.type === "is") {
    return row[filter.column] === filter.value;
  }

  return row[filter.column] === filter.value;
}

function createQuery(table: "whiteboards" | "whiteboard_versions") {
  const filters: Array<{ column: string; value: unknown; type: "eq" | "is" }> = [];
  let selectOptions: { count?: "exact"; head?: boolean } | undefined;
  let mutation: { type: "insert" | "update" | "upsert"; values: WhiteboardRecord | WhiteboardRecord[] } | null = null;

  const rows = () => (table === "whiteboards" ? mockDb.whiteboards : mockDb.versions);
  const executeSelect = () => {
    const filtered = rows().filter((row) => filters.every((filter) => matchesFilter(row, filter)));
    if (selectOptions?.head) {
      return { data: null, error: null, count: filtered.length };
    }

    return { data: filtered, error: null, count: selectOptions?.count ? filtered.length : null };
  };
  const executeMutation = () => {
    if (!mutation) {
      return executeSelect();
    }

    const targetRows = rows();
    if (mutation.type === "upsert") {
      const values = mutation.values as WhiteboardRecord;
      const existingIndex = targetRows.findIndex((row) => row.id === values.id);
      const next = {
        ...(existingIndex >= 0 ? targetRows[existingIndex] : {}),
        ...values,
        created_at: existingIndex >= 0 ? targetRows[existingIndex].created_at : "2026-04-26T12:00:00.000Z",
        updated_at: "2026-04-26T12:00:00.000Z",
      };
      if (existingIndex >= 0) {
        targetRows[existingIndex] = next;
      } else {
        targetRows.unshift(next);
      }
      return { data: next, error: null, count: null };
    }

    if (mutation.type === "insert") {
      const records = Array.isArray(mutation.values) ? mutation.values : [mutation.values];
      targetRows.push(...records);
      return { data: records, error: null, count: null };
    }

    targetRows.forEach((row, index) => {
      if (filters.every((filter) => matchesFilter(row, filter))) {
        targetRows[index] = { ...row, ...(mutation?.values as WhiteboardRecord) };
      }
    });
    return { data: null, error: null, count: null };
  };

  const builder = {
    select(_columns: string, options?: { count?: "exact"; head?: boolean }) {
      selectOptions = options;
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.push({ column, value, type: "eq" });
      return builder;
    },
    is(column: string, value: unknown) {
      filters.push({ column, value, type: "is" });
      return builder;
    },
    order() {
      return builder;
    },
    upsert(values: WhiteboardRecord) {
      mutation = { type: "upsert", values };
      return builder;
    },
    insert(values: WhiteboardRecord | WhiteboardRecord[]) {
      mutation = { type: "insert", values };
      return Promise.resolve(executeMutation());
    },
    update(values: WhiteboardRecord) {
      mutation = { type: "update", values };
      return builder;
    },
    single() {
      return Promise.resolve(executeMutation());
    },
    maybeSingle() {
      const result = executeSelect();
      return Promise.resolve({ ...result, data: result.data?.[0] ?? null });
    },
    then(resolve: (value: unknown) => void) {
      resolve(mutation ? executeMutation() : executeSelect());
    },
  };

  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: "whiteboards" | "whiteboard_versions") => createQuery(table),
    rpc: async (name: string, args: { p_board: WhiteboardRecord; p_expected_revision: number; p_create_version: boolean; p_operation_id: string }) => {
      mockDb.rpcCalls.push({ name, args });
      const index = mockDb.whiteboards.findIndex((row) => row.id === args.p_board.id);
      const previous = index >= 0 ? mockDb.whiteboards[index] : null;
      if (Number(previous?.revision ?? 0) !== args.p_expected_revision) {
        return { data: null, error: { code: "40001", message: "CONTENT_REVISION_CONFLICT" } };
      }
      if (!previous && mockDb.whiteboards.filter((row) => row.owner_id === args.p_board.owner_id && !row.archived_at).length >= MAX_WHITEBOARDS_PER_USER) {
        return { data: null, error: { code: "23514", message: "WHITEBOARD_LIMIT_REACHED" } };
      }
      const row: WhiteboardRecord = { ...previous, ...args.p_board, revision: args.p_expected_revision + 1, created_at: previous?.created_at ?? "2026-04-26T12:00:00.000Z", updated_at: "2026-04-26T12:00:00.000Z" };
      if (index >= 0) mockDb.whiteboards[index] = row;
      else mockDb.whiteboards.unshift(row);
      if (args.p_create_version) mockDb.versions.push({ whiteboard_id: row.id, owner_id: args.p_board.owner_id });
      return { data: row, error: null };
    },
  },
  isSupabaseConfigured: true,
  supabaseProjectRef: "test-project",
}));

import {
  WHITEBOARD_LIMIT_MESSAGE,
  archiveWhiteboard,
  createWhiteboard,
  listWhiteboards,
  loadWhiteboard,
  saveWhiteboard,
} from "@/lib/whiteboards/whiteboard-storage";

const scope = {
  ownerId: "user-1",
  binderId: "math-lab",
  lessonId: "math-lab-whiteboard",
};

function moduleElement(overrides: Partial<WhiteboardModuleElement> = {}): WhiteboardModuleElement {
  return {
    id: overrides.id ?? "module-source",
    type: "bindernotes-module",
    moduleId: overrides.moduleId ?? "lesson",
    binderId: scope.binderId,
    lessonId: scope.lessonId,
    x: overrides.x ?? 120,
    y: overrides.y ?? 80,
    width: overrides.width ?? 540,
    height: overrides.height ?? 360,
    zIndex: overrides.zIndex ?? 4,
    mode: overrides.mode ?? "live",
    anchorMode: overrides.anchorMode ?? "board",
    pinned: overrides.pinned ?? true,
    title: overrides.title ?? "Source Lesson",
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
  };
}

function board(overrides: Partial<BinderWhiteboard> = {}): BinderWhiteboard {
  return {
    id: overrides.id ?? "board-1",
    ownerId: overrides.ownerId ?? scope.ownerId,
    binderId: overrides.binderId ?? scope.binderId,
    lessonId: overrides.lessonId ?? scope.lessonId,
    title: overrides.title ?? "Saved board",
    subject: "Math",
    moduleContext: "lesson",
    scene: overrides.scene ?? {
      elements: [{ id: "rect-1", type: "rectangle" }],
      appState: { viewBackgroundColor: "#11131a", collaborators: new Map() },
      files: {},
    },
    modules: overrides.modules ?? [moduleElement()],
    objectCount: overrides.objectCount ?? 2,
    sceneSizeBytes: overrides.sceneSizeBytes ?? 0,
    assetSizeBytes: 0,
    storageMode: "supabase",
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    archivedAt: null,
  };
}

describe("whiteboard Supabase storage", () => {
  afterEach(() => {
    mockDb.whiteboards = [];
    mockDb.versions = [];
    mockDb.rpcCalls = [];
    window.localStorage.clear();
  });

  it("creates, lists, loads, renames, and archives signed-in whiteboards", async () => {
    const created = await createWhiteboard(scope, { title: "Demo board", subject: "Math" });

    expect(created.status).toBe("saved");
    expect(created.backend).toBe("supabase");
    expect((await listWhiteboards(scope)).boards.map((candidate) => candidate.title)).toEqual(["Demo board"]);

    const saved = await saveWhiteboard({ ...created.board, title: "Renamed board" }, { backend: "supabase" });
    expect(saved.status).toBe("saved");
    expect((await loadWhiteboard(scope, created.board.id)).boards[0]).toMatchObject({ title: "Renamed board" });

    const archived = await archiveWhiteboard(scope, created.board.id);
    expect(archived.status).toBe("archived");
    expect((await listWhiteboards(scope)).boards).toHaveLength(0);
  });

  it("saves scene elements, safe appState, and module anchor geometry", async () => {
    const result = await saveWhiteboard(board(), { backend: "supabase", createVersion: true });
    const stored = mockDb.whiteboards[0];

    expect(result.status).toBe("saved");
    expect(stored.scene_json).toMatchObject({
      elements: [{ id: "rect-1", type: "rectangle" }],
      appState: { viewBackgroundColor: "#11131a" },
    });
    expect(JSON.stringify(stored.scene_json)).not.toContain("collaborators");
    expect(stored.module_elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorMode: "board",
          x: 120,
          y: 80,
          width: 540,
          height: 360,
        }),
      ]),
    );
    expect(mockDb.versions[0]).toMatchObject({ owner_id: scope.ownerId, whiteboard_id: "board-1" });
    expect(mockDb.rpcCalls).toHaveLength(1);
    expect(mockDb.rpcCalls[0]).toMatchObject({ name: "save_whiteboard_snapshot", args: { p_expected_revision: 0, p_create_version: true } });
  });

  it("preserves a stale draft and reports an explicit revision conflict", async () => {
    const first = await saveWhiteboard(board(), { backend: "supabase" });
    await saveWhiteboard({ ...first.board, title: "Changed on device B" }, { backend: "supabase" });
    const stale = await saveWhiteboard({ ...first.board, title: "My pending local changes" }, { backend: "supabase" });
    expect(stale.status).toBe("conflict");
    expect(stale.board.title).toBe("My pending local changes");
    expect(mockDb.whiteboards[0].title).toBe("Changed on device B");
  });

  it("returns active boards by owner and does not list or load another user's board", async () => {
    await saveWhiteboard(board({ id: "board-user-1", ownerId: "user-1" }), { backend: "supabase" });
    await saveWhiteboard(board({ id: "board-user-2", ownerId: "user-2" }), { backend: "supabase" });

    expect((await listWhiteboards(scope)).boards.map((candidate) => candidate.id)).toEqual(["board-user-1"]);
    expect((await loadWhiteboard(scope, "board-user-2")).boards).toHaveLength(0);
  });

  it("blocks a fourth active Supabase whiteboard and allows another after archiving", async () => {
    for (let index = 0; index < MAX_WHITEBOARDS_PER_USER; index += 1) {
      const created = await createWhiteboard(scope, { title: `Board ${index + 1}` });
      expect(created.status).toBe("saved");
    }

    const blocked = await createWhiteboard(scope, { title: "Board 4" });
    expect(blocked.status).toBe("limit");
    expect(blocked.message).toBe(WHITEBOARD_LIMIT_MESSAGE);

    await archiveWhiteboard(scope, mockDb.whiteboards[0].id as string);
    const next = await createWhiteboard(scope, { title: "Replacement board" });
    expect(next.status).toBe("saved");
  });
});
