import { supabase } from "@/lib/supabase";
import { supabaseConfig } from "@/lib/supabase-config";
import { inspectPrivateFile, privateAssetSchema, type PrivateAsset } from "@/lib/user-assets";
import { uploadResumableFile } from "@/lib/resumable-upload";
function client() { if (!supabase) throw new Error("Sign in to use private files."); return supabase; }
async function token(ownerId: string) {
  const { data, error } = await client().auth.getSession();
  if (error || data.session?.user.id !== ownerId) throw new Error("The account changed. Sign in before resuming this upload.");
  return data.session.access_token;
}
async function endpoint(kind: "complete" | "remove", ownerId: string, id: string) {
  const response = await fetch(`/api/assets/${kind}`, { method: "POST", headers: { Authorization: `Bearer ${await token(ownerId)}`, "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "The file service is unavailable. Your upload can be retried.");
  return body as { status?: "ready" | "staged" };
}
export async function listPrivateAssets(ownerId: string): Promise<PrivateAsset[]> {
  const { data, error } = await client().from("user_assets").select("*").eq("owner_id", ownerId).is("import_batch_id", null).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map(row => privateAssetSchema.parse(row));
}
export async function uploadPrivateAsset(ownerId: string, file: File, options: { signal?: AbortSignal; onProgress?: (bytes: number) => void; batchId?: string; assetId?: string } = {}) {
  await token(ownerId);
  const { mimeType, sha256 } = await inspectPrivateFile(file);
  const key = `bindernotes:upload:${ownerId}:${options.batchId ?? "standalone"}:${options.assetId ?? `${sha256}:${encodeURIComponent(file.name)}`}`;
  const raw = localStorage.getItem(key);
  let journal: { id: string; uploadUrl?: string; uploaded?: boolean };
  try {
    journal = raw ? JSON.parse(raw) : { id: options.assetId ?? crypto.randomUUID() };
    if (!journal || !/^[0-9a-f-]{36}$/i.test(journal.id) || (options.assetId && journal.id !== options.assetId)) throw new Error();
  } catch { throw new Error("This upload's resume information could not be read. Remove the pending file from Files before retrying."); }
  const { data, error } = await client().rpc("reserve_user_asset", { p_id: journal.id, p_name: file.name, p_mime_type: mimeType, p_size_bytes: file.size, p_sha256: sha256, p_import_batch_id: options.batchId ?? null });
  if (error) throw error;
  const asset = privateAssetSchema.parse(data);
  if (asset.owner_id !== ownerId || asset.id !== journal.id) throw new Error("Upload reservation belongs to another account.");
  if (asset.status === "ready" || asset.status === "staged") { localStorage.removeItem(key); return asset; }
  localStorage.setItem(key, JSON.stringify(journal));
  const url = new URL(supabaseConfig.url!);
  if (url.hostname.endsWith(".supabase.co")) url.hostname = url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  url.pathname = "/storage/v1/upload/resumable";
  if (!journal.uploaded) {
    await uploadResumableFile({ file, endpoint: url.href, token: () => token(ownerId), uploadUrl: journal.uploadUrl,
      metadata: { bucketName: asset.bucket_id, objectName: asset.storage_path, contentType: asset.mime_type, cacheControl: "3600" },
      onLocation: location => { journal.uploadUrl = location; localStorage.setItem(key, JSON.stringify(journal)); }, ...options });
    journal.uploaded = true; localStorage.setItem(key, JSON.stringify(journal));
  }
  const result = await endpoint("complete", ownerId, asset.id);
  if (result.status !== "ready" && result.status !== "staged") throw new Error("The file service returned an invalid completion status.");
  localStorage.removeItem(key);
  return { ...asset, status: result.status };
}
export async function removePrivateAsset(asset: PrivateAsset) {
  await endpoint("remove", asset.owner_id, asset.id);
  localStorage.removeItem(`bindernotes:upload:${asset.owner_id}:${asset.import_batch_id ?? "standalone"}:${asset.id}`);
  localStorage.removeItem(`bindernotes:upload:${asset.owner_id}:${asset.import_batch_id ?? "standalone"}:${asset.sha256}:${encodeURIComponent(asset.name)}`);
}
export async function privateAssetDownloadUrl(asset: PrivateAsset, download = true) {
  await token(asset.owner_id);
  if (asset.status !== "ready") throw new Error("Finish uploading this file first.");
  const { data, error } = await client().storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 60, download ? { download: asset.name } : undefined);
  if (error) throw error; return data.signedUrl;
}
