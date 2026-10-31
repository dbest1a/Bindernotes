import type { BinderLesson, DashboardData, PersonalNotesEntry } from "@/types";
import {
  deriveBinderTitle,
  deriveLessonTitle,
  extractPlainText,
  getDisplayTitle,
  isPlaceholderBinder,
} from "@/lib/workspace-records";
import {
  prepareSearchText,
  scoreSearchFields,
  type PreparedSearchText,
  type SearchQuery,
} from "@/lib/search/text-match";

export type WorkspaceSearchKind = "lesson" | "note" | "binder" | "folder" | "page";

export type WorkspaceSearchItem = {
  key: string;
  kind: WorkspaceSearchKind;
  title: string;
  subtitle: string;
  badge?: string;
  pinned?: boolean;
  /** Router path to open; empty for in-app actions that run a callback instead. */
  href: string;
  updatedAt: number;
  primary: PreparedSearchText;
  secondary: PreparedSearchText;
  body?: PreparedSearchText;
  bodyText?: string;
};

export type WorkspaceSearchHit = {
  item: WorkspaceSearchItem;
  score: number;
};

export type WorkspaceSearchGroup = {
  kind: WorkspaceSearchKind;
  hits: WorkspaceSearchHit[];
  total: number;
};

export type NavigationSearchEntry = {
  key: string;
  label: string;
  href?: string;
  description?: string;
  keywords?: string;
};

export const workspaceSearchGroupOrder: readonly WorkspaceSearchKind[] = ["lesson", "note", "binder", "folder", "page"];

export const workspaceSearchGroupLimits: Readonly<Record<WorkspaceSearchKind, number>> = {
  lesson: 6,
  note: 6,
  binder: 4,
  folder: 3,
  page: 4,
};

// Notes are searched by their opening text; long bodies are trimmed so typing stays instant.
const NOTE_BODY_SEARCH_LIMIT = 2_000;
const SNIPPET_LENGTH = 96;

/** Lessons, binders, and folders the dashboard already shows this account. */
export function buildDashboardSearchItems(data: DashboardData): WorkspaceSearchItem[] {
  const lessonsByBinderId = groupBy(data.lessons, (lesson) => lesson.binder_id);
  const notesByBinderId = groupBy(data.notes, (note) => note.binder_id);
  const foldersById = new Map(data.folders.map((folder) => [folder.id, folder]));
  const folderNameByBinderId = new Map<string, string>();
  for (const link of data.folderBinders) {
    const folder = foldersById.get(link.folder_id);
    if (folder && !folderNameByBinderId.has(link.binder_id)) {
      folderNameByBinderId.set(link.binder_id, getDisplayTitle(folder.name, "Recovered Folder"));
    }
  }

  const items: WorkspaceSearchItem[] = [];
  const visibleBinderTitles = new Map<string, string>();
  for (const binder of data.binders) {
    const lessons = lessonsByBinderId.get(binder.id) ?? [];
    if (isPlaceholderBinder({ binder, lessons, notes: notesByBinderId.get(binder.id) ?? [] })) {
      continue;
    }

    const title = deriveBinderTitle(binder, lessons);
    const folderName = folderNameByBinderId.get(binder.id) ?? null;
    visibleBinderTitles.set(binder.id, title);
    items.push({
      key: `binder:${binder.id}`,
      kind: "binder",
      title,
      subtitle: joinParts([binder.subject, folderName, countLabel(lessons.length, "lesson")]),
      href: `/binders/${binder.id}`,
      updatedAt: toTimestamp(binder.updated_at),
      primary: prepareSearchText(title),
      secondary: prepareSearchText(joinParts([binder.subject, binder.level, folderName], " ")),
      body: prepareSearchText(binder.description),
    });
  }

  for (const lesson of data.lessons) {
    const binderTitle = visibleBinderTitles.get(lesson.binder_id);
    if (!binderTitle) {
      continue;
    }

    const title = deriveLessonTitle(lesson);
    const folderName = folderNameByBinderId.get(lesson.binder_id) ?? null;
    items.push({
      key: `lesson:${lesson.id}`,
      kind: "lesson",
      title,
      subtitle: joinParts([binderTitle, folderName]),
      href: `/binders/${lesson.binder_id}/documents/${lesson.id}`,
      updatedAt: toTimestamp(lesson.updated_at),
      primary: prepareSearchText(title),
      secondary: prepareSearchText(joinParts([binderTitle, folderName], " ")),
    });
  }

  for (const folder of data.folders) {
    const binderCount = data.folderBinders.filter(
      (link) => link.folder_id === folder.id && visibleBinderTitles.has(link.binder_id),
    ).length;
    const title = getDisplayTitle(folder.name, "Recovered Folder");
    items.push({
      key: `folder:${folder.id}`,
      kind: "folder",
      title,
      subtitle: countLabel(binderCount, "binder"),
      href: `/folders/${folder.id}`,
      updatedAt: toTimestamp(folder.updated_at),
      primary: prepareSearchText(title),
      secondary: prepareSearchText(""),
    });
  }

  return items;
}

