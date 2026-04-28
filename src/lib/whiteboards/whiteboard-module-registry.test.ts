import { describe, expect, it } from "vitest";
import {
  getEmbeddableWhiteboardModules,
  getWhiteboardModuleDefinition,
  shouldRenderWhiteboardModuleLive,
} from "@/lib/whiteboards/whiteboard-module-registry";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

function element(moduleId: WhiteboardModuleElement["moduleId"], mode: WhiteboardModuleElement["mode"]): WhiteboardModuleElement {
  return {
    id: `${moduleId}-${mode}`,
    type: "bindernotes-module",
    moduleId,
    x: 0,
    y: 0,
    width: 640,
    height: 420,
    zIndex: 1,
    mode,
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
  };
}

describe("whiteboard module registry", () => {
  it("offers safe BinderNotes modules for the first math whiteboard pass", () => {
    expect(getEmbeddableWhiteboardModules().map((module) => module.moduleId)).toEqual(
      expect.arrayContaining([
        "lesson",
        "private-notes",
        "formula-sheet",
        "math-blocks",
        "desmos-graph",
        "scientific-calculator",
        "related-concepts",
      ]),
    );
  });

  it("does not allow recursive whiteboard embedding", () => {
    expect(getWhiteboardModuleDefinition("whiteboard")).toBeNull();
  });

  it("keeps always-live tools mounted unless collapsed while regular modules still honor visibility", () => {
    expect(shouldRenderWhiteboardModuleLive(element("desmos-graph", "preview"), { visible: true })).toBe(true);
    expect(shouldRenderWhiteboardModuleLive(element("scientific-calculator", "preview"), { visible: false })).toBe(true);
    expect(shouldRenderWhiteboardModuleLive(element("scientific-calculator", "collapsed"), { visible: true })).toBe(false);
    expect(shouldRenderWhiteboardModuleLive(element("saved-graphs", "live"), { visible: false })).toBe(false);
    expect(shouldRenderWhiteboardModuleLive(element("saved-graphs", "preview"), { visible: true })).toBe(false);
    expect(shouldRenderWhiteboardModuleLive(element("desmos-graph", "live"), { visible: true })).toBe(true);
  });
});
