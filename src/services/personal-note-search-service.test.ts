import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveQueue } from "@/lib/save-queue";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
import { searchPersonalNoteBodies } from "./personal-note-search-service";
beforeEach(() => { saveQueue.setAccount("owner-a"); mocks.rpc.mockReset(); });
afterEach(() => saveQueue.setAccount(null));

describe("bounded private note text search", () => {
  it("collects all 401 matching identities in bounded pages without caching bodies", async () => {
    const records = Array.from({ length: 401 }, (_, index) => ({ kind: "personal-note", id: String(index) }));
    mocks.rpc.mockImplementation(async (_name, args) => ({ data: records.slice(args.p_offset, args.p_offset + args.p_limit), error: null }));
    const found = await searchPersonalNoteBodies("owner-a", "rare phrase");
    expect(found.size).toBe(401); expect(found.has("personal-note:400")).toBe(true);
    expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual([0, 200, 400].map((p_offset) => ({ p_query: "rare phrase", p_offset, p_limit: 200 })));
  });
  it("does not return partial search results when a later page fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: Array.from({ length: 200 }, (_, index) => ({ kind: "binder-note", id: String(index) })), error: null });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    await expect(searchPersonalNoteBodies("owner-a", "phrase")).rejects.toThrow("could not finish");
  });
  it("rejects other-owner requests and late results from a retired login", async () => {
    await expect(searchPersonalNoteBodies("owner-b", "phrase")).rejects.toThrow("account changed");
    expect(mocks.rpc).not.toHaveBeenCalled();
    let resolve!: (value: unknown) => void;
    mocks.rpc.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const old = searchPersonalNoteBodies("owner-a", "phrase");
    saveQueue.setAccount("owner-b"); saveQueue.setAccount("owner-a");
    resolve({ data: [{ kind: "personal-note", id: "old-private-id" }], error: null });
    await expect(old).rejects.toThrow("account changed");
  });
  it("aborts retired query work and validates server rows", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(searchPersonalNoteBodies("owner-a", "phrase", controller.signal)).rejects.toThrow("cancelled");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: [{ kind: "personal-note", id: "one", content: "Unexpected body" }], error: null });
    await expect(searchPersonalNoteBodies("owner-a", "phrase")).rejects.toThrow();
  });
});
