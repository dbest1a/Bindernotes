import type { Database } from "../../src/lib/database.generated";
import { createClient } from "@supabase/supabase-js";
import { privateAssetSchema } from "../../src/lib/user-assets";
import { createAssetHandlers, type AssetStore } from "./handlers";
export function assetRuntime() {
  if (process.env.ASSET_UPLOADS_ENABLED !== "true" || !process.env.APP_ORIGIN || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Private files are not configured");
  const origin = new URL(process.env.APP_ORIGIN);
  if (origin.origin !== process.env.APP_ORIGIN || (origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname))) throw new Error("Invalid app origin");
  const client = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const store: AssetStore = {
    async authenticate(token) { const { data, error } = await client.auth.getUser(token); if (error || !data.user) throw new Error("Invalid session"); return { id: data.user.id }; },
    async asset(id, owner) { const { data, error } = await client.from("user_assets").select("*").eq("id", id).eq("owner_id", owner).maybeSingle(); if (error) throw error; return data ? privateAssetSchema.parse(data) : null; },
    async object(asset) { const { data, error } = await client.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 60); if (error) throw error; return fetch(data.signedUrl, { redirect: "error" }); },
    async complete(asset, digest, size, mime) { const { error } = await client.rpc("complete_user_asset", { p_id: asset.id, p_owner: asset.owner_id, p_sha256: digest, p_size_bytes: size, p_mime_type: mime }); if (error) throw error; },
    async markDeleting(asset) { const { error } = await client.from("user_assets").update({ status: "deleting", updated_at: new Date().toISOString() }).eq("id", asset.id).eq("owner_id", asset.owner_id); if (error) throw error; },
    async claimStale(asset) { const { data, error } = await client.from("user_assets").update({ status: "deleting", updated_at: new Date().toISOString() }).eq("id", asset.id).eq("owner_id", asset.owner_id).in("status", ["pending", "staged", "deleting"]).lt("updated_at", new Date(Date.now()-24*60*60*1000).toISOString()).select("id").maybeSingle(); if (error) throw error; return Boolean(data); },
    async removeObject(asset) { const { error } = await client.storage.from(asset.bucket_id).remove([asset.storage_path]); if (error) throw error; },
    async finishDeletion(asset) { const { error } = await client.rpc("finish_user_asset_deletion", { p_id: asset.id, p_owner: asset.owner_id }); if (error) throw error; },
    async stale() { const { data, error } = await client.from("user_assets").select("*").in("status", ["pending", "staged", "deleting"]).lt("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).order("updated_at").limit(100); if (error) throw error; return (data ?? []).map(row => privateAssetSchema.parse(row)); },
  };
  return createAssetHandlers({ store, origin: origin.origin, cleanupSecret: process.env.ASSET_CLEANUP_SECRET });
}
export function assetEndpoint(kind: "complete" | "remove" | "cleanup") {
  return async (request: Request) => { try { return await assetRuntime()[kind](request); } catch { return Response.json({ message: "Private file uploads are not available in this environment yet." }, { status: 503, headers: { "Cache-Control": "no-store" } }); } };
}
