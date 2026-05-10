import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

function firstRule(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("}", start);
  return css.slice(start, end + 1);
}

describe("study panels sizing styles", () => {
  it("keeps the module toolbar compact so graph and calculator panels have room", () => {
    expect(css).toMatch(/\.study-panels-tab[\s\S]*min-height:\s*2\.32rem/s);
    expect(css).toMatch(/\.study-panels-preset-strip button[\s\S]*min-height:\s*1\.72rem/s);
    expect(css).toMatch(
      /\.study-panels-shell__body--with-drawer[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*clamp\(22rem,\s*28vw,\s*32rem\)/s,
    );
  });

  it("gives Desmos and whiteboard primary panels explicit usable height", () => {
    expect(css).toContain('.study-panels-shell__body[data-study-primary="desmos-graph"]');
    expect(css).toContain('.study-panels-card[data-study-panel-module="desmos-graph"]');
    expect(css).toContain(
      '.study-panels-card[data-study-panel-slot="drawer"][data-study-panel-module="scientific-calculator"]',
    );
  });

  it("lets the Study Panels v2 whiteboard toolbox expand instead of clipping inside the rail width", () => {
    expect(css).toContain('.whiteboard-module-layout[data-whiteboard-sidebar="expanded"]');
    expect(css).toContain('.whiteboard-module-layout[data-whiteboard-sidebar="collapsed"]');
    expect(css).toMatch(
      /data-whiteboard-sidebar="expanded"[\s\S]*grid-template-columns:\s*clamp\(11rem,\s*var\(--whiteboard-sidebar-width,\s*15\.5rem\),\s*min\(25rem,\s*36vw\)\)\s*0\.5rem\s*minmax\(0,\s*1fr\)/s,
    );
    expect(css).toMatch(
      /data-whiteboard-sidebar="collapsed"[\s\S]*grid-template-columns:\s*3\.3rem\s*minmax\(0,\s*1fr\)/s,
    );
    expect(css).toContain(".whiteboard-sidebar-resizer");
    expect(css).toContain(".whiteboard-sidebar-scroll");
  });

  it("keeps focus mode single-panel modules stretched across the available stage", () => {
    expect(css).toContain('.study-panels-shell[data-focus-mode-active="true"] .study-panels-single');
    expect(css).toContain('.study-panels-shell[data-focus-mode-active="true"] .study-panels-card');
    expect(css).toContain(
      '.study-panels-shell[data-focus-mode-active="true"] .study-panels-card[data-study-panel-module="whiteboard"] .whiteboard-module-layout',
    );
  });

  it("keeps Study Panels private notes opaque so helper copy cannot ghost through the editor", () => {
    expect(css).toContain('.study-panels-card[data-study-panel-module="private-notes"]');
    expect(css).toMatch(
      /\.study-panels-card\[data-study-panel-module="private-notes"\][\s\S]*isolation:\s*isolate/s,
    );
    expect(css).toMatch(
      /\.study-panels-card\[data-study-panel-module="private-notes"\] \.private-notes-editor-hero[\s\S]*background:\s*hsl\(var\(--card\)\)/s,
    );
    expect(css).toMatch(
      /\.study-panels-card\[data-study-panel-module="private-notes"\] \.private-notes-editor-frame[\s\S]*background:\s*hsl\(var\(--background\)\)/s,
    );
    expect(css).toMatch(
      /\.study-panels-card\[data-study-panel-module="private-notes"\] \.private-notes-editor-hero ~ \*[\s\S]*display:\s*none !important/s,
    );
    expect(css).toMatch(
      /\.study-panels-card\[data-study-panel-module="private-notes"\] \.private-notes-content[\s\S]*overflow:\s*hidden/s,
    );
    expect(css).toMatch(
      /\.study-panels-card\[data-study-panel-module="private-notes"\] \.private-notes-editor-hero input[\s\S]*text-overflow:\s*ellipsis/s,
    );
  });

  it("does not force desktop Study Panels or Facelift controls into overlaying sticky chrome", () => {
    expect(firstRule(".study-panels-shell__top")).not.toContain("position: sticky");
    expect(firstRule(".study-panels-tabs")).not.toContain("position: sticky");
    expect(firstRule(".facelift-simple-shell__top")).not.toContain("position: sticky");
  });

  it("keeps workspace chrome visible when panel focus is toggled", () => {
    expect(css).not.toContain('html[data-workspace-focus-mode="on"] .workspace-page > nav');
    expect(css).not.toContain('html[data-workspace-focus-mode="on"] .workspace-topbar__meta');
    expect(css).not.toContain('html[data-workspace-focus-mode="on"] .workspace-topbar__presets');
    expect(css).not.toContain('.workspace-page[data-workspace-active-focus="true"] .workspace-topbar__summary');
  });

  it("contains desktop workspace routes so module panes scroll instead of hiding command bars", () => {
    expect(css).toContain(".app-route-transition-shell:has(.workspace-page)");
    expect(css).toContain(".workspace-page > .workspace-sticky-layer");
    expect(css).toContain(".study-panels-stage,\n  .study-panels-shell");
    expect(css).toContain('.study-panels-shell__body[data-study-primary="whiteboard"]');
    expect(css).toContain(".facelift-presentation-stage,\n  .facelift-simple-shell");
  });
});
