// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyWorkspaceMode,
  applyWorkspaceViewModeToViewport,
  createDefaultWorkspacePreferences,
} from "@/lib/workspace-preferences";
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

let viewportWidth = 1024;
let viewportHeight = 768;

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

function setTestViewportWidth(width: number) {
  viewportWidth = width;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

function setTestViewportSize(width: number, height: number) {
  viewportWidth = width;
  viewportHeight = height;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

function matchesResponsiveQuery(query: string) {
  if (query === "(max-width: 767px)") {
    return viewportWidth <= 767;
  }

  if (query === "(min-width: 768px) and (max-width: 1180px)") {
    return viewportWidth >= 768 && viewportWidth <= 1180;
  }

  if (query === "(min-width: 1181px)") {
    return viewportWidth >= 1181;
  }

  if (query === "(max-width: 1180px)") {
    return viewportWidth <= 1180;
  }

  if (query === "(pointer: coarse)" || query === "(prefers-reduced-motion: reduce)") {
    return false;
  }

  if (query === "(orientation: portrait)") {
    return viewportHeight >= viewportWidth;
  }

  if (query === "(orientation: landscape)") {
    return viewportWidth > viewportHeight;
  }

  return false;
}

function createSingleLessonBundle(
  binderTitle = "Algebra",
  lessonTitle = "Like Terms",
): BinderBundle {
  return {
    binder: {
      id: "binder-1",
      owner_id: "admin-1",
      title: binderTitle,
      slug: binderTitle.toLowerCase().replace(/\s+/g, "-"),
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
        title: lessonTitle,
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

describe("BinderReaderPage", () => {
  beforeEach(() => {
    setTestViewportSize(1024, 768);
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
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect = vi.fn();
        observe = vi.fn();
        unobserve = vi.fn();
      },
    );
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
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

  it("offers guided first-time starter choices that apply a Facelift preset locally", async () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.workspacePreferences.commit.mockClear();
    mocks.workspacePreferences.active = {
      ...preferences,
      styleChoiceCompleted: false,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle("Jacob Math Notes", "Vectors and Matrices");

    renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(screen.getByText("Pick what you want to do first.")).toBeTruthy();
    expect(screen.getByText("Work math")).toBeTruthy();

    fireEvent.click(screen.getByText("Work math").closest("button")!);

    await waitFor(() => {
      expect(mocks.workspacePreferences.commit).toHaveBeenCalled();
    });

    const next = mocks.workspacePreferences.commit.mock.calls.at(-1)?.[0];
    expect(next).toEqual(
      expect.objectContaining({
        preset: "math-practice-mode",
        workspacePresentationMode: "facelift",
        styleChoiceCompleted: true,
      }),
    );
    expect(next?.facelift.surfaceMode).toBe("simple");
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

  it("does not restore saved workspace focus as an automatic fullscreen state", async () => {
    const originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });

    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.workspacePreferences.commit.mockClear();
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      preset: "math-practice-mode",
      styleChoiceCompleted: true,
      theme: {
        ...preferences.theme,
        focusMode: true,
      },
      simple: {
        ...preferences.simple,
        focusMode: true,
      },
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle("Jacob Math Notes", "Geometry Diagram");

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(container.querySelector(".workspace-page")?.getAttribute("data-workspace-active-focus")).toBe("false");
    expect(requestFullscreen).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mocks.workspacePreferences.commit).toHaveBeenCalled();
    });
    const next = mocks.workspacePreferences.commit.mock.calls.at(-1)?.[0];
    expect(next?.theme.focusMode).toBe(false);
    expect(next?.simple.focusMode).toBe(false);

    if (originalRequestFullscreen) {
      Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
        configurable: true,
        value: originalRequestFullscreen,
      });
    } else {
      const prototypeWithFullscreen = HTMLElement.prototype as Partial<HTMLElement> & {
        requestFullscreen?: HTMLElement["requestFullscreen"];
      };
      delete prototypeWithFullscreen.requestFullscreen;
    }
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

  it("labels and renders Study Panels separately from Simple View", () => {
    setTestViewportWidth(1181);

    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "modular",
    );
    mocks.workspacePreferences.active = {
      ...preferences,
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle();

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(container.querySelector(".workspace-page")?.getAttribute("data-workspace-view")).toBe("modular");
    expect(screen.getByTestId("study-panels-shell")).toBeTruthy();
    expect(screen.getByRole("button", { name: /workspace mode study panels/i })).toBeTruthy();
    expect(screen.getByRole("tablist", { name: /study panel modules/i })).toBeTruthy();
    expect(container.querySelector(".workspace-topbar")?.hasAttribute("hidden")).toBe(true);
    expect(container.querySelector(".workspace-canvas-shell")).toBeNull();
    expect(container.querySelector(".simple-presentation-shell")).toBeNull();
  });

  it("uses Compact Study Chrome markers and a visible Workspace mode switcher in Canvas", () => {
    setTestViewportWidth(1181);
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, compactStudyChrome: true }),
    );
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle();

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(container.querySelector(".workspace-page")?.getAttribute("data-compact-study-chrome")).toBe("true");
    expect(container.querySelector(".workspace-topbar")?.getAttribute("data-compact-study-chrome")).toBe("true");
    expect(screen.getByRole("button", { name: /workspace mode canvas/i })).toBeTruthy();
    expect(screen.queryByText("Change view")).toBeNull();
  });

  it("keeps non-beta workspace chrome unchanged when Compact Study Chrome is off", () => {
    setTestViewportWidth(1181);
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "simple",
    );
    mocks.workspacePreferences.active = {
      ...preferences,
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle();

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(container.querySelector(".workspace-page")?.getAttribute("data-compact-study-chrome")).toBe("false");
    expect(screen.getByText("Change view")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /workspace mode simple/i })).toBeNull();
  });

  it("keeps the Workspace mode switcher visible in Simple and Facelift when Compact Study Chrome is on", () => {
    setTestViewportWidth(1181);
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, compactStudyChrome: true }),
    );
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle();

    const simplePreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "simple",
    );
    mocks.workspacePreferences.active = {
      ...simplePreferences,
      styleChoiceCompleted: true,
    };
    const simpleRender = renderReaderPage("/binders/binder-1/documents/lesson-1");
    expect(screen.getByRole("button", { name: /workspace mode simple/i })).toBeTruthy();
    simpleRender.unmount();

    const faceliftPreferences = applyWorkspaceViewModeToViewport(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "facelift",
      { width: 1440, height: 900 },
    );
    mocks.workspacePreferences.active = {
      ...faceliftPreferences,
      styleChoiceCompleted: true,
    };
    renderReaderPage("/binders/binder-1/documents/lesson-1");
    expect(screen.getByRole("button", { name: /workspace mode facelift/i })).toBeTruthy();
  });

  it("compacts Study Panels controls without duplicate labels when Compact Study Chrome is on", () => {
    setTestViewportWidth(1181);
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, compactStudyChrome: true }),
    );

    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "modular",
    );
    mocks.workspacePreferences.active = {
      ...preferences,
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle();

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(screen.getByTestId("study-panels-shell").getAttribute("data-compact-study-chrome")).toBe("true");
    expect(screen.getByRole("button", { name: /workspace mode study panels/i })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /settings/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^focus panel$/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^tools$/i })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /tools/i })).toBeNull();
    expect(screen.getByRole("tab", { name: /extras/i })).toBeTruthy();
    expect(container.querySelector(".workspace-topbar")?.hasAttribute("hidden")).toBe(true);
  });

  it("uses responsive module tabs on tablet portrait widths instead of tiny desktop windows", () => {
    setTestViewportSize(768, 1024);
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      preset: "math-graph-lab",
      locked: true,
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle();

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(container.querySelector(".workspace-page")?.getAttribute("data-viewport-category")).toBe("tablet");
    expect(container.querySelector(".workspace-page")?.getAttribute("data-viewport-orientation")).toBe("portrait");
    expect(container.querySelector(".workspace-page")?.getAttribute("data-mobile-workspace")).toBe("true");
    expect(container.querySelector(".responsive-mobile-tabs")).not.toBeNull();
    expect(container.querySelector(".responsive-mobile-module")).not.toBeNull();
    expect(container.querySelector(".workspace-canvas-shell")).toBeNull();
  });

  it("keeps the designed workspace path on tablet landscape and above", () => {
    setTestViewportSize(1024, 768);
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      preset: "math-graph-lab",
      locked: true,
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle();

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(container.querySelector(".workspace-page")?.getAttribute("data-viewport-category")).toBe("tablet");
    expect(container.querySelector(".workspace-page")?.getAttribute("data-viewport-orientation")).toBe("landscape");
    expect(container.querySelector(".workspace-page")?.getAttribute("data-mobile-workspace")).toBe("false");
    expect(container.querySelector(".responsive-mobile-tabs")).toBeNull();
    expect(container.querySelector(".workspace-canvas-shell")).not.toBeNull();
  });

  it("keeps the desktop workspace path above the tablet breakpoint", () => {
    setTestViewportSize(1181, 820);
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.workspacePreferences.active = {
      ...preferences,
      activeMode: "canvas",
      preset: "math-graph-lab",
      locked: true,
      styleChoiceCompleted: true,
    };
    mocks.binderBundle.isLoading = false;
    mocks.binderBundle.error = null;
    mocks.binderBundle.data = createSingleLessonBundle();

    const { container } = renderReaderPage("/binders/binder-1/documents/lesson-1");

    expect(container.querySelector(".workspace-page")?.getAttribute("data-viewport-category")).toBe("desktop");
    expect(container.querySelector(".responsive-mobile-tabs")).toBeNull();
    expect(container.querySelector(".workspace-canvas-shell")).not.toBeNull();
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

    let oceanThemeButton: HTMLButtonElement | undefined;
    await waitFor(() => {
      oceanThemeButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Ocean"),
      );
      expect(oceanThemeButton).toBeDefined();
    });
    fireEvent.click(oceanThemeButton!);

    expect(mocks.workspacePreferences.updateDraft).toHaveBeenCalled();
    expect(mocks.theme.setGlobalTheme).toHaveBeenCalled();
    expect(mocks.theme.setGlobalTheme.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ id: "ocean" }),
    );
  });
});
