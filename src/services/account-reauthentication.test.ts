// @vitest-environment jsdom
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.generated";
import { saveQueue } from "@/lib/save-queue";
const state = vi.hoisted(() => ({ client: null as SupabaseClient<Database> | null }));
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return state.client;
  },
}));
vi.mock("@/lib/supabase-config", () => ({
  supabaseConfig: { url: "https://fixture.invalid", anonKey: "fixture-anon" },
}));
import { deleteOwnAccount } from "./account-service";
import { confirmAccountPassword } from "./account-reauthentication";
const owner = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
function tokenResponse(id: string) {
  const user = {
    id,
    email: `${id}@example.test`,
    aud: "authenticated",
    role: "authenticated",
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  };
  const token = [
    btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    btoa(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })),
    "fixture",
  ].join(".");
  return new Response(
    JSON.stringify({
      access_token: token,
      refresh_token: `refresh-${id}`,
      expires_in: 3600,
      token_type: "bearer",
      user,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  saveQueue.setAccount(owner);
});
afterEach(async () => {
  await state.client?.auth.signOut({ scope: "local" });
  state.client = null;
  saveQueue.setAccount(null);
  vi.unstubAllGlobals();
});
describe("password deletion confirmation with real Supabase auth client and HTTP fixture", () => {
  it("does not replace the app's B session or persisted token when delayed A confirmation resolves", async () => {
    let deferOwner = false;
    let resolveConfirmation!: (response: Response) => void;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.includes("/auth/v1/logout")) return new Response(null, { status: 204 });
      if (url.includes("/auth/v1/token")) {
        const email = JSON.parse(String(init?.body)).email;
        if (email === `${owner}@example.test` && deferOwner)
          return new Promise((resolve) => {
            resolveConfirmation = resolve;
          });
        return tokenResponse(email === `${owner}@example.test` ? owner : other);
      }
      throw new Error("Unexpected HTTP request");
    });
    vi.stubGlobal("fetch", fetchMock);
    state.client = createClient<Database>("https://fixture.invalid", "fixture-anon", {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "fixture-app-login",
      },
    });
    const app = state.client;
    expect(
      (await app.auth.signInWithPassword({ email: `${owner}@example.test`, password: "fixture-password" }))
        .error,
    ).toBeNull();
    deferOwner = true;
    const pending = deleteOwnAccount(owner, "DELETE", "fixture-password");
    const assertion = expect(pending).rejects.toThrow("account changed");
    await vi.waitFor(() => expect(resolveConfirmation).toBeTypeOf("function"));
    expect(
      (await app.auth.signInWithPassword({ email: `${other}@example.test`, password: "fixture-password" }))
        .error,
    ).toBeNull();
    saveQueue.setAccount(other);
    const persistedB = localStorage.getItem("fixture-app-login");
    resolveConfirmation(tokenResponse(owner));
    await assertion;
    expect((await app.auth.getSession()).data.session?.user.id).toBe(other);
    expect(localStorage.getItem("fixture-app-login")).toBe(persistedB);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/account/delete"))).toBe(false);
    expect(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))).toEqual([
      "fixture-app-login",
    ]);
  });
  it("rejects confirmation for an unexpected user and revokes only its isolated session", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/auth/v1/logout") ? new Response(null, { status: 204 }) : tokenResponse(other),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(confirmAccountPassword(owner, `${owner}@example.test`, "fixture-password")).rejects.toThrow(
      "different account",
    );
    expect(localStorage.length).toBe(0);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/auth/v1/logout"))).toBe(true);
  });
});
