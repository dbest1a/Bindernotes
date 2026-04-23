import { describe, expect, it } from "vitest";
import { SYSTEM_BINDER_IDS, SYSTEM_SEED_VERSION, SYSTEM_SUITE_IDS } from "@/lib/history-suite-seeds";
import {
  buildSystemSeedPayload,
  seedSystemSuitesWithClient,
} from "@/services/system-seed-service";
import type { Profile } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

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
    expect(payload.seedVersions.every((version) => version.version === SYSTEM_SEED_VERSION)).toBe(
      true,
    );
  });

  it("attaches each seeded binder to a suite folder", () => {
    const payload = buildSystemSeedPayload(adminProfile);
    const folderIds = new Set(payload.folders.map((folder) => folder.id));

    expect(payload.folderBinders).toHaveLength(payload.binders.length);
    payload.folderBinders.forEach((link) => {
      expect(folderIds.has(link.folder_id)).toBe(true);
      expect(payload.binders.some((binder) => binder.id === link.binder_id)).toBe(true);
    });
  });

  it("includes French Revolution history templates", () => {
    const payload = buildSystemSeedPayload(adminProfile);

    expect(payload.historyEventTemplates.length).toBeGreaterThanOrEqual(6);
    expect(payload.historySourceTemplates.length).toBeGreaterThanOrEqual(4);
    expect(payload.historyMythCheckTemplates.length).toBeGreaterThanOrEqual(3);
  });

  it("uses idempotent upserts so running the seed twice does not duplicate rows", async () => {
    const payload = buildSystemSeedPayload(adminProfile);
    const client = new FakeSeedClient();

    await seedSystemSuitesWithClient(client as unknown as SupabaseClient, payload);
    await seedSystemSuitesWithClient(client as unknown as SupabaseClient, payload);

    expect(client.count("suite_templates")).toBe(payload.suites.length);
    expect(client.count("folders")).toBe(payload.folders.length);
    expect(client.count("folder_binders")).toBe(payload.folderBinders.length);
    expect(client.count("binders")).toBe(payload.binders.length);
    expect(client.count("binder_lessons")).toBe(payload.lessons.length);
    expect(client.count("workspace_presets")).toBe(payload.workspacePresets.length);
    expect(client.count("seed_versions")).toBe(payload.seedVersions.length);
  });
});

class FakeSeedClient {
  private readonly tables = new Map<string, Map<string, Record<string, unknown>>>();

  from(table: string) {
    return {
      upsert: async (rows: Record<string, unknown>[], options?: { onConflict?: string }) => {
        const onConflict = (options?.onConflict ?? "id")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        const tableStore = this.tables.get(table) ?? new Map<string, Record<string, unknown>>();

        for (const row of rows) {
          const key = onConflict.map((column) => String(row[column] ?? "")).join("::");
          tableStore.set(key, row);
        }

        this.tables.set(table, tableStore);
        return { error: null };
      },
    };
  }

  count(table: string) {
    return this.tables.get(table)?.size ?? 0;
  }
}
