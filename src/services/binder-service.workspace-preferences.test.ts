import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePreferences } from "@/types";
import { createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";

const mocks = vi.hoisted(() => {
  type PreferenceRecord = {
    user_id: string;
    binder_id: string;
    preferences: WorkspacePreferences;
    updated_at?: string;
  };

  type QueryFilter = {
    column: string;
    value: unknown;
  };

  const state = {
    workspacePreferences: [] as PreferenceRecord[],
  };

  function createSelectBuilder(table: string) {
    const filters: QueryFilter[] = [];
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ column, value });
        return builder;
      }),
      maybeSingle: vi.fn(async () => {
        if (table === "binders") {
          return { data: null, error: null };
        }

        if (table !== "workspace_preferences") {
          throw new Error(`Unexpected select table: ${table}`);
        }

        const row =
          state.workspacePreferences.find((record) =>
            filters.every((filter) => record[filter.column as keyof PreferenceRecord] === filter.value),
          ) ?? null;

        return { data: row, error: null };
      }),
    };

    return builder;
  }

  function createWorkspacePreferencesBuilder() {
    let upsertPayload: PreferenceRecord | null = null;
    const filters: QueryFilter[] = [];
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ column, value });
        return builder;
      }),
      maybeSingle: vi.fn(async () => {
        const row =
          state.workspacePreferences.find((record) =>
            filters.every((filter) => record[filter.column as keyof PreferenceRecord] === filter.value),
          ) ?? null;

        return { data: row, error: null };
      }),
      upsert: vi.fn((payload: PreferenceRecord) => {
        upsertPayload = payload;
        return builder;
      }),
      single: vi.fn(async () => {
        if (!upsertPayload) {
          return { data: null, error: new Error("Missing upsert payload.") };
        }

        const existingIndex = state.workspacePreferences.findIndex(
          (record) =>
            record.user_id === upsertPayload?.user_id &&
            record.binder_id === upsertPayload?.binder_id,
        );
        if (existingIndex >= 0) {
          state.workspacePreferences[existingIndex] = upsertPayload;
        } else {
          state.workspacePreferences.push(upsertPayload);
        }

        return { data: upsertPayload, error: null };
      }),
    };

    return builder;
  }

  return {
    from: vi.fn((table: string) =>
      table === "workspace_preferences"
        ? createWorkspacePreferencesBuilder()
        : createSelectBuilder(table),
    ),
    state,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
  },
  isSupabaseConfigured: true,
  supabaseProjectRef: "test-project",
}));

import {
  getWorkspacePreferencesRecord,
  upsertWorkspacePreferencesRecord,
} from "@/services/binder-service";

describe("binder-service workspace preference account data", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.state.workspacePreferences = [];
  });

  it("saves and reloads workspace preferences by user and binder without crossing accounts", async () => {
    const userOne = createDefaultWorkspacePreferences("user-1", "binder-account");
    const userTwo = createDefaultWorkspacePreferences("user-2", "binder-account");
    const userOneSaved = {
      ...userOne,
      theme: {
        ...userOne.theme,
        compactMode: true,
      },
    };

    mocks.state.workspacePreferences.push({
      user_id: "user-2",
      binder_id: "binder-account",
      preferences: {
        ...userTwo,
        theme: {
          ...userTwo.theme,
          compactMode: false,
        },
      },
    });

    await upsertWorkspacePreferencesRecord(userOneSaved);
    const reloadedUserOne = await getWorkspacePreferencesRecord("user-1", "binder-account");
    const reloadedUserTwo = await getWorkspacePreferencesRecord("user-2", "binder-account");

    expect(reloadedUserOne.userId).toBe("user-1");
    expect(reloadedUserOne.binderId).toBe("binder-account");
    expect(reloadedUserOne.theme.compactMode).toBe(true);
    expect(reloadedUserTwo.userId).toBe("user-2");
    expect(reloadedUserTwo.theme.compactMode).toBe(false);
  });
});
