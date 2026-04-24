// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { getDesmosGraphingConstructor, isDesmosFeatureEnabled } from "@/lib/desmos-loader";

describe("isDesmosFeatureEnabled", () => {
  it("requires a callable graphing constructor even when enabledFeatures says graphing is enabled", () => {
    const api = {
      enabledFeatures: {
        GraphingCalculator: true,
      },
      GraphingCalculator: undefined,
    } as unknown as DesmosApi;

    expect(isDesmosFeatureEnabled(api, "GraphingCalculator")).toBe(false);
  });

  it("requires a callable scientific constructor even when enabledFeatures says scientific is enabled", () => {
    const api = {
      enabledFeatures: {
        ScientificCalculator: true,
      },
      ScientificCalculator: undefined,
    } as unknown as DesmosApi;

    expect(isDesmosFeatureEnabled(api, "ScientificCalculator")).toBe(false);
  });

  it("returns true when graphing is enabled and the graphing constructor exists", () => {
    const api = {
      enabledFeatures: {
        GraphingCalculator: true,
      },
      GraphingCalculator: () => ({
        destroy: () => undefined,
        getState: () => ({}),
        observeEvent: () => undefined,
        resize: () => undefined,
        setBlank: () => undefined,
        setExpression: () => undefined,
        setState: () => undefined,
        unobserveEvent: () => undefined,
      }),
    } as unknown as DesmosApi;

    expect(isDesmosFeatureEnabled(api, "GraphingCalculator")).toBe(true);
  });

  it("requires a callable 3D constructor when Calculator3D is enabled", () => {
    const api = {
      enabledFeatures: {
        Calculator3D: true,
      },
      Calculator3D: undefined,
      GraphingCalculator: () => ({
        destroy: () => undefined,
        getState: () => ({}),
        observeEvent: () => undefined,
        resize: () => undefined,
        setBlank: () => undefined,
        setExpression: () => undefined,
        setState: () => undefined,
        unobserveEvent: () => undefined,
      }),
    } as unknown as DesmosApi;

    expect(isDesmosFeatureEnabled(api, "Calculator3D")).toBe(false);
  });

  it("returns true when 3D is enabled and the 3D constructor exists", () => {
    const api = {
      enabledFeatures: {
        Calculator3D: true,
      },
      Calculator3D: () => ({
        destroy: () => undefined,
        getState: () => ({}),
        observeEvent: () => undefined,
        resize: () => undefined,
        setBlank: () => undefined,
        setExpression: () => undefined,
        setState: () => undefined,
        unobserveEvent: () => undefined,
      }),
      GraphingCalculator: () => ({
        destroy: () => undefined,
        getState: () => ({}),
        observeEvent: () => undefined,
        resize: () => undefined,
        setBlank: () => undefined,
        setExpression: () => undefined,
        setState: () => undefined,
        unobserveEvent: () => undefined,
      }),
    } as unknown as DesmosApi;

    expect(isDesmosFeatureEnabled(api, "Calculator3D")).toBe(true);
  });

  it("accepts the legacy Calculator alias as the graphing constructor", () => {
    const calculator = () => ({
      destroy: () => undefined,
      getState: () => ({}),
      observeEvent: () => undefined,
      resize: () => undefined,
      setBlank: () => undefined,
      setExpression: () => undefined,
      setState: () => undefined,
      unobserveEvent: () => undefined,
    });

    const api = {
      enabledFeatures: {
        GraphingCalculator: true,
      },
      Calculator: calculator,
      GraphingCalculator: undefined,
    } as unknown as DesmosApi;

    expect(getDesmosGraphingConstructor(api)).toBe(calculator);
    expect(isDesmosFeatureEnabled(api, "GraphingCalculator")).toBe(true);
  });
});

describe("loadDesmosApi", () => {
  afterEach(() => {
    delete (window as Window & { Desmos?: DesmosApi }).Desmos;
    document.head.innerHTML = "";
    vi.unstubAllEnvs();
  });

  it("waits for the shared script promise instead of returning a partial window.Desmos object", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DESMOS_API_KEY", "test-desmos-key");

    const { loadDesmosApi } = await import("@/lib/desmos-loader");
    const firstPromise = loadDesmosApi();

    (window as Window & { Desmos?: DesmosApi }).Desmos = {
      enabledFeatures: {
        GraphingCalculator: true,
        ScientificCalculator: true,
      },
    } as DesmosApi;

    const secondPromise = loadDesmosApi();
    let settledEarly = false;
    secondPromise.then(() => {
      settledEarly = true;
    });
    await Promise.resolve();
    expect(settledEarly).toBe(false);

    const script = document.getElementById("binder-notes-desmos-api") as HTMLScriptElement | null;
    expect(script).not.toBeNull();

    const readyApi = {
      enabledFeatures: {
        GraphingCalculator: true,
        ScientificCalculator: true,
      },
      GraphingCalculator: () => ({
        destroy: () => undefined,
        getState: () => ({}),
        observeEvent: () => undefined,
        resize: () => undefined,
        setBlank: () => undefined,
        setExpression: () => undefined,
        setState: () => undefined,
        unobserveEvent: () => undefined,
      }),
      ScientificCalculator: () => ({
        destroy: () => undefined,
        resize: () => undefined,
        updateSettings: () => undefined,
      }),
    } as unknown as DesmosApi;

    (window as Window & { Desmos?: DesmosApi }).Desmos = readyApi;
    script?.dispatchEvent(new Event("load"));

    await expect(firstPromise).resolves.toBe(readyApi);
    await expect(secondPromise).resolves.toBe(readyApi);
  });
});
