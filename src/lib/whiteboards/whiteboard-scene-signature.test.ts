import { describe, expect, it } from "vitest";
import { getWhiteboardSceneSignature } from "@/lib/whiteboards/whiteboard-scene-signature";

function element(id: string, version = 1, extra: Record<string, unknown> = {}) {
  return { id, type: "rectangle", x: 10, y: 20, width: 100, height: 50, version, versionNonce: version * 7919, isDeleted: false, ...extra };
}

function scene(elements: unknown[], appState: Record<string, unknown> = {}, files: Record<string, unknown> = {}) {
  return { elements, appState: { viewBackgroundColor: "#10131a", ...appState }, files };
}

describe("getWhiteboardSceneSignature", () => {
  it("is stable for an unchanged scene and ignores camera-only changes", () => {
    const elements = [element("a"), element("b")];
    const base = getWhiteboardSceneSignature(scene(elements, { scrollX: 0, scrollY: 0, zoom: { value: 1 } }));
    expect(getWhiteboardSceneSignature(scene(elements, { scrollX: 0, scrollY: 0, zoom: { value: 1 } }))).toBe(base);
    expect(getWhiteboardSceneSignature(scene(elements, { scrollX: 400, scrollY: -90, zoom: { value: 2.5 } }))).toBe(base);
  });

  it("detects an element edited in place, as Excalidraw does while dragging", () => {
    const moved = element("a");
    const live = scene([moved, element("b")]);
    const recorded = getWhiteboardSceneSignature(live);
    // Excalidraw's mutateElement changes the same object and replaces version and nonce.
    Object.assign(moved, { x: 300, version: 2, versionNonce: 123456 });
    expect(getWhiteboardSceneSignature(live)).not.toBe(recorded);
  });

  it("detects added, deleted and reordered elements", () => {
    const a = element("a");
    const b = element("b");
    const base = getWhiteboardSceneSignature(scene([a, b]));
    expect(getWhiteboardSceneSignature(scene([a, b, element("c")]))).not.toBe(base);
    expect(getWhiteboardSceneSignature(scene([a, { ...b, version: 2, versionNonce: 99, isDeleted: true }]))).not.toBe(base);
    expect(getWhiteboardSceneSignature(scene([b, a]))).not.toBe(base);
  });

  it("detects persistent appState and file changes", () => {
    const elements = [element("a")];
    const base = getWhiteboardSceneSignature(scene(elements));
    expect(getWhiteboardSceneSignature(scene(elements, { viewBackgroundColor: "#ffffff" }))).not.toBe(base);
    expect(getWhiteboardSceneSignature(scene(elements, { gridModeEnabled: true }))).not.toBe(base);
    expect(getWhiteboardSceneSignature(scene(elements, {}, { "file-1": { id: "file-1" } }))).not.toBe(base);
  });

  it("compares elements without version metadata by their full content", () => {
    const base = getWhiteboardSceneSignature(scene([{ id: "legacy", type: "text", text: "x = 1" }]));
    expect(getWhiteboardSceneSignature(scene([{ id: "legacy", type: "text", text: "x = 1" }]))).toBe(base);
    expect(getWhiteboardSceneSignature(scene([{ id: "legacy", type: "text", text: "x = 2" }]))).not.toBe(base);
  });

  it("handles empty and malformed scenes without throwing", () => {
    expect(getWhiteboardSceneSignature({ elements: [] })).toBe(getWhiteboardSceneSignature({ elements: [], appState: {}, files: {} }));
    expect(() => getWhiteboardSceneSignature({ elements: [null, 3, "x"] as unknown[] })).not.toThrow();
  });
});
