// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceWindow } from "@/components/workspace/workspace-window";
import type { WorkspaceWindowFrame } from "@/types";

const frame: WorkspaceWindowFrame = {
  x: 24,
  y: 36,
  w: 640,
  h: 480,
  z: 2,
};

describe("WorkspaceWindow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("does not persist focus ordering clicks in locked mode", () => {
    const onCommit = vi.fn();

    render(
      <WorkspaceWindow
        boundsHeight={720}
        boundsWidth={1024}
        canvasHeight={720}
        canvasWidth={1024}
        frame={frame}
        locked
        moduleId="lesson"
        onCommit={onCommit}
        onToggleCollapsed={vi.fn()}
        snapEnabled
        topZ={8}
        workspaceStyle="guided"
      >
        <section>
          <header data-window-drag-handle="true">Lesson</header>
          <p>Body</p>
        </section>
      </WorkspaceWindow>,
    );

    fireEvent.mouseDown(screen.getByText("Body"));

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("clamps move commits to the visible workspace bounds", () => {
    const onCommit = vi.fn();

    render(
      <WorkspaceWindow
        boundsHeight={720}
        boundsWidth={900}
        canvasHeight={720}
        canvasWidth={900}
        frame={frame}
        locked={false}
        moduleId="lesson"
        onCommit={onCommit}
        onToggleCollapsed={vi.fn()}
        snapEnabled
        topZ={8}
        workspaceStyle="full-studio"
      >
        <section>
          <header data-window-drag-handle="true">Lesson</header>
          <p>Body</p>
        </section>
      </WorkspaceWindow>,
    );

    const handle = screen.getAllByText("Lesson")[0];
    fireEvent.pointerDown(handle, { clientX: 80, clientY: 80 });
    fireEvent.pointerMove(window, { clientX: 800, clientY: 520 });
    fireEvent.pointerUp(window);

    expect(onCommit).toHaveBeenCalled();
    expect(onCommit.mock.calls.at(-1)?.[1]).toMatchObject({
      x: 260,
      y: 240,
      w: 640,
      h: 480,
    });
  });

  it("snaps a dragged window into the right split when released near the shell edge", () => {
    const onCommit = vi.fn();

    const { container } = render(
      <div className="workspace-canvas-shell">
        <WorkspaceWindow
          boundsHeight={720}
          boundsWidth={900}
          canvasHeight={720}
        canvasWidth={900}
        frame={frame}
        locked={false}
        moduleId="lesson"
        onCommit={onCommit}
        onToggleCollapsed={vi.fn()}
        snapEnabled
        topZ={8}
        workspaceStyle="full-studio"
      >
          <section>
            <header data-window-drag-handle="true">Lesson</header>
            <p>Body</p>
          </section>
        </WorkspaceWindow>
      </div>,
    );

    const shell = container.querySelector(".workspace-canvas-shell") as HTMLDivElement;
    Object.defineProperty(shell, "clientWidth", { configurable: true, value: 900 });
    Object.defineProperty(shell, "clientHeight", { configurable: true, value: 720 });
    Object.defineProperty(shell, "scrollLeft", { configurable: true, value: 0 });
    Object.defineProperty(shell, "scrollTop", { configurable: true, value: 0 });
    vi.spyOn(shell, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 900,
      bottom: 720,
      width: 900,
      height: 720,
      toJSON: () => ({}),
    });

    const handle = screen.getAllByText("Lesson")[0];
    fireEvent.pointerDown(handle, { clientX: 80, clientY: 80 });
    fireEvent.pointerMove(window, { clientX: 880, clientY: 220 });
    fireEvent.pointerUp(window);

    expect(onCommit.mock.calls.at(-1)?.[1]).toMatchObject({
      x: 448,
      y: 8,
      w: 440,
      h: 704,
    });
  });
});
