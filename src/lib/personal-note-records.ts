import { z } from "zod";
import { editorDocumentSchema, mathBlockSchema } from "@/lib/personal-content-contract";

const note = {
  id: z.string().min(1),
  owner_id: z.string().min(1),
  title: z.string(),
  content: editorDocumentSchema,
  math_blocks: mathBlockSchema.array(),
  pinned: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  revision: z.number().int().nonnegative().default(0),
};
export const learnerNoteRecordSchema = z.object({
  ...note,
  binder_id: z.string().min(1),
  lesson_id: z.string().min(1),
  folder_id: z.string().nullable(),
});
export const personalNoteRecordSchema = z.object({
  ...note,
  folder_id: z.string().nullable(),
  binder_id: z.string().nullable(),
  document_id: z.string().nullable(),
  tags: z.string().array(),
  archived_at: z.string().nullable(),
});
export const personalDocumentRecordSchema = z.object({
  ...note,
  binder_id: z.string().min(1),
  tags: z.string().array(),
  archived_at: z.string().nullable(),
});
