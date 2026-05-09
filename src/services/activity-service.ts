import { supabase } from "@/lib/supabase";

export type ActivityItemType =
  | "folder"
  | "binder"
  | "lesson"
  | "personal_note"
  | "personal_document"
  | "whiteboard";

export type ActivityMetadata = Record<string, unknown>;

export type RecentItemInput = {
  binderId?: string | null;
  folderId?: string | null;
  itemId: string;
  itemType: ActivityItemType;
  lessonId?: string | null;
  metadata?: ActivityMetadata;
  titleSnapshot?: string | null;
  userId: string;
};

export type WorkspaceActivityEventInput = {
  binderId?: string | null;
  eventType: string;
  lessonId?: string | null;
  metadata?: ActivityMetadata;
  moduleId: string;
  userId: string;
};

export type ActivityWriteResult = {
  ok: boolean;
  error?: string;
};

type SupabaseRpcClient = {
  rpc?: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: { code?: string; message?: string } | null }>;
};

const RECENT_ITEM_DEBOUNCE_MS = 600;
const ACTIVITY_EVENT_DEBOUNCE_MS = 900;
const recentTimers = new Map<string, ReturnType<typeof setTimeout>>();
const activityTimers = new Map<string, ReturnType<typeof setTimeout>>();

const privateMetadataKeyPattern =
  /(body|content|html|markdown|selected_text|anchor_text|selector_json|prefix_text|suffix_text|note_body|highlight_body|private_note)/i;

function compactText(value: string, maxLength = 240) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return compactText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return [];
    }
    return value.slice(0, 20).map((item) => sanitizeMetadataValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 2) {
      return {};
    }
    return sanitizeActivityMetadata(value as ActivityMetadata, depth + 1);
  }

  return null;
}

export function sanitizeActivityMetadata(metadata: ActivityMetadata | undefined, depth = 0): ActivityMetadata {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !privateMetadataKeyPattern.test(key))
      .map(([key, value]) => [key, sanitizeMetadataValue(value, depth)]),
  );
}

function getErrorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message)
    : "Activity write failed.";
}

function isMissingRecentItemRpc(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    message.includes("record_user_recent_item") && message.includes("not")
  );
}

function buildRecentItemPayload(input: RecentItemInput) {
  return {
    user_id: input.userId,
    item_type: input.itemType,
    item_id: input.itemId,
    binder_id: input.binderId ?? null,
    folder_id: input.folderId ?? null,
    lesson_id: input.lessonId ?? null,
    title_snapshot: input.titleSnapshot ? compactText(input.titleSnapshot, 180) : null,
    last_opened_at: new Date().toISOString(),
    open_count: 1,
    metadata: sanitizeActivityMetadata(input.metadata),
  };
}

function buildRecentItemRpcParams(input: RecentItemInput) {
  return {
    p_user_id: input.userId,
    p_item_type: input.itemType,
    p_item_id: input.itemId,
    p_binder_id: input.binderId ?? null,
    p_folder_id: input.folderId ?? null,
    p_lesson_id: input.lessonId ?? null,
    p_title_snapshot: input.titleSnapshot ? compactText(input.titleSnapshot, 180) : null,
    p_metadata: sanitizeActivityMetadata(input.metadata),
  };
}

export async function upsertUserRecentItem(input: RecentItemInput): Promise<ActivityWriteResult> {
  if (!supabase || !input.userId || !input.itemId) {
    return { ok: false, error: "Supabase activity storage is not configured." };
  }

  const rpc = (supabase as unknown as SupabaseRpcClient).rpc;
  if (rpc) {
    const { error } = await rpc("record_user_recent_item", buildRecentItemRpcParams(input));
    if (!error) {
      return { ok: true };
    }
    if (!isMissingRecentItemRpc(error)) {
      return { ok: false, error: getErrorMessage(error) };
    }
  }

  const { error } = await supabase
    .from("user_recent_items")
    .upsert(buildRecentItemPayload(input), { onConflict: "user_id,item_type,item_id" });

  return error ? { ok: false, error: getErrorMessage(error) } : { ok: true };
}

export async function insertWorkspaceActivityEvent(
  input: WorkspaceActivityEventInput,
): Promise<ActivityWriteResult> {
  if (!supabase || !input.userId || !input.moduleId || !input.eventType) {
    return { ok: false, error: "Supabase activity storage is not configured." };
  }

  const { error } = await supabase.from("workspace_activity_events").insert({
    user_id: input.userId,
    binder_id: input.binderId ?? null,
    lesson_id: input.lessonId ?? null,
    module_id: input.moduleId,
    event_type: input.eventType,
    metadata: sanitizeActivityMetadata(input.metadata),
  });

  return error ? { ok: false, error: getErrorMessage(error) } : { ok: true };
}

export async function trackUserRecentItem(input: RecentItemInput) {
  try {
    const result = await upsertUserRecentItem(input);
    return result.ok;
  } catch {
    return false;
  }
}

export async function trackWorkspaceActivityEvent(input: WorkspaceActivityEventInput) {
  try {
    const result = await insertWorkspaceActivityEvent(input);
    return result.ok;
  } catch {
    return false;
  }
}

export function scheduleUserRecentItem(input: RecentItemInput, delayMs = RECENT_ITEM_DEBOUNCE_MS) {
  const key = `${input.userId}:${input.itemType}:${input.itemId}`;
  const existingTimer = recentTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  recentTimers.set(
    key,
    setTimeout(() => {
      recentTimers.delete(key);
      void trackUserRecentItem(input);
    }, delayMs),
  );
}

export function scheduleWorkspaceActivityEvent(
  input: WorkspaceActivityEventInput,
  delayMs = ACTIVITY_EVENT_DEBOUNCE_MS,
) {
  const key = `${input.userId}:${input.binderId ?? "none"}:${input.lessonId ?? "none"}:${input.moduleId}:${input.eventType}`;
  const existingTimer = activityTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  activityTimers.set(
    key,
    setTimeout(() => {
      activityTimers.delete(key);
      void trackWorkspaceActivityEvent(input);
    }, delayMs),
  );
}

export function clearActivityTrackingTimersForTests() {
  for (const timer of recentTimers.values()) {
    clearTimeout(timer);
  }
  for (const timer of activityTimers.values()) {
    clearTimeout(timer);
  }
  recentTimers.clear();
  activityTimers.clear();
}
