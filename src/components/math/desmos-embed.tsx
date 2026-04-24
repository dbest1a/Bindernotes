import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import {
  getDesmosGraphingConstructor,
  hasDesmosApiKey,
  isDeployedClient,
  isDesmosFeatureEnabled,
  loadDesmosApi,
} from "@/lib/desmos-loader";
import { cn } from "@/lib/utils";

type GraphExpressionRequest = {
  id: string;
  latex: string;
};

type GraphLoadRequest = {
  id: string;
  expressions: string[];
  viewport?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
};

export type DesmosEmbedStatus =
  | "missing-key"
  | "loading-script"
  | "waiting-for-layout"
  | "initializing"
  | "ready"
  | "unsupported"
  | "initialization-failed";

type DesmosSurfaceProps = {
  className?: string;
  fallback?: ReactNode;
  height?: string;
  kind: "graphing" | "graphing-3d" | "scientific";
  loadRequest?: GraphLoadRequest | null;
  onLoadApplied?: (id: string) => void;
  onExpressionApplied?: (id: string) => void;
  onStateChange?: (state: DesmosState) => void;
  pendingExpression?: GraphExpressionRequest | null;
  state?: DesmosState | null;
};

export const DesmosSurface = memo(function DesmosSurface({
  className,
  fallback,
  height = "clamp(540px, 72vh, 760px)",
  kind,
  loadRequest,
  onLoadApplied,
  onExpressionApplied,
  onStateChange,
  pendingExpression,
  state,
}: DesmosSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const calculatorRef = useRef<DesmosBaseCalculator | null>(null);
  const lastAppliedExpressionIdRef = useRef<string | null>(null);
  const lastAppliedLoadIdRef = useRef<string | null>(null);
  const lastSerializedStateRef = useRef<string>("");
  const latestStateRef = useRef<DesmosState | null>(state ?? null);
  const throttleRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const layoutObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  const onExpressionAppliedRef = useRef(onExpressionApplied);
  const onLoadAppliedRef = useRef(onLoadApplied);
  const [darkMode, setDarkMode] = useState(() =>
    typeof document !== "undefined" ? resolveDesmosDarkMode(document.documentElement) : false,
  );
  const [graphChrome, setGraphChrome] = useState<"standard" | "focused">(() =>
    typeof document !== "undefined" ? resolveGraphChrome(document.documentElement) : "standard",
  );
  const [status, setStatus] = useState<DesmosEmbedStatus>(
    hasDesmosApiKey() ? "loading-script" : "missing-key",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onExpressionAppliedRef.current = onExpressionApplied;
  }, [onExpressionApplied]);

  useEffect(() => {
    onLoadAppliedRef.current = onLoadApplied;
  }, [onLoadApplied]);

  useEffect(() => {
    latestStateRef.current = state ?? null;
  }, [state]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const syncTheme = () => {
      setDarkMode(resolveDesmosDarkMode(root));
      setGraphChrome(resolveGraphChrome(root));
    };
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-workspace-theme", "data-workspace-graph-appearance", "data-workspace-graph-chrome"],
    });
    syncTheme();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasDesmosApiKey()) {
      setStatus("missing-key");
      setErrorMessage(null);
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      try {
        setStatus("loading-script");
        setErrorMessage(null);
        const Desmos = await loadDesmosApi();
        if (cancelled) {
          return;
        }

        const container = containerRef.current;
        if (!container) {
          throw new Error("Calculator container was not available during initialization.");
        }

        setStatus("waiting-for-layout");
        await waitForRenderableLayout(container, () => cancelled);
        if (cancelled) {
          return;
        }

        setStatus("initializing");
        const calculator = createDesmosCalculator(kind, Desmos, container, {
          darkMode,
          graphChrome,
        });
        calculatorRef.current = calculator;

        if (isGraphingCalculator(calculator) && latestStateRef.current) {
          calculator.setState(latestStateRef.current);
          lastSerializedStateRef.current = safeSerialize(latestStateRef.current);
        } else {
          lastSerializedStateRef.current = "";
        }

        if (isGraphingCalculator(calculator)) {
          calculator.observeEvent("change", () => {
            if (throttleRef.current) {
              window.clearTimeout(throttleRef.current);
            }

            throttleRef.current = window.setTimeout(() => {
              if (!calculatorRef.current || !isGraphingCalculator(calculatorRef.current)) {
                return;
              }

              const nextState = calculatorRef.current.getState();
              lastSerializedStateRef.current = safeSerialize(nextState);
              onStateChangeRef.current?.(nextState);
            }, 250);
          });
        }

        if (typeof ResizeObserver !== "undefined") {
          resizeObserverRef.current = new ResizeObserver(() => {
            calculator.resize();
          });
          resizeObserverRef.current.observe(container);
        }

        requestAnimationFrame(() => calculator.resize());
        setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Desmos could not initialize.";
          setErrorMessage(message);
          if (message === "missing-key") {
            setStatus("missing-key");
          } else if (message === "unsupported") {
            setStatus("unsupported");
          } else {
            setStatus("initialization-failed");
          }
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
      if (throttleRef.current) {
        window.clearTimeout(throttleRef.current);
      }
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      resizeObserverRef.current?.disconnect();
      layoutObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      layoutObserverRef.current = null;

      if (calculatorRef.current) {
        if (isGraphingCalculator(calculatorRef.current)) {
          calculatorRef.current.unobserveEvent("change");
        }
        calculatorRef.current.destroy();
        calculatorRef.current = null;
      }
    };
  }, [kind]);

  useEffect(() => {
    if (status !== "ready" || !calculatorRef.current?.updateSettings) {
      return;
    }

    calculatorRef.current.updateSettings({
      invertedColors: darkMode,
      ...(kind === "graphing" || kind === "graphing-3d"
        ? {
            expressionsCollapsed: graphChrome === "focused",
            settingsMenu: graphChrome === "standard",
            zoomButtons: graphChrome === "standard",
          }
        : {}),
    });
    calculatorRef.current.resize();
  }, [darkMode, graphChrome, kind, status]);

  useEffect(() => {
    if (!calculatorRef.current || !isGraphingCalculator(calculatorRef.current)) {
      return;
    }

    if (!state) {
      if (lastSerializedStateRef.current) {
        calculatorRef.current.setBlank();
        lastSerializedStateRef.current = "";
      }
      return;
    }

    const serialized = safeSerialize(state);
    if (serialized === lastSerializedStateRef.current) {
      return;
    }

    calculatorRef.current.setState(state, { allowUndo: true });
    lastSerializedStateRef.current = serialized;
  }, [state]);

  useEffect(() => {
    if (
      !calculatorRef.current ||
      !isGraphingCalculator(calculatorRef.current) ||
      !loadRequest ||
      status !== "ready"
    ) {
      return;
    }

    if (lastAppliedLoadIdRef.current === loadRequest.id) {
      return;
    }

    const graphingCalculator = calculatorRef.current;
    graphingCalculator.setBlank({ allowUndo: true });
    loadRequest.expressions.forEach((expression, index) => {
      graphingCalculator.setExpression({
        id: `lesson-ref-${index + 1}`,
        latex: expression,
      });
    });
    if (loadRequest.viewport && "setMathBounds" in graphingCalculator) {
      graphingCalculator.setMathBounds({
        left: loadRequest.viewport.xMin,
        right: loadRequest.viewport.xMax,
        bottom: loadRequest.viewport.yMin,
        top: loadRequest.viewport.yMax,
      });
    }

    const nextState = graphingCalculator.getState();
    lastSerializedStateRef.current = safeSerialize(nextState);
    lastAppliedLoadIdRef.current = loadRequest.id;
    onStateChangeRef.current?.(nextState);
    onLoadAppliedRef.current?.(loadRequest.id);
  }, [loadRequest, status]);

  useEffect(() => {
    if (
      !calculatorRef.current ||
      !isGraphingCalculator(calculatorRef.current) ||
      !pendingExpression ||
      status !== "ready"
    ) {
      return;
    }

    if (lastAppliedExpressionIdRef.current === pendingExpression.id) {
      return;
    }

    calculatorRef.current.setExpression({
      id: pendingExpression.id,
      latex: pendingExpression.latex,
    });
    lastAppliedExpressionIdRef.current = pendingExpression.id;
    onExpressionAppliedRef.current?.(pendingExpression.id);
  }, [pendingExpression, status]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/70 bg-card",
        className,
      )}
      data-desmos-status={status}
      style={{ height }}
    >
      <div
        className="h-full min-h-0 w-full"
        data-desmos-canvas={kind}
        ref={containerRef}
      />
      {status !== "ready" ? (
        <StatusOverlay
          errorMessage={errorMessage}
          fallback={fallback}
          kind={kind}
          status={status}
        />
      ) : null}
    </div>
  );
});

