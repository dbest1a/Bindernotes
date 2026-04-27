// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      resetHighlights: { isPending: false, mutateAsync: vi.fn() },
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
    theme: {
      globalTheme: {
        id: "paper-studio",
        studySurface: "math-blue",
        accent: "172 82% 27%",
        density: "cozy",
        roundness: "round",
        shadow: "lifted",
        font: "system",
        backgroundStyle: "subtle-grid",
        hoverMotion: false,
        snapMode: false,
        focusMode: false,
        compactMode: false,
        animationLevel: "none",
        graphAppearance: "sync",
        graphChrome: "standard",
        verticalSpace: "balanced",
        defaultHighlightColor: "yellow",
        reducedChrome: true,
        showUtilityUi: false,
        customPalette: {
          primary: "#0f766e",
          secondary: "#1d4ed8",
          accent: "#a16207",
        },
      },
      setGlobalTheme: vi.fn(),
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

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => mocks.theme,
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

  it("does not claim an empty private note is already saved to the account", () => {
    mocks.workspacePreferences.active = {
      ...createDefaultWorkspacePreferences("user-1", "binder-1"),
      activeMode: "simple",
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = {
      binder: {
        id: "binder-1",
        owner_id: "admin-1",
        title: "Calculus",
        slug: "calculus",
        subject: "Math",
        level: "Foundations",
        description: "A calculus binder.",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      folders: [],
      folderLinks: [],
      lessons: [
        {
          id: "lesson-1",
          binder_id: "binder-1",
          title: "Limits",
          order_index: 1,
          content: emptyDoc("Limits are local predictions."),
          math_blocks: [],
          is_preview: false,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        },
      ],
      notes: [],
      comments: [],
      highlights: [],
      conceptNodes: [],
      conceptEdges: [],
      seedHealth: null,
    };

    renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(screen.getByText("No private note saved for this lesson yet.")).toBeTruthy();
    expect(screen.queryByText("Saved to your account.")).toBeNull();
  });

  it("opens the math whiteboard route intent as a canvas whiteboard preset", async () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-jacob-math-notes");
    mocks.workspacePreferences.commit.mockClear();
    mocks.workspacePreferences.updateDraft.mockClear();
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      preset: "split-study",
      locked: true,
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = {
      binder: {
        id: "binder-jacob-math-notes",
        owner_id: "admin-1",
        title: "Jacob Math Notes",
        slug: "jacob-math-notes",
        subject: "Math",
        level: "Calculus",
        description: "A math binder.",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      folders: [],
      folderLinks: [],
      lessons: [
        {
          id: "lesson-jacob-calculus-limits",
          binder_id: "binder-jacob-math-notes",
          title: "Calculus Limits and the Derivative Definition",
          order_index: 1,
          content: emptyDoc("Limits are local predictions."),
          math_blocks: [],
          is_preview: false,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        },
      ],
      notes: [],
      comments: [],
      highlights: [],
      conceptNodes: [],
      conceptEdges: [],
      seedHealth: null,
    };

    renderReaderPage(
      "/binders/binder-jacob-math-notes/documents/lesson-jacob-calculus-limits?open=whiteboard",
    );

    await waitFor(() => {
      expect(mocks.workspacePreferences.commit).toHaveBeenCalled();
    });
    const next = mocks.workspacePreferences.commit.mock.calls.at(-1)?.[0];

    expect(next).toEqual(
      expect.objectContaining({
        activeMode: "canvas",
        preset: "math-practice-mode",
      }),
    );
    expect(next.enabledModules).toContain("whiteboard");
    expect(next.moduleLayout.whiteboard?.collapsed).toBe(false);
  });

  it("marks the rendered workspace root when maximize module space is enabled", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      preset: "split-study",
      styleChoiceCompleted: true,
      theme: {
        ...preferences.theme,
        compactMode: true,
      },
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = {
      binder: {
        id: "binder-1",
        owner_id: "admin-1",
        title: "Calculus",
        slug: "calculus",
        subject: "Math",
        level: "Foundations",
        description: "A calculus binder.",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      folders: [],
      folderLinks: [],
      lessons: [
        {
          id: "lesson-1",
          binder_id: "binder-1",
          title: "Limits",
          order_index: 1,
          content: emptyDoc("Limits are local predictions."),
          math_blocks: [],
          is_preview: false,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        },
      ],
      notes: [],
      comments: [],
      highlights: [],
      conceptNodes: [],
      conceptEdges: [],
      seedHealth: null,
    };

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(container.querySelector(".workspace-page")?.getAttribute("data-maximize-module-space")).toBe("true");
  });

  it("marks the topbar when canvas layout editing is active", async () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      preset: "math-graph-lab",
      locked: false,
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = {
      binder: {
        id: "binder-1",
        owner_id: "admin-1",
        title: "Algebra",
        slug: "algebra",
        subject: "Math",
        level: "Foundations",
        description: "An algebra binder.",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      folders: [],
      folderLinks: [],
      lessons: [
        {
          id: "lesson-1",
          binder_id: "binder-1",
          title: "Like Terms",
          order_index: 1,
          content: emptyDoc("Combine matching terms."),
          math_blocks: [],
          is_preview: false,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        },
      ],
      notes: [],
      comments: [],
      highlights: [],
      conceptNodes: [],
      conceptEdges: [],
      seedHealth: null,
    };

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    await waitFor(() => {
      expect(container.querySelector(".workspace-topbar")?.getAttribute("data-layout-editing")).toBe("true");
    });
    const topbar = container.querySelector(".workspace-topbar");

    expect(topbar?.getAttribute("data-utility-ui")).toBe("true");
    expect(topbar?.querySelector(".workspace-topbar__meta")).not.toBeNull();
    expect(topbar?.querySelector(".workspace-topbar__presets")).not.toBeNull();
    expect(topbar?.textContent).toContain("Study workspace");
    expect(topbar?.textContent).toContain("Edit mode");
    expect(topbar?.textContent).toContain("Math Graph Lab");
    expect(topbar?.textContent).toContain("Split Study");
  });

  it("keeps the locked study topbar compact even when utility UI is enabled", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      preset: "math-graph-lab",
      locked: true,
      styleChoiceCompleted: true,
      theme: {
        ...preferences.theme,
        showUtilityUi: true,
      },
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = {
      binder: {
        id: "binder-1",
        owner_id: "admin-1",
        title: "Algebra",
        slug: "algebra",
        subject: "Math",
        level: "Foundations",
        description: "An algebra binder.",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      folders: [],
      folderLinks: [],
      lessons: [
        {
          id: "lesson-1",
          binder_id: "binder-1",
          title: "Like Terms and Expressions",
          order_index: 1,
          content: emptyDoc("Combine matching terms."),
          math_blocks: [],
          is_preview: false,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        },
      ],
      notes: [],
      comments: [],
      highlights: [],
      conceptNodes: [],
      conceptEdges: [],
      seedHealth: null,
    };

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");
    const topbar = container.querySelector(".workspace-topbar");

    expect(topbar?.getAttribute("data-utility-ui")).toBe("false");
    expect(topbar?.textContent).toContain("Like Terms and Expressions");
    expect(topbar?.textContent).toContain("Canvas");
    expect(topbar?.textContent).toContain("Math Graph Lab");
    expect(topbar?.textContent).toContain("Locked study mode");
    expect(container.querySelector(".workspace-topbar__meta")).toBeNull();
    expect(container.querySelector(".workspace-topbar__presets")).toBeNull();
  });

  it("applies appearance color changes immediately from edit layout settings", async () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.theme.setGlobalTheme.mockClear();
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      preset: "math-graph-lab",
      locked: false,
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = {
      binder: {
        id: "binder-1",
        owner_id: "admin-1",
        title: "Algebra",
        slug: "algebra",
        subject: "Math",
        level: "Foundations",
        description: "An algebra binder.",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      folders: [],
      folderLinks: [],
      lessons: [
        {
          id: "lesson-1",
          binder_id: "binder-1",
          title: "Like Terms",
          order_index: 1,
          content: emptyDoc("Combine matching terms."),
          math_blocks: [],
          is_preview: false,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        },
      ],
      notes: [],
      comments: [],
      highlights: [],
      conceptNodes: [],
      conceptEdges: [],
      seedHealth: null,
    };

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    await waitFor(() => {
      expect(container.querySelector(".workspace-topbar")?.getAttribute("data-layout-editing")).toBe("true");
    });

    const oceanThemeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Ocean"),
    );
    expect(oceanThemeButton).not.toBeNull();
    fireEvent.click(oceanThemeButton!);

    expect(mocks.workspacePreferences.updateDraft).toHaveBeenCalled();
    expect(mocks.theme.setGlobalTheme).toHaveBeenCalled();
    expect(mocks.theme.setGlobalTheme.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ id: "ocean" }),
    );
  });
});
