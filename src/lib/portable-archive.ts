import { z } from "zod";
import { editorDocumentSchema, mathBlockSchema } from "@/lib/personal-content-contract";
import { canonicalReviewSchema, recallCanonicalId, recallSessionSchema, studyReviewEventSchema } from "@/lib/canonical-review";
import { mathLocalArchiveSchema } from "@/services/math-local-portability";
import { extractPlainText } from "@/lib/workspace-records";

export const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const id = z.string().min(1).max(200), uuid = z.string().uuid(), text = z.string().max(100000);
const time = z.string().datetime({ offset: true });
const dates = { created_at: time, updated_at: time };
const owner = { id, owner_id: uuid, ...dates };
const archiveMathBlockSchema = z.discriminatedUnion("type", [mathBlockSchema.options[0].strict(), mathBlockSchema.options[1].strict()]);
const content = { title: z.string().max(1000), content: editorDocumentSchema, math_blocks: archiveMathBlockSchema.array().max(10000), pinned: z.boolean() };
const tags = z.array(z.string().max(200)).max(100), order = z.number().int().nullable();
function safeJson(value: unknown): boolean {
  const pending: Array<[unknown, number]> = [[value, 0]]; let nodes = 0;
  while (pending.length) {
    const [item, depth] = pending.pop()!;
    if (++nodes > 1_000_000 || depth > 50) return false;
    if (item === null || typeof item === "boolean" || typeof item === "string") continue;
    if (typeof item === "number") { if (!Number.isFinite(item)) return false; continue; }
    if (!item || typeof item !== "object") return false;
    for (const [key, child] of Object.entries(item)) {
      if (["__proto__", "prototype", "constructor", "innerHTML", "outerHTML", "srcdoc"].includes(key)) return false;
      pending.push([child, depth + 1]);
    }
  }
  return true;
}
const json = z.unknown().refine(safeJson, "Unsafe or excessively nested data");
export const archiveRowSchemas = {
  personal_note_folders: z.object({ ...owner, id: uuid, name: text, color: text, sort_order: order, archived_at: time.nullable() }).strict(),
  personal_note_binders: z.object({ ...owner, id: uuid, folder_id: uuid.nullable(), title: text, description: text.nullable(), color: text.nullable(), pinned: z.boolean(), sort_order: order, archived_at: time.nullable() }).strict(),
  personal_note_documents: z.object({ ...owner, id: uuid, binder_id: uuid, ...content, tags, archived_at: time.nullable(), revision: z.number().int().nonnegative() }).strict(),
  personal_notes: z.object({ ...owner, id: uuid, folder_id: uuid.nullable(), binder_id: uuid.nullable(), document_id: uuid.nullable(), ...content, tags, archived_at: time.nullable(), revision: z.number().int().nonnegative() }).strict(),
  folders: z.object({ ...owner, name: text, color: text, sort_order: order }).strict(),
  binders: z.object({ ...owner, title: text, slug: text, description: text, subject: text, level: text, status: z.enum(["draft", "published", "archived"]), price_cents: z.number().int().nonnegative(), cover_url: text.nullable(), pinned: z.boolean() }).strict(),
  binder_lessons: z.object({ id, binder_id: id, title: text, order_index: z.number().int(), content: editorDocumentSchema, math_blocks: archiveMathBlockSchema.array().max(10000), is_preview: z.boolean(), ...dates }).strict(),
  folder_binders: z.object({ ...owner, folder_id: id, binder_id: id, sort_order: order }).strict(),
  learner_notes: z.object({ ...owner, binder_id: id, lesson_id: id, folder_id: id.nullable(), ...content, revision: z.number().int().nonnegative() }).strict(),
  comments: z.object({ ...owner, binder_id: id, lesson_id: id, anchor_text: text.nullable(), body: text, parent_id: id.nullable(), resolved_at: time.nullable() }).strict(),
  highlights: z.object({ ...owner, binder_id: id, lesson_id: id, anchor_text: text, color: z.enum(["yellow", "blue", "green", "pink", "orange"]), note_id: id.nullable(), start_offset: z.number().int().nonnegative().nullable(), end_offset: z.number().int().nonnegative().nullable(), document_id: id.nullable(), source_version_id: id.nullable(), selected_text: text.nullable(), prefix_text: text.nullable(), suffix_text: text.nullable(), selector_json: json.nullable(), status: z.enum(["active", "needs_review", "deleted"]), reanchor_confidence: z.number().min(0).max(1).nullable() }).strict(),
  whiteboards: z.object({ ...owner, binder_id: id.nullable(), lesson_id: id.nullable(), title: text, subject: text, module_context: z.enum(["binder", "lesson", "math-lab"]), scene_json: json, module_elements: json, scene_size_bytes: z.number().int().nonnegative(), asset_size_bytes: z.number().int().nonnegative(), object_count: z.number().int().nonnegative(), archived_at: time.nullable(), revision: z.number().int().nonnegative() }).strict(),
  whiteboard_versions: z.object({ id, whiteboard_id: id, version: z.number().int().positive(), scene_json: json, module_elements: json, scene_size_bytes: z.number().int().nonnegative(), created_at: time, created_by: uuid.nullable(), version_kind: z.enum(["auto", "draft", "manual", "checkpoint", "snapshot"]) }).strict(),
};
export type ArchiveTable = keyof typeof archiveRowSchemas;
export const archiveTables = Object.keys(archiveRowSchemas) as ArchiveTable[];
export const archiveSelect = (table: ArchiveTable) => Object.keys(archiveRowSchemas[table].shape).join(",");
const tableShape = {
  personal_note_folders: archiveRowSchemas.personal_note_folders.array().max(10000),
  personal_note_binders: archiveRowSchemas.personal_note_binders.array().max(10000),
  personal_note_documents: archiveRowSchemas.personal_note_documents.array().max(10000),
  personal_notes: archiveRowSchemas.personal_notes.array().max(10000), folders: archiveRowSchemas.folders.array().max(10000),
  binders: archiveRowSchemas.binders.array().max(10000), binder_lessons: archiveRowSchemas.binder_lessons.array().max(10000),
  folder_binders: archiveRowSchemas.folder_binders.array().max(10000), learner_notes: archiveRowSchemas.learner_notes.array().max(10000),
  comments: archiveRowSchemas.comments.array().max(10000), highlights: archiveRowSchemas.highlights.array().max(10000),
  whiteboards: archiveRowSchemas.whiteboards.array().max(1000), whiteboard_versions: archiveRowSchemas.whiteboard_versions.array().max(10000),
};
export const archiveTablesSchema = z.object(tableShape).strict();
export const archiveSourceProvenanceSchema = z.array(z.object({ binderId: id, sourceBinderId: id, sourceOwnerId: uuid, sourceSlug: text, sourceStatus: z.enum(["draft", "published", "archived"]) }).strict()).max(10000);
export const archiveAssetSchema = z.object({ id: uuid, name: z.string().min(1).max(200), mime_type: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]), size_bytes: z.number().int().min(1).max(50 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/), base64: z.string().max(70 * 1024 * 1024).regex(/^[A-Za-z0-9+/]*={0,2}$/) }).strict();
export const portableArchiveSchema = z.object({
  format: z.literal("bindernotes-archive"), version: z.literal(1), ownerId: uuid, exportedAt: time,
  tables: archiveTablesSchema, reviews: canonicalReviewSchema.array().max(10000),
  reviewEvents: studyReviewEventSchema.array().max(100000), recallSessions: recallSessionSchema.array().max(10000),
  assets: archiveAssetSchema.array().max(1000), localMath: mathLocalArchiveSchema,
  sourceProvenance: archiveSourceProvenanceSchema,
  deviceRecovery: z.array(z.object({ kind: z.string().max(100), data: json }).strict()).max(10000),
}).strict().superRefine((archive, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  for (const table of archiveTables) {
    const rows = archive.tables[table]; const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.id)) issue(`Duplicate ${table} identity`);
      seen.add(row.id);
      if (table !== "binders" && "owner_id" in row && row.owner_id !== archive.ownerId) issue(`Wrong ${table} owner`);
    }
  }
  const has = (table: ArchiveTable, value: string | null) => value === null || archive.tables[table].some((row) => row.id === value);
  for (const row of archive.tables.personal_note_binders) if (!has("personal_note_folders", row.folder_id)) issue("Missing notebook folder");
  for (const row of archive.tables.personal_note_documents) if (!has("personal_note_binders", row.binder_id)) issue("Missing document notebook");
  for (const row of archive.tables.personal_notes) if (!has("personal_note_folders", row.folder_id) || !has("personal_note_binders", row.binder_id) || !has("personal_note_documents", row.document_id)) issue("Missing note parent");
  for (const row of archive.tables.binder_lessons) if (!has("binders", row.binder_id)) issue("Missing lesson source");
  for (const row of archive.tables.folder_binders) if (!has("binders", row.binder_id) || !has("folders", row.folder_id)) issue("Missing folder link source");
  for (const row of archive.tables.learner_notes) if (!has("folders", row.folder_id) || !archive.tables.binder_lessons.some((lesson) => lesson.id === row.lesson_id && lesson.binder_id === row.binder_id)) issue("Missing linked-note source");
  for (const row of [...archive.tables.comments, ...archive.tables.highlights]) {
    if (!archive.tables.binder_lessons.some((lesson) => lesson.id === row.lesson_id && lesson.binder_id === row.binder_id)) issue("Missing annotation source");
  }
  for (const row of archive.tables.comments) {
    if (row.parent_id && !archive.tables.comments.some((parent) => parent.id === row.parent_id && parent.lesson_id === row.lesson_id && parent.binder_id === row.binder_id)) issue("Missing comment parent");
  }
  for (const row of archive.tables.highlights) {
    if (!has("learner_notes", row.note_id) || !has("binder_lessons", row.document_id)) issue("Missing highlight source");
    if (row.start_offset !== null && row.end_offset !== null && row.start_offset > row.end_offset) issue("Invalid highlight offsets");
  }
  for (const row of archive.tables.whiteboards) {
    if (!has("binders", row.binder_id) || !has("binder_lessons", row.lesson_id)) issue("Missing whiteboard source");
    if (!row.scene_json || typeof row.scene_json !== "object" || !("elements" in row.scene_json) || !Array.isArray(row.scene_json.elements) || !Array.isArray(row.module_elements)) issue("Invalid whiteboard scene");
  }
  for (const row of archive.tables.whiteboard_versions) if (!has("whiteboards", row.whiteboard_id)) issue("Missing version whiteboard");
  const reviews = new Set<string>();
  for (const record of archive.reviews) { if (record.item.owner_id !== archive.ownerId || reviews.has(record.item.id)) issue("Review owner or duplicate identity mismatch"); reviews.add(record.item.id); }
  for (const event of archive.reviewEvents) if (event.owner_id !== archive.ownerId || !reviews.has(event.item_id)) issue("Missing review history owner or item");
  for (const session of archive.recallSessions) if (session.scope.userId !== archive.ownerId) issue("Recall session owner mismatch");
  if (archive.localMath.ownerId !== archive.ownerId) issue("Math archive owner mismatch");
});
export type PortableArchive = z.infer<typeof portableArchiveSchema>;

