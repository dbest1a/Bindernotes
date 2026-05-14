// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyPanelsShell } from "@/components/workspace/study-panels-shell";
import {
  applyPreset,
  applyWorkspaceMode,
  createDefaultWorkspacePreferences,
} from "@/lib/workspace-preferences";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { WorkspacePreferences } from "@/types";

vi.mock("@/components/workspace/workspace-modules", () => {
  const module = (title: string, body: string) => ({
    title,
    render: () => <section>{body}</section>,
  });

  return {
    workspaceModuleRegistry: {
      lesson: module("Source lesson", "Lesson body"),
      "private-notes": module("Private notes", "Notes body"),
      "recent-highlights": module("Highlights", "Highlights body"),
      comments: module("Sticky notes", "Sticky notes body"),
      flashcards: module("Recall Lab", "Recall Lab body"),
      "lesson-outline": module("Lesson outline", "Outline body"),
      search: module("Search", "Search body"),
      "desmos-graph": {
        title: "Desmos graph",
        render: (context: { graphKeypad?: boolean }) => (
          <section data-graph-keypad={context.graphKeypad === false ? "hidden" : "visible"} data-testid="desmos-graph-module">
            Graph body
            {context.graphKeypad === false ? null : <span>Full graph keypad</span>}
          </section>
        ),
      },
      "formula-sheet": module("Formula sheet", "Formula body"),
      "scientific-calculator": module("Scientific calculator", "Calculator body"),
      "saved-graphs": module("Saved graphs", "Saved graphs body"),
      whiteboard: {
        title: "Whiteboard",
        render: (context: { onExitWhiteboardFocus?: () => void; whiteboardSidebarDefaultCollapsed?: boolean }) => (
          <section
            data-testid="whiteboard-module"
            data-whiteboard-default-sidebar={context.whiteboardSidebarDefaultCollapsed ? "rail" : "expanded"}
          >
            Whiteboard body
            {context.onExitWhiteboardFocus ? (
              <button onClick={context.onExitWhiteboardFocus} type="button">
                Back to workspace
              </button>
            ) : null}
          </section>
        ),
      },
      "history-timeline": module("Timeline", "Timeline body"),
      "history-evidence": module("Evidence", "Evidence body"),
      "history-argument": module("Argument", "Argument body"),
      "history-myth-checks": module("Myth checks", "Myth checks body"),
      "chem-concept-cards": module("Chemistry concept cards", "Concept cards body"),
      "chem-lab-coach": module("Chemistry Lab Coach", "Lab Coach body"),
      "chem-quick-tools": module("Chemistry quick tools", "Quick tools body"),
      "chem-periodic-table": module("Interactive periodic table", "Periodic table body"),
      "chem-element-builder": module("Element builder", "Element builder body"),
      "chem-electron-config-builder": module("Electron configuration builder", "Electron config body"),
      "chem-periodic-trends-graph": module("Periodic trends graph", "Trends graph body"),
      "chem-molecule-builder": module("Molecule / Lewis builder", "Molecule builder body"),
      "chem-geometry-viewer": module("Geometry viewer", "Geometry body"),
      "chem-reaction-balancer": module("Reaction balancer", "Reaction balancer body"),
      "chem-tri-reaction-view": module("Tri-representation reaction view", "Reaction view body"),
      "chem-stoichiometry-coach": module("Chemistry Stoichiometry Coach", "Stoichiometry body"),
      "chem-molar-mass-calculator": module("Molar mass calculator", "Molar mass body"),
      "chem-solution-mixer": module("Solution mixer", "Solution mixer body"),
      "chem-molarity-calculator": module("Molarity calculator", "Molarity body"),
      "chem-desmos-concentration-graph": module("Desmos concentration graph", "Concentration graph body"),
      "chem-ph-calculator": module("pH calculator", "pH calculator body"),
      "chem-titration-lab": module("Acid-base titration lab", "Titration lab body"),
      "chem-desmos-titration-curve": module("Desmos titration curve", "Titration curve body"),
      "chem-kinetics-simulator": module("Kinetics simulator", "Kinetics body"),
      "chem-desmos-kinetics-plot": module("Desmos kinetics plot", "Kinetics graph body"),
      "chem-data-table": module("Chemistry data table", "Data table body"),
      "chem-calorimetry-lab": module("Calorimetry lab", "Calorimetry body"),
      "chem-energy-diagram": module("Energy diagram", "Energy diagram body"),
      "chem-calculation-sheet": module("Calculation sheet", "Calculation body"),
      "chem-safety-cards": module("Safety cards", "Safety body"),
      "chem-review-queue": module("Chemistry review queue", "Review queue body"),
      "chem-lab-notebook": module("Chemistry lab notebook", "Lab notebook body"),
      "chem-reference-safety": module("Chemistry reference", "Reference body"),
    },
  };
});

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
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
  vi.unstubAllGlobals();
});

