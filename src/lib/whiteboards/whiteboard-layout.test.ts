import { describe, expect, it } from "vitest";
import {
  findOpenWhiteboardModuleFrame,
  findOpenWhiteboardModuleFrameNearViewport,
  normalizeWhiteboardLabModules,
} from "@/lib/whiteboards/whiteboard-layout";
import type { WhiteboardModuleDefinition } from "@/lib/whiteboards/whiteboard-module-registry";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

const lessonDefinition: WhiteboardModuleDefinition = {
  moduleId: "lesson",
  label: "Source Lesson",
  description: "Lesson",
  heavy: false,
  defaultWidth: 560,
  defaultHeight: 420,
  defaultAnchorMode: "board-fixed-size",
};

const desmosDefinition: WhiteboardModuleDefinition = {
  moduleId: "desmos-graph",
  label: "Desmos Graph",
  description: "Graph",
  heavy: true,
  defaultWidth: 720,
  defaultHeight: 560,
  defaultAnchorMode: "board-fixed-size",
};

function moduleElement(overrides: Partial<WhiteboardModuleElement>): WhiteboardModuleElement {
  return {
    id: overrides.id ?? "module-1",
    type: "bindernotes-module",
    moduleId: overrides.moduleId ?? "lesson",
    x: overrides.x ?? 96,
    y: overrides.y ?? 128,
    width: overrides.width ?? 560,
    height: overrides.height ?? 420,
    zIndex: overrides.zIndex ?? 1,
    mode: overrides.mode ?? "live",
    anchorMode: "anchorMode" in overrides ? overrides.anchorMode : undefined,
    pinned: "pinned" in overrides ? overrides.pinned : true,
    title: overrides.title,
    createdAt: overrides.createdAt ?? "2026-04-26T12:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-26T12:00:00.000Z",
  };
}

describe("whiteboard module layout", () => {
  it("places a new module in a non-overlapping visible slot", () => {
    const frame = findOpenWhiteboardModuleFrame(
      [
        moduleElement({ id: "lesson", x: 96, y: 128, width: 560, height: 420 }),
        moduleElement({ id: "notes", x: 720, y: 128, width: 560, height: 420 }),
      ],
      lessonDefinition,
      { width: 1366, height: 768 },
    );

    expect(frame.y).toBeGreaterThanOrEqual(128);
    expect(frame.y).toBeGreaterThan(500);
  });

  it("keeps tightly stacked lab cards in place without rewriting valid card modes", () => {
    const normalized = normalizeWhiteboardLabModules(
      [
        moduleElement({ id: "lesson", x: 40, y: 40, width: 560, height: 420, moduleId: "lesson" }),
        moduleElement({ id: "notes", x: 68, y: 68, width: 560, height: 420, moduleId: "private-notes" }),
        moduleElement({
          id: "graph",
          x: 96,
          y: 96,
          width: 640,
          height: 440,
          moduleId: "desmos-graph",
          mode: "preview",
        }),
      ],
      { width: 1366, height: 768 },
    );

    expect(normalized.map((module) => `${module.x}:${module.y}`)).toEqual(["40:40", "68:68", "96:96"]);
    expect(normalized.find((module) => module.moduleId === "desmos-graph")?.mode).toBe("preview");
  });

  it("defaults source-style live modules to fixed-size board objects", () => {
    const normalized = normalizeWhiteboardLabModules([
      {
        ...moduleElement({ id: "legacy" }),
        pinned: undefined,
      },
    ]);

    expect(normalized[0].pinned).toBe(true);
    expect(normalized[0].anchorMode).toBe("board-fixed-size");
  });

  it("defaults each module family to the right anchor mode", () => {
    const normalized = normalizeWhiteboardLabModules([
      moduleElement({ id: "graph", moduleId: "desmos-graph", pinned: undefined, anchorMode: undefined }),
      moduleElement({ id: "calculator", moduleId: "scientific-calculator", pinned: undefined, anchorMode: undefined }),
      moduleElement({ id: "lesson", moduleId: "lesson", pinned: undefined, anchorMode: undefined }),
      moduleElement({ id: "notes", moduleId: "private-notes", pinned: undefined, anchorMode: undefined }),
      moduleElement({ id: "formulas", moduleId: "formula-sheet", pinned: undefined, anchorMode: undefined }),
      moduleElement({ id: "graphs", moduleId: "saved-graphs", pinned: undefined, anchorMode: undefined }),
      moduleElement({ id: "blocks", moduleId: "math-blocks", pinned: undefined, anchorMode: undefined }),
      moduleElement({ id: "concepts", moduleId: "related-concepts", pinned: undefined, anchorMode: undefined }),
    ]);

    expect(normalized.map((module) => ({ id: module.id, anchorMode: module.anchorMode, pinned: module.pinned }))).toEqual([
      { id: "graph", anchorMode: "board-fixed-size", pinned: true },
      { id: "calculator", anchorMode: "viewport", pinned: false },
      { id: "lesson", anchorMode: "board-fixed-size", pinned: true },
      { id: "notes", anchorMode: "board-fixed-size", pinned: true },
      { id: "formulas", anchorMode: "board-fixed-size", pinned: true },
      { id: "graphs", anchorMode: "board-fixed-size", pinned: true },
      { id: "blocks", anchorMode: "board-fixed-size", pinned: true },
      { id: "concepts", anchorMode: "board-fixed-size", pinned: true },
    ]);
  });

  it("preserves existing lab card board positions and sizes even when cards overlap", () => {
    const normalized = normalizeWhiteboardLabModules(
      [
        moduleElement({ id: "lesson", x: 240, y: 180, width: 560, height: 420, moduleId: "lesson" }),
        moduleElement({ id: "graph", x: 260, y: 200, width: 720, height: 560, moduleId: "desmos-graph" }),
      ],
      { width: 1366, height: 768 },
    );

    expect(normalized.map((module) => ({ id: module.id, x: module.x, y: module.y }))).toEqual([
      { id: "lesson", x: 240, y: 180 },
      { id: "graph", x: 260, y: 200 },
    ]);
    expect(normalized.map((module) => ({ id: module.id, width: module.width, height: module.height }))).toEqual([
      { id: "lesson", width: 560, height: 420 },
      { id: "graph", width: 720, height: 560 },
    ]);
  });

  it("places lab modules near the current board viewport center", () => {
    const frame = findOpenWhiteboardModuleFrameNearViewport([], desmosDefinition, {
      scrollX: 100,
      scrollY: -80,
      zoom: 2,
      viewportWidth: 1200,
      viewportHeight: 800,
    });

    expect(frame.x).toBe(200 - desmosDefinition.defaultWidth / 2);
    expect(frame.y).toBe(280 - desmosDefinition.defaultHeight / 2);
    expect(frame.width).toBe(desmosDefinition.defaultWidth);
    expect(frame.height).toBe(desmosDefinition.defaultHeight);
  });

  it("only falls back when module placement data is invalid", () => {
    const normalized = normalizeWhiteboardLabModules([
      moduleElement({
        id: "",
        x: Number.NaN,
        y: Number.POSITIVE_INFINITY,
        width: 0,
        height: -24,
        zIndex: Number.NaN,
      }),
    ]);

    expect(normalized[0]).toMatchObject({
      id: "module-lesson-1",
      x: 0,
      y: 0,
      width: lessonDefinition.defaultWidth,
      height: lessonDefinition.defaultHeight,
      zIndex: 1,
    });
  });
});
