import { MAX_WHITEBOARDS_PER_USER } from "@/lib/whiteboards/whiteboard-limits";
import { supabase } from "@/lib/supabase";
import {
  clearWhiteboardRecoveryDraft,
  getWhiteboardRecoveryToken,
  getWhiteboardRecoveryMessage,
  listWhiteboardRecoveryDrafts,
  readWhiteboardRecoveryDraft,
  writeWhiteboardRecoveryDraft,
} from "@/lib/whiteboards/whiteboard-recovery";
import {
  sanitizeWhiteboardForStorage,
  validateWhiteboardForStorage,
} from "@/lib/whiteboards/whiteboard-serialization";
import type {
  WhiteboardArchiveResult,
  BinderWhiteboard,
  WhiteboardListResult,
  WhiteboardScope,
  WhiteboardSaveResult,
  WhiteboardTemplate,
} from "@/lib/whiteboards/whiteboard-types";

const STORAGE_PREFIX = "bindernotes:whiteboards";
export const WHITEBOARD_LIMIT_MESSAGE =
  "You can save up to 3 whiteboards in this beta. Use a scratch board without changing saved boards, or archive only when you choose to make room.";
const WHITEBOARD_SELECT = [
  "id",
  "owner_id",
  "binder_id",
  "lesson_id",
  "title",
  "subject",
  "module_context",
  "scene_json",
  "scene",
  "module_elements",
  "modules",
  "thumbnail_path",
  "scene_size_bytes",
  "asset_size_bytes",
  "object_count",
  "created_at",
  "updated_at",
  "archived_at",
].join(", ");

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getErrorMessage(error: unknown) {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "Unknown whiteboard storage error.";
}

function isWhiteboardLimitError(error: unknown) {
  const record = error as { code?: string; message?: string } | null;
  const message = record?.message?.toLowerCase() ?? "";
  return message.includes("whiteboard_limit_reached") || message.includes("3 whiteboards");
}

function isMissingWhiteboardTableError(error: unknown) {
  const record = error as { code?: string; message?: string } | null;
  const message = record?.message?.toLowerCase() ?? "";
  return (
    record?.code === "42P01" ||
    record?.code === "42703" && message.includes("whiteboard") ||
    message.includes("whiteboards") && message.includes("does not exist")
  );
}

export function getWhiteboardStorageKey(scope: WhiteboardScope) {
  return [
    STORAGE_PREFIX,
    scope.ownerId,
    scope.binderId,
    scope.lessonId ?? "binder",
  ].join(":");
}

