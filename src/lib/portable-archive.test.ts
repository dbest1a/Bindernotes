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
