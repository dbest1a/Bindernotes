// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import type { PersonalNotesEntry } from "@/types";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/services/personal-notes-service", () => ({ getPersonalNoteEntryContent: mocks.read }));
import { usePersonalEntryContent } from "./use-personal-entry-content";
afterEach(() => { cleanup(); mocks.read.mockReset(); });
describe("selected content hydration", () => {
  it("never exposes metadata as editable content, and ignores a late old selection", async () => {
    const pending = new Map<string, (value: PersonalNotesEntry) => void>();
    mocks.read.mockImplementation((entry: PersonalNotesEntry) => new Promise((resolve) => pending.set(entry.id, resolve)));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const entry = (id: string) => ({ id, kind: "personal-note", contentLoaded: false, updated_at: "1" }) as PersonalNotesEntry;
    const { result, rerender } = renderHook(({ selected }) => usePersonalEntryContent(selected, "owner"), { wrapper, initialProps: { selected: entry("a") } });
    expect(result.current.data).toBeNull();
    expect(result.current.loadingContent).toBe(true);
    rerender({ selected: entry("b") });
    await act(async () => pending.get("a")!({ ...entry("a"), contentLoaded: true }));
    expect(result.current.data).toBeNull();
    await act(async () => pending.get("b")!({ ...entry("b"), contentLoaded: true }));
    await waitFor(() => expect(result.current.data?.id).toBe("b"));
  });
});
