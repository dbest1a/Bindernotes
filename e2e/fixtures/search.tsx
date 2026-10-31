import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookOpenCheck, Calculator, LayoutDashboard, NotebookTabs, Settings } from "lucide-react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { useGlobalSearchPage } from "@/components/search/global-search-context";
import { GlobalSearchProvider, GlobalSearchTrigger } from "@/components/search/global-search-provider";
import { queryKeys } from "@/lib/query-keys";
import type { BinderLesson, DashboardData, PersonalNotesData, PersonalNotesEntry, Profile } from "@/types";
import "@/styles.css";

// Isolated search fixture: synthetic records only. No authentication, network, or account data.
const params = new URLSearchParams(location.search);
const profile: Profile = {
  id: "fixture-student",
  email: "fixture@example.invalid",
  full_name: "Fixture Student",
  role: "learner",
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};
const day = (offset: number) => new Date(Date.UTC(2026, 8, 1 + offset)).toISOString();
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

const binders = [
  { id: "fixture-chemistry", title: "Chemistry foundations", subject: "Chemistry" },
  { id: "fixture-algebra", title: "Algebra 1 Foundations", subject: "Mathematics" },
  { id: "fixture-history", title: "The Russian Revolution", subject: "History" },
].map((binder) => ({
  ...binder,
  owner_id: "fixture-system",
  slug: binder.id,
  description: `${binder.subject} lessons for the isolated search check.`,
  level: "Foundations",
  status: "published" as const,
  price_cents: 0,
  cover_url: null,
  pinned: false,
  created_at: day(0),
  updated_at: day(0),
}));

let lessonCount = 0;
const lesson = (binderId: string, title: string, updatedDay: number): BinderLesson => ({
  id: `fixture-lesson-${(lessonCount += 1)}`,
  binder_id: binderId,
  title,
  order_index: lessonCount,
  content: doc(""),
  math_blocks: [],
  is_preview: false,
  created_at: day(0),
  updated_at: day(updatedDay),
});
const lessons: BinderLesson[] = [
  lesson("fixture-chemistry", "Stoichiometry and limiting reagents", 1),
  lesson("fixture-algebra", "Completing the Square", 2),
  ...Array.from({ length: 30 }, (_, index) =>
    lesson(binders[index % 3].id, `Practice set ${index + 1}`, 10 + index),
  ),
];
const dashboard: DashboardData = {
  binders,
  folders: [
    { id: "folder-chemistry", owner_id: "fixture-system", name: "Chemistry", color: "emerald", created_at: day(0), updated_at: day(0) },
  ],
  folderBinders: [
    { id: "fixture-link", owner_id: "fixture-system", folder_id: "folder-chemistry", binder_id: "fixture-chemistry", created_at: day(0), updated_at: day(0) },
  ],
  notes: [],
  lessons,
  recentLessons: [...lessons].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)).slice(0, 6),
  seedHealth: [],
};

const entry = (id: string, title: string, text: string, overrides: Partial<PersonalNotesEntry> = {}): PersonalNotesEntry => {
  const note = {
    id,
    owner_id: profile.id,
    title,
    content: doc(text),
    math_blocks: [],
    folder_id: null,
    binder_id: null,
    document_id: null,
    tags: [],
    pinned: false,
    archived_at: null,
    created_at: day(0),
    updated_at: day(20),
  };
  return {
    kind: "personal-note",
    id,
    title,
    content: note.content,
    excerpt: text.slice(0, 120),
    searchText: title.toLowerCase(),
    updated_at: note.updated_at,
    pinned: false,
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
    quickOpenUrl: `/notes/n/${id}`,
    quickJumpToBinderUrl: null,
    note,
    reviewLater: false,
    ...overrides,
  };
};
const notes: PersonalNotesData = {
  entries: [
    entry("fixture-note-1", "Mole ratio checklist", "Balance the equation before comparing mole ratios.", { pinned: true }),
    entry("fixture-note-2", "Unit review plan", "Review the quadratic formula and factoring.", {
      kind: "personal-document",
      sourceType: "Notebook document",
      personalBinderId: "fixture-notebook",
      personalBinderTitle: "Exam notebook",
      quickOpenUrl: "/notes/binders/fixture-notebook/documents/fixture-note-2",
    }),
  ],
  learnerNotes: [],
  personalNotes: [],
  personalFolders: [],
  personalBinders: [],
  personalDocuments: [],
  binders: [],
  lessons: [],
  folders: [],
  folderBinders: [],
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
// A far-future timestamp keeps the seeded copies fresh, so the fixture never refetches through the stub client.
const neverStale = { updatedAt: Date.now() + 365 * 24 * 60 * 60 * 1000 };
queryClient.setQueryData(queryKeys.dashboard.detail(profile.id, profile.role, false), dashboard, neverStale);
queryClient.setQueryData(queryKeys.personalNotes.forProfile(profile.id), notes, neverStale);

function LocationProbe() {
  const current = useLocation();
  return <output data-testid="location">{`${current.pathname}${current.search}`}</output>;
}

function FakePersonalNotesPalette() {
  const [query, setQuery] = useState<string | null>(null);
  useGlobalSearchPage({
    commands: [
      {
        id: "fixture-personal-notes-commands",
        label: "Personal Notes commands",
        description: "Create, focus, side monitor, highlights, and current-note actions",
        run: (typed) => setQuery(typed),
      },
    ],
    onSearchOpen: () => setQuery(null),
  });
  if (query === null) {
    return null;
  }
  return (
    <div aria-label="Personal Notes command palette" className="fixed inset-0 z-50 grid place-items-start bg-background/60 p-6" role="dialog">
      <input
        aria-label="Command search"
        autoFocus
        className="w-full max-w-lg rounded-lg border border-border bg-background p-3"
        defaultValue={query}
        onKeyDown={(event) => {
          if (event.key === "Escape") setQuery(null);
        }}
      />
    </div>
  );
}

function SearchFixture() {
  const [settingsOpened, setSettingsOpened] = useState(false);
  return (
    <GlobalSearchProvider
      actions={[{ id: "settings", label: "Settings", keywords: "theme preferences", icon: <Settings />, run: () => setSettingsOpened(true) }]}
      pages={[
        { href: "/dashboard", label: "Workspace", description: "Folders, binders, and recent documents", icon: <LayoutDashboard /> },
        { href: "/notes", label: "Personal Notes", description: "Your notes and notebooks", icon: <NotebookTabs /> },
        { href: "/math/lab", label: "Math lab", description: "Graphing and calculator", icon: <Calculator /> },
        { href: "/tutorial", label: "Tutorial", description: "Learn BinderNotes", icon: <BookOpenCheck /> },
      ]}
      profile={profile}
    >
      <header className="app-header sticky top-0 z-20 border-b border-border/70 bg-background">
        <div className="app-header__inner mx-auto flex h-16 max-w-[1540px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <strong>BinderNotes · isolated search check</strong>
          <div className="app-header__actions flex items-center gap-2">
            <GlobalSearchTrigger />
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-3 p-6">
        <label className="grid gap-1 text-sm">
          Page field
          <input aria-label="Page field" className="rounded-lg border border-border bg-background p-2" />
        </label>
        <LocationProbe />
        {settingsOpened ? <p role="note">Settings opened</p> : null}
        {params.get("page") === "notes" ? <FakePersonalNotesPalette /> : null}
      </main>
    </GlobalSearchProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[params.get("page") === "notes" ? "/notes" : "/dashboard"]}>
        <ThemeProvider>
          <SearchFixture />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
