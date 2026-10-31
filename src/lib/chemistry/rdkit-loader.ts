import type { MainModule, Mol, Reaction } from "@rdkit/rdkit";

export type RDKitModule = MainModule;
export type RDKitMol = Mol;
export type RDKitReaction = Reaction;

export class RDKitLoadError extends Error {
  override readonly name = "RDKitLoadError";
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

type RDKitFactory = (options?: Record<string, unknown>) => Promise<RDKitModule>;

let pending: Promise<RDKitModule> | null = null;
let loaded: RDKitModule | null = null;

const noop = () => undefined;

function pickFactory(namespace: unknown): RDKitFactory | null {
  // The package is a CommonJS emscripten bundle; depending on the bundler the
  // factory is the namespace, `default`, or `default.default`.
  let candidate: unknown = namespace;
  for (let depth = 0; depth < 3 && candidate; depth += 1) {
    if (typeof candidate === "function") return candidate as RDKitFactory;
    candidate = (candidate as { default?: unknown }).default;
  }
  return null;
}

async function initialise(): Promise<RDKitModule> {
  // Both imports stay inside this function so the ~7 MB WASM and its JS glue
  // are separate lazy assets and never part of the startup bundle.
  const [rdkitNamespace, wasmNamespace] = await Promise.all([
    import("@rdkit/rdkit"),
    import("@rdkit/rdkit/RDKit_minimal.wasm?url"),
  ]);
  const factory = pickFactory(rdkitNamespace);
  if (!factory) throw new RDKitLoadError("The chemistry engine did not expose a loader.");
  const wasmUrl = (wasmNamespace as { default: string }).default;
  const rdkit = await factory({
    locateFile: () => wasmUrl,
    // Parse failures are reported through null results, not the console.
    print: noop,
    printErr: noop,
  });
  try {
    rdkit.prefer_coordgen(true);
  } catch {
    // Layout preference is cosmetic; keep going with RDKit's default layout.
  }
  return rdkit;
}

/** Loads RDKit once. A failed load is not cached, so the next call retries. */
export function loadRDKit(): Promise<RDKitModule> {
  if (loaded) return Promise.resolve(loaded);
  if (!pending) {
    pending = initialise().then(
      (rdkit) => {
        loaded = rdkit;
        return rdkit;
      },
      (error: unknown) => {
        pending = null;
        throw error instanceof RDKitLoadError
          ? error
          : new RDKitLoadError("The chemistry engine could not be loaded. Check your connection and try again.", error);
      },
    );
  }
  return pending;
}

/** The loaded module, or null if loading has not finished. Never triggers a load. */
export function peekRDKit(): RDKitModule | null {
  return loaded;
}

/** Test hook: forget the cached module and any in-flight load. */
export function resetRDKitLoaderForTests() {
  pending = null;
  loaded = null;
}

/** Parses a molecule, runs `fn`, and always frees the WASM object. Returns null if it cannot be parsed. */
export function withMol<T>(rdkit: RDKitModule, smiles: string, fn: (mol: RDKitMol) => T): T | null {
  let mol: RDKitMol | null = null;
  try {
    mol = rdkit.get_mol(smiles);
  } catch {
    mol = null;
  }
  if (!mol) return null;
  try {
    return fn(mol);
  } finally {
    mol.delete();
  }
}

/** Parses a reaction, runs `fn`, and always frees the WASM object. Returns null if it cannot be parsed. */
export function withReaction<T>(rdkit: RDKitModule, smiles: string, fn: (rxn: RDKitReaction) => T): T | null {
  let rxn: RDKitReaction | null = null;
  try {
    rxn = rdkit.get_rxn(smiles);
  } catch {
    rxn = null;
  }
  if (!rxn) return null;
  try {
    return fn(rxn);
  } finally {
    rxn.delete();
  }
}
