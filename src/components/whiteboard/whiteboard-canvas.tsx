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
import {
  isWorkspaceMovementActive,
  recordWhiteboardPerformanceDiagnostic,
  workspaceMovementEndEvent,
} from "@/lib/whiteboard-performance-diagnostics";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/whiteboards/whiteboard-limits";
import type { BinderWhiteboard, WhiteboardSceneData } from "@/lib/whiteboards/whiteboard-types";
import { fitAllWhiteboardContent } from "@/lib/whiteboards/whiteboard-navigation";
import { composeWhiteboardSvg, downloadWhiteboardFile, getWhiteboardCanvasBackground } from "@/lib/whiteboards/whiteboard-export";

export type WhiteboardCanvasActions = {
  fitAll: () => void;
  getScene: () => WhiteboardSceneData;
  exportSvg: (moduleText?: Record<string, string>) => Promise<void>;
};

type WhiteboardCanvasProps = {
  board: BinderWhiteboard;
  onSceneChange: (scene: WhiteboardSceneData) => void;
  onViewportChange?: (transform: WhiteboardViewportTransform) => void;
  onViewportRequestReady?: (requestViewport: ((transform: WhiteboardViewportTransform) => void) | null) => void;
  onActionsReady?: (actions: WhiteboardCanvasActions | null) => void;
  fullscreen?: boolean;
};

