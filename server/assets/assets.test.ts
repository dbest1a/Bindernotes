import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createAssetHandlers, type AssetStore } from "./handlers";
import type { PrivateAsset } from "../../src/lib/user-assets";
function fixture() {
  const bytes = Buffer.from("%PDF-1.7\nDisposable test bytes");
  const asset: PrivateAsset = { id: "80000000-0000-4000-8000-000000000001", owner_id: "10000000-0000-4000-8000-000000000001", bucket_id: "private-assets", storage_path: "owner/file.pdf", name: "File.pdf", mime_type: "application/pdf", size_bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), status: "pending", import_batch_id: null, created_at: "now", updated_at: "now" };
  const store: AssetStore = { authenticate: vi.fn(async () => ({ id: asset.owner_id })), asset: vi.fn(async () => asset), object: vi.fn(async () => new Response(bytes)), complete: vi.fn(async () => {}), markDeleting: vi.fn(async () => {}), removeObject: vi.fn(async () => {}), finishDeletion: vi.fn(async () => {}), stale: vi.fn(async () => [asset]) };
  const handlers = createAssetHandlers({ store, origin: "https://app.test", cleanupSecret: "local-test-cleanup" });
  const request = () => new Request("https://app.test/api/assets/complete", { method: "POST", headers: { origin: "https://app.test", authorization: "Bearer session" }, body: JSON.stringify({ id: asset.id }) });
  return { asset, bytes, store, handlers, request };
}
describe("trusted private asset handlers", () => {
  it("streams and verifies actual bytes before making an asset ready", async () => {
    const f = fixture(); expect((await f.handlers.complete(f.request())).status).toBe(200);
    expect(f.store.complete).toHaveBeenCalledWith(f.asset, f.asset.sha256, f.bytes.length, "application/pdf");
  });
  it("rejects a renamed executable and leaves metadata pending", async () => {
    const f = fixture(); vi.mocked(f.store.object).mockResolvedValue(new Response("MZ executable"));
    expect((await f.handlers.complete(f.request())).status).toBe(422); expect(f.store.complete).not.toHaveBeenCalled();
  });
  it("does not remove metadata when object cleanup fails", async () => {
    const f = fixture(); vi.mocked(f.store.removeObject).mockRejectedValue(new Error("Storage unavailable"));
    expect((await f.handlers.remove(f.request())).status).toBe(503);
    expect(f.store.markDeleting).toHaveBeenCalled(); expect(f.store.finishDeletion).not.toHaveBeenCalled();
  });
  it("requires an owned asset and rejects foreign-origin requests before reading bytes", async () => {
    const f = fixture(); vi.mocked(f.store.asset).mockResolvedValue(null);
    expect((await f.handlers.complete(f.request())).status).toBe(404); expect(f.store.object).not.toHaveBeenCalled();
    const foreign = new Request(f.request(), { headers: { origin: "https://evil.test", authorization: "Bearer session" } });
    expect((await f.handlers.complete(foreign)).status).toBe(403);
  });
  it("cleanup is restricted and retries durable pending/deleting rows", async () => {
    const f = fixture(); expect((await f.handlers.cleanup(f.request())).status).toBe(403);
    const response = await f.handlers.cleanup(new Request("https://app.test/api/assets/cleanup", { method: "POST", headers: { authorization: "Bearer local-test-cleanup" } }));
    expect(response.status).toBe(200); expect(f.store.finishDeletion).toHaveBeenCalledWith(f.asset);
  });
});
