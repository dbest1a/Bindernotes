import { describe, expect, it } from "vitest";
import {
  computeViewportTransformForNewModule,
  isUnsafeModuleCreationZoom,
  shouldPromptForModuleCreationZoom,
} from "@/lib/whiteboards/whiteboard-module-focus";

describe("whiteboard module zoom safety", () => {
  it("prompts at 50% or lower", () => {
    expect(isUnsafeModuleCreationZoom(0.5)).toBe(true);
    expect(isUnsafeModuleCreationZoom(0.49)).toBe(true);
    expect(shouldPromptForModuleCreationZoom(0.5)).toBe(true);
  });

  it("does not prompt from 51% through 149%", () => {
    expect(isUnsafeModuleCreationZoom(0.51)).toBe(false);
    expect(isUnsafeModuleCreationZoom(1)).toBe(false);
    expect(isUnsafeModuleCreationZoom(1.49)).toBe(false);
  });

  it("prompts at 150% or higher", () => {
    expect(isUnsafeModuleCreationZoom(1.5)).toBe(true);
    expect(isUnsafeModuleCreationZoom(2)).toBe(true);
  });

  it("computes a 100% viewport transform centered on the new module", () => {
    const transform = computeViewportTransformForNewModule(
      { x: 200, y: 100, width: 400, height: 300 },
      {
        scrollX: 20,
        scrollY: -40,
        zoom: 0.4,
        viewportWidth: 1200,
        viewportHeight: 800,
        offsetLeft: 0,
        offsetTop: 0,
      },
    );

    expect(transform.zoom).toBe(1);
    expect((200 + 200 + transform.scrollX) * transform.zoom).toBe(600);
    expect((100 + 150 + transform.scrollY) * transform.zoom).toBe(400);
  });
});
