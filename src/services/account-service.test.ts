// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveQueue } from "@/lib/save-queue";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: mocks } }));
import { deleteOwnAccount } from "./account-service";
const owner = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
const session = (id = owner) => ({
  data: { session: { user: { id, email: `${id}@example.test` }, access_token: "test-token" } },
  error: null,
});
const confirmed = () => new Response(JSON.stringify({ deleted: true }), { status: 200 });
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  saveQueue.setAccount(owner);
  mocks.getSession.mockResolvedValue(session());
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.fetch.mockResolvedValue(confirmed());
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  saveQueue.setAccount(null);
  vi.unstubAllGlobals();
});
describe("confirmed account deletion device cleanup", () => {
  it("removes only exact owner stores and journals, including session pointers", async () => {
    const removed = [
      `bindernotes:study-items:v1:${owner}`,
      `binder-notes:draft:v2:${owner}:note:slot`,
      `bindernotes:creator-draft:v1:${owner}:binder:one`,
    ];
    const kept = [
      `bindernotes:study-items:v1:${owner}-suffix`,
      `binder-notes:draft:v2:${other}:${owner}:slot`,
      `unrecognized:${owner}`,
      "binder-notes:theme:v1",
    ];
    for (const key of [...removed, ...kept]) localStorage.setItem(key, "payload");
    sessionStorage.setItem(`bindernotes:whiteboard-draft:v1:selected:${owner}:board:tab`, "pointer");
    sessionStorage.setItem(`bindernotes:whiteboard-draft:v1:selected:${other}:${owner}:tab`, "other pointer");
    await deleteOwnAccount(owner, "DELETE");
    for (const key of removed) expect(localStorage.getItem(key)).toBeNull();
    for (const key of kept) expect(localStorage.getItem(key)).toBe("payload");
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.key(0)).toContain(`selected:${other}:`);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it.each([false, true])(
    "does not sign out a replacement login after a delayed deletion response (same owner again: %s)",
    async (returnToOwner) => {
      let resolve!: (response: Response) => void;
      mocks.fetch.mockImplementation(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      );
      const pending = deleteOwnAccount(owner, "DELETE");
      const assertion = expect(pending).rejects.toThrow("account changed");
      await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
      saveQueue.setAccount(other);
      if (returnToOwner) saveQueue.setAccount(owner);
      mocks.getSession.mockResolvedValue(session(returnToOwner ? owner : other));
      resolve(confirmed());
      await assertion;
      expect(mocks.signOut).not.toHaveBeenCalled();
    },
  );
  it("keeps the retry identity and backups when deletion is unconfirmed", async () => {
    const draft = `binder-notes:draft:v2:${owner}:note:slot`;
    localStorage.setItem(draft, "unsaved work");
    mocks.fetch.mockRejectedValueOnce(new Error("response lost"));
    await expect(deleteOwnAccount(owner, "DELETE")).rejects.toThrow("response lost");
    const firstBody = mocks.fetch.mock.calls[0][1].body;
    expect(localStorage.getItem(draft)).toBe("unsaved work");
    expect(mocks.signOut).not.toHaveBeenCalled();
    await deleteOwnAccount(owner, "DELETE");
    expect(mocks.fetch.mock.calls[1][1].body).toBe(firstBody);
  });
  it("does not send a deletion request when the login changes during session lookup", async () => {
    mocks.getSession.mockImplementationOnce(async () => {
      saveQueue.setAccount(other);
      return session();
    });
    await expect(deleteOwnAccount(owner, "DELETE")).rejects.toThrow("account changed");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
