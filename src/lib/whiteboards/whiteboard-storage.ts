import { MAX_WHITEBOARDS_PER_USER } from "@/lib/whiteboards/whiteboard-limits";
import { supabase } from "@/lib/supabase";
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
  "Your plan’s active whiteboard limit has been reached. Archive a board to make room; existing work is preserved.";
const WHITEBOARD_SELECT = [
  "id",
  "owner_id",
  "binder_id",
  "lesson_id",
  "title",
  "subject",
  "module_context",
  "scene_json",
  "module_elements",
  "thumbnail_path",
  "scene_size_bytes",
  "asset_size_bytes",
  "object_count",
  "created_at",
  "updated_at",
  "archived_at",
  "revision",
].join(", ");

export type WhiteboardVersionSummary = { id: string; version: number; createdAt: string; kind: string };
export async function listWhiteboardVersions(board: BinderWhiteboard): Promise<WhiteboardVersionSummary[]> {
  if (!supabase) throw new Error("Sign in to load saved whiteboard history.");
  const { data, error } = await supabase.from("whiteboard_versions").select("id,version,created_at,version_kind")
    .eq("whiteboard_id", board.id).eq("owner_id", board.ownerId).order("version", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), version: Number(row.version), createdAt: String(row.created_at), kind: String(row.version_kind) }));
}
export async function restoreWhiteboardVersion(board: BinderWhiteboard, versionId: string, expectedRevision: number, operationId: string): Promise<BinderWhiteboard> {
  if (!supabase) throw new Error("Sign in to restore saved whiteboard history.");
  const { data, error } = await supabase.rpc("restore_whiteboard_version", {
    p_board_id: board.id, p_version_id: versionId, p_expected_revision: expectedRevision, p_operation_id: operationId,
  });
  if (error) {
    if (error.code === "40001") throw new Error("This board changed. Load the saved version before restoring history.");
    throw error;
  }
  if (!data || typeof data !== "object" || data.owner_id !== board.ownerId || data.id !== board.id) throw new Error("The restore response did not match this board.");
  return mapWhiteboardRecord(data as Record<string, unknown>);
}

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
  return error instanceof Error ? error.message : "Unknown whiteboard storage error.";
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
  const raw = window.localStorage.getItem(getWhiteboardStorageKey(scope));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as BinderWhiteboard[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBoards(scope: WhiteboardScope, boards: BinderWhiteboard[]) {
  window.localStorage.setItem(getWhiteboardStorageKey(scope), JSON.stringify(boards));
}

function mapWhiteboardRecord(record: Record<string, unknown>): BinderWhiteboard {
  return sanitizeWhiteboardForStorage({
    id: String(record.id),
    ownerId: String(record.owner_id),
    binderId: typeof record.binder_id === "string" ? record.binder_id : "math-lab",
    lessonId: typeof record.lesson_id === "string" ? record.lesson_id : null,
    title: typeof record.title === "string" ? record.title : "Math Whiteboard",
    subject: typeof record.subject === "string" ? record.subject : "Math",
    moduleContext:
      record.module_context === "binder" || record.module_context === "lesson" || record.module_context === "math-lab"
        ? record.module_context
        : "lesson",
    scene: (record.scene_json ?? { elements: [], appState: {}, files: {} }) as BinderWhiteboard["scene"],
    modules: Array.isArray(record.module_elements)
      ? (record.module_elements as BinderWhiteboard["modules"])
      : [],
    thumbnailDataUrl: null,
    objectCount: typeof record.object_count === "number" ? record.object_count : 0,
    sceneSizeBytes: typeof record.scene_size_bytes === "number" ? record.scene_size_bytes : 0,
    assetSizeBytes: typeof record.asset_size_bytes === "number" ? record.asset_size_bytes : 0,
    storageMode: "supabase",
    createdAt: typeof record.created_at === "string" ? record.created_at : nowIso(),
    updatedAt: typeof record.updated_at === "string" ? record.updated_at : nowIso(),
    archivedAt: typeof record.archived_at === "string" ? record.archived_at : null,
    revision: typeof record.revision === "number" && Number.isSafeInteger(record.revision) ? record.revision : 0,
  });
}

function buildWhiteboardRecord(board: BinderWhiteboard) {
  const sanitized = sanitizeWhiteboardForStorage(board);
  return {
    id: sanitized.id,
    owner_id: sanitized.ownerId,
    binder_id: sanitized.binderId === "math-lab" ? null : sanitized.binderId,
    lesson_id: sanitized.binderId === "math-lab" ? null : sanitized.lessonId,
    title: sanitized.title,
    subject: sanitized.subject,
    module_context: sanitized.moduleContext,
    scene_json: sanitized.scene,
    module_elements: sanitized.modules,
    thumbnail_path: null,
    scene_size_bytes: sanitized.sceneSizeBytes,
    asset_size_bytes: sanitized.assetSizeBytes,
    object_count: sanitized.objectCount,
    archived_at: sanitized.archivedAt,
  };
}

type WhiteboardListOptions = { metadataOnly?: boolean; offset?: number; limit?: number };
async function listSupabaseWhiteboards(scope: WhiteboardScope, options: WhiteboardListOptions = {}): Promise<BinderWhiteboard[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured for whiteboard sync.");
  }

  let query = supabase
    .from("whiteboards")
    .select(options.metadataOnly ? WHITEBOARD_SELECT.split(", ").filter((field) => field !== "scene_json" && field !== "module_elements").join(", ") : WHITEBOARD_SELECT)
    .eq("owner_id", scope.ownerId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (options.metadataOnly) {
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 20)));
    query = query.order("id", { ascending: true }).range(offset, offset + limit - 1);
  }
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((record) => ({ ...mapWhiteboardRecord(record), ...(options.metadataOnly ? {
    metadataOnly: true, objectCount: Number(record.object_count ?? 0), sceneSizeBytes: Number(record.scene_size_bytes ?? 0), assetSizeBytes: Number(record.asset_size_bytes ?? 0),
  } : {}) }));
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

  return data ? mapWhiteboardRecord(data as unknown as Record<string, unknown>) : null;
}