function renderStudyPanelsShell(
  preferenceOverrides: Partial<Omit<WorkspacePreferences, "modular">> & {
    modular?: Partial<WorkspacePreferences["modular"]>;
  } = {},
  contextOverrides: Partial<WorkspaceModuleContext> = {},
) {
  const base = createDefaultWorkspacePreferences("user-1", "binder-1");
  const basePreferences: WorkspacePreferences = {
    ...applyWorkspaceMode(applyPreset(base, "split-study"), "modular"),
    enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet", "recent-highlights"],
    styleChoiceCompleted: true,
  };
  const preferences: WorkspacePreferences = {
    ...basePreferences,
    ...preferenceOverrides,
    modular: {
      ...basePreferences.modular,
      ...preferenceOverrides.modular,
    },
  };
  const context = {
    binder: {
      id: "binder-1",
      title: "Jacob Math Notes",
      subject: "Math",
    },
    selectedLesson: {
      id: "lesson-1",
      title: "Vectors and Probability",
    },
    lessons: [{ id: "lesson-1", title: "Vectors and Probability" }],
    library: {
      binders: [],
      folders: [],
      folderBinders: [],
    },
    history: {
      enabled: false,
    },
    ownerId: "user-1",
    noteSaveLabel: "Saved to account",
    onApplyPreset: vi.fn(),
    onEnterNotebookFocus: vi.fn(),
    onCreateQuoteExcerpt: vi.fn(),
    onPrepareComment: vi.fn(),
    onSaveNoteNow: vi.fn(),
    onSelectLesson: vi.fn(),
    onSendSelectionToNotes: vi.fn(),
    ...contextOverrides,
  } as unknown as WorkspaceModuleContext;
  const callbacks = {
    onChangeMode: vi.fn(),
    onCreateSticky: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleFocus: vi.fn(),
  };

  const result = render(
    <StudyPanelsShell
      context={context}
      currentViewMode="modular"
      focusModeActive={false}
      isCompact={false}
      onChangeMode={callbacks.onChangeMode}
      onCreateSticky={callbacks.onCreateSticky}
      onOpenSettings={callbacks.onOpenSettings}
      onToggleFocus={callbacks.onToggleFocus}
      preferences={preferences}
    />,
  );

  return { callbacks, context, preferences, ...result };
}