export function parsePortableArchive(raw: string): PortableArchive {
  if (new TextEncoder().encode(raw).byteLength > MAX_ARCHIVE_BYTES) throw new Error("Archive exceeds the 100 MiB limit.");
  const value: unknown = JSON.parse(raw);
  if (!safeJson(value)) throw new Error("Unsafe or excessively nested archive.");
  return portableArchiveSchema.parse(value);
}

/** Remap only identities and links; prose and equation strings remain verbatim. */
export function remapPortableArchive(archive: PortableArchive, ownerId: string, newId: () => string = () => crypto.randomUUID()) {
  portableArchiveSchema.parse(archive); uuid.parse(ownerId);
  const ids = new Map<string, string>();
  const put = (id: string) => { if (!ids.has(id)) ids.set(id, newId()); return ids.get(id)!; };
  for (const table of archiveTables) archive.tables[table].forEach((row) => put(row.id));
  archive.assets.forEach((asset) => put(asset.id));
  archive.reviews.forEach((record) => { put(record.item.id); if (record.recall) put(record.recall.id); });
  archive.reviewEvents.forEach((event) => put(event.id)); archive.recallSessions.forEach((session) => put(session.id));
  for (const group of [archive.localMath.problemLogs, archive.localMath.formulaCards, archive.localMath.graphLinks]) group.forEach((row) => put(row.id));
  const reference = /^(id|.*_id|.*Id|.*_ids|.*Ids)$/;
  const remapInternalUrl = (value: string) => {
    const replace = (_match: string, prefix: string, encoded: string) => {
      try { return prefix + (ids.get(decodeURIComponent(encoded)) ?? encoded); } catch { return prefix + encoded; }
    };
    // Only route positions with a defined entity identity are portable. External
    // source URLs and unrelated path segments are original provenance.
    return value.replace(/^(\/(?:binders|folders)\/)([^/?#]+)/, replace)
      .replace(/^(\/binders\/[^/?#]+\/documents\/)([^/?#]+)/, replace)
      .replace(/^(\/notes\/(?:n|binders)\/)([^/?#]+)/, replace)
      .replace(/^(\/notes\/binders\/[^/?#]+\/documents\/)([^/?#]+)/, replace);
  };
  const rewrite = (value: unknown, key = ""): unknown => {
    if (key === "desmos_state" || key === "desmosState" || key === "scene_json") return structuredClone(value);
    if (typeof value === "string") {
      if (["owner_id", "ownerId", "userId", "created_by"].includes(key)) return ownerId;
      if (reference.test(key)) return ids.get(value) ?? value;
      if (key === "sourceUrl" || key === "href" || key === "src") return remapInternalUrl(value);
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => rewrite(item, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, rewrite(item, name)]));
    return value;
  };
  const result = rewrite(archive) as PortableArchive;
  result.ownerId = ownerId;
  result.sourceProvenance = archive.sourceProvenance.map((source) => ({ ...source, binderId: ids.get(source.binderId) ?? source.binderId }));
  result.tables.binders = result.tables.binders.map((binder) => ({ ...binder, owner_id: ownerId, slug: `imported-${binder.id}`, status: "draft", price_cents: 0 }));
  result.tables.whiteboard_versions = result.tables.whiteboard_versions.map((version) => ({ ...version, created_by: ownerId }));
  result.reviews.forEach((record, index) => {
    if (record.recall) { const temporary = record.item.id; record.item.id = recallCanonicalId(record.recall); ids.set(temporary, record.item.id); ids.set(archive.reviews[index].item.id, record.item.id); }
  });
  result.reviewEvents.forEach((event, index) => { event.item_id = ids.get(archive.reviewEvents[index].item_id)!; });
  const final = rewrite(result) as PortableArchive;
  final.sourceProvenance = result.sourceProvenance;
  return { archive: portableArchiveSchema.parse(final), ids };
}

export function readableArchive(archive: PortableArchive): string {
  const lines = ["# BinderNotes archive", "", `Exported: ${archive.exportedAt}`, "", "This readable companion includes notes, equations and review cards. The JSON archive also preserves scenes, relationships, history, device recovery data and supported file bytes.", ""];
  for (const table of ["personal_note_documents", "personal_notes", "learner_notes", "binder_lessons"] as const) {
    for (const note of archive.tables[table]) {
      lines.push(`## ${note.title}`, "", extractPlainText(note.content), "");
      for (const block of note.math_blocks) lines.push(block.type === "latex" ? `$$\n${block.latex}\n$$` : `Graph: ${block.expressions.join("; ")}`, "");
    }
  }
  for (const comment of archive.tables.comments) lines.push("## Comment", "", comment.body, "");
  for (const highlight of archive.tables.highlights) lines.push("## Highlight", "", highlight.selected_text ?? highlight.anchor_text, "");
  for (const review of archive.reviews) lines.push(`## Review: ${review.item.prompt}`, "", review.item.answer, "");
  return lines.join("\n");
}
