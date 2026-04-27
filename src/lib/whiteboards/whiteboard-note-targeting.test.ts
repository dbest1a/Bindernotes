import { describe, expect, it } from "vitest";
import {
  getAnnotationOriginFromModule,
  rankPrivateNotesTargets,
  resolvePrivateNotesTarget,
} from "@/lib/whiteboards/whiteboard-note-targeting";
import type { WhiteboardViewportTransform } from "@/lib/whiteboards/whiteboard-coordinate-utils";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

const transform: WhiteboardViewportTransform = {
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
  viewportWidth: 1200,
  viewportHeight: 800,
  offsetLeft: 0,
  offsetTop: 0,
};

function moduleElement(
  id: string,
  moduleId: WhiteboardModuleElement["moduleId"],
  patch: Partial<WhiteboardModuleElement> = {},
): WhiteboardModuleElement {
  return {
    id,
    type: "bindernotes-module",
    moduleId,
    x: 0,
    y: 0,
    width: 300,
    height: 240,
    zIndex: 1,
    mode: "live",
    anchorMode: "board-fixed-size",
    pinned: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...patch,
  };
}

describe("whiteboard note targeting", () => {
  it("uses an explicit Private Notes target when present", () => {
    const modules = [
      moduleElement("notes-a", "private-notes"),
      moduleElement("notes-b", "private-notes", { x: 900 }),
    ];

    const resolution = resolvePrivateNotesTarget({
      explicitTargetId: "notes-b",
      modules,
      origin: { kind: "screen", point: { x: 0, y: 0 } },
      viewportTransform: transform,
    });

    expect(resolution).toMatchObject({
      status: "target-found",
      moduleId: "notes-b",
      reason: "explicit",
    });
  });

  it("uses the single open Private Notes module automatically", () => {
    const resolution = resolvePrivateNotesTarget({
      modules: [moduleElement("source", "lesson"), moduleElement("notes-a", "private-notes")],
      origin: { kind: "screen", point: { x: 640, y: 360 } },
      viewportTransform: transform,
    });

    expect(resolution).toMatchObject({
      status: "target-found",
      moduleId: "notes-a",
      reason: "single-open",
    });
  });

  it("chooses the nearest Private Notes module by geometry", () => {
    const modules = [
      moduleElement("source", "lesson", { x: 820, y: 120 }),
      moduleElement("notes-left", "private-notes", { x: 0, y: 0 }),
      moduleElement("notes-right", "private-notes", { x: 900, y: 100 }),
    ];

    const resolution = resolvePrivateNotesTarget({
      modules,
      origin: getAnnotationOriginFromModule(modules[0]),
      viewportTransform: transform,
    });

    expect(resolution).toMatchObject({
      status: "target-found",
      moduleId: "notes-right",
      reason: "nearest",
    });
  });

  it("uses the last-used visible notes module when nearest candidates are ambiguous", () => {
    const resolution = resolvePrivateNotesTarget({
      modules: [
        moduleElement("notes-left", "private-notes", { x: 0, y: 0 }),
        moduleElement("notes-right", "private-notes", { x: 4, y: 0 }),
      ],
      origin: { kind: "screen", point: { x: 160, y: 120 } },
      lastUsedTargetId: "notes-right",
      viewportTransform: transform,
    });

    expect(resolution).toMatchObject({
      status: "target-found",
      moduleId: "notes-right",
      reason: "last-used",
    });
  });

  it("asks for a destination when multiple notes modules are too close to call", () => {
    const resolution = resolvePrivateNotesTarget({
      modules: [
        moduleElement("notes-a", "private-notes", { x: 0, y: 0 }),
        moduleElement("notes-b", "private-notes", { x: 4, y: 0 }),
      ],
      origin: { kind: "screen", point: { x: 160, y: 120 } },
      viewportTransform: transform,
    });

    expect(resolution.status).toBe("ambiguous");
    expect(resolution.candidates).toHaveLength(2);
  });

  it("returns none-open when no Private Notes module exists", () => {
    const resolution = resolvePrivateNotesTarget({
      modules: [moduleElement("source", "lesson")],
      origin: { kind: "screen", point: { x: 160, y: 120 } },
      viewportTransform: transform,
    });

    expect(resolution).toEqual({ status: "none-open", candidates: [] });
  });

  it("ranks live notes ahead of collapsed notes when distances are close", () => {
    const candidates = rankPrivateNotesTargets(
      { kind: "screen", point: { x: 160, y: 120 } },
      [
        moduleElement("notes-collapsed", "private-notes", { mode: "collapsed", x: 0, y: 0 }),
        moduleElement("notes-live", "private-notes", { mode: "live", x: 20, y: 0 }),
      ],
      transform,
    );

    expect(candidates[0].moduleId).toBe("notes-live");
  });
});
