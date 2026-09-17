import { describe, expect, it } from "vitest";
import {
  applySafeEdgePaddingToFrame,
  getFrameFromPointerDelta,
  getEffectiveCanvasScale,
  viewportToCanvasPoint,
} from "@/lib/module-movement-engine";
import type { WorkspaceWindowFrame } from "@/types";

const startFrame: WorkspaceWindowFrame = {
  x: 120,
  y: 80,
  w: 640,
  h: 420,
  z: 4,
};

describe("module movement engine", () => {
  it("converts viewport pointer coordinates into canvas coordinates with scroll and scale", () => {
    expect(
      viewportToCanvasPoint({
        clientX: 240,
        clientY: 180,
        canvasRect: { left: 40, top: 20, width: 800, height: 600 },
        scrollLeft: 64,
        scrollTop: 128,
        scale: 0.5,
      }),
    ).toEqual({
      x: 464,
      y: 448,
    });
  });

  it("uses the effective canvas scale so a normal pointer move cannot create a teleport jump", () => {
    const next = getFrameFromPointerDelta({
      mode: "move",
      startFrame,
      startPointer: { x: 100, y: 100 },
      currentPointer: { x: 120, y: 120 },
      scale: 0.75,
      minimumSize: { width: 320, height: 240 },
    });

    expect(next.x).toBeCloseTo(146.67, 1);
    expect(next.y).toBeCloseTo(106.67, 1);
    expect(Math.abs(next.x - startFrame.x)).toBeLessThan(80);
    expect(Math.abs(next.y - startFrame.y)).toBeLessThan(80);
  });

  it("clamps only to a small safe edge inset when safe edge padding is on", () => {
    const frame = { ...startFrame, x: -40, y: -20 };

    expect(
      applySafeEdgePaddingToFrame(frame, {
        enabled: true,
        padding: 8,
        canvasWidth: 900,
        canvasHeight: 700,
      }),
    ).toMatchObject({ x: 8, y: 8 });
  });

  it("allows true corner placement when safe edge padding is off", () => {
    const frame = { ...startFrame, x: -40, y: -20 };

    expect(
      applySafeEdgePaddingToFrame(frame, {
        enabled: false,
        padding: 8,
        canvasWidth: 900,
        canvasHeight: 700,
      }),
    ).toMatchObject({ x: 0, y: 0 });
  });

  it("falls back to scale 1 for invalid canvas transform values", () => {
    expect(getEffectiveCanvasScale({ width: 0 }, 700)).toBe(1);
    expect(getEffectiveCanvasScale({ width: 700 }, 0)).toBe(1);
    expect(getEffectiveCanvasScale({ width: 350 }, 700)).toBe(0.5);
  });
});
