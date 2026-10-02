// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseWhiteboardBackup } from "./whiteboard-import";
import { serializeWhiteboardBackup } from "./whiteboard-export";
import { archiveWhiteboard, createLocalWhiteboard, listArchivedWhiteboards, loadLocalWhiteboard, restoreArchivedWhiteboard, saveLocalWhiteboard } from "./whiteboard-storage";
import type { BinderWhiteboard } from "./whiteboard-types";

vi.mock("@/lib/supabase", () => ({ supabase: null }));
const scope = { ownerId: "owner", binderId: "binder", lessonId: "lesson" };
function mixedBoard(): BinderWhiteboard {
  const base = createLocalWhiteboard(scope, { title: "Exam revision" });
  return { ...base, scene: { elements: [{ id: "line", type: "line", x: -200, y: 450, width: 120, height: 20, points: [[0, 0], [120, 20]] }], files: { image: { id: "image", dataURL: "data:image/png;base64,AA==" } }, appState: { scrollX: -50, scrollY: 30, zoom: { value: 1.4 } } }, modules: [{
    id: "graph", type: "bindernotes-module", moduleId: "desmos-graph", graphInstanceId: "original-graph", savedGraphId: "saved-source", binderId: "linked-binder", lessonId: "linked-lesson",
    x: 70.25, y: -90.5, width: 700, height: 500, zIndex: 4, mode: "live", anchorMode: "board-fixed-size", createdAt: base.createdAt, updatedAt: base.updatedAt,
  }, { id: "note", type: "bindernotes-module", moduleId: "private-notes", noteTitle: "Proof", noteContent: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A useful observation" }] }] }, x: 20, y: 30, width: 400, height: 250, zIndex: 5, mode: "live", anchorMode: "board", createdAt: base.createdAt, updatedAt: base.updatedAt }] };
}

describe("whiteboard restore", () => {
  afterEach(() => localStorage.clear());
  it("round-trips drawings, images, notes, geometry, sources and independent graph state into a new board", () => {
    const source = mixedBoard();
    const graphState = { version: 1, graphMode: "2d", graphStatesByMode: { "2d": { expressions: { list: [{ latex: "y=x^2" }] } }, "3d": null }, currentGraphState: null, calculatorExpression: "2+2", savedGraphs: [], savedFunctions: [], history: [] };
    localStorage.setItem("binder-notes:math-lab:v3:owner:original-graph", JSON.stringify(graphState));
    const restored = parseWhiteboardBackup(serializeWhiteboardBackup(source), { ...scope, ownerId: "new-owner" });
    expect(restored.id).not.toBe(source.id);
    expect(restored.ownerId).toBe("new-owner");
    expect(restored.title).toBe("Exam revision (restored)");
    expect(restored.scene).toEqual(source.scene);
    expect(restored.modules[0]).toMatchObject({ x: 70.25, y: -90.5, width: 700, height: 500, anchorMode: "board-fixed-size", binderId: "linked-binder", lessonId: "linked-lesson", savedGraphId: "saved-source", graphWorkspace: graphState });
    expect(restored.modules[0].graphInstanceId).not.toBe("original-graph");
    expect(restored.modules[1].noteContent).toEqual(source.modules[1].noteContent);
    expect(restored.archivedAt).toBeNull();
    expect(restored.storageRevision).toBeUndefined();
  });

  it.each([
    ["not json", "valid JSON"],
    [JSON.stringify({ format: "bindernotes-whiteboard", version: 9 }), "version"],
    [JSON.stringify({ format: "foreign", version: 1 }), "BinderNotes"],
  ])("rejects invalid backup %s without writing anything", (text, message) => {
    expect(() => parseWhiteboardBackup(text, scope)).toThrow(message);
    expect(localStorage.length).toBe(0);
  });

  it("rejects damaged modules, duplicate IDs and non-finite numbers instead of normalizing away damage", () => {
    const backup = JSON.parse(serializeWhiteboardBackup(mixedBoard()));
    backup.board.modules[0].width = -2;
    expect(() => parseWhiteboardBackup(JSON.stringify(backup), scope)).toThrow("positive");
    backup.board.modules[0].width = 700;
    backup.board.modules[1].id = backup.board.modules[0].id;
    expect(() => parseWhiteboardBackup(JSON.stringify(backup), scope)).toThrow("duplicate");
    expect(() => parseWhiteboardBackup('{"value":1e999}', scope)).toThrow();
  });

  it("lists and restores an archived local board without losing its mixed contents", async () => {
    const original = saveLocalWhiteboard(mixedBoard());
    await archiveWhiteboard(scope, original.id);
    expect(loadLocalWhiteboard(scope, original.id)).toBeNull();
    const archive = await listArchivedWhiteboards(scope);
    expect(archive.boards).toHaveLength(1);
    const result = await restoreArchivedWhiteboard(scope, archive.boards[0]);
    expect(result.status).toBe("local-draft");
    expect(loadLocalWhiteboard(scope, original.id)?.modules).toEqual(original.modules);
    expect(loadLocalWhiteboard(scope, original.id)?.scene).toEqual(original.scene);
    expect((await listArchivedWhiteboards(scope)).boards).toHaveLength(0);
  });
});
