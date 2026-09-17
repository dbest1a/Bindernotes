import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseCalls = vi.hoisted(() => ({
  inserts: [] as Array<{ payload: Record<string, unknown>; table: string }>,
  rpc: vi.fn(),
  tables: [] as string[],
  upserts: [] as Array<{
    options?: Record<string, unknown>;
    payload: Record<string, unknown>;
    table: string;
  }>,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: supabaseCalls.rpc,
    from: (table: string) => {
      supabaseCalls.tables.push(table);
      return {
        insert: async (payload: Record<string, unknown>) => {
          supabaseCalls.inserts.push({ table, payload });
          return { error: null };
        },
        upsert: async (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
          supabaseCalls.upserts.push({ table, payload, options });
          return { error: null };
        },
      };
    },
  },
}));

import {
  clearActivityTrackingTimersForTests,
  insertWorkspaceActivityEvent,
  sanitizeActivityMetadata,
  scheduleUserRecentItem,
  trackUserRecentItem,
  upsertUserRecentItem,
} from "@/services/activity-service";

describe("activity service", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearActivityTrackingTimersForTests();
    supabaseCalls.inserts.length = 0;
    supabaseCalls.tables.length = 0;
    supabaseCalls.upserts.length = 0;
    supabaseCalls.rpc.mockReset();
  });

  it("sanitizes private note and highlight body content from activity metadata", () => {
    expect(
      sanitizeActivityMetadata({
        route: "binder-reader",
        noteBody: "private note body",
        nested: {
          selector_json: { start: 1 },
          workspaceViewMode: "canvas",
        },
        selected_text: "quoted lesson selection",
      }),
    ).toEqual({
      route: "binder-reader",
      nested: {
        workspaceViewMode: "canvas",
      },
    });
  });

  it("uses the recent-item RPC when available so open_count can increment server-side", async () => {
    supabaseCalls.rpc.mockResolvedValueOnce({ data: null, error: null });

    await upsertUserRecentItem({
      userId: "user-1",
      itemType: "lesson",
      itemId: "lesson-1",
      binderId: "binder-1",
      lessonId: "lesson-1",
      titleSnapshot: "Limits",
    });

    expect(supabaseCalls.rpc).toHaveBeenCalledWith("record_user_recent_item", {
      p_user_id: "user-1",
      p_item_type: "lesson",
      p_item_id: "lesson-1",
      p_binder_id: "binder-1",
      p_folder_id: null,
      p_lesson_id: "lesson-1",
      p_title_snapshot: "Limits",
      p_metadata: {},
    });
    expect(supabaseCalls.upserts).toHaveLength(0);
  });

  it("falls back to an upsert that cannot duplicate the same user/item pair", async () => {
    supabaseCalls.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "record_user_recent_item not found" },
    });

    await upsertUserRecentItem({
      userId: "user-1",
      itemType: "binder",
      itemId: "binder-1",
      binderId: "binder-1",
      titleSnapshot: "Jacob Math Notes",
    });

    expect(supabaseCalls.upserts[0]).toMatchObject({
      table: "user_recent_items",
      payload: {
        user_id: "user-1",
        item_type: "binder",
        item_id: "binder-1",
        binder_id: "binder-1",
        title_snapshot: "Jacob Math Notes",
      },
      options: {
        onConflict: "user_id,item_type,item_id",
      },
    });
  });

  it("does not throw when recent activity storage fails", async () => {
    supabaseCalls.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "RLS denied" },
    });

    await expect(
      trackUserRecentItem({
        userId: "user-1",
        itemType: "folder",
        itemId: "folder-1",
      }),
    ).resolves.toBe(false);
  });

  it("writes lightweight module events without private content", async () => {
    await insertWorkspaceActivityEvent({
      userId: "user-1",
      binderId: "binder-1",
      lessonId: "lesson-1",
      moduleId: "private-notes",
      eventType: "module_opened",
      metadata: {
        workspaceViewMode: "canvas",
        content: "private writing",
      },
    });

    expect(supabaseCalls.inserts[0]).toMatchObject({
      table: "workspace_activity_events",
      payload: {
        user_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        module_id: "private-notes",
        event_type: "module_opened",
        metadata: {
          workspaceViewMode: "canvas",
        },
      },
    });
  });

  it("debounces repeated recent-item writes", async () => {
    vi.useFakeTimers();
    supabaseCalls.rpc.mockResolvedValue({ data: null, error: null });

    const input = {
      userId: "user-1",
      itemType: "lesson" as const,
      itemId: "lesson-1",
      binderId: "binder-1",
      lessonId: "lesson-1",
    };

    scheduleUserRecentItem(input, 100);
    scheduleUserRecentItem(input, 100);

    await vi.advanceTimersByTimeAsync(99);
    expect(supabaseCalls.rpc).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(supabaseCalls.rpc).toHaveBeenCalledTimes(1);
  });
});
