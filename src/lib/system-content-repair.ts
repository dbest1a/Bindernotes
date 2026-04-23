import { demoBinders } from "@/lib/demo-data";
import {
  buildSystemFolderFromSuite,
  frenchRevolutionBinder,
  SYSTEM_BINDER_IDS,
  SYSTEM_SUITE_IDS,
  systemSuiteTemplates,
} from "@/lib/history-suite-seeds";
import {
  deriveBinderTitle,
  isPlaceholderBinder,
  isPlaceholderDocument,
  isPlaceholderTitle,
  noteHasMeaningfulContent,
} from "@/lib/workspace-records";
import type {
  Binder,
  BinderLesson,
  Folder,
  FolderBinderLink,
  Highlight,
  LearnerNote,
} from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type RepairComment = {
  id: string;
  owner_id?: string;
  binder_id: string;
  lesson_id: string;
};

export type SystemRepairDataset = {
  binders: Binder[];
  lessons: BinderLesson[];
  folders: Folder[];
  folderBinders: FolderBinderLink[];
  notes: LearnerNote[];
  highlights: Highlight[];
  comments: RepairComment[];
};

export type SystemRepairAction =
  | {
      type: "rename-binder";
      id: string;
      ownerId: string;
      nextTitle: string;
      reason: string;
    }
  | {
      type: "archive-binder";
      id: string;
      ownerId: string;
      reason: string;
    };

export type SystemRepairPlan = {
  actions: SystemRepairAction[];
  summary: {
    canonicalSystemBinders: number;
    placeholderSystemBinders: number;
    placeholderSystemLessons: number;
    actionsPlanned: number;
  };
};

type RepairableClient = Pick<SupabaseClient, "from">;
const CANONICAL_DEMO_BINDER_IDS = new Set<string>([
  SYSTEM_BINDER_IDS.algebra,
  SYSTEM_BINDER_IDS.riseOfRome,
]);

const CANONICAL_SYSTEM_BINDERS = new Map<string, Binder>(
  [...demoBinders.filter((binder) => CANONICAL_DEMO_BINDER_IDS.has(binder.id)), frenchRevolutionBinder].map(
    (binder) => [binder.id, binder],
  ),
);

const SYSTEM_FOLDER_IDS = new Set(systemSuiteTemplates.map((suite) => buildSystemFolderFromSuite(suite).id));
const SYSTEM_SUITE_IDS_SET = new Set<string>(Object.values(SYSTEM_SUITE_IDS));
const SYSTEM_BINDER_IDS_SET = new Set<string>(Object.values(SYSTEM_BINDER_IDS));

export function planSystemContentRepair(dataset: SystemRepairDataset): SystemRepairPlan {
  const lessonsByBinderId = groupBy(dataset.lessons, (lesson) => lesson.binder_id);
  const notesByBinderId = groupBy(dataset.notes, (note) => note.binder_id);
  const highlightsByBinderId = groupBy(dataset.highlights, (highlight) => highlight.binder_id);
  const commentsByBinderId = groupBy(dataset.comments, (comment) => comment.binder_id);
  const folderIdsByBinderId = dataset.folderBinders.reduce<Record<string, string[]>>((entries, link) => {
    entries[link.binder_id] = [...(entries[link.binder_id] ?? []), link.folder_id];
    return entries;
  }, {});

  const canonicalOwnerIds = new Set(
    dataset.binders
      .filter((binder) => SYSTEM_BINDER_IDS_SET.has(binder.id))
      .map((binder) => binder.owner_id),
  );

  const actions: SystemRepairAction[] = [];

  dataset.binders.forEach((binder) => {
    const lessons = lessonsByBinderId[binder.id] ?? [];
    const notes = notesByBinderId[binder.id] ?? [];
    const highlights = highlightsByBinderId[binder.id] ?? [];
    const comments = commentsByBinderId[binder.id] ?? [];
    const folderIds = folderIdsByBinderId[binder.id] ?? [];
    const isCanonicalSystemBinder = SYSTEM_BINDER_IDS_SET.has(binder.id);
    const isSystemScoped = isSystemScopedBinderCandidate(
      binder,
      folderIds,
      canonicalOwnerIds,
      isCanonicalSystemBinder,
    );

    if (!isSystemScoped) {
      return;
    }

    const meaningfulLessons = lessons.filter(
      (lesson) =>
        !isPlaceholderDocument({
          lesson,
          notes: dataset.notes.filter((note) => note.lesson_id === lesson.id),
          highlights: dataset.highlights.filter((highlight) => highlight.lesson_id === lesson.id),
        }),
    );
    const hasPrivateActivity =
      notes.some((note) => noteHasMeaningfulContent(note)) ||
      highlights.length > 0 ||
      comments.length > 0;

    if (isPlaceholderTitle(binder.title)) {
      const canonical = CANONICAL_SYSTEM_BINDERS.get(binder.id);
      const repairedTitle =
        canonical?.title ??
        (meaningfulLessons.length > 0 ? deriveBinderTitle(binder, meaningfulLessons) : null);

      if (repairedTitle && repairedTitle !== binder.title.trim()) {
        actions.push({
          type: "rename-binder",
          id: binder.id,
          ownerId: binder.owner_id,
          nextTitle: repairedTitle,
          reason: isCanonicalSystemBinder
            ? "Restore canonical system binder title."
            : "Recover a contentful system binder title from real lesson content.",
        });
        return;
      }
    }

    if (
      !isCanonicalSystemBinder &&
      isEmptySystemPlaceholderBinder(binder, lessons, notes, highlights, hasPrivateActivity) &&
      !hasPrivateActivity
    ) {
      actions.push({
        type: "archive-binder",
        id: binder.id,
        ownerId: binder.owner_id,
        reason: "Archive empty duplicate system placeholder binder.",
      });
    }
  });

  const placeholderSystemBinders = dataset.binders.filter((binder) => {
    const folderIds = folderIdsByBinderId[binder.id] ?? [];
    return isSystemScopedBinderCandidate(
      binder,
      folderIds,
      canonicalOwnerIds,
      SYSTEM_BINDER_IDS_SET.has(binder.id),
    ) && isPlaceholderTitle(binder.title);
  }).length;

  const placeholderSystemLessons = dataset.lessons.filter((lesson) => {
    const binder = dataset.binders.find((candidate) => candidate.id === lesson.binder_id);
    if (!binder) {
      return false;
    }
    const folderIds = folderIdsByBinderId[binder.id] ?? [];
    return (
      isSystemScopedBinderCandidate(
        binder,
        folderIds,
        canonicalOwnerIds,
        SYSTEM_BINDER_IDS_SET.has(binder.id),
      ) && isPlaceholderTitle(lesson.title)
    );
  }).length;

  return {
    actions,
    summary: {
      canonicalSystemBinders: dataset.binders.filter((binder) => SYSTEM_BINDER_IDS_SET.has(binder.id)).length,
      placeholderSystemBinders,
      placeholderSystemLessons,
      actionsPlanned: actions.length,
    },
  };
}