function readBoards(scope: WhiteboardScope): BinderWhiteboard[] {
  try {
    const raw = window.localStorage.getItem(getWhiteboardStorageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BinderWhiteboard[];
    return Array.isArray(parsed) ? parsed.filter((board) =>
      board?.ownerId === scope.ownerId && board.binderId === scope.binderId &&
      (board.lessonId ?? null) === (scope.lessonId ?? null) &&
      Array.isArray(board.scene?.elements) && Array.isArray(board.modules),
    ) : [];
  } catch {
    return [];
  }
}

function writeBoards(scope: WhiteboardScope, boards: BinderWhiteboard[]) {
  window.localStorage.setItem(getWhiteboardStorageKey(scope), JSON.stringify(boards));
}

function mapWhiteboardRecord(record: Record<string, unknown>): BinderWhiteboard {
  const validScene = (scene: unknown): scene is BinderWhiteboard["scene"] => Boolean(
    scene && typeof scene === "object" && Array.isArray((scene as BinderWhiteboard["scene"]).elements),
  );
  const scene = validScene(record.scene_json) ? record.scene_json : validScene(record.scene) ? record.scene : null;
  const modules = Array.isArray(record.module_elements) ? record.module_elements : Array.isArray(record.modules) ? record.modules : null;
  return sanitizeWhiteboardForStorage({
    id: String(record.id),
    ownerId: String(record.owner_id),
    binderId: String(record.binder_id),
    lessonId: typeof record.lesson_id === "string" ? record.lesson_id : null,
    title: typeof record.title === "string" ? record.title : "Math Whiteboard",
    subject: typeof record.subject === "string" ? record.subject : "Math",
    moduleContext:
      record.module_context === "binder" || record.module_context === "lesson" || record.module_context === "math-lab"
        ? record.module_context
        : "lesson",
    scene: scene ?? { elements: [], appState: {}, files: {} },
    modules: (modules ?? []) as BinderWhiteboard["modules"],
    contentLoaded: scene !== null && modules !== null,
    thumbnailDataUrl: null,
    objectCount: typeof record.object_count === "number" ? record.object_count : 0,
    sceneSizeBytes: typeof record.scene_size_bytes === "number" ? record.scene_size_bytes : 0,
    assetSizeBytes: typeof record.asset_size_bytes === "number" ? record.asset_size_bytes : 0,
    storageMode: "supabase",
    createdAt: typeof record.created_at === "string" ? record.created_at : nowIso(),
    updatedAt: typeof record.updated_at === "string" ? record.updated_at : nowIso(),
    storageRevision: typeof record.updated_at === "string" ? record.updated_at : undefined,
    archivedAt: typeof record.archived_at === "string" ? record.archived_at : null,
  });
}

function buildWhiteboardRecord(board: BinderWhiteboard) {
  const sanitized = sanitizeWhiteboardForStorage(board);
  return {
    id: sanitized.id,
    owner_id: sanitized.ownerId,
    binder_id: sanitized.binderId,
    lesson_id: sanitized.lessonId,
    title: sanitized.title,
    subject: sanitized.subject,
    module_context: sanitized.moduleContext,
    scene_json: sanitized.scene,
    scene: sanitized.scene,
    module_elements: sanitized.modules,
    modules: sanitized.modules,
    thumbnail_path: null,
    scene_size_bytes: sanitized.sceneSizeBytes,
    asset_size_bytes: sanitized.assetSizeBytes,
    object_count: sanitized.objectCount,
    archived_at: sanitized.archivedAt,
    updated_at: nowIso(),
  };
}

async function listSupabaseWhiteboards(scope: WhiteboardScope): Promise<BinderWhiteboard[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured for whiteboard sync.");
  }

  const { data, error } = await supabase
    .from("whiteboards")
    .select(WHITEBOARD_SELECT)
    .eq("owner_id", scope.ownerId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Record<string, unknown>[])
    .filter((record) => record.owner_id === scope.ownerId)
    .map(mapWhiteboardRecord);
}

