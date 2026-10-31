import { describe, expect, it } from "vitest";
import { createSearchQuery } from "@/lib/search/text-match";
import {
  buildDashboardSearchItems,
  buildNavigationSearchItems,
  buildPersonalNoteSearchItems,
  buildSearchSnippet,
  groupWorkspaceSearchHits,
  pickRecentLessonItems,
  pickRecentNoteItems,
  searchWorkspaceItems,
} from "@/lib/search/workspace-search";
import type { Binder, BinderLesson, DashboardData, LearnerNote, PersonalNotesEntry } from "@/types";

const day = (offset: number) => new Date(Date.UTC(2026, 9, 1 + offset)).toISOString();

function binder(overrides: Partial<Binder> & Pick<Binder, "id" | "title">): Binder {
  return {
    owner_id: "user-1",
    slug: overrides.id,
    description: "",
    subject: "Math",
    level: "Foundations",
    status: "published",
    price_cents: 0,
    cover_url: null,
    pinned: false,
    created_at: day(0),
    updated_at: day(0),
    ...overrides,
  };
}

function lesson(id: string, binderId: string, title: string, updatedDay: number): BinderLesson {
  return {
    id,
    binder_id: binderId,
    title,
    order_index: updatedDay,
    content: { type: "doc", content: [] },
    math_blocks: [],
    is_preview: false,
    created_at: day(0),
    updated_at: day(updatedDay),
  };
}

const algebra = binder({ id: "binder-algebra", title: "Algebra 1 Foundations" });
const draftPlaceholder = binder({
  id: "binder-placeholder",
  title: "Untitled binder",
  description: "Write a clear promise for this binder.",
  status: "draft",
});
const lessons = [
  lesson("lesson-old", algebra.id, "Completing the Square", 1),
  ...Array.from({ length: 7 }, (_, index) => lesson(`lesson-${index}`, algebra.id, `Practice set ${index + 1}`, index + 10)),
  lesson("lesson-in-placeholder", draftPlaceholder.id, "Untitled lesson", 30),
];
const dashboard: DashboardData = {
  binders: [algebra, draftPlaceholder],
  folders: [
    {
      id: "folder-math",
      owner_id: "system",
      name: "Math",
      color: "blue",
      created_at: day(0),
      updated_at: day(0),
    },
  ],
  folderBinders: [
    {
      id: "link-1",
      owner_id: "system",
      folder_id: "folder-math",
      binder_id: algebra.id,
      created_at: day(0),
      updated_at: day(0),
    },
  ],
  notes: [],
  lessons,
  recentLessons: [...lessons].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)).slice(0, 6),
  seedHealth: [],
};

function entry(overrides: Partial<PersonalNotesEntry> & Pick<PersonalNotesEntry, "id" | "kind" | "title">): PersonalNotesEntry {
  const note: LearnerNote = {
    id: overrides.id,
    owner_id: "user-1",
    binder_id: algebra.id,
    lesson_id: "lesson-old",
    folder_id: null,
    title: overrides.title,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Remember to halve the middle coefficient before squaring it." }] }] },
    math_blocks: [],
    pinned: false,
    created_at: day(0),
    updated_at: day(2),
  };
  return {
    content: note.content,
    excerpt: "Remember to halve the middle coefficient",
    searchText: "",
    updated_at: day(2),
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
    quickOpenUrl: `/notes/n/${overrides.id}`,
    quickJumpToBinderUrl: null,
    note,
    reviewLater: false,
    ...overrides,
  };
}

