import { archiveFixture } from "@/test-utils/portable-archive-fixture";
import { describe, expect, it } from "vitest";
import { canonicalFromRecall } from "./canonical-review";
import { parsePortableArchive, portableArchiveSchema, readableArchive, remapPortableArchive } from "./portable-archive";
const owner = "10000000-0000-4000-8000-000000000001", target = "10000000-0000-4000-8000-000000000002";
const timestamp = "2026-09-17T00:00:00.000Z";
describe("portable archive contract", () => {
  it("round trips exact documents, equations, tags, hierarchy and readable text", () => {
    const original = archiveFixture(); const parsed = parsePortableArchive(JSON.stringify(original));
    expect(parsed).toEqual(original);
    expect(readableArchive(parsed)).toContain("Exact prose and λ remain unchanged");
    expect(readableArchive(parsed)).toContain("x^2 + λ = 1");
    const { archive, ids } = remapPortableArchive(parsed, target);
    const note = archive.tables.personal_notes[0];
    expect(note.owner_id).toBe(target); expect(note.id).not.toBe(original.tables.personal_notes[0].id);
    expect(note.binder_id).toBe(archive.tables.personal_note_binders[0].id);
    expect(note.folder_id).toBe(archive.tables.personal_note_folders[0].id);
    expect(note.math_blocks).toEqual(original.tables.personal_notes[0].math_blocks);
    expect(JSON.stringify(note.content)).toContain(`/binders/${ids.get("source")}/documents/${ids.get("lesson")}`);
    expect(archive.tables.binders[0]).toMatchObject({ owner_id: target, status: "draft", price_cents: 0 });
    expect(archive.sourceProvenance[0]).toMatchObject({ sourceOwnerId: owner, sourceBinderId: "source", sourceStatus: "published" });
    expect(original.tables.binders[0].status).toBe("published");
  });
  it("recomputes Recall canonical identity and remaps its complete history", () => {
    const archive = archiveFixture();
    const record = canonicalFromRecall({ id: "card", userId: owner, binderId: "source", documentId: "lesson", lessonId: "lesson", sourceType: "note", sourceId: archive.tables.personal_notes[0].id, front: "Question", back: "Answer", tags: [], cardType: "basic_qa", status: "Learning", difficulty: "good", confidence: 0.5, reviewCount: 3, lapseCount: 1, createdVia: "note", draftStatus: "accepted", createdAt: timestamp, updatedAt: timestamp });
    archive.reviews.push(record); archive.reviewEvents.push({ id: "event", owner_id: owner, item_id: record.item.id, rating: "good", reviewed_at: timestamp, due_at_before: timestamp, due_at_after: timestamp, response_length: 3 });
    archive.recallSessions.push({ id: "session", scope: { userId: owner, binderId: "source", documentId: "lesson", lessonId: "lesson" }, mode: "Flip", cardIds: ["card"], correct: 1, missed: 0, score: 100, missedConcepts: [], createdAt: timestamp });
    const result = remapPortableArchive(archive, target).archive;
    expect(result.reviewEvents[0].item_id).toBe(result.reviews[0].item.id);
    expect(result.reviews[0].item.id).toContain(result.tables.binder_lessons[0].id);
    expect(result.recallSessions[0].cardIds[0]).toBe(result.reviews[0].recall!.id);
    expect(result.reviews[0].recall).toMatchObject({ userId: target, reviewCount: 3, lapseCount: 1, confidence: 0.5 });
  });
  it("preserves external source URLs and remaps only known application route identities", () => {
    const original = archiveFixture();
    original.tables.personal_notes[0].content = { type: "doc", content: [
      { type: "paragraph", attrs: { sourceUrl: "https://example.test/lesson", href: "/external/lesson", src: "//example.test/source" } },
      { type: "paragraph", attrs: { sourceUrl: "/binders/source/documents/lesson#reading", href: `/notes/n/${original.tables.personal_notes[0].id}?mode=read` } },
    ] };
    const { archive, ids } = remapPortableArchive(original, target);
    expect(archive.tables.personal_notes[0].content.content?.[0].attrs).toEqual(original.tables.personal_notes[0].content.content?.[0].attrs);
    expect(archive.tables.personal_notes[0].content.content?.[1].attrs).toEqual({ sourceUrl: `/binders/${ids.get("source")}/documents/${ids.get("lesson")}#reading`, href: `/notes/n/${ids.get(original.tables.personal_notes[0].id)}?mode=read` });
  });
  it("keeps opaque calculator and canvas identities even when they collide with archive entities", () => {
    const original = archiveFixture();
    original.localMath.graphLinks.push({ id: "graph-link", owner_id: owner, created_at: timestamp, updated_at: timestamp,
      graph_state_id: "historical-state", title: "Graph", mode: "2d", desmos_state: { expressions: { list: [{ id: "source", latex: "x^2" }] } },
      expressions: [{ id: "expression", latex: "x^2" }], reflection: "Keep exact calculator state", problem_log_id: null, formula_card_id: null,
      note_id: original.tables.personal_notes[0].id });
    original.tables.whiteboards.push({ id: "board", owner_id: owner, created_at: timestamp, updated_at: timestamp,
      binder_id: "source", lesson_id: "lesson", title: "Canvas", subject: "Math", module_context: "lesson", scene_json: { elements: [{ id: "source", type: "rectangle" }] },
      module_elements: [], scene_size_bytes: 50, asset_size_bytes: 0, object_count: 1, archived_at: null, revision: 4 });
    const { archive, ids } = remapPortableArchive(original, target);
    expect(archive.localMath.graphLinks[0].desmos_state).toEqual(original.localMath.graphLinks[0].desmos_state);
    expect(archive.tables.whiteboards[0].scene_json).toEqual(original.tables.whiteboards[0].scene_json);
    expect(archive.localMath.graphLinks[0]).toMatchObject({ owner_id: target, note_id: ids.get(original.tables.personal_notes[0].id) });
    expect(archive.tables.whiteboards[0].binder_id).toBe(ids.get("source"));
  });
  it("keeps annotation identities, threaded parents and selectors when moving owners", () => {
    const original = archiveFixture();
    const base = { owner_id: owner, binder_id: "source", lesson_id: "lesson", created_at: timestamp, updated_at: timestamp };
    original.tables.comments = [{ ...base, id: "child", body: "Comment prose", anchor_text: null, parent_id: "parent", resolved_at: null }, { ...base, id: "parent", body: "Parent", anchor_text: "Exact quote", parent_id: null, resolved_at: null }];
    original.tables.highlights = [{ ...base, id: "highlight", anchor_text: "Exact quote", color: "yellow", note_id: null, start_offset: 0, end_offset: 11, document_id: "lesson", source_version_id: "historical", selected_text: "Exact quote", prefix_text: null, suffix_text: null, selector_json: { lessonId: "lesson", exact: "Exact quote" }, status: "active", reanchor_confidence: 1 }];
    const { archive, ids } = remapPortableArchive(original, target);
    expect(archive.tables.comments[0]).toMatchObject({ owner_id: target, parent_id: ids.get("parent"), body: "Comment prose" });
    expect(archive.tables.highlights[0]).toMatchObject({ document_id: ids.get("lesson"), selector_json: { lessonId: ids.get("lesson"), exact: "Exact quote" }, source_version_id: "historical" });
    original.tables.comments[0].parent_id = "missing";
    expect(() => portableArchiveSchema.parse(original)).toThrow("comment parent");
  });
  it("rejects unsupported versions, unknown fields, forged ownership and missing parents", () => {
    const archive = archiveFixture();
    expect(() => parsePortableArchive(JSON.stringify({ ...archive, version: 2 }))).toThrow();
    expect(() => parsePortableArchive(JSON.stringify({ ...archive, unexpected: true }))).toThrow();
    const wrongOwner = structuredClone(archive); wrongOwner.tables.personal_notes[0].owner_id = target;
    expect(() => portableArchiveSchema.parse(wrongOwner)).toThrow("owner");
    const missing = structuredClone(archive); missing.tables.personal_note_binders = [];
    expect(() => portableArchiveSchema.parse(missing)).toThrow("parent");
    expect(() => parsePortableArchive(JSON.stringify(archive).replace('"type":"doc"', '"type":"doc","__proto__":{"polluted":true}'))).toThrow("Unsafe");
    const unsafe = structuredClone(archive); unsafe.tables.personal_notes[0].content = { type: "doc", content: [{ type: "image", attrs: { src: "javascript:alert(1)" } }] };
    expect(() => portableArchiveSchema.parse(unsafe)).toThrow();
  });
});
