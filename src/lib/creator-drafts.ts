import { z } from "zod";
import { saveQueue } from "@/lib/save-queue";
import { creatorBinderInputSchema, creatorLessonInputSchema } from "@/services/creator-workspace-service";
const base = {
  version: z.literal(1),
  ownerId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
};
// Empty fields are valid drafts; publishing/saving validates the stricter final input.
export const creatorDraftSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("binder"),
      input: creatorBinderInputSchema.extend({
        title: z.string().max(500),
        slug: z.string().max(500),
        subject: z.string().max(500),
      }),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("lesson"),
      input: creatorLessonInputSchema.extend({ title: z.string().max(500) }),
    })
    .strict(),
]);
export type CreatorDraft = z.infer<typeof creatorDraftSchema>;
const prefix = (ownerId: string) => `bindernotes:creator-draft:v1:${ownerId}:`;
const keyFor = (draft: CreatorDraft) =>
  `${prefix(draft.ownerId)}${draft.kind}:${encodeURIComponent(draft.input.id)}`;
function active(ownerId: string) {
  if (saveQueue.getAccount() !== ownerId) throw new Error("Creator draft belongs to a different account.");
}
export function saveCreatorDraft(raw: CreatorDraft) {
  const draft = creatorDraftSchema.parse(raw);
  active(draft.ownerId);
  const serialized = JSON.stringify(draft);
  if (serialized.length > 10000000) throw new Error("This creator draft exceeds the device backup limit.");
  window.localStorage.setItem(keyFor(draft), serialized);
}
export function clearCreatorDraft(draft: CreatorDraft) {
  active(draft.ownerId);
  // Do not erase a newer draft from another tab after an earlier save completes.
  if (window.localStorage.getItem(keyFor(draft)) === JSON.stringify(creatorDraftSchema.parse(draft)))
    window.localStorage.removeItem(keyFor(draft));
}
export function listCreatorDrafts(ownerId: string) {
  active(ownerId);
  const drafts: CreatorDraft[] = [];
  let unreadable = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(prefix(ownerId))) continue;
    try {
      const raw = window.localStorage.getItem(key)!;
      if (raw.length > 10000000) throw new Error();
      const draft = creatorDraftSchema.parse(JSON.parse(raw));
      if (draft.ownerId !== ownerId || keyFor(draft) !== key) throw new Error();
      drafts.push(draft);
    } catch {
      unreadable += 1;
    }
  }
  return { drafts, unreadable };
}
