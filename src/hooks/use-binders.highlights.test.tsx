// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BinderBundle, Profile } from "@/types";

const mocks = vi.hoisted(() => {
  const createHighlight = vi.fn();
  const updateHighlight = vi.fn();

  return {
    createHighlight,
    updateHighlight,
  };
});

vi.mock("@/services/binder-service", async () => {
  const actual = await vi.importActual<typeof import("@/services/binder-service")>(
    "@/services/binder-service",
  );

  return {
    ...actual,
    createHighlight: mocks.createHighlight,
    updateHighlight: mocks.updateHighlight,
  };
});

import { useAnnotationMutations } from "@/hooks/use-binders";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAnnotationMutations", () => {
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
    mocks.createHighlight.mockReset();
    mocks.updateHighlight.mockReset();
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

  it("applies highlight creation optimistically before the server responds", async () => {
    const pending = deferred<{
      id: string;
      owner_id: string;
      binder_id: string;
      lesson_id: string;
      anchor_text: string;
      color: "yellow";
      note_id: null;
      start_offset: number;
      end_offset: number;
      created_at: string;
    }>();

    mocks.createHighlight.mockReturnValueOnce(pending.promise);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAnnotationMutations(profile, "binder-1"), { wrapper });

    act(() => {
      result.current.highlight.mutate({
        binderId: "binder-1",
        lessonId: "lesson-1",
        anchorText: "like terms",
        selectedText: "like terms",
        color: "yellow",
        startOffset: 4,
        endOffset: 14,
      });
    });

    const optimisticBundle = queryClient.getQueryData<BinderBundle>(["binder", "binder-1", profile.id]);
    expect(optimisticBundle?.highlights[0]).toMatchObject({
      binder_id: "binder-1",
      lesson_id: "lesson-1",
      anchor_text: "like terms",
      color: "yellow",
      start_offset: 4,
      end_offset: 14,
    });
    expect(optimisticBundle?.highlights[0]?.id).toContain("highlight-optimistic:");

    pending.resolve({
      id: "hl-1",
      owner_id: profile.id,
      binder_id: "binder-1",
      lesson_id: "lesson-1",
      anchor_text: "like terms",
      color: "yellow",
      note_id: null,
      start_offset: 4,
      end_offset: 14,
      created_at: "2026-04-23T10:00:00.000Z",
    });

    await waitFor(() => {
      const savedBundle = queryClient.getQueryData<BinderBundle>(["binder", "binder-1", profile.id]);
      expect(savedBundle?.highlights[0]?.id).toBe("hl-1");
    });
  });
});
