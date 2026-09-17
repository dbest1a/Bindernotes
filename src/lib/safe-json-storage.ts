export type JsonArrayStorage = Pick<Storage, "getItem" | "setItem">;

export function readJsonArray<T>(storage: JsonArrayStorage | undefined, key: string): T[] {
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeJsonArray<T>(storage: JsonArrayStorage | undefined, key: string, values: T[]) {
  storage?.setItem(key, JSON.stringify(values));
}
