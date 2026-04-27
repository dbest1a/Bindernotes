// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "@/pages/landing-page";

afterEach(() => cleanup());

describe("LandingPage", () => {
  it("renders a conversion-focused public homepage with product visuals", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Study notes that feel like a living, premium workspace." })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Start/i })[0].getAttribute("href")).toBe("/auth");
    expect(screen.getAllByText("Split Study").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Math Whiteboard Lab").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Desmos Graph").length).toBeGreaterThan(0);
    expect(screen.getByText("APIs + open source")).toBeTruthy();
    expect(screen.getAllByText(/Built-in Desmos graphing/i).length).toBeGreaterThan(0);
  });

  it("switches the product showcase without leaving the page", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Whiteboard Lab" }));

    expect(screen.getByRole("tab", { name: "Whiteboard Lab" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("A math whiteboard that still knows your binder.")).toBeTruthy();
  });
});
