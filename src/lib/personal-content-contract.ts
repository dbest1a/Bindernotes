import { z } from "zod";
import type { JSONContent } from "@tiptap/react";
import type { PersonalNotesEntry } from "@/types";

function validEditorDocument(value: unknown): value is JSONContent {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("type" in value) ||
    value.type !== "doc"
  )
    return false;
  const pending: unknown[] = [value];
  let count = 0;
  while (pending.length) {
    if (++count > 100_000) return false;
    const item = pending.pop();
    if (item === null || typeof item === "string" || typeof item === "boolean") continue;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) return false;
      continue;
    }
    if (Array.isArray(item)) {
      pending.push(...item);
      continue;
    }
    if (typeof item !== "object" || !item) return false;
    for (const [key, field] of Object.entries(item)) {
      if (
        ["__proto__", "constructor", "prototype", "innerHTML", "outerHTML", "srcdoc"].includes(key) ||
        /^on[a-z]/i.test(key)
      )
        return false;
      if (["href", "src", "url"].includes(key.toLowerCase()) && typeof field === "string") {
        const url = Array.from(field.trim())
          .filter((character) => character.charCodeAt(0) > 32)
          .join("");
        if (/^(?:javascript|vbscript|data):/i.test(url)) return false;
      }
      pending.push(field);
    }
  }
  return true;
}

export const editorDocumentSchema = z.custom<JSONContent>(
  validEditorDocument,
  "Invalid or unsafe editor document",
);
const mathMetadata = {
  id: z.string(),
  label: z.string().optional(),
  description: z.string().nullable().optional(),
  sourceHeading: z.string().nullable().optional(),
  sourceAnchorId: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
};
export const mathBlockSchema = z.discriminatedUnion("type", [
  z.object({ ...mathMetadata, type: z.literal("latex"), latex: z.string() }),
  z.object({
    ...mathMetadata,
    type: z.literal("graph"),
    expressions: z.array(z.string()),
    xMin: z.number().finite(),
    xMax: z.number().finite(),
    yMin: z.number().finite(),
    yMax: z.number().finite(),
    graphMode: z.enum(["2d", "3d"]).optional(),
  }),
]);
export const personalContentSchema = z.object({
  kind: z.enum(["note", "document", "learner-note"]),
  id: z.string().min(1),
  ownerId: z.string().min(1),
  title: z.string().max(1000),
  content: editorDocumentSchema,
  mathBlocks: z.array(mathBlockSchema),
  tagsInput: z.string(),
  tags: z.array(z.string().max(200)).max(100),
  pinned: z.boolean(),
  folderId: z.string().nullable(),
  binderId: z.string().nullable(),
  documentId: z.string().nullable(),
  lessonId: z.string().nullable(),
});
export type PersonalContentSnapshot = z.infer<typeof personalContentSchema>;

export function personalContentFromEntry(
  entry: PersonalNotesEntry,
  ownerId: string,
): PersonalContentSnapshot {
  const note = entry.note;
  if (note.owner_id !== ownerId) throw new Error("This note belongs to a different account.");
  return personalContentSchema.parse({
    kind:
      entry.kind === "binder-note"
        ? "learner-note"
        : entry.kind === "personal-document"
          ? "document"
          : "note",
    id: entry.id,
    ownerId,
    title: entry.title,
    content: entry.content,
    mathBlocks: note.math_blocks,
    tagsInput: entry.tags.join(", "),
    tags: entry.tags,
    pinned: entry.pinned,
    folderId: "folder_id" in note ? note.folder_id : null,
    binderId: note.binder_id,
    documentId: "document_id" in note ? note.document_id : null,
    lessonId: "lesson_id" in note ? note.lesson_id : null,
  });
}

export function contentRevision(value: object) {
  if (!("revision" in value)) return 0; // historical rows start at zero in migration 0027
  return z.number().int().nonnegative().parse(value.revision);
}