async function saveSupabaseWhiteboard(board: BinderWhiteboard, createVersion: boolean, operationId: string = crypto.randomUUID(), expectedRevision = board.revision ?? 0) {
  if (!supabase) throw new Error("Supabase is not configured for whiteboard sync.");
  const { data, error } = await supabase.rpc("save_whiteboard_snapshot", {
    p_board: buildWhiteboardRecord(board),
    p_expected_revision: expectedRevision,
    p_create_version: createVersion,
    p_operation_id: operationId,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid whiteboard save response.");
  }
  return mapWhiteboardRecord(data);
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
        viewBackgroundColor: "#ffffff",
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
        viewBackgroundColor: "#ffffff",
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
  return readBoards(scope).find((board) => board.id === boardId) ?? null;
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
    const remoteBoard = await saveSupabaseWhiteboard(
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
      message: "Saved to Supabase",
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
    try {
      localBoard = saveLocalWhiteboard(created);
    } catch {
      // Preserve the original remote error for the user-facing result.
    }
    return {
      board: localBoard,
      backend: "local",
      status: isMissingWhiteboardTableError(error) ? "unavailable" : "local-draft",
      message: isMissingWhiteboardTableError(error)
        ? "Supabase unavailable. Apply the whiteboards migration before the live demo."
        : "Local draft. Supabase whiteboards are unavailable.",
      savedAt,
      error: getErrorMessage(error),
    };
  }
}

export async function listWhiteboards(scope: WhiteboardScope, options: WhiteboardListOptions = {}): Promise<WhiteboardListResult> {
  const localBoards = listLocalWhiteboards(scope);
  if (!supabase) {
    return {
      boards: localBoards,
      backend: "local",
      status: "local-draft",
      message: "Local draft",
    };
  }

  try {
    const boards = await listSupabaseWhiteboards(scope, options);
    return {
      boards,
      backend: "supabase",
      status: "loaded",
      message: boards.length > 0 ? "Loaded from Supabase" : "Supabase ready",
    };
  } catch (error) {
    return {
      boards: localBoards,
      backend: "local",
      status: "local-draft",
      message: isMissingWhiteboardTableError(error)
        ? "Saved locally. Apply the whiteboards migration to enable Supabase sync."
        : "Saved locally. Supabase whiteboards are unavailable.",
      error: getErrorMessage(error),
    };
  }
}

export async function loadWhiteboard(scope: WhiteboardScope, boardId: string): Promise<WhiteboardListResult> {
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
    return {
      boards: remoteBoard ? [remoteBoard] : localBoard ? [localBoard] : [],
      backend: remoteBoard ? "supabase" : "local",
      status: remoteBoard ? "loaded" : "local-draft",
      message: remoteBoard ? "Loaded from Supabase" : "Local draft",
    };
  } catch (error) {
    return {
      boards: localBoard ? [localBoard] : [],
      backend: "local",
      status: "local-draft",
      message: "Saved locally. Supabase whiteboards are unavailable.",
      error: getErrorMessage(error),
    };
  }
}

