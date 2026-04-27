// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MathWhiteboardLabPage } from "@/pages/math-whiteboard-lab-page";

const mocks = vi.hoisted(() => ({
  setGraphExpanded: vi.fn(),
  setGraphVisible: vi.fn(),
  setGraphMode: vi.fn(),
  whiteboardCanvasProps: null as Record<string, unknown> | null,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: {
      id: "user-1",
      email: "learner@example.com",
      full_name: "Learner",
      role: "learner",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseProjectRef: null,
}));

vi.mock("@/hooks/use-binders", () => ({
  useDashboard: () => ({
    data: {
      folders: [],
      folderBinders: [],
      binders: [],
      lessons: [],
    },
    error: null,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-math-workspace", () => ({
  useMathWorkspace: () => ({
    state: {
      graphVisible: true,
      graphExpanded: false,
      graphMode: "2d",
      calculatorExpression: "x^2",
      calculatorResult: null,
      calculatorError: null,
      angleMode: "rad",
      history: [],
      savedGraphs: [],
      savedFunctions: [],
      currentGraphState: null,
    },
    setGraphExpanded: mocks.setGraphExpanded,
    setGraphVisible: mocks.setGraphVisible,
    setGraphMode: mocks.setGraphMode,
    savedFunctionMap: {},
    clearCurrentGraph: vi.fn(),
    setCurrentGraphState: vi.fn(),
    setExpression: vi.fn(),
    appendToken: vi.fn(),
    backspace: vi.fn(),
    clearExpression: vi.fn(),
    clearHistory: vi.fn(),
    deleteHistoryItem: vi.fn(),
    evaluate: vi.fn(),
    reuseHistoryExpression: vi.fn(),
    reuseSavedFunction: vi.fn(),
    setAngleMode: vi.fn(),
    deleteSavedFunction: vi.fn(),
    deleteGraphSnapshot: vi.fn(),
    loadGraphSnapshot: vi.fn(),
    saveGraphSnapshot: vi.fn(),
  }),
}));

vi.mock("@/components/math/math-workspace-modules", () => ({
  DesmosGraphModule: ({ title = "Desmos graph" }: { title?: string }) => (
    <section>{title}</section>
  ),
  ScientificCalculatorModule: () => <section>Scientific calculator</section>,
  SavedGraphsModule: () => <section>Saved graphs</section>,
}));

vi.mock("@/components/whiteboard/whiteboard-canvas", () => ({
  WhiteboardCanvas: (props: Record<string, unknown>) => {
    mocks.whiteboardCanvasProps = props;
    return <div data-testid="whiteboard-excalidraw-host" />;
  },
}));

function renderLab(options: { seedBoard?: boolean } = {}) {
  if (options.seedBoard !== false) {
    window.localStorage.setItem(
      "bindernotes:whiteboards:user-1:math-lab:math-lab-whiteboard",
      JSON.stringify([
        {
          id: "board-test",
          ownerId: "user-1",
          binderId: "math-lab",
          lessonId: "math-lab-whiteboard",
          title: "Math Whiteboard Lab whiteboard",
          subject: "Math",
          moduleContext: "lesson",
          scene: { elements: [], appState: { viewBackgroundColor: "#11131a" }, files: {} },
          modules: [],
          objectCount: 0,
          sceneSizeBytes: 0,
          assetSizeBytes: 0,
          storageMode: "local-draft",
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          archivedAt: null,
        },
      ]),
    );
  }
  return render(
    <MemoryRouter>
      <MathWhiteboardLabPage />
    </MemoryRouter>,
  );
}

describe("MathWhiteboardLabPage", () => {
  afterEach(() => {
    cleanup();
    mocks.whiteboardCanvasProps = null;
    window.localStorage.clear();
  });

  it("renders as a fullscreen whiteboard page without BinderNotes workspace chrome", () => {
    renderLab();

    const root = screen.getByTestId("whiteboard-lab-page");
    expect(root.className).toContain("fixed");
    expect(root.className).toContain("inset-0");
    expect(root.className).toContain("h-screen");
    expect(root.className).toContain("w-screen");
    expect(screen.queryByText("Study workspace")).toBeNull();
    expect(screen.queryByText("Workspace setup")).toBeNull();
    expect(screen.getByTestId("whiteboard-corner-fullscreen")).toBeTruthy();
    expect(screen.getByTestId("whiteboard-corner-back")).toBeTruthy();
  });

  it("keeps the module drawer in the screen-fixed floating UI layer", () => {
    renderLab();

    const drawerToggle = screen.getByTestId("whiteboard-module-drawer-toggle");
    fireEvent.click(drawerToggle);

    expect(screen.getByTestId("whiteboard-floating-ui-layer").className).toContain("fixed");
    const drawer = screen.getByTestId("whiteboard-module-drawer");
    expect(drawer.className).toContain("absolute");
    expect(drawer.className).toContain("right-4");
    expect(drawer.className).not.toContain("left-4");
    expect(screen.getByRole("button", { name: /source lesson/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /private notes/i })).toBeTruthy();
  });

  it("keeps BinderNotes controls out of Excalidraw native top-left and bottom-left zones", () => {
    renderLab();

    const dock = screen.getByTestId("whiteboard-lab-dock");
    expect(dock.className).toContain("right-4");
    expect(dock.className).toContain("top-24");
    expect(dock.className).not.toContain("bottom-4");
    expect(dock.className).not.toContain("left-4");
    expect(screen.getByTestId("whiteboard-module-drawer-toggle")).toBeTruthy();
    expect(screen.queryByText("19 objects")).toBeNull();
  });

  it("keeps back and fullscreen controls in the BinderNotes dock instead of Excalidraw top-right", () => {
    renderLab();

    const dock = screen.getByTestId("whiteboard-lab-dock");
    const cornerControls = screen.getByTestId("whiteboard-corner-controls");
    expect(dock.contains(cornerControls)).toBe(true);
    expect(cornerControls.className).not.toContain("absolute");
    expect(cornerControls.className).not.toContain("top-4");
    expect(screen.getByRole("button", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fullscreen" }).textContent).toContain("Full screen");
  });

  it("shows a rename field and compact save confirmation instead of the old bottom status strip", () => {
    renderLab();

    expect(screen.getByTestId("whiteboard-board-title-input")).toBeTruthy();
    expect(screen.getByTestId("whiteboard-save-confirmation").textContent).toMatch(/local draft|saved/i);
    expect(screen.queryByText("19 objects")).toBeNull();
  });

  it("shows a lightweight start manager when no whiteboard is selected yet", async () => {
    renderLab({ seedBoard: false });

    await waitFor(() => expect(screen.getByTestId("whiteboard-start-panel")).toBeTruthy());
    expect(screen.getByTestId("whiteboard-new-board")).toBeTruthy();
    expect(screen.getByText("Recent whiteboards")).toBeTruthy();
    expect(screen.getByText("No saved whiteboards yet.")).toBeTruthy();
  });

  it("keeps a newly created whiteboard open when an empty startup list resolves late", async () => {
    renderLab({ seedBoard: false });

    fireEvent.click(screen.getByTestId("whiteboard-new-board"));

    await waitFor(() => expect(screen.getByTestId("whiteboard-excalidraw-host")).toBeTruthy());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("whiteboard-start-panel")).toBeNull();
    expect(screen.getByTestId("whiteboard-excalidraw-host")).toBeTruthy();
  });

  it("collapses the whiteboard control stack into a compact square chip", () => {
    renderLab();

    fireEvent.click(screen.getByTestId("whiteboard-controls-minimize"));

    expect(screen.queryByTestId("whiteboard-board-title-input")).toBeNull();
    expect(screen.queryByTestId("whiteboard-module-drawer-toggle")).toBeNull();
    expect(screen.getByTestId("whiteboard-control-chip")).toBeTruthy();

    fireEvent.click(screen.getByTestId("whiteboard-control-chip"));

    expect(screen.getByTestId("whiteboard-board-title-input")).toBeTruthy();
    expect(screen.getByTestId("whiteboard-module-drawer-toggle")).toBeTruthy();
  });

  it("adds Desmos as a live card from the lab drawer instead of a confusing preview-only card", () => {
    const { container } = renderLab();

    fireEvent.click(screen.getByTestId("whiteboard-module-drawer-toggle"));
    fireEvent.click(screen.getByRole("button", { name: /desmos graph/i }));

    expect(screen.getByText("Desmos graph")).toBeTruthy();
    expect(screen.queryByText(/preview/i)).toBeNull();
    expect(container.querySelector('[data-whiteboard-module="desmos-graph"]')?.getAttribute("data-whiteboard-module-anchor")).toBe("viewport");
  });

  it("adds multiple independent Desmos cards from the toolbox", () => {
    const { container } = renderLab();

    fireEvent.click(screen.getByTestId("whiteboard-module-drawer-toggle"));
    fireEvent.click(screen.getByRole("button", { name: /desmos graph/i }));
    fireEvent.click(screen.getByTestId("whiteboard-module-drawer-toggle"));
    fireEvent.click(screen.getByRole("button", { name: /desmos graph/i }));

    expect(screen.getAllByText("Desmos graph")).toHaveLength(2);
    expect(container.querySelectorAll('[data-whiteboard-module="desmos-graph"]')).toHaveLength(2);
  });

  it("adds an annotations card from the lab drawer", () => {
    const { container } = renderLab();

    fireEvent.click(screen.getByTestId("whiteboard-module-drawer-toggle"));
    fireEvent.click(screen.getByRole("button", { name: /annotations/i }));

    expect(container.querySelector('[data-whiteboard-module="comments"]')).toBeTruthy();
    expect(screen.getAllByText("Annotations").length).toBeGreaterThan(0);
  });

  it("adds fixed-size board modules near the latest panned and zoomed viewport center", async () => {
    const { container } = renderLab();

    await waitFor(() => expect(mocks.whiteboardCanvasProps).toBeTruthy());
    act(() => {
      (
        mocks.whiteboardCanvasProps?.onViewportChange as (transform: {
          scrollX: number;
          scrollY: number;
          zoom: number;
          viewportWidth: number;
          viewportHeight: number;
          offsetLeft: number;
          offsetTop: number;
        }) => void
      )({
        scrollX: 100,
        scrollY: -80,
        zoom: 2,
        viewportWidth: 1200,
        viewportHeight: 800,
        offsetLeft: 0,
        offsetTop: 0,
      });
    });

    fireEvent.click(screen.getByTestId("whiteboard-module-drawer-toggle"));
    fireEvent.click(screen.getByRole("button", { name: /source lesson/i }));

    await waitFor(() => {
      const card = container.querySelector('[data-whiteboard-module="lesson"]');
      expect(card?.getAttribute("data-whiteboard-module-anchor")).toBe("board-fixed-size");
      expect(card?.getAttribute("style")).toContain("left: 40px");
      expect(card?.getAttribute("style")).toContain("top: -20px");
      expect(card?.getAttribute("style")).toContain("width: 560px");
      expect(card?.getAttribute("style")).toContain("height: 420px");
    });
  });

  it("keeps a module set to Pin to board at scene coordinates while camera pan and zoom only change render transform", async () => {
    const { container } = renderLab();

    await waitFor(() => expect(mocks.whiteboardCanvasProps).toBeTruthy());
    act(() => {
      (
        mocks.whiteboardCanvasProps?.onViewportChange as (transform: {
          scrollX: number;
          scrollY: number;
          zoom: number;
          viewportWidth: number;
          viewportHeight: number;
          offsetLeft: number;
          offsetTop: number;
        }) => void
      )({
        scrollX: 100,
        scrollY: -80,
        zoom: 2,
        viewportWidth: 1200,
        viewportHeight: 800,
        offsetLeft: 0,
        offsetTop: 0,
      });
    });

    fireEvent.click(screen.getByTestId("whiteboard-module-drawer-toggle"));
    fireEvent.click(screen.getByRole("button", { name: /source lesson/i }));

    await waitFor(() => {
      expect(container.querySelector('[data-whiteboard-module="lesson"]')?.getAttribute("data-card-anchor")).toBe(
        "board-fixed-size",
      );
    });

    fireEvent.click(screen.getByTestId("whiteboard-card-pin-button"));
    fireEvent.click(screen.getByTestId("whiteboard-card-anchor-board"));

    await waitFor(() => {
      const card = container.querySelector('[data-whiteboard-module="lesson"]');
      expect(card?.getAttribute("data-card-anchor")).toBe("board");
      expect(card?.getAttribute("data-card-render-layer")).toBe("board");
      expect(card?.getAttribute("data-card-scene-x")).toBe("-80");
      expect(card?.getAttribute("data-card-scene-y")).toBe("70");
      expect(card?.getAttribute("data-card-scene-width")).toBe("280");
      expect(card?.getAttribute("data-card-scene-height")).toBe("210");
      expect(card?.getAttribute("data-card-render-x")).toBe("40");
      expect(card?.getAttribute("data-card-render-y")).toBe("-20");
      expect(card?.getAttribute("data-card-render-zoom")).toBe("2");
      expect(card?.getAttribute("style")).toContain("transform: translate3d(40px, -20px, 0) scale(2)");
    });

    act(() => {
      (
        mocks.whiteboardCanvasProps?.onViewportChange as (transform: {
          scrollX: number;
          scrollY: number;
          zoom: number;
          viewportWidth: number;
          viewportHeight: number;
          offsetLeft: number;
          offsetTop: number;
        }) => void
      )({
        scrollX: 300,
        scrollY: -120,
        zoom: 0.5,
        viewportWidth: 1200,
        viewportHeight: 800,
        offsetLeft: 0,
        offsetTop: 0,
      });
    });

    await waitFor(() => {
      const card = container.querySelector('[data-whiteboard-module="lesson"]');
      expect(card?.getAttribute("data-card-anchor")).toBe("board");
      expect(card?.getAttribute("data-card-render-layer")).toBe("board");
      expect(card?.getAttribute("data-card-scene-x")).toBe("-80");
      expect(card?.getAttribute("data-card-scene-y")).toBe("70");
      expect(card?.getAttribute("data-card-scene-width")).toBe("280");
      expect(card?.getAttribute("data-card-scene-height")).toBe("210");
      expect(card?.getAttribute("data-card-render-x")).toBe("110");
      expect(card?.getAttribute("data-card-render-y")).toBe("-25");
      expect(card?.getAttribute("data-card-render-zoom")).toBe("0.5");
      expect(card?.getAttribute("style")).toContain("transform: translate3d(110px, -25px, 0) scale(0.5)");
    });
  });

  it("adds viewport modules near the current screen center without camera scaling", async () => {
    const { container } = renderLab();

    await waitFor(() => expect(mocks.whiteboardCanvasProps).toBeTruthy());
    act(() => {
      (
        mocks.whiteboardCanvasProps?.onViewportChange as (transform: {
          scrollX: number;
          scrollY: number;
          zoom: number;
          viewportWidth: number;
          viewportHeight: number;
          offsetLeft: number;
          offsetTop: number;
        }) => void
      )({
        scrollX: 100,
        scrollY: -80,
        zoom: 2,
        viewportWidth: 1200,
        viewportHeight: 800,
        offsetLeft: 0,
        offsetTop: 0,
      });
    });

    fireEvent.click(screen.getByTestId("whiteboard-module-drawer-toggle"));
    fireEvent.click(screen.getByRole("button", { name: /desmos graph/i }));

    await waitFor(() => {
      const card = container.querySelector('[data-whiteboard-module="desmos-graph"]');
      expect(card?.getAttribute("data-whiteboard-module-anchor")).toBe("viewport");
      expect(card?.getAttribute("style")).toContain("left: 240px");
      expect(card?.getAttribute("style")).toContain("top: 120px");
      expect(card?.getAttribute("style")).toContain("width: 720px");
      expect(card?.getAttribute("style")).toContain("height: 560px");
    });
  });

  it("minimizes the modules drawer back into the toolbox chip", () => {
    renderLab();

    fireEvent.click(screen.getByTestId("whiteboard-module-drawer-toggle"));
    expect(screen.getByTestId("whiteboard-module-drawer")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Minimize modules toolbox"));

    expect(screen.queryByTestId("whiteboard-module-drawer")).toBeNull();
    expect(screen.getByTestId("whiteboard-module-drawer-toggle")).toBeTruthy();
  });
});
