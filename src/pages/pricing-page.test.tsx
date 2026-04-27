// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PricingPage } from "@/pages/pricing-page";

afterEach(() => cleanup());

describe("PricingPage", () => {
  it("renders public pricing without requiring a signed-in shell", () => {
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
});