export async function applySystemRepairPlan(
  client: RepairableClient,
  plan: SystemRepairPlan,
  options?: { apply?: boolean; now?: string },
) {
  const apply = options?.apply ?? false;
  if (!apply) {
    return {
      applied: false,
      actionCount: plan.actions.length,
    };
  }

  const updatedAt = options?.now ?? new Date().toISOString();
  for (const action of plan.actions) {
    if (action.type === "rename-binder") {
      const { error } = await client
        .from("binders")
        .update({ title: action.nextTitle, updated_at: updatedAt })
        .eq("id", action.id)
        .eq("owner_id", action.ownerId);
      if (error) {
        throw error;
      }
    }

    if (action.type === "archive-binder") {
      const { error } = await client
        .from("binders")
        .update({ status: "archived", updated_at: updatedAt })
        .eq("id", action.id)
        .eq("owner_id", action.ownerId);
      if (error) {
        throw error;
      }
    }
  }

  return {
    applied: true,
    actionCount: plan.actions.length,
  };
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((entries, item) => {
    const key = getKey(item);
    entries[key] = [...(entries[key] ?? []), item];
    return entries;
  }, {});
}

function isSystemScopedBinderCandidate(
  binder: Binder,
  folderIds: string[],
  canonicalOwnerIds: Set<string>,
  isCanonicalSystemBinder: boolean,
) {
  return (
    isCanonicalSystemBinder ||
    Boolean(binder.suite_template_id && SYSTEM_SUITE_IDS_SET.has(binder.suite_template_id)) ||
    folderIds.some((folderId) => SYSTEM_FOLDER_IDS.has(folderId)) ||
    canonicalOwnerIds.has(binder.owner_id)
  );
}

function isEmptySystemPlaceholderBinder(
  binder: Binder,
  lessons: BinderLesson[],
  notes: LearnerNote[],
  highlights: Highlight[],
  hasPrivateActivity: boolean,
) {
  if (
    !isPlaceholderTitle(binder.title) ||
    hasPrivateActivity
  ) {
    return false;
  }

  const hasMeaningfulLessons = lessons.some((lesson) =>
    !isPlaceholderDocument({
      lesson,
      notes: notes.filter((note) => note.lesson_id === lesson.id),
      highlights: highlights.filter((highlight) => highlight.lesson_id === lesson.id),
    }),
  );

  return (
    !hasMeaningfulLessons &&
    (isPlaceholderBinder({
      binder,
      lessons,
      notes,
      highlights,
    }) || (!binder.pinned && lessons.length === 0 && notes.length === 0 && highlights.length === 0))
  );
}
