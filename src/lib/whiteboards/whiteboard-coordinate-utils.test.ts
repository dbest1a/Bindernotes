import { describe, expect, it } from "vitest";
import {
  boardToScreenFrame,
  convertWhiteboardCardAnchor,
  getZoomValue,
  getEmbeddedModulePresentation,
  isBoardObjectVisibleInViewport,
  screenDeltaToBoardDelta,
  screenToBoardPoint,
  getViewportCenterBoardPoint,
  type WhiteboardViewportTransform,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import {
  alwaysLiveWhiteboardModules,
  viewportFloatingWhiteboardModules,
} from "@/lib/whiteboards/whiteboard-module-registry";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

const baseTransform: WhiteboardViewportTransform = {
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
  viewportWidth: 1200,
  viewportHeight: 800,
};

function moduleElement(overrides: Partial<WhiteboardModuleElement> = {}): WhiteboardModuleElement {
  return {
    id: "module-1",
    type: "bindernotes-module",
    moduleId: "desmos-graph",
    x: 100,
    y: 140,
    width: 420,
    height: 320,
    zIndex: 1,
    mode: "live",
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    ...overrides,
  };
}

describe("whiteboard coordinate utilities", () => {
  it("converts board frames to screen frames at zoom 1 without scroll", () => {
    expect(boardToScreenFrame({ x: 100, y: 200, width: 300, height: 150 }, baseTransform)).toEqual({
      x: 100,
      y: 200,
      width: 300,
      height: 150,
    });
  });

  it("converts board frames to screen frames with zoom and scroll", () => {
    expect(
      boardToScreenFrame(
        { x: 100, y: 200, width: 300, height: 150 },
        { ...baseTransform, zoom: 2, scrollX: 25, scrollY: -40 },
      ),
    ).toEqual({
      x: 250,
      y: 320,
      width: 600,
      height: 300,
    });
  });

  it("keeps the same board frame anchored when zoomed far out", () => {
    expect(
      boardToScreenFrame(
        { x: 100, y: 120, width: 420, height: 320 },
        { ...baseTransform, zoom: 0.25, scrollX: 40, scrollY: 20 },
      ),
    ).toEqual({
      x: 35,
      y: 35,
      width: 105,
      height: 80,
    });
  });

  it("uses Excalidraw's scene-to-viewport convention so zooming does not drift cards", () => {
    const boardPoint = { x: 180, y: 260 };
    const zoomed = { ...baseTransform, zoom: 3, scrollX: -120, scrollY: 45 };
    const screenPoint = boardToScreenFrame({ ...boardPoint, width: 420, height: 320 }, zoomed);

    expect(screenPoint.x).toBe(180);
    expect(screenPoint.y).toBe(915);
    expect(screenToBoardPoint({ x: screenPoint.x, y: screenPoint.y }, zoomed)).toEqual(boardPoint);
  });

  it("converts screen deltas into board deltas by dividing by zoom", () => {
    expect(screenDeltaToBoardDelta({ x: 80, y: 40 }, { ...baseTransform, zoom: 2 })).toEqual({
      x: 40,
      y: 20,
    });
  });

  it("places new modules around the current viewport center in board coordinates", () => {
    expect(
      getViewportCenterBoardPoint({
        ...baseTransform,
        zoom: 2,
        scrollX: 100,
        scrollY: -80,
        offsetLeft: 48,
        offsetTop: 32,
      }),
    ).toEqual({
      x: 200,
      y: 280,
    });
    expect(
      screenToBoardPoint(
        { x: 648, y: 432 },
        { ...baseTransform, zoom: 2, scrollX: 100, scrollY: -80, offsetLeft: 48, offsetTop: 32 },
      ),
    ).toEqual({
      x: 200,
      y: 280,
    });
  });

  it("normalizes object-shaped Excalidraw zoom values before applying transform math", () => {
    expect(getZoomValue({ value: 1.75 })).toBe(1.75);
  });

  it("detects visible board objects after pan and zoom", () => {
    expect(isBoardObjectVisibleInViewport(moduleElement(), baseTransform)).toBe(true);
    expect(isBoardObjectVisibleInViewport(moduleElement({ x: 5000, y: 5000 }), baseTransform)).toBe(false);
  });

  it("switches embedded modules to preview or chip at low zoom", () => {
    const lesson = moduleElement({ moduleId: "lesson" });

    expect(getEmbeddedModulePresentation(lesson, { ...baseTransform, zoom: 0.7 }, true)).toBe("live");
    expect(getEmbeddedModulePresentation(lesson, { ...baseTransform, zoom: 0.45 }, true)).toBe("preview");
    expect(getEmbeddedModulePresentation(lesson, { ...baseTransform, zoom: 0.2 }, true)).toBe("chip");
    expect(getEmbeddedModulePresentation(moduleElement({ mode: "collapsed" }), baseTransform, true)).toBe("chip");
  });

  it("keeps the scientific calculator live when zoom would otherwise make it too small", () => {
    const calculator = moduleElement({
      moduleId: "scientific-calculator",
      width: 840,
      height: 640,
      mode: "live",
    });

    expect(getEmbeddedModulePresentation(calculator, { ...baseTransform, zoom: 0.2 }, true)).toBe("live");
    expect(getEmbeddedModulePresentation(calculator, { ...baseTransform, zoom: 0.2 }, false)).toBe("live");
  });

  it("keeps Desmos, Private Notes, and Scientific Calculator live even when zoomed out or offscreen", () => {
    expect(alwaysLiveWhiteboardModules.has("desmos-graph")).toBe(true);
    expect(alwaysLiveWhiteboardModules.has("private-notes")).toBe(true);
    expect(alwaysLiveWhiteboardModules.has("scientific-calculator")).toBe(true);
    expect(viewportFloatingWhiteboardModules.has("desmos-graph")).toBe(true);

    const lowZoom = { ...baseTransform, zoom: 0.2 };
    const desmos = moduleElement({ moduleId: "desmos-graph", anchorMode: "board" });
    const notes = moduleElement({ moduleId: "private-notes", anchorMode: "board" });
    const calculator = moduleElement({ moduleId: "scientific-calculator", anchorMode: "board" });

    expect(getEmbeddedModulePresentation(desmos, lowZoom, true)).toBe("live");
    expect(getEmbeddedModulePresentation(desmos, lowZoom, false)).toBe("live");
    expect(getEmbeddedModulePresentation(notes, lowZoom, true)).toBe("live");
    expect(getEmbeddedModulePresentation(notes, lowZoom, false)).toBe("live");
    expect(getEmbeddedModulePresentation(calculator, lowZoom, true)).toBe("live");
    expect(getEmbeddedModulePresentation(calculator, lowZoom, false)).toBe("live");
    expect(getEmbeddedModulePresentation(desmos, lowZoom, true)).not.toBe("preview");
    expect(getEmbeddedModulePresentation(notes, lowZoom, true)).not.toBe("preview");
    expect(getEmbeddedModulePresentation(calculator, lowZoom, true)).not.toBe("preview");
  });

  it("does not mount collapsed always-live modules as live content", () => {
    expect(
      getEmbeddedModulePresentation(
        moduleElement({ moduleId: "desmos-graph", mode: "collapsed" }),
        baseTransform,
        true,
      ),
    ).toBe("chip");
    expect(
      getEmbeddedModulePresentation(
        moduleElement({ moduleId: "private-notes", mode: "collapsed" }),
        baseTransform,
        true,
      ),
    ).toBe("chip");
    expect(
      getEmbeddedModulePresentation(
        moduleElement({ moduleId: "scientific-calculator", mode: "collapsed" }),
        baseTransform,
        true,
      ),
    ).toBe("chip");
  });

  it("converts viewport cards to board-fixed-size while preserving visual position and size", () => {
    const converted = convertWhiteboardCardAnchor(
      moduleElement({ anchorMode: "viewport", pinned: false, x: 240, y: 120, width: 720, height: 560 }),
      "board-fixed-size",
      { ...baseTransform, scrollX: 100, scrollY: -80, zoom: 2 },
      "2026-04-26T13:00:00.000Z",
    );

    expect(converted).toMatchObject({
      anchorMode: "board-fixed-size",
      pinned: true,
      x: 20,
      y: 140,
      width: 720,
      height: 560,
      zIndex: 1,
      mode: "live",
      updatedAt: "2026-04-26T13:00:00.000Z",
    });
    expect(boardToScreenFrame(converted, { ...baseTransform, scrollX: 100, scrollY: -80, zoom: 2 })).toMatchObject({
      x: 240,
      y: 120,
    });
  });

  it("converts board-fixed-size cards to viewport while preserving visual position and size", () => {
    const converted = convertWhiteboardCardAnchor(
      moduleElement({ anchorMode: "board-fixed-size", x: 20, y: 140, width: 720, height: 560 }),
      "viewport",
      { ...baseTransform, scrollX: 100, scrollY: -80, zoom: 2 },
      "2026-04-26T13:00:00.000Z",
    );

    expect(converted).toMatchObject({
      anchorMode: "viewport",
      pinned: false,
      x: 240,
      y: 120,
      width: 720,
      height: 560,
    });
  });

  it("converts viewport cards to board while preserving visual center and useful module size", () => {
    const converted = convertWhiteboardCardAnchor(
      moduleElement({ anchorMode: "viewport", pinned: false, x: 240, y: 120, width: 720, height: 560 }),
      "board",
      { ...baseTransform, scrollX: 100, scrollY: -80, zoom: 2 },
      "2026-04-26T13:00:00.000Z",
    );

    expect(converted).toMatchObject({
      anchorMode: "board",
      pinned: true,
      x: -10,
      y: 120,
      width: 420,
      height: 320,
    });
    const screenFrame = boardToScreenFrame(converted, { ...baseTransform, scrollX: 100, scrollY: -80, zoom: 2 });
    expect(screenFrame).toMatchObject({
      x: 180,
      y: 80,
      width: 840,
      height: 640,
    });
    expect(screenFrame.x + screenFrame.width / 2).toBe(600);
    expect(screenFrame.y + screenFrame.height / 2).toBe(400);
  });

  it("converts board cards to viewport while preserving visual position and size", () => {
    const converted = convertWhiteboardCardAnchor(
      moduleElement({ anchorMode: "board", x: 20, y: 140, width: 360, height: 280 }),
      "viewport",
      { ...baseTransform, scrollX: 100, scrollY: -80, zoom: 2 },
      "2026-04-26T13:00:00.000Z",
    );

    expect(converted).toMatchObject({
      anchorMode: "viewport",
      pinned: false,
      x: 240,
      y: 120,
      width: 720,
      height: 560,
    });
  });

  it("keeps Desmos usable when pinning to board from a zoomed-in viewport card", () => {
    const transform = { ...baseTransform, scrollX: 100, scrollY: -80, zoom: 2 };
    const converted = convertWhiteboardCardAnchor(
      moduleElement({ anchorMode: "viewport", pinned: false, x: 240, y: 120, width: 720, height: 560 }),
      "board",
      transform,
      "2026-04-26T13:00:00.000Z",
    );
    const screenFrame = boardToScreenFrame(converted, transform);

    expect(converted).toMatchObject({
      anchorMode: "board",
      pinned: true,
      width: 420,
      height: 320,
    });
    expect(screenFrame.x + screenFrame.width / 2).toBe(600);
    expect(screenFrame.y + screenFrame.height / 2).toBe(400);
    expect(getEmbeddedModulePresentation(converted, transform, true)).toBe("live");
  });
});
