// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { composeWhiteboardSvg, getWhiteboardCanvasBackground, serializeWhiteboardBackup } from "@/lib/whiteboards/whiteboard-export";
import { fitAllWhiteboardContent, getDrawingFrames, searchWhiteboard } from "@/lib/whiteboards/whiteboard-navigation";
import { defaultWhiteboardViewportTransform, getWhiteboardModuleScreenRect } from "@/lib/whiteboards/whiteboard-coordinate-utils";
import type { BinderWhiteboard, WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

const module: WhiteboardModuleElement = { id: "note", type: "bindernotes-module", moduleId: "private-notes", noteTitle: "Pythagoras", noteContent: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Triangles have three sides." }] }] }, x: -400, y: 80, width: 380, height: 260, zIndex: 1, mode: "live", anchorMode: "board", createdAt: "2026-09-24", updatedAt: "2026-09-24" };
const board: BinderWhiteboard = { id: "board", ownerId: "private-owner", binderId: "math-lab", lessonId: null, title: "My board", subject: "Math", moduleContext: "math-lab", scene: { elements: [{ id: "label", type: "text", x: 900, y: 500, width: 200, height: 30, text: "Trigonometry" }], appState: { viewBackgroundColor: "#ffffff" }, files: {} }, modules: [module], objectCount: 2, sceneSizeBytes: 0, assetSizeBytes: 0, storageMode: "local-draft", createdAt: "2026-09-24", updatedAt: "2026-09-24", archivedAt: null };

describe("whole-whiteboard export and navigation", () => {
  it("includes module text and drawing content with valid escaped XML", () => {
    const hostile = { ...board, title: '<script>alert("x")</script>', modules: [{ ...module, title: "x < y & y > z" }] };
    const text = composeWhiteboardSvg(hostile, defaultWhiteboardViewportTransform, { svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Drawing label</text></svg>', frame: { x: 900, y: 500, width: 200, height: 30 } });
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.documentElement.textContent).toContain("Triangles have three sides.");
    expect(doc.documentElement.textContent).toContain("Drawing label");
    expect(doc.documentElement.textContent).toContain("x < y & y > z");
    expect(doc.documentElement.textContent).toContain("Live graphs and calculators are reference cards");
  });

  it("backs up stored scene, files, module content and references without assigning an owner", () => {
    const saved = JSON.parse(serializeWhiteboardBackup(board));
    expect(saved.format).toBe("bindernotes-whiteboard");
    expect(saved.version).toBe(1);
    expect(saved.board.ownerId).toBeUndefined();
    expect(saved.board.scene.elements).toEqual(board.scene.elements);
    expect(saved.board.modules[0].noteContent).toEqual(module.noteContent);
  });

  it("searches both embedded note/source text and canvas text and ignores deleted drawings", () => {
    const sourceBoard = { ...board, scene: { elements: [...board.scene.elements, { id: "gone", text: "Triangles", x: 1, y: 1, width: 1, height: 1, isDeleted: true }] } };
    expect(searchWhiteboard(sourceBoard, "triangles").map((r) => r.id)).toEqual(["note"]);
    expect(searchWhiteboard(sourceBoard, "trig").map((r) => r.id)).toEqual(["label"]);
    expect(searchWhiteboard(sourceBoard, "Euclidean", { note: "Euclidean geometry" }).map((r) => r.id)).toEqual(["note"]);
    expect(searchWhiteboard(sourceBoard, "")).toEqual([]);
  });

  it("fits negative-coordinate cards and distant drawings inside the viewport", () => {
    const viewport = fitAllWhiteboardContent(board, defaultWhiteboardViewportTransform);
    for (const frame of [...getDrawingFrames(board.scene.elements), module]) {
      const x = (frame.x + viewport.scrollX) * viewport.zoom, y = (frame.y + viewport.scrollY) * viewport.zoom;
      expect(x).toBeGreaterThanOrEqual(95);
      expect(y).toBeGreaterThanOrEqual(95);
      expect(x + frame.width * viewport.zoom).toBeLessThanOrEqual(viewport.viewportWidth - 95);
      expect(y + frame.height * viewport.zoom).toBeLessThanOrEqual(viewport.viewportHeight - 95);
    }
  });

  it("accounts for fixed-size cards when fitting", () => {
    const fixed = { ...module, anchorMode: "board-fixed-size" as const };
    const viewport = fitAllWhiteboardContent({ ...board, modules: [fixed] }, defaultWhiteboardViewportTransform);
    const rect = getWhiteboardModuleScreenRect(fixed, viewport);
    expect(rect.x).toBeGreaterThanOrEqual(95);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.viewportWidth - 95);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.viewportHeight - 95);
  });

  it("fits a desktop-sized reference card on mobile without rewriting its stored geometry", () => {
    const fixed = Object.freeze({ ...module, width: 670, height: 900, anchorMode: "board-fixed-size" as const });
    const viewport = fitAllWhiteboardContent({ scene: { elements: [] }, modules: [fixed] }, { ...defaultWhiteboardViewportTransform, viewportWidth: 390, viewportHeight: 844 });
    const rect = getWhiteboardModuleScreenRect(fixed, viewport);
    expect(rect.width).toBe(358);
    expect(rect.height).toBe(684);
    expect(rect.x).toBeGreaterThanOrEqual(15);
    expect(rect.x + rect.width).toBeLessThanOrEqual(375);
    expect(rect.y).toBeGreaterThanOrEqual(70);
    expect(fixed).toMatchObject({ x: module.x, y: module.y, width: 670, height: 900 });
    expect(getWhiteboardModuleScreenRect(fixed, defaultWhiteboardViewportTransform).width).toBe(670);
  });

  it("repairs the historical logical dark default without changing chosen backgrounds", () => {
    expect(getWhiteboardCanvasBackground({ viewBackgroundColor: "#11131a" })).toBe("#ffffff");
    expect(getWhiteboardCanvasBackground()).toBe("#ffffff");
    expect(getWhiteboardCanvasBackground({ viewBackgroundColor: "#fff4dc" })).toBe("#fff4dc");
  });
});
