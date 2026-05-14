// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardCanvas } from "@/components/whiteboard/whiteboard-canvas";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/whiteboards/whiteboard-limits";
import type { BinderWhiteboard, WhiteboardSceneData } from "@/lib/whiteboards/whiteboard-types";

const excalidrawMock = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  refresh: vi.fn(),
  apiState: {
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
  } as Record<string, unknown>,
}));

vi.mock("@excalidraw/excalidraw", async () => {
  const React = await import("react");
  return {
    Excalidraw: (props: Record<string, unknown>) => {
      excalidrawMock.props = props;
      if (typeof props.excalidrawAPI === "function") {
        props.excalidrawAPI({
          getAppState: () => excalidrawMock.apiState,
          refresh: excalidrawMock.refresh,
        });
      }
      return React.createElement("div", { "data-testid": "mock-excalidraw" });
    },
  };
});

function board(overrides: Partial<BinderWhiteboard> = {}): BinderWhiteboard {
  return {
    id: "board-1",
    ownerId: "user-1",
    binderId: "math-lab",
    lessonId: "math-lab-whiteboard",
    title: "Math Lab whiteboard",
    subject: "Math",
    moduleContext: "math-lab",
    scene: {
      elements: [],
      appState: {
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
      },
      files: {},
    },
    modules: [],
    objectCount: 0,
    sceneSizeBytes: 0,
    assetSizeBytes: 0,
    storageMode: "local-draft",
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("WhiteboardCanvas", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    excalidrawMock.props = null;
    excalidrawMock.apiState = {
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
    };
    excalidrawMock.refresh.mockClear();
  });

  it("wires Excalidraw onScrollChange for live camera updates", async () => {
    render(<WhiteboardCanvas board={board()} onSceneChange={vi.fn()} onViewportChange={vi.fn()} />);

    await waitFor(() => expect(excalidrawMock.props).toBeTruthy());

    expect(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-toolbar-layer")).toBe("true");
    expect(typeof excalidrawMock.props?.onScrollChange).toBe("function");
  });

  it("normalizes onScrollChange zoom.value and emits the latest viewport transform", async () => {
    const onViewportChange = vi.fn();
    render(<WhiteboardCanvas board={board()} onSceneChange={vi.fn()} onViewportChange={onViewportChange} />);

    await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
    onViewportChange.mockClear();

    act(() => {
      (excalidrawMock.props?.onScrollChange as (scrollX: number, scrollY: number, zoom: { value: number }) => void)(
        320,
        -140,
        { value: 2.5 },
      );
    });

    expect(onViewportChange).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollX: 320,
        scrollY: -140,
        zoom: 2.5,
      }),
    );
  });

  it("uses onChange appState as a fallback for toolbar camera updates", async () => {
    const onViewportChange = vi.fn();
    const onSceneChange = vi.fn();
    render(<WhiteboardCanvas board={board()} onSceneChange={onSceneChange} onViewportChange={onViewportChange} />);

    await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
    onViewportChange.mockClear();

    act(() => {
      (excalidrawMock.props?.onChange as (
        elements: readonly unknown[],
        appState: WhiteboardSceneData["appState"],
        files: Record<string, unknown>,
      ) => void)([], { scrollX: 999, scrollY: 888, zoom: { value: 4 } }, {});
    });

    expect(onSceneChange).not.toHaveBeenCalled();
    expect(onViewportChange).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollX: 999,
        scrollY: 888,
        zoom: 4,
      }),
    );
  });

  it("debounces persistent scene changes instead of notifying the parent on every drawing event", async () => {
    const onSceneChange = vi.fn();
    render(<WhiteboardCanvas board={board()} onSceneChange={onSceneChange} onViewportChange={vi.fn()} />);

    await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
    vi.useFakeTimers();

    act(() => {
      const onChange = excalidrawMock.props?.onChange as (
        elements: readonly unknown[],
        appState: WhiteboardSceneData["appState"],
        files: Record<string, unknown>,
      ) => void;
      onChange([{ id: "stroke-1", version: 1 }], { scrollX: 0, scrollY: 0, zoom: { value: 1 } }, {});
      onChange([{ id: "stroke-1", version: 2 }], { scrollX: 0, scrollY: 0, zoom: { value: 1 } }, {});
      onChange([{ id: "stroke-1", version: 3 }], { scrollX: 0, scrollY: 0, zoom: { value: 1 } }, {});
    });

    expect(onSceneChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
    });
    expect(onSceneChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onSceneChange).toHaveBeenCalledTimes(1);
    expect(onSceneChange).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [expect.objectContaining({ id: "stroke-1", version: 3 })],
      }),
    );
  });

  it("flushes the latest scene once after a stroke ends", async () => {
    const onSceneChange = vi.fn();
    render(<WhiteboardCanvas board={board()} onSceneChange={onSceneChange} onViewportChange={vi.fn()} />);

    await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
    vi.useFakeTimers();
    const host = screen.getByTestId("whiteboard-excalidraw-host");

    fireEvent.pointerDown(host, { pointerId: 1 });
    act(() => {
      (excalidrawMock.props?.onChange as (
        elements: readonly unknown[],
        appState: WhiteboardSceneData["appState"],
        files: Record<string, unknown>,
      ) => void)([{ id: "stroke-after-pointerup", version: 1 }], {}, {});
    });

    fireEvent.pointerUp(host, { pointerId: 1 });

    expect(onSceneChange).toHaveBeenCalledTimes(1);
    expect(onSceneChange).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [expect.objectContaining({ id: "stroke-after-pointerup" })],
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(onSceneChange).toHaveBeenCalledTimes(1);
  });

  it("keeps Excalidraw initialData stable across unrelated parent rerenders", async () => {
    const whiteboard = board();
    const { rerender } = render(
      <WhiteboardCanvas board={whiteboard} fullscreen={false} onSceneChange={vi.fn()} onViewportChange={vi.fn()} />,
    );

    await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
    const firstInitialData = excalidrawMock.props?.initialData;

    rerender(
      <WhiteboardCanvas board={whiteboard} fullscreen onSceneChange={vi.fn()} onViewportChange={vi.fn()} />,
    );

    expect(excalidrawMock.props?.initialData).toBe(firstInitialData);
  });

  it("does not start idle camera polling when Excalidraw callbacks are quiet", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    try {
      render(<WhiteboardCanvas board={board()} onSceneChange={vi.fn()} onViewportChange={vi.fn()} />);

      await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
      expect(setIntervalSpy.mock.calls.some((call) => call[1] === 16)).toBe(false);
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it("does not spam viewport updates while the camera is unchanged", async () => {
    const onViewportChange = vi.fn();
    render(<WhiteboardCanvas board={board()} onSceneChange={vi.fn()} onViewportChange={onViewportChange} />);

    await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
    await new Promise((resolve) => window.setTimeout(resolve, 40));

    const callCount = onViewportChange.mock.calls.length;
    await new Promise((resolve) => window.setTimeout(resolve, 40));

    expect(onViewportChange.mock.calls).toHaveLength(callCount);
    expect(onViewportChange).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollX: 0,
        scrollY: 0,
        zoom: 1,
      }),
    );
  });

  it("does not save scene data when Excalidraw only reports a pan or zoom", async () => {
    const onSceneChange = vi.fn();
    render(<WhiteboardCanvas board={board()} onSceneChange={onSceneChange} onViewportChange={vi.fn()} />);

    await waitFor(() => expect(excalidrawMock.props).toBeTruthy());

    act(() => {
      (excalidrawMock.props?.onScrollChange as (scrollX: number, scrollY: number, zoom: { value: number }) => void)(
        50,
        60,
        { value: 1.25 },
      );
    });

    expect(onSceneChange).not.toHaveBeenCalled();
  });

  it("refreshes Excalidraw when its host container is resized", async () => {
    const resizeCallbacks: ResizeObserverCallback[] = [];
    const OriginalResizeObserver = globalThis.ResizeObserver;

    class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      render(<WhiteboardCanvas board={board()} onSceneChange={vi.fn()} onViewportChange={vi.fn()} />);

      await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
      await waitFor(() => expect(resizeCallbacks).toHaveLength(1));
      excalidrawMock.refresh.mockClear();

      act(() => {
        resizeCallbacks[0]?.(
          [
            {
              contentRect: {
                width: 900,
                height: 520,
              },
            } as ResizeObserverEntry,
          ],
          {} as ResizeObserver,
        );
      });

      await waitFor(() => expect(excalidrawMock.refresh).toHaveBeenCalled());
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });

  it("defers ResizeObserver refresh work while a drawing pointer is active", async () => {
    const resizeCallbacks: ResizeObserverCallback[] = [];
    const OriginalResizeObserver = globalThis.ResizeObserver;

    class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      render(<WhiteboardCanvas board={board()} onSceneChange={vi.fn()} onViewportChange={vi.fn()} />);

      await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
      await waitFor(() => expect(resizeCallbacks).toHaveLength(1));
      excalidrawMock.refresh.mockClear();

      const host = screen.getByTestId("whiteboard-excalidraw-host");
      fireEvent.pointerDown(host, { pointerId: 1 });
      act(() => {
        resizeCallbacks[0]?.(
          [
            {
              contentRect: {
                width: 900,
                height: 520,
              },
            } as ResizeObserverEntry,
          ],
          {} as ResizeObserver,
        );
      });

      expect(excalidrawMock.refresh).not.toHaveBeenCalled();

      fireEvent.pointerUp(host, { pointerId: 1 });

      await waitFor(() => expect(excalidrawMock.refresh).toHaveBeenCalledTimes(1));
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });

  it("defers Excalidraw refresh work while parent workspace movement is active", async () => {
    const resizeCallbacks: ResizeObserverCallback[] = [];
    const OriginalResizeObserver = globalThis.ResizeObserver;

    class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    document.documentElement.dataset.workspaceDragging = "true";

    try {
      render(<WhiteboardCanvas board={board()} onSceneChange={vi.fn()} onViewportChange={vi.fn()} />);

      await waitFor(() => expect(excalidrawMock.props).toBeTruthy());
      await waitFor(() => expect(resizeCallbacks).toHaveLength(1));
      excalidrawMock.refresh.mockClear();

      act(() => {
        resizeCallbacks[0]?.(
          [
            {
              contentRect: {
                width: 900,
                height: 520,
              },
            } as ResizeObserverEntry,
          ],
          {} as ResizeObserver,
        );
      });

      expect(excalidrawMock.refresh).not.toHaveBeenCalled();

      document.documentElement.dataset.workspaceDragging = "false";
      window.dispatchEvent(new CustomEvent("bindernotes:workspace-movement-end"));

      await waitFor(() => expect(excalidrawMock.refresh).toHaveBeenCalledTimes(1));
    } finally {
      document.documentElement.dataset.workspaceDragging = "false";
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });
});
