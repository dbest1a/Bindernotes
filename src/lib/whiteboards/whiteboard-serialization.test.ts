import { describe, expect, it } from "vitest";
import {
  hasPersistentWhiteboardSceneChange,
  sanitizeWhiteboardModuleElement,
} from "@/lib/whiteboards/whiteboard-serialization";
import type { WhiteboardModuleElement, WhiteboardSceneData } from "@/lib/whiteboards/whiteboard-types";

function moduleElement(overrides: Partial<WhiteboardModuleElement> = {}): WhiteboardModuleElement {
  return {
    id: "module-1",
    type: "bindernotes-module",
    moduleId: "desmos-graph",
    binderId: "binder-rise-of-rome",
    lessonId: "lesson-punic-wars",
    x: 410.75,
    y: -123.5,
    width: 720.25,
    height: 560.5,
    zIndex: 3,
    mode: "live",
    pinned: true,
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    ...overrides,
  };
}

function scene(appState: Record<string, unknown>): WhiteboardSceneData {
  return {
    elements: [{ id: "shape-1", type: "rectangle" }],
    appState,
    files: {},
  };
}

describe("whiteboard serialization", () => {
  it("preserves finite module geometry exactly during storage sanitization", () => {
    expect(sanitizeWhiteboardModuleElement(moduleElement())).toMatchObject({
      x: 410.75,
      y: -123.5,
      width: 720.25,
      height: 560.5,
      zIndex: 3,
      pinned: true,
    });
  });

  it("defaults legacy module records to pinned without changing valid geometry", () => {
    const sanitized = sanitizeWhiteboardModuleElement(moduleElement({ moduleId: "lesson", pinned: undefined }));
    expect(sanitized.pinned).toBe(true);
    expect(sanitized.anchorMode).toBe("board-fixed-size");
    expect(sanitized.x).toBe(410.75);
    expect(sanitized.y).toBe(-123.5);
  });

  it("ignores viewport-only appState changes when deciding whether to autosave scene content", () => {
    expect(
      hasPersistentWhiteboardSceneChange(
        scene({ scrollX: 0, scrollY: 0, zoom: 1, viewBackgroundColor: "#10131a" }),
        scene({ scrollX: 120, scrollY: -80, zoom: { value: 2 }, viewBackgroundColor: "#10131a" }),
      ),
    ).toBe(false);
  });

  it("detects actual scene-content changes instead of suppressing them as viewport noise", () => {
    expect(
      hasPersistentWhiteboardSceneChange(
        scene({ scrollX: 0, scrollY: 0, zoom: 1, viewBackgroundColor: "#10131a" }),
        {
          elements: [{ id: "shape-2", type: "ellipse" }],
          appState: { scrollX: 0, scrollY: 0, zoom: 1, viewBackgroundColor: "#10131a" },
          files: {},
        },
      ),
    ).toBe(true);
  });
});
