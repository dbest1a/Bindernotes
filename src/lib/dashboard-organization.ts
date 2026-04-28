import type { DashboardData } from "@/types";

export const unfiledDashboardFolderId = "__unfiled__";
export const adminDashboardOrganizationStoragePrefix = "binder-notes:admin-dashboard-order";

export type DashboardOrganizationDraft = {
  version: 1;
  folderOrder: string[];
  binderOrder: string[];
  binderFolderIdByBinderId: Record<string, string | null>;
  folderBinderOrderByFolderId: Record<string, string[]>;
  updatedAt: string;
};

export type MoveBinderInput = {
  binderId: string;
  folderId: string | null;
  beforeBinderId?: string | null;
};

function unique(items: string[]) {
  return [...new Set(items)];
}

function now() {
  return new Date().toISOString();
}

function hasSortOrder(value: { sort_order?: number | null }) {
  return typeof value.sort_order === "number";
}

function hasDashboardSortOrder(value: { dashboard_sort_order?: number | null }) {
  return typeof value.dashboard_sort_order === "number";
}

function getKnownFolderIds(data: DashboardData) {
  return [...data.folders]
    .sort((left, right) => {
      if (hasSortOrder(left) && hasSortOrder(right)) {
        return left.sort_order! - right.sort_order!;
      }
      if (hasSortOrder(left) !== hasSortOrder(right)) {
        return hasSortOrder(left) ? -1 : 1;
      }
      return data.folders.indexOf(left) - data.folders.indexOf(right);
    })
    .map((folder) => folder.id);
}

function getKnownBinderIds(data: DashboardData) {
  return [...data.binders]
    .sort((left, right) => {
      if (hasDashboardSortOrder(left) && hasDashboardSortOrder(right)) {
        return left.dashboard_sort_order! - right.dashboard_sort_order!;
      }
      if (hasDashboardSortOrder(left) !== hasDashboardSortOrder(right)) {
        return hasDashboardSortOrder(left) ? -1 : 1;
      }
      return data.binders.indexOf(left) - data.binders.indexOf(right);
    })
    .map((binder) => binder.id);
}

function getDefaultFolderBinderOrder(data: DashboardData, folderId: string, binderIds: string[]) {
  const binderOrderRank = new Map(binderIds.map((binderId, index) => [binderId, index]));
  const linksByBinderId = new Map(
    data.folderBinders
      .filter((link) => link.folder_id === folderId)
      .map((link) => [link.binder_id, link]),
  );

  return [...binderIds].sort((leftId, rightId) => {
    const leftLink = linksByBinderId.get(leftId);
    const rightLink = linksByBinderId.get(rightId);
    if (leftLink && rightLink && hasSortOrder(leftLink) && hasSortOrder(rightLink)) {
      return leftLink.sort_order! - rightLink.sort_order!;
    }
    if (Boolean(leftLink && hasSortOrder(leftLink)) !== Boolean(rightLink && hasSortOrder(rightLink))) {
      return leftLink && hasSortOrder(leftLink) ? -1 : 1;
    }
    return (binderOrderRank.get(leftId) ?? 0) - (binderOrderRank.get(rightId) ?? 0);
  });
}

function normalizeOrder(order: string[] | undefined, knownIds: string[]) {
  const known = new Set(knownIds);
  const existing = unique(order ?? []).filter((id) => known.has(id));
  return [...existing, ...knownIds.filter((id) => !existing.includes(id))];
}

function removeBinderFromFolders(
  folderBinderOrderByFolderId: Record<string, string[]>,
  binderId: string,
) {
  return Object.fromEntries(
    Object.entries(folderBinderOrderByFolderId).map(([folderId, binderIds]) => [
      folderId,
      binderIds.filter((candidate) => candidate !== binderId),
    ]),
  );
}

