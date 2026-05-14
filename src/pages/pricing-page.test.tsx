// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { betaFeaturesStorageKeyForUser } from "@/lib/beta-features";
import { PricingBetaPage, PricingPage } from "@/pages/pricing-page";

const pricingProfileId = "pricing-user";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: { id: pricingProfileId },
  }),
}));

function setCalmStudyHomepageBeta(enabled: boolean) {
  window.localStorage.setItem(
    betaFeaturesStorageKeyForUser(pricingProfileId),
    JSON.stringify({
      enabled,
      betaRevampCalmStudyHomepage: enabled,
    }),
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("PricingPage", () => {
  it("renders the existing public pricing when the calm study homepage beta is off", () => {
    render(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Public pricing, no login wall")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pricing for the study workspace you actually use." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Free" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Plus" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Studio" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Everything" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Start/i })[0].getAttribute("href")).toBe("/auth");
  });

  it("uses compact comparison icons for simple included and missing states", () => {
    render(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByLabelText("Included").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Not included").length).toBeGreaterThan(0);
    expect(screen.getByText("3 boards")).toBeTruthy();
    expect(screen.getByText("Full controls")).toBeTruthy();
  });

  it("answers pricing questions interactively", () => {
    render(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Is Desmos included?" }));

    expect(screen.getByText("Yes. BinderNotes includes Desmos-powered graphing inside the math study flow.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Is Desmos included?" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps the standard four-plan pricing on /pricing even when the homepage beta flag is on", () => {
    setCalmStudyHomepageBeta(true);

    render(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("beta-pricing-page")).toBeNull();
    expect(screen.getByRole("heading", { name: "Four clear paths. No maze of hidden packages." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Everything" })).toBeTruthy();
  });

  it("renders the simpler Beta Revamp pricing message only on the beta pricing page", () => {
    setCalmStudyHomepageBeta(true);

    render(
      <MemoryRouter initialEntries={["/pricing-beta"]}>
        <PricingBetaPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("beta-pricing-page").getAttribute("data-beta-pricing-model")).toBe("simple");
    expect(screen.getByRole("heading", { name: "Pricing that keeps the study habit simple." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Free" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Plus" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Studio later / for tutors" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Everything" })).toBeNull();
    expect(screen.queryByRole("table", { name: "Plan comparison" })).toBeNull();
    expect(screen.queryByText(/Four clear paths|Everything unlocked|\$35/i)).toBeNull();
    expect(screen.getAllByRole("link", { name: /Start/i })[0].getAttribute("href")).toBe("/auth");
  });

  it("keeps the beta pricing route gated when the beta flag is off", () => {
    render(
      <MemoryRouter initialEntries={["/pricing-beta"]}>
        <PricingBetaPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("beta-pricing-page")).toBeNull();
    expect(screen.getByRole("heading", { name: "Four clear paths. No maze of hidden packages." })).toBeTruthy();
  });

  it("keeps beta pricing trust copy account-owned without demo workspace language", () => {
    setCalmStudyHomepageBeta(true);

    render(
      <MemoryRouter initialEntries={["/pricing-beta"]}>
        <PricingBetaPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Real accounts, not demo workspaces/i)).toBeTruthy();
    expect(screen.getByText(/Notes are user-owned/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /demo/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/try demo|enter demo|demo sign-in/i);
  });
});
