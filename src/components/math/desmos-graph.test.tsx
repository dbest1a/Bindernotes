// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Desmos3DGraph, DesmosGraph } from "@/components/math/desmos-graph";
import * as desmosLoader from "@/lib/desmos-loader";
import { setWorkspaceMovementActive } from "@/lib/whiteboard-performance-diagnostics";
import { useMathWorkspace } from "@/hooks/use-math-workspace";

vi.mock("@/lib/desmos-loader", () => ({
  getDesmosGraphingConstructor: vi.fn((api: DesmosApi) =>
    typeof api.GraphingCalculator === "function"
      ? api.GraphingCalculator
      : typeof api.Calculator === "function"
        ? api.Calculator
        : null,
  ),
  hasDesmosApiKey: vi.fn(),
  isDesmosFeatureEnabled: vi.fn(() => true),
  loadDesmosApi: vi.fn(),
}));

describe("DesmosGraph", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(desmosLoader.hasDesmosApiKey).mockReturnValue(true);
    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    document.documentElement.dataset.betaDesmosV2 = "false";
    document.documentElement.dataset.workspaceDragging = "false";
  });

  it("initializes the graphing calculator once the loader resolves", async () => {
    const resize = vi.fn();
    const calculator = {
      destroy: vi.fn(),
      getState: vi.fn(() => ({ expressions: { list: [] } })),
      observeEvent: vi.fn(),
      resize,
      setBlank: vi.fn(),
      setExpression: vi.fn(),
      setState: vi.fn(),
      unobserveEvent: vi.fn(),
    } as unknown as DesmosGraphingCalculator;

    const GraphingCalculator = vi.fn(() => calculator);
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({
      GraphingCalculator,
    } as DesmosApi);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 540,
      height: 540,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    }));

    render(<DesmosGraph onStateChange={vi.fn()} state={null} />);

    expect(screen.getByText(/loading desmos/i)).toBeTruthy();

    await waitFor(() => expect(GraphingCalculator).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText(/loading desmos/i)).toBeNull(),
    );
  });

  it("updates keypad settings without remounting the graphing calculator", async () => {
    const resize = vi.fn();
    const calculator = {
      destroy: vi.fn(),
      getState: vi.fn(() => ({ expressions: { list: [] } })),
      observeEvent: vi.fn(),
      resize,
      setBlank: vi.fn(),
      setExpression: vi.fn(),
      setState: vi.fn(),
      unobserveEvent: vi.fn(),
      updateSettings: vi.fn(),
    } as unknown as DesmosGraphingCalculator;

    const GraphingCalculator = vi.fn(() => calculator);
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({
      GraphingCalculator,
    } as DesmosApi);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 540,
      height: 540,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    }));

    const { rerender } = render(<DesmosGraph onStateChange={vi.fn()} showKeypad={false} state={null} />);

    await waitFor(() => expect(GraphingCalculator).toHaveBeenCalledTimes(1));
    expect(GraphingCalculator).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ keypad: false }),
    );

    rerender(<DesmosGraph onStateChange={vi.fn()} showKeypad state={null} />);

    await waitFor(() => expect(calculator.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ keypad: true })));
    expect(GraphingCalculator).toHaveBeenCalledTimes(1);
    expect(calculator.destroy).not.toHaveBeenCalled();
  });

  it("waits for a measurable container before initializing the calculator", async () => {
    const calculator = {
      destroy: vi.fn(),
      getState: vi.fn(() => ({ expressions: { list: [] } })),
      observeEvent: vi.fn(),
      resize: vi.fn(),
      setBlank: vi.fn(),
      setExpression: vi.fn(),
      setState: vi.fn(),
      unobserveEvent: vi.fn(),
    } as unknown as DesmosGraphingCalculator;

    const GraphingCalculator = vi.fn(() => calculator);
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({
      GraphingCalculator,
      enabledFeatures: {
        GraphingCalculator: true,
      },
    } as unknown as DesmosApi);

    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        toJSON: () => ({}),
        top: 0,
        width: 0,
        x: 0,
        y: 0,
      }));

    render(<DesmosGraph onStateChange={vi.fn()} state={null} />);

    await waitFor(() => expect(desmosLoader.loadDesmosApi).toHaveBeenCalledTimes(1));
    expect(GraphingCalculator).not.toHaveBeenCalled();
    expect(screen.getByText(/preparing the graphing canvas/i)).toBeTruthy();

    rectSpy.mockImplementation(() => ({
      bottom: 540,
      height: 540,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    }));

    await waitFor(() => expect(GraphingCalculator).toHaveBeenCalledTimes(1));
  });

  it("renders a real error state when the loader fails", async () => {
    vi.mocked(desmosLoader.loadDesmosApi).mockRejectedValue(new Error("failed"));

    render(<DesmosGraph onStateChange={vi.fn()} state={null} />);

    expect(screen.getByText(/loading desmos/i)).toBeTruthy();
    expect(await screen.findByText(/desmos could not load/i)).toBeTruthy();
  });

  it("shows an unsupported state instead of calling a missing graphing constructor", async () => {
    vi.mocked(desmosLoader.isDesmosFeatureEnabled).mockReturnValue(false);
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({
      enabledFeatures: {
        GraphingCalculator: true,
      },
    } as unknown as DesmosApi);

    render(<DesmosGraph onStateChange={vi.fn()} state={null} />);

    expect(await screen.findByText(/this desmos tool is not enabled/i)).toBeTruthy();
  });

  it("initializes the graphing calculator through the legacy Calculator alias when GraphingCalculator is absent", async () => {
    const calculator = {
      destroy: vi.fn(),
      getState: vi.fn(() => ({ expressions: { list: [] } })),
      observeEvent: vi.fn(),
      resize: vi.fn(),
      setBlank: vi.fn(),
      setExpression: vi.fn(),
      setState: vi.fn(),
      unobserveEvent: vi.fn(),
    } as unknown as DesmosGraphingCalculator;

    const Calculator = vi.fn(() => calculator);
    vi.mocked(desmosLoader.isDesmosFeatureEnabled).mockImplementation(
      (api, feature) =>
        feature === "GraphingCalculator" &&
        Boolean((api as DesmosApi).enabledFeatures?.GraphingCalculator),
    );
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({
      Calculator,
      enabledFeatures: {
        GraphingCalculator: true,
      },
      GraphingCalculator: undefined,
    } as unknown as DesmosApi);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 540,
      height: 540,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    }));

    render(<DesmosGraph onStateChange={vi.fn()} state={null} />);

    await waitFor(() => expect(Calculator).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText(/this desmos tool is not enabled/i)).toBeNull(),
    );
  });

  it("shows a safe fallback when Desmos 3D is unavailable", async () => {
    vi.mocked(desmosLoader.isDesmosFeatureEnabled).mockImplementation(
      (_api, feature) => feature !== "Calculator3D",
    );
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({
      GraphingCalculator: vi.fn(),
      enabledFeatures: {
        Calculator3D: false,
      },
    } as unknown as DesmosApi);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 540,
      height: 540,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    }));

    render(<Desmos3DGraph onStateChange={vi.fn()} state={null} />);

    expect(await screen.findByText(/desmos 3d is not enabled/i)).toBeTruthy();
  });

  it("adds a stable Desmos V2 instance marker and defers resize while workspace movement is active", async () => {
    const resizeCallbacks: ResizeObserverCallback[] = [];
    class ResizeObserverWithCallback {
      observe = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverWithCallback);
    const resize = vi.fn();
    const calculator = {
      destroy: vi.fn(),
      getState: vi.fn(() => ({ expressions: { list: [] } })),
      observeEvent: vi.fn(),
      resize,
      setBlank: vi.fn(),
      setExpression: vi.fn(),
      setState: vi.fn(),
      unobserveEvent: vi.fn(),
    } as unknown as DesmosGraphingCalculator;

    const GraphingCalculator = vi.fn(() => calculator);
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({
      GraphingCalculator,
    } as DesmosApi);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 540,
      height: 540,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    }));
    document.documentElement.dataset.betaDesmosV2 = "true";
    document.documentElement.dataset.workspaceDragging = "true";

    const { container } = render(<DesmosGraph onStateChange={vi.fn()} state={null} />);

    await waitFor(() => expect(GraphingCalculator).toHaveBeenCalledTimes(1));
    const surface = container.querySelector("[data-desmos-instance-id]");
    expect(surface?.getAttribute("data-desmos-instance-id")).toMatch(/^desmos-v2-/);
    vi.useFakeTimers();
    resize.mockClear();

    resizeCallbacks.at(-1)?.(
      [
        {
          contentRect: {
            width: 720,
            height: 480,
          },
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
    vi.advanceTimersByTime(250);
    expect(resize).not.toHaveBeenCalled();

    document.documentElement.dataset.workspaceDragging = "false";
    window.dispatchEvent(new CustomEvent("bindernotes:workspace-movement-end"));
    vi.advanceTimersByTime(250);

    expect(resize).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])("defers an already queued resize through a gesture (start event: %s) and resizes once afterward", async (dispatchStartEvent) => {
    let observeResize: ResizeObserverCallback | undefined;
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { observeResize = callback; }
      observe = vi.fn();
      disconnect = vi.fn();
    });
    const calculator = {
      destroy: vi.fn(), getState: vi.fn(() => ({ expressions: { list: [] } })),
      observeEvent: vi.fn(), resize: vi.fn(), setBlank: vi.fn(), setExpression: vi.fn(),
      setState: vi.fn(), unobserveEvent: vi.fn(), updateSettings: vi.fn(),
    };
    const GraphingCalculator = vi.fn(() => calculator as unknown as DesmosGraphingCalculator);
    vi.mocked(desmosLoader.isDesmosFeatureEnabled).mockReturnValue(true);
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({ GraphingCalculator } as DesmosApi);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 540, width: 640, height: 540, toJSON: () => ({}) });
    const onStateChange = vi.fn();
    const { rerender } = render(<DesmosGraph onStateChange={onStateChange} showKeypad={false} state={null} />);
    await waitFor(() => expect(calculator.resize).toHaveBeenCalled());
    expect(GraphingCalculator).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ autosize: false }));
    calculator.resize.mockClear();
    vi.useFakeTimers();
    const resizeHost = (width: number, height: number) => observeResize?.([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);

    resizeHost(720, 480);
    act(() => vi.advanceTimersByTime(40));
    if (dispatchStartEvent) setWorkspaceMovementActive(true);
    else document.documentElement.dataset.workspaceDragging = "true";
    act(() => vi.advanceTimersByTime(200));
    expect(calculator.resize).not.toHaveBeenCalled();

    // Host resize and preference changes during a drag must join the same work.
    resizeHost(780, 510);
    resizeHost(820, 550);
    rerender(<DesmosGraph onStateChange={onStateChange} showKeypad state={null} />);
    act(() => vi.advanceTimersByTime(200));
    expect(calculator.resize).not.toHaveBeenCalled();
    setWorkspaceMovementActive(false);
    act(() => vi.advanceTimersByTime(39));
    expect(calculator.resize).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(calculator.resize).toHaveBeenCalledTimes(1);

    resizeHost(820, 550);
    setWorkspaceMovementActive(true);
    setWorkspaceMovementActive(false);
    act(() => vi.advanceTimersByTime(200));
    expect(calculator.resize).toHaveBeenCalledTimes(1);
    expect(GraphingCalculator).toHaveBeenCalledTimes(1);
    expect(calculator.destroy).not.toHaveBeenCalled();
    expect(calculator.setState).not.toHaveBeenCalled();
  });

  it("retains Desmos automatic sizing when ResizeObserver is unavailable", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const calculator = {
      destroy: vi.fn(), getState: vi.fn(() => ({})), observeEvent: vi.fn(), resize: vi.fn(),
      setBlank: vi.fn(), setExpression: vi.fn(), setState: vi.fn(), unobserveEvent: vi.fn(),
    };
    const GraphingCalculator = vi.fn(() => calculator as unknown as DesmosGraphingCalculator);
    vi.mocked(desmosLoader.isDesmosFeatureEnabled).mockReturnValue(true);
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({ GraphingCalculator } as DesmosApi);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 540, width: 640, height: 540, toJSON: () => ({}) });
    render(<DesmosGraph state={null} />);
    await waitFor(() => expect(GraphingCalculator).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ autosize: true })));
  });

  it.each(["collapse", "pin-layer"])("keeps the final viewport when a graph closes before its debounce (%s)", async (action) => {
    const instances: Array<{ currentState: DesmosState; change?: () => void; api: DesmosGraphingCalculator }> = [];
    const initial = { graph: { viewport: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 } }, expressions: { list: [{ id: "a", latex: "y=x^2" }] } };
    const panned = { ...initial, graph: { viewport: { xmin: 5, xmax: 25, ymin: 3, ymax: 23 } } };
    const GraphingCalculator = vi.fn(() => {
      const instance = { currentState: initial as DesmosState, change: undefined as (() => void) | undefined, api: null as unknown as DesmosGraphingCalculator };
      instance.api = {
        destroy: vi.fn(), resize: vi.fn(), setBlank: vi.fn(), setExpression: vi.fn(),
        getState: () => structuredClone(instance.currentState),
        setState: vi.fn((state: DesmosState) => { instance.currentState = structuredClone(state); }),
        observeEvent: vi.fn((_name: "change", callback: (name: "change", event: DesmosChangeEvent) => void) => { instance.change = () => callback("change", { isUserInitiated: true }); }),
        unobserveEvent: vi.fn(),
      } as unknown as DesmosGraphingCalculator;
      instances.push(instance);
      return instance.api;
    });
    vi.mocked(desmosLoader.isDesmosFeatureEnabled).mockReturnValue(true);
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({ GraphingCalculator } as DesmosApi);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 540, width: 640, height: 540, toJSON: () => ({}) });
    function ScopedGraph({ visible = true }: { visible?: boolean }) {
      const controller = useMathWorkspace("graph-owner", "graph-card");
      return visible ? <DesmosGraph onStateChange={controller.setCurrentGraphState} state={controller.state.currentGraphState} /> : null;
    }
    function Card({ phase }: { phase: "initial" | "closed" | "reopened" }) {
      if (action === "collapse") return <ScopedGraph visible={phase !== "closed"} />;
      return <><div>{phase === "initial" ? <ScopedGraph /> : null}</div><div>{phase !== "initial" ? <ScopedGraph /> : null}</div></>;
    }
    const { rerender } = render(<Card phase="initial" />);
    await waitFor(() => expect(instances).toHaveLength(1));
    instances[0].currentState = panned;
    act(() => instances[0].change?.());
    // No 250 ms wait: the outgoing runtime must flush before destruction.
    rerender(<Card phase="closed" />);
    expect(JSON.parse(localStorage.getItem("binder-notes:math-lab:v3:graph-owner:graph-card")!).graphStatesByMode["2d"]).toEqual(panned);
    expect(instances[0].api.destroy).toHaveBeenCalledTimes(1);
    rerender(<Card phase="reopened" />);
    await waitFor(() => expect(instances).toHaveLength(2));
    await waitFor(() => expect(instances[1].currentState).toEqual(panned));
  });
});
