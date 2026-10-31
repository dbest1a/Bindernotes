import type { JSONContent } from "@tiptap/react";
import type { MathBlock } from "@/types";

export type NoteRevision = { id?: string; updatedAt: string | null };

/**
 * Compares note bodies by value. Postgres `jsonb` does not keep object key
 * order, so a saved row read back can differ textually from the editor's JSON.
 */
export function serializeNoteSnapshot(title: string, content: JSONContent, mathBlocks: MathBlock[]) {
  return JSON.stringify({ title, content, mathBlocks }, sortObjectKeys);
}

function sortObjectKeys(_key: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}

/** Orders saved timestamps exactly; `Date.parse` alone drops Postgres microseconds. */
function compareRevisionTimes(left: string, right: string) {
  if (left === right) return 0;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) return Number.NaN;
  if (leftMs !== rightMs) return leftMs < rightMs ? -1 : 1;
  return Math.sign(subMillisecond(left) - subMillisecond(right));
}

function subMillisecond(value: string) {
  return Number((/\.\d{3}(\d{1,3})/.exec(value)?.[1] ?? "").padEnd(3, "0"));
}

/**
 * Places a note row read from a binder refetch relative to the revision this
 * page last loaded or saved. A refetch that started before the page's latest
 * save can resolve after it; such an `older` row must neither replace the
 * editor nor become the revision for the next conditional write.
 */
export function classifyIncomingNoteRevision(
  known: NoteRevision | undefined,
  incoming: NoteRevision,
): "same" | "older" | "newer" {
  if (!known) return "newer";
  if (!incoming.id) return known.id ? "older" : "same";
  if (incoming.id !== known.id) return "newer";
  if (!known.updatedAt) return incoming.updatedAt ? "newer" : "same";
  if (!incoming.updatedAt) return "older";
  const order = compareRevisionTimes(incoming.updatedAt, known.updatedAt);
  // Unreadable timestamps are treated as a change; the conditional write stays authoritative.
  if (Number.isNaN(order)) return "newer";
  return order < 0 ? "older" : order > 0 ? "newer" : "same";
}
