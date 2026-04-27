import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Binder,
  BinderLesson,
  Comment,
  ConceptEdge,
  ConceptNode,
  Folder,
  FolderBinderLink,
  Highlight,
  LearnerNote,
  Profile,
} from "@/types";
import { emptyDoc } from "@/lib/utils";

const mocks = vi.hoisted(() => {
  type QueryFilter = {
    column: string;
    operator: "eq" | "in";
    value: unknown;
  };

  type QueryState = {
    filters: QueryFilter[];
  };

  const state = {
    binders: [] as Binder[],
    folders: [] as Folder[],
    folderBinders: [] as FolderBinderLink[],
    lessons: [] as BinderLesson[],
    notes: [] as LearnerNote[],
    comments: [] as Comment[],
    highlights: [] as Highlight[],
    conceptNodes: [] as ConceptNode[],
    conceptEdges: [] as ConceptEdge[],
  };

  function applyFilters<T extends Record<string, unknown>>(rows: T[], filters: QueryFilter[]) {
    return rows.filter((row) =>
      filters.every((filter) => {
        if (filter.operator === "eq") {
          return row[filter.column] === filter.value;
        }

        return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
      }),
    );
  }

  function resolveTable(table: string, query: QueryState) {
    switch (table) {
      case "binders":
        return { data: applyFilters(state.binders as unknown as Record<string, unknown>[], query.filters), error: null };
      case "folders":
        return { data: applyFilters(state.folders as unknown as Record<string, unknown>[], query.filters), error: null };
      case "folder_binders":
        return {
          data: applyFilters(state.folderBinders as unknown as Record<string, unknown>[], query.filters),
          error: null,
        };
      case "binder_lessons":
        return { data: applyFilters(state.lessons as unknown as Record<string, unknown>[], query.filters), error: null };
      case "learner_notes":
        return { data: applyFilters(state.notes as unknown as Record<string, unknown>[], query.filters), error: null };
      case "comments":
        return { data: applyFilters(state.comments as unknown as Record<string, unknown>[], query.filters), error: null };
      case "highlights":
        return {
          data: applyFilters(state.highlights as unknown as Record<string, unknown>[], query.filters),
          error: null,
        };
      case "concept_nodes":
        return {
          data: applyFilters(state.conceptNodes as unknown as Record<string, unknown>[], query.filters),
          error: null,
        };
      case "concept_edges":
        return {
          data: applyFilters(state.conceptEdges as unknown as Record<string, unknown>[], query.filters),
          error: null,
        };
      default:
        throw new Error(`Unexpected table in dashboard account-data test: ${table}`);
    }
  }

  function createQuery(table: string) {
    const query: QueryState = {
      filters: [],
    };
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        query.filters.push({ column, operator: "eq", value });
        return builder;
      }),
      in: vi.fn((column: string, value: unknown[]) => {
        query.filters.push({ column, operator: "in", value });
        return builder;
      }),
      order: vi.fn(() => builder),
      maybeSingle: vi.fn(() => {
        const rows = resolveTable(table, query).data;
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      }),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(resolveTable(table, query)).then(resolve, reject),
    };

    return builder;
  }

  return {
    from: vi.fn((table: string) => createQuery(table)),
    state,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
  },
  isSupabaseConfigured: true,
  supabaseProjectRef: "test-project",
}));

import { getBinderBundle, getDashboard } from "@/services/binder-service";

describe("binder-service account dashboard data", () => {
  const profile: Profile = {
    id: "user-1",
    email: "learner@example.com",
    full_name: "Learner",
    role: "learner",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  beforeEach(() => {
    mocks.from.mockClear();
    mocks.state.binders = [
      {
        id: "binder-jacob-math-notes",
        owner_id: "system-seed-admin",
        title: "Jacob Math Notes",
        slug: "jacob-math-notes",
        description: "Bundled demo content.",
        subject: "Math",
        level: "Demo",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: true,
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
      {
        id: "binder-user-real",
        owner_id: profile.id,
        title: "My Real Binder",
        slug: "my-real-binder",
        description: "Account-owned study material.",
        subject: "Math",
        level: "Algebra",
        status: "published",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: "2026-04-21T00:00:00.000Z",
        updated_at: "2026-04-21T00:00:00.000Z",
      },
    ];
    mocks.state.folders = [];
    mocks.state.folderBinders = [];
    mocks.state.lessons = [
      {
        id: "lesson-demo",
        binder_id: "binder-jacob-math-notes",
        title: "Demo lesson",
        order_index: 1,
        content: emptyDoc("demo"),
        math_blocks: [],
        is_preview: false,
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
      {
        id: "lesson-real",
        binder_id: "binder-user-real",
        title: "Real lesson",
        order_index: 1,
        content: emptyDoc("real"),
        math_blocks: [],
        is_preview: false,
        created_at: "2026-04-21T00:00:00.000Z",
        updated_at: "2026-04-21T00:00:00.000Z",
      },
    ];
    mocks.state.notes = [];
    mocks.state.comments = [];
    mocks.state.highlights = [];
    mocks.state.conceptNodes = [];
    mocks.state.conceptEdges = [];
  });

  it("keeps Supabase-backed published binders visible even when ids overlap local bundled seeds", async () => {
    const dashboard = await getDashboard(profile, { includeSystemStatus: false });

    expect(dashboard.binders.map((binder) => binder.id)).toEqual([
      "binder-jacob-math-notes",
      "binder-user-real",
    ]);
    expect(dashboard.lessons.map((lesson) => lesson.id)).toEqual(["lesson-demo", "lesson-real"]);
    expect(dashboard.recentLessons.map((lesson) => lesson.id)).toEqual(["lesson-real", "lesson-demo"]);
  });

  it("opens a Supabase-backed Jacob binder instead of blocking it as a local sample", async () => {
    const bundle = await getBinderBundle("binder-jacob-math-notes", profile);

    expect(bundle.binder.title).toBe("Jacob Math Notes");
    expect(bundle.lessons.map((lesson) => lesson.id)).toEqual(["lesson-demo"]);
  });

  it("reloads only the signed-in user's private notes for a binder", async () => {
    mocks.state.notes = [
      {
        id: "note-user-1",
        owner_id: profile.id,
        binder_id: "binder-jacob-math-notes",
        lesson_id: "lesson-demo",
        folder_id: null,
        title: "My calculus note",
        content: emptyDoc("Visible to user one"),
        math_blocks: [],
        pinned: false,
        created_at: "2026-04-23T10:00:00.000Z",
        updated_at: "2026-04-23T10:01:00.000Z",
      },
      {
        id: "note-user-2",
        owner_id: "user-2",
        binder_id: "binder-jacob-math-notes",
        lesson_id: "lesson-demo",
        folder_id: null,
        title: "Other user's note",
        content: emptyDoc("Must stay hidden"),
        math_blocks: [],
        pinned: false,
        created_at: "2026-04-23T10:00:00.000Z",
        updated_at: "2026-04-23T10:02:00.000Z",
      },
    ];

    const bundle = await getBinderBundle("binder-jacob-math-notes", profile);

    expect(bundle.notes.map((note) => note.id)).toEqual(["note-user-1"]);
    expect(bundle.notes[0]).toMatchObject({
      owner_id: profile.id,
      binder_id: "binder-jacob-math-notes",
      lesson_id: "lesson-demo",
    });
  });
});
