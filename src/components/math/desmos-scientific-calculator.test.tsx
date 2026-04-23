// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesmosScientificCalculator } from "@/components/math/desmos-scientific-calculator";
import * as desmosLoader from "@/lib/desmos-loader";

vi.mock("@/lib/desmos-loader", () => ({
  hasDesmosApiKey: vi.fn(),
  isDesmosFeatureEnabled: vi.fn((_api: unknown, feature: string) => feature === "ScientificCalculator"),
  loadDesmosApi: vi.fn(),
}));

describe("DesmosScientificCalculator", () => {
  beforeEach(() => {
    vi.mocked(desmosLoader.hasDesmosApiKey).mockReturnValue(true);
    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 560,
      height: 560,
      left: 0,
      right: 420,
      toJSON: () => ({}),
      top: 0,
      width: 420,
      x: 0,
      y: 0,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the real Desmos scientific calculator when the API key supports it", async () => {
    const scientificCalculator = {
      destroy: vi.fn(),
      resize: vi.fn(),
    } as unknown as DesmosScientificCalculatorApi;

    const ScientificCalculator = vi.fn(() => scientificCalculator);
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({
      enabledFeatures: {
        ScientificCalculator: true,
      },
      ScientificCalculator,
    } as unknown as DesmosApi);

    render(<DesmosScientificCalculator />);

    await waitFor(() => expect(ScientificCalculator).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/scientific calculator is not enabled/i)).toBeNull();
  });

  it("renders a clear fallback state when scientific calculator support is unavailable", async () => {
    vi.mocked(desmosLoader.loadDesmosApi).mockResolvedValue({
      enabledFeatures: {
        ScientificCalculator: false,
      },
    } as unknown as DesmosApi);

    render(<DesmosScientificCalculator />);

    expect(await screen.findByText(/scientific calculator is not enabled/i)).toBeTruthy();
  });
});