export async function saveWhiteboard(
  board: BinderWhiteboard,
  options: { backend?: "auto" | "local" | "supabase"; createVersion?: boolean; operationId?: string; expectedRevision?: number } = {},
): Promise<WhiteboardSaveResult> {
  const backend = options.backend ?? "auto";
  if (board.metadataOnly) throw new Error("Load the full whiteboard before saving; a list row has no scene.");
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

  const localBoard = backend === "supabase" && supabase ? sanitizeWhiteboardForStorage(board) : saveLocalWhiteboard(board);

  if (backend === "local" || !supabase) {
    return {
      board: localBoard,
      backend: "local",
      status: "local-draft",
      message: "Saved locally",
      savedAt,
    };
  }

  try {
    const remoteBoard = await saveSupabaseWhiteboard(localBoard, Boolean(options.createVersion), options.operationId, options.expectedRevision);
    return {
      board: remoteBoard,
      backend: "supabase",
      status: "saved",
      message: "Saved to Supabase",
      savedAt,
    };
  } catch (error) {
    let fallbackBoard = localBoard;
    if (backend === "supabase") {
      try {
        fallbackBoard = saveLocalWhiteboard(board);
      } catch {
        // Keep the sanitized board and report the original remote failure.
      }
    }

    if (typeof error === "object" && error !== null && "code" in error && error.code === "40001") {
      return {
        board: fallbackBoard, backend: "supabase", status: "conflict", savedAt,
        message: "This board changed elsewhere. Your draft is preserved; reload the saved board or keep your changes as a copy.",
        error: "CONTENT_REVISION_CONFLICT",
      };
    }

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
      status: isMissingWhiteboardTableError(error) ? "unavailable" : "local-draft",
      message: isMissingWhiteboardTableError(error)
        ? "Supabase unavailable. Apply the whiteboards migration before the live demo."
        : "Local draft. Supabase save failed.",
      savedAt,
      error: getErrorMessage(error),
    };
  }
}

export async function archiveWhiteboard(scope: WhiteboardScope, boardId: string): Promise<WhiteboardArchiveResult> {
  if (!supabase) {
    const archivedAt = archiveLocalWhiteboard(scope, boardId);
    return {
      backend: "local",
      status: "local-draft",
      message: "Archived local draft",
      archivedAt,
    };
  }

  try {
    const archivedAt = await archiveSupabaseWhiteboard(scope, boardId);
    archiveLocalWhiteboard(scope, boardId);
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
