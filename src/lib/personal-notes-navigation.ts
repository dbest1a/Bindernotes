import type { PersonalNotesEntry, PersonalNotesSourceFilter } from "@/types";

export type NotebookCategory = {
  id: string;
  label: string;
  count: number;
  color: string;
  sourceFilter: PersonalNotesSourceFilter;
  folderName: string | null;
};
export type NotebookSidebarLevel = "scopes" | "binders" | "binder";
export type NotebookBinderNode = {
  id: string;
  groupId: string;
  title: string;
  count: number;
  entries: PersonalNotesEntry[];
  scopeId: string;
  scopeLabel: string;
  sourceUrl: string | null;
  kind: "source-binder" | "personal-binder";
};
export type NotebookHierarchy = {
  bindersById: Map<string, NotebookBinderNode>;
  bindersByScope: Record<string, NotebookBinderNode[]>;
};
export function buildNotebookCategories(
  entries: PersonalNotesEntry[],
  showBinderNotes: boolean,
): NotebookCategory[] {
  const visible = showBinderNotes ? entries : entries.filter((entry) => entry.kind !== "binder-note");
  const folderCount = (label: string) => visible.filter((entry) => entry.folderName === label).length;
  const looseCount = visible.filter((entry) => entry.kind === "personal-note").length;
  const linkedCount = visible.filter((entry) => entry.kind === "binder-note").length;

  const categories: NotebookCategory[] = [
    {
      id: "all",
      label: "All notes",
      count: visible.length,
      color: "hsl(var(--primary))",
      sourceFilter: "all",
      folderName: null,
    },
    {
      id: "history",
      label: "History",
      count: folderCount("History"),
      color: "#14b8a6",
      sourceFilter: "all",
      folderName: "History",
    },
    {
      id: "math",
      label: "Math",
      count: folderCount("Math"),
      color: "#3b82f6",
      sourceFilter: "all",
      folderName: "Math",
    },
    {
      id: "chemistry",
      label: "Chemistry",
      count: folderCount("Chemistry"),
      color: "#22c55e",
      sourceFilter: "all",
      folderName: "Chemistry",
    },
    {
      id: "other",
      label: "Other",
      count: folderCount("Other"),
      color: "#a855f7",
      sourceFilter: "all",
      folderName: "Other",
    },
    {
      id: "unfiled",
      label: "Unfiled",
      count: folderCount("Unfiled"),
      color: "#94a3b8",
      sourceFilter: "all",
      folderName: "Unfiled",
    },
    {
      id: "loose",
      label: "Loose notes",
      count: looseCount,
      color: "#f59e0b",
      sourceFilter: "loose",
      folderName: null,
    },
  ];

  if (showBinderNotes) {
    categories.push({
      id: "binder-linked",
      label: "Binder-linked",
      count: linkedCount,
      color: "#60a5fa",
      sourceFilter: "binder-linked",
      folderName: null,
    });
  }

  return categories;
}

export function resolveSelectedCategoryId(
  categories: NotebookCategory[],
  sourceFilter: PersonalNotesSourceFilter,
  folderFilter: string | null,
) {
  return (
    categories.find(
      (category) =>
        category.sourceFilter === sourceFilter && (category.folderName ?? null) === (folderFilter ?? null),
    )?.id ?? "all"
  );
}

export function entriesForNotebookCategory(entries: PersonalNotesEntry[], category: NotebookCategory) {
  if (category.id === "all") {
    return entries;
  }
  if (category.sourceFilter === "binder-linked") {
    return entries.filter((entry) => entry.kind === "binder-note");
  }
  if (category.sourceFilter === "loose") {
    return entries.filter((entry) => entry.kind === "personal-note");
  }
  if (category.folderName) {
    return entries.filter((entry) => entry.folderName === category.folderName);
  }
  return [];
}

