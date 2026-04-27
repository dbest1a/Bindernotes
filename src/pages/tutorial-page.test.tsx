// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: {
    id: "admin-1",
    email: "admin@example.com",
    full_name: "Admin",
    role: "admin",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.profile,
  }),
}));

import { TutorialPage } from "@/pages/tutorial-page";

describe("TutorialPage", () => {
  afterEach(() => cleanup());

  it("renders the core tutorial workflow and feature guidance", () => {
    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Learn Binder Notes one small step at a time")).toBeTruthy();
    expect(screen.getByText("Start here")).toBeTruthy();
    expect(screen.getByText("What each button is for")).toBeTruthy();
    expect(screen.getByText("Highlights")).toBeTruthy();
    expect(screen.getByText("Private notes")).toBeTruthy();
    expect(screen.getByText("History tools")).toBeTruthy();
    expect(screen.getByText("Maximize module space")).toBeTruthy();
    expect(screen.getByText("Settings search")).toBeTruthy();
    expect(screen.getByText("Focus canvas")).toBeTruthy();
    expect(screen.getByText("Fit and Tidy")).toBeTruthy();
    expect(screen.getByText("Phone view")).toBeTruthy();
    expect(screen.getByText("Math tools")).toBeTruthy();
    expect(screen.getByText(/Scroll down for more tips/i)).toBeTruthy();
  });

  it("shows quick action links for workspace and admin studio", () => {
    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("link", { name: /start in workspace/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /open admin studio/i })).toBeTruthy();
  });

  it("uses plain what-to-click guidance for the main study flows", () => {
    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Click Dashboard/i)).toBeTruthy();
    expect(screen.getByText(/Click a folder/i)).toBeTruthy();
    expect(screen.getAllByText(/Click Simple View/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Click Canvas/i)).toBeTruthy();
    expect(screen.getByText(/Click Split Study/i)).toBeTruthy();
    expect(screen.getByText(/Click Settings/i)).toBeTruthy();
    expect(screen.getByText(/Type a word like snap, graph, header, or mobile/i)).toBeTruthy();
  });

  it("explains that account work is saved without restoring demo accounts", () => {
    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Your account saves your notes/i)).toBeTruthy();
    expect(screen.queryByText(/demo account/i)).toBeNull();
    expect(screen.queryByText(/learner demo/i)).toBeNull();
  });
});
