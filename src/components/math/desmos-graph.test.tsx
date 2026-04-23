// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesmosGraph } from "@/components/math/desmos-graph";
import * as desmosLoader from "@/lib/desmos-loader";

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
    vi.mocked(desmosLoader.hasDesmosApiKey).mockReturnValue(true);
    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("initializes the graphing calculator once the loader resolves", async () => {
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
});
