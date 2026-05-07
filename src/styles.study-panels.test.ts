import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

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
});
