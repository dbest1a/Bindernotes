import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

describe("UI refinement polish styles", () => {
  it("keeps the public hero readable on laptop and phone widths", () => {
    expect(css).toContain("UI refinement pass");
    expect(css).toMatch(/@media \(max-width: 1380px\)[\s\S]*\.marketing-hero__notes[\s\S]*display:\s*none/s);
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*\.marketing-hero__inner[\s\S]*flex-direction:\s*column/s);
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*\.marketing-product-scene[\s\S]*min-height:\s*clamp\(310px,\s*82vw,\s*390px\)/s);
  });

  it("adds fast focus, card, dashboard, and settings polish without hiding performance mode", () => {
    expect(css).toContain("--ui-polish-ring");
    expect(css).toMatch(/:where\(a,\s*button,\s*input,\s*textarea,\s*select,\s*summary,\s*\[tabindex\]\):focus-visible/s);
    expect(css).toMatch(/:root\[data-performance-mode="true"\][\s\S]*transition-duration:\s*70ms/s);
    expect(css).toMatch(/\.app-settings-window__search[\s\S]*position:\s*sticky/s);
    expect(css).toMatch(/\.minimal-dashboard-stat:hover,[\s\S]*\.dashboard-continue-card:hover[\s\S]*box-shadow:\s*var\(--ui-polish-shadow-md\)/s);
  });

  it("keeps whiteboard and study controls reachable above drawing surfaces", () => {
    expect(css).toMatch(
      /\.whiteboard-focus-return,[\s\S]*\[data-whiteboard-focus-return="true"\][\s\S]*z-index:\s*calc\(var\(--whiteboard-toolbar-layer\) \+ 10\) !important/s,
    );
    expect(css).toMatch(/\.study-panels-tabbar button,[\s\S]*min-height:\s*2\.1rem/s);
    expect(css).toMatch(/\.whiteboard-module-layout[\s\S]*gap:\s*0\.5rem/s);
  });
});
