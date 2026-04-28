// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardCanvas } from "@/components/whiteboard/whiteboard-canvas";
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
});
