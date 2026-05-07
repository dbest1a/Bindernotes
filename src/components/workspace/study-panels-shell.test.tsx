// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
      "lesson-outline": module("Lesson outline", "Outline body"),
      search: module("Search", "Search body"),
      "desmos-graph": module("Desmos graph", "Graph body"),
      "formula-sheet": module("Formula sheet", "Formula body"),
      "scientific-calculator": module("Scientific calculator", "Calculator body"),
      "saved-graphs": module("Saved graphs", "Saved graphs body"),
      whiteboard: module("Whiteboard", "Whiteboard body"),
      "history-timeline": module("Timeline", "Timeline body"),
      "history-evidence": module("Evidence", "Evidence body"),
      "history-argument": module("Argument", "Argument body"),
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
  preferenceOverrides: Partial<WorkspacePreferences> = {},
  contextOverrides: Partial<WorkspaceModuleContext> = {},
) {
  const base = createDefaultWorkspacePreferences("user-1", "binder-1");
  const preferences: WorkspacePreferences = {
    ...applyWorkspaceMode(applyPreset(base, "split-study"), "modular"),
    enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet", "recent-highlights"],
    styleChoiceCompleted: true,
    ...preferenceOverrides,
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
    noteSaveLabel: "Saved to account",
    onApplyPreset: vi.fn(),
    onEnterNotebookFocus: vi.fn(),
    onSaveNoteNow: vi.fn(),
    onSelectLesson: vi.fn(),
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
});
