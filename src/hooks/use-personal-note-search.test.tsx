// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/services/personal-note-search-service", () => ({ searchPersonalNoteBodies: mocks.search }));
import { usePersonalNoteSearch } from "./use-personal-note-search";
afterEach(() => {
  cleanup();
  mocks.search.mockReset();
});

describe("note text search identity boundaries", () => {
  it("does not show a previous query or account's late matches", async () => {
    const pending = new Map<string, (value: Set<string>) => void>();
    mocks.search.mockImplementation(
      (owner: string, text: string) => new Promise((resolve) => pending.set(`${owner}:${text}`, resolve)),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(({ owner, query }) => usePersonalNoteSearch(owner, query, true), {
      wrapper,
      initialProps: { owner: "a", query: "first" },
    });
    await waitFor(() => expect(pending.has("a:first")).toBe(true));
    rerender({ owner: "b", query: "second" });
    expect(result.current.matches).toBeUndefined();
    await act(async () => pending.get("a:first")!(new Set(["personal-note:private-a"])));
    expect(result.current.matches).toBeUndefined();
    await waitFor(() => expect(pending.has("b:second")).toBe(true));
    await act(async () => pending.get("b:second")!(new Set(["personal-note:private-b"])));
    await waitFor(() => expect(result.current.matches?.has("personal-note:private-b")).toBe(true));
    expect(result.current.matches?.has("personal-note:private-a")).toBe(false);
  });
});
