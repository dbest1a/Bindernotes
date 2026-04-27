import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import {
  extractWhiteboardViewportTransform,
  whiteboardViewportTransformsEqual,
  type WhiteboardViewportTransform,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import { sanitizeExcalidrawInitialData } from "@/lib/whiteboards/whiteboard-serialization";
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
  const initialData = sanitizeExcalidrawInitialData(board.scene);

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
      onViewportRequestReady?.(null);
    },
    [onViewportRequestReady],
  );

  useEffect(() => {
    let active = true;

    const watchCamera = () => {
      if (!active) {
        return;
      }

      const appState = excalidrawApiRef.current?.getAppState?.();
      if (appState) {
        emitViewportChange(appState);
      }
    };

    watchCamera();
    const intervalId = window.setInterval(watchCamera, 16);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [emitViewportChange]);

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
      data-fullscreen-whiteboard={fullscreen ? "true" : "false"}
      data-testid="whiteboard-excalidraw-host"
      ref={hostRef}
    >
      <ExcalidrawComponent
        key={board.id}
        initialData={{
          elements: initialData.elements as never[],
          appState: {
            viewBackgroundColor: "#11131a",
            ...(initialData.appState ?? {}),
          },
          files: (initialData.files ?? {}) as never,
        }}
          onChange={(elements: readonly unknown[], appState: unknown, files: unknown) => {
            emitViewportChange(appState as Record<string, unknown>);
            const scene = sanitizeExcalidrawInitialData({
              elements: elements as unknown[],
              appState,
              files,
            });
            onSceneChange(scene);
          }}
          onScrollChange={handleScrollChange}
          excalidrawAPI={handleExcalidrawApi}
          theme="dark"
        />
    </div>
  );
}
