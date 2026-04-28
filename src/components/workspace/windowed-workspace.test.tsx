// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WindowedWorkspace } from "@/components/workspace/windowed-workspace";
import { applyWorkspaceMode, createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { WorkspacePreferences } from "@/types";

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
