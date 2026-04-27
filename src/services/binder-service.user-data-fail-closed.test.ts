import { describe, expect, it, vi } from "vitest";
import { emptyDoc } from "@/lib/utils";
import { createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseProjectRef: null,
}));

import {
  createComment,
  createHighlight,
  upsertLearnerNote,
  upsertWorkspacePreferencesRecord,
} from "@/services/binder-service";

describe("binder-service user data write safety", () => {
  it("fails closed for private account writes when Supabase is unavailable", async () => {
    const expected = /supabase is required to save account data/i;

    await expect(
      upsertLearnerNote({
        ownerId: "user-1",
        binderId: "binder-1",
        lessonId: "lesson-1",
        title: "Cloud note",
        content: emptyDoc("must not save locally"),
        mathBlocks: [],
      }),
    ).rejects.toThrow(expected);

    await expect(
      createHighlight({
        ownerId: "user-1",
        binderId: "binder-1",
        lessonId: "lesson-1",
        anchorText: "important",
        color: "yellow",
      }),
    ).rejects.toThrow(expected);

    await expect(
      createComment({
        ownerId: "user-1",
        binderId: "binder-1",
        lessonId: "lesson-1",
        body: "Private sticky",
      }),
    ).rejects.toThrow(expected);

    await expect(
      upsertWorkspacePreferencesRecord(
        createDefaultWorkspacePreferences("user-1", "binder-1"),
      ),
    ).rejects.toThrow(expected);
  });
});
