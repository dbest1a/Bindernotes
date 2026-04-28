import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

describe("phone and tablet responsive layout styles", () => {
  it("keeps desktop as the default path and scopes adaptive layout to phone and tablet breakpoints", () => {
    expect(css).toContain("@media (max-width: 1180px)");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain(".responsive-mobile-tabs");
  });

  it("prevents horizontal overflow for landing, dashboards, admin, workspace, and settings on phone/tablet", () => {
    expect(css).toMatch(/@media \(max-width: 1180px\)[\s\S]*\.marketing-page[\s\S]*overflow-x:\s*clip/s);
    expect(css).toMatch(/@media \(max-width: 1180px\)[\s\S]*\.admin-dashboard-makeover[\s\S]*overflow-x:\s*clip/s);
    expect(css).toMatch(/@media \(max-width: 1180px\)[\s\S]*\.workspace-page[\s\S]*overflow-x:\s*clip/s);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.app-page[\s\S]*padding-left:\s*0\.75rem/s);
  });

  it("keeps mobile workspace module tabs scrollable and avoids tiny desktop window surfaces", () => {
    expect(css).toMatch(/\.responsive-mobile-tabs\s*{[\s\S]*overflow-x:\s*auto/s);
    expect(css).toMatch(/\.responsive-mobile-module\s*{[\s\S]*min-width:\s*0/s);
    expect(css).toMatch(/@media \(max-width: 1180px\)[\s\S]*\.workspace-canvas-shell[\s\S]*min-height:\s*min\(72svh,\s*720px\)/s);
  });
});
