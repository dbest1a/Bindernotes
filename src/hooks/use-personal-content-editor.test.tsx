// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { saveQueue } from "@/lib/save-queue";
import { emptyDoc } from "@/lib/utils";
import type { PersonalNotesEntry } from "@/types";
vi.mock("@/services/personal-content-repository", () => ({ savePersonalContent: vi.fn(), readPersonalContent: vi.fn(), preservePersonalContentCopy: vi.fn() }));
import { usePersonalContentEditor } from "./use-personal-content-editor";
const entry = (title: string, revision: number, contentLoaded = true) => ({ id: "note", kind: "personal-note", title, content: emptyDoc(title), tags: [], pinned: false, contentLoaded, note: { id: "note", owner_id: "owner", title, content: emptyDoc(title), math_blocks: [], revision, folder_id: null, binder_id: null, document_id: null } }) as unknown as PersonalNotesEntry;
function wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>; }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); saveQueue.setAccount("owner"); });
afterEach(() => { cleanup(); saveQueue.setAccount(null); });
describe("metadata-safe personal editor", () => {
  it("waits for full content before creating the controller", () => {
    const { result, rerender } = renderHook(({ selected }) => usePersonalContentEditor(selected, "owner", false), { wrapper, initialProps: { selected: entry("metadata", 3, false) } });
    expect(result.current.snapshot.id).toBe("");
    rerender({ selected: entry("full body", 3) });
    expect(result.current.snapshot.title).toBe("full body");
  });
  it("accepts a newer clean hydrated body but preserves unsaved edits across refetch", () => {
    const { result, rerender } = renderHook(({ selected }) => usePersonalContentEditor(selected, "owner", false), { wrapper, initialProps: { selected: entry("first", 3) } });
    rerender({ selected: entry("new remote", 4) });
    expect(result.current.snapshot.title).toBe("new remote");
    act(() => result.current.change({ title: "my draft" }));
    rerender({ selected: entry("other remote", 5) });
    expect(result.current.snapshot.title).toBe("my draft");
    expect(result.current.dirty).toBe(true);
  });
});
