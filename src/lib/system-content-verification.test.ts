import { describe, expect, it } from "vitest";
import { SYSTEM_BINDER_IDS, SYSTEM_SEED_VERSION, SYSTEM_SUITE_IDS } from "@/lib/history-suite-seeds";
import { buildSystemVerificationReport } from "@/lib/system-content-verification";
import type { Binder, BinderLesson, Folder, FolderBinderLink } from "@/types";

function makeBinder(overrides: Partial<Binder>): Binder {
  return {
    id: SYSTEM_BINDER_IDS.algebra,
    owner_id: "system-owner",
    suite_template_id: SYSTEM_SUITE_IDS.algebra,
    title: "Algebra 1 Foundations",
    slug: "algebra-1-foundations",
    description: "Real seeded binder",
    subject: "Mathematics",
    level: "Algebra 1",
    status: "published",
    price_cents: 0,
    cover_url: null,
    pinned: true,
    created_at: "2026-04-22T00:00:00.000Z",
    updated_at: "2026-04-22T00:00:00.000Z",
    ...overrides,
  };
}

function makeLesson(overrides: Partial<BinderLesson>): BinderLesson {
  return {
    id: "lesson-algebra-1",
    binder_id: SYSTEM_BINDER_IDS.algebra,
    title: "Solving equations",
    order_index: 1,
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Solve for x." }] }],
    },
    math_blocks: [],
    is_preview: false,
    created_at: "2026-04-22T00:00:00.000Z",
    updated_at: "2026-04-22T00:00:00.000Z",
    ...overrides,
  };
}

function makeDataset() {
  const folders: Folder[] = [
    {
      id: `folder-${SYSTEM_SUITE_IDS.algebra}`,
      owner_id: "system-owner",
      name: "Math Foundations",
      color: "rose",
      source: "system",
      suite_template_id: SYSTEM_SUITE_IDS.algebra,
      created_at: "2026-04-22T00:00:00.000Z",
      updated_at: "2026-04-22T00:00:00.000Z",
    },
  ];
  const folderBinders: FolderBinderLink[] = [
    {
      id: "folder-link",
      owner_id: "system-owner",
      folder_id: folders[0].id,
      binder_id: SYSTEM_BINDER_IDS.algebra,
      created_at: "2026-04-22T00:00:00.000Z",
      updated_at: "2026-04-22T00:00:00.000Z",
    },
  ];

  return {
    binders: [makeBinder({})],
    lessons: [makeLesson({})],
    folders,
    folderBinders,
    notes: [],
    highlights: [],
    comments: [],
  };
}

describe("system content verification", () => {
  it("passes when Algebra and the seed foundation are present", () => {
    const report = buildSystemVerificationReport({
      counts: {
        suiteTemplates: 3,
        seedVersions: 3,
        workspacePresets: 15,
        folders: 3,
        folderBinders: 3,
        binders: 3,
        lessons: 20,
      },
      seedVersions: [
        {
          suite_template_id: SYSTEM_SUITE_IDS.algebra,
          version: SYSTEM_SEED_VERSION,
          status: "current",
        },
      ],
      binders: [makeBinder({})],
      dataset: makeDataset(),
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary.algebraLessonCount).toBe(1);
  });

  it("fails clearly when Algebra is missing", () => {
    const report = buildSystemVerificationReport({
      counts: {
        suiteTemplates: 3,
        seedVersions: 3,
        workspacePresets: 15,
        folders: 3,
        folderBinders: 0,
        binders: 0,
        lessons: 0,
      },
      seedVersions: [],
      binders: [],
      dataset: {
        binders: [],
        lessons: [],
        folders: [],
        folderBinders: [],
        notes: [],
        highlights: [],
        comments: [],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        "binder-algebra-foundations is missing.",
        "Algebra 1 Foundations has no lessons.",
        `${SYSTEM_SEED_VERSION} is missing from public.seed_versions.`,
      ]),
    );
  });

  it("fails when placeholder public system binders still need repair", () => {
    const dataset = makeDataset();
    const placeholderBinder = makeBinder({
      id: "binder-duplicate",
      title: "Untitled math binder",
      slug: "untitled-math-binder",
      pinned: false,
      status: "published",
      suite_template_id: SYSTEM_SUITE_IDS.algebra,
      description: "",
    });
    dataset.binders.push(placeholderBinder);

    const report = buildSystemVerificationReport({
      counts: {
        suiteTemplates: 3,
        seedVersions: 3,
        workspacePresets: 15,
        folders: 3,
        folderBinders: 3,
        binders: 3,
        lessons: 20,
      },
      seedVersions: [
        {
          suite_template_id: SYSTEM_SUITE_IDS.algebra,
          version: SYSTEM_SEED_VERSION,
          status: "current",
        },
      ],
      binders: dataset.binders,
      dataset,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        "Placeholder public system binders are still visible.",
        "System placeholder repair actions are still pending.",
      ]),
    );
  });
});
