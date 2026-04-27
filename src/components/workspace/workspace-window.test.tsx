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
        peerFrames={[]}
        safeEdgePadding={false}
        snapBehavior="edges"
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

  it("clamps move commits horizontally while allowing vertical canvas placement below the viewport", () => {
    const onCommit = vi.fn();

    render(
      <WorkspaceWindow
        boundsHeight={720}
        boundsWidth={900}
        canvasHeight={1600}
        canvasWidth={900}
        frame={frame}
        locked={false}
        moduleId="lesson"
        onCommit={onCommit}
        onToggleCollapsed={vi.fn()}
        peerFrames={[]}
        safeEdgePadding={false}
        snapBehavior="edges"
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
      y: 476,
      w: 640,
      h: 480,
    });
  });

  it("snaps a dragged window to the right canvas edge without resizing it", () => {
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
          peerFrames={[]}
          safeEdgePadding={false}
          snapBehavior="edges"
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
      x: 260,
      y: 176,
      w: 640,
      h: 480,
    });
  });

  it("snaps a dragged window to nearby module edges when module snapping is enabled", () => {
    const onCommit = vi.fn();

    const { container } = render(
      <div className="workspace-canvas-shell">
        <WorkspaceWindow
          boundsHeight={900}
          boundsWidth={1200}
          canvasHeight={900}
          canvasWidth={1200}
          frame={{ ...frame, x: 24, y: 24, w: 420, h: 420 }}
          locked={false}
          moduleId="lesson"
          onCommit={onCommit}
          onToggleCollapsed={vi.fn()}
          peerFrames={[{ x: 520, y: 24, w: 420, h: 420, z: 3 }]}
          safeEdgePadding={false}
          snapBehavior="modules"
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
    Object.defineProperty(shell, "clientWidth", { configurable: true, value: 1200 });
    Object.defineProperty(shell, "clientHeight", { configurable: true, value: 900 });
    Object.defineProperty(shell, "scrollLeft", { configurable: true, value: 0 });
    Object.defineProperty(shell, "scrollTop", { configurable: true, value: 0 });
    vi.spyOn(shell, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1200,
      bottom: 900,
      width: 1200,
      height: 900,
      toJSON: () => ({}),
    });

    const handle = screen.getAllByText("Lesson")[0];
    fireEvent.pointerDown(handle, { clientX: 80, clientY: 80 });
    fireEvent.pointerMove(window, { clientX: 571, clientY: 80 });
    fireEvent.pointerUp(window);

    expect(onCommit.mock.calls.at(-1)?.[1]).toMatchObject({
      x: 520,
      y: 24,
    });
  });
});
