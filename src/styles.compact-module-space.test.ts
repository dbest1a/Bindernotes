import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(__dirname, "styles.css"), "utf8");

describe("maximize module space styles", () => {
  it("scopes source and notes expansion to the active workspace page toggle", () => {
    expect(styles).toContain('.workspace-page[data-maximize-module-space="true"] .source-lesson-content');
    expect(styles).toContain('.workspace-page[data-maximize-module-space="true"] .source-lesson-body-card');
    expect(styles).toContain('.workspace-page[data-maximize-module-space="true"] .private-notes-content');
    expect(styles).toContain('.workspace-page[data-maximize-module-space="true"] .private-notes-editor-hero');
    expect(styles).not.toContain('html[data-workspace-compact-mode="on"] .source-lesson-content');
    expect(styles).not.toContain('html[data-workspace-compact-mode="on"] .source-lesson-body-card');
    expect(styles).not.toContain('html[data-workspace-compact-mode="on"] .private-notes-content');
    expect(styles).not.toContain('html[data-workspace-compact-mode="on"] .private-notes-editor-hero');
  });

  it("removes the old centered max-width and reserved header spacing in compact module mode", () => {
    expect(styles).toMatch(
      /\.workspace-page\[data-maximize-module-space="true"\] \.source-lesson-content\s*{[^}]*max-width:\s*none/s,
    );
    expect(styles).toMatch(
      /\.workspace-page\[data-maximize-module-space="true"\] \.private-notes-content\s*{[^}]*max-width:\s*none/s,
    );
    expect(styles).toMatch(
      /\.workspace-page\[data-maximize-module-space="true"\] \.workspace-panel__body\s*{[^}]*padding:\s*0\.75rem/s,
    );
  });

  it("lets Simple View keep the rich lesson header available when maximize space is off", () => {
    expect(styles).toContain('.simple-presentation-shell[data-maximize-module-space="true"]');
    expect(styles).toMatch(
      /\.simple-presentation-shell\[data-maximize-module-space="true"\] \.simple-presentation-hero p:not\(\.simple-presentation-kicker\)\s*{[^}]*display:\s*none/s,
    );
    expect(styles).toMatch(
      /\.simple-presentation-shell\[data-maximize-module-space="true"\] \.simple-presentation-stats\s*{[^}]*display:\s*none/s,
    );
    expect(styles).not.toContain('.simple-presentation-shell[data-maximize-module-space="false"] .simple-presentation-stats');
  });

  it("lets Split Study private notes fill the available vertical working space", () => {
    expect(styles).toMatch(/\.private-notes-content\s*{[^}]*min-height:\s*100%/s);
    expect(styles).toMatch(/\.private-notes-editor-hero\s*{[^}]*flex:\s*1 1 auto/s);
    expect(styles).toMatch(/\.private-notes-editor-frame\s*{[^}]*flex:\s*1 1 auto/s);
    expect(styles).toMatch(/\.private-notes-editor \.editor-surface\s*{[^}]*flex:\s*1 1 auto/s);
  });

  it("lets Split Study source and notes content use the full half-screen panel width", () => {
    expect(styles).toContain('[data-workspace-preset="split-study"] .workspace-canvas-shell');
    expect(styles).toContain('[data-workspace-preset="split-study"] .source-lesson-content');
    expect(styles).toContain('[data-workspace-preset="split-study"] .private-notes-content');
    expect(styles).toMatch(
      /\[data-workspace-preset="split-study"\] \.workspace-canvas-shell\s*{[^}]*scrollbar-gutter:\s*stable/s,
    );
    expect(styles).toMatch(
      /\[data-workspace-preset="split-study"\] \.workspace-canvas-shell\s*{[^}]*width:\s*100%/s,
    );
    expect(styles).toMatch(
      /\[data-workspace-preset="split-study"\] \.workspace-canvas\s*{[^}]*margin-left:\s*0/s,
    );
    expect(styles).toMatch(
      /\[data-workspace-preset="split-study"\] \.source-lesson-content\s*{[^}]*max-width:\s*none/s,
    );
    expect(styles).toMatch(
      /\[data-workspace-preset="split-study"\] \.source-lesson-body-card\s*{[^}]*width:\s*100%/s,
    );
    expect(styles).toMatch(
      /\[data-workspace-preset="split-study"\] \.private-notes-content\s*{[^}]*max-width:\s*none/s,
    );
    expect(styles).toMatch(
      /\[data-workspace-preset="split-study"\] \.private-notes-editor-hero\s*{[^}]*width:\s*100%/s,
    );
  });
});
