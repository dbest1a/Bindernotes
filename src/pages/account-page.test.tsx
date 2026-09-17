// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: "owner-a",
  profilePresent: true,
  deletion: vi.fn(),
  signOut: vi.fn(),
  recovery: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: mocks.owner, email: `${mocks.owner}@example.test` } },
    profile: mocks.profilePresent ? { id: mocks.owner, email: `${mocks.owner}@example.test` } : null,
    signOut: mocks.signOut,
    isLoading: false,
  }),
}));
vi.mock("@/services/account-service", () => ({
  deleteOwnAccount: mocks.deletion,
  requestPasswordRecovery: mocks.recovery,
}));
import { AccountPage } from "./account-page";
function App() {
  return (
    <MemoryRouter initialEntries={["/account"]}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/auth" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner = "owner-a";
  mocks.profilePresent = true;
  vi.stubEnv("VITE_ACCOUNT_DELETION_ENABLED", "true");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
describe("account recovery and async owner boundaries", () => {
  it("renders deletion recovery for an authenticated account whose profile is hidden", () => {
    mocks.profilePresent = false;
    render(<App />);
    expect(screen.getByText("owner-a@example.test")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete my account and data" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Data and backups" }).getAttribute("href")).toBe(
      "/account/data",
    );
    expect(screen.queryByText("Sign-in page")).toBeNull();
  });
  it.each(["delete", "signOut"])(
    "ignores an old account's completed %s action after switching accounts",
    async (operation) => {
      let resolve!: () => void;
      const pending = new Promise<void>((done) => {
        resolve = done;
      });
      mocks.deletion.mockReturnValue(pending);
      mocks.signOut.mockReturnValue(pending);
      const view = render(<App />);
      if (operation === "delete") {
        fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
        fireEvent.click(screen.getByRole("button", { name: "Delete my account and data" }));
      } else fireEvent.click(screen.getByRole("button", { name: "Sign out all devices" }));
      mocks.owner = "owner-b";
      view.rerender(<App />);
      await act(async () => {
        resolve();
        await pending;
      });
      expect(screen.getByText("owner-b@example.test")).toBeTruthy();
      expect(screen.queryByText("Sign-in page")).toBeNull();
      expect(screen.queryByText("Account deleted.")).toBeNull();
      expect(screen.getByLabelText("Type DELETE to confirm")).toHaveProperty("value", "");
    },
  );
});
