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

    expect(screen.getByText("Learn Binder Notes fast")).toBeTruthy();
    expect(screen.getByText("10-minute walkthrough")).toBeTruthy();
    expect(screen.getByText("How each core feature works")).toBeTruthy();
    expect(screen.getByText("Highlights")).toBeTruthy();
    expect(screen.getByText("Private Notes")).toBeTruthy();
    expect(screen.getByText("History Suite")).toBeTruthy();
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
});