describe("StudyPanelsShell", () => {
  it("renders as first-class panes instead of a freeform canvas", () => {
    const { container } = renderStudyPanelsShell();

    expect(screen.getByTestId("study-panels-shell")).toBeTruthy();
    expect(screen.getByTestId("study-panels-shell").getAttribute("data-secondary-preset-strip")).toBe("hidden");
    expect(screen.queryByLabelText(/study panel presets/i)).toBeNull();
    expect(container.querySelector(".workspace-canvas-shell")).toBeNull();
    expect(screen.getByText("Lesson body")).toBeTruthy();
    expect(screen.getByText("Notes body")).toBeTruthy();
    expect(screen.getByRole("tablist", { name: /study panel modules/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /workspace mode study panels/i })).toBeTruthy();
  });

  it("keeps math tools available without mounting them until the student selects them", () => {
    const { container } = renderStudyPanelsShell();

    expect(screen.queryByText("Graph body")).toBeNull();
    expect(screen.queryByText("Formula body")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /graph/i }));

    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "desmos-graph",
    );
    expect(screen.getByText("Graph body")).toBeTruthy();
    expect(screen.getByText("Formula body")).toBeTruthy();
  });

  it("uses keyboard-accessible panel tabs", () => {
    const { container } = renderStudyPanelsShell();
    const tablist = screen.getByRole("tablist", { name: /study panel modules/i });
    const lessonTab = within(tablist).getByRole("tab", { name: /lesson/i });
    const notesTab = within(tablist).getByRole("tab", { name: /notes/i });

    expect(lessonTab.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(lessonTab, { key: "ArrowRight" });

    expect(notesTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Notes body")).toBeTruthy();
  });

  it("exposes history tabs only when history study context is active", () => {
    renderStudyPanelsShell(
      {
        preset: "history-source-evidence",
        enabledModules: ["lesson", "private-notes", "history-timeline", "history-evidence", "history-argument"],
      },
      {
        binder: {
          id: "binder-1",
          title: "World History",
          subject: "History",
        } as WorkspaceModuleContext["binder"],
        history: {
          enabled: true,
        } as WorkspaceModuleContext["history"],
      },
    );

    expect(screen.getByRole("tab", { name: /timeline/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /evidence/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /argument/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /evidence/i }));

    expect(screen.getByText("Evidence body")).toBeTruthy();
  });

  it("opens tools as a drawer instead of showing every heavy module by default", () => {
    const { container } = renderStudyPanelsShell();

    expect(screen.queryByLabelText(/study tools/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /tools/i }));

    expect(screen.getByLabelText(/study tools/i)).toBeTruthy();
    expect(screen.getByText("Highlights body")).toBeTruthy();
    expect(screen.queryByText("Calculator body")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /scientific calculator/i }));

    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-drawer-tool")).toBe(
      "scientific-calculator",
    );
    expect(screen.getByText("Calculator body")).toBeTruthy();
  });

  it("opens the study tools drawer from the Tools tab as well as the header button", () => {
    const { container } = renderStudyPanelsShell();

    fireEvent.click(screen.getByRole("tab", { name: /extras|tools/i }));

    expect(screen.getByLabelText(/study tools/i)).toBeTruthy();
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-drawer-tool")).toBeTruthy();
  });

  it("routes every top Study Panels mode to a visible surface instead of a decorative active state", () => {
    const { container } = renderStudyPanelsShell();

    fireEvent.click(screen.getByRole("tab", { name: /notes/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "private-notes",
    );
    expect(screen.getByText("Notes body")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /highlights/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "recent-highlights",
    );
    expect(screen.getByText("Highlights body")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /extras|tools/i }));
    expect(screen.getByLabelText(/study tools/i)).toBeTruthy();
    expect(screen.getByTestId("study-tool-preview-private-notes")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /lesson/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe("lesson");
    expect(screen.getByText("Lesson body")).toBeTruthy();
  });

  it("renders subject-aware math tool preview cards and opens only the selected tool", () => {
    const { container } = renderStudyPanelsShell();

    fireEvent.click(screen.getByRole("tab", { name: /tools/i }));

    const desmosCard = screen.getByTestId("study-tool-preview-desmos-graph");
    expect(desmosCard.textContent).toContain("Graph equations and compare functions.");
    expect(screen.getByTestId("study-tool-preview-formula-sheet")).toBeTruthy();
    expect(screen.getByTestId("study-tool-preview-scientific-calculator")).toBeTruthy();
    expect(screen.queryByText("Graph body")).toBeNull();

    fireEvent.click(within(desmosCard).getByRole("button", { name: /open desmos graph/i }));

    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-drawer-tool")).toBe(
      "desmos-graph",
    );
    expect(screen.getByText("Graph body")).toBeTruthy();
  });

  it("uses history context to show history preview cards with real launch actions", () => {
    const { container } = renderStudyPanelsShell(
      {
        preset: "history-source-evidence",
        enabledModules: ["lesson", "private-notes", "history-timeline", "history-evidence", "history-argument"],
      },
      {
        binder: {
          id: "binder-1",
          title: "World History",
          subject: "History",
        } as WorkspaceModuleContext["binder"],
        history: {
          enabled: true,
        } as WorkspaceModuleContext["history"],
      },
    );

    fireEvent.click(screen.getByRole("tab", { name: /tools/i }));

    const timelineCard = screen.getByTestId("study-tool-preview-history-timeline");
    expect(timelineCard.textContent).toContain("Place events in order and connect cause/effect.");
    expect(screen.getByTestId("study-tool-preview-history-evidence")).toBeTruthy();
    expect(screen.getByTestId("study-tool-preview-history-argument")).toBeTruthy();

    fireEvent.click(within(timelineCard).getByRole("button", { name: /open timeline/i }));

    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-drawer-tool")).toBe(
      "history-timeline",
    );
    expect(screen.getByText("Timeline body")).toBeTruthy();
  });

  it("keeps unfinished chemistry preview tools behind Beta Features while leaving stable tools available", () => {
    renderStudyPanelsShell(
      {
        ...applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "chem-guided-study"),
        enabledModules: [
          "lesson",
          "private-notes",
          "chem-quick-tools",
          "chem-lab-coach",
          "chem-periodic-table",
          "chem-titration-lab",
          "chem-reference-safety",
        ],
      },
      {
        binder: {
          id: "binder-1",
          title: "Chemistry binder",
          subject: "Chemistry",
        } as WorkspaceModuleContext["binder"],
      },
    );

    fireEvent.click(
      within(screen.getByRole("tablist", { name: /study panel modules/i })).getByRole("tab", {
        name: /^ToolsExtra$/i,
      }),
    );

    expect(screen.getByTestId("study-tool-preview-chem-reference-safety")).toBeTruthy();
    expect(screen.queryByTestId("study-tool-preview-chem-lab-coach")).toBeNull();
    expect(screen.queryByTestId("study-tool-preview-chem-periodic-table")).toBeNull();
    expect(screen.queryByTestId("study-tool-preview-chem-titration-lab")).toBeNull();
  });

  it("shows beta chemistry tool previews with beta badges when Beta Features is enabled", () => {
    window.localStorage.setItem("bindernotes:beta-features:user-1", JSON.stringify({ enabled: true }));

    renderStudyPanelsShell(
      {
        ...applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "chem-guided-study"),
        enabledModules: [
          "lesson",
          "private-notes",
          "chem-quick-tools",
          "chem-lab-coach",
          "chem-periodic-table",
          "chem-titration-lab",
          "chem-reference-safety",
        ],
      },
      {
        binder: {
          id: "binder-1",
          title: "Chemistry binder",
          subject: "Chemistry",
        } as WorkspaceModuleContext["binder"],
      },
    );

    fireEvent.click(
      within(screen.getByRole("tablist", { name: /study panel modules/i })).getByRole("tab", {
        name: /^Extras$/i,
      }),
    );

    const labCoachCard = screen.getByTestId("study-tool-preview-chem-lab-coach");
    expect(labCoachCard.textContent).toContain("Chemistry Lab Coach");
    expect(labCoachCard.textContent).toContain("Beta");
    fireEvent.click(within(labCoachCard).getByRole("button", { name: /open chemistry lab coach/i }));
    expect(screen.getByText("Lab Coach body")).toBeTruthy();

    const elementCard = screen.getByTestId("study-tool-preview-chem-periodic-table");
    expect(elementCard.textContent).toContain("Element Explorer");
    expect(elementCard.textContent).toContain("Beta");
    expect(screen.getByTestId("study-tool-preview-chem-titration-lab").textContent).toContain("Titration Lab");
  });

  it("keeps Recall Lab hidden until its beta flag is enabled", () => {
    renderStudyPanelsShell();

    fireEvent.click(screen.getByRole("tab", { name: /extras|tools/i }));

    expect(screen.queryByTestId("study-tool-preview-flashcards")).toBeNull();
  });

  it("shows Recall Lab preview and opens the real module when its beta flag is enabled", () => {
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, recallLab: true }),
    );
    const { container } = renderStudyPanelsShell({
      enabledModules: ["lesson", "private-notes", "flashcards", "recent-highlights"],
    });

    fireEvent.click(screen.getByRole("tab", { name: /extras|tools/i }));

    const recallCard = screen.getByTestId("study-tool-preview-flashcards");
    expect(recallCard.textContent).toContain("Recall Lab");
    expect(recallCard.textContent).toContain("source-linked recall cards");

    fireEvent.click(within(recallCard).getByRole("button", { name: /open recall lab/i }));

    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-drawer-tool")).toBe(
      "flashcards",
    );
    expect(screen.getByText("Recall Lab body")).toBeTruthy();
  });

  it("uses Chem Guided Study and Element Explorer chips to focus real beta chemistry surfaces", () => {
    window.localStorage.setItem("bindernotes:beta-features:user-1", JSON.stringify({ enabled: true }));
    const { container, context } = renderStudyPanelsShell(
      {
        preset: "split-study",
        enabledModules: [
          "lesson",
          "private-notes",
          "chem-lab-coach",
          "chem-quick-tools",
          "chem-periodic-table",
          "chem-element-builder",
          "chem-periodic-trends-graph",
        ],
        modular: {
          showSecondaryPresetStrip: true,
        },
      },
      {
        binder: {
          id: "binder-1",
          title: "Chemistry binder",
          subject: "Chemistry",
        } as WorkspaceModuleContext["binder"],
      },
    );

    fireEvent.click(screen.getByRole("button", { name: /chem guided study/i }));

    expect(context.onApplyPreset).toHaveBeenCalledWith("chem-guided-study");
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "chem-lab-coach",
    );
    expect(screen.getByText("Lab Coach body")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /element explorer/i }));

    expect(context.onApplyPreset).toHaveBeenCalledWith("chem-element-explorer");
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "chem-periodic-table",
    );
    expect(screen.getByText("Periodic table body")).toBeTruthy();
  });

  it("shows guided Split Study actions that call existing note and sticky handlers", () => {
    const { context } = renderStudyPanelsShell({
      preset: "split-study",
    });

    expect(screen.getByRole("region", { name: /guided split study actions/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /quote to note/i }));
    expect(context.onCreateQuoteExcerpt).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /pin question/i }));
    expect(context.onPrepareComment).toHaveBeenCalledWith("Question to revisit");

    fireEvent.click(screen.getByRole("button", { name: /send highlight to notes/i }));
    expect(context.onSendSelectionToNotes).toHaveBeenCalled();
  });

  it("re-centers the active surface when the current Study Panels preset chip is clicked", () => {
    const { container } = renderStudyPanelsShell({
      modular: {
        showSecondaryPresetStrip: true,
      },
    });

    fireEvent.click(screen.getByRole("tab", { name: /notes/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "private-notes",
    );

    fireEvent.click(screen.getByRole("button", { name: /^split study$/i }));

    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe("lesson");
    expect(screen.getByRole("status").textContent).toContain("Split Study is already active");
  });

  it("shows the secondary preset strip only when the workspace preference is enabled", () => {
    const { unmount } = renderStudyPanelsShell();

    expect(screen.queryByLabelText(/study panel presets/i)).toBeNull();
    unmount();

    renderStudyPanelsShell({
      modular: {
        showSecondaryPresetStrip: true,
      },
    });

    const presetStrip = screen.getByLabelText(/study panel presets/i);
    expect(presetStrip).toBeTruthy();
    expect(within(presetStrip).getByRole("button", { name: /^split study$/i })).toBeTruthy();
    expect(screen.getByTestId("study-panels-shell").getAttribute("data-secondary-preset-strip")).toBe("visible");
  });

  it("turns focus mode into a fullscreen board-and-notes workspace without the top chrome", () => {
    const { context, preferences, unmount } = renderStudyPanelsShell({
      preset: "math-practice-mode",
      enabledModules: ["lesson", "private-notes", "whiteboard", "desmos-graph", "formula-sheet"],
    });
    unmount();

    render(
      <StudyPanelsShell
        context={context}
        currentViewMode="modular"
        focusModeActive
        isCompact={false}
        onChangeMode={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleFocus={vi.fn()}
        preferences={preferences}
      />,
    );

    expect(screen.getByTestId("study-panels-shell").getAttribute("data-focus-mode-active")).toBe("true");
    expect(screen.getByTestId("study-panels-shell").getAttribute("data-study-panels-tab-strip")).toBe("hidden");
    expect(document.querySelector(".study-panels-shell__top")).toBeNull();
    expect(screen.queryByRole("tablist", { name: /study panel modules/i })).toBeNull();
    expect(screen.getByRole("toolbar", { name: /fullscreen study controls/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /exit full screen/i })).toBeTruthy();
    expect(screen.getByText("Whiteboard body")).toBeTruthy();
    expect(screen.getByText("Notes body")).toBeTruthy();
    expect(document.querySelector(".study-panels-split")).toBeTruthy();
    expect(document.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "whiteboard",
    );
    expect(document.querySelector(".study-panels-shell__body")?.getAttribute("data-study-secondary")).toBe(
      "private-notes",
    );
  });

  it("keeps lesson and private notes paired in fullscreen split study", () => {
    const { context, preferences, unmount } = renderStudyPanelsShell({
      preset: "split-study",
      enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet"],
    });
    unmount();

    render(
      <StudyPanelsShell
        context={context}
        currentViewMode="modular"
        focusModeActive
        isCompact={false}
        onChangeMode={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleFocus={vi.fn()}
        preferences={preferences}
      />,
    );

    expect(screen.getByTestId("study-panels-shell").getAttribute("data-focus-mode-active")).toBe("true");
    expect(screen.getByText("Lesson body")).toBeTruthy();
    expect(screen.getByText("Notes body")).toBeTruthy();
    expect(document.querySelector(".study-panels-split")).toBeTruthy();
    expect(document.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe("lesson");
    expect(document.querySelector(".study-panels-shell__body")?.getAttribute("data-study-secondary")).toBe(
      "private-notes",
    );
  });

  it("exits focus mode when native fullscreen is closed outside the app controls", () => {
    const { context, preferences, unmount } = renderStudyPanelsShell({
      preset: "split-study",
      enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet"],
    });
    unmount();

    const onToggleFocus = vi.fn();
    render(
      <StudyPanelsShell
        context={context}
        currentViewMode="modular"
        focusModeActive
        isCompact={false}
        onChangeMode={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleFocus={onToggleFocus}
        preferences={preferences}
      />,
    );

    const shell = screen.getByTestId("study-panels-shell");
    let fullscreenElement: Element | null = shell;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });

    document.dispatchEvent(new Event("fullscreenchange"));
    expect(onToggleFocus).not.toHaveBeenCalled();

    fullscreenElement = null;
    document.dispatchEvent(new Event("fullscreenchange"));

    expect(onToggleFocus).toHaveBeenCalledTimes(1);
    delete (document as unknown as { fullscreenElement?: Element | null }).fullscreenElement;
  });

  it("gives the focused whiteboard a real back control that exits focus mode", () => {
    const { context, preferences, unmount } = renderStudyPanelsShell({
      preset: "math-practice-mode",
      enabledModules: ["lesson", "private-notes", "whiteboard", "desmos-graph", "formula-sheet"],
    });
    unmount();

    const onToggleFocus = vi.fn();
    render(
      <StudyPanelsShell
        context={context}
        currentViewMode="modular"
        focusModeActive
        isCompact={false}
        onChangeMode={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleFocus={onToggleFocus}
        preferences={preferences}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /back to workspace/i }));

    expect(onToggleFocus).toHaveBeenCalledTimes(1);
  });

  it("requests native fullscreen when the full screen panel button is used", () => {
    const originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    const { callbacks } = renderStudyPanelsShell({
      preset: "math-practice-mode",
      enabledModules: ["lesson", "private-notes", "whiteboard", "desmos-graph", "formula-sheet"],
    });

    fireEvent.click(screen.getByRole("button", { name: /full screen panel/i }));

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(callbacks.onToggleFocus).toHaveBeenCalledTimes(1);

    if (originalRequestFullscreen) {
      Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
        configurable: true,
        value: originalRequestFullscreen,
      });
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).requestFullscreen;
    }
  });

  it("changes the visible surface when the selected preset changes", async () => {
    const { callbacks, container, context, preferences, rerender } = renderStudyPanelsShell();

    fireEvent.click(screen.getByRole("tab", { name: /notes/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "private-notes",
    );

    rerender(
      <StudyPanelsShell
        context={context}
        currentViewMode="modular"
        focusModeActive={false}
        isCompact={false}
        onChangeMode={callbacks.onChangeMode}
        onCreateSticky={callbacks.onCreateSticky}
        onOpenSettings={callbacks.onOpenSettings}
        onToggleFocus={callbacks.onToggleFocus}
        preferences={applyPreset(preferences, "math-graph-lab")}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
        "desmos-graph",
      );
    });
  });

  it("gives chemistry presets real chemistry tabs and jumps Element Explorer to the periodic table", async () => {
    const chemistryEnabled = [
      "lesson",
      "private-notes",
      "recent-highlights",
      "chem-concept-cards",
      "chem-quick-tools",
      "chem-periodic-table",
      "chem-element-builder",
      "chem-periodic-trends-graph",
      "chem-electron-config-builder",
    ] as WorkspacePreferences["enabledModules"];
    const { callbacks, container, context, preferences, rerender } = renderStudyPanelsShell(
      {
        ...applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "chem-guided-study"),
        enabledModules: chemistryEnabled,
        workspacePresentationMode: "facelift",
      },
      {
        binder: {
          id: "binder-1",
          title: "Chemistry binder",
          subject: "Chemistry",
        } as WorkspaceModuleContext["binder"],
      },
    );

    expect(screen.getByRole("tab", { name: /concepts/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /quick/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /notes/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "private-notes",
    );

    rerender(
      <StudyPanelsShell
        context={context}
        currentViewMode="modular"
        focusModeActive={false}
        isCompact={false}
        onChangeMode={callbacks.onChangeMode}
        onCreateSticky={callbacks.onCreateSticky}
        onOpenSettings={callbacks.onOpenSettings}
        onToggleFocus={callbacks.onToggleFocus}
        preferences={{
          ...applyPreset(preferences, "chem-element-explorer"),
          enabledModules: chemistryEnabled,
        }}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
        "chem-periodic-table",
      );
    });
    expect(screen.getByRole("tab", { name: /^TableElements$/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^ElementBuild$/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^TrendsGraph$/i })).toBeTruthy();
    expect(screen.getByText("Periodic table body")).toBeTruthy();
  });

  it("keeps classic Study Panels rendering when Study Panels v2 is off", () => {
    const { container } = renderStudyPanelsShell();

    expect(screen.getByTestId("study-panels-shell").getAttribute("data-study-panels-v2")).toBe("false");
    expect(screen.getByRole("tab", { name: /lesson/i }).textContent).toContain("Read");
    expect(container.querySelector("[data-study-panel-secondary-toggle]")).toBeNull();
  });

  it("enables slimmer Study Panels v2 tabs and per-tab secondary controls only when the beta flag is on", () => {
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, studyPanelsV2: true }),
    );
    const { container } = renderStudyPanelsShell();
    const shell = screen.getByTestId("study-panels-shell");

    expect(shell.getAttribute("data-study-panels-v2")).toBe("true");
    expect(shell.getAttribute("data-study-panels-tab-strip")).toBe("visible");
    expect(screen.getByRole("tab", { name: /^lesson$/i })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /lesson read/i })).toBeNull();
    expect(container.querySelector("[data-study-panel-secondary-toggle]")).toBeTruthy();
    expect(container.querySelector("[data-study-panels-action-row='compact']")).toBeTruthy();
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-action-row")).toBe(
      "visible",
    );
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-actions-state")).toBe(
      "expanded",
    );
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-secondary")).toBe(
      "private-notes",
    );

    fireEvent.click(screen.getByRole("button", { name: /hide split actions/i }));

    expect(container.querySelector("[data-study-panels-action-row='compact']")?.getAttribute("data-study-actions-state")).toBe(
      "collapsed",
    );
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-actions-state")).toBe(
      "collapsed",
    );
    expect(container.querySelector(".study-panels-compact-action-row__content")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(window.localStorage.getItem("bindernotes.study-panels.layout.actions:binder-1:lesson-1")).toBe(
      "collapsed",
    );
    expect(screen.getByRole("button", { name: /show split actions/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /show split actions/i }));

    expect(container.querySelector("[data-study-panels-action-row='compact']")?.getAttribute("data-study-actions-state")).toBe(
      "expanded",
    );
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-actions-state")).toBe(
      "expanded",
    );
    expect(window.localStorage.getItem("bindernotes.study-panels.layout.actions:binder-1:lesson-1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /hide secondary panel for lesson/i }));

    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-secondary-panel-hidden")).toBe(
      "true",
    );
    expect(screen.queryByText("Notes body")).toBeNull();
    expect(screen.getByRole("button", { name: /show secondary panel for lesson/i })).toBeTruthy();
  });

  it("uses v2 tab hierarchy so lesson, notes, graph, and board get focused primary surfaces", () => {
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, studyPanelsV2: true }),
    );
    const { container } = renderStudyPanelsShell({
      preset: "math-guided-study",
      enabledModules: ["lesson", "private-notes", "whiteboard", "desmos-graph", "formula-sheet", "recent-highlights"],
    });

    fireEvent.click(screen.getByRole("tab", { name: /^notes$/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "private-notes",
    );
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-secondary")).toBe("lesson");

    fireEvent.click(screen.getByRole("tab", { name: /^graph$/i }));
    expect(screen.getByTestId("desmos-graph-module").getAttribute("data-graph-keypad")).toBe("hidden");
    expect(screen.queryByText("Full graph keypad")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /^board$/i }));
    expect(screen.getByTestId("whiteboard-module").getAttribute("data-whiteboard-default-sidebar")).toBe("rail");
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "whiteboard",
    );
  });

  it("keeps the Board tab available for math Study Panels even when old preferences omitted whiteboard", () => {
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, studyPanelsV2: true }),
    );
    const { container } = renderStudyPanelsShell({
      enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet", "recent-highlights"],
    });

    fireEvent.click(screen.getByRole("tab", { name: /^board$/i }));

    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
      "whiteboard",
    );
    expect(screen.getByTestId("whiteboard-module")).toBeTruthy();
  });

  it("Revamp Beta keeps every Study Panels tab controlled and switchable from Lesson", () => {
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, revampBeta: true }),
    );
    const { container } = renderStudyPanelsShell({
      preset: "math-guided-study",
      enabledModules: ["lesson", "private-notes", "whiteboard", "desmos-graph", "formula-sheet", "recent-highlights"],
    });
    const expectedPrimaryByTab = new Map([
      ["Lesson", "lesson"],
      ["Notes", "private-notes"],
      ["Graph", "desmos-graph"],
      ["Formulas", "formula-sheet"],
      ["Board", "whiteboard"],
      ["Highlights", "recent-highlights"],
      ["Extras", "comments"],
    ]);

    for (const [label, moduleId] of expectedPrimaryByTab) {
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${label}$`, "i") }));
      expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
        moduleId,
      );
      expect(screen.getByRole("tab", { name: new RegExp(`^${label}$`, "i") }).getAttribute("aria-selected")).toBe(
        "true",
      );
    }
  });

  it("Revamp Beta makes history Study Panels tabs deterministic without mounting hidden history modules", () => {
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, revampBeta: true }),
    );
    const { container } = renderStudyPanelsShell(
      {
        preset: "history-guided",
        enabledModules: [
          "lesson",
          "private-notes",
          "recent-highlights",
          "comments",
          "history-timeline",
          "history-evidence",
          "history-argument",
          "history-myth-checks",
        ],
      },
      {
        binder: {
          id: "binder-1",
          title: "Rise of Rome",
          subject: "History",
        } as WorkspaceModuleContext["binder"],
        history: {
          enabled: true,
        } as WorkspaceModuleContext["history"],
      },
    );

    const shell = screen.getByTestId("study-panels-shell");
    expect(shell.getAttribute("data-revamp-beta")).toBe("true");
    expect(shell.getAttribute("data-study-panels-v2")).toBe("true");
    expect(screen.getByText("Lesson body")).toBeTruthy();
    expect(screen.getByText("Notes body")).toBeTruthy();
    expect(screen.queryByText("Timeline body")).toBeNull();
    expect(screen.queryByText("Evidence body")).toBeNull();
    expect(screen.queryByText("Argument body")).toBeNull();

    const expectedPrimaryByTab = new Map([
      ["Lesson Read", "lesson"],
      ["Notes Write", "private-notes"],
      ["Timeline Sequence", "history-timeline"],
      ["Evidence Proof", "history-evidence"],
      ["Argument Claim", "history-argument"],
      ["Highlights Review", "recent-highlights"],
      ["Sticky Notes Extra", "comments"],
    ]);

    for (const [label, moduleId] of expectedPrimaryByTab) {
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${label}$`, "i") }));
      expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-primary")).toBe(
        moduleId,
      );
      expect(screen.getByRole("tab", { name: new RegExp(`^${label}$`, "i") }).getAttribute("aria-selected")).toBe(
        "true",
      );
    }

    fireEvent.click(screen.getByRole("tab", { name: /^timeline sequence$/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-secondary")).toBe(
      "lesson",
    );
    expect(screen.queryByText("Evidence body")).toBeNull();
    expect(screen.queryByText("Argument body")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /^evidence proof$/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-secondary")).toBe(
      "lesson",
    );

    fireEvent.click(screen.getByRole("tab", { name: /^argument claim$/i }));
    expect(container.querySelector(".study-panels-shell__body")?.getAttribute("data-study-secondary")).toBe(
      "history-evidence",
    );
  });

  it("renames the Tools tab, avoids repeated source content, and disables selection actions until text is selected in v2", () => {
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, studyPanelsV2: true }),
    );
    renderStudyPanelsShell();

    expect(screen.getByRole("tab", { name: /extras/i })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /^tools$/i })).toBeNull();
    expect((screen.getByRole("button", { name: /quote to note/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /send highlight to notes/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("tab", { name: /highlights/i }));

    expect(screen.getByText("Highlights body")).toBeTruthy();
    expect(screen.queryByText("Lesson body")).toBeNull();
  });

  it("persists Study Panels v2 split widths separately for each tab", () => {
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, studyPanelsV2: true }),
    );
    window.localStorage.setItem(
      "bindernotes.study-panels.layout:binder-1:lesson-1:lesson",
      JSON.stringify({ primary: 68, secondary: 32 }),
    );
    window.localStorage.setItem(
      "bindernotes.study-panels.layout:binder-1:lesson-1:notes",
      JSON.stringify({ primary: 72, secondary: 28 }),
    );
    const { container } = renderStudyPanelsShell();

    expect(container.querySelector(".study-panels-split")?.getAttribute("data-study-split-layout")).toBe("68/32");

    fireEvent.click(screen.getByRole("tab", { name: /^notes$/i }));

    expect(container.querySelector(".study-panels-split")?.getAttribute("data-study-split-layout")).toBe("72/28");
    expect(container.querySelector(".study-panels-split")?.getAttribute("data-study-split-storage-key")).toContain(
      ":notes",
    );
  });

  it("protects v2 lesson notes and board splits from cramped saved layouts", () => {
    window.localStorage.setItem(
      "bindernotes:beta-features:user-1",
      JSON.stringify({ enabled: true, studyPanelsV2: true }),
    );
    window.localStorage.setItem(
      "bindernotes.study-panels.layout:binder-1:lesson-1:lesson",
      JSON.stringify({ primary: 80, secondary: 20 }),
    );
    window.localStorage.setItem(
      "bindernotes.study-panels.layout:binder-1:lesson-1:board",
      JSON.stringify({ primary: 42, secondary: 58 }),
    );
    const { container } = renderStudyPanelsShell({
      preset: "math-guided-study",
      enabledModules: ["lesson", "private-notes", "whiteboard", "desmos-graph", "formula-sheet", "recent-highlights"],
    });

    const lessonSplit = container.querySelector(".study-panels-split");
    expect(lessonSplit?.getAttribute("data-study-split-layout")).toBe("58/42");
    expect(lessonSplit?.getAttribute("data-study-split-min-secondary")).toBe("32");

    fireEvent.click(screen.getByRole("tab", { name: /^board$/i }));

    const boardSplit = container.querySelector(".study-panels-split");
    expect(boardSplit?.getAttribute("data-study-split-layout")).toBe("76/24");
    expect(boardSplit?.getAttribute("data-study-split-min-primary")).toBe("60");
    expect(boardSplit?.getAttribute("data-study-split-min-secondary")).toBe("20");
    expect(screen.getByTestId("whiteboard-module").getAttribute("data-whiteboard-default-sidebar")).toBe("rail");
  });
});
