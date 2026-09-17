import { portableArchiveSchema, type PortableArchive } from "@/lib/portable-archive";
const owner = "10000000-0000-4000-8000-000000000001";
const timestamp = "2026-09-17T00:00:00.000Z";
export function archiveFixture(): PortableArchive {
  const metadata = { owner_id: owner, created_at: timestamp, updated_at: timestamp };
  const folder = "20000000-0000-4000-8000-000000000001", binder = "20000000-0000-4000-8000-000000000002", note = "20000000-0000-4000-8000-000000000003";
  const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Exact prose and λ remain unchanged" }, { type: "sourceMarker", attrs: { binderId: "source", lessonId: "lesson", sourceUrl: "/binders/source/documents/lesson" } }] }] };
  return portableArchiveSchema.parse({ format: "bindernotes-archive", version: 1, ownerId: owner, exportedAt: timestamp, tables: {
    personal_note_folders: [{ ...metadata, id: folder, name: "Folder", color: "teal", sort_order: 0, archived_at: null }],
    personal_note_binders: [{ ...metadata, id: binder, folder_id: folder, title: "Notebook", description: null, color: null, pinned: false, sort_order: 0, archived_at: null }],
    personal_note_documents: [], personal_notes: [{ ...metadata, id: note, title: "My note", content, math_blocks: [{ id: "equation", type: "latex", latex: "x^2 + λ = 1" }], tags: ["exam"], pinned: true, folder_id: folder, binder_id: binder, document_id: null, archived_at: null, revision: 9 }],
    folders: [], folder_binders: [], learner_notes: [], comments: [], highlights: [], whiteboards: [], whiteboard_versions: [],
    binders: [{ ...metadata, id: "source", title: "Published source", slug: "source", description: "Source", subject: "Math", level: "Algebra", status: "published", price_cents: 1000, cover_url: null, pinned: false }],
    binder_lessons: [{ id: "lesson", binder_id: "source", title: "Source lesson", order_index: 0, content, math_blocks: [], is_preview: false, created_at: timestamp, updated_at: timestamp }],
  }, reviews: [], reviewEvents: [], recallSessions: [], assets: [], localMath: { schemaVersion: 1, ownerId: owner, problemLogs: [], formulaCards: [], graphLinks: [] }, deviceRecovery: [], sourceProvenance: [{ binderId: "source", sourceBinderId: "source", sourceOwnerId: owner, sourceSlug: "source", sourceStatus: "published" }] });
}
