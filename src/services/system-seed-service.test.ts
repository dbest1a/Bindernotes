import { describe, expect, it, vi } from "vitest";
import { SYSTEM_BINDER_IDS, SYSTEM_SEED_VERSION, SYSTEM_SUITE_IDS } from "@/lib/history-suite-seeds";
import {
  buildSystemSeedPayload,
  seedSystemSuitesWithClient,
  seedSystemSuites,
} from "@/services/system-seed-service";
import type { Profile } from "@/types";

const adminProfile: Profile = {
  id: "admin-user",
  email: "admin@example.com",
  full_name: "Admin",
  role: "admin",
  created_at: "2026-04-22T00:00:00.000Z",
  updated_at: "2026-04-22T00:00:00.000Z",
};

describe("system seed payload", () => {
  it("builds the seeded suites, binders, folders, and presets", () => {
    const payload = buildSystemSeedPayload(adminProfile);

    expect(payload.suites.map((suite) => suite.id)).toEqual(
      expect.arrayContaining([
        SYSTEM_SUITE_IDS.algebra,
        SYSTEM_SUITE_IDS.riseOfRome,
        SYSTEM_SUITE_IDS.historyDemo,
      ]),
    );
    expect(payload.binders.map((binder) => binder.id)).toEqual(
      expect.arrayContaining([
        SYSTEM_BINDER_IDS.algebra,
        SYSTEM_BINDER_IDS.riseOfRome,
        SYSTEM_BINDER_IDS.frenchRevolution,
      ]),
    );
    expect(payload.folders).toHaveLength(3);
    expect(payload.workspacePresets.length).toBeGreaterThan(0);
    expect(payload.seedVersions.every((version) => version.version === SYSTEM_SEED_VERSION)).toBe(true);
  });

  it("attaches each seeded binder to a suite folder", () => {
    const payload = buildSystemSeedPayload(adminProfile);
    const folderIds = new Set(payload.folders.map((folder) => folder.id));

    expect(payload.folderBinders.length).toBeGreaterThanOrEqual(payload.binders.length);
    payload.folderBinders.forEach((link) => {
      expect(folderIds.has(link.folder_id)).toBe(true);
      expect(payload.binders.some((binder) => binder.id === link.binder_id)).toBe(true);
    });
  });

  it("places Rise of Rome inside the learner-facing History Suite folder", () => {
    const payload = buildSystemSeedPayload(adminProfile);
    const historyFolder = payload.folders.find(
      (folder) => folder.suite_template_id === SYSTEM_SUITE_IDS.historyDemo,
    );

    expect(historyFolder).toBeTruthy();
    expect(payload.folderBinders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          folder_id: historyFolder!.id,
          binder_id: SYSTEM_BINDER_IDS.frenchRevolution,
        }),
        expect.objectContaining({
          folder_id: historyFolder!.id,
          binder_id: SYSTEM_BINDER_IDS.riseOfRome,
        }),
      ]),
    );
  });

  it("includes French Revolution history templates", () => {
    const payload = buildSystemSeedPayload(adminProfile);

    expect(payload.historyEventTemplates.length).toBeGreaterThanOrEqual(6);
    expect(payload.historySourceTemplates.length).toBeGreaterThanOrEqual(4);
    expect(payload.historyMythCheckTemplates.length).toBeGreaterThanOrEqual(3);
  });

  it("submits every system table in one transactional RPC", async () => {
    const payload = buildSystemSeedPayload(adminProfile);
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await seedSystemSuitesWithClient({ rpc }, payload);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("apply_catalog_seed", {
      p_payload: expect.objectContaining({
        suite_templates: payload.suites,
        binder_lessons: payload.lessons,
        seed_versions: payload.seedVersions,
      }),
    });
  });

  it("surfaces transactional failure without continuing individual writes", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "permission denied" } });
    await expect(seedSystemSuitesWithClient({ rpc }, buildSystemSeedPayload(adminProfile))).rejects.toThrow(
      "Transactional system seed failed: permission denied",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects browser seeding even for operator profiles", async () => {
    await expect(seedSystemSuites(adminProfile)).rejects.toThrow("trusted server CLI");
  });
});
