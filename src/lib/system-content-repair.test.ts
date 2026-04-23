import { describe, expect, it, vi } from "vitest";
import { SYSTEM_BINDER_IDS, SYSTEM_SUITE_IDS } from "@/lib/history-suite-seeds";
import {
  applySystemRepairPlan,
  planSystemContentRepair,
  type SystemRepairDataset,
} from "@/lib/system-content-repair";
import type { Binder, BinderLesson, Folder, FolderBinderLink } from "@/types";

function makeBinder(overrides: Partial<Binder>): Binder {
  return {
    id: "binder-test",
    owner_id: "system-owner",
    suite_template_id: SYSTEM_SUITE_IDS.algebra,
    title: "Untitled math binder",
    slug: "untitled-math-binder",
    description: "",
    subject: "Mathematics",
    level: "Algebra 1",
    status: "draft",
    price_cents: 0,
    cover_url: null,
    pinned: false,
    created_at: "2026-04-22T00:00:00.000Z",
    updated_at: "2026-04-22T00:00:00.000Z",
    ...overrides,
  };
}

function makeLesson(overrides: Partial<BinderLesson> = {}): BinderLesson {
  return {
    id: "lesson-test",
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

function makeDataset(overrides: Partial<SystemRepairDataset> = {}): SystemRepairDataset {
  const folders: Folder[] = [
    {
      id: `folder-${SYSTEM_SUITE_IDS.algebra}`,
      owner_id: "system-owner",
      name: "Math Suite Demo",
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
    binders: [makeBinder({ id: SYSTEM_BINDER_IDS.algebra })],
    lessons: [makeLesson()],
    folders,
    folderBinders,
    notes: [],
    highlights: [],
    comments: [],
    ...overrides,
  };
}

describe("system content repair", () => {
  it("restores a canonical system binder title from the seeded binder id", () => {
    const plan = planSystemContentRepair(makeDataset());

    expect(plan.actions).toEqual([
      expect.objectContaining({
        type: "rename-binder",
        id: SYSTEM_BINDER_IDS.algebra,
        nextTitle: "Algebra 1 Foundations",
      }),
    ]);
  });

  it("archives duplicate empty system placeholder binders but leaves private rows alone", () => {
    const systemDuplicate = makeBinder({
      id: "binder-duplicate",
      owner_id: "system-owner",
      title: "Untitled math binder",
      suite_template_id: null,
      description: "",
    });
    const privateBinder = makeBinder({
      id: "binder-private",
      owner_id: "user-1",
      suite_template_id: null,
      title: "Untitled math binder",
      slug: "private-untitled",
      description: "",
    });

    const plan = planSystemContentRepair(
      makeDataset({
        binders: [
          makeBinder({ id: SYSTEM_BINDER_IDS.algebra }),
          systemDuplicate,
          privateBinder,
        ],
        lessons: [makeLesson()],
        folderBinders: [
          {
            id: "folder-link-canonical",
            owner_id: "system-owner",
            folder_id: `folder-${SYSTEM_SUITE_IDS.algebra}`,
            binder_id: SYSTEM_BINDER_IDS.algebra,
            created_at: "2026-04-22T00:00:00.000Z",
            updated_at: "2026-04-22T00:00:00.000Z",
          },
          {
            id: "folder-link-duplicate",
            owner_id: "system-owner",
            folder_id: `folder-${SYSTEM_SUITE_IDS.algebra}`,
            binder_id: "binder-duplicate",
            created_at: "2026-04-22T00:00:00.000Z",
            updated_at: "2026-04-22T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "archive-binder",
          id: "binder-duplicate",
        }),
      ]),
    );
    expect(plan.actions.find((action) => action.id === "binder-private")).toBeUndefined();
  });

  it("dry-run apply does not mutate Supabase rows", async () => {
    const update = vi.fn();
    const eq = vi.fn().mockReturnThis();
    const from = vi.fn(() => ({
      update: (...args: unknown[]) => {
        update(...args);
        return { eq };
      },
    }));

    const plan = planSystemContentRepair(makeDataset());
    const result = await applySystemRepairPlan({ from } as never, plan, { apply: false });

    expect(result).toEqual({ applied: false, actionCount: plan.actions.length });
    expect(from).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(eq).not.toHaveBeenCalled();
  });

  it("apply only mutates the targeted system binder rows", async () => {
    const eq = vi.fn();
    const query = {
      eq,
    };
    eq.mockImplementationOnce(() => query).mockResolvedValueOnce({ error: null });
    const update = vi.fn(() => query);
    const from = vi.fn(() => ({ update }));

    const plan = planSystemContentRepair(makeDataset());
    const result = await applySystemRepairPlan({ from } as never, plan, {
      apply: true,
      now: "2026-04-22T12:00:00.000Z",
    });

    expect(result).toEqual({ applied: true, actionCount: plan.actions.length });
    expect(from).toHaveBeenCalledWith("binders");
    expect(update).toHaveBeenCalledWith({
      title: "Algebra 1 Foundations",
      updated_at: "2026-04-22T12:00:00.000Z",
    });
    expect(eq).toHaveBeenCalledWith("id", SYSTEM_BINDER_IDS.algebra);
    expect(eq).toHaveBeenCalledWith("owner_id", "system-owner");
  });
});
