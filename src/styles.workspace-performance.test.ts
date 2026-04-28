import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

describe("workspace performance styles", () => {
  it("removes expensive backdrop blur from the live workspace surfaces", () => {
    expect(css).toMatch(
      /\.workspace-page \.workspace-topbar,[\s\S]*\.workspace-page \.responsive-mobile-tabs\s*{[\s\S]*backdrop-filter:\s*none/s,
    );
    expect(css).toMatch(/\.workspace-page \.workspace-panel,[\s\S]*-webkit-backdrop-filter:\s*none/s);
  });

  it("keeps settings sections painted normally instead of blanking delayed content while scrolling", () => {
    const sectionBlock = css.match(/\.workspace-settings__section\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";

    expect(sectionBlock).toContain("contain: layout paint style");
    expect(sectionBlock).not.toContain("content-visibility");
  });

  it("uses compositor-friendly drag hints instead of layout-property will-change", () => {
    expect(css).toMatch(/\.workspace-window--dragging\s*{[\s\S]*will-change:\s*transform/s);
    expect(css).toMatch(/\.workspace-window--resizing\s*{[\s\S]*will-change:\s*width,\s*height/s);
    expect(css).not.toContain("will-change: left, top");
  });
});
