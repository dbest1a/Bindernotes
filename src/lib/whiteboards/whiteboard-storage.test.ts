// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLocalWhiteboard,
  listLocalWhiteboards,
  loadLocalWhiteboard,
  saveLocalWhiteboard,
} from "@/lib/whiteboards/whiteboard-storage";
import {
  MAX_OBJECTS_HARD_CAP,
  MAX_OBJECTS_WARNING,
  MAX_WHITEBOARDS_PER_USER,
} from "@/lib/whiteboards/whiteboard-limits";
import { validateWhiteboardForStorage } from "@/lib/whiteboards/whiteboard-serialization";
import { mathWhiteboardTemplates } from "@/lib/whiteboards/whiteboard-templates";
import type { BinderWhiteboard, WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

const scope = {
  ownerId: "user-1",
  binderId: "binder-jacob-math-notes",
  lessonId: "lesson-jacob-calculus-limits",
};

function moduleElement(overrides: Partial<WhiteboardModuleElement> = {}): WhiteboardModuleElement {
  return {
    id: overrides.id ?? "module-1",
    type: "bindernotes-module",
    moduleId: overrides.moduleId ?? "lesson",
    binderId: scope.binderId,
    lessonId: scope.lessonId,
    x: 120,
    y: 120,
    width: 520,
    height: 360,
    zIndex: 2,
    mode: "preview",
    title: "Source Lesson",
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    ...overrides,
  };
}

function board(overrides: Partial<BinderWhiteboard> = {}): BinderWhiteboard {
  return {
    id: overrides.id ?? "board-1",
    ownerId: scope.ownerId,
    binderId: scope.binderId,
    lessonId: scope.lessonId,
    title: "Calculus scratch board",
    subject: "Math",
    moduleContext: "lesson",
    scene: {
      elements: overrides.scene?.elements ?? [],
      appState: overrides.scene?.appState ?? {},
      files: overrides.scene?.files ?? {},
    },
    modules: overrides.modules ?? [moduleElement()],
    objectCount: overrides.objectCount ?? 1,
    sceneSizeBytes: overrides.sceneSizeBytes ?? 0,
    assetSizeBytes: overrides.assetSizeBytes ?? 0,
    storageMode: "local-draft",
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("whiteboard local review storage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("creates, saves, lists, and reloads a local draft whiteboard", () => {
    const created = createLocalWhiteboard(scope, { title: "Graph paper scratch" });
    const saved = saveLocalWhiteboard({
      ...created,
      modules: [
        moduleElement({
          moduleId: "private-notes",
          anchorMode: "board-fixed-size",
          x: 345.5,
          y: -218.25,
          width: 612.75,
          height: 487.5,
        }),
      ],
    });

    expect(saved.storageMode).toBe("local-draft");
    expect(listLocalWhiteboards(scope)).toHaveLength(1);
    expect(loadLocalWhiteboard(scope, saved.id)?.modules[0]).toMatchObject({
      type: "bindernotes-module",
      moduleId: "private-notes",
      anchorMode: "board-fixed-size",
      binderId: scope.binderId,
      lessonId: scope.lessonId,
      x: 345.5,
      y: -218.25,
      width: 612.75,
      height: 487.5,
    });
  });

  it("persists module anchor modes and positions across save and reload", () => {
    const saved = saveLocalWhiteboard(
      board({
        modules: [
          moduleElement({
            id: "module-desmos",
            moduleId: "desmos-graph",
            anchorMode: "viewport",
            pinned: false,
            x: 240,
            y: 120,
            width: 720,
            height: 560,
          }),
          moduleElement({
            id: "module-source",
            moduleId: "lesson",
            anchorMode: "board-fixed-size",
            pinned: true,
            x: 20,
            y: 140,
            width: 720,
            height: 560,
          }),
        ],
      }),
    );

    expect(loadLocalWhiteboard(scope, saved.id)?.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "module-desmos",
          anchorMode: "viewport",
          pinned: false,
          x: 240,
          y: 120,
          width: 720,
          height: 560,
        }),
        expect.objectContaining({
          id: "module-source",
          anchorMode: "board-fixed-size",
          pinned: true,
          x: 20,
          y: 140,
          width: 720,
          height: 560,
        }),
      ]),
    );
  });

  it("enforces the three-board local review cap", () => {
    for (let index = 0; index < MAX_WHITEBOARDS_PER_USER; index += 1) {
      saveLocalWhiteboard(board({ id: `board-${index}` }));
    }

    expect(() => saveLocalWhiteboard(board({ id: "board-over-cap" }))).toThrow(/3 whiteboards/i);
  });

  it("warns near the object limit and rejects hard-cap scenes", () => {
    const warningBoard = board({
      scene: { elements: Array.from({ length: MAX_OBJECTS_WARNING }, (_, index) => ({ id: `shape-${index}` })) },
      modules: [],
    });
    const hardCapBoard = board({
      scene: { elements: Array.from({ length: MAX_OBJECTS_HARD_CAP + 1 }, (_, index) => ({ id: `shape-${index}` })) },
      modules: [],
    });

    expect(validateWhiteboardForStorage(warningBoard).warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("objects")]),
    );
    expect(() => saveLocalWhiteboard(hardCapBoard)).toThrow(/too many objects/i);
  });

  it("stores embedded BinderNotes modules as references instead of copied lesson or note blobs", () => {
    const saved = saveLocalWhiteboard(
      board({
        modules: [
          moduleElement({
            moduleId: "lesson",
            title: "Calculus Limits and the Derivative Definition",
          }),
        ],
      }),
    );
    const raw = window.localStorage.getItem("bindernotes:whiteboards:user-1:binder-jacob-math-notes:lesson-jacob-calculus-limits");

    expect(saved.modules[0]).not.toHaveProperty("content");
    expect(saved.modules[0]).not.toHaveProperty("noteContent");
    expect(raw).not.toContain("The calculus section reopens limits");
  });

  it("ships math-first starter templates", () => {
    expect(mathWhiteboardTemplates.map((template) => template.name)).toEqual(
      expect.arrayContaining([
        "Blank Board",
        "Equation Solving",
        "Function Transformations",
        "Graph Annotation",
        "Geometry Diagram",
        "Proof Builder",
        "Unit Circle",
        "Test Review",
        "Error Correction",
      ]),
    );
  });
});
