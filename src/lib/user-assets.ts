import { z } from "zod";
export const MAX_PRIVATE_ASSET_BYTES = 50 * 1024 * 1024;
export const privateAssetSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  bucket_id: z.literal("private-assets"),
  storage_path: z.string().min(1),
  name: z.string().min(1).max(200),
  mime_type: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]),
  size_bytes: z.number().int().min(1).max(MAX_PRIVATE_ASSET_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  import_batch_id: z.string().uuid().nullable().default(null),
  status: z.enum(["pending", "staged", "ready", "deleting"]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PrivateAsset = z.infer<typeof privateAssetSchema>;
export function detectPrivateAssetMime(bytes: Uint8Array): PrivateAsset["mime_type"] | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}
export async function inspectPrivateFile(file: File) {
  if (!file.size || file.size > MAX_PRIVATE_ASSET_BYTES || file.name.length > 200)
    throw new Error("Choose a PDF, PNG, JPEG or WebP file up to 50 MiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectPrivateAssetMime(bytes);
  if (!mimeType || (file.type && file.type !== mimeType))
    throw new Error("The file's contents do not match a supported PDF or image type.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { mimeType, sha256 };
}
