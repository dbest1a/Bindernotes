import { describe, expect, it } from "vitest";
import {
  isDynamicImportFailure,
  shouldRecoverFromDynamicImportFailure,
} from "@/App";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  } satisfies Storage;
}

describe("route chunk recovery", () => {
  it("detects stale dynamic import chunk failures", () => {
    expect(
      isDynamicImportFailure(
        new TypeError(
          "Failed to fetch dynamically imported module: https://www.bindernotes.com/assets/math-lab-page-D9GNVwzD.js",
        ),
      ),
    ).toBe(true);
    expect(isDynamicImportFailure(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("allows one recovery reload per route and then falls back", () => {
    const storage = createStorage();
    const error = new TypeError("Importing a module script failed.");

    expect(shouldRecoverFromDynamicImportFailure(error, "/math", storage)).toBe(true);
    expect(shouldRecoverFromDynamicImportFailure(error, "/math", storage)).toBe(false);
    expect(shouldRecoverFromDynamicImportFailure(error, "/admin", storage)).toBe(true);
  });
});
