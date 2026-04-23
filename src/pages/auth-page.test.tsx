// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/types";

const mocks = vi.hoisted(() => {
  const enterDemo = vi.fn();
  const signIn = vi.fn();
  const signInWithGoogle = vi.fn();
  const signUp = vi.fn();
  const profile: Profile = {
    id: "demo-user",
    email: "learner@example.com",
    full_name: "Demo Learner",
    role: "learner",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  return {
    enterDemo,
    signIn,
    signInWithGoogle,
    signUp,
    profile,
    authState: {
      profile: null as Profile | null,
      isConfigured: false,
    },
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.authState.profile,
    signIn: mocks.signIn,
    signInWithGoogle: mocks.signInWithGoogle,
    signUp: mocks.signUp,
    enterDemo: mocks.enterDemo,
    isConfigured: mocks.authState.isConfigured,
  }),
}));

import { AuthPage } from "@/pages/auth-page";

describe("AuthPage", () => {
  beforeEach(() => {
    mocks.enterDemo.mockReset();
    mocks.signIn.mockReset();
    mocks.signInWithGoogle.mockReset();
    mocks.signUp.mockReset();
    mocks.authState.profile = null;
    mocks.authState.isConfigured = false;
  });

  it("sends demo users back to the requested route instead of always dumping them on dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/auth?next=%2Fbinders%2Fbinder-1%2Fdocuments%2Flesson-1"]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/binders/:binderId/documents/:lessonId" element={<div>Lesson route</div>} />
          <Route path="/dashboard" element={<div>Dashboard route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Learner demo" }));

    expect(mocks.enterDemo).toHaveBeenCalledWith("learner");
    expect(screen.getByText("Lesson route")).toBeTruthy();
  });

  it("redirects signed-in users to the requested route when one exists", () => {
    mocks.authState.profile = mocks.profile;

    render(
      <MemoryRouter initialEntries={["/auth?next=%2Fbinders%2Fbinder-1%2Fdocuments%2Flesson-1"]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/binders/:binderId/documents/:lessonId" element={<div>Lesson route</div>} />
          <Route path="/dashboard" element={<div>Dashboard route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Lesson route").length).toBeGreaterThan(0);
  });

  it("starts Google auth with the requested next route when configured", () => {
    mocks.authState.isConfigured = true;

    render(
      <MemoryRouter initialEntries={["/auth?next=%2Fbinders%2Fbinder-1%2Fdocuments%2Flesson-1"]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(mocks.signInWithGoogle).toHaveBeenCalledWith("/binders/binder-1/documents/lesson-1");
  });
});
