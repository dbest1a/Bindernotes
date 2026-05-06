import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

describe("minimal dashboard appearance styles", () => {
  it("scopes compact dashboard styling to the Minimal appearance data attribute", () => {
    expect(css).toContain('.dashboard-page[data-dashboard-appearance="minimal"]');
    expect(css).toMatch(
      /\.dashboard-page\[data-dashboard-appearance="minimal"\][\s\S]*--dashboard-card-padding:\s*1rem/s,
    );
    expect(css).toMatch(
      /\.dashboard-page\[data-dashboard-appearance="minimal"\][\s\S]*--dashboard-card-radius:\s*0\.55rem/s,
    );
  });

  it("keeps Minimal responsive without horizontal overflow on phone widths", () => {
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.dashboard-page\[data-dashboard-appearance="minimal"\][\s\S]*overflow-x:\s*clip/s,
    );
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.dashboard-page\[data-dashboard-appearance="minimal"\] \.dashboard-minimal-grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
  });

  it("defines the distinct compact Minimal workspace surfaces", () => {
    expect(css).toContain(".minimal-dashboard-command-bar");
    expect(css).toContain(".minimal-dashboard-main-grid");
    expect(css).toContain(".minimal-folder-grid");
    expect(css).toContain(".minimal-binder-grid");
    expect(css).toContain(".minimal-document-list");
    expect(css).toContain(".minimal-document-row");
    expect(css).toMatch(
      /\.minimal-dashboard-main-grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(18rem,\s*0\.34fr\)/s,
    );
  });
});
