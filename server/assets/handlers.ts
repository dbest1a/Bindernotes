import { createHash } from "node:crypto";
import { z } from "zod";
import { detectPrivateAssetMime, type PrivateAsset } from "../../src/lib/user-assets";
export type AssetStore = {
  authenticate(token: string): Promise<{ id: string }>;
  asset(id: string, owner: string): Promise<PrivateAsset | null>;
  object(asset: PrivateAsset): Promise<Response>;
  complete(asset: PrivateAsset, digest: string, size: number, mime: string): Promise<void>;
  markDeleting(asset: PrivateAsset): Promise<void>;
  claimStale(asset: PrivateAsset): Promise<boolean>;
  removeObject(asset: PrivateAsset): Promise<void>;
  finishDeletion(asset: PrivateAsset): Promise<void>;
  stale(): Promise<PrivateAsset[]>;
};
class AssetError extends Error { constructor(readonly status: number, message: string) { super(message); } }
async function verifiedObject(response: Response, asset: PrivateAsset) {
  if (!response.ok || !response.body) throw new AssetError(409, "The upload is incomplete. Resume it before finishing.");
  const hash = createHash("sha256"); const reader = response.body.getReader(); let size = 0; let prefix = new Uint8Array();
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.length;
      if (size > asset.size_bytes) { await reader.cancel(); throw new AssetError(422, "The uploaded file has an unexpected size."); }
      if (prefix.length < 16) prefix = new Uint8Array([...prefix, ...next.value.slice(0, 16 - prefix.length)]);
      hash.update(next.value);
    }
  } finally { reader.releaseLock(); }
  const mime = detectPrivateAssetMime(prefix); const digest = hash.digest("hex");
  if (size !== asset.size_bytes || digest !== asset.sha256 || mime !== asset.mime_type) throw new AssetError(422, "The uploaded file did not pass verification. Remove it and try again.");
  return { digest, size, mime };
}
export function createAssetHandlers(deps: { store: AssetStore; origin: string; cleanupSecret?: string }) {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  async function owned(request: Request) {
    if (request.method !== "POST") throw new AssetError(405, "Use POST.");
    if (request.headers.get("origin") !== deps.origin) throw new AssetError(403, "Return to BinderNotes to manage private files.");
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new AssetError(401, "Sign in to manage private files.");
    let user: { id: string };
    try { user = await deps.store.authenticate(token); } catch { throw new AssetError(401, "Sign in again to manage private files."); }
    const reader = request.body?.getReader(); if (!reader) throw new AssetError(400, "Choose a file.");
    const chunks: Uint8Array[] = []; let bytes = 0;
    try { for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > 1024) { await reader.cancel(); throw new AssetError(413, "Request is too large."); } chunks.push(next.value); } }
    finally { reader.releaseLock(); }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AssetError(400, "Choose a valid file."); }
    const input = z.object({ id: z.string().uuid() }).strict().safeParse(body);
    if (!input.success) throw new AssetError(400, "Choose a valid file.");
    const asset = await deps.store.asset(input.data.id, user.id);
    if (!asset) throw new AssetError(404, "File not found.");
    return asset;
  }
  const safe = (handler: (request: Request) => Promise<Response>) => async (request: Request) => {
    try { return await handler(request); }
    catch (error) { return error instanceof AssetError ? json({ message: error.message }, error.status) : json({ message: "File service is temporarily unavailable. Your upload can be retried." }, 503); }
  };
  async function remove(asset: PrivateAsset, alreadyClaimed = false) {
    if (!alreadyClaimed) await deps.store.markDeleting(asset); await deps.store.removeObject(asset); await deps.store.finishDeletion(asset);
  }
  return {
    complete: safe(async request => {
      const asset = await owned(request);
      if (asset.status === "deleting") throw new AssetError(409, "This file is being removed.");
      if (asset.status === "ready" || asset.status === "staged") return json({ id: asset.id, status: asset.status });
      const verified = await verifiedObject(await deps.store.object(asset), asset);
      await deps.store.complete(asset, verified.digest, verified.size, verified.mime);
      return json({ id: asset.id, status: asset.import_batch_id ? "staged" : "ready" });
    }),
    remove: safe(async request => { const asset = await owned(request); await remove(asset); return json({ deleted: true }); }),
    cleanup: safe(async request => {
      if (request.method !== "POST" || !deps.cleanupSecret || request.headers.get("authorization") !== `Bearer ${deps.cleanupSecret}`) throw new AssetError(403, "Cleanup is restricted.");
      const assets = await deps.store.stale(); let removed = 0;
      for (const asset of assets) { if (await deps.store.claimStale(asset)) { await remove(asset, true); removed++; } }
      return json({ removed });
    }),
  };
}
