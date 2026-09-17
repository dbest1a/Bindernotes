import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { archiveFixture } from "@/test-utils/portable-archive-fixture";
import { saveQueue } from "@/lib/save-queue";
const owner = "10000000-0000-4000-8000-000000000002";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), existing: null as unknown, upload: vi.fn(), math: vi.fn(() => ({ conflicts: [] })), download: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: {
  rpc: mocks.rpc,
  from: () => { const query = { select: () => query, eq: () => query, is: () => query, neq: () => query, order: () => query, range: () => query, then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve), maybeSingle: async () => ({ data: mocks.existing, error: null }) }; return query; },
  storage: { from: () => ({ download: mocks.download }) },
} }));
vi.mock("@/services/private-assets-service", () => ({ uploadPrivateAsset: mocks.upload }));
vi.mock("@/services/math-local-portability", async (original) => ({ ...await original<typeof import("@/services/math-local-portability")>(), mergeLocalMathArchive: mocks.math, readLocalMathArchive: (ownerId: string) => ({ schemaVersion: 1, ownerId, problemLogs: [], formulaCards: [], graphLinks: [] }) }));
import { importPortableArchive, prepareArchiveImport, exportPortableArchive, archiveImportCounts } from "./portable-archive-service";
beforeEach(() => { saveQueue.setAccount(owner); mocks.rpc.mockReset(); mocks.upload.mockReset(); mocks.existing = null; mocks.math.mockClear(); });
afterEach(() => { saveQueue.setAccount(null); vi.unstubAllGlobals(); });
const file = () => new File([JSON.stringify(archiveFixture())], "workspace.json", { type: "application/json" });
describe("portable archive orchestration", () => {
  it("exports the full transaction snapshot and only this account's recoverable device journals", async () => {
    const archive = archiveFixture(); saveQueue.setAccount(archive.ownerId);
    mocks.rpc.mockResolvedValue({ data: { tables: archive.tables, reviews: [], reviewEvents: [], recallSessions: [], assets: [] }, error: null });
    const entries = new Map([
      [`bindernotes:canonical-recall-draft:v1:${archive.ownerId}:draft`, JSON.stringify({ ownerId: archive.ownerId, draft: "Recall work" })],
      [`bindernotes:creator-draft:v1:${archive.ownerId}:lesson`, JSON.stringify({ ownerId: archive.ownerId, draft: "Creator work" })],
      [`bindernotes:creator-draft:v1:${owner}:lesson`, JSON.stringify({ ownerId: owner, draft: "Other account" })],
      ["unrelated-session", "Not study data"],
    ]);
    vi.stubGlobal("localStorage", { length: entries.size, key: (index: number) => [...entries.keys()][index], getItem: (key: string) => entries.get(key) ?? null });
    const result = await exportPortableArchive(archive.ownerId);
    expect(result.tables).toEqual(archive.tables);
    expect(result.deviceRecovery).toHaveLength(2);
    expect(JSON.stringify(result)).toContain("Recall work"); expect(JSON.stringify(result)).toContain("Creator work");
    expect(JSON.stringify(result)).not.toContain("Other account");
    expect(mocks.rpc).toHaveBeenCalledWith("export_portable_workspace");
  });
  it("preflights all content before writing and generates identical destination identities on retry", async () => {
    const first = await prepareArchiveImport(owner, file()), second = await prepareArchiveImport(owner, file());
    expect(first).toEqual(second);
    expect(first.archive.ownerId).toBe(owner);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
    await expect(prepareArchiveImport(owner, new File(['{"version":77}'], "unsupported.json"))).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reuses the transaction receipt after an uncertain response without another mutation", async () => {
    const prepared = await prepareArchiveImport(owner, file());
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "response lost" } });
    await expect(importPortableArchive(prepared)).rejects.toThrow("not confirmed");
    const counts = archiveImportCounts(prepared.archive);
    mocks.existing = { counts, recovery_data: { localMath: prepared.archive.localMath } };
    expect(await importPortableArchive(prepared)).toMatchObject({ counts, recoveredBefore: true, deviceMathReady: true });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_batch_id: prepared.batchId, p_archive_digest: prepared.digest });
  });
  it("checks file bytes and hash before uploading any file or writing content", async () => {
    const archive = archiveFixture();
    archive.assets.push({ id: crypto.randomUUID(), name: "file.pdf", mime_type: "application/pdf", size_bytes: 9, sha256: "a".repeat(64), base64: btoa("%PDF-1.7\n") });
    await expect(prepareArchiveImport(owner, new File([JSON.stringify(archive)], "archive.json"))).rejects.toThrow("integrity");
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("stages verified files under new owner IDs and promotes only metadata with the transaction", async () => {
    const archive = archiveFixture(); const bytes = new TextEncoder().encode("%PDF-1.7\n");
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const originalId = crypto.randomUUID();
    archive.assets.push({ id: originalId, name: "class.pdf", mime_type: "application/pdf", size_bytes: bytes.byteLength, sha256, base64: btoa("%PDF-1.7\n") });
    const prepared = await prepareArchiveImport(owner, new File([JSON.stringify(archive)], "archive.json"));
    mocks.upload.mockImplementation(async (ownerId, _file, options) => ({ id: options.assetId, owner_id: ownerId, status: "staged", import_batch_id: options.batchId }));
    mocks.rpc.mockResolvedValue({ data: archiveImportCounts(prepared.archive), error: null });
    expect(await importPortableArchive(prepared)).toMatchObject({ deviceMathReady: true });
    expect(prepared.archive.assets[0].id).not.toBe(originalId);
    expect(mocks.upload).toHaveBeenCalledWith(owner, expect.any(File), { batchId: prepared.batchId, assetId: prepared.archive.assets[0].id });
    expect(mocks.rpc.mock.calls[0][1].p_archive.assets[0]).not.toHaveProperty("base64");
    expect(mocks.rpc.mock.calls[0][1].p_archive.assets[0]).toMatchObject({ id: prepared.archive.assets[0].id, sha256 });
  });
  it("does not claim device setup is complete if local storage cannot be restored", async () => {
    const prepared = await prepareArchiveImport(owner, file());
    mocks.rpc.mockResolvedValue({ data: archiveImportCounts(prepared.archive), error: null });
    mocks.math.mockImplementationOnce(() => { throw new Error("Device full"); });
    expect(await importPortableArchive(prepared)).toMatchObject({ deviceMathReady: false });
    expect(mocks.rpc.mock.calls[0][1].p_archive.localMath).toEqual(prepared.archive.localMath);
  });
  it("rejects an export result from a retired login even if the same account signs in again", async () => {
    let resolve!: (value: unknown) => void;
    mocks.rpc.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const pending = exportPortableArchive(owner);
    saveQueue.setAccount(null); saveQueue.setAccount(owner);
    resolve({ data: {}, error: null });
    await expect(pending).rejects.toThrow("account changed");
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("refuses a success claim when the receipt omits requested records", async () => {
    const prepared = await prepareArchiveImport(owner, file());
    mocks.rpc.mockResolvedValue({ data: { personal_notes: 0 }, error: null });
    await expect(importPortableArchive(prepared)).rejects.toThrow("every requested record");
    expect(mocks.math).not.toHaveBeenCalled();
  });
});
