import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";
import {
  extractWhiteboardViewportTransform,
  whiteboardViewportTransformsEqual,
  type WhiteboardViewportTransform,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import {
  hasPersistentWhiteboardSceneChange,
  sanitizeExcalidrawInitialData,
} from "@/lib/whiteboards/whiteboard-serialization";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/whiteboards/whiteboard-limits";
import type { BinderWhiteboard, WhiteboardSceneData } from "@/lib/whiteboards/whiteboard-types";

type WhiteboardCanvasProps = {
  board: BinderWhiteboard;
  onSceneChange: (scene: WhiteboardSceneData) => void;
  onViewportChange?: (transform: WhiteboardViewportTransform) => void;
  onViewportRequestReady?: (requestViewport: ((transform: WhiteboardViewportTransform) => void) | null) => void;
  fullscreen?: boolean;
};

type ExcalidrawCameraApi = {
  getAppState?: () => unknown;
  updateScene?: (scene: { appState?: Record<string, unknown> }) => void;
  refresh?: () => void;
};

type PendingSceneInput = {
  elements: readonly unknown[];
  appState: unknown;
  files: unknown;
};

type WhiteboardDebugWindow = typeof window & {
  __BINDERNOTES_WHITEBOARD_CAMERA__?: () => unknown;
};

export function WhiteboardCanvas({
  board,
  onSceneChange,
  onViewportChange,
  onViewportRequestReady,
  fullscreen = false,
}: WhiteboardCanvasProps) {
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<ComponentType<Record<string, unknown>> | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const excalidrawApiRef = useRef<ExcalidrawCameraApi | null>(null);
  const latestViewportTransformRef = useRef<WhiteboardViewportTransform | null>(null);
  const initialData = useMemo(() => sanitizeExcalidrawInitialData(board.scene), [board.scene]);
  const latestPersistentSceneRef = useRef<WhiteboardSceneData>(initialData);
  const pendingSceneRef = useRef<PendingSceneInput | null>(null);
  const sceneChangeTimerRef = useRef<number | null>(null);
  const drawingPointerIdsRef = useRef(new Set<number>());
  const pendingResizeRefreshRef = useRef(false);
  const lastHostSizeRef = useRef<{ width: number; height: number } | null>(null);

  const getViewportSize = useCallback(() => {
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect?.width && rect?.height) {
      return {
        width: rect.width,
        height: rect.height,
        offsetLeft: rect.left,
        offsetTop: rect.top,
      };
    }

    if (typeof window !== "undefined") {
      return {
        width: window.innerWidth || 1440,
        height: window.innerHeight || 900,
        offsetLeft: 0,
        offsetTop: 0,
      };
    }

    return { width: 1440, height: 900, offsetLeft: 0, offsetTop: 0 };
  }, []);

  const emitViewportChange = useCallback(
    (appState: unknown) => {
      const nextTransform = extractWhiteboardViewportTransform(appState, getViewportSize());
      const currentTransform = latestViewportTransformRef.current;
      if (currentTransform && whiteboardViewportTransformsEqual(currentTransform, nextTransform)) {
        return;
      }

      latestViewportTransformRef.current = nextTransform;
      onViewportChange?.(nextTransform);
    },
    [getViewportSize, onViewportChange],
  );

  const handleScrollChange = useCallback(
    (scrollX: number, scrollY: number, zoom: unknown) => {
      emitViewportChange({
        scrollX,
        scrollY,
        zoom,
      });
    },
    [emitViewportChange],
  );

  const clearSceneChangeTimer = useCallback(() => {
    if (sceneChangeTimerRef.current !== null) {
      window.clearTimeout(sceneChangeTimerRef.current);
      sceneChangeTimerRef.current = null;
    }
  }, []);

  const flushPendingSceneChange = useCallback(() => {
    const pendingScene = pendingSceneRef.current;
    pendingSceneRef.current = null;
    clearSceneChangeTimer();
    if (!pendingScene) {
      return;
    }

    const scene = sanitizeExcalidrawInitialData({
      elements: pendingScene.elements as unknown[],
      appState: pendingScene.appState,
      files: pendingScene.files,
    });
    if (!hasPersistentWhiteboardSceneChange(latestPersistentSceneRef.current, scene)) {
      return;
    }

    latestPersistentSceneRef.current = scene;
    onSceneChange(scene);
  }, [clearSceneChangeTimer, onSceneChange]);

  const scheduleSceneChangeFlush = useCallback(() => {
    clearSceneChangeTimer();
    sceneChangeTimerRef.current = window.setTimeout(flushPendingSceneChange, AUTOSAVE_DEBOUNCE_MS);
  }, [clearSceneChangeTimer, flushPendingSceneChange]);

  const refreshCanvasAfterLayout = useCallback(() => {
    const api = excalidrawApiRef.current;
    api?.refresh?.();
    emitViewportChange(api?.getAppState?.() ?? initialData.appState ?? {});
  }, [emitViewportChange, initialData.appState]);

  const finishDrawingPointerById = useCallback(
    (pointerId?: number) => {
      const hadActiveDrawingPointer = drawingPointerIdsRef.current.size > 0;
      if (typeof pointerId === "number") {
        drawingPointerIdsRef.current.delete(pointerId);
      } else {
        drawingPointerIdsRef.current.clear();
      }

      if (!hadActiveDrawingPointer || drawingPointerIdsRef.current.size > 0) {
        return;
      }

      flushPendingSceneChange();
      if (pendingResizeRefreshRef.current) {
        pendingResizeRefreshRef.current = false;
        window.requestAnimationFrame(refreshCanvasAfterLayout);
      }
    },
    [flushPendingSceneChange, refreshCanvasAfterLayout],
  );

  const finishDrawingPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      finishDrawingPointerById(event.pointerId);
    },
    [finishDrawingPointerById],
  );

  const handleDrawingPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    drawingPointerIdsRef.current.add(event.pointerId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const finishPointer = (event: PointerEvent) => finishDrawingPointerById(event.pointerId);
    const clearPointers = () => finishDrawingPointerById();
    const flushForPageExit = () => flushPendingSceneChange();
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSceneChange();
      }
    };
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", finishPointer);
    window.addEventListener("blur", clearPointers);
    window.addEventListener("pagehide", flushForPageExit);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", finishPointer);
      window.removeEventListener("blur", clearPointers);
      window.removeEventListener("pagehide", flushForPageExit);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [finishDrawingPointerById, flushPendingSceneChange]);

  const handleExcalidrawApi = useCallback(
    (api: ExcalidrawCameraApi) => {
      excalidrawApiRef.current = api;
      if (import.meta.env.DEV && typeof window !== "undefined") {
        (window as WhiteboardDebugWindow).__BINDERNOTES_WHITEBOARD_CAMERA__ = () => api.getAppState?.() ?? null;
      }
      emitViewportChange(api.getAppState?.() ?? {});
      onViewportRequestReady?.((transform: WhiteboardViewportTransform) => {
        const currentAppState =
          api.getAppState?.() && typeof api.getAppState?.() === "object"
            ? (api.getAppState?.() as Record<string, unknown>)
            : {};
        const nextAppState = {
          ...currentAppState,
          scrollX: transform.scrollX,
          scrollY: transform.scrollY,
          zoom: { value: transform.zoom },
        };
        api.updateScene?.({ appState: nextAppState });
        api.refresh?.();
        emitViewportChange(nextAppState);
      });
    },
    [emitViewportChange, onViewportRequestReady],
  );

  useEffect(
    () => () => {
      flushPendingSceneChange();
      onViewportRequestReady?.(null);
    },
    [flushPendingSceneChange, onViewportRequestReady],
  );

  useEffect(() => {
    flushPendingSceneChange();
    latestPersistentSceneRef.current = initialData;
  }, [board.id, flushPendingSceneChange, initialData]);

  useEffect(() => {
    let mounted = true;

    void import("@excalidraw/excalidraw").then((module) => {
      if (mounted) {
        setExcalidrawComponent(() => module.Excalidraw as ComponentType<Record<string, unknown>>);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    emitViewportChange(initialData.appState ?? {});
  }, [board.id, board.scene.appState, emitViewportChange]);

  useEffect(() => {
    if (!ExcalidrawComponent) {
      return;
    }

    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") {
      return;
    }

    let animationFrame = 0;
    const refreshCanvas = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        refreshCanvasAfterLayout();
      });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry?.contentRect.width || !entry.contentRect.height) {
        return;
      }

      const nextSize = {
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      };
      const lastSize = lastHostSizeRef.current;
      if (lastSize?.width === nextSize.width && lastSize.height === nextSize.height) {
        return;
      }
      lastHostSizeRef.current = nextSize;

      if (drawingPointerIdsRef.current.size > 0) {
        pendingResizeRefreshRef.current = true;
        return;
      }

      refreshCanvas();
    });

    resizeObserver.observe(host);

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver.disconnect();
    };
  }, [ExcalidrawComponent, refreshCanvasAfterLayout]);

  const excalidrawInitialData = useMemo(
    () => ({
      elements: initialData.elements as never[],
      appState: {
        viewBackgroundColor: "#11131a",
        ...(initialData.appState ?? {}),
      },
      files: (initialData.files ?? {}) as never,
    }),
    [initialData],
  );

  const handleExcalidrawChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      emitViewportChange(appState as Record<string, unknown>);
      pendingSceneRef.current = {
        elements,
        appState,
        files,
      };
      scheduleSceneChangeFlush();
    },
    [emitViewportChange, scheduleSceneChangeFlush],
  );

  if (!ExcalidrawComponent) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#10131a] text-sm text-muted-foreground">
        Loading whiteboard canvas...
      </div>
    );
  }

  return (
    <div
      className="whiteboard-excalidraw-host absolute inset-0 h-full w-full overflow-hidden bg-[#10131a]"
      data-board-toolbar-layer="true"
      data-fullscreen-whiteboard={fullscreen ? "true" : "false"}
      data-whiteboard-active="true"
      data-testid="whiteboard-excalidraw-host"
      onPointerCancelCapture={finishDrawingPointer}
      onPointerDownCapture={handleDrawingPointerDown}
      onPointerUpCapture={finishDrawingPointer}
      ref={hostRef}
    >
      <ExcalidrawComponent
        key={board.id}
        excalidrawAPI={handleExcalidrawApi}
        initialData={excalidrawInitialData}
        onChange={handleExcalidrawChange}
        onScrollChange={handleScrollChange}
        theme="dark"
      />
    </div>
  );
}
