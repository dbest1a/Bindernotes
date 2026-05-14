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

  it("lets the v2 Split Actions row wrap without overlapping the lesson and notes panes", () => {
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-compact-action-row[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column[\s\S]*margin-block:\s*0\.15rem 1rem[\s\S]*padding-bottom:\s*0\.2rem/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-compact-action-row__header[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-action-row-toggle[\s\S]*border-radius:\s*999px[\s\S]*transition:/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-compact-action-row__content[\s\S]*display:\s*block[\s\S]*overflow:\s*hidden[\s\S]*transition:/s,
    );
    expect(css).toMatch(
      /\.study-panels-compact-action-row\[data-study-actions-state="collapsed"\][\s\S]*\.study-panels-compact-action-row__content[\s\S]*max-height:\s*0[\s\S]*opacity:\s*0[\s\S]*visibility:\s*hidden/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-compact-action-row \.study-panels-guided-actions[\s\S]*position:\s*static !important[\s\S]*inset:\s*auto !important[\s\S]*bottom:\s*auto !important[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-compact-action-row \.study-panels-panel-controls[\s\S]*min-width:\s*0[\s\S]*justify-self:\s*end/s,
    );
    expect(css).toMatch(
      /\.study-panels-panel-controls button span[\s\S]*overflow:\s*hidden[\s\S]*text-overflow:\s*ellipsis[\s\S]*white-space:\s*nowrap/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-compact-action-row \.study-panels-guided-actions > div:first-child[\s\S]*display:\s*none/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-compact-action-row \.study-panels-guided-actions__buttons[\s\S]*justify-content:\s*flex-start/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-shell__body[\s\S]*padding-top:\s*0\.1rem/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-shell__body\[data-study-action-row="visible"\][\s\S]*margin-top:\s*0\.45rem[\s\S]*padding-top:\s*0\.25rem/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\][\s\S]*\.study-panels-shell__body\[data-study-action-row="visible"\]\[data-study-actions-state="expanded"\][\s\S]*margin-top:\s*0\.9rem[\s\S]*padding-top:\s*0\.45rem/s,
    );
    expect(css).toContain("@keyframes study-panels-action-spark");
  });

  it("keeps narrow v2 private notes and board panes usable instead of clipping their UI", () => {
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-card\[data-study-panel-module="private-notes"\]\[data-study-panel-slot="secondary"\] \.private-notes-editor-hero input[\s\S]*font-size:\s*clamp\(1rem,\s*1\.1vw \+ 0\.65rem,\s*1\.35rem\)[\s\S]*text-overflow:\s*ellipsis/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-card\[data-study-panel-module="private-notes"\]\[data-study-panel-slot="secondary"\] \.private-notes-overview h4[\s\S]*-webkit-line-clamp:\s*2/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-card\[data-study-panel-module="private-notes"\]\[data-study-panel-slot="secondary"\] \.private-notes-editor > div:first-child button[\s\S]*width:\s*2rem[\s\S]*height:\s*2rem/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-shell__body\[data-study-primary="whiteboard"\] \.study-panels-split[\s\S]*min-height:\s*clamp\(38rem,\s*calc\(100svh - 11\.2rem\),\s*66rem\)/s,
    );
    expect(css).toMatch(
      /\.study-panels-shell\[data-study-panels-v2="true"\] \.study-panels-resize-handle[\s\S]*cursor:\s*col-resize[\s\S]*touch-action:\s*none/s,
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
