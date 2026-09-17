import { z } from "zod";
import type { DurableDraft } from "@/lib/revisioned-save";
import { personalContentSchema, type PersonalContentSnapshot } from "@/lib/personal-content-contract";

const operationSchema = z.object({ operationId: z.string(), localRevision: z.number().int().positive(), expectedRevision: z.number().int().nonnegative(), snapshot: personalContentSchema });
const draftSchema = z.object({ version: z.literal(1), ownerId: z.string(), entityKey: z.string(), snapshot: personalContentSchema, localRevision: z.number().int().nonnegative(), savedRevision: z.number().int().nonnegative(), serverRevision: z.number().int().nonnegative(), pending: operationSchema.nullable() });
export type DeviceBackup = { key: string; recordedAt: string; draft: DurableDraft<PersonalContentSnapshot> };
const journalSchema = z.object({ recordedAt: z.string().datetime(), draft: draftSchema }).superRefine((value, context) => {
  const draft = value.draft;
  const keyFor = (snapshot: PersonalContentSnapshot) => `${snapshot.kind === "note" ? "personal-note" : snapshot.kind === "document" ? "personal-document" : "binder-note"}:${snapshot.id}`;
  if (draft.ownerId !== draft.snapshot.ownerId || draft.entityKey !== keyFor(draft.snapshot) || draft.savedRevision > draft.localRevision || (draft.pending && (draft.pending.snapshot.ownerId !== draft.ownerId || keyFor(draft.pending.snapshot) !== draft.entityKey || draft.pending.localRevision > draft.localRevision || draft.pending.localRevision <= draft.savedRevision || draft.pending.expectedRevision !== draft.serverRevision))) context.addIssue({ code: "custom", message: "Draft identity or revision mismatch" });
});
export function createPersonalDraftJournal(ownerId: string, entityKey: string) {
  const prefix = `binder-notes:draft:v2:${encodeURIComponent(ownerId)}:${encodeURIComponent(entityKey)}:`;
  const pointer = `${prefix}active-slot`;
  const previousSlot = sessionStorage.getItem(pointer);
  // sessionStorage is cloned by duplicate-tab. A fresh writer slot prevents either
  // clone from overwriting or acknowledging the other tab's pending backup.
  const key = `${prefix}${crypto.randomUUID()}`;
  const list = (): DeviceBackup[] => {
    const backups: DeviceBackup[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const candidate = localStorage.key(index);
      if (!candidate?.startsWith(prefix) || candidate === key) continue;
      const raw = localStorage.getItem(candidate);
      if (!raw) continue;
      try {
        const parsed = journalSchema.safeParse(JSON.parse(raw));
        if (parsed.success && parsed.data.draft.ownerId === ownerId && parsed.data.draft.entityKey === entityKey) backups.push({ key: candidate, ...parsed.data });
      } catch { /* Invalid backups remain untouched and are never rendered as document data. */ }
    }
    return backups.sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  };
  return {
    read: () => {
      if (!previousSlot || !previousSlot.startsWith(prefix)) return null;
      const raw = localStorage.getItem(previousSlot);
      if (!raw) return null;
      const parsed = journalSchema.parse(JSON.parse(raw));
      if (parsed.draft.ownerId !== ownerId || parsed.draft.entityKey !== entityKey) throw new Error("Draft identity mismatch");
      return parsed.draft;
    },
    write: (draft: DurableDraft<PersonalContentSnapshot>) => {
      const json = JSON.stringify(journalSchema.parse({ draft, recordedAt: new Date().toISOString() }));
      if (json.length > 2_000_000) throw new Error("Draft exceeds device backup limit");
      localStorage.setItem(key, json);
      sessionStorage.setItem(pointer, key);
    },
    remove: () => localStorage.removeItem(key),
    clearSelection: () => sessionStorage.removeItem(pointer),
    list,
  };
}
