// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGlobalSearchPage } from "@/components/search/global-search-context";
import { GlobalSearchProvider, GlobalSearchTrigger } from "@/components/search/global-search-provider";
import type { BinderLesson, DashboardData, PersonalNotesData, PersonalNotesEntry, PersonalNote, Profile } from "@/types";

const profile: Profile = {
  id: "user-1",
  email: "student@example.com",
  full_name: "Sam Student",
  role: "learner",
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  dashboard: {
    data: undefined as unknown,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  notes: {
    data: undefined as unknown,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/hooks/use-binders", () => ({ useDashboard: () => mocks.dashboard }));
vi.mock("@/hooks/use-personal-notes", () => ({ usePersonalNotes: () => mocks.notes }));

const day = (offset: number) => new Date(Date.UTC(2026, 9, 1 + offset)).toISOString();

function lesson(id: string, title: string, updatedDay: number): BinderLesson {
  return {
    id,
    binder_id: "binder-algebra",
    title,
    order_index: updatedDay,
    content: { type: "doc", content: [] },
    math_blocks: [],
    is_preview: false,
    created_at: day(0),
    updated_at: day(updatedDay),
  };
}

const lessons = [
  lesson("lesson-old", "Completing the Square", 1),
  ...Array.from({ length: 6 }, (_, index) => lesson(`lesson-${index}`, `Practice set ${index + 1}`, index + 10)),
];

const dashboardData: DashboardData = {
  binders: [
    {
      id: "binder-algebra",
      owner_id: "system",
      title: "Algebra 1 Foundations",
      slug: "algebra-1",
      description: "Linear equations and quadratics.",
      subject: "Mathematics",
      level: "Foundations",
      status: "published",
      price_cents: 0,
      cover_url: null,
      pinned: false,
      created_at: day(0),
      updated_at: day(0),
    },
  ],
  folders: [],
  folderBinders: [],
  notes: [],
  lessons,
  recentLessons: [...lessons].reverse().slice(0, 6),
  seedHealth: [],
};

const looseNote: PersonalNote = {
  id: "loose-1",
  owner_id: "user-1",
  title: "Square tricks",
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Halve the middle coefficient." }] }] },
  math_blocks: [],
  folder_id: null,
  binder_id: null,
  document_id: null,
  tags: [],
  pinned: true,
  archived_at: null,
  created_at: day(0),
  updated_at: day(3),
};

const looseEntry: PersonalNotesEntry = {
  kind: "personal-note",
  id: looseNote.id,
  title: looseNote.title,
  content: looseNote.content,
  excerpt: "Halve the middle coefficient.",
  searchText: "square tricks",
  updated_at: looseNote.updated_at,
  pinned: true,
  folderId: null,
  folderName: "Unfiled",
  folderColor: "slate",
  tags: [],
  math_blocks: [],
  sourceType: "Loose note",
  sourceBinderId: null,
  sourceBinderTitle: null,
  sourceDocumentId: null,
  sourceDocumentTitle: null,
  personalBinderId: null,
  personalBinderTitle: null,
  quickOpenUrl: "/notes/n/loose-1",
  quickJumpToBinderUrl: null,
  note: looseNote,
  reviewLater: false,
};

const notesData: PersonalNotesData = {
  entries: [looseEntry],
  learnerNotes: [],
  personalNotes: [looseNote],
  personalFolders: [],
  personalBinders: [],
  personalDocuments: [],
  binders: [],
  lessons: [],
  folders: [],
  folderBinders: [],
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function FakePalettePage() {
  const [paletteQuery, setPaletteQuery] = useState<string | null>(null);
  useGlobalSearchPage({
    commands: [
      {
        id: "fake-commands",
        label: "Personal Notes commands",
        description: "Page commands",
        run: (query) => setPaletteQuery(query),
      },
    ],
    onSearchOpen: () => setPaletteQuery(null),
  });
  return paletteQuery === null ? null : (
    <div aria-label="Page command palette" role="dialog">
      <input aria-label="Command search" autoFocus defaultValue={paletteQuery} />
    </div>
  );
}

function renderSearch({ path = "/dashboard", withPagePalette = false } = {}) {
  const settingsRun = vi.fn();
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <GlobalSearchProvider
          actions={[{ id: "settings", label: "Settings", keywords: "theme preferences", run: settingsRun }]}
          pages={[
            { href: "/dashboard", label: "Workspace", keywords: "home library" },
            { href: "/math/lab", label: "Math lab", keywords: "graph calculator" },
          ]}
          profile={profile}
        >
          <button type="button">Before search</button>
          <GlobalSearchTrigger />
          <LocationProbe />
          {withPagePalette ? <FakePalettePage /> : null}
        </GlobalSearchProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, settingsRun };
}

async function openWithShortcut() {
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  return screen.findByRole("combobox", { name: "Search lessons, binders, and notes" });
}

describe("global search", () => {
  beforeEach(() => {
    mocks.dashboard.data = dashboardData;
    mocks.dashboard.isError = false;
    mocks.dashboard.isFetching = false;
    mocks.dashboard.refetch.mockReset();
    mocks.notes.data = notesData;
    mocks.notes.isError = false;
    mocks.notes.isFetching = false;
    mocks.notes.refetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens with Ctrl+K, focuses the search box, and returns focus on Escape", async () => {
    renderSearch();
    const before = screen.getByRole("button", { name: "Before search" });
    before.focus();

    const input = await openWithShortcut();
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");

    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(before);
  });

  it("opens from the header button and toggles closed with Cmd+K", async () => {
    renderSearch();
    const trigger = screen.getByRole("button", { name: "Search lessons, binders, and notes" });
    trigger.focus();
    fireEvent.click(trigger);

    const input = await screen.findByRole("combobox");
    fireEvent.keyDown(input, { key: "k", metaKey: true });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("opens a lesson that is not in the recent list straight into the reader", async () => {
    renderSearch();
    const input = await openWithShortcut();

    fireEvent.change(input, { target: { value: "square completing" } });
    const listbox = screen.getByRole("listbox", { name: "Search results" });
    await within(listbox).findByRole("option", { name: /Completing the Square/ });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/binders/binder-algebra/documents/lesson-old"),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens personal notes at their current route", async () => {
    renderSearch();
    const input = await openWithShortcut();

    fireEvent.change(input, { target: { value: "tricks" } });
    fireEvent.click(await screen.findByRole("option", { name: /Square tricks/ }));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/notes/n/loose-1"));
  });

  it("moves through grouped results with the arrow keys", async () => {
    renderSearch();
    const input = await openWithShortcut();

    expect(screen.getByRole("group", { name: "Recent lessons" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Recent notes" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Go to" })).toBeTruthy();

    const options = screen.getAllByRole("option");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);
    expect(options[1].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[options.length - 1].id);
  });

  it("runs app actions such as Settings after closing", async () => {
    const { settingsRun } = renderSearch();
    const input = await openWithShortcut();

    fireEvent.change(input, { target: { value: "theme" } });
    fireEvent.click(await screen.findByRole("option", { name: /Settings/ }));

    await waitFor(() => expect(settingsRun).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a loading state while account data is on its way", async () => {
    mocks.dashboard.data = undefined;
    mocks.notes.data = undefined;
    renderSearch();
    await openWithShortcut();

    expect(screen.getByTestId("global-search-loading").textContent).toContain("Loading your lessons and notes");
    expect(screen.queryByTestId("global-search-empty")).toBeNull();
  });

  it("shows an empty state only when nothing at all matches", async () => {
    renderSearch();
    const input = await openWithShortcut();

    fireEvent.change(input, { target: { value: "settings" } });
    await screen.findByRole("option", { name: /Settings/ });
    expect(screen.queryByTestId("global-search-empty")).toBeNull();

    fireEvent.change(input, { target: { value: "zzqx" } });
    expect((await screen.findByTestId("global-search-empty")).textContent).toContain("No matches for “zzqx”");
    expect(within(screen.getByRole("dialog")).getByRole("status").textContent).toBe("No results for zzqx");
  });

  it("keeps note results usable and offers a retry when lessons fail to load", async () => {
    mocks.dashboard.data = undefined;
    mocks.dashboard.isError = true;
    renderSearch();
    const input = await openWithShortcut();

    const error = screen.getByTestId("global-search-error-library");
    expect(error.textContent).toContain("Lessons and binders could not load.");
    fireEvent.click(within(error).getByRole("button", { name: "Retry" }));
    expect(mocks.dashboard.refetch).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "square" } });
    expect(await screen.findByRole("option", { name: /Square tricks/ })).toBeTruthy();
  });

  it("hands off to the page's own command palette so only one palette is open", async () => {
    renderSearch({ withPagePalette: true });
    const input = await openWithShortcut();

    expect(screen.getByRole("group", { name: "On this page" })).toBeTruthy();
    fireEvent.change(input, { target: { value: "focus mode" } });
    fireEvent.click(await screen.findByRole("option", { name: /Personal Notes commands/ }));

    const palette = await screen.findByRole("dialog", { name: "Page command palette" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect((within(palette).getByLabelText("Command search") as HTMLInputElement).value).toBe("focus mode");

    // Opening global search again closes the page palette first.
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    await screen.findByRole("combobox");
    expect(screen.queryByRole("dialog", { name: "Page command palette" })).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("leaves Ctrl+K to other modals and to handlers that already used it", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <GlobalSearchProvider profile={profile}>
            <div aria-modal="true" role="dialog">
              <input aria-label="Modal field" />
            </div>
            <input aria-label="Editor" onKeyDown={(event) => event.preventDefault()} />
          </GlobalSearchProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const modalField = screen.getByLabelText("Modal field");
    modalField.focus();
    fireEvent.keyDown(modalField, { key: "k", ctrlKey: true });
    fireEvent.keyDown(screen.getByLabelText("Editor"), { key: "k", ctrlKey: true });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId("global-search-dialog")).toBeNull();
  });

  it("keeps Tab and Shift+Tab inside the dialog", async () => {
    renderSearch();
    const input = await openWithShortcut();
    fireEvent.change(input, { target: { value: "square" } });
    const close = screen.getByRole("button", { name: "Close search" });

    close.focus();
    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);
  });

  it("does not offer search without a signed-in profile", () => {
    render(
      <MemoryRouter>
        <GlobalSearchProvider profile={null}>
          <GlobalSearchTrigger />
        </GlobalSearchProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("global-search-trigger")).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByTestId("global-search-dialog")).toBeNull();
  });
});
