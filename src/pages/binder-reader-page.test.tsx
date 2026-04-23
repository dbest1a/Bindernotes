// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";
import { emptyDoc } from "@/lib/utils";
import type { BinderBundle, Profile } from "@/types";

const mocks = vi.hoisted(() => {
  const profile: Profile = {
    id: "user-1",
    email: "learner@example.com",
    full_name: "Learner Demo",
    role: "learner",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  return {
    profile,
    binderBundle: {
      data: undefined as BinderBundle | undefined,
      error: null as Error | null,
      isLoading: true,
    },
    workspacePreferences: {
      active: null as ReturnType<typeof createDefaultWorkspacePreferences> | null,
      draft: null,
      saved: null,
      updateDraft: vi.fn(),
      commit: vi.fn(),
      save: vi.fn(),
      saveUnlocked: vi.fn(),
      cancel: vi.fn(),
      reset: vi.fn(),
    },
    noteMutation: {
      isPending: false,
      mutateAsync: vi.fn(),
    },
    historyQuery: {
      data: undefined,
      error: null as Error | null,
      isLoading: false,
    },
    historyMutations: {
      createEvent: { mutateAsync: vi.fn() },
      createSource: { mutateAsync: vi.fn() },
      upsertEvidence: { mutateAsync: vi.fn() },
      createArgumentChain: { mutateAsync: vi.fn() },
      updateArgumentChain: { mutateAsync: vi.fn() },
      createArgumentNode: { mutateAsync: vi.fn() },
      createArgumentEdge: { mutateAsync: vi.fn() },
      upsertMythCheck: { mutateAsync: vi.fn() },
    },
    annotationMutations: {
      highlight: { mutate: vi.fn() },
      deleteHighlight: { mutate: vi.fn() },
      comment: { mutateAsync: vi.fn() },
      updateComment: { mutate: vi.fn() },
      deleteComment: { mutate: vi.fn() },
    },
    mathWorkspace: {
      state: {
        graphVisible: true,
        graphExpanded: false,
        angleMode: "rad",
        calculatorExpression: "",
        calculatorResult: null,
        calculatorError: null,
        history: [],
        currentGraphState: null,
        savedGraphs: [],
        savedFunctions: [],
      },
      setGraphExpanded: vi.fn(),
      setGraphVisible: vi.fn(),
      savedFunctionMap: {},
      setExpression: vi.fn(),
      appendToken: vi.fn(),
      clearExpression: vi.fn(),
      backspace: vi.fn(),
      evaluate: vi.fn(),
      setAngleMode: vi.fn(),
      clearGraphState: vi.fn(),
      saveGraphSnapshot: vi.fn(),
      deleteGraphSnapshot: vi.fn(),
      loadGraphSnapshot: vi.fn(),
      clearHistory: vi.fn(),
      useHistoryItem: vi.fn(),
      removeHistoryItem: vi.fn(),
      saveFunction: vi.fn(),
      deleteSavedFunction: vi.fn(),
      useSavedFunction: vi.fn(),
      renameSavedFunction: vi.fn(),
      setCurrentGraphState: vi.fn(),
      clearCurrentGraph: vi.fn(),
      reuseSavedFunction: vi.fn(),
    },
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.profile,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-binders", () => ({
  useBinderBundle: () => mocks.binderBundle,
  useLearnerNoteMutation: () => mocks.noteMutation,
  useAnnotationMutations: () => mocks.annotationMutations,
}));

vi.mock("@/hooks/use-workspace-preferences", () => ({
  useWorkspacePreferences: () => mocks.workspacePreferences,
}));

vi.mock("@/hooks/use-history-suite", () => ({
  useHistorySuite: () => mocks.historyQuery,
  useHistoryMutations: () => mocks.historyMutations,
}));

vi.mock("@/hooks/use-math-workspace", () => ({
  useMathWorkspace: () => mocks.mathWorkspace,
}));

import { BinderReaderPage } from "@/pages/binder-reader-page";

function renderReaderPage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/binders/:binderId/documents/:lessonId" element={<BinderReaderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BinderReaderPage", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the loading shell instead of crashing before lessons are available", () => {
    mocks.workspacePreferences.active = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.binderBundle.isLoading = true;
    mocks.binderBundle.data = undefined;
    mocks.binderBundle.error = null;

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a real unavailable state instead of blanking when a binder has no lessons", () => {
    mocks.workspacePreferences.active = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = {
      binder: {
        id: "binder-1",
        owner_id: "admin-1",
        title: "Empty binder",
        slug: "empty-binder",
        subject: "Math",
        level: "Algebra",
        description: "An empty binder for regression testing.",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      folders: [],
      folderLinks: [],
      lessons: [],
      notes: [],
      comments: [],
      highlights: [],
      conceptNodes: [],
      conceptEdges: [],
    };
    mocks.noteMutation.isPending = false;
    mocks.noteMutation.mutateAsync.mockResolvedValue({
      id: "note-1",
      binder_id: "binder-1",
      lesson_id: "lesson-1",
      folder_id: null,
      owner_id: "user-1",
      title: "Notes",
      content: emptyDoc(),
      math_blocks: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    });

    renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(screen.getByText("Document unavailable")).toBeTruthy();
  });
});
