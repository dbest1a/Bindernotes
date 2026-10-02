// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/types";

const mocks = vi.hoisted(() => {
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
    signIn,
    signInWithGoogle,
    signUp,
    requestPasswordReset: vi.fn(),
    resendConfirmation: vi.fn(),
    updatePassword: vi.fn(),
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
    requestPasswordReset: mocks.requestPasswordReset,
    resendConfirmation: mocks.resendConfirmation,
    updatePassword: mocks.updatePassword,
    session: null,
    isConfigured: mocks.authState.isConfigured,
  }),
}));

import { AuthPage } from "@/pages/auth-page";

describe("AuthPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.signIn.mockReset();
    mocks.signInWithGoogle.mockReset();
    mocks.signUp.mockReset();
    mocks.authState.profile = null;
    mocks.authState.isConfigured = false;
  });

  it("opens account creation directly, explains passwords, and preserves deep links through email confirmation", async () => {
    mocks.authState.isConfigured = true;
    mocks.signUp.mockResolvedValue({ confirmationRequired: true });
    render(<MemoryRouter initialEntries={["/auth?mode=signup&next=%2Ftutorial"]}><AuthPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
    expect(screen.getByText(/Use at least 6 characters/)).toBeTruthy();
    expect(screen.queryByText(/SQL editor/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", expect.stringContaining("Check your email"));
    expect(mocks.signUp).toHaveBeenCalledWith("reader@example.com", "correct-password", "reader", "learner", "/tutorial");
    fireEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    await waitFor(() => expect(mocks.resendConfirmation).toHaveBeenCalledWith("reader@example.com", "/tutorial"));
  });

  it("clears wrong-password errors on mode change and sends recovery without a password", async () => {
    mocks.authState.isConfigured = true;
    mocks.signIn.mockRejectedValue(new Error("Invalid login credentials"));
    render(<MemoryRouter><AuthPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Invalid login"));
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() => expect(mocks.requestPasswordReset).toHaveBeenCalledWith("reader@example.com"));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", expect.stringContaining("If an account"));
  });

  it("does not expose demo access when Supabase is unavailable", () => {
    render(
      <MemoryRouter initialEntries={["/auth?next=%2Fbinders%2Fbinder-1%2Fdocuments%2Flesson-1"]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /demo/i })).toBeNull();
    expect(screen.getByText("Account sign-in is not ready")).toBeTruthy();
    expect(document.querySelector("[data-auth-config-missing='true']")).toBeTruthy();
    const submitButton = screen
      .getAllByRole("button", { name: "Login" })
      .find((button) => button.getAttribute("type") === "submit");
    expect(submitButton?.hasAttribute("disabled")).toBe(true);
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

  it("uses password-manager friendly login field metadata", () => {
    mocks.authState.isConfigured = true;

    render(
      <MemoryRouter initialEntries={["/auth?next=%2Ftutorial"]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const form = emailInput.closest("form");

    expect(form?.getAttribute("autocomplete")).toBe("on");
    expect(form?.getAttribute("data-form-type")).toBe("login");
    expect(emailInput.getAttribute("id")).toBe("auth-email");
    expect(emailInput.getAttribute("name")).toBe("email");
    expect(emailInput.getAttribute("type")).toBe("email");
    expect(emailInput.getAttribute("autocomplete")).toBe("username");
    expect(passwordInput.getAttribute("id")).toBe("auth-password");
    expect(passwordInput.getAttribute("name")).toBe("password");
    expect(passwordInput.getAttribute("type")).toBe("password");
    expect(passwordInput.getAttribute("autocomplete")).toBe("current-password");
  });
});
