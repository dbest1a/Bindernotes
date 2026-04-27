import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

describe("whiteboard contrast styles", () => {
  it("scopes Excalidraw brand variables to the BinderNotes whiteboard surfaces", () => {
    expect(css).toContain(".bindernotes-whiteboard-lab .excalidraw");
    expect(css).toContain(".whiteboard-excalidraw-host .excalidraw");
    expect(css).toContain("--color-primary:");
  });

  it("keeps whiteboard module cards opaque and tokenized instead of gray glass", () => {
    const cardBlock = css.slice(css.indexOf(".whiteboard-module-card {"), css.indexOf(".bindernotes-whiteboard-lab .excalidraw"));

    expect(cardBlock).toContain("background-color: hsl(var(--card))");
    expect(cardBlock).toContain("color: hsl(var(--card-foreground))");
    expect(cardBlock).toContain("backdrop-filter: none");
    expect(cardBlock).not.toMatch(new RegExp(String.raw`hsl\(var\(--card\)\s*/\s*0\.[0-8]`));
  });

  it("gives selected card chrome a solid tokenized active state", () => {
    expect(css).toContain('background: hsl(var(--accent))');
    expect(css).toContain('color: hsl(var(--accent-foreground))');
  });

  it("uses opaque high-contrast control panels for the whiteboard toolbox", () => {
    expect(css).toContain(".whiteboard-control-panel");
    expect(css).toContain("background-color: hsl(230 12% 14%)");
    expect(css).toContain(".whiteboard-control-chip");
    expect(css).toContain(".whiteboard-action-button");
    expect(css).toContain(".whiteboard-nav-button");
    expect(css).toContain("whiteboard-nav-sheen");
    expect(css).toContain(".whiteboard-toolbox-panel");
    expect(css).toContain(".whiteboard-save-status[data-status=\"offline-draft\"]");
  });
});
