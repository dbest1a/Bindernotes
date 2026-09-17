import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(__dirname, "styles.css"), "utf8");

describe("Canvas Rework styles", () => {
  it("styles the gated topbar, shelf, inspector, grid, and mobile stack", () => {
    expect(styles).toContain(".canvas-rework-topbar");
    expect(styles).toContain(".canvas-rework-module-group");
    expect(styles).toContain(".canvas-rework-inspector-grid");
    expect(styles).toContain(".workspace-canvas--grid-enabled::after");
    expect(styles).toContain(".canvas-rework-mobile-stack");
  });

  it("keeps the Private Notes editor flexing to fill module height", () => {
    expect(styles).toMatch(/\.private-notes-content\s*{[^}]*display:\s*flex/s);
    expect(styles).toMatch(/\.private-notes-editor-frame\s*{[^}]*min-height:\s*0/s);
    expect(styles).toMatch(/\.private-notes-editor \.editor-surface\s*{[^}]*flex:\s*1 1 auto/s);
  });
});
