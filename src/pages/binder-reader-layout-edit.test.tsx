// @vitest-environment jsdom

import { act, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";
import { emptyDoc } from "@/lib/utils";
import type { BinderBundle, Profile, WorkspacePreferences } from "@/types";

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
      isLoading: false,
    },
    workspacePreferences: {
      active: null as WorkspacePreferences | null,
      draft: null as WorkspacePreferences | null,
      saved: null as WorkspacePreferences | null,
      saveError: null as string | null,
      updateDraft: vi.fn(),
      commit: vi.fn(),
      save: vi.fn(),
      saveUnlocked: vi.fn(),
      cancel: vi.fn(),
      reset: vi.fn(),
    },
    windowedWorkspaceProps: null as {
      mode: "study" | "setup";
      onFitViewport: (viewport: { width: number; height: number }) => void;
      preferences: WorkspacePreferences;
    } | null,
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

vi.mock("@/components/workspace/windowed-workspace", () => ({
  WindowedWorkspace: (props: {
    mode: "study" | "setup";
    onFitViewport: (viewport: { width: number; height: number }) => void;
    preferences: WorkspacePreferences;
  }) => {
    mocks.windowedWorkspaceProps = props;
    return (
      <section
        className="workspace-canvas-shell"
        data-workspace-locked={props.preferences.locked ? "true" : "false"}
        data-workspace-mode={props.mode}
      />
    );
  },
}));

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

function createSingleLessonBundle(): BinderBundle {
  return {
    binder: {
      id: "binder-1",
      owner_id: "admin-1",
      title: "Algebra",
      slug: "algebra",
      subject: "Math",
      level: "Foundations",
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
}

function matchesResponsiveQuery(query: string) {
  if (query === "(min-width: 1181px)") {
    return true;
  }

  if (
    query === "(max-width: 767px)" ||
    query === "(min-width: 768px) and (max-width: 1180px)" ||
    query === "(max-width: 1180px)" ||
    query === "(pointer: coarse)" ||
    query === "(prefers-reduced-motion: reduce)"
  ) {
    return false;
  }

  return false;
}

describe("BinderReaderPage layout editing", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1366,
    });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: matchesResponsiveQuery(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    mocks.workspacePreferences.active = null;
    mocks.workspacePreferences.draft = null;
    mocks.workspacePreferences.saved = null;
    mocks.workspacePreferences.saveError = null;
    mocks.workspacePreferences.updateDraft.mockReset();
    mocks.workspacePreferences.commit.mockReset();
    mocks.workspacePreferences.save.mockReset();
    mocks.workspacePreferences.saveUnlocked.mockReset();
    mocks.workspacePreferences.cancel.mockReset();
    mocks.workspacePreferences.reset.mockReset();
    mocks.windowedWorkspaceProps = null;
    mocks.binderBundle.data = createSingleLessonBundle();
    mocks.binderBundle.error = null;
    mocks.binderBundle.isLoading = false;
  });

  it("does not let a stale locked auto-fit snap the workspace back to a preset after Edit layout is clicked", () => {
    const customLessonFrame = { x: 120, y: 1840, w: 640, h: 420, z: 7 };
    const customNotesFrame = { x: 820, y: 1840, w: 460, h: 420, z: 8 };
    const preferences: WorkspacePreferences = {
      ...createDefaultWorkspacePreferences("user-1", "binder-1"),
      activeMode: "canvas",
      preset: "math-graph-lab",
      locked: true,
      styleChoiceCompleted: true,
      enabledModules: ["lesson", "private-notes"],
      windowLayout: {
        lesson: customLessonFrame,
        "private-notes": customNotesFrame,
      },
      viewportFit: {
        width: 820,
        height: 640,
        updatedAt: new Date(0).toISOString(),
      },
    };
    mocks.workspacePreferences.active = preferences;
    mocks.workspacePreferences.draft = preferences;
    mocks.workspacePreferences.saved = preferences;

    renderReaderPage("/binders/binder-1/documents/lesson-1");

    const staleFitViewport = mocks.windowedWorkspaceProps?.onFitViewport;
    expect(staleFitViewport).toBeTruthy();

    act(() => {
      screen.getByRole("button", { name: "Edit layout" }).click();
      staleFitViewport?.({ width: 1366, height: 760 });
    });

    expect(mocks.workspacePreferences.commit).not.toHaveBeenCalled();
    expect(mocks.workspacePreferences.updateDraft).toHaveBeenCalledTimes(1);

    const unlockDraft = mocks.workspacePreferences.updateDraft.mock.calls[0]?.[0];
    const nextDraft = unlockDraft(preferences);
    expect(nextDraft.locked).toBe(false);
    expect(nextDraft.windowLayout.lesson).toEqual(customLessonFrame);
    expect(nextDraft.windowLayout["private-notes"]).toEqual(customNotesFrame);
  });

  it("locks the edited layout without changing resized frames or leaving a stale viewport fit", () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });
    const customLessonFrame = { x: 40, y: 24, w: 900, h: 680, z: 4 };
    const customNotesFrame = { x: 980, y: 24, w: 420, h: 680, z: 5 };
    const preferences: WorkspacePreferences = {
      ...createDefaultWorkspacePreferences("user-1", "binder-1"),
      activeMode: "canvas",
      preset: "math-graph-lab",
      locked: false,
      styleChoiceCompleted: true,
      enabledModules: ["lesson", "private-notes"],
      windowLayout: {
        lesson: customLessonFrame,
        "private-notes": customNotesFrame,
      },
      viewportFit: {
        width: 640,
        height: 480,
        updatedAt: new Date(0).toISOString(),
      },
    };
    mocks.workspacePreferences.active = preferences;
    mocks.workspacePreferences.draft = preferences;
    mocks.workspacePreferences.saved = preferences;

    renderReaderPage("/binders/binder-1/documents/lesson-1");

    act(() => {
      screen.getAllByRole("button", { name: "Lock" })[0]?.click();
    });

    const committed = mocks.workspacePreferences.commit.mock.calls.at(-1)?.[0] as WorkspacePreferences;
    expect(committed.locked).toBe(true);
    expect(committed.windowLayout.lesson).toEqual(customLessonFrame);
    expect(committed.windowLayout["private-notes"]).toEqual(customNotesFrame);
    expect(committed.viewportFit).toEqual(
      expect.objectContaining({
        width: 1366,
        height: 732,
      }),
    );
  });

  it("turns topbar snap on as module-aware snapping", () => {
    const preferences: WorkspacePreferences = {
      ...createDefaultWorkspacePreferences("user-1", "binder-1"),
      activeMode: "canvas",
      preset: "math-graph-lab",
      locked: false,
      styleChoiceCompleted: true,
      canvas: {
        ...createDefaultWorkspacePreferences("user-1", "binder-1").canvas,
        snapBehavior: "off",
      },
    };
    mocks.workspacePreferences.active = preferences;
    mocks.workspacePreferences.draft = preferences;
    mocks.workspacePreferences.saved = preferences;

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");
    const topbar = container.querySelector<HTMLElement>(".workspace-topbar");
    expect(topbar).toBeTruthy();

    act(() => {
      within(topbar!).getByRole("button", { name: "Snap off" }).click();
    });

    const snapDraft = mocks.workspacePreferences.updateDraft.mock.calls.at(-1)?.[0];
    const nextDraft = snapDraft(preferences);
    expect(nextDraft.canvas.snapBehavior).toBe("modules");
    expect(nextDraft.theme.snapMode).toBe(true);
  });
});
