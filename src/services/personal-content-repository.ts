import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { saveQueue } from "@/lib/save-queue";
import { ContentConflictError, type SaveOperation } from "@/lib/revisioned-save";
import { editorDocumentSchema, mathBlockSchema, personalContentSchema, type PersonalContentSnapshot } from "@/lib/personal-content-contract";

function clientFor(ownerId: string) {
  if (!supabase || saveQueue.getAccount() !== ownerId) throw new Error("Sign in to the account that owns this draft before saving.");
  return supabase;
}

export async function savePersonalContent(operation: SaveOperation<PersonalContentSnapshot>) {
  const snapshot = personalContentSchema.parse(operation.snapshot);
  const { data, error } = await clientFor(snapshot.ownerId).rpc("save_personal_content", {
    p_kind: snapshot.kind,
    p_record: {
      id: snapshot.id, owner_id: snapshot.ownerId, title: snapshot.title.trim() || "Untitled note",
      content: snapshot.content, math_blocks: snapshot.mathBlocks, pinned: snapshot.pinned, binder_id: snapshot.binderId,
      ...(snapshot.kind === "document" ? { tags: snapshot.tags } : { folder_id: snapshot.folderId }),
      ...(snapshot.kind === "note" ? { tags: snapshot.tags, document_id: snapshot.documentId } : {}),
      ...(snapshot.kind === "learner-note" ? { lesson_id: snapshot.lessonId } : {}),
    },
    p_expected_revision: operation.expectedRevision, p_operation_id: operation.operationId,
  });
  if (error) {
    if (error.code === "40001" && error.message.includes("CONTENT_REVISION_CONFLICT")) throw new ContentConflictError();
    throw new Error("The server could not save this note. Your draft is retained; retry when the connection is available.");
  }
  const result = z.object({ id: z.string(), owner_id: z.string(), revision: z.number().int().nonnegative() }).parse(data);
  if (result.id !== snapshot.id || result.owner_id !== snapshot.ownerId) throw new Error("The saved note did not match this draft.");
  return { revision: result.revision };
}

const rowSchema = z.object({
  id: z.string(), owner_id: z.string(), title: z.string(), content: editorDocumentSchema,
  math_blocks: z.array(mathBlockSchema), pinned: z.boolean(), revision: z.number().int().nonnegative(),
  tags: z.array(z.string()).optional(), folder_id: z.string().nullable().optional(), binder_id: z.string().nullable(),
  document_id: z.string().nullable().optional(), lesson_id: z.string().nullable().optional(),
});

export async function readPersonalContent(snapshot: PersonalContentSnapshot) {
  const table = snapshot.kind === "document" ? "personal_note_documents" : snapshot.kind === "learner-note" ? "learner_notes" : "personal_notes";
  const { data, error } = await clientFor(snapshot.ownerId).from(table).select("*").eq("owner_id", snapshot.ownerId).eq("id", snapshot.id).single();
  if (error) throw new Error("The saved version could not be loaded. Your current draft is still available.");
  const row = rowSchema.parse(data);
  if (row.id !== snapshot.id || row.owner_id !== snapshot.ownerId) throw new Error("This note is not available to this account.");
  const content = personalContentSchema.parse({ kind: snapshot.kind, id: row.id, ownerId: row.owner_id, title: row.title, content: row.content, mathBlocks: row.math_blocks, tagsInput: (row.tags ?? []).join(", "), tags: row.tags ?? [], pinned: row.pinned, folderId: row.folder_id ?? null, binderId: row.binder_id, documentId: row.document_id ?? null, lessonId: row.lesson_id ?? null });
  return { snapshot: content, revision: row.revision };
}

export async function preservePersonalContentCopy(snapshot: PersonalContentSnapshot) {
  const copy: PersonalContentSnapshot = { ...snapshot, id: crypto.randomUUID(), kind: "note", title: `${snapshot.title || "Untitled note"} (recovered copy)`, folderId: null, binderId: null, documentId: null, lessonId: null };
  await savePersonalContent({ snapshot: copy, localRevision: 1, expectedRevision: 0, operationId: crypto.randomUUID() });
  return copy;
}
