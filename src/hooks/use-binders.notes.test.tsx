// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BinderBundle, LearnerNote, Profile } from "@/types";
import { emptyDoc } from "@/lib/utils";

const mocks = vi.hoisted(() => ({
  upsertLearnerNote: vi.fn(),
}));

vi.mock("@/services/binder-service", async () => {
  const actual = await vi.importActual<typeof import("@/services/binder-service")>(
    "@/services/binder-service",
  );

  return {
    ...actual,
    upsertLearnerNote: mocks.upsertLearnerNote,
  };
});

import { useLearnerNoteMutation } from "@/hooks/use-binders";

describe("useLearnerNoteMutation", () => {
  const profile: Profile = {
    id: "user-1",
    email: "learner@example.com",
    full_name: "Learner",
    role: "learner",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    window.localStorage.clear();
    mocks.upsertLearnerNote.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const initialBundle: BinderBundle = {
      binder: {
        id: "binder-1",
        owner_id: "system",
        title: "Binder",
        slug: "binder",
        description: "",
        subject: "Math",
        level: "Foundations",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      lessons: [],
      notes: [],
      comments: [],
      highlights: [],
      folders: [],
      folderLinks: [],
      conceptNodes: [],
      conceptEdges: [],
      seedHealth: null,
    };

    queryClient.setQueryData(["binder", "binder-1", profile.id], initialBundle);
  });

  it("stores the saved private note in the current user's binder cache and publishes a tab sync signal", async () => {
    const savedNote: LearnerNote = {
      id: "note-1",
      owner_id: profile.id,
      binder_id: "binder-1",
      lesson_id: "lesson-1",
      folder_id: null,
      title: "Limits notes",
      content: emptyDoc("Saved note"),
      math_blocks: [],
      pinned: false,
      created_at: "2026-04-23T10:00:00.000Z",
      updated_at: "2026-04-23T10:01:00.000Z",
    };
    mocks.upsertLearnerNote.mockResolvedValueOnce(savedNote);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLearnerNoteMutation(profile, "binder-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        binderId: "binder-1",
        lessonId: "lesson-1",
        folderId: "folder-math",
        title: "Limits notes",
        content: emptyDoc("Saved note"),
        mathBlocks: [],
      });
    });

    await waitFor(() => {
      const bundle = queryClient.getQueryData<BinderBundle>(["binder", "binder-1", profile.id]);
      expect(bundle?.notes).toHaveLength(1);
      expect(bundle?.notes[0]).toMatchObject({
        id: "note-1",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
      });
    });
    expect(mocks.upsertLearnerNote).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: profile.id,
        binderId: "binder-1",
        lessonId: "lesson-1",
      }),
    );

    const rawSync = window.localStorage.getItem("binder-notes:note-sync:v1");
    expect(rawSync).toBeTruthy();
    expect(JSON.parse(rawSync ?? "{}")).toMatchObject({
      ownerId: profile.id,
      binderId: "binder-1",
      lessonId: "lesson-1",
      action: "upsert",
    });
  });
});
