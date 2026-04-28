import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

describe("admin perceived performance styles", () => {
  it("uses admin-themed skeletons instead of raw black pulse blocks", () => {
    expect(css).toContain(".admin-themed-skeleton");
    expect(css).toContain("admin-skeleton-sheen");
  });

  it("keeps Admin Studio shells visually equivalent without large backdrop blur repaint areas", () => {
    expect(css).toMatch(/\.admin-studio-page \.page-shell\s*{[\s\S]*backdrop-filter:\s*none/s);
    expect(css).toMatch(/\.admin-studio-page \.page-shell\s*{[\s\S]*linear-gradient/s);
  });

  it("pauses expensive admin dashboard animation work only during active scrolling", () => {
    expect(css).toContain('.admin-dashboard-makeover[data-admin-scrolling="active"]');
    expect(css).toMatch(/data-admin-scrolling="active"[\s\S]*animation-play-state:\s*paused/s);
  });

  it("keeps dashboard decorative layers in a stable stacking context", () => {
    const dashboardCss = css.slice(css.indexOf(".admin-dashboard-makeover"));
    expect(dashboardCss).toMatch(/\.admin-dashboard-makeover::before\s*{[\s\S]*z-index:\s*0/s);
    expect(dashboardCss).toMatch(/\.admin-dashboard-makeover::after\s*{[\s\S]*z-index:\s*0/s);
    expect(dashboardCss).not.toMatch(/z-index:\s*-[12]/);
  });

  it("does not animate large dashboard shadows during idle or scroll", () => {
    const panelBreathe = css.slice(css.indexOf("@keyframes admin-dashboard-panel-breathe"));
    expect(panelBreathe.slice(0, panelBreathe.indexOf("@keyframes admin-dashboard-icon-float"))).not.toContain(
      "box-shadow",
    );
    expect(css).toMatch(/\.admin-dashboard-hero__copy,[\s\S]*backdrop-filter:\s*none/s);
  });
});
