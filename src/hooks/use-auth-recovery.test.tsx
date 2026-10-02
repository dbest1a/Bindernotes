// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(), resend: vi.fn(), updateUser: vi.fn(),
  getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
}));
vi.mock("@/lib/supabase-config", () => ({ isSupabaseConfigured: true, supabaseConfig: { url: "https://auth-test.supabase.co", anonKey: "test-public-key" } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: mocks }) }));
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useState } from "react";
function Harness() {
  const auth = useAuth();
  const [result, setResult] = useState("");
  return <><output data-testid="loading">{String(auth.isLoading)}</output><output data-testid="result">{result}</output>
    <button onClick={() => void auth.signUp("learner@example.com", "unique-pass", "Learner", "learner", "/math").then((value) => setResult(String(value.confirmationRequired)))}>Sign up</button>
    <button onClick={() => void auth.requestPasswordReset("learner@example.com")}>Reset</button>
    <button onClick={() => void auth.resendConfirmation("learner@example.com", "/math")}>Resend</button>
    <button onClick={() => void auth.updatePassword("new-unique-pass")}>Update</button>
  </>;
}
beforeEach(() => {
  mocks.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  mocks.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  mocks.resend.mockReset().mockResolvedValue({ error: null });
  mocks.updateUser.mockReset().mockResolvedValue({ error: null });
});
afterEach(cleanup);
describe("auth confirmation and recovery API contract", () => {
  it("ends the loading state after confirmation-required signup and preserves the return route", async () => {
    render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("true"));
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(mocks.signUp).toHaveBeenCalledWith({ email: "learner@example.com", password: "unique-pass", options: { emailRedirectTo: `${window.location.origin}/auth?next=%2Fmath`, data: { full_name: "Learner" } } });
  });
  it("uses the recovery callback and signup resend APIs without changing account roles", async () => {
    render(<AuthProvider><Harness /></AuthProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("learner@example.com", { redirectTo: `${window.location.origin}/auth?mode=update-password` }));
    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    await waitFor(() => expect(mocks.resend).toHaveBeenCalledWith({ type: "signup", email: "learner@example.com", options: { emailRedirectTo: `${window.location.origin}/auth?next=%2Fmath` } }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-unique-pass" }));
  });
});
