// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const { factory } = vi.hoisted(() => ({ factory: vi.fn() }));

vi.mock("@rdkit/rdkit", () => ({ default: factory }));
vi.mock("@rdkit/rdkit/RDKit_minimal.wasm?url", () => ({ default: "/assets/RDKit_minimal.wasm" }));

import { RDKitLoadError, loadRDKit, peekRDKit, resetRDKitLoaderForTests, withMol, withReaction, type RDKitModule } from "./rdkit-loader";

function fakeModule() {
  return { prefer_coordgen: vi.fn() } as unknown as RDKitModule;
}

describe("loadRDKit", () => {
  beforeEach(() => {
    resetRDKitLoaderForTests();
    factory.mockReset();
    vi.resetModules();
  });

  it("loads once, points RDKit at the bundled wasm file and shares the result", async () => {
    const module = fakeModule();
    factory.mockResolvedValue(module);
    expect(peekRDKit()).toBeNull();
    const [first, second] = await Promise.all([loadRDKit(), loadRDKit()]);
    expect(first).toBe(module);
    expect(second).toBe(module);
    expect(await loadRDKit()).toBe(module);
    expect(peekRDKit()).toBe(module);
    expect(factory).toHaveBeenCalledTimes(1);
    const options = factory.mock.calls[0][0] as { locateFile: (name: string) => string; printErr: unknown };
    expect(options.locateFile("RDKit_minimal.wasm")).toBe("/assets/RDKit_minimal.wasm");
    expect(typeof options.printErr).toBe("function");
    expect((module as unknown as { prefer_coordgen: ReturnType<typeof vi.fn> }).prefer_coordgen).toHaveBeenCalledWith(true);
  });

  it("wraps failures in RDKitLoadError and retries on the next call", async () => {
    factory.mockRejectedValueOnce(new Error("wasm fetch failed"));
    const failure = await loadRDKit().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RDKitLoadError);
    expect((failure as RDKitLoadError).name).toBe("RDKitLoadError");
    expect((failure as RDKitLoadError).message).toMatch(/could not be loaded/);
    expect(((failure as RDKitLoadError).cause as Error).message).toBe("wasm fetch failed");
    expect(peekRDKit()).toBeNull();

    const module = fakeModule();
    factory.mockResolvedValue(module);
    expect(await loadRDKit()).toBe(module);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("reports a missing factory export clearly", async () => {
    factory.mockReset();
    vi.doMock("@rdkit/rdkit", () => ({ default: {} }));
    const loader = await import("./rdkit-loader");
    loader.resetRDKitLoaderForTests();
    await expect(loader.loadRDKit()).rejects.toThrow(/did not expose a loader/);
    vi.doUnmock("@rdkit/rdkit");
  });
});

describe("withMol / withReaction", () => {
  const mol = () => ({ delete: vi.fn() });

  it("frees the molecule after use, even when the callback throws", () => {
    const a = mol();
    const rdkit = { get_mol: vi.fn(() => a) } as unknown as RDKitModule;
    expect(withMol(rdkit, "CCO", () => 42)).toBe(42);
    expect(a.delete).toHaveBeenCalledTimes(1);
    expect(() => withMol(rdkit, "CCO", () => { throw new Error("boom"); })).toThrow("boom");
    expect(a.delete).toHaveBeenCalledTimes(2);
  });

  it("returns null for unreadable input, whether RDKit returns null or throws", () => {
    expect(withMol({ get_mol: () => null } as unknown as RDKitModule, "C1CC", () => 1)).toBeNull();
    expect(withMol({ get_mol: () => { throw new Error("bad"); } } as unknown as RDKitModule, "C1CC", () => 1)).toBeNull();
    expect(withReaction({ get_rxn: () => null } as unknown as RDKitModule, "nope", () => 1)).toBeNull();
  });

  it("frees reactions too", () => {
    const rxn = mol();
    expect(withReaction({ get_rxn: () => rxn } as unknown as RDKitModule, "A>>B", () => "ok")).toBe("ok");
    expect(rxn.delete).toHaveBeenCalledTimes(1);
  });
});