describe("workspace search index", () => {
  it("indexes visible binders, folders, and every lesson with its reader URL", () => {
    const items = buildDashboardSearchItems(dashboard);

    expect(items.find((item) => item.key === "binder:binder-algebra")).toMatchObject({
      href: "/binders/binder-algebra",
      subtitle: "Math · 8 lessons",
    });
    expect(items.find((item) => item.key === "lesson:lesson-old")).toMatchObject({
      href: "/binders/binder-algebra/documents/lesson-old",
      subtitle: "Algebra 1 Foundations · Math",
      title: "Completing the Square",
    });
    expect(items.find((item) => item.key === "folder:folder-math")).toMatchObject({
      href: "/folders/folder-math",
      subtitle: "1 binder",
    });
    // Placeholder drafts stay hidden in search, just like on the dashboard.
    expect(items.some((item) => item.key.includes("placeholder"))).toBe(false);
  });

  it("finds a lesson that is not among the recent ones", () => {
    const items = buildDashboardSearchItems(dashboard);
    expect(dashboard.recentLessons.some((recent) => recent.id === "lesson-old")).toBe(false);

    const [top] = searchWorkspaceItems(items, createSearchQuery("square completing"));
    expect(top.item.href).toBe("/binders/binder-algebra/documents/lesson-old");
  });

  it("only indexes personal notes owned by the signed-in account and opens their current route", () => {
    const foreign = entry({ id: "foreign-note", kind: "personal-note", title: "Someone else's square notes" });
    foreign.note = { ...foreign.note, owner_id: "user-2" };
    const items = buildPersonalNoteSearchItems(
      [
        entry({ id: "loose-1", kind: "personal-note", title: "Square tricks" }),
        entry({
          id: "doc-1",
          kind: "personal-document",
          title: "Unit review",
          personalBinderId: "pb-1",
          personalBinderTitle: "Jacob Math Notes",
          quickOpenUrl: "/notes/binders/pb-1/documents/doc-1",
        }),
        entry({
          id: "linked-1",
          kind: "binder-note",
          title: "My square notes",
          sourceBinderTitle: "Algebra 1 Foundations",
          sourceDocumentTitle: "Completing the Square",
        }),
        foreign,
      ],
      "user-1",
    );

    expect(items.map((item) => item.key)).toEqual(["note:loose-1", "note:doc-1", "note:linked-1"]);
    expect(items.map((item) => [item.href, item.badge, item.subtitle])).toEqual([
      ["/notes/n/loose-1", "Note", "Loose note"],
      ["/notes/binders/pb-1/documents/doc-1", "Notebook", "Jacob Math Notes"],
      ["/notes/n/linked-1", "Linked", "Algebra 1 Foundations · Completing the Square"],
    ]);
  });

  it("finds notes by their text and builds a readable snippet", () => {
    const items = buildPersonalNoteSearchItems([entry({ id: "loose-1", kind: "personal-note", title: "Square tricks" })], "user-1");
    const query = createSearchQuery("coefficient halve");
    const [hit] = searchWorkspaceItems(items, query);

    expect(hit.item.key).toBe("note:loose-1");
    expect(buildSearchSnippet(hit.item.bodyText, query)).toBe("Remember to halve the middle coefficient before squaring it.");
    expect(buildSearchSnippet(`${"Earlier context ".repeat(12)}halve the middle term`, createSearchQuery("halve"))).toMatch(
      /^….*halve the middle term$/,
    );
  });

  it("groups hits per kind with limits and puts the strongest group first", () => {
    const items = [
      ...buildDashboardSearchItems(dashboard),
      ...buildNavigationSearchItems([{ key: "page:/math/lab", label: "Math lab", href: "/math/lab", keywords: "graph calculator" }]),
    ];
    const practiceGroups = groupWorkspaceSearchHits(searchWorkspaceItems(items, createSearchQuery("practice")));
    expect(practiceGroups[0]).toMatchObject({ kind: "lesson", total: 7 });
    expect(practiceGroups[0].hits).toHaveLength(6);

    const labGroups = groupWorkspaceSearchHits(searchWorkspaceItems(items, createSearchQuery("math lab")));
    expect(labGroups[0].kind).toBe("page");
    expect(labGroups[0].hits[0].item.href).toBe("/math/lab");
  });

  it("offers recent lessons and notes when nothing is typed", () => {
    const items = buildDashboardSearchItems(dashboard);
    expect(pickRecentLessonItems(items, dashboard.recentLessons, 2).map((item) => item.key)).toEqual([
      "lesson:lesson-6",
      "lesson:lesson-5",
    ]);

    const notes = buildPersonalNoteSearchItems(
      [
        entry({ id: "older", kind: "personal-note", title: "Older", updated_at: day(1) }),
        entry({ id: "newer", kind: "personal-note", title: "Newer", updated_at: day(5) }),
      ],
      "user-1",
    );
    expect(pickRecentNoteItems(notes).map((item) => item.key)).toEqual(["note:newer", "note:older"]);
  });
});
