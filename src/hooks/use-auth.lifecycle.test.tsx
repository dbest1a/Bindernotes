// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import type { Profile } from "@/types";
import { NOTE_SAVE_BEFORE_SIGN_OUT_EVENT } from "@/lib/note-save";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), getProfile: vi.fn(), onAuthStateChange: vi.fn(),
  signOut: vi.fn(), setAccount: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock("@/lib/supabase-config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: mocks } }));
vi.mock("@/services/auth-profile", () => ({ getProfile: mocks.getProfile }));
vi.mock("@/lib/save-queue", () => ({ saveQueue: { setAccount: mocks.setAccount } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const session = (id: string) => ({ user: { id, email: `${id}@example.test` } }) as Session;
const profile = (id: string) => ({ id, role: "learner", full_name: id }) as Profile;
let listener: (event: AuthChangeEvent, nextSession: Session | null) => void;

async function emit(event: AuthChangeEvent, nextSession: Session | null) {
  await act(async () => { listener(event, nextSession); });
}
const mount = () => renderHook(useAuth, { wrapper: AuthProvider });

describe("auth account lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: session("A") }, error: null });
    mocks.getProfile.mockImplementation(async (id: string) => profile(id));
    mocks.onAuthStateChange.mockImplementation((callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
    mocks.signOut.mockResolvedValue({ error: null });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it.each(["resolve", "reject"] as const)("ignores a profile refresh that %ss after logout", async (outcome) => {
    const view = mount();
    await waitFor(() => expect(view.result.current.profile?.id).toBe("A"));
    const pending = deferred<Profile>();
    mocks.getProfile.mockReturnValueOnce(pending.promise);
    await emit("USER_UPDATED", session("A"));
    await waitFor(() => expect(mocks.getProfile).toHaveBeenCalledTimes(2));
    await emit("SIGNED_OUT", null);
    await act(async () => {
      if (outcome === "resolve") pending.resolve(profile("A"));
      else pending.reject(new Error("obsolete profile error"));
    });
    expect(view.result.current).toMatchObject({ user: null, profile: null, isLoading: false });
    expect(mocks.setAccount).toHaveBeenLastCalledWith(null);
  });

  it.each([
    ["A-first", "resolve"], ["A-first", "reject"],
    ["B-first", "resolve"], ["B-first", "reject"],
  ] as const)("keeps B authoritative with %s and late A %s", async (order, outcome) => {
    const a = deferred<Profile>();
    const b = deferred<Profile>();
    mocks.getProfile.mockImplementation((id: string) => id === "A" ? a.promise : b.promise);
    const view = mount();
    await waitFor(() => expect(mocks.getProfile).toHaveBeenCalledWith("A", "A@example.test"));
    await emit("SIGNED_IN", session("B"));
    await waitFor(() => expect(mocks.getProfile).toHaveBeenCalledWith("B", "B@example.test"));
    const finishA = async () => act(async () => {
      if (outcome === "resolve") a.resolve(profile("A"));
      else a.reject(new Error("obsolete profile error"));
    });
    if (order === "A-first") {
      await finishA();
      expect(view.result.current).toMatchObject({ user: { id: "B" }, profile: null, isLoading: true });
    }
    await act(async () => { b.resolve(profile("B")); });
    if (order === "B-first") await finishA();
    expect(view.result.current).toMatchObject({ user: { id: "B" }, profile: { id: "B" }, isLoading: false });
    expect(mocks.setAccount).toHaveBeenLastCalledWith("B");
  });

  it.each(["resolve", "reject"] as const)("ignores an initial session read that %ss after a newer auth event", async (outcome) => {
    const pending = deferred<{ data: { session: Session }; error: null }>();
    mocks.getSession.mockReturnValueOnce(pending.promise);
    const view = mount();
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    await emit("SIGNED_IN", session("B"));
    await waitFor(() => expect(view.result.current.profile?.id).toBe("B"));
    await act(async () => {
      if (outcome === "resolve") pending.resolve({ data: { session: session("A") }, error: null });
      else pending.reject(new Error("obsolete session error"));
    });
    expect(view.result.current).toMatchObject({ user: { id: "B" }, profile: { id: "B" }, isLoading: false });
  });

  it("preserves same-user profile and foreground state during refresh", async () => {
    const view = mount();
    await waitFor(() => expect(view.result.current.profile?.id).toBe("A"));
    const pending = deferred<Profile>();
    mocks.getProfile.mockReturnValueOnce(pending.promise);
    await emit("SIGNED_IN", session("A"));
    expect(view.result.current).toMatchObject({ profile: { id: "A" }, isLoading: false });
    await emit("TOKEN_REFRESHED", session("A"));
    expect(view.result.current).toMatchObject({ profile: { id: "A" }, isLoading: false });
    await act(async () => { pending.resolve(profile("A")); });
    expect(view.result.current.profile?.id).toBe("A");
  });

  it("blocks identity changes even when the event normally hydrates in the background", async () => {
    const view = mount();
    await waitFor(() => expect(view.result.current.profile?.id).toBe("A"));
    const pending = deferred<Profile>();
    mocks.getProfile.mockReturnValueOnce(pending.promise);
    await emit("USER_UPDATED", session("B"));
    expect(view.result.current).toMatchObject({ user: { id: "B" }, profile: null, isLoading: true });
    await act(async () => { pending.resolve(profile("B")); });
  });

  it("clears local identity after explicit sign-out even without an auth callback", async () => {
    const view = mount();
    await waitFor(() => expect(view.result.current.profile?.id).toBe("A"));
    await act(async () => { await view.result.current.signOut(); });
    expect(view.result.current).toMatchObject({ user: null, profile: null, isLoading: false });
    expect(mocks.setAccount).toHaveBeenLastCalledWith(null);
  });

  it("rejects a mismatched returned profile", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getProfile.mockResolvedValueOnce(profile("B"));
    const view = mount();
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    expect(view.result.current).toMatchObject({ user: { id: "A" }, profile: null });
  });

  it("does not sign out B or unblock B hydration when A's save-before-sign-out finishes late", async () => {
    const view = mount();
    await waitFor(() => expect(view.result.current.profile?.id).toBe("A"));
    const flush = deferred<void>();
    const b = deferred<Profile>();
    const beforeSignOut = (event: Event) => {
      (event as CustomEvent<{ promises: Promise<unknown>[] }>).detail.promises.push(flush.promise);
    };
    window.addEventListener(NOTE_SAVE_BEFORE_SIGN_OUT_EVENT, beforeSignOut);
    let signOut!: Promise<void>;
    act(() => { signOut = view.result.current.signOut(); });
    mocks.getProfile.mockReturnValueOnce(b.promise);
    await emit("SIGNED_IN", session("B"));
    await act(async () => { flush.resolve(); await signOut; });
    window.removeEventListener(NOTE_SAVE_BEFORE_SIGN_OUT_EVENT, beforeSignOut);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(view.result.current).toMatchObject({ user: { id: "B" }, profile: null, isLoading: true });
    await act(async () => { b.resolve(profile("B")); });
    expect(view.result.current).toMatchObject({ profile: { id: "B" }, isLoading: false });
  });

  it("retires the account on unmount and ignores a late profile result", async () => {
    const pending = deferred<Profile>();
    mocks.getProfile.mockReturnValueOnce(pending.promise);
    const view = mount();
    await waitFor(() => expect(mocks.getProfile).toHaveBeenCalled());
    view.unmount();
    await act(async () => { pending.resolve(profile("A")); });
    expect(mocks.setAccount).toHaveBeenLastCalledWith(null);
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
