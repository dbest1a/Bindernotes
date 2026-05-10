// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FaceliftSimpleShell } from "@/components/workspace/facelift-simple-shell";
import { createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { WorkspacePreferences } from "@/types";

vi.mock("@/components/workspace/workspace-modules", () => ({
  workspaceModuleRegistry: {
    lesson: {
      title: "Source lesson",
      render: () => <section>Lesson body</section>,
    },
    "private-notes": {
      title: "Private notes",
      render: () => <section>Notes body</section>,
    },
    "desmos-graph": {
      title: "Desmos graph",
      render: () => <section>Graph body</section>,
    },
    "math-blocks": {
      title: "Math blocks",
      render: () => <section>Math blocks body</section>,
    },
    "formula-sheet": {
      title: "Formula sheet",
      render: () => <section>Formula body</section>,
    },
    whiteboard: {
      title: "Whiteboard",
      render: (context: { onExitWhiteboardFocus?: () => void }) => (
        <section>
          Whiteboard body
          {context.onExitWhiteboardFocus ? (
            <button onClick={context.onExitWhiteboardFocus} type="button">
              Back to workspace
            </button>
          ) : null}
        </section>
      ),
    },
    "history-timeline": {
      title: "Timeline",
      render: () => <section>Timeline body</section>,
    },
    "history-evidence": {
      title: "Evidence",
      render: () => <section>Evidence body</section>,
    },
    "history-argument": {
      title: "Argument",
      render: () => <section>Argument body</section>,
    },
  },
}));

afterEach(() => {
  cleanup();
});

function renderFaceliftSimpleShell(
  overrides: Partial<WorkspacePreferences> = {},
  options: { focusModeActive?: boolean; isCompact?: boolean; studentCalmMode?: boolean } = {},
) {
  const preferences: WorkspacePreferences = {
    ...createDefaultWorkspacePreferences("user-1", "binder-1"),
    workspacePresentationMode: "facelift",
    preset: "math-guided-study",
    enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet"],
    facelift: {
      ...createDefaultWorkspacePreferences("user-1", "binder-1").facelift,
      density: "compact",
      surfaceMode: "simple",
    },
    ...overrides,
  };
  const context = {
    binder: {
      id: "binder-1",
      title: "Jacob Math Notes",
      subject: "Mathematics",
    },
    selectedLesson: {
      id: "lesson-1",
      title: "Circles, Radians, and Laws of Sines and Cosines",
    },
    lessons: [
      {
        id: "lesson-1",
        title: "Circles, Radians, and Laws of Sines and Cosines",
      },
    ],
    library: {
      binders: [],
      folders: [],
      folderBinders: [],
    },
    history: {
      enabled: false,
    },
    onApplyPreset: vi.fn(),
    onEnterNotebookFocus: vi.fn(),
    onSaveNoteNow: vi.fn(),
    onSelectLesson: vi.fn(),
  } as unknown as WorkspaceModuleContext;
  const callbacks = {
    onChange: vi.fn(),
    onChangeView: vi.fn(),
    onCreateSticky: vi.fn(),
    onChangeWorkspaceViewMode: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleFocus: vi.fn(),
  };

  const result = render(
    <MemoryRouter>
      <FaceliftSimpleShell
        context={context}
        focusModeActive={options.focusModeActive ?? false}
        isCompact={options.isCompact}
        onChange={callbacks.onChange}
        onChangeWorkspaceViewMode={callbacks.onChangeWorkspaceViewMode}
        onChangeView={callbacks.onChangeView}
        onCreateSticky={callbacks.onCreateSticky}
        onOpenSettings={callbacks.onOpenSettings}
        onToggleFocus={callbacks.onToggleFocus}
        preferences={preferences}
        studentCalmMode={options.studentCalmMode}
        workspaceViewMode="facelift"
      />
    </MemoryRouter>,
  );

  return { callbacks, context, container: result.container };
}

describe("FaceliftSimpleShell", () => {
  it("marks Math Graph Lab focus as a two-pane layout so the graph can use empty space", () => {
    renderFaceliftSimpleShell({
      preset: "math-graph-lab",
      enabledModules: ["desmos-graph", "formula-sheet", "private-notes"],
      facelift: {
        ...createDefaultWorkspacePreferences("user-1", "binder-1").facelift,
        density: "focus",
        surfaceMode: "simple",
      },
    });

    expect(screen.getByTestId("facelift-module-grid").getAttribute("data-facelift-graph-lab-layout")).toBe(
      "two-pane",
    );
  });

  it("keeps consumer actions obvious while moving advanced controls into disclosures", () => {
    const { callbacks, context } = renderFaceliftSimpleShell();

    expect(screen.getByRole("button", { name: /study mode math guided study/i })).toBeTruthy();
    expect(screen.getByText(/lesson, formula, graph, then notes/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^read$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^notes$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^graph$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /enter focus/i })).toBeTruthy();
    expect(screen.getByText(/saved status/i)).toBeTruthy();

    expect(screen.queryByRole("button", { name: /change view/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /new sticky/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /notebook focus/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^read$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^graph$/i }));
    fireEvent.click(screen.getByRole("button", { name: /study mode math guided study/i }));
    fireEvent.click(screen.getByRole("button", { name: /focused reading/i }));
    fireEvent.click(screen.getByRole("button", { name: /tools/i }));
    fireEvent.click(screen.getByRole("button", { name: /new sticky/i }));
    fireEvent.click(screen.getByRole("button", { name: /notebook focus/i }));
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    fireEvent.click(screen.getByRole("button", { name: /change view/i }));
    expect(screen.getByRole("button", { name: /settings/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /enter focus/i }));

    expect(context.onApplyPreset).toHaveBeenCalledWith("focused-reading");
    expect(context.onApplyPreset).toHaveBeenCalledWith("math-graph-lab");
    expect(context.onEnterNotebookFocus).toHaveBeenCalledTimes(1);
    expect(callbacks.onToggleFocus).toHaveBeenCalledTimes(1);
    expect(callbacks.onChangeView).toHaveBeenCalledTimes(1);
    expect(callbacks.onCreateSticky).toHaveBeenCalledTimes(1);
  });

  it("shows a guided command center with next-step and workspace context", () => {
    renderFaceliftSimpleShell();

    expect(screen.getByText(/next best step/i)).toBeTruthy();
    expect(screen.getByText(/follow the explanation/i)).toBeTruthy();
    expect(screen.getByText(/primary/i)).toBeTruthy();
    expect(screen.getAllByText(/source lesson/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 panels live/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/compact view/i)).toBeTruthy();
  });

  it("uses mobile module tabs and mounts only the active study surface on compact screens", () => {
    renderFaceliftSimpleShell(
      {
        preset: "math-practice-mode",
        enabledModules: ["whiteboard", "math-blocks", "private-notes", "formula-sheet"],
        facelift: {
          ...createDefaultWorkspacePreferences("user-1", "binder-1").facelift,
          density: "comfortable",
          surfaceMode: "simple",
        },
      },
      { isCompact: true },
    );

    const mobileNav = screen.getByRole("navigation", { name: /mobile study modules/i });
    expect(mobileNav).toBeTruthy();
    expect(screen.getByText("Whiteboard body")).toBeTruthy();
    expect(screen.queryByText("Notes body")).toBeNull();

    fireEvent.click(within(mobileNav).getByRole("button", { name: "Notes" }));

    expect(screen.queryByText("Whiteboard body")).toBeNull();
    expect(screen.getByText("Notes body")).toBeTruthy();
  });

  it("uses history mobile tabs instead of squeezing the desktop studio on phone-sized surfaces", () => {
    renderFaceliftSimpleShell(
      {
        preset: "history-full-studio",
        enabledModules: [
          "lesson",
          "history-timeline",
          "history-evidence",
          "history-argument",
          "private-notes",
        ],
        facelift: {
          ...createDefaultWorkspacePreferences("user-1", "binder-1").facelift,
          density: "comfortable",
          surfaceMode: "simple",
        },
      },
      { isCompact: true },
    );

    const mobileNav = screen.getByRole("navigation", { name: /mobile study modules/i });
    expect(within(mobileNav).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Lesson",
      "Timeline",
      "Evidence",
      "Argument",
      "Notes",
    ]);
    expect(screen.getByText("Lesson body")).toBeTruthy();
    expect(screen.queryByText("Timeline body")).toBeNull();
    expect(screen.queryByText("Evidence body")).toBeNull();
    expect(screen.queryByText("Argument body")).toBeNull();
    expect(screen.queryByText("Notes body")).toBeNull();

    fireEvent.click(within(mobileNav).getByRole("button", { name: "Argument" }));

    expect(screen.queryByText("Lesson body")).toBeNull();
    expect(screen.getByText("Argument body")).toBeTruthy();
  });

  it("turns Study Panels tools into real tool-surface launchers", () => {
    const { context } = renderFaceliftSimpleShell({
      preset: "math-guided-study",
      enabledModules: ["lesson", "private-notes", "desmos-graph", "math-blocks", "formula-sheet", "whiteboard"],
    });

    fireEvent.click(screen.getByRole("button", { name: /tools/i }));

    const toolsMenu = screen.getByRole("menu", { name: /study tools/i });
    expect(within(toolsMenu).getByText(/open tool surfaces/i)).toBeTruthy();
    expect(within(toolsMenu).getByRole("button", { name: /whiteboard/i })).toBeTruthy();

    fireEvent.click(within(toolsMenu).getByRole("button", { name: /whiteboard/i }));

    expect(context.onApplyPreset).toHaveBeenCalledWith("math-practice-mode");
  });

  it("passes a focus-exit callback to whiteboard modules in focused facelift mode", () => {
    const { callbacks } = renderFaceliftSimpleShell(
      {
        preset: "math-practice-mode",
        enabledModules: ["whiteboard", "math-blocks", "private-notes", "formula-sheet"],
      },
      { focusModeActive: true },
    );

    fireEvent.click(screen.getByRole("button", { name: /back to workspace/i }));

    expect(callbacks.onToggleFocus).toHaveBeenCalledTimes(1);
  });

  it("prioritizes the whiteboard when Math Practice Mode makes Board the primary surface", () => {
    const { container } = renderFaceliftSimpleShell({
      preset: "math-practice-mode",
      enabledModules: ["whiteboard", "math-blocks", "private-notes", "formula-sheet"],
    });

    const grid = screen.getByTestId("facelift-module-grid");
    const whiteboardCell = container.querySelector('[data-facelift-module="whiteboard"]');
    const mathBlocksCell = container.querySelector('[data-facelift-module="math-blocks"]');

    expect(grid.getAttribute("data-facelift-board-primary-layout")).toBe("dominant");
    expect(whiteboardCell?.className).toContain("facelift-module-cell--primary");
    expect(mathBlocksCell?.className).not.toContain("facelift-module-cell--primary");
  });

  it("marks Student Calm Mode and offers a Back to Simple escape hatch", () => {
    const { callbacks, container } = renderFaceliftSimpleShell({}, { studentCalmMode: true });

    expect(container.querySelector(".facelift-simple-shell")?.getAttribute("data-student-calm-mode")).toBe("true");
    expect(screen.getByRole("button", { name: /Back to Simple/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Back to Simple/i }));

    expect(callbacks.onChangeWorkspaceViewMode).toHaveBeenCalledWith("simple");
  });
});
