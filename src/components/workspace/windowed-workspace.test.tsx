// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WindowedWorkspace } from "@/components/workspace/windowed-workspace";
import { applyWorkspaceMode, createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { Comment, StickyNoteLayout, WorkspacePreferences } from "@/types";

vi.mock("@/components/workspace/workspace-modules", () => ({
  workspaceModuleRegistry: {
    lesson: {
      title: "Lesson",
      render: () => <section>Lesson body</section>,
    },
    "private-notes": {
      title: "Private notes",
      render: () => <section>Notes body</section>,
    },
    "formula-sheet": {
      title: "Formula sheet",
      render: () => <section>Formula body</section>,
    },
    "math-blocks": {
      title: "Math blocks",
      render: () => <section>Math body</section>,
    },
    "desmos-graph": {
      title: "Desmos graph",
      render: () => <section>Graph body</section>,
    },
    whiteboard: {
      title: "Math Whiteboard",
      render: () => <section>Whiteboard body</section>,
    },
  },
}));

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe() {
    this.callback([], this as unknown as ResizeObserver);
  }

  disconnect() {}
}

const comment: Comment = {
  id: "comment-1",
  owner_id: "user-1",
  binder_id: "binder-1",
  lesson_id: "lesson-1",
  anchor_text: "A limit is the value a function approaches.",
  body: "Connect this to epsilon-delta later.",
  parent_id: null,
  resolved_at: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const stickyLayout: StickyNoteLayout = {
  x: 40,
  y: 50,
  w: 250,
  h: 206,
  z: 52,
  color: "amber",
};

describe("WindowedWorkspace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return this.classList?.contains("workspace-canvas-shell") ? 1100 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return this.classList?.contains("workspace-canvas-shell") ? 760 : 0;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("does not auto-fit or re-layout when edit mode measures the canvas", () => {
    const onFitViewport = vi.fn();
    const basePreferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      locked: false,
      enabledModules: ["lesson"],
      windowLayout: {
        lesson: { x: 32, y: 920, w: 620, h: 420, z: 1 },
      },
      theme: {
        ...basePreferences.theme,
        verticalSpace: "infinite" as const,
      },
    };

    render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="setup"
        onCommitFrame={vi.fn()}
        onFitViewport={onFitViewport}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    vi.runOnlyPendingTimers();

    expect(onFitViewport).not.toHaveBeenCalled();
  });

  it("marks Facelift Canvas separately from the classic canvas shell", () => {
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      workspacePresentationMode: "facelift",
      facelift: {
        ...createDefaultWorkspacePreferences("user-1", "binder-1").facelift,
        surfaceMode: "canvas",
        density: "compact",
        moduleChrome: "minimal",
      },
      enabledModules: ["lesson", "private-notes"],
      windowLayout: {
        lesson: { x: 0, y: 0, w: 550, h: 760, z: 1 },
        "private-notes": { x: 550, y: 0, w: 550, h: 760, z: 2 },
      },
    };

    const { container } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    const root = container.querySelector("[data-workspace-presentation='facelift']");
    expect(root?.getAttribute("data-facelift-surface")).toBe("canvas");
    expect(root?.getAttribute("data-facelift-density")).toBe("compact");
    expect(root?.getAttribute("data-facelift-module-chrome")).toBe("minimal");
  });

  it("uses the Facelift Canvas preset recipe in locked study mode instead of stale saved frames", () => {
    const basePreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const preferences: WorkspacePreferences = {
      ...basePreferences,
      workspacePresentationMode: "facelift",
      preset: "math-practice-mode",
      locked: true,
      facelift: {
        ...basePreferences.facelift,
        surfaceMode: "canvas",
      },
      enabledModules: ["whiteboard", "math-blocks", "private-notes", "formula-sheet", "desmos-graph"],
      moduleLayout: {
        ...basePreferences.moduleLayout,
        whiteboard: { span: "full", collapsed: false },
        "math-blocks": { span: "medium", collapsed: false },
        "private-notes": { span: "wide", collapsed: false },
        "formula-sheet": { span: "medium", collapsed: false },
        "desmos-graph": { span: "full", collapsed: false },
      },
      windowLayout: {
        ...basePreferences.windowLayout,
        whiteboard: { x: 240, y: 120, w: 620, h: 500, z: 1 },
        "desmos-graph": { x: 0, y: 0, w: 1100, h: 740, z: 9 },
      },
    };

    const { container } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    const whiteboard = container.querySelector<HTMLElement>('[data-window-module-id="whiteboard"]');
    const graph = container.querySelector<HTMLElement>('[data-window-module-id="desmos-graph"]');
    expect(whiteboard?.style.left).toBe("256px");
    expect(whiteboard?.style.top).toBe("0px");
    expect(graph?.style.left).not.toBe("0px");
    expect(Number.parseInt(graph?.style.left ?? "0", 10)).toBeGreaterThanOrEqual(800);
  });

  it("auto-fits locked Split Study when the measured canvas is wider than the saved fit", () => {
    const onFitViewport = vi.fn();
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      locked: true,
      preset: "split-study",
      enabledModules: ["lesson", "private-notes"],
      viewportFit: {
        width: 760,
        height: 760,
        updatedAt: new Date(0).toISOString(),
      },
      windowLayout: {
        lesson: { x: 0, y: 0, w: 360, h: 760, z: 1 },
        "private-notes": { x: 376, y: 0, w: 360, h: 760, z: 2 },
      },
    };

    render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={onFitViewport}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    vi.runOnlyPendingTimers();

    expect(onFitViewport).toHaveBeenCalledWith({ width: 1100, height: 760 });
  });

  it("does not auto-fit a locked custom canvas after the user has resized modules", () => {
    const onFitViewport = vi.fn();
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      locked: true,
      preset: "math-graph-lab",
      enabledModules: ["lesson", "private-notes"],
      viewportFit: {
        width: 720,
        height: 520,
        updatedAt: new Date(0).toISOString(),
      },
      windowLayout: {
        lesson: { x: 32, y: 32, w: 860, h: 620, z: 1 },
        "private-notes": { x: 916, y: 32, w: 520, h: 620, z: 2 },
      },
    };

    render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={onFitViewport}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    vi.runOnlyPendingTimers();

    expect(onFitViewport).not.toHaveBeenCalled();
  });

  it("does not run locked Split Study auto-refit while setup mode is editing", () => {
    const onFitViewport = vi.fn();
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      locked: true,
      preset: "split-study",
      enabledModules: ["lesson", "private-notes"],
      viewportFit: {
        width: 760,
        height: 760,
        updatedAt: new Date(0).toISOString(),
      },
      windowLayout: {
        lesson: { x: 0, y: 0, w: 360, h: 760, z: 1 },
        "private-notes": { x: 376, y: 0, w: 360, h: 760, z: 2 },
      },
    };

    render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="setup"
        onCommitFrame={vi.fn()}
        onFitViewport={onFitViewport}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    vi.runOnlyPendingTimers();

    expect(onFitViewport).not.toHaveBeenCalled();
  });

  it("keeps floating stickies visible even when the sticky manager window is hidden", () => {
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      locked: true,
      enabledModules: ["lesson"],
      stickyNotes: {
        "comment-1": stickyLayout,
      },
    };
    const context = {
      comments: [comment],
      stickyLayouts: {
        [comment.id]: stickyLayout,
      },
      onDeleteComment: vi.fn(),
      onStickyMove: vi.fn(),
      onSendStickyToNotes: vi.fn(),
      onUpdateComment: vi.fn(),
    } as unknown as WorkspaceModuleContext;

    render(
      <WindowedWorkspace
        context={context}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    expect(screen.getByDisplayValue("Connect this to epsilon-delta later.")).toBeTruthy();
  });

  it("cancels a pending locked-study auto-fit when the user enters setup mode", () => {
    const onFitViewport = vi.fn();
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      locked: true,
      preset: "split-study",
      enabledModules: ["lesson", "private-notes"],
      viewportFit: {
        width: 760,
        height: 760,
        updatedAt: new Date(0).toISOString(),
      },
      windowLayout: {
        lesson: { x: 0, y: 0, w: 360, h: 760, z: 1 },
        "private-notes": { x: 376, y: 0, w: 360, h: 760, z: 2 },
      },
    };

    const { rerender } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={onFitViewport}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    rerender(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="setup"
        onCommitFrame={vi.fn()}
        onFitViewport={onFitViewport}
        onToggleCollapsed={vi.fn()}
        preferences={{ ...preferences, locked: false }}
      />,
    );
    vi.runOnlyPendingTimers();

    expect(onFitViewport).not.toHaveBeenCalled();
  });

  it("marks the rendered canvas with the active preset so Split Study can use full-width content styles", () => {
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      locked: true,
      preset: "split-study",
      enabledModules: ["lesson", "private-notes"],
    };

    const { container } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    expect(container.querySelector('[data-workspace-preset="split-study"]')).toBeTruthy();
  });

  it("hides the collapsed window tray in focus mode", () => {
    const basePreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const preferences: WorkspacePreferences = {
      ...basePreferences,
      enabledModules: ["lesson", "private-notes"],
      moduleLayout: {
        ...basePreferences.moduleLayout,
        "private-notes": {
          ...basePreferences.moduleLayout["private-notes"],
          span: basePreferences.moduleLayout["private-notes"]?.span ?? "auto",
          collapsed: true,
        },
      },
      theme: {
        ...basePreferences.theme,
        focusMode: true,
      },
    };

    const { queryByText } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    expect(queryByText("Collapsed windows")).toBeNull();
    expect(queryByText("Private notes")).toBeNull();
  });

  it("keeps the collapsed window tray available outside focus mode", () => {
    const basePreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const preferences: WorkspacePreferences = {
      ...basePreferences,
      enabledModules: ["lesson", "private-notes"],
      moduleLayout: {
        ...basePreferences.moduleLayout,
        "private-notes": {
          ...basePreferences.moduleLayout["private-notes"],
          span: basePreferences.moduleLayout["private-notes"]?.span ?? "auto",
          collapsed: true,
        },
      },
    };

    const { getByText } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    expect(getByText("Collapsed windows")).toBeTruthy();
    expect(getByText("Private notes")).toBeTruthy();
  });

  it("removes the bottom collapsed-window tray in Facelift Canvas", () => {
    const basePreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const preferences: WorkspacePreferences = {
      ...basePreferences,
      workspacePresentationMode: "facelift",
      facelift: {
        ...basePreferences.facelift,
        surfaceMode: "canvas",
      },
      enabledModules: ["lesson", "private-notes"],
      moduleLayout: {
        ...basePreferences.moduleLayout,
        "private-notes": {
          ...basePreferences.moduleLayout["private-notes"],
          span: basePreferences.moduleLayout["private-notes"]?.span ?? "auto",
          collapsed: true,
        },
      },
    };

    const { queryByText } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    expect(queryByText("Collapsed windows")).toBeNull();
    expect(queryByText("Private notes")).toBeNull();
  });

  it("keeps the setup module launcher hidden by default", () => {
    const basePreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    const { queryByText } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="setup"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onOpenModule={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={{
          ...basePreferences,
          locked: false,
          enabledModules: ["lesson", "private-notes"],
        }}
      />,
    );

    expect(queryByText("Module launcher")).toBeNull();
  });

  it("hides edit helper hints after thirty seconds in setup mode", () => {
    const basePreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    const { container } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="setup"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onOpenModule={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={{
          ...basePreferences,
          locked: false,
          enabledModules: ["lesson"],
        }}
      />,
    );

    const workspace = container.querySelector<HTMLElement>("[data-workspace-edit-hints]");
    expect(workspace?.dataset.workspaceEditHints).toBe("on");

    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(workspace?.dataset.workspaceEditHints).toBe("on");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(workspace?.dataset.workspaceEditHints).toBe("off");
  });

  it("does not cover Facelift Canvas modules with the setup helper hint", () => {
    const basePreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    const { container, queryByText } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="setup"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onOpenModule={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={{
          ...basePreferences,
          workspacePresentationMode: "facelift",
          locked: false,
          facelift: {
            ...basePreferences.facelift,
            surfaceMode: "canvas",
          },
          enabledModules: ["lesson"],
        }}
      />,
    );

    const workspace = container.querySelector<HTMLElement>("[data-workspace-edit-hints]");
    expect(workspace?.dataset.workspaceEditHints).toBe("off");
    expect(queryByText(/Drag windows/i)).toBeNull();
  });

  it("shows minimized modules in the setup module launcher when enabled without mounting their heavy content", () => {
    const onToggleCollapsed = vi.fn();
    const basePreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const preferences: WorkspacePreferences = {
      ...basePreferences,
      locked: false,
      enabledModules: ["lesson", "private-notes"],
      theme: {
        ...basePreferences.theme,
        showUtilityUi: true,
      },
      moduleLayout: {
        ...basePreferences.moduleLayout,
        "private-notes": {
          ...basePreferences.moduleLayout["private-notes"],
          span: basePreferences.moduleLayout["private-notes"]?.span ?? "auto",
          collapsed: true,
        },
      },
    };

    const { getByLabelText, getByText, queryByText } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="setup"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onOpenModule={vi.fn()}
        onToggleCollapsed={onToggleCollapsed}
        preferences={preferences}
      />,
    );

    expect(getByText("Module launcher")).toBeTruthy();
    expect(getByLabelText("Restore Private notes")).toBeTruthy();
    expect(queryByText("Notes body")).toBeNull();

    fireEvent.click(getByLabelText("Restore Private notes"));

    expect(onToggleCollapsed).toHaveBeenCalledWith("private-notes", false);
  });

  it("does not keep stale infinite canvas height in locked Split Study", () => {
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      locked: true,
      preset: "split-study",
      enabledModules: ["lesson", "private-notes"],
      canvas: {
        ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas").canvas,
        canvasHeight: 1600,
      },
      windowLayout: {
        lesson: { x: 0, y: 0, w: 550, h: 760, z: 1 },
        "private-notes": { x: 550, y: 0, w: 550, h: 760, z: 2 },
      },
    };

    const { container } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    const canvas = container.querySelector<HTMLElement>(".workspace-canvas");
    expect(canvas?.style.height).toBe("760px");
    expect(canvas?.style.width).toBe("1100px");
  });

  it("renders locked Split Study edge-to-edge even when saved frames are shifted", () => {
    const preferences: WorkspacePreferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      locked: true,
      preset: "split-study",
      enabledModules: ["lesson", "private-notes"],
      windowLayout: {
        lesson: { x: 266, y: 18, w: 812, h: 620, z: 1 },
        "private-notes": { x: 1098, y: 18, w: 812, h: 620, z: 2 },
      },
    };

    const { container } = render(
      <WindowedWorkspace
        context={{} as WorkspaceModuleContext}
        mode="study"
        onCommitFrame={vi.fn()}
        onFitViewport={vi.fn()}
        onToggleCollapsed={vi.fn()}
        preferences={preferences}
      />,
    );

    const lesson = container.querySelector<HTMLElement>('[data-window-module-id="lesson"]');
    const notes = container.querySelector<HTMLElement>('[data-window-module-id="private-notes"]');
    expect(lesson?.style.left).toBe("0px");
    expect(lesson?.style.top).toBe("0px");
    expect(lesson?.style.width).toBe("550px");
    expect(lesson?.style.height).toBe("760px");
    expect(notes?.style.left).toBe("550px");
    expect(notes?.style.top).toBe("0px");
    expect(notes?.style.width).toBe("550px");
    expect(notes?.style.height).toBe("760px");
  });
});