type ExcalidrawCameraApi = {
  getAppState?: () => unknown;
  updateScene?: (scene: { appState?: Record<string, unknown> }) => void;
  refresh?: () => void;
  getSceneElements?: () => readonly unknown[];
  getFiles?: () => unknown;
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
  onActionsReady,
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
  const latestBoardRef = useRef(board);
  latestBoardRef.current = board;

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

  const emitViewportTransform = useCallback(
    (nextTransform: WhiteboardViewportTransform) => {
      const currentTransform = latestViewportTransformRef.current;
      if (currentTransform && whiteboardViewportTransformsEqual(currentTransform, nextTransform)) {
        return;
      }

      latestViewportTransformRef.current = nextTransform;
      onViewportChange?.(nextTransform);
    },
    [onViewportChange],
  );

  const emitViewportChange = useCallback(
    (appState: unknown) => {
      emitViewportTransform(extractWhiteboardViewportTransform(appState, getViewportSize()));
    },
    [emitViewportTransform, getViewportSize],
  );

  const emitLatestViewportMetrics = useCallback(
    (fallbackAppState: unknown) => {
      const latestTransform = latestViewportTransformRef.current;
      if (!latestTransform) {
        emitViewportChange(fallbackAppState);
        return;
      }

      const size = getViewportSize();
      emitViewportTransform({
        ...latestTransform,
        viewportWidth: size.width,
        viewportHeight: size.height,
        offsetLeft: size.offsetLeft,
        offsetTop: size.offsetTop,
      });
    },
    [emitViewportChange, emitViewportTransform, getViewportSize],
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
    recordWhiteboardPerformanceDiagnostic("excalidraw-refresh", {
      boardId: board.id,
    });
    emitLatestViewportMetrics(api?.getAppState?.() ?? initialData.appState ?? {});
  }, [board.id, emitLatestViewportMetrics, initialData.appState]);

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

    const flushDeferredLayoutRefresh = () => {
      if (!pendingResizeRefreshRef.current || drawingPointerIdsRef.current.size > 0) {
        return;
      }

      pendingResizeRefreshRef.current = false;
      window.requestAnimationFrame(refreshCanvasAfterLayout);
    };
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
    window.addEventListener(workspaceMovementEndEvent, flushDeferredLayoutRefresh);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", finishPointer);
      window.removeEventListener("blur", clearPointers);
      window.removeEventListener("pagehide", flushForPageExit);
      window.removeEventListener(workspaceMovementEndEvent, flushDeferredLayoutRefresh);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [finishDrawingPointerById, flushPendingSceneChange, refreshCanvasAfterLayout]);

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

  useEffect(() => {
    if (!ExcalidrawComponent) return;
    const getScene = () => {
      const api = excalidrawApiRef.current;
      const apiState = api?.getAppState?.() as Record<string, unknown> | undefined;
      // Excalidraw exposes an empty scene before it restores initialData. A
      // pagehide/save/switch during that window must preserve the loaded board.
      if (apiState?.isLoading === true) {
        const stored = latestBoardRef.current.scene;
        return sanitizeExcalidrawInitialData({
          ...stored,
          appState: { ...stored.appState, viewBackgroundColor: getWhiteboardCanvasBackground(stored.appState) },
        });
      }
      const pending = pendingSceneRef.current;
      return sanitizeExcalidrawInitialData({
        elements: api?.getSceneElements?.() ?? pending?.elements ?? latestBoardRef.current.scene.elements,
        appState: { ...latestBoardRef.current.scene.appState, ...(apiState ?? pending?.appState as Record<string, unknown> ?? {}), viewBackgroundColor: getWhiteboardCanvasBackground(apiState ?? latestBoardRef.current.scene.appState) },
        files: api?.getFiles?.() ?? pending?.files ?? latestBoardRef.current.scene.files,
      });
    };
    onActionsReady?.({
      getScene,
      fitAll: () => {
        const current = latestBoardRef.current;
        const viewport = latestViewportTransformRef.current ?? extractWhiteboardViewportTransform(current.scene.appState, getViewportSize());
        const next = fitAllWhiteboardContent({ scene: getScene(), modules: current.modules }, viewport);
        excalidrawApiRef.current?.updateScene?.({ appState: { scrollX: next.scrollX, scrollY: next.scrollY, zoom: { value: next.zoom } } });
        emitViewportTransform(next);
      },
      exportSvg: async (moduleText = {}) => {
        const current = { ...latestBoardRef.current, scene: getScene() };
        const viewport = latestViewportTransformRef.current ?? extractWhiteboardViewportTransform(current.scene.appState, getViewportSize());
        const elements = current.scene.elements.filter((e) => e && typeof e === "object" && !(e as { isDeleted?: boolean }).isDeleted);
        let drawing = null;
        if (elements.length) {
          const { exportToSvg, getCommonBounds } = await import("@excalidraw/excalidraw");
          const args = { elements, appState: { ...current.scene.appState, exportBackground: false, exportWithDarkMode: true }, files: current.scene.files ?? {}, exportPadding: 0 } as Parameters<typeof exportToSvg>[0];
          const svg = await exportToSvg(args);
          const [x, y, right, bottom] = getCommonBounds(args.elements);
          drawing = { svg: svg.outerHTML, frame: { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) } };
        }
        downloadWhiteboardFile(current.title, "svg", composeWhiteboardSvg(current, viewport, drawing, moduleText), "image/svg+xml;charset=utf-8");
      },
    });
    return () => onActionsReady?.(null);
  }, [ExcalidrawComponent, emitViewportTransform, getViewportSize, onActionsReady]);

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
    // Saved appState is only the initial camera. Module saves contain snapshots
    // that can lag behind an ongoing pan; replaying them made cards jump back.
    emitViewportChange(excalidrawApiRef.current?.getAppState?.() ?? initialData.appState ?? {});
  }, [board.id, emitViewportChange]);

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

      if (drawingPointerIdsRef.current.size > 0 || isWorkspaceMovementActive()) {
        pendingResizeRefreshRef.current = true;
        recordWhiteboardPerformanceDiagnostic("excalidraw-refresh-deferred", {
          boardId: board.id,
          reason: drawingPointerIdsRef.current.size > 0 ? "drawing-pointer" : "workspace-movement",
        });
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
        ...(initialData.appState ?? {}),
        viewBackgroundColor: getWhiteboardCanvasBackground(initialData.appState),
        exportWithDarkMode: true,
        exportBackground: true,
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
        UIOptions={{ canvasActions: { export: { saveFileToDisk: true }, saveAsImage: true } }}
        theme="dark"
      />
    </div>
  );
}