export function createDashboardOrganizationDraft(
  data: DashboardData,
  savedDraft?: Partial<DashboardOrganizationDraft> | null,
): DashboardOrganizationDraft {
  const folderIds = getKnownFolderIds(data);
  const binderIds = getKnownBinderIds(data);
  const folderOrder = normalizeOrder(savedDraft?.folderOrder, folderIds);
  const binderOrder = normalizeOrder(savedDraft?.binderOrder, binderIds);
  const knownFolders = new Set(folderIds);
  const knownBinders = new Set(binderIds);

  const binderFolderIdByBinderId = Object.fromEntries(
    binderIds.map((binderId) => {
      const savedFolderId = savedDraft?.binderFolderIdByBinderId?.[binderId];
      if (savedFolderId === null || (savedFolderId && knownFolders.has(savedFolderId))) {
        return [binderId, savedFolderId];
      }

      const link = data.folderBinders.find((candidate) => candidate.binder_id === binderId);
      return [binderId, link?.folder_id && knownFolders.has(link.folder_id) ? link.folder_id : null];
    }),
  ) as Record<string, string | null>;

  const folderBinderOrderByFolderId = Object.fromEntries(
    folderIds.map((folderId) => {
      const savedOrder = savedDraft?.folderBinderOrderByFolderId?.[folderId];
      const defaultOrder = getDefaultFolderBinderOrder(
        data,
        folderId,
        binderOrder.filter((binderId) => binderFolderIdByBinderId[binderId] === folderId),
      );
      const merged = normalizeOrder(savedOrder, defaultOrder).filter((binderId) => knownBinders.has(binderId));
      return [folderId, merged];
    }),
  ) as Record<string, string[]>;

  return {
    version: 1,
    folderOrder,
    binderOrder,
    binderFolderIdByBinderId,
    folderBinderOrderByFolderId,
    updatedAt: savedDraft?.updatedAt ?? "",
  };
}

export function reorderDashboardFolders(
  draft: DashboardOrganizationDraft,
  activeFolderId: string,
  overFolderId: string,
): DashboardOrganizationDraft {
  const fromIndex = draft.folderOrder.indexOf(activeFolderId);
  const toIndex = draft.folderOrder.indexOf(overFolderId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return draft;
  }

  const folderOrder = [...draft.folderOrder];
  const [moved] = folderOrder.splice(fromIndex, 1);
  folderOrder.splice(toIndex, 0, moved);

  return { ...draft, folderOrder, updatedAt: now() };
}

export function reorderDashboardBinders(
  draft: DashboardOrganizationDraft,
  activeBinderId: string,
  overBinderId: string,
): DashboardOrganizationDraft {
  const fromIndex = draft.binderOrder.indexOf(activeBinderId);
  const toIndex = draft.binderOrder.indexOf(overBinderId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return draft;
  }

  const binderOrder = [...draft.binderOrder];
  const [moved] = binderOrder.splice(fromIndex, 1);
  binderOrder.splice(toIndex, 0, moved);

  return { ...draft, binderOrder, updatedAt: now() };
}

export function moveBinderToFolder(
  draft: DashboardOrganizationDraft,
  input: MoveBinderInput,
): DashboardOrganizationDraft {
  if (!draft.binderOrder.includes(input.binderId)) {
    return draft;
  }

  const folderId = input.folderId;
  const binderFolderIdByBinderId = {
    ...draft.binderFolderIdByBinderId,
    [input.binderId]: folderId,
  };
  const folderBinderOrderByFolderId = removeBinderFromFolders(
    draft.folderBinderOrderByFolderId,
    input.binderId,
  );

  if (folderId && folderBinderOrderByFolderId[folderId]) {
    const nextOrder = [...folderBinderOrderByFolderId[folderId]];
    const beforeIndex = input.beforeBinderId ? nextOrder.indexOf(input.beforeBinderId) : -1;
    if (beforeIndex >= 0) {
      nextOrder.splice(beforeIndex, 0, input.binderId);
    } else {
      nextOrder.push(input.binderId);
    }
    folderBinderOrderByFolderId[folderId] = nextOrder;
  }

  return {
    ...draft,
    binderFolderIdByBinderId,
    folderBinderOrderByFolderId,
    updatedAt: now(),
  };
}

export function resetDashboardOrganizationDraft(
  data: DashboardData,
  _draft?: DashboardOrganizationDraft,
) {
  return createDashboardOrganizationDraft(data);
}

export function dashboardOrganizationStorageKey(userId: string) {
  return `${adminDashboardOrganizationStoragePrefix}:${userId}`;
}

export function loadDashboardOrganizationDraft(
  userId: string,
  data: DashboardData,
  storage: Storage | undefined = typeof window === "undefined" ? undefined : window.localStorage,
) {
  if (!storage) {
    return createDashboardOrganizationDraft(data);
  }

  try {
    const raw = storage.getItem(dashboardOrganizationStorageKey(userId));
    return createDashboardOrganizationDraft(
      data,
      raw ? (JSON.parse(raw) as Partial<DashboardOrganizationDraft>) : null,
    );
  } catch {
    return createDashboardOrganizationDraft(data);
  }
}

export function saveDashboardOrganizationDraft(
  userId: string,
  draft: DashboardOrganizationDraft,
  storage: Storage | undefined = typeof window === "undefined" ? undefined : window.localStorage,
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(dashboardOrganizationStorageKey(userId), JSON.stringify(draft));
  } catch {
    // Local dashboard ordering is convenience state; save failures should be recoverable in UI.
  }
}