export function buildNotebookHierarchy(
  entries: PersonalNotesEntry[],
  categories: NotebookCategory[],
): NotebookHierarchy {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const bindersByScope = new Map<string, Map<string, NotebookBinderNode>>();

  const addBinderEntry = (
    scopeId: string,
    groupId: string,
    entry: PersonalNotesEntry,
    title: string,
    kind: NotebookBinderNode["kind"],
  ) => {
    const scope = categoriesById.get(scopeId) ?? categoriesById.get("all");
    const scopedId = `${scopeId}:${groupId}`;
    const scopeBinders = bindersByScope.get(scopeId) ?? new Map<string, NotebookBinderNode>();
    const existing = scopeBinders.get(scopedId);
    if (existing) {
      if (!existing.entries.some((candidate) => candidate.kind === entry.kind && candidate.id === entry.id)) {
        existing.entries.push(entry);
        existing.count = existing.entries.length;
      }
      return;
    }

    scopeBinders.set(scopedId, {
      id: scopedId,
      groupId,
      title,
      count: 1,
      entries: [entry],
      scopeId,
      scopeLabel: scope?.label ?? notebookScopeLabel(scopeId),
      sourceUrl: entry.quickJumpToBinderUrl,
      kind,
    });
    bindersByScope.set(scopeId, scopeBinders);
  };

  entries.forEach((entry) => {
    const binderGroup = notebookBinderGroupForEntry(entry);
    if (!binderGroup) {
      return;
    }
    const scopeId = notebookScopeIdForEntry(entry);
    addBinderEntry("all", binderGroup.id, entry, binderGroup.title, binderGroup.kind);
    addBinderEntry(scopeId, binderGroup.id, entry, binderGroup.title, binderGroup.kind);
    if (entry.kind === "binder-note") {
      addBinderEntry("binder-linked", binderGroup.id, entry, binderGroup.title, binderGroup.kind);
    }
  });

  const normalizedByScope: Record<string, NotebookBinderNode[]> = {};
  const bindersById = new Map<string, NotebookBinderNode>();
  categories.forEach((category) => {
    const sorted = Array.from(bindersByScope.get(category.id)?.values() ?? []).sort((left, right) =>
      left.title.localeCompare(right.title),
    );
    normalizedByScope[category.id] = sorted;
    sorted.forEach((binder) => bindersById.set(binder.id, binder));
  });

  return { bindersById, bindersByScope: normalizedByScope };
}

function notebookBinderGroupForEntry(
  entry: PersonalNotesEntry,
): { id: string; title: string; kind: NotebookBinderNode["kind"] } | null {
  if (entry.kind === "binder-note") {
    const id = entry.sourceBinderId ?? entry.sourceBinderTitle ?? "unknown-source-binder";
    return {
      id: `source:${id}`,
      title: entry.sourceBinderTitle ?? "Source binder",
      kind: "source-binder",
    };
  }
  if (entry.kind === "personal-document" || entry.personalBinderId) {
    const id = entry.personalBinderId ?? entry.sourceBinderId ?? entry.id;
    return {
      id: `personal:${id}`,
      title: entry.personalBinderTitle ?? entry.sourceBinderTitle ?? "Personal binder",
      kind: "personal-binder",
    };
  }
  return null;
}

function notebookScopeIdForEntry(entry: PersonalNotesEntry) {
  const folderName = entry.folderName.trim().toLowerCase();
  if (folderName === "math") {
    return "math";
  }
  if (folderName === "history") {
    return "history";
  }
  if (folderName === "chemistry") {
    return "chemistry";
  }
  if (folderName === "unfiled" || !folderName) {
    return "unfiled";
  }
  return "other";
}

export function structuredScopeIdForEntry(entry: PersonalNotesEntry) {
  if (entry.kind === "personal-note" && !entry.personalBinderId) {
    return "loose";
  }
  return notebookScopeIdForEntry(entry);
}

export function notebookScopeLabel(scopeId: string) {
  switch (scopeId) {
    case "all":
      return "All notes";
    case "history":
      return "History";
    case "math":
      return "Math";
    case "chemistry":
      return "Chemistry";
    case "other":
      return "Other";
    case "unfiled":
      return "Unfiled";
    case "loose":
      return "Loose notes";
    case "binder-linked":
      return "Binder-linked";
    default:
      return "Notebook";
  }
}
