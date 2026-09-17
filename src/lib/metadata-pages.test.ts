import { describe, expect, it, vi } from "vitest";
import { readMetadataPages, readMetadataForIds } from "./metadata-pages";

describe("bounded metadata loading", () => {
  it("bounds IN filters separately from result page sizes", async () => {
    const ids = Array.from({ length: 1201 }, (_, index) => String(index));
    const read = vi.fn(async (batch: string[]) => ({ data: batch.map((id) => ({ id })), error: null }));
    expect((await readMetadataForIds(ids, read)).data.map((row) => row.id)).toEqual(ids);
    expect(read.mock.calls.every(([batch]) => batch.length <= 100)).toBe(true);
    expect(read).toHaveBeenCalledTimes(13);
  });
  it("loads beyond the server row cap using bounded stable pages", async () => {
    const rows = Array.from({ length: 1421 }, (_, id) => ({ id }));
    const read = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    expect((await readMetadataPages(read)).data).toEqual(rows);
    expect(read).toHaveBeenCalledTimes(8);
    expect(read.mock.calls.every(([from, to]) => to - from === 199)).toBe(true);
  });
  it("does not silently return partial data when a later page fails", async () => {
    const error = { message: "offline" };
    expect(await readMetadataPages(async (from) => from === 0
      ? { data: Array.from({ length: 200 }, (_, id) => ({ id })), error: null }
      : { data: null, error })).toEqual({ data: [], error });
  });
});