function createDesmosCalculator(
  kind: "graphing" | "graphing-3d" | "scientific",
  api: DesmosApi,
  container: HTMLElement,
  preferences: {
    darkMode: boolean;
    graphChrome: "standard" | "focused";
  },
) {
  if (kind === "graphing") {
    const graphingCalculator = getDesmosGraphingConstructor(api);
    if (
      !isDesmosFeatureEnabled(api, "GraphingCalculator") ||
      !graphingCalculator
    ) {
      throw new Error("unsupported");
    }

    return graphingCalculator(container, {
      autosize: true,
      border: false,
      expressions: true,
      expressionsCollapsed: preferences.graphChrome === "focused",
      folders: true,
      invertedColors: preferences.darkMode,
      keypad: true,
      notes: true,
      projectorMode: false,
      settingsMenu: preferences.graphChrome === "standard",
      sliders: true,
      zoomButtons: preferences.graphChrome === "standard",
    });
  }

  if (kind === "graphing-3d") {
    if (
      !api.Calculator3D ||
      !isDesmosFeatureEnabled(api, "Calculator3D") ||
      typeof api.Calculator3D !== "function"
    ) {
      throw new Error("unsupported");
    }

    return api.Calculator3D(container, {
      autosize: true,
      border: false,
      expressions: true,
      expressionsCollapsed: preferences.graphChrome === "focused",
      folders: true,
      invertedColors: preferences.darkMode,
      keypad: true,
      notes: true,
      projectorMode: false,
      settingsMenu: preferences.graphChrome === "standard",
      sliders: true,
      zoomButtons: preferences.graphChrome === "standard",
    });
  }

  if (
    !api.ScientificCalculator ||
    !isDesmosFeatureEnabled(api, "ScientificCalculator") ||
    typeof api.ScientificCalculator !== "function"
  ) {
    throw new Error("unsupported");
  }

  return api.ScientificCalculator(container, {
    autosize: true,
    border: false,
    invertedColors: preferences.darkMode,
    keypad: true,
  });
}

