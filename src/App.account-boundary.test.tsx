// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { App } from "@/App";

const mocks = vi.hoisted(() => ({ auth: { user: { id: "A" } as { id: string } | null, profile: { id: "A" }, isLoading: false } }));
vi.mock("@/hooks/use-auth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => mocks.auth,
}));
vi.mock("@/components/system/authenticated-app-providers", () => ({ AuthenticatedAppProviders: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: () => <Outlet /> }));
vi.mock("@/components/tutorials/tutorial-prompt", () => ({ TutorialPromptHost: () => null }));
vi.mock("@/pages/auth-page", () => ({ AuthPage: () => <p>Sign in required</p> }));
vi.mock("@/pages/dashboard-page", () => ({ DashboardPage: () => {
  const [draft, setDraft] = useState("");
  return <input aria-label="Private draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
} }));

describe("protected account subtree", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/dashboard");
    mocks.auth = { user: { id: "A" }, profile: { id: "A" }, isLoading: false };
  });
  afterEach(cleanup);

  it("keeps same-account drafts and resets private state on an immediate owner change", async () => {
    const view = render(<App />);
    const draft = await screen.findByLabelText("Private draft");
    fireEvent.change(draft, { target: { value: "A private wording" } });
    mocks.auth = { ...mocks.auth, user: { id: "A" }, profile: { id: "A" } };
    view.rerender(<App />);
    expect((screen.getByLabelText("Private draft") as HTMLInputElement).value).toBe("A private wording");
    mocks.auth = { ...mocks.auth, user: { id: "B" }, profile: { id: "B" } };
    view.rerender(<App />);
    await waitFor(() => expect((screen.getByLabelText("Private draft") as HTMLInputElement).value).toBe(""));
  });

  it.each([null, { id: "B" }])("does not admit a profile without its matching session: %s", async (user) => {
    mocks.auth.user = user;
    render(<App />);
    await screen.findByText("Sign in required");
    expect(screen.queryByLabelText("Private draft")).toBeNull();
  });
});
