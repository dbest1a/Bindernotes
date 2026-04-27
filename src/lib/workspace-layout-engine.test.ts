import { describe, expect, it } from "vitest";
import {
  extendWorkspaceCanvasForFrame,
  fitWindowFramesToViewport,
  snapWindowFrame,
  tidyWorkspaceFrames,
  validateWindowFrameLayout,
} from "@/lib/workspace-layout-engine";
import type { WorkspaceModuleId, WorkspaceWindowFrame } from "@/types";

const viewport = { width: 1200, height: 800 };

function frame(x: number, y: number, w = 300, h = 240, z = 1): WorkspaceWindowFrame {
  return { x, y, w, h, z };
}

function visibleFrames(layout: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>) {
  return Object.values(layout).filter((candidate): candidate is WorkspaceWindowFrame =>
    Boolean(candidate),
  );
}

function framesOverlap(left: WorkspaceWindowFrame, right: WorkspaceWindowFrame) {
  return !(
    left.x + left.w <= right.x ||
    right.x + right.w <= left.x ||
    left.y + left.h <= right.y ||
    right.y + right.h <= left.y
  );
}

describe("workspace layout engine", () => {
  it("snaps a moving module left edge to another module right edge plus the standard gap", () => {
    const result = snapWindowFrame({
      frame: frame(508, 40),
      peerFrames: [frame(100, 40, 400, 240, 2)],
      viewport,
      snapBehavior: "modules",
      safeEdgePadding: false,
    });

    expect(result.frame.x).toBe(516);
    expect(result.guides.some((guide) => guide.kind === "module-gap")).toBe(true);
  });

  it("snaps a moving module right edge to another module left edge minus the standard gap", () => {
    const result = snapWindowFrame({
      frame: frame(292, 40),
      peerFrames: [frame(600, 40, 360, 240, 2)],
      viewport,
      snapBehavior: "modules",
      safeEdgePadding: false,
    });

    expect(result.frame.x + result.frame.w).toBe(584);
  });

  it("snaps moving module top and bottom edges between modules", () => {
    const topResult = snapWindowFrame({
      frame: frame(40, 508),
      peerFrames: [frame(40, 100, 300, 400, 2)],
      viewport,
      snapBehavior: "modules",
      safeEdgePadding: false,
    });
    const bottomResult = snapWindowFrame({
      frame: frame(40, 112, 300, 280),
      peerFrames: [frame(40, 400, 300, 240, 2)],
      viewport,
      snapBehavior: "modules",
      safeEdgePadding: false,
    });

    expect(topResult.frame.y).toBe(516);
    expect(bottomResult.frame.y + bottomResult.frame.h).toBe(384);
  });

  it("snaps same-edge and center alignment to other modules", () => {
    const sameEdge = snapWindowFrame({
      frame: frame(209, 48, 260, 240),
      peerFrames: [frame(200, 48, 320, 240, 2)],
      viewport,
      snapBehavior: "modules",
      safeEdgePadding: false,
    });
    const centered = snapWindowFrame({
      frame: frame(358, 60),
      peerFrames: [frame(300, 60, 400, 240, 2)],
      viewport,
      snapBehavior: "modules",
      safeEdgePadding: false,
    });

    expect(sameEdge.frame.x).toBe(200);
    expect(centered.frame.x + centered.frame.w / 2).toBe(500);
  });

  it("snaps to canvas corners without a forced outer bezel when safe padding is off", () => {
    const topLeft = snapWindowFrame({
      frame: frame(7, 9),
      peerFrames: [],
      viewport,
      snapBehavior: "edges",
      safeEdgePadding: false,
    });
    const bottomRight = snapWindowFrame({
      frame: frame(893, 553),
      peerFrames: [],
      viewport,
      snapBehavior: "edges",
      safeEdgePadding: false,
    });

    expect(topLeft.frame).toMatchObject({ x: 0, y: 0 });
    expect(bottomRight.frame.x).toBe(viewport.width - bottomRight.frame.w);
    expect(bottomRight.frame.y).toBe(viewport.height - bottomRight.frame.h);
  });

  it("fits offscreen modules into the viewport without making them unreadable", () => {
    const result = fitWindowFramesToViewport({
      frames: {
        lesson: frame(1800, 120, 720, 560),
        "private-notes": frame(2600, 760, 720, 500, 2),
      },
      moduleIds: ["lesson", "private-notes"],
      viewport,
      safeEdgePadding: true,
      force: true,
    });

    expect(result.changed).toBe(true);
    visibleFrames(result.frames).forEach((candidate) => {
      expect(candidate.x).toBeGreaterThanOrEqual(8);
      expect(candidate.y).toBeGreaterThanOrEqual(8);
      expect(candidate.x + candidate.w).toBeLessThanOrEqual(viewport.width - 8);
      expect(candidate.y + candidate.h).toBeLessThanOrEqual(viewport.height - 8);
      expect(candidate.w).toBeGreaterThanOrEqual(420);
      expect(candidate.h).toBeGreaterThanOrEqual(360);
    });
  });

  it("tidies broken frames into a non-overlapping visible layout with a clear primary module", () => {
    const result = tidyWorkspaceFrames({
      frames: {
        lesson: frame(900, 400, 420, 360),
        "private-notes": frame(920, 420, 420, 360, 2),
        "binder-notebook": frame(940, 440, 420, 360, 3),
      },
      moduleIds: ["lesson", "private-notes", "binder-notebook"],
      presetId: "notes-focus",
      viewport,
      safeEdgePadding: true,
    });

    expect(result.changed).toBe(true);
    expect(result.frames).not.toMatchObject({
      lesson: frame(900, 400, 420, 360),
      "private-notes": frame(920, 420, 420, 360, 2),
    });
    const frames = visibleFrames(result.frames);
    frames.forEach((candidate) => {
      expect(candidate.x + candidate.w).toBeLessThanOrEqual(viewport.width - 8);
      expect(candidate.y + candidate.h).toBeLessThanOrEqual(viewport.height - 8);
    });
    frames.forEach((candidate, index) => {
      frames.slice(index + 1).forEach((other) => expect(framesOverlap(candidate, other)).toBe(false));
    });
    expect(result.frames["private-notes"]!.w * result.frames["private-notes"]!.h).toBeGreaterThan(
      result.frames.lesson!.w * result.frames.lesson!.h,
    );
  });

  it("validates layouts with huge unused space and offscreen modules", () => {
    const result = validateWindowFrameLayout({
      frames: {
        lesson: frame(32, 32, 360, 300),
        "private-notes": frame(1600, 40, 420, 360, 2),
      },
      moduleIds: ["lesson", "private-notes"],
      viewport,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("offscreen"))).toBe(true);
    expect(result.errors.some((error) => error.includes("unused"))).toBe(true);
  });

  it("extends the vertical canvas when a dragged frame approaches the bottom", () => {
    const result = extendWorkspaceCanvasForFrame({
      canvasHeight: 980,
      frame: frame(40, 780, 420, 320),
      viewportHeight: 700,
    });

    expect(result.canvasHeight).toBeGreaterThan(980);
    expect(result.canvasHeight).toBeGreaterThanOrEqual(1420);
    expect(result.changed).toBe(true);
  });

  it("does not shrink an already-extended vertical canvas around higher frames", () => {
    const result = extendWorkspaceCanvasForFrame({
      canvasHeight: 2600,
      frame: frame(40, 240, 420, 320),
      viewportHeight: 700,
    });

    expect(result.canvasHeight).toBe(2600);
    expect(result.changed).toBe(false);
  });
});