function resolveDesmosDarkMode(root: HTMLElement) {
  const graphAppearance = root.dataset.workspaceGraphAppearance;
  if (graphAppearance === "light") {
    return false;
  }
  if (graphAppearance === "dark") {
    return true;
  }
  return root.classList.contains("dark");
}

function resolveGraphChrome(root: HTMLElement) {
  return root.dataset.workspaceGraphChrome === "focused" ? "focused" : "standard";
}

function StatusOverlay({
  errorMessage,
  fallback,
  kind,
  status,
}: {
  errorMessage: string | null;
  fallback?: ReactNode;
  kind: "graphing" | "graphing-3d" | "scientific";
  status: DesmosEmbedStatus;
}) {
  if (status === "missing-key") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-secondary/92 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-3 size-8 text-primary" />
          <h3 className="text-lg font-semibold tracking-tight">Desmos key needed</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isDeployedClient()
              ? "This deployed build was published without VITE_DESMOS_API_KEY. Add it in Vercel project environment variables, then redeploy so Desmos is bundled into the client build."
              : "Add VITE_DESMOS_API_KEY to your local environment and restart the dev server to enable Desmos tools."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className="absolute inset-0 overflow-auto bg-secondary/94 p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-3 size-8 text-primary" />
            <h3 className="text-lg font-semibold tracking-tight">
              {kind === "scientific"
              ? "Scientific calculator is not enabled"
              : kind === "graphing-3d"
                ? "Desmos 3D is not enabled"
                : "This Desmos tool is not enabled"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This API key does not currently allow the requested Desmos calculator. Binder Notes
              can fall back to a local numeric tool instead.
            </p>
          </div>
          {fallback}
        </div>
      </div>
    );
  }

  if (status === "initialization-failed") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-secondary/92 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-3 size-8 text-primary" />
          <h3 className="text-lg font-semibold tracking-tight">Desmos could not load</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {errorMessage ?? "Check your network connection and confirm the Desmos API key is valid."}
          </p>
        </div>
      </div>
    );
  }

  const message =
    status === "loading-script"
      ? "Loading Desmos..."
      : status === "waiting-for-layout"
        ? "Preparing the graphing canvas..."
        : "Initializing calculator...";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-card/88 p-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        {message}
      </div>
    </div>
  );
}

function waitForRenderableLayout(
  element: HTMLElement,
  isCancelled: () => boolean,
) {
  if (hasRenderableLayout(element)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let resizeObserver: ResizeObserver | null = null;
    let rafId: number | null = null;

    const cleanup = () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };

    const check = () => {
      if (isCancelled()) {
        cleanup();
        reject(new Error("cancelled"));
        return;
      }

      if (hasRenderableLayout(element)) {
        cleanup();
        resolve();
        return;
      }

      rafId = window.requestAnimationFrame(check);
    };

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (hasRenderableLayout(element)) {
          cleanup();
          resolve();
        }
      });
      resizeObserver.observe(element);
    }

    check();
  });
}

function hasRenderableLayout(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isGraphingCalculator(
  calculator: DesmosBaseCalculator | null,
): calculator is DesmosGraphingCalculator {
  return Boolean(
    calculator &&
      "getState" in calculator &&
      "setBlank" in calculator &&
      "setExpression" in calculator,
  );
}

function safeSerialize(state: DesmosState) {
  try {
    return JSON.stringify(state);
  } catch {
    return "";
  }
}
