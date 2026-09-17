import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.tsx", "utf8");

describe("public beta preview routes", () => {
  it("registers the Beta Revamp homepage preview route locally", () => {
    expect(appSource).toContain('path="/homepage-beta"');
    expect(appSource).toContain("element={<HomepageBetaPage />}");
  });

  it("keeps beta pricing on a separate preview route", () => {
    expect(appSource).toContain('path="/pricing"');
    expect(appSource).toContain("element={<PricingPage />}");
    expect(appSource).toContain('path="/pricing-beta"');
    expect(appSource).toContain("element={<PricingBetaPage />}");
  });

  it("registers the beta Review Queue route inside the authenticated workspace", () => {
    expect(appSource).toContain('path="/review"');
    expect(appSource).toContain("element={<ReviewPage />}");
  });
});
