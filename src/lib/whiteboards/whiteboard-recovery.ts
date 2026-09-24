import { sanitizeWhiteboardForStorage } from "@/lib/whiteboards/whiteboard-serialization";
import type { BinderWhiteboard, WhiteboardScope } from "@/lib/whiteboards/whiteboard-types";

const RECOVERY_PREFIX = "bindernotes:whiteboard-recovery:v1:";

type RecoveryDraft = { token: string; board: BinderWhiteboard; replacesToken?: string };
const memoryDrafts = new Map<string, RecoveryDraft>();

function recoveryKey(ownerId: string, boardId: string) {
  return `${RECOVERY_PREFIX}${encodeURIComponent(ownerId)}:${encodeURIComponent(boardId)}`;
}

/** Keep a synchronous recovery copy before starting a debounce or network request. */
export function writeWhiteboardRecoveryDraft(board: BinderWhiteboard): { token?: string; memoryToken?: string; error?: string } {
  if (board.contentLoaded === false || !board.id || !board.ownerId) {
    return { error: "This board has not finished loading." };
  }
  let draft: RecoveryDraft | undefined;
  const key = recoveryKey(board.ownerId, board.id);
  try {
    const token = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    draft = {
      token,
      board: JSON.parse(JSON.stringify(sanitizeWhiteboardForStorage({ ...board, recoveryStorage: undefined, storageMode: "local-draft", updatedAt: new Date().toISOString() }))) as BinderWhiteboard,
    };
    window.localStorage.setItem(key, JSON.stringify(draft));
    memoryDrafts.delete(key);
    return { token };
  } catch {
    if (draft) {
      let replacesToken = memoryDrafts.get(key)?.replacesToken;
      try {
        const previous = window.localStorage.getItem(key);
        if (previous) replacesToken = (JSON.parse(previous) as RecoveryDraft).token;
      } catch { /* Device storage can be entirely unavailable. */ }
      memoryDrafts.set(key, { ...draft, replacesToken, board: { ...draft.board, recoveryStorage: "memory" } });
    }
    return { memoryToken: draft?.token, error: "Changes are held only in this tab because device storage is unavailable. Keep this tab open until cloud saving succeeds." };
  }
}

export function getWhiteboardRecoveryMessage(board: BinderWhiteboard) {
  return board.recoveryStorage === "memory"
    ? "Unsynced changes recovered in this tab. Keep this tab open and save to sync."
    : "Recovered unsynced changes from this device. Save to sync them.";
}

export function readWhiteboardRecoveryDraft(scope: Pick<WhiteboardScope, "ownerId">, boardId: string): BinderWhiteboard | null {
  try {
    const key = recoveryKey(scope.ownerId, boardId);
    const memory = memoryDrafts.get(key);
    if (memory) return memory.board.archivedAt ? null : sanitizeWhiteboardForStorage(
      JSON.parse(JSON.stringify({ ...memory.board, recoveryStorage: "memory" })) as BinderWhiteboard,
    );
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as RecoveryDraft;
    const board = draft?.board;
    if (
      !board || board.id !== boardId || board.ownerId !== scope.ownerId || board.archivedAt ||
      board.contentLoaded === false || !Array.isArray(board.scene?.elements) || !Array.isArray(board.modules)
    ) return null;
    return sanitizeWhiteboardForStorage({ ...board, storageMode: "local-draft" });
  } catch {
    return null;
  }
}

export function getWhiteboardRecoveryToken(ownerId: string, boardId: string): string | undefined {
  const key = recoveryKey(ownerId, boardId);
  const memory = memoryDrafts.get(key);
  if (memory) return memory.token;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as RecoveryDraft).token : undefined;
  } catch { return undefined; }
}

export function listWhiteboardRecoveryDrafts(scope: Pick<WhiteboardScope, "ownerId">): BinderWhiteboard[] {
  const drafts: BinderWhiteboard[] = [];
  const prefix = `${RECOVERY_PREFIX}${encodeURIComponent(scope.ownerId)}:`;
  const keys = new Set<string>();
  for (const key of memoryDrafts.keys()) if (key.startsWith(prefix)) keys.add(key);
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      keys.add(key);
    }
  } catch {
    // Private browsing and exhausted device storage must not prevent cloud loading.
  }
  for (const key of keys) {
    const board = readWhiteboardRecoveryDraft(scope, decodeURIComponent(key.slice(prefix.length)));
    if (board) drafts.push(board);
  }
  return drafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

/** An older save acknowledgement must never remove a newer pending edit. */
export function clearWhiteboardRecoveryDraft(ownerId: string, boardId: string, expectedToken?: string) {
  const key = recoveryKey(ownerId, boardId);
  const memory = memoryDrafts.get(key);
  const acknowledgedMemory = memory && (!expectedToken || memory.token === expectedToken) ? memory : null;
  if (acknowledgedMemory) memoryDrafts.delete(key);
  try {
    if (expectedToken) {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const durableToken = (JSON.parse(raw) as RecoveryDraft).token;
      if (durableToken !== expectedToken && durableToken !== acknowledgedMemory?.replacesToken) return;
    }
    window.localStorage.removeItem(key);
  } catch {
    // Leaving a redundant recovery copy is safer than losing the current edit.
  }
}
