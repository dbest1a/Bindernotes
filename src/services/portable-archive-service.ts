import { databaseJson } from "@/lib/database-client";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { saveQueue } from "@/lib/save-queue";
import { archiveTablesSchema, archiveSourceProvenanceSchema, archiveTables, MAX_ARCHIVE_BYTES, parsePortableArchive, portableArchiveSchema, remapPortableArchive, type PortableArchive } from "@/lib/portable-archive";
import { privateAssetSchema, inspectPrivateFile } from "@/lib/user-assets";
import { uploadPrivateAsset } from "@/services/private-assets-service";
import { readLocalMathArchive, mergeLocalMathArchive } from "@/services/math-local-portability";
import { studyItemsStorageKey, studyReviewEventsStorageKey } from "@/services/study-items-service";
import { readMetadataPages } from "@/lib/metadata-pages";

let accountGeneration = 0;
saveQueue.subscribeAccount(() => { accountGeneration += 1; });
function scope(ownerId: string) {
  const generation = accountGeneration;
  const check = () => { if (!supabase || saveQueue.getAccount() !== ownerId || generation !== accountGeneration) throw new Error("The account changed. Reopen Data & backups in the intended account."); };
  check(); return { client: supabase!, check };
}
async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return btoa(binary);
}
function base64ToBytes(base64: string) { return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)); }
function uuidFromHash(hash: string) { return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`; }

/** Only explicitly account-scoped study stores are included; credentials are never inspected. */
function deviceRecovery(ownerId: string): PortableArchive["deviceRecovery"] {
  const prefixes = [`binder-notes:draft:v2:${encodeURIComponent(ownerId)}:`, `bindernotes:whiteboard-draft:v1:${encodeURIComponent(ownerId)}:`, `bindernotes:whiteboards:${ownerId}:`, `bindernotes:recall-lab:${ownerId}:`, `bindernotes:canonical-recall-draft:v1:${ownerId}:`, `bindernotes:creator-draft:v1:${ownerId}:`, `bindernotes:cloud-review-pending:v1:${ownerId}:`, `bindernotes:cloud-recall-session-pending:v1:${ownerId}:`];
  const exact = [studyItemsStorageKey(ownerId), studyReviewEventsStorageKey(ownerId)];
  const recovery: PortableArchive["deviceRecovery"] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !(prefixes.some((prefix) => key.startsWith(prefix)) || exact.includes(key))) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    if (raw.length > MAX_ARCHIVE_BYTES) throw new Error("A device backup exceeds the archive limit. The original has been kept.");
    const data: unknown = JSON.parse(raw);
    const pending = [data];
    while (pending.length) {
      const item = pending.pop();
      if (!item || typeof item !== "object") continue;
      for (const [field, value] of Object.entries(item)) {
        if (["owner_id", "ownerId", "userId"].includes(field) && value !== ownerId) throw new Error("A device backup has mismatched ownership. Resolve it before exporting.");
        if (value && typeof value === "object") pending.push(value);
      }
    }
    recovery.push({ kind: key.split(":").slice(0, 3).join(":"), data });
  }
  return recovery;
}

export async function exportPortableArchive(ownerId: string): Promise<PortableArchive> {
  const { client, check } = scope(ownerId);
  const { data, error } = await client.rpc("export_portable_workspace"); check();
  if (error || !data || typeof data !== "object") throw new Error("The complete workspace could not be exported. Nothing was downloaded; retry when connected.");
  const raw = z.object({ tables: archiveTablesSchema, assets: z.array(privateAssetSchema), reviews: z.unknown(), reviewEvents: z.unknown(), recallSessions: z.unknown() }).parse(data);
  const [legacy, unfinished] = await Promise.all([
    client.from("whiteboard_assets").select("id", { count: "exact", head: true }),
    client.from("user_assets").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).is("import_batch_id", null).neq("status", "ready"),
  ]); check();
  if (legacy.error || unfinished.error || legacy.count === null || unfinished.count === null) throw new Error("File completeness could not be checked. The export has stopped without omissions.");
  if (legacy.count > 0) throw new Error("Legacy whiteboard attachments need migration before a complete archive can be created. Their saved data is unchanged.");
  if (unfinished.count > 0) throw new Error("Finish or remove pending file uploads before creating a complete archive.");
  const assets: PortableArchive["assets"] = [];
  let bytesTotal = new TextEncoder().encode(JSON.stringify(raw)).byteLength;
  for (const item of z.array(privateAssetSchema).parse(raw.assets)) {
    if (item.owner_id !== ownerId || item.status !== "ready" || item.import_batch_id) throw new Error("An export file is unavailable for this account.");
    const result = await client.storage.from(item.bucket_id).download(item.storage_path); check();
    if (result.error || !result.data) throw new Error(`Could not include the file “${item.name}”. The export has stopped without omissions.`);
    const file = new File([result.data], item.name, { type: item.mime_type });
    const inspected = await inspectPrivateFile(file); check();
    if (inspected.sha256 !== item.sha256 || file.size !== item.size_bytes) throw new Error(`The file “${item.name}” failed its integrity check.`);
    const base64 = bytesToBase64(new Uint8Array(await file.arrayBuffer())); bytesTotal += base64.length;
    if (bytesTotal > MAX_ARCHIVE_BYTES) throw new Error("This complete archive exceeds 100 MiB. No partial archive was downloaded.");
    assets.push({ id: item.id, name: item.name, mime_type: item.mime_type, size_bytes: item.size_bytes, sha256: item.sha256, base64 });
  }
  const tables = raw.tables;
  const { data: imports, error: importsError } = await readMetadataPages((from, to) => client.from("workspace_archive_imports").select("recovery_data").eq("owner_id", ownerId).order("batch_id").range(from, to)); check();
  if (importsError) throw new Error("Imported recovery data could not be exported. Retry without discarding the original archive.");
  const recovery = deviceRecovery(ownerId);
  const sourceProvenance = tables.binders.map((binder) => ({ binderId: binder.id, sourceBinderId: binder.id, sourceOwnerId: binder.owner_id, sourceSlug: binder.slug, sourceStatus: binder.status }));
  for (const previous of imports ?? []) {
    recovery.push({ kind: "previous-import", data: previous.recovery_data });
    const sources = z.object({ sourceProvenance: archiveSourceProvenanceSchema.default([]) }).parse(previous.recovery_data).sourceProvenance;
    for (const source of sources) { const index = sourceProvenance.findIndex((current) => current.binderId === source.binderId); if (index >= 0) sourceProvenance[index] = source; }
  }
  check();
  const archive = portableArchiveSchema.parse({ format: "bindernotes-archive", version: 1, ownerId, exportedAt: new Date().toISOString(), tables,
    reviews: raw.reviews, reviewEvents: raw.reviewEvents, recallSessions: raw.recallSessions, assets,
    localMath: readLocalMathArchive(ownerId), deviceRecovery: recovery, sourceProvenance });
  return parsePortableArchive(JSON.stringify(archive));
}

export type PreparedArchiveImport = { ownerId: string; digest: string; batchId: string; archive: PortableArchive };
export function archiveImportCounts(archive: PortableArchive) {
  return { ...Object.fromEntries(archiveTables.map((table) => [table, archive.tables[table].length])), reviews: archive.reviews.length, reviewEvents: archive.reviewEvents.length, recallSessions: archive.recallSessions.length, assets: archive.assets.length, deviceRecovery: archive.deviceRecovery.length };
}
export async function prepareArchiveImport(ownerId: string, file: File): Promise<PreparedArchiveImport> {
  const { check } = scope(ownerId);
  if (file.size > MAX_ARCHIVE_BYTES || !/\.json$/i.test(file.name) || (file.type && !["application/json", "text/plain"].includes(file.type))) throw new Error("Choose a BinderNotes JSON archive up to 100 MiB.");
  const archive = parsePortableArchive(await file.text()); check();
  // Every asset is checked before the first upload or database write.
  for (const asset of archive.assets) {
    const bytes = base64ToBytes(asset.base64);
    const inspected = await inspectPrivateFile(new File([bytes], asset.name, { type: asset.mime_type })); check();
    if (bytes.byteLength !== asset.size_bytes || inspected.sha256 !== asset.sha256) throw new Error(`Archive file integrity check failed: ${asset.name}`);
  }
  const encoder = new TextEncoder();
  const digest = await sha256(encoder.encode(JSON.stringify(archive)));
  const seed = `${ownerId}:${digest}`;
  const batchId = uuidFromHash(await sha256(encoder.encode(seed)));
  const count = archiveTables.reduce((sum, table) => sum + archive.tables[table].length, 0) + archive.assets.length + archive.reviews.length * 2 + archive.reviewEvents.length + archive.recallSessions.length + archive.localMath.problemLogs.length + archive.localMath.formulaCards.length + archive.localMath.graphLinks.length;
  const ids: string[] = [];
  for (let offset = 0; offset < count; offset += 250) {
    ids.push(...await Promise.all(Array.from({ length: Math.min(250, count - offset) }, async (_, index) => uuidFromHash(await sha256(encoder.encode(`${seed}:${offset + index}`)))))); check();
  }
  let index = 0;
  const remapped = remapPortableArchive(archive, ownerId, () => ids[index++]);
  return { ownerId, digest, batchId, archive: remapped.archive };
}

export async function importPortableArchive(prepared: PreparedArchiveImport) {
  const { ownerId, digest, batchId, archive } = prepared;
  const { client, check } = scope(ownerId);
  const parsed = portableArchiveSchema.parse(archive);
  if (parsed.ownerId !== ownerId) throw new Error("The prepared import belongs to a different account.");
  const { data: existing, error: lookupError } = await client.from("workspace_archive_imports").select("counts,recovery_data").eq("owner_id", ownerId).eq("batch_id", batchId).maybeSingle(); check();
  if (lookupError) throw new Error("The previous import status could not be checked. Retry before starting another import.");
  let counts: Record<string, number>;
  if (existing) counts = z.record(z.string(), z.number().int().nonnegative()).parse(existing.counts);
  else {
    for (const asset of parsed.assets) {
      check();
      const file = new File([base64ToBytes(asset.base64)], asset.name, { type: asset.mime_type });
      const staged = await uploadPrivateAsset(ownerId, file, { batchId, assetId: asset.id }); check();
      if (staged.id !== asset.id || staged.owner_id !== ownerId || staged.status !== "staged" || staged.import_batch_id !== batchId) throw new Error("An imported file could not be staged safely. Retry this same archive.");
    }
    const payload = { ...parsed, assets: parsed.assets.map(({ base64: _base64, ...asset }) => asset) };
    const { data, error } = await client.rpc("import_portable_workspace", { p_archive: databaseJson(payload), p_batch_id: batchId, p_archive_digest: digest }); check();
    if (error) throw new Error("Import was not confirmed. All content writes are transactional; staged files remain hidden. Retry this same archive to confirm the result without duplicates.");
    counts = z.record(z.string(), z.number().int().nonnegative()).parse(data);
  }
  let deviceMathReady = false;
  for (const [key, expected] of Object.entries(archiveImportCounts(parsed))) {
    if (counts[key] !== expected) throw new Error("The import receipt did not confirm every requested record. Keep the archive and retry to check the result.");
  }
  try { const result = mergeLocalMathArchive(ownerId, parsed.localMath); deviceMathReady = result.conflicts.length === 0; } catch { /* The transaction retained the full Math archive for explicit recovery. */ }
  check();
  return { counts, deviceMathReady, batchId, recoveredBefore: Boolean(existing) };
}

export async function restoreImportedMath(ownerId: string, batchId: string) {
  const { client, check } = scope(ownerId);
  const { data, error } = await client.from("workspace_archive_imports").select("recovery_data").eq("owner_id", ownerId).eq("batch_id", batchId).single(); check();
  if (error || !data) throw new Error("The imported Math backup could not be loaded.");
  const result = mergeLocalMathArchive(ownerId, z.object({ localMath: z.unknown() }).parse(data.recovery_data).localMath);
  if (result.conflicts.length) throw new Error("Math records with these IDs differ on this device. The imported backup is preserved in your account.");
}
