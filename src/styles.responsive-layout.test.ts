import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

describe("phone and tablet responsive layout styles", () => {
  it("keeps desktop as the default path and scopes adaptive layout to phone and tablet breakpoints", () => {
    expect(css).toContain("@media (max-width: 1180px)");
    expect(css).toContain("@media (min-width: 768px) and (max-width: 1180px)");
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

  it("adds an iPad/tablet landing composition without changing the desktop default or phone fix", () => {
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1180px\)[\s\S]*\.marketing-hero__inner\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.9fr\) minmax\(0,\s*1\.1fr\)/s,
    );
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1180px\)[\s\S]*\.marketing-product-scene\s*{[\s\S]*order:\s*0/s,
    );
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1180px\)[\s\S]*\.marketing-product-scene__depth\[data-depth="front"\]\s*{[\s\S]*--depth-transform:\s*translateZ\(60px\) translateX\(-1%\) scale\(0\.72\) rotate\(-2deg\)/s,
    );
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 960px\) and \(orientation: portrait\)[\s\S]*\.marketing-hero__inner\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
  });

  it("scopes the landing hero product preview fit fix to phone widths only", () => {
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.marketing-product-scene\s*{[\s\S]*width:\s*min\(100%,\s*calc\(100svw - 1\.5rem\)\)/s,
    );
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.marketing-product-scene__depth\[data-depth="front"\]\s*{[\s\S]*--depth-transform:\s*translateZ\(0\) translateX\(0\) scale\(0\.88\) rotate\(-1deg\)/s,
    );
    expect(css).not.toMatch(/@media \(max-width: 767px\)[\s\S]*scale\(0\.72\)/s);
  });

  it("keeps route loading skeletons sized for iPad without changing phone or desktop defaults", () => {
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1180px\)[\s\S]*\.app-loading-shell\s*{[\s\S]*width:\s*min\(100%,\s*calc\(100svw - 2rem\)\)/s,
    );
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1180px\)[\s\S]*\.app-loading-shell__panel\s*{[\s\S]*height:\s*min\(62svh,\s*620px\)/s,
    );
  });
});
