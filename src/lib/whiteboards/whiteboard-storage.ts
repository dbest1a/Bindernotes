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
  "You can save up to 3 whiteboards in this beta. Archive one to create another.";
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
    binderId: String(record.binder_id),
    lessonId: typeof record.lesson_id === "string" ? record.lesson_id : null,
    title: typeof record.title === "string" ? record.title : "Math Whiteboard",
    subject: typeof record.subject === "string" ? record.subject : "Math",
    moduleContext:
      record.module_context === "binder" || record.module_context === "lesson" || record.module_context === "math-lab"
        ? record.module_context
        : "lesson",
    scene: (record.scene_json ?? record.scene ?? { elements: [], appState: {}, files: {} }) as BinderWhiteboard["scene"],
    modules: Array.isArray(record.module_elements)
      ? (record.module_elements as BinderWhiteboard["modules"])
      : Array.isArray(record.modules)
        ? (record.modules as BinderWhiteboard["modules"])
        : [],
    thumbnailDataUrl: null,
    objectCount: typeof record.object_count === "number" ? record.object_count : 0,
    sceneSizeBytes: typeof record.scene_size_bytes === "number" ? record.scene_size_bytes : 0,
    assetSizeBytes: typeof record.asset_size_bytes === "number" ? record.asset_size_bytes : 0,
    storageMode: "supabase",
    createdAt: typeof record.created_at === "string" ? record.created_at : nowIso(),
    updatedAt: typeof record.updated_at === "string" ? record.updated_at : nowIso(),
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

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapWhiteboardRecord);
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

async function saveSupabaseWhiteboard(board: BinderWhiteboard, createVersion: boolean) {
  if (!supabase) {
    throw new Error("Supabase is not configured for whiteboard sync.");
  }

  const record = buildWhiteboardRecord(board);
  const { data, error } = await supabase
    .from("whiteboards")
    .upsert(record, { onConflict: "id" })
    .select(WHITEBOARD_SELECT)
    .single();

  if (error) {
    throw error;
  }

  if (createVersion) {
    const { count } = await supabase
      .from("whiteboard_versions")
      .select("id", { count: "exact", head: true })
      .eq("whiteboard_id", board.id);
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
  }

  return mapWhiteboardRecord(data as unknown as Record<string, unknown>);
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

export async function listWhiteboards(scope: WhiteboardScope): Promise<WhiteboardListResult> {
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
    const boards = await listSupabaseWhiteboards(scope);
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
  options: { backend?: "auto" | "local" | "supabase"; createVersion?: boolean } = {},
): Promise<WhiteboardSaveResult> {
  const backend = options.backend ?? "auto";
  const savedAt = nowIso();
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
    const remoteBoard = await saveSupabaseWhiteboard(localBoard, Boolean(options.createVersion));
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
