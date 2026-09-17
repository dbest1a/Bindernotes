import { describe, expect, it, vi } from "vitest";
import { readJsonArray, writeJsonArray, type JsonArrayStorage } from "@/lib/safe-json-storage";

function createStorage(initial: Record<string, string> = {}): JsonArrayStorage & {
  snapshot: () => Record<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    snapshot: () => Object.fromEntries(values),
  };
}

describe("safe JSON array storage", () => {
  it("fails closed for missing storage and malformed JSON", () => {
    expect(readJsonArray(undefined, "items")).toEqual([]);
    expect(readJsonArray(createStorage({ items: "{not-json" }), "items")).toEqual([]);
  });

  it.each(["null", "{}", '"value"', "42", "true"])("fails closed for non-array JSON: %s", (value) => {
    expect(readJsonArray(createStorage({ items: value }), "items")).toEqual([]);
  });

  it("fails closed when storage reads throw", () => {
    const storage: JsonArrayStorage = {
      getItem: () => {
        throw new Error("read blocked");
      },
      setItem: vi.fn(),
    };

    expect(readJsonArray(storage, "items")).toEqual([]);
  });

  it("writes arrays as JSON and does nothing without storage", () => {
    const storage = createStorage();
    const values = [{ id: "one" }, { id: "two" }];

    expect(writeJsonArray(storage, "items", values)).toBeUndefined();
    expect(storage.snapshot()).toEqual({ items: JSON.stringify(values) });
    expect(writeJsonArray(undefined, "items", values)).toBeUndefined();
  });

  it("preserves storage write failures", () => {
    const storage: JsonArrayStorage = {
      getItem: vi.fn(),
      setItem: () => {
        throw new Error("write blocked");
      },
    };

    expect(() => writeJsonArray(storage, "items", [])).toThrow("write blocked");
  });
});
