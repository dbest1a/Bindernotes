import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/whiteboard/whiteboard-module.tsx"), "utf8");

describe("WhiteboardModule workspace layout", () => {
  it("uses a resize-friendly full-height shell for the normal workspace module", () => {
    expect(source).toContain("whiteboard-workspace-panel--module h-full min-h-0");
    expect(source).toContain("whiteboard-module-layout grid h-full min-h-0");
    expect(source).toContain("whiteboard-module-surface relative h-full min-h-0 overflow-hidden");
    expect(source).toContain("whiteboard-module-board relative h-full min-h-0 min-w-0 overflow-hidden");
  });

  it("does not reuse fixed lab-sized canvas constraints in the normal workspace module", () => {
    expect(source).not.toContain('whiteboard-workspace-panel min-h-[720px]');
    expect(source).not.toContain('relative min-h-[680px] overflow-auto');
    expect(source).not.toContain('relative min-h-[1800px] min-w-[1800px]');
  });

  it("keeps a visible escape hatch and temporary hint for focused whiteboard surfaces", () => {
    expect(source).toContain("onExitWhiteboardFocus");
    expect(source).toContain('data-testid="whiteboard-focus-exit"');
    expect(source).toContain('data-testid="whiteboard-focus-exit-hint"');
    expect(source).toContain("Back to workspace");
    expect(source).toContain("5000");
  });

  it("keeps the focused whiteboard escape hatch away from the native top toolbar", () => {
    expect(source).toContain("whiteboard-focus-exit--floating");
    expect(source).toContain("fixed bottom-4 left-1/2");
    expect(source).not.toContain("fixed left-4 top-4");
  });

  it("keeps whiteboard focus opt-in through an explicit full board control", () => {
    expect(source).toContain("onEnterWhiteboardFocus");
    expect(source).toContain('data-testid="whiteboard-enter-focus"');
    expect(source).toContain("Full board");
    expect(source).toContain("Open full board");
  });

  it("does not expose implementation-copy about future Supabase storage in the student sidebar", () => {
    expect(source).not.toContain("Remote Supabase storage is prepared for a later approved migration.");
    expect(source).toContain("Keep the board beside your lesson, notes, and live tools while you work.");
  });

  it("uses Compact Whiteboard Tools to default the toolbox to a rail and lazily reveal templates", () => {
    expect(source).toContain("compactWhiteboardTools || context.whiteboardSidebarDefaultCollapsed");
    expect(source).toContain('data-compact-whiteboard-tools={compactWhiteboardTools ? "true" : "false"}');
    expect(source).toContain('aria-label="Collapse toolbox"');
    expect(source).toContain('aria-label="Expand toolbox"');
    expect(source).toContain("templatesOpen ? mathWhiteboardTemplates : []");
    expect(source).toContain("compact={compactWhiteboardTools}");
  });

  it("keeps menu switching performance-first without remounting the board canvas", () => {
    expect(source).toContain('data-whiteboard-performance-shell="true"');
    expect(source).toContain("templatesOpen ? mathWhiteboardTemplates : []");
    expect(source).not.toMatch(/<WhiteboardCanvas[\s\S]{0,600}key=/);
  });

  it("keeps whiteboard storage status language consistent for students", () => {
    expect(source).toContain("Loaded from Supabase");
    expect(source).toContain('"Saved"');
    expect(source).not.toContain("Saved to Supabase");
  });
});
