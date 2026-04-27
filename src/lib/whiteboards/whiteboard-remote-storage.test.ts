// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BinderWhiteboard } from "@/lib/whiteboards/whiteboard-types";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  capturedRecord: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
  },
  isSupabaseConfigured: true,
  supabaseProjectRef: "test-project",
}));

import { saveWhiteboard } from "@/lib/whiteboards/whiteboard-storage";

function board(overrides: Partial<BinderWhiteboard> = {}): BinderWhiteboard {
  return {
    id: "whiteboard-1",
    ownerId: "00000000-0000-0000-0000-000000000001",
    binderId: "binder-algebra-foundations",
    lessonId: "lesson-1",
    title: "Launch board",
    subject: "Math",
    moduleContext: "lesson",
    scene: {
      elements: [{ id: "rect-1", type: "rectangle", x: 20, y: 30 }],
      appState: {
        collaborators: new Map(),
        openMenu: "canvas",
        scrollX: 100,
        scrollY: 50,
        theme: "dark",
        viewBackgroundColor: "#11131a",
        zoom: { value: 1.4 },
      },
      files: {},
    },
    modules: [
      {
        id: "module-source",
        type: "bindernotes-module",
        moduleId: "lesson",
        binderId: "binder-algebra-foundations",
        lessonId: "lesson-1",
        anchorMode: "board",
        pinned: true,
        x: 200,
        y: 120,
        width: 560,
        height: 420,
        zIndex: 10,
        mode: "live",
        title: "Source Lesson",
        createdAt: "2026-04-26T00:00:00.000Z",
        updatedAt: "2026-04-26T00:00:00.000Z",
      },
    ],
    objectCount: 2,
    sceneSizeBytes: 0,
    assetSizeBytes: 0,
    storageMode: "local-draft",
    createdAt: "2026-04-26T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("whiteboard Supabase storage", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.capturedRecord = null;
  });

  it("saves sanitized scene data and board-pinned module placements to Supabase", async () => {
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe("whiteboards");
      return {
        upsert: (record: Record<string, unknown>) => {
          mocks.capturedRecord = record;
          return {
            select: () => ({
              single: async () => ({
                data: {
                  ...record,
                  created_at: "2026-04-26T00:00:00.000Z",
                  updated_at: "2026-04-26T00:01:00.000Z",
                },
                error: null,
              }),
            }),
          };
        },
      };
    });

    const result = await saveWhiteboard(board(), { backend: "supabase" });

    expect(result.status).toBe("saved");
    expect(result.message).toBe("Saved to Supabase");
    expect(mocks.capturedRecord?.scene_json).toMatchObject({
      elements: [{ id: "rect-1", type: "rectangle", x: 20, y: 30 }],
      appState: {
        theme: "dark",
        viewBackgroundColor: "#11131a",
        scrollX: 100,
        scrollY: 50,
        zoom: { value: 1.4 },
      },
    });
    expect(JSON.stringify(mocks.capturedRecord?.scene_json)).not.toContain("collaborators");
    expect(mocks.capturedRecord?.module_elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "module-source",
          anchorMode: "board",
          pinned: true,
          x: 200,
          y: 120,
          width: 560,
          height: 420,
        }),
      ]),
    );
  });

  it("reports Supabase unavailable instead of fake saved when the whiteboards table is missing", async () => {
    mocks.from.mockReturnValue({
      upsert: () => ({
        select: () => ({
          single: async () => ({
            data: null,
            error: { code: "42P01", message: "relation whiteboards does not exist" },
          }),
        }),
      }),
    });

    const result = await saveWhiteboard(board(), { backend: "supabase" });

    expect(result.status).toBe("unavailable");
    expect(result.backend).toBe("local");
    expect(result.message).toMatch(/apply the whiteboards migration/i);
  });
});