async function loadSupabaseWhiteboard(scope: WhiteboardScope, boardId: string): Promise<BinderWhiteboard | null> {
  if (!supabase) {
    throw new Error("Supabase is not configured for whiteboard sync.");
  }

  const { data, error } = await supabase
    .from("whiteboards")
    .select(WHITEBOARD_SELECT)
    .eq("owner_id", scope.ownerId)
    .eq("id", boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;
  const record = data as unknown as Record<string, unknown>;
  if (record.id !== boardId || record.owner_id !== scope.ownerId) {
    throw new Error("The loaded board did not match the requested board.");
  }
  const board = mapWhiteboardRecord(record);
  if (board.contentLoaded === false) {
    throw new Error("This board's content could not be loaded. Its saved copy has not been changed.");
  }
  return board;
}

async function countActiveSupabaseWhiteboards(ownerId: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured for whiteboard sync.");
  }

  const { count, error } = await supabase
    .from("whiteboards")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("archived_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

const ownSavedRevisions = new Map<string, Map<string, string>>();

async function saveSupabaseWhiteboard(board: BinderWhiteboard, createVersion: boolean) {
  if (!supabase) {
    throw new Error("Supabase is not configured for whiteboard sync.");
  }

  const record = buildWhiteboardRecord(board);
  const revisionKey = `${board.ownerId}:${board.id}`;
  const revisionMap = ownSavedRevisions.get(revisionKey);
  const expectedRevision = board.storageRevision ? revisionMap?.get(board.storageRevision) ?? board.storageRevision : undefined;
  const query = expectedRevision
    ? supabase.from("whiteboards").update(record).eq("id", board.id).eq("owner_id", board.ownerId).eq("updated_at", expectedRevision)
    : supabase.from("whiteboards").upsert(record, { onConflict: "id" });
  const { data, error } = await query.select(WHITEBOARD_SELECT).single();

  if (expectedRevision && ((!data && !error) || error?.code === "PGRST116")) {
    throw new Error("This board changed in another tab or device. Your edits are kept in a recovery draft. Open Archive & restore backup to keep this draft in the archive and load the latest account version.");
  }

  if (error) {
    throw error;
  }

  const savedRecord = data as unknown as Record<string, unknown> | null;
  if (!savedRecord || savedRecord.id !== board.id || savedRecord.owner_id !== board.ownerId) {
    throw new Error("The save response did not match this board. Your recovery copy has been kept.");
  }

  const saved = mapWhiteboardRecord(data as unknown as Record<string, unknown>);
  if (saved.contentLoaded === false) throw new Error("The save response did not include the complete board.");
  if (board.storageRevision && saved.storageRevision) {
    const revisions = revisionMap ?? new Map<string, string>();
    // Rebase only revisions produced by this tab. The database comparison still
    // rejects any newer write from another tab, including during queued saves.
    for (const [base, revision] of revisions) if (revision === expectedRevision) revisions.set(base, saved.storageRevision);
    revisions.set(board.storageRevision, saved.storageRevision);
    ownSavedRevisions.set(revisionKey, revisions);
  }
  let warning: string | undefined;
  if (createVersion) {
    try {
    const { count, error: countError } = await supabase
      .from("whiteboard_versions")
      .select("id", { count: "exact", head: true })
      .eq("whiteboard_id", board.id);
    if (countError) throw countError;
    const version = (count ?? 0) + 1;
    const { error: versionError } = await supabase.from("whiteboard_versions").insert({
      whiteboard_id: board.id,
      owner_id: board.ownerId,
      version,
      scene_json: record.scene_json,
      scene: record.scene_json,
      module_elements: record.module_elements,
      modules: record.module_elements,
      scene_size_bytes: record.scene_size_bytes,
      created_by: board.ownerId,
    });
    if (versionError) {
      throw versionError;
    }
    } catch {
      warning = "Your board is saved, but this version could not be added to history.";
    }
  }

  return { board: saved, warning };
}

async function archiveSupabaseWhiteboard(scope: WhiteboardScope, boardId: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured for whiteboard sync.");
  }

  const archivedAt = nowIso();
  const { error } = await supabase
    .from("whiteboards")
    .update({ archived_at: archivedAt })
    .eq("owner_id", scope.ownerId)
    .eq("id", boardId);

  if (error) {
    throw error;
  }

  return archivedAt;
}

export function createLocalWhiteboard(
  scope: WhiteboardScope,
  options: {
    title?: string;
    subject?: string;
    template?: WhiteboardTemplate;
  } = {},
): BinderWhiteboard {
  const timestamp = nowIso();

  return sanitizeWhiteboardForStorage({
    id: randomId("whiteboard"),
    ownerId: scope.ownerId,
    binderId: scope.binderId,
    lessonId: scope.lessonId ?? null,
    title: options.title ?? options.template?.name ?? "Math Whiteboard",
    subject: options.subject ?? options.template?.subject ?? "Math",
    moduleContext: scope.lessonId ? "lesson" : "binder",
    scene: {
      elements: options.template?.starterElements ?? [],
      appState: {
        viewBackgroundColor: "#11131a",
      },
      files: {},
    },
    modules: [],
    thumbnailDataUrl: null,
    objectCount: 0,
    sceneSizeBytes: 0,
    assetSizeBytes: 0,
    storageMode: "local-draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  });
}

export function isScratchWhiteboard(board: Pick<BinderWhiteboard, "id">) {
  return board.id.startsWith("scratch-whiteboard-");
}

export function createScratchWhiteboard(
  scope: WhiteboardScope,
  options: {
    title?: string;
    subject?: string;
    template?: WhiteboardTemplate;
  } = {},
): BinderWhiteboard {
  const timestamp = nowIso();

  return sanitizeWhiteboardForStorage({
    id: randomId("scratch-whiteboard"),
    ownerId: scope.ownerId,
    binderId: scope.binderId,
    lessonId: scope.lessonId ?? null,
    title: options.title ?? "Scratch board",
    subject: options.subject ?? options.template?.subject ?? "Math",
    moduleContext: scope.lessonId ? "lesson" : "binder",
    scene: {
      elements: options.template?.starterElements ?? [],
      appState: {
        viewBackgroundColor: "#11131a",
      },
      files: {},
    },
    modules: [],
    thumbnailDataUrl: null,
    objectCount: 0,
    sceneSizeBytes: 0,
    assetSizeBytes: 0,
    storageMode: "local-draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  });
}

export function listLocalWhiteboards(scope: WhiteboardScope) {
  return readBoards(scope)
    .filter((board) => !board.archivedAt)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function loadLocalWhiteboard(scope: WhiteboardScope, boardId: string) {
  return readBoards(scope).find((board) => board.id === boardId && !board.archivedAt) ?? null;
}

export async function listArchivedWhiteboards(scope: WhiteboardScope): Promise<WhiteboardListResult> {
  // Account-wide lists may open a board from another lesson. Include its local
  // recovery archive as well, while never crossing the signed-in owner boundary.
  const archived = new Map<string, BinderWhiteboard>();
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(`${STORAGE_PREFIX}:${scope.ownerId}:`)) continue;
      let rows: unknown;
      try { rows = JSON.parse(window.localStorage.getItem(key) ?? "[]"); } catch { continue; }
      if (!Array.isArray(rows)) continue;
      for (const board of rows) {
        if (board?.ownerId !== scope.ownerId || !board.archivedAt || !Array.isArray(board.scene?.elements) || !Array.isArray(board.modules)) continue;
        if (!archived.has(board.id) || archived.get(board.id)!.updatedAt < board.updatedAt) archived.set(board.id, board as BinderWhiteboard);
      }
    }
  } catch { /* The account archive can still be loaded if local storage is unavailable. */ }
  const local = [...archived.values()];
  if (!supabase) return { boards: local, backend: "local", status: "local-draft", message: "Archived on this device" };
  try {
    const { data, error } = await supabase.from("whiteboards").select(WHITEBOARD_SELECT)
      .eq("owner_id", scope.ownerId).not("archived_at", "is", null).order("updated_at", { ascending: false });
    if (error) throw error;
    const remote = ((data ?? []) as unknown as Record<string, unknown>[]).filter((row) => row.owner_id === scope.ownerId && row.archived_at).map(mapWhiteboardRecord);
    // A local archive can contain a newer unsynced scene than the account copy.
    const merged = remote.map((board) => local.find((draft) => draft.id === board.id && draft.updatedAt > board.updatedAt) ?? board);
    return { boards: [...merged, ...local.filter((board) => !remote.some((item) => item.id === board.id))], backend: "supabase", status: "loaded", message: "Archive loaded" };
  } catch (error) {
    return { boards: local, backend: "local", status: "error", message: "Account archive is unavailable. Showing copies on this device.", error: getErrorMessage(error) };
  }
}

export async function restoreArchivedWhiteboard(scope: WhiteboardScope, board: BinderWhiteboard): Promise<WhiteboardSaveResult> {
  if (board.ownerId !== scope.ownerId || !board.archivedAt || board.contentLoaded === false) {
    return { board, backend: "local", status: "error", savedAt: nowIso(), message: "This archived board could not be restored." };
  }
  try {
    const activeCount = supabase ? await countActiveSupabaseWhiteboards(scope.ownerId) : listLocalWhiteboards(scope).length;
    if (activeCount >= MAX_WHITEBOARDS_PER_USER) return { board, backend: supabase ? "supabase" : "local", status: "limit", savedAt: nowIso(), message: WHITEBOARD_LIMIT_MESSAGE };
    return await saveWhiteboard({ ...board, archivedAt: null });
  } catch (error) {
    return { board, backend: "local", status: "error", savedAt: nowIso(), message: "Could not restore this board. The archived copy is still available.", error: getErrorMessage(error) };
  }
}

export async function importWhiteboard(board: BinderWhiteboard): Promise<WhiteboardSaveResult> {
  const scope = { ownerId: board.ownerId, binderId: board.binderId, lessonId: board.lessonId };
  try {
    const count = supabase ? await countActiveSupabaseWhiteboards(scope.ownerId) : listLocalWhiteboards(scope).length;
    if (count >= MAX_WHITEBOARDS_PER_USER) return { board, backend: supabase ? "supabase" : "local", status: "limit", savedAt: nowIso(), message: WHITEBOARD_LIMIT_MESSAGE };
    return await saveWhiteboard(board);
  } catch (error) {
    return { board, backend: "local", status: "error", savedAt: nowIso(), message: "Could not import the backup. Your existing boards are unchanged.", error: getErrorMessage(error) };
  }
}

/** Explicit conflict resolution keeps this tab's edits as a restorable local
 * archive before opening the current account version. */
export async function openLatestWhiteboardKeepingDraft(board: BinderWhiteboard): Promise<WhiteboardSaveResult> {
  const scope = { ownerId: board.ownerId, binderId: board.binderId, lessonId: board.lessonId };
  const token = getWhiteboardRecoveryToken(board.ownerId, board.id);
  try {
    if (!supabase) throw new Error("Account storage is unavailable. Your draft is unchanged.");
    const latest = await loadSupabaseWhiteboard(scope, board.id);
    if (!latest) throw new Error("This board is no longer active in your account. Your draft is unchanged.");
    if (getWhiteboardRecoveryToken(board.ownerId, board.id) !== token) throw new Error("You edited the board while loading. Try again when you are ready to switch versions.");
    const recovery = readWhiteboardRecoveryDraft(scope, board.id) ?? board;
    saveLocalWhiteboard({ ...recovery, id: randomId("whiteboard-recovery"), title: `${recovery.title} (conflict recovery)`, archivedAt: nowIso(), storageRevision: undefined });
    if (token) clearWhiteboardRecoveryDraft(board.ownerId, board.id, token);
    ownSavedRevisions.delete(`${board.ownerId}:${board.id}`);
    return { board: latest, backend: "supabase", status: "saved", savedAt: nowIso(), message: "Opened the latest account version. Your previous draft is in the archive on this device." };
  } catch (error) {
    return { board, backend: "local", status: "error", savedAt: nowIso(), message: getErrorMessage(error) };
  }
}

export function saveLocalWhiteboard(board: BinderWhiteboard) {
  const scope = {
    ownerId: board.ownerId,
    binderId: board.binderId,
    lessonId: board.lessonId,
  };
  const validation = validateWhiteboardForStorage(board);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const sanitized = sanitizeWhiteboardForStorage({
    ...board,
    storageMode: "local-draft",
    recoveryStorage: undefined,
    updatedAt: nowIso(),
  });
  const existingBoards = readBoards(scope);
  const existingIndex = existingBoards.findIndex((candidate) => candidate.id === sanitized.id);
  const nextBoards =
    existingIndex >= 0
      ? existingBoards.map((candidate) => (candidate.id === sanitized.id ? sanitized : candidate))
      : [sanitized, ...existingBoards];

  if (nextBoards.filter((candidate) => !candidate.archivedAt).length > MAX_WHITEBOARDS_PER_USER) {
    throw new Error(`Local review is capped at ${MAX_WHITEBOARDS_PER_USER} whiteboards for this lesson.`);
  }

  writeBoards(scope, nextBoards);
  return sanitized;
}

export function archiveLocalWhiteboard(scope: WhiteboardScope, boardId: string) {
  const archivedAt = nowIso();
  const recovery = readWhiteboardRecoveryDraft(scope, boardId);
  if (recovery) {
    // Recovery may be the only complete copy after a cloud save failed. Materialize
    // it as a durable archived snapshot before its pending-draft marker is removed.
    saveLocalWhiteboard({ ...recovery, archivedAt });
    return archivedAt;
  }
  const existingBoards = readBoards(scope);
  const nextBoards = existingBoards.map((candidate) =>
    candidate.id === boardId
      ? {
          ...candidate,
          archivedAt,
          updatedAt: archivedAt,
        }
      : candidate,
  );
  writeBoards(scope, nextBoards);
  return archivedAt;
}

export async function createWhiteboard(
  scope: WhiteboardScope,
  options: {
    title?: string;
    subject?: string;
    template?: WhiteboardTemplate;
  } = {},
): Promise<WhiteboardSaveResult> {
  const created = createLocalWhiteboard(scope, options);
  const savedAt = nowIso();

  if (!supabase) {
    try {
      const localBoard = saveLocalWhiteboard(created);
      return {
        board: localBoard,
        backend: "local",
        status: "local-draft",
        message: "Local draft",
        savedAt,
      };
    } catch (error) {
      return {
        board: created,
        backend: "local",
        status: isWhiteboardLimitError(error) ? "limit" : "error",
        message: isWhiteboardLimitError(error) ? WHITEBOARD_LIMIT_MESSAGE : "Could not create this whiteboard.",
        savedAt,
        error: getErrorMessage(error),
      };
    }
  }

  try {
    const activeCount = await countActiveSupabaseWhiteboards(scope.ownerId);
    if (activeCount >= MAX_WHITEBOARDS_PER_USER) {
      return {
        board: created,
        backend: "supabase",
        status: "limit",
        message: WHITEBOARD_LIMIT_MESSAGE,
        savedAt,
      };
    }

    const { board: remoteBoard } = await saveSupabaseWhiteboard(
      {
        ...created,
        storageMode: "supabase",
      },
      false,
    );
    return {
      board: remoteBoard,
      backend: "supabase",
      status: "saved",
      message: "Saved",
      savedAt,
    };
  } catch (error) {
    if (isWhiteboardLimitError(error)) {
      return {
        board: created,
        backend: "supabase",
        status: "limit",
        message: WHITEBOARD_LIMIT_MESSAGE,
        savedAt,
        error: getErrorMessage(error),
      };
    }

    let localBoard = created;
    let hasLocalCopy = false;
    try {
      localBoard = saveLocalWhiteboard(created);
      hasLocalCopy = true;
    } catch {
      hasLocalCopy = Boolean(writeWhiteboardRecoveryDraft(created).token);
    }
    // A successful local fallback must remain discoverable once cloud listing works again.
    hasLocalCopy = Boolean(writeWhiteboardRecoveryDraft(localBoard).token) || hasLocalCopy;
    return {
      board: localBoard,
      backend: "local",
      status: !hasLocalCopy ? "error" : isMissingWhiteboardTableError(error) ? "unavailable" : "local-draft",
      message: hasLocalCopy
        ? "Cloud storage is unavailable. Your new board is saved on this device."
        : "Could not save this board. Keep this tab open and retry.",
      savedAt,
      error: getErrorMessage(error),
    };
  }
}

export async function listWhiteboards(scope: WhiteboardScope): Promise<WhiteboardListResult> {
  const mergeDrafts = (boards: BinderWhiteboard[]) => {
    const drafts = listWhiteboardRecoveryDrafts(scope);
    const draftIds = new Set(drafts.map((board) => board.id));
    return [...drafts, ...boards.filter((board) => !draftIds.has(board.id))]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  };
  const localBoards = mergeDrafts(listLocalWhiteboards(scope));
  const recoveryMessage = (boards: BinderWhiteboard[], fallback: string) => boards.some((board) => board.recoveryStorage === "memory")
    ? "Some unsynced changes are held only in this tab. Keep this tab open and save to sync." : fallback;
  if (!supabase) {
    return {
      boards: localBoards,
      backend: "local",
      status: "local-draft",
      message: recoveryMessage(localBoards, "Local draft"),
    };
  }

  try {
    const boards = await listSupabaseWhiteboards(scope);
    const merged = mergeDrafts(boards);
    return {
      boards: merged,
      backend: "supabase",
      status: "loaded",
      message: recoveryMessage(merged, boards.length > 0 ? "Boards loaded" : "Ready"),
    };
  } catch (error) {
    return {
      boards: localBoards,
      backend: "local",
      status: "local-draft",
      message: recoveryMessage(localBoards, isMissingWhiteboardTableError(error)
        ? "Cloud storage is unavailable. Showing drafts saved on this device."
        : "Could not connect to cloud storage. Showing drafts saved on this device."),
      error: getErrorMessage(error),
    };
  }
}

export async function loadWhiteboard(scope: WhiteboardScope, boardId: string): Promise<WhiteboardListResult> {
  const draft = readWhiteboardRecoveryDraft(scope, boardId);
  if (draft) {
    return {
      boards: [draft], backend: "local", status: "local-draft",
      message: getWhiteboardRecoveryMessage(draft),
    };
  }
  const localBoard = loadLocalWhiteboard(scope, boardId);
  if (!supabase) {
    return {
      boards: localBoard ? [localBoard] : [],
      backend: "local",
      status: "local-draft",
      message: "Local draft",
    };
  }

  try {
    const remoteBoard = await loadSupabaseWhiteboard(scope, boardId);
    // A user can edit while the read is in flight. That newer draft wins.
    const latestDraft = readWhiteboardRecoveryDraft(scope, boardId);
    if (latestDraft) {
      return { boards: [latestDraft], backend: "local", status: "local-draft", message: getWhiteboardRecoveryMessage(latestDraft) };
    }
    return {
      boards: remoteBoard ? [remoteBoard] : localBoard ? [localBoard] : [],
      backend: remoteBoard ? "supabase" : "local",
      status: remoteBoard ? "loaded" : "local-draft",
      message: remoteBoard ? "Board loaded" : "Local draft",
    };
  } catch (error) {
    return {
      boards: localBoard ? [localBoard] : [],
      backend: "local",
      status: localBoard ? "local-draft" : "error",
      message: localBoard ? "Cloud storage is unavailable. Opened the draft on this device." : "Could not load this board. Its saved copy has not been changed.",
      error: getErrorMessage(error),
    };
  }
}

const pendingSaves = new Map<string, Promise<unknown>>();
const pendingArchives = new Map<string, Promise<WhiteboardArchiveResult>>();

/** Serialize writes to one board so an older network request cannot finish last. */
export function saveWhiteboard(
  board: BinderWhiteboard,
  options: { backend?: "auto" | "local" | "supabase"; createVersion?: boolean } = {},
): Promise<WhiteboardSaveResult> {
  if (board.contentLoaded === false) {
    return Promise.resolve({ board, backend: "local", status: "error", savedAt: nowIso(), message: "This board has not finished loading. Its saved copy has not been changed." });
  }
  // Snapshot now: queued work must never read a scene mutated by later edits.
  const snapshot = JSON.parse(JSON.stringify(sanitizeWhiteboardForStorage(board))) as BinderWhiteboard;
  const recovery = isScratchWhiteboard(snapshot) ? {} : writeWhiteboardRecoveryDraft(snapshot);
  const key = JSON.stringify([board.ownerId, board.id]);
  const pendingArchive = pendingArchives.get(key);
  const run = async (): Promise<WhiteboardSaveResult> => {
    const archived = pendingArchive ? await pendingArchive : null;
    return archived && (archived.status !== "error" || archived.archivedAt)
      ? { board: snapshot, backend: "local", status: "error", savedAt: nowIso(), message: "This board was archived. Any newer edits remain in a recovery draft on this device." }
      : saveWhiteboardSnapshot(snapshot, options, recovery);
  };
  const previous = pendingSaves.get(key);
  const pending = previous ? previous.then(run, run) : run();
  pendingSaves.set(key, pending);
  void pending.then(() => {
    if (pendingSaves.get(key) === pending) pendingSaves.delete(key);
  }, () => {
    if (pendingSaves.get(key) === pending) pendingSaves.delete(key);
  });
  return pending;
}

async function saveWhiteboardSnapshot(
  board: BinderWhiteboard,
  options: { backend?: "auto" | "local" | "supabase"; createVersion?: boolean },
  recovery: { token?: string; memoryToken?: string; error?: string },
): Promise<WhiteboardSaveResult> {
  const backend = options.backend ?? "auto";
  const savedAt = nowIso();
  if (isScratchWhiteboard(board)) {
    return {
      board: sanitizeWhiteboardForStorage({
        ...board,
        storageMode: "local-draft",
        updatedAt: nowIso(),
      }),
      backend: "local",
      status: "local-draft",
      message: "Scratch board - not saved yet",
      savedAt,
    };
  }

  const validation = validateWhiteboardForStorage(board);
  if (!validation.valid) {
    return {
      board,
      backend: "local",
      status: "storage-limit",
      message: "Storage limit exceeded",
      savedAt,
      error: validation.errors.join(" "),
    };
  }

  let localBoard = sanitizeWhiteboardForStorage({ ...board, recoveryStorage: recovery.memoryToken ? "memory" : undefined });

  if (backend === "local" || !supabase) {
    try {
      localBoard = saveLocalWhiteboard(board);
    } catch (error) {
      return {
        board: localBoard, backend: "local", status: recovery.token ? "local-draft" : "error", savedAt,
        message: recovery.token ? "Changes kept in a recovery draft on this device." : "Changes are held only in this tab. Keep this tab open and retry saving.",
        error: getErrorMessage(error),
      };
    }
    return {
      board: localBoard,
      backend: "local",
      status: "local-draft",
      message: "Saved locally",
      savedAt,
    };
  }

  try {
    const { board: remoteBoard, warning } = await saveSupabaseWhiteboard(localBoard, Boolean(options.createVersion));
    const recoveryToken = recovery.token ?? recovery.memoryToken;
    if (recoveryToken) clearWhiteboardRecoveryDraft(board.ownerId, board.id, recoveryToken);
    return {
      board: remoteBoard,
      backend: "supabase",
      status: "saved",
      message: "Saved",
      savedAt,
      warning,
    };
  } catch (error) {
    const fallbackBoard = { ...localBoard, storageMode: "local-draft" as const };

    if (isWhiteboardLimitError(error)) {
      return {
        board: fallbackBoard,
        backend: "supabase",
        status: "limit",
        message: WHITEBOARD_LIMIT_MESSAGE,
        savedAt,
        error: getErrorMessage(error),
      };
    }

    return {
      board: fallbackBoard,
      backend: "local",
      status: !recovery.token ? "error" : isMissingWhiteboardTableError(error) ? "unavailable" : "local-draft",
      message: getErrorMessage(error).includes("changed in another tab") ? getErrorMessage(error) : recovery.token
        ? "Cloud save failed. Your changes are kept on this device; retry when connected."
        : "Cloud save failed and a recovery copy could not be saved. Keep this tab open and retry.",
      savedAt,
      error: getErrorMessage(error),
    };
  }
}

export function archiveWhiteboard(scope: WhiteboardScope, boardId: string): Promise<WhiteboardArchiveResult> {
  const key = JSON.stringify([scope.ownerId, boardId]);
  const recoveryToken = getWhiteboardRecoveryToken(scope.ownerId, boardId);
  const run = () => archiveWhiteboardSnapshot(scope, boardId, recoveryToken);
  const previous = pendingSaves.get(key);
  const pending = previous ? previous.then(run, run) : run();
  pendingSaves.set(key, pending);
  pendingArchives.set(key, pending);
  void pending.finally(() => {
    if (pendingSaves.get(key) === pending) pendingSaves.delete(key);
    if (pendingArchives.get(key) === pending) pendingArchives.delete(key);
  }).catch(() => undefined);
  return pending;
}

async function archiveWhiteboardSnapshot(scope: WhiteboardScope, boardId: string, recoveryToken?: string): Promise<WhiteboardArchiveResult> {
  if (!supabase) {
    try {
    const archivedAt = archiveLocalWhiteboard(scope, boardId);
    if (recoveryToken) clearWhiteboardRecoveryDraft(scope.ownerId, boardId, recoveryToken);
    return {
      backend: "local",
      status: "local-draft",
      message: "Archived local draft",
      archivedAt,
    };
    } catch (error) {
      return { backend: "local", status: "error", message: "Could not archive this whiteboard on this device.", error: getErrorMessage(error) };
    }
  }

  try {
    const archivedAt = await archiveSupabaseWhiteboard(scope, boardId);
    try {
      archiveLocalWhiteboard(scope, boardId);
    } catch (error) {
      return {
        backend: "supabase", status: "error", archivedAt,
        message: readWhiteboardRecoveryDraft(scope, boardId)?.recoveryStorage === "memory"
          ? "Archived in your account, but the latest unsynced changes are held only in this tab. Keep this tab open."
          : "Archived in your account, but the local archive could not be written. Your recovery draft has been kept on this device.",
        error: getErrorMessage(error),
      };
    }
    if (recoveryToken) clearWhiteboardRecoveryDraft(scope.ownerId, boardId, recoveryToken);
    return {
      backend: "supabase",
      status: "archived",
      message: "Archived",
      archivedAt,
    };
  } catch (error) {
    return {
      backend: "local",
      status: "error",
      message: "Could not archive this whiteboard.",
      error: getErrorMessage(error),
    };
  }
}