/** Personal notes, notebook documents, and binder-linked notes owned by this account. */
export function buildPersonalNoteSearchItems(
  entries: readonly PersonalNotesEntry[],
  ownerId: string,
): WorkspaceSearchItem[] {
  return entries
    .filter((entry) => entry.note.owner_id === ownerId)
    .map((entry) => {
      const folderName = entry.folderName && entry.folderName !== "Unfiled" ? entry.folderName : null;
      const subtitle =
        entry.kind === "binder-note"
          ? joinParts([entry.sourceBinderTitle, entry.sourceDocumentTitle])
          : entry.kind === "personal-document"
            ? joinParts([entry.personalBinderTitle, folderName])
            : joinParts([entry.personalBinderTitle, folderName ?? "Loose note"]);
      const bodyText = (extractPlainText(entry.content) || entry.excerpt).slice(0, NOTE_BODY_SEARCH_LIMIT);

      return {
        key: `note:${entry.id}`,
        kind: "note" as const,
        title: entry.title || "Untitled note",
        subtitle,
        badge: entry.kind === "binder-note" ? "Linked" : entry.kind === "personal-document" ? "Notebook" : "Note",
        pinned: entry.pinned,
        href: entry.quickOpenUrl,
        updatedAt: toTimestamp(entry.updated_at),
        primary: prepareSearchText(entry.title),
        secondary: prepareSearchText(
          joinParts(
            [
              entry.folderName,
              entry.personalBinderTitle,
              entry.sourceBinderTitle,
              entry.sourceDocumentTitle,
              entry.tags.join(" "),
            ],
            " ",
          ),
        ),
        body: prepareSearchText(bodyText),
        bodyText,
      };
    });
}

/** App pages and in-app actions, listed in the order they should appear. */
export function buildNavigationSearchItems(entries: readonly NavigationSearchEntry[]): WorkspaceSearchItem[] {
  return entries.map((entry, index) => ({
    key: entry.key,
    kind: "page" as const,
    title: entry.label,
    subtitle: entry.description ?? "",
    href: entry.href ?? "",
    updatedAt: -index,
    primary: prepareSearchText(entry.label),
    secondary: prepareSearchText(joinParts([entry.description, entry.keywords], " ")),
  }));
}

export function searchWorkspaceItems(
  items: readonly WorkspaceSearchItem[],
  query: SearchQuery,
): WorkspaceSearchHit[] {
  const hits: WorkspaceSearchHit[] = [];
  for (const item of items) {
    const score = scoreSearchFields(query, [
      { text: item.primary, weight: 1 },
      { text: item.secondary, weight: 0.7 },
      { text: item.body, weight: 0.45, typos: false },
    ]);
    if (score !== null) {
      hits.push({ item, score: score + (item.pinned ? 0.02 : 0) });
    }
  }

  return hits.sort((left, right) => right.score - left.score || right.item.updatedAt - left.item.updatedAt);
}

/**
 * Keeps the best few hits per kind. Groups are ordered by their strongest
 * hit so an exact page or binder match is never buried under weaker lessons.
 */
export function groupWorkspaceSearchHits(
  hits: readonly WorkspaceSearchHit[],
  limits: Readonly<Record<WorkspaceSearchKind, number>> = workspaceSearchGroupLimits,
): WorkspaceSearchGroup[] {
  const groups = new Map<WorkspaceSearchKind, WorkspaceSearchGroup>();
  for (const hit of hits) {
    const group = groups.get(hit.item.kind) ?? { kind: hit.item.kind, hits: [], total: 0 };
    group.total += 1;
    if (group.hits.length < limits[hit.item.kind]) {
      group.hits.push(hit);
    }
    groups.set(hit.item.kind, group);
  }

  return [...groups.values()].sort(
    (left, right) =>
      right.hits[0].score - left.hits[0].score ||
      workspaceSearchGroupOrder.indexOf(left.kind) - workspaceSearchGroupOrder.indexOf(right.kind),
  );
}

export function pickRecentLessonItems(
  items: readonly WorkspaceSearchItem[],
  recentLessons: readonly Pick<BinderLesson, "id">[],
  limit = 4,
): WorkspaceSearchItem[] {
  const lessonsByKey = new Map(items.filter((item) => item.kind === "lesson").map((item) => [item.key, item]));
  return recentLessons
    .map((lesson) => lessonsByKey.get(`lesson:${lesson.id}`))
    .filter((item): item is WorkspaceSearchItem => Boolean(item))
    .slice(0, limit);
}

export function pickRecentNoteItems(items: readonly WorkspaceSearchItem[], limit = 4): WorkspaceSearchItem[] {
  return items
    .filter((item) => item.kind === "note")
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, limit);
}

/** A short excerpt around the first query word, for notes matched by their text. */
export function buildSearchSnippet(text: string | undefined, query: SearchQuery, maxLength = SNIPPET_LENGTH) {
  if (!text || query.tokens.length === 0) {
    return null;
  }

  const folded = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const sameLength = folded.length === text.length;
  let matchIndex = -1;
  for (const token of query.requiredTokens) {
    const index = sameLength ? folded.indexOf(token) : text.toLowerCase().indexOf(token);
    if (index !== -1 && (matchIndex === -1 || index < matchIndex)) {
      matchIndex = index;
    }
  }
  if (matchIndex === -1) {
    return null;
  }

  let start = Math.max(0, matchIndex - Math.floor(maxLength / 3));
  if (start > 0) {
    const nextSpace = text.indexOf(" ", start);
    start = nextSpace !== -1 && nextSpace < matchIndex ? nextSpace + 1 : start;
  }
  let end = Math.min(text.length, start + maxLength);
  if (end < text.length) {
    const lastSpace = text.lastIndexOf(" ", end);
    end = lastSpace > matchIndex ? lastSpace : end;
  }

  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function groupBy<T>(values: readonly T[], keyOf: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key);
    if (group) {
      group.push(value);
    } else {
      groups.set(key, [value]);
    }
  }
  return groups;
}

function joinParts(parts: ReadonlyArray<string | null | undefined>, separator = " · ") {
  const seen = new Set<string>();
  return parts
    .filter((part): part is string => {
      const key = part?.trim().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(separator);
}

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function toTimestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}
