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
    expect(css).toContain(".minimal-dashboard-filebar");
    expect(css).toContain(".minimal-dashboard-filebar__menu");
    expect(css).toContain(".minimal-dashboard-filebar__path");
    expect(css).toContain(".minimal-dashboard-main-grid");
    expect(css).toContain(".minimal-folder-grid");
    expect(css).toContain(".minimal-binder-grid");
    expect(css).toContain(".minimal-document-list");
    expect(css).toContain(".minimal-document-row");
    expect(css).toMatch(
      /\.minimal-dashboard-main-grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(18rem,\s*0\.34fr\)/s,
    );
  });

  it("keeps the Minimal New button visually quiet instead of loud and heavy", () => {
    const newButtonBlock = css.match(/\.minimal-dashboard-new-button\s*{(?<body>[\s\S]*?)\n  \}/)?.groups?.body ?? "";

    expect(newButtonBlock).toMatch(/background-color:\s*hsl\(var\(--background\) \/ 0\.94\)/);
    expect(newButtonBlock).toMatch(/font-size:\s*0\.82rem/);
    expect(newButtonBlock).toMatch(/font-weight:\s*700/);
    expect(newButtonBlock).toMatch(/letter-spacing:\s*0/);
    expect(newButtonBlock).not.toContain("linear-gradient");
    expect(newButtonBlock).not.toContain("font-weight: 850");
  });

  it("gives Minimal View density controls a visible compact state", () => {
    expect(css).toContain('.minimal-dashboard-page[data-minimal-density="compact"]');
    expect(css).toMatch(
      /\.minimal-dashboard-page\[data-minimal-density="compact"\][\s\S]*\.minimal-folder-grid[\s\S]*gap:\s*0\.45rem/s,
    );
    expect(css).toMatch(
      /\.minimal-dashboard-page\[data-minimal-density="compact"\][\s\S]*\.minimal-binder-card[\s\S]*min-height:\s*6\.6rem/s,
    );
  });

  it("lets Minimal View use the full browser width when requested", () => {
    expect(css).toContain('.minimal-dashboard-page[data-minimal-width="full"]');
    expect(css).toMatch(
      /\.minimal-dashboard-page\[data-minimal-width="full"\][\s\S]*max-width:\s*none/s,
    );
    expect(css).toMatch(
      /\.minimal-dashboard-page\[data-minimal-width="full"\][\s\S]*\.minimal-folder-grid[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*13rem\),\s*1fr\)\)/s,
    );
  });

  it("defines the redesigned Normal dashboard around the same workspace controls", () => {
    expect(css).toContain(".normal-dashboard-page");
    expect(css).toMatch(
      /\.normal-dashboard-page[\s\S]*--minimal-border:\s*hsl\(var\(--border\) \/ 0\.76\)/s,
    );
    expect(css).toMatch(
      /\.normal-dashboard-page \.minimal-dashboard-command-bar[\s\S]*grid-template-columns:\s*minmax\(18rem,\s*1fr\)\s*minmax\(14rem,\s*0\.64fr\)\s*minmax\(18rem,\s*0\.85fr\)\s*auto/s,
    );
    expect(css).toMatch(
      /\.normal-dashboard-page \.minimal-dashboard-filebar[\s\S]*background:\s*hsl\(var\(--card\) \/ 0\.96\)/s,
    );
  });

  it("makes Normal richer than Minimal while keeping the same workspace controls", () => {
    expect(css).toContain(".normal-dashboard-page .minimal-dashboard-command-bar::before");
    expect(css).toContain(".normal-dashboard-page .minimal-dashboard-command-bar__identity .inline-flex");
    expect(css).toMatch(
      /\.normal-dashboard-page \.minimal-dashboard-stat[\s\S]*background:\s*linear-gradient\(135deg,\s*hsl\(var\(--background\) \/ 0\.92\),\s*hsl\(var\(--accent\) \/ 0\.34\)\)/s,
    );
    expect(css).toMatch(
      /\.normal-dashboard-page \.minimal-folder-card::before[\s\S]*background:\s*linear-gradient\(180deg,\s*hsl\(var\(--primary\) \/ 0\.18\),\s*transparent\)/s,
    );
    expect(css).toMatch(
      /\.normal-dashboard-page \.minimal-binder-card__cover[\s\S]*background:\s*linear-gradient\(135deg,\s*hsl\(var\(--primary\) \/ 0\.22\),\s*hsl\(var\(--accent\) \/ 0\.76\),\s*hsl\(var\(--secondary\) \/ 0\.84\)\)/s,
    );
  });

  it("lets the redesigned Normal dashboard persist full width and compact density", () => {
    expect(css).toMatch(
      /\.normal-dashboard-page\[data-dashboard-width="full"\][\s\S]*max-width:\s*none/s,
    );
    expect(css).toMatch(
      /\.normal-dashboard-page\[data-dashboard-density="compact"\] \.minimal-folder-card[\s\S]*min-height:\s*6\.1rem/s,
    );
    expect(css).toMatch(
      /\.normal-dashboard-page\[data-dashboard-width="full"\] \.minimal-binder-grid[\s\S]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*14rem\),\s*1fr\)\)/s,
    );
  });

  it("defines Admin Makeover as the premium command-center dashboard", () => {
    expect(css).toContain(".admin-dashboard-command-bar");
    expect(css).toContain(".admin-dashboard-filebar");
    expect(css).toContain(".admin-dashboard-new-button");
    expect(css).toContain(".admin-dashboard-create-card");
    expect(css).toMatch(
      /\.admin-dashboard-makeover\[data-admin-dashboard-width="full"\][\s\S]*\.admin-dashboard-command-bar[\s\S]*max-width:\s*none/s,
    );
    expect(css).toMatch(
      /\.admin-dashboard-makeover\[data-admin-dashboard-density="compact"\][\s\S]*\.admin-folder-grid[\s\S]*gap:\s*0\.55rem/s,
    );
  });

  it("keeps Admin Makeover motion premium but disabled by performance safeguards", () => {
    expect(css).toMatch(
      /:root\[data-admin-motion="on"\] \.admin-dashboard-command-bar[\s\S]*admin-dashboard-land/s,
    );
    expect(css).toMatch(
      /:root\[data-performance-mode="on"\] \.admin-dashboard-command-bar[\s\S]*animation:\s*none !important/s,
    );
  });

  it("keeps Admin Makeover command menus above sections without horizontal overflow", () => {
    expect(css).toMatch(
      /\.admin-dashboard-command-bar\s*{[\s\S]*z-index:\s*6/s,
    );
    expect(css).toMatch(
      /\.admin-dashboard-filebar\s*{[\s\S]*flex-wrap:\s*wrap/s,
    );
    expect(css).toMatch(
      /\.admin-dashboard-filebar__menu\s*{[\s\S]*z-index:\s*40/s,
    );
    expect(css).toMatch(
      /\.admin-dashboard-filebar__path\s*{[\s\S]*flex:\s*1 1 16rem/s,
    );
  });
});
