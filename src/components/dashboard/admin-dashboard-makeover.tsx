import {
  useDeferredValue,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  BookPlus,
  BookCopy,
  Check,
  ChevronRight,
  FileText,
  FolderPlus,
  FolderOpen,
  GripVertical,
  LibraryBig,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useDashboardWorkspaceMutations } from "@/hooks/use-binders";
import {
  dashboardWorkspaceScopeLabels,
  useDashboardWorkspaceViewPreference,
  type DashboardWorkspaceDensity,
  type DashboardWorkspaceScope,
  type DashboardWorkspaceSort,
  type DashboardWorkspaceWidth,
} from "@/hooks/use-dashboard-workspace-view";
import type { Binder, BinderLesson, DashboardData, Folder, Profile } from "@/types";
import {
  createDashboardOrganizationDraft,
  loadDashboardOrganizationDraft,
  moveBinderToFolder,
  resetDashboardOrganizationDraft,
  saveDashboardOrganizationDraft,
  unfiledDashboardFolderId,
  type DashboardOrganizationDraft,
} from "@/lib/dashboard-organization";
import {
  deriveBinderTitle,
  deriveLessonTitle,
  getDisplayTitle,
} from "@/lib/workspace-records";
import { dashboardViewModeOptions, type DashboardViewMode } from "@/lib/admin-dashboard-preferences";
import { markDevPerformance } from "@/lib/performance-marks";
import { cn } from "@/lib/utils";

type AdminDashboardMakeoverProps = {
  data: DashboardData;
  profile: Profile;
  query: string;
  onQueryChange: (query: string) => void;
  onViewModeChange: (viewMode: DashboardViewMode) => void;
  viewMode: DashboardViewMode;
};

type SaveState = "idle" | "saved" | "draft";
type DropPlacement = "before" | "after" | "swap";
type DragPreviewState = {
  height: number;
  id: string;
  offsetX: number;
  offsetY: number;
  pointerX: number;
  pointerY: number;
  startPointerX: number;
  startPointerY: number;
  width: number;
};

function safeAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const folderSortableId = (folderId: string) => `folder:${folderId}`;
const binderSortableId = (binderId: string) => `binder:${binderId}`;
const folderBinderSortableId = (folderId: string, binderId: string) =>
  `folder-binder:${folderId}:${binderId}`;
const folderDropId = (folderId: string) => `folder-drop:${folderId}`;

const adminDashboardCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);
  const isCompatible = (overId: string) => {
    if (overId === activeId) {
      return false;
    }
    if (activeId.startsWith("folder:")) {
      return overId.startsWith("folder:");
    }
    if (activeId.startsWith("binder:")) {
      return (
        overId.startsWith("binder:") ||
        overId.startsWith("folder:") ||
        overId.startsWith("folder-drop:") ||
        overId.startsWith("folder-binder:")
      );
    }
    if (activeId.startsWith("folder-binder:")) {
      return (
        overId.startsWith("folder-binder:") ||
        overId.startsWith("folder:") ||
        overId.startsWith("folder-drop:") ||
        overId.startsWith("binder:")
      );
    }
    return true;
  };
  const pointerCollisions = pointerWithin(args).filter((collision) =>
    isCompatible(String(collision.id)),
  );
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCenter(args).filter((collision) => isCompatible(String(collision.id)));
};

function getClientPoint(event: Event | null): { x: number; y: number } | null {
  if (!event) {
    return null;
  }
  const pointerEvent = event as MouseEvent | PointerEvent;
  if (typeof pointerEvent.clientX === "number" && typeof pointerEvent.clientY === "number") {
    return { x: pointerEvent.clientX, y: pointerEvent.clientY };
  }
  const touchEvent = event as TouchEvent;
  if (touchEvent.touches?.length) {
    return { x: touchEvent.touches[0].clientX, y: touchEvent.touches[0].clientY };
  }
  if (touchEvent.changedTouches?.length) {
    return { x: touchEvent.changedTouches[0].clientX, y: touchEvent.changedTouches[0].clientY };
  }
  return null;
}

function getDropPlacement(
  overRect: { height: number; left: number; top: number; width: number } | undefined,
  preview: DragPreviewState | null,
): DropPlacement {
  if (!overRect || !preview || overRect.width <= 0 || overRect.height <= 0) {
    return "swap";
  }

  const relativeX = preview.pointerX - overRect.left;
  const relativeY = preview.pointerY - overRect.top;
  const insideX = relativeX >= 0 && relativeX <= overRect.width;
  const insideY = relativeY >= 0 && relativeY <= overRect.height;

  if (!insideX || !insideY) {
    return "swap";
  }

  const edgeBandX = Math.min(34, overRect.width * 0.12);
  const edgeBandY = Math.min(34, overRect.height * 0.12);
  const edgeCandidates = [
    { distance: relativeY, placement: "before" as const },
    { distance: overRect.height - relativeY, placement: "after" as const },
    { distance: relativeX, placement: "before" as const },
    { distance: overRect.width - relativeX, placement: "after" as const },
  ].filter((candidate, index) =>
    index < 2 ? candidate.distance <= edgeBandY : candidate.distance <= edgeBandX,
  );

  if (edgeCandidates.length === 0) {
    return "swap";
  }

  edgeCandidates.sort((a, b) => a.distance - b.distance);
  return edgeCandidates[0].placement;
}

function reorderIdsByPlacement(
  order: string[],
  activeId: string,
  overId: string,
  placement: DropPlacement,
) {
  const fromIndex = order.indexOf(activeId);
  const toIndex = order.indexOf(overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return order;
  }

  const nextOrder = [...order];
  if (placement === "swap") {
    nextOrder[fromIndex] = overId;
    nextOrder[toIndex] = activeId;
    return nextOrder;
  }

  const [moved] = nextOrder.splice(fromIndex, 1);
  const overIndexAfterRemove = nextOrder.indexOf(overId);
  const insertIndex = placement === "after" ? overIndexAfterRemove + 1 : overIndexAfterRemove;
  nextOrder.splice(insertIndex, 0, moved);
  return nextOrder;
}

function updateDraftFolderOrder(
  draft: DashboardOrganizationDraft,
  activeFolderId: string,
  overFolderId: string,
  placement: DropPlacement,
): DashboardOrganizationDraft {
  const folderOrder = reorderIdsByPlacement(draft.folderOrder, activeFolderId, overFolderId, placement);
  return folderOrder === draft.folderOrder ? draft : { ...draft, folderOrder, updatedAt: new Date().toISOString() };
}

function updateDraftBinderOrder(
  draft: DashboardOrganizationDraft,
  activeBinderId: string,
  overBinderId: string,
  placement: DropPlacement,
): DashboardOrganizationDraft {
  const binderOrder = reorderIdsByPlacement(draft.binderOrder, activeBinderId, overBinderId, placement);
  return binderOrder === draft.binderOrder ? draft : { ...draft, binderOrder, updatedAt: new Date().toISOString() };
}

function getDashboardDropTarget(activeId: string, preview: DragPreviewState | null) {
  if (typeof document === "undefined" || !preview) {
    return null;
  }

  const elements = document.elementsFromPoint(preview.pointerX, preview.pointerY);
  for (const element of elements) {
    const target = element.closest<HTMLElement>("[data-admin-sortable-id], [data-admin-drop-id]");
    if (!target) {
      continue;
    }

    const overId = target.dataset.adminSortableId ?? target.dataset.adminDropId ?? null;
    if (!overId || overId === activeId) {
      continue;
    }

    if (activeId.startsWith("folder:") && !overId.startsWith("folder:")) {
      continue;
    }
    if (
      activeId.startsWith("binder:") &&
      !(
        overId.startsWith("binder:") ||
        overId.startsWith("folder:") ||
        overId.startsWith("folder-drop:") ||
        overId.startsWith("folder-binder:")
      )
    ) {
      continue;
    }
    if (
      activeId.startsWith("folder-binder:") &&
      !(
        overId.startsWith("folder-binder:") ||
        overId.startsWith("folder:") ||
        overId.startsWith("folder-drop:") ||
        overId.startsWith("binder:")
      )
    ) {
      continue;
    }

    const rect = target.getBoundingClientRect();
    return {
      id: overId,
      placement: getDropPlacement(rect, preview),
    };
  }

  return null;
}

function stripPrefix(id: string, prefix: string) {
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

function parseFolderBinderSortableId(id: string) {
  const raw = stripPrefix(id, "folder-binder:");
  if (!raw) {
    return null;
  }

  const [folderId, binderId] = raw.split(":");
  return folderId && binderId ? { folderId, binderId } : null;
}

export function AdminDashboardMakeover({
  data,
  onQueryChange,
  onViewModeChange,
  profile,
  query,
  viewMode,
}: AdminDashboardMakeoverProps) {
  const dashboardRef = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<DashboardOrganizationDraft>(() =>
    loadDashboardOrganizationDraft(profile.id, data),
  );
  const [savedDraft, setSavedDraft] = useState<DashboardOrganizationDraft>(() =>
    loadDashboardOrganizationDraft(profile.id, data),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);
  const dragPreviewRef = useRef<DragPreviewState | null>(null);
  const [overDragId, setOverDragId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debouncedQuery = useDebouncedValue(query);
  const deferredQuery = useDeferredValue(debouncedQuery);
  const filebarRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [workspaceView, updateWorkspaceView] = useDashboardWorkspaceViewPreference(profile.id);
  const workspaceMutations = useDashboardWorkspaceMutations(profile);
  const [openCommandMenu, setOpenCommandMenu] = useState<"new" | "browse" | "open" | "view" | null>(null);
  const [createKind, setCreateKind] = useState<"folder" | "binder" | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftFolderId, setDraftFolderId] = useState("");
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);

  useEffect(() => {
    markDevPerformance(isEditing ? "admin-dashboard-organize-render" : "admin-dashboard-render");
  });

  useEffect(() => {
    const nextDraft = loadDashboardOrganizationDraft(profile.id, data);
    setDraft(nextDraft);
    setSavedDraft(nextDraft);
  }, [data, profile.id]);

  useEffect(() => {
    let scrollEndTimer: number | undefined;

    const markScrolling = () => {
      const dashboard = dashboardRef.current;
      if (!dashboard) {
        return;
      }
      dashboard.dataset.adminScrolling = "active";
      if (scrollEndTimer) {
        window.clearTimeout(scrollEndTimer);
      }
      scrollEndTimer = window.setTimeout(() => {
        dashboard.dataset.adminScrolling = "idle";
      }, 180);
    };

    window.addEventListener("scroll", markScrolling, { passive: true });
    return () => {
      window.removeEventListener("scroll", markScrolling);
      if (scrollEndTimer) {
        window.clearTimeout(scrollEndTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (!openCommandMenu) {
      return;
    }

    const closeOnOutside = (event: PointerEvent) => {
      if (!filebarRef.current?.contains(event.target as Node)) {
        setOpenCommandMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenCommandMenu(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openCommandMenu]);

  useEffect(() => {
    if (!dragPreview) {
      return;
    }

    let frame = 0;
    const updatePoint = (point: { x: number; y: number }) => {
      const currentPreview = dragPreviewRef.current;
      if (currentPreview) {
        dragPreviewRef.current = {
          ...currentPreview,
          pointerX: point.x,
          pointerY: point.y,
        };
      }
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        setDragPreview(dragPreviewRef.current);
      });
    };
    const onPointerMove = (event: PointerEvent) => updatePoint({ x: event.clientX, y: event.clientY });
    const onMouseMove = (event: MouseEvent) => updatePoint({ x: event.clientX, y: event.clientY });
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (touch) {
        updatePoint({ x: touch.clientX, y: touch.clientY });
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [dragPreview?.id]);

  const lessonsByBinderId = useMemo(
    () => {
      const groups = data.lessons.reduce<Record<string, BinderLesson[]>>((nextGroups, lesson) => {
        nextGroups[lesson.binder_id] = nextGroups[lesson.binder_id] ?? [];
        nextGroups[lesson.binder_id].push(lesson);
        return nextGroups;
      }, {});
      for (const binder of data.binders) {
        groups[binder.id] = groups[binder.id] ?? [];
      }
      return groups;
    },
    [data.binders, data.lessons],
  );
  const binderById = useMemo(
    () => new Map(data.binders.map((binder) => [binder.id, binder])),
    [data.binders],
  );
  const folderById = useMemo(
    () => new Map(data.folders.map((folder) => [folder.id, folder])),
    [data.folders],
  );
  const notesByBinderId = useMemo(
    () =>
      data.notes.reduce<Record<string, typeof data.notes>>((groups, note) => {
        groups[note.binder_id] = groups[note.binder_id] ?? [];
        groups[note.binder_id].push(note);
        return groups;
      }, {}),
    [data.notes],
  );

  const normalizedQuery = useMemo(() => deferredQuery.trim().toLowerCase(), [deferredQuery]);
  const orderedFolders = useMemo(
    () => draft.folderOrder.map((folderId) => folderById.get(folderId)).filter(Boolean) as Folder[],
    [draft.folderOrder, folderById],
  );
  const orderedBinders = useMemo(
    () => draft.binderOrder.map((binderId) => binderById.get(binderId)).filter(Boolean) as Binder[],
    [binderById, draft.binderOrder],
  );
  const activeFolderBinder = activeDragId ? parseFolderBinderSortableId(activeDragId) : null;
  const activeBinderId = activeDragId
    ? stripPrefix(activeDragId, "binder:") ?? activeFolderBinder?.binderId ?? null
    : null;
  const filteredFolders = useMemo(
    () =>
      orderedFolders.filter((folder) =>
        `${folder.name} ${(draft.folderBinderOrderByFolderId[folder.id] ?? [])
          .map((binderId) => {
            const binder = binderById.get(binderId);
            const lessonTitles = (lessonsByBinderId[binderId] ?? []).map(deriveLessonTitle).join(" ");
            const noteTitles = (notesByBinderId[binderId] ?? []).map((note) => note.title).join(" ");
            return binder
              ? `${deriveBinderTitle(binder, lessonsByBinderId[binderId] ?? [])} ${lessonTitles} ${noteTitles}`
              : "";
          })
          .join(" ")}`.toLowerCase().includes(normalizedQuery),
      ),
    [
      binderById,
      draft.folderBinderOrderByFolderId,
      lessonsByBinderId,
      normalizedQuery,
      notesByBinderId,
      orderedFolders,
    ],
  );
  const filteredBinders = useMemo(
    () =>
      orderedBinders.filter((binder) =>
        `${deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])} ${binder.subject} ${binder.description} ${(lessonsByBinderId[binder.id] ?? []).map(deriveLessonTitle).join(" ")} ${(notesByBinderId[binder.id] ?? []).map((note) => note.title).join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [lessonsByBinderId, normalizedQuery, notesByBinderId, orderedBinders],
  );
  const recentDocumentSearchTextById = useMemo(
    () =>
      new Map(
        data.recentLessons.map((lesson) => [
          lesson.id,
          deriveLessonTitle(lesson).toLowerCase(),
        ]),
      ),
    [data.recentLessons],
  );
  const recentDocuments = useMemo(
    () =>
      data.recentLessons
        .filter((lesson) => (recentDocumentSearchTextById.get(lesson.id) ?? "").includes(normalizedQuery))
        .slice(0, 6),
    [data.recentLessons, normalizedQuery, recentDocumentSearchTextById],
  );
  const documentCountByFolderId = useMemo(
    () =>
      Object.fromEntries(
        orderedFolders.map((folder) => {
          const binderIds = new Set(draft.folderBinderOrderByFolderId[folder.id] ?? []);
          let documentCount = 0;
          for (const binderId of binderIds) {
            documentCount += lessonsByBinderId[binderId]?.length ?? 0;
          }
          return [folder.id, documentCount];
        }),
      ) as Record<string, number>,
    [draft.folderBinderOrderByFolderId, lessonsByBinderId, orderedFolders],
  );
  const noteCountByFolderId = useMemo(
    () =>
      Object.fromEntries(
        orderedFolders.map((folder) => {
          const binderIds = new Set(draft.folderBinderOrderByFolderId[folder.id] ?? []);
          const folderNoteCount = data.notes.filter(
            (note) => note.folder_id === folder.id || binderIds.has(note.binder_id),
          ).length;
          return [folder.id, folderNoteCount];
        }),
      ) as Record<string, number>,
    [data.notes, draft.folderBinderOrderByFolderId, orderedFolders],
  );
  const sortedFolders = useMemo(() => {
    const folders = [...filteredFolders];
    if (workspaceView.sort === "name") {
      return folders.sort((left, right) =>
        getDisplayTitle(left.name, "Recovered Folder").localeCompare(
          getDisplayTitle(right.name, "Recovered Folder"),
        ),
      );
    }
    if (workspaceView.sort === "documents") {
      return folders.sort(
        (left, right) =>
          (documentCountByFolderId[right.id] ?? 0) - (documentCountByFolderId[left.id] ?? 0),
      );
    }
    return folders;
  }, [documentCountByFolderId, filteredFolders, workspaceView.sort]);
  const sortedBinders = useMemo(() => {
    const binders = [...filteredBinders];
    if (workspaceView.sort === "name") {
      return binders.sort((left, right) =>
        deriveBinderTitle(left, lessonsByBinderId[left.id] ?? []).localeCompare(
          deriveBinderTitle(right, lessonsByBinderId[right.id] ?? []),
        ),
      );
    }
    if (workspaceView.sort === "documents") {
      return binders.sort(
        (left, right) =>
          (lessonsByBinderId[right.id]?.length ?? 0) - (lessonsByBinderId[left.id]?.length ?? 0),
      );
    }
    return binders;
  }, [filteredBinders, lessonsByBinderId, workspaceView.sort]);
  const showFolders = workspaceView.scope === "all" || workspaceView.scope === "folders";
  const showBinders = workspaceView.scope === "all" || workspaceView.scope === "binders";
  const showDocuments =
    workspaceView.showRecentDocuments &&
    (workspaceView.scope === "all" || workspaceView.scope === "documents");
  const showWorkspaceMap = workspaceView.scope === "all" || workspaceView.scope === "folders";
  const visibleFolders = showFolders ? sortedFolders : [];
  const visibleBinders = showBinders ? sortedBinders : [];
  const visibleRecentDocuments = showDocuments ? recentDocuments : [];
  const firstFolder = sortedFolders[0] ?? null;
  const firstBinder = sortedBinders[0] ?? null;
  const nextDocument = recentDocuments[0] ?? null;
  const createPending =
    workspaceMutations.createBinder.isPending || workspaceMutations.createFolder.isPending;

  const focusDashboardSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const changeScope = useCallback(
    (scope: DashboardWorkspaceScope, options?: { focusSearch?: boolean }) => {
      updateWorkspaceView({
        scope,
        ...(scope === "documents" ? { showRecentDocuments: true } : {}),
      });
      setOpenCommandMenu(null);
      setDashboardNotice(`Showing ${dashboardWorkspaceScopeLabels[scope]}.`);
      if (options?.focusSearch) {
        window.setTimeout(focusDashboardSearch, 0);
      }
    },
    [focusDashboardSearch, updateWorkspaceView],
  );

  const changeDensity = useCallback(
    (density: DashboardWorkspaceDensity) => {
      updateWorkspaceView({ density });
      setOpenCommandMenu(null);
      setDashboardNotice(
        density === "compact"
          ? "Compact command center is on. More workspace items fit on screen."
          : "Comfortable command center is on. Cards have more breathing room.",
      );
    },
    [updateWorkspaceView],
  );

  const changeSort = useCallback(
    (sort: DashboardWorkspaceSort) => {
      updateWorkspaceView({ sort });
      setOpenCommandMenu(null);
      setDashboardNotice(
        sort === "name"
          ? "Sorted by name."
          : sort === "documents"
            ? "Sorted by document count."
            : "Using your saved admin order.",
      );
    },
    [updateWorkspaceView],
  );

  const changeWidth = useCallback(
    (width: DashboardWorkspaceWidth) => {
      updateWorkspaceView({ width });
      setOpenCommandMenu(null);
      setDashboardNotice(
        width === "full"
          ? "Full width is on. Admin Makeover now uses the whole browser."
          : "Focused width is on. Admin Makeover is back to the centered premium layout.",
      );
    },
    [updateWorkspaceView],
  );

  const toggleRecentDocuments = useCallback(
    (showRecentDocuments: boolean) => {
      updateWorkspaceView({ showRecentDocuments });
      setOpenCommandMenu(null);
      setDashboardNotice(
        showRecentDocuments
          ? "Recent documents are visible."
          : "Recent documents are hidden. Folders and binders stay in focus.",
      );
    },
    [updateWorkspaceView],
  );

  const beginCreate = (kind: "folder" | "binder") => {
    setCreateKind(kind);
    setDraftTitle(kind === "folder" ? "New folder" : "New binder");
    setDraftFolderId(firstFolder?.id ?? "");
    setOpenCommandMenu(null);
    setDashboardNotice(null);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createKind) {
      return;
    }

    const title = draftTitle.trim();
    if (!title) {
      setDashboardNotice("Add a name before creating it.");
      return;
    }

    if (createKind === "folder") {
      await workspaceMutations.createFolder.mutateAsync({ name: title, color: "teal" });
      setDashboardNotice(`Created folder "${title}".`);
    } else {
      await workspaceMutations.createBinder.mutateAsync({
        folderId: draftFolderId || null,
        subject: "General",
        title,
      });
      setDashboardNotice(`Created binder "${title}".`);
    }

    setCreateKind(null);
    setDraftTitle("");
  };

  const onDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const activeElement =
      typeof document !== "undefined"
        ? document.querySelector<HTMLElement>(`[data-admin-sortable-id="${safeAttributeValue(activeId)}"]`)
        : null;
    const measuredRect = activeElement?.getBoundingClientRect();
    const measuredHasSize = Boolean(measuredRect && measuredRect.width > 0 && measuredRect.height > 0);
    const initialRect = measuredHasSize ? measuredRect : event.active.rect.current.initial;
    const fallbackPoint = initialRect
      ? { x: initialRect.left + Math.min(56, initialRect.width / 2), y: initialRect.top + Math.min(56, initialRect.height / 2) }
      : { x: 0, y: 0 };
    const point = getClientPoint(event.activatorEvent) ?? fallbackPoint;
    const nextPreview = {
      height: initialRect?.height ?? 220,
      id: activeId,
      offsetX: initialRect ? point.x - initialRect.left : 32,
      offsetY: initialRect ? point.y - initialRect.top : 32,
      pointerX: point.x,
      pointerY: point.y,
      startPointerX: point.x,
      startPointerY: point.y,
      width: initialRect?.width ?? 360,
    };
    setActiveDragId(activeId);
    dragPreviewRef.current = nextPreview;
    setDragPreview(nextPreview);
    setOverDragId(null);
  };

  const onDragMove = (event: DragMoveEvent) => {
    setDragPreview((currentPreview) => {
      if (!currentPreview) {
        dragPreviewRef.current = null;
        return currentPreview;
      }
      const nextPreview = {
        ...currentPreview,
        pointerX: currentPreview.startPointerX + event.delta.x,
        pointerY: currentPreview.startPointerY + event.delta.y,
      };
      dragPreviewRef.current = nextPreview;
      return nextPreview;
    });
  };

  const onDragOver = (event: DragOverEvent) => {
    const nextOverId = event.over?.id ? String(event.over.id) : null;
    setOverDragId((currentOverId) => (currentOverId === nextOverId ? currentOverId : nextOverId));
  };

  const clearDragState = () => {
    setActiveDragId(null);
    dragPreviewRef.current = null;
    setDragPreview(null);
    setOverDragId(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) {
      clearDragState();
      return;
    }

    const latestPreview = dragPreviewRef.current ?? dragPreview;
    const dashboardTarget = getDashboardDropTarget(activeId, latestPreview);
    const effectiveOverId = dashboardTarget?.id ?? overId;
    const dropPlacement = dashboardTarget?.placement ?? getDropPlacement(event.over?.rect, latestPreview);
    const activeFolderId = stripPrefix(activeId, "folder:");
    if (activeFolderId) {
      const overFolderId = stripPrefix(effectiveOverId, "folder:");
      if (overFolderId) {
        setDraft((current) => updateDraftFolderOrder(current, activeFolderId, overFolderId, dropPlacement));
        setSaveState("draft");
      }
      clearDragState();
      return;
    }

    const activeBinderId =
      stripPrefix(activeId, "binder:") ?? parseFolderBinderSortableId(activeId)?.binderId ?? null;
    if (!activeBinderId) {
      clearDragState();
      return;
    }

    const overFolderId = stripPrefix(effectiveOverId, "folder-drop:") ?? stripPrefix(effectiveOverId, "folder:");
    if (overFolderId) {
      setDraft((current) =>
        moveBinderToFolder(current, {
          binderId: activeBinderId,
          folderId: overFolderId === unfiledDashboardFolderId ? null : overFolderId,
        }),
      );
      setSaveState("draft");
      clearDragState();
      return;
    }

    const overFolderBinder = parseFolderBinderSortableId(effectiveOverId);
    if (overFolderBinder) {
      setDraft((current) =>
        moveBinderToFolder(current, {
          binderId: activeBinderId,
          folderId: overFolderBinder.folderId,
          beforeBinderId: overFolderBinder.binderId,
        }),
      );
      setSaveState("draft");
      clearDragState();
      return;
    }

    const overBinderId = stripPrefix(effectiveOverId, "binder:");
    if (overBinderId) {
      setDraft((current) => updateDraftBinderOrder(current, activeBinderId, overBinderId, dropPlacement));
      setSaveState("draft");
    }
    clearDragState();
  };

  const saveOrder = () => {
    saveDashboardOrganizationDraft(profile.id, draft);
    setSavedDraft(draft);
    setIsEditing(false);
    setSaveState("saved");
  };

  const cancelOrder = () => {
    setDraft(savedDraft);
    setIsEditing(false);
    setSaveState("idle");
  };

  const resetOrder = () => {
    setDraft(resetDashboardOrganizationDraft(data, draft));
    setSaveState("draft");
  };

  return (
    <main
      className="admin-dashboard-makeover"
      data-admin-dragging={activeDragId ? "active" : isEditing ? "ready" : "off"}
      data-admin-dashboard-density={workspaceView.density}
      data-admin-dashboard-recent-documents={workspaceView.showRecentDocuments ? "visible" : "hidden"}
      data-admin-dashboard-scope={workspaceView.scope}
      data-admin-dashboard-sort={workspaceView.sort}
      data-admin-dashboard-width={workspaceView.width}
      data-admin-scrolling="idle"
      data-testid="admin-dashboard-makeover"
      ref={dashboardRef}
    >
      <div className="admin-dashboard-glow admin-dashboard-glow--a" aria-hidden="true" />
      <div className="admin-dashboard-glow admin-dashboard-glow--b" aria-hidden="true" />

      <section className="admin-dashboard-hero">
        <div className="admin-dashboard-hero__copy">
          <div className="admin-dashboard-kicker">
            <Sparkles data-icon="inline-start" />
            Admin Makeover
          </div>
          <h1>Your BinderNotes Workspace</h1>
          <p>
            A premium command center for arranging folders, binders, and documents before the
            experience graduates to every learner.
          </p>
          <div className="admin-dashboard-search">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              className="pl-11"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search folders, binders, documents, lessons"
              ref={searchInputRef}
              value={query}
            />
          </div>
        </div>

        <div className="admin-dashboard-hero__panel">
          <div className="admin-dashboard-toggle" aria-label="Dashboard view">
            {dashboardViewModeOptions.map((option) => (
              <button
                className={cn(
                  "admin-dashboard-toggle__item",
                  option.value === viewMode && "admin-dashboard-toggle__item--active",
                )}
                key={option.value}
                onClick={() => onViewModeChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="admin-dashboard-stats">
            <AdminStat icon={<FolderOpen />} label="Folders" value={data.folders.length} />
            <AdminStat icon={<LibraryBig />} label="Binders" value={data.binders.length} />
            <AdminStat icon={<BookCopy />} label="Documents" value={data.lessons.length} />
            <AdminStat icon={<Check />} label="Notes" value={data.notes.length} />
          </div>
          <div className="admin-dashboard-actions">
            <Button onClick={() => setIsEditing((editing) => !editing)} type="button">
              <Wand2 data-icon="inline-start" />
              {isEditing ? "Organizing workspace" : "Organize"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin">
                Admin studio
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="admin-dashboard-command-bar" data-testid="admin-dashboard-command-bar">
        <div className="admin-dashboard-command-bar__signal">
          <Sparkles data-icon="inline-start" />
          <span>Live workspace controls</span>
          <strong>{dashboardWorkspaceScopeLabels[workspaceView.scope]}</strong>
        </div>

        <nav
          aria-label="Admin workspace file controls"
          className="admin-dashboard-filebar"
          data-testid="admin-dashboard-filebar"
          ref={filebarRef}
        >
          <div className="admin-dashboard-filebar__new">
            <button
              aria-expanded={openCommandMenu === "new"}
              className="admin-dashboard-new-button"
              data-testid="admin-dashboard-new-button"
              onClick={() => setOpenCommandMenu((current) => (current === "new" ? null : "new"))}
              type="button"
            >
              <Plus className="size-4" />
              New
            </button>
            {openCommandMenu === "new" ? (
              <div className="admin-dashboard-filebar__menu" role="menu">
                <button onClick={() => beginCreate("folder")} role="menuitem" type="button">
                  <FolderPlus className="size-4" />
                  Folder
                </button>
                <button onClick={() => beginCreate("binder")} role="menuitem" type="button">
                  <BookPlus className="size-4" />
                  Binder
                </button>
              </div>
            ) : null}
          </div>

          <div className="admin-dashboard-filebar__menus">
            {[
              { id: "browse" as const, label: "Browse" },
              { id: "open" as const, label: "Open" },
              { id: "view" as const, label: "View" },
            ].map((menu) => (
              <div className="admin-dashboard-filebar__menu-wrap" key={menu.id}>
                <button
                  aria-expanded={openCommandMenu === menu.id}
                  className="admin-dashboard-filebar__trigger"
                  onClick={() => setOpenCommandMenu((current) => (current === menu.id ? null : menu.id))}
                  type="button"
                >
                  {menu.label}
                </button>
                {openCommandMenu === menu.id ? (
                  <div className="admin-dashboard-filebar__menu" role="menu">
                    {menu.id === "browse" ? (
                      <>
                        <button onClick={() => changeScope("all")} role="menuitem" type="button">
                          <FolderOpen className="size-4" />
                          All files
                        </button>
                        <button onClick={() => changeScope("folders")} role="menuitem" type="button">
                          <FolderOpen className="size-4" />
                          Folders
                        </button>
                        <button onClick={() => changeScope("binders")} role="menuitem" type="button">
                          <LibraryBig className="size-4" />
                          Binders
                        </button>
                        <button onClick={() => changeScope("documents", { focusSearch: true })} role="menuitem" type="button">
                          <BookCopy className="size-4" />
                          Recent documents
                        </button>
                      </>
                    ) : null}
                    {menu.id === "open" ? (
                      <>
                        <button onClick={() => changeScope("documents", { focusSearch: true })} role="menuitem" type="button">
                          <Search className="size-4" />
                          Show recent documents
                        </button>
                        {firstFolder ? (
                          <Link onClick={() => setOpenCommandMenu(null)} role="menuitem" to={`/folders/${firstFolder.id}`}>
                            <FolderOpen className="size-4" />
                            {getDisplayTitle(firstFolder.name, "First folder")}
                          </Link>
                        ) : null}
                        {firstBinder ? (
                          <Link onClick={() => setOpenCommandMenu(null)} role="menuitem" to={`/binders/${firstBinder.id}`}>
                            <LibraryBig className="size-4" />
                            {deriveBinderTitle(firstBinder, lessonsByBinderId[firstBinder.id] ?? [])}
                          </Link>
                        ) : null}
                        {nextDocument ? (
                          <Link onClick={() => setOpenCommandMenu(null)} role="menuitem" to={`/binders/${nextDocument.binder_id}/documents/${nextDocument.id}`}>
                            <FileText className="size-4" />
                            {deriveLessonTitle(nextDocument)}
                          </Link>
                        ) : null}
                      </>
                    ) : null}
                    {menu.id === "view" ? (
                      <>
                        <button onClick={() => changeWidth("full")} role="menuitem" type="button">
                          <Maximize2 className="size-4" />
                          Full width
                        </button>
                        <button onClick={() => changeWidth("focused")} role="menuitem" type="button">
                          <Minimize2 className="size-4" />
                          Focused width
                        </button>
                        <button onClick={() => changeDensity("compact")} role="menuitem" type="button">
                          <GripVertical className="size-4" />
                          Compact rows
                        </button>
                        <button onClick={() => changeDensity("comfortable")} role="menuitem" type="button">
                          <GripVertical className="size-4" />
                          Comfortable rows
                        </button>
                        <button onClick={() => changeSort("custom")} role="menuitem" type="button">
                          <GripVertical className="size-4" />
                          Saved admin order
                        </button>
                        <button onClick={() => changeSort("name")} role="menuitem" type="button">
                          <LibraryBig className="size-4" />
                          Sort by name
                        </button>
                        <button onClick={() => changeSort("documents")} role="menuitem" type="button">
                          <BookCopy className="size-4" />
                          Sort by document count
                        </button>
                        <button
                          onClick={() => toggleRecentDocuments(!workspaceView.showRecentDocuments)}
                          role="menuitem"
                          type="button"
                        >
                          <BookCopy className="size-4" />
                          {workspaceView.showRecentDocuments ? "Hide recent documents" : "Show recent documents"}
                        </button>
                        <button onClick={() => changeScope("all", { focusSearch: true })} role="menuitem" type="button">
                          <Search className="size-4" />
                          Search everything
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <ol className="admin-dashboard-filebar__path" aria-label="Current admin workspace path">
            <li>My Drive</li>
            <li>{dashboardWorkspaceScopeLabels[workspaceView.scope]}</li>
            {query.trim() ? <li>Search: {query.trim()}</li> : null}
          </ol>

          <div className="admin-dashboard-filebar__primary">
            {nextDocument ? (
              <Button asChild size="sm" type="button">
                <Link data-testid="admin-dashboard-open-next" to={`/binders/${nextDocument.binder_id}/documents/${nextDocument.id}`}>
                  Open next
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : firstBinder ? (
              <Button asChild size="sm" type="button">
                <Link data-testid="admin-dashboard-open-next" to={`/binders/${firstBinder.id}`}>
                  Open binder
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </nav>
      </section>

      {createKind ? (
        <form className="admin-dashboard-create-card" data-testid="admin-dashboard-create-card" onSubmit={submitCreate}>
          <div>
            <span className="admin-dashboard-kicker">{createKind === "folder" ? "New folder" : "New binder"}</span>
            <label>
              <span>Name</span>
              <Input
                autoFocus
                onChange={(event) => setDraftTitle(event.target.value)}
                value={draftTitle}
              />
            </label>
          </div>
          {createKind === "binder" ? (
            <label>
              <span>Folder</span>
              <select
                className="appearance-select"
                onChange={(event) => setDraftFolderId(event.target.value)}
                value={draftFolderId}
              >
                <option value="">No folder</option>
                {sortedFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {getDisplayTitle(folder.name, "Recovered Folder")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="admin-dashboard-create-card__actions">
            <Button disabled={createPending} size="sm" type="submit">
              {createPending ? "Creating..." : createKind === "folder" ? "Create folder" : "Create binder"}
            </Button>
            <Button onClick={() => setCreateKind(null)} size="sm" type="button" variant="outline">
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {dashboardNotice ? (
        <div className="admin-dashboard-save-pulse" data-testid="admin-dashboard-notice" role="status">
          <Sparkles data-icon="inline-start" />
          {dashboardNotice}
        </div>
      ) : null}

      {isEditing ? (
        <section className="admin-dashboard-editbar" aria-live="polite">
          <div>
            <p className="text-sm font-semibold">Organizing workspace</p>
            <p className="text-xs text-white/68">
              Drag folders or binders. Save commits this admin layout; Cancel rolls it back.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveOrder} size="sm" type="button">
              <Save data-icon="inline-start" />
              Save order
            </Button>
            <Button onClick={cancelOrder} size="sm" type="button" variant="outline">
              <X data-icon="inline-start" />
              Cancel
            </Button>
            <Button onClick={resetOrder} size="sm" type="button" variant="outline">
              <RotateCcw data-icon="inline-start" />
              Reset order
            </Button>
          </div>
        </section>
      ) : saveState === "saved" ? (
        <div className="admin-dashboard-save-pulse" role="status">
          <Check data-icon="inline-start" />
          Saved order
        </div>
      ) : null}

      {isEditing ? (
        <AdminDashboardEditableSections
          activeBinderId={activeBinderId}
          binderById={binderById}
          clearDragState={clearDragState}
          documentCountByFolderId={documentCountByFolderId}
          draft={draft}
          filteredBinders={visibleBinders}
          filteredFolders={visibleFolders}
          folderById={folderById}
          lessonsByBinderId={lessonsByBinderId}
          noteCountByFolderId={noteCountByFolderId}
          onDragEnd={onDragEnd}
          onDragMove={onDragMove}
          onDragOver={onDragOver}
          onDragStart={onDragStart}
          orderedBinders={orderedBinders}
          orderedFolders={orderedFolders}
          overDragId={overDragId}
          recentDocuments={visibleRecentDocuments}
          showRecentDocuments={showDocuments}
          showWorkspaceMap={showWorkspaceMap}
        />
      ) : (
        <AdminDashboardReadOnlySections
          binderById={binderById}
          documentCountByFolderId={documentCountByFolderId}
          draft={draft}
          filteredBinders={visibleBinders}
          filteredFolders={visibleFolders}
          folderById={folderById}
          lessonsByBinderId={lessonsByBinderId}
          noteCountByFolderId={noteCountByFolderId}
          orderedBinders={orderedBinders}
          orderedFolders={orderedFolders}
          recentDocuments={visibleRecentDocuments}
          showRecentDocuments={showDocuments}
          showWorkspaceMap={showWorkspaceMap}
        />
      )}
      {dragPreview ? (
        <AdminDashboardDragPreview
          binderById={binderById}
          documentCountByFolderId={documentCountByFolderId}
          draft={draft}
          folderById={folderById}
          lessonsByBinderId={lessonsByBinderId}
          noteCountByFolderId={noteCountByFolderId}
          preview={dragPreview}
        />
      ) : null}
    </main>
  );
}

type AdminDashboardSectionsProps = {
  binderById: Map<string, Binder>;
  documentCountByFolderId: Record<string, number>;
  draft: DashboardOrganizationDraft;
  filteredBinders: Binder[];
  filteredFolders: Folder[];
  folderById: Map<string, Folder>;
  lessonsByBinderId: Record<string, BinderLesson[]>;
  noteCountByFolderId: Record<string, number>;
  orderedBinders: Binder[];
  orderedFolders: Folder[];
  recentDocuments: BinderLesson[];
  showRecentDocuments: boolean;
  showWorkspaceMap: boolean;
};

type AdminDashboardEditableSectionsProps = AdminDashboardSectionsProps & {
  activeBinderId: string | null;
  clearDragState: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragStart: (event: DragStartEvent) => void;
  overDragId: string | null;
};

function AdminDashboardReadOnlySections({
  binderById,
  documentCountByFolderId,
  draft,
  filteredBinders,
  filteredFolders,
  folderById,
  lessonsByBinderId,
  noteCountByFolderId,
  orderedBinders,
  orderedFolders,
  recentDocuments,
  showRecentDocuments,
  showWorkspaceMap,
}: AdminDashboardSectionsProps) {
  return (
    <>
      {showRecentDocuments ? <RecentDocumentsSection recentDocuments={recentDocuments} /> : null}

      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section__header">
          <div>
            <span className="admin-dashboard-kicker">Folders</span>
            <h2>Drive-style spaces</h2>
          </div>
        </div>
        <div className="admin-folder-grid">
          {filteredFolders.map((folder, index) => (
            <StaticAdminFolderCard
              binderById={binderById}
              documentCount={documentCountByFolderId[folder.id] ?? 0}
              draft={draft}
              folder={folder}
              index={index}
              key={folder.id}
              lessonsByBinderId={lessonsByBinderId}
              noteCount={noteCountByFolderId[folder.id] ?? 0}
            />
          ))}
          {filteredFolders.length === 0 ? (
            <EmptyState description="Try another search term." title="No folders match" />
          ) : null}
        </div>
      </section>

      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section__header">
          <div>
            <span className="admin-dashboard-kicker">Binders</span>
            <h2>Organized study objects</h2>
          </div>
        </div>
        <div className="admin-binder-grid">
          {filteredBinders.map((binder, index) => (
            <StaticAdminBinderCard
              binder={binder}
              folder={folderById.get(draft.binderFolderIdByBinderId[binder.id] ?? "") ?? null}
              index={index}
              key={binder.id}
              lessons={lessonsByBinderId[binder.id] ?? []}
            />
          ))}
          {filteredBinders.length === 0 ? (
            <EmptyState description="Try another search term." title="No binders match" />
          ) : null}
        </div>
      </section>

      {showWorkspaceMap ? (
      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section__header">
          <div>
            <span className="admin-dashboard-kicker">Workspace Map</span>
            <h2>Drop binders into folders</h2>
          </div>
          <p>Folder targets pulse while you organize, and binder placement is saved in the admin layout draft.</p>
        </div>
        <div className="admin-workspace-map">
          {orderedFolders.map((folder) => (
            <StaticFolderDropZone
              binderById={binderById}
              draft={draft}
              folder={folder}
              key={folder.id}
              lessonsByBinderId={lessonsByBinderId}
            />
          ))}
          <StaticUnfiledDropZone
            binders={orderedBinders.filter((binder) => !draft.binderFolderIdByBinderId[binder.id])}
            lessonsByBinderId={lessonsByBinderId}
          />
        </div>
      </section>
      ) : null}
    </>
  );
}

function AdminDashboardEditableSections({
  activeBinderId,
  binderById,
  clearDragState,
  documentCountByFolderId,
  draft,
  filteredBinders,
  filteredFolders,
  folderById,
  lessonsByBinderId,
  noteCountByFolderId,
  onDragEnd,
  onDragMove,
  onDragOver,
  onDragStart,
  orderedBinders,
  orderedFolders,
  overDragId,
  recentDocuments,
  showRecentDocuments,
  showWorkspaceMap,
}: AdminDashboardEditableSectionsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <DndContext
      collisionDetection={adminDashboardCollisionDetection}
      onDragCancel={clearDragState}
      onDragEnd={onDragEnd}
      onDragMove={onDragMove}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      sensors={sensors}
    >
      {showRecentDocuments ? <RecentDocumentsSection recentDocuments={recentDocuments} /> : null}

      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section__header">
          <div>
            <span className="admin-dashboard-kicker">Folders</span>
            <h2>Drive-style spaces</h2>
          </div>
        </div>
        <SortableContext
          items={filteredFolders.map((folder) => folderSortableId(folder.id))}
          strategy={rectSortingStrategy}
        >
          <div className="admin-folder-grid">
            {filteredFolders.map((folder, index) => (
              <AdminFolderCard
                binderById={binderById}
                documentCount={documentCountByFolderId[folder.id] ?? 0}
                draft={draft}
                folder={folder}
                index={index}
                isEditing
                key={folder.id}
                lessonsByBinderId={lessonsByBinderId}
                noteCount={noteCountByFolderId[folder.id] ?? 0}
                showDropTarget={Boolean(activeBinderId && overDragId === folderSortableId(folder.id))}
              />
            ))}
            {filteredFolders.length === 0 ? (
              <EmptyState description="Try another search term." title="No folders match" />
            ) : null}
          </div>
        </SortableContext>
      </section>

      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section__header">
          <div>
            <span className="admin-dashboard-kicker">Binders</span>
            <h2>Organized study objects</h2>
          </div>
        </div>
        <SortableContext
          items={filteredBinders.map((binder) => binderSortableId(binder.id))}
          strategy={rectSortingStrategy}
        >
          <div className="admin-binder-grid">
            {filteredBinders.map((binder, index) => (
              <AdminBinderCard
                binder={binder}
                folder={folderById.get(draft.binderFolderIdByBinderId[binder.id] ?? "") ?? null}
                index={index}
                isEditing
                key={binder.id}
                lessons={lessonsByBinderId[binder.id] ?? []}
              />
            ))}
            {filteredBinders.length === 0 ? (
              <EmptyState description="Try another search term." title="No binders match" />
            ) : null}
          </div>
        </SortableContext>
      </section>

      {showWorkspaceMap ? (
      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section__header">
          <div>
            <span className="admin-dashboard-kicker">Workspace Map</span>
            <h2>Drop binders into folders</h2>
          </div>
          <p>Folder targets pulse while you organize, and binder placement is saved in the admin layout draft.</p>
        </div>
        <div className="admin-workspace-map">
          {orderedFolders.map((folder) => (
            <FolderDropZone
              binderById={binderById}
              draft={draft}
              folder={folder}
              isEditing
              key={folder.id}
              lessonsByBinderId={lessonsByBinderId}
            />
          ))}
          <UnfiledDropZone
            binders={orderedBinders.filter((binder) => !draft.binderFolderIdByBinderId[binder.id])}
            isEditing
            lessonsByBinderId={lessonsByBinderId}
          />
        </div>
      </section>
      ) : null}
    </DndContext>
  );
}

function AdminDashboardDragPreview({
  binderById,
  documentCountByFolderId,
  draft,
  folderById,
  lessonsByBinderId,
  noteCountByFolderId,
  preview,
}: {
  binderById: Map<string, Binder>;
  documentCountByFolderId: Record<string, number>;
  draft: DashboardOrganizationDraft;
  folderById: Map<string, Folder>;
  lessonsByBinderId: Record<string, BinderLesson[]>;
  noteCountByFolderId: Record<string, number>;
  preview: DragPreviewState;
}) {
  if (typeof document === "undefined") {
    return null;
  }

  const folderId = stripPrefix(preview.id, "folder:");
  const folderBinder = parseFolderBinderSortableId(preview.id);
  const binderId = stripPrefix(preview.id, "binder:") ?? folderBinder?.binderId ?? null;
  const folder = folderId ? folderById.get(folderId) ?? null : null;
  const binder = binderId ? binderById.get(binderId) ?? null : null;
  const left = preview.pointerX - preview.offsetX;
  const top = preview.pointerY - preview.offsetY;
  const style = {
    "--admin-drag-preview-height": `${preview.height}px`,
    "--admin-drag-preview-width": `${preview.width}px`,
    "--admin-drag-preview-x": `${left}px`,
    "--admin-drag-preview-y": `${top}px`,
  } as CSSProperties;

  if (folderId && folder) {
    const binderIds = draft.folderBinderOrderByFolderId[folderId] ?? [];
    return createPortal(
      <div className="admin-drag-floating-preview" data-testid="admin-drag-overlay-card" style={style}>
        <article className="admin-folder-card admin-folder-card--preview" data-testid="admin-folder-drag-preview">
          <div className="admin-folder-card__top">
            <span className="admin-folder-card__icon">
              <FolderOpen />
            </span>
            <ChevronRight className="admin-card-arrow" />
          </div>
          <h3>{getDisplayTitle(folder.name, "Recovered Folder")}</h3>
          <p>
            {binderIds.length} binders / {documentCountByFolderId[folderId] ?? 0} documents /{" "}
            {noteCountByFolderId[folderId] ?? 0} notes
          </p>
          <div className="admin-folder-card__preview">
            {binderIds.slice(0, 3).map((nextBinderId) => {
              const nextBinder = binderById.get(nextBinderId);
              return nextBinder ? (
                <span key={nextBinder.id}>
                  {deriveBinderTitle(nextBinder, lessonsByBinderId[nextBinder.id] ?? [])}
                </span>
              ) : null;
            })}
            {binderIds.length === 0 ? <span>No binders yet</span> : null}
          </div>
        </article>
      </div>,
      document.body,
    );
  }

  if (!binder) {
    return null;
  }

  const title = deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? []);
  return createPortal(
    <div className="admin-drag-floating-preview" data-testid="admin-drag-overlay-card" style={style}>
      <article className="admin-binder-card admin-binder-card--preview">
        <div className="admin-binder-card__cover">
          {binder.cover_url ? <img alt="" src={binder.cover_url} /> : <LibraryBig />}
        </div>
        <div className="admin-binder-card__body">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{binder.subject}</Badge>
            {folderBinder ? <Badge variant="outline">Folder placement</Badge> : null}
          </div>
          <h3>{title}</h3>
          <p>{binder.description}</p>
        </div>
      </article>
    </div>,
    document.body,
  );
}

function RecentDocumentsSection({ recentDocuments }: { recentDocuments: BinderLesson[] }) {
  return (
    <section className="admin-dashboard-section" data-testid="admin-dashboard-recent-section">
      <div className="admin-dashboard-section__header">
        <div>
          <span className="admin-dashboard-kicker">Quick Access</span>
          <h2>Recent documents</h2>
        </div>
      </div>
      <div className="admin-dashboard-recent">
        {recentDocuments.map((lesson, index) => (
          <Link
            className="admin-doc-card"
            key={lesson.id}
            style={{ "--stagger-index": index } as CSSProperties}
            to={`/binders/${lesson.binder_id}/documents/${lesson.id}`}
          >
            <span>Document</span>
            <strong>{deriveLessonTitle(lesson)}</strong>
            <ChevronRight />
          </Link>
        ))}
        {recentDocuments.length === 0 ? (
          <EmptyState description="Try a different search term." title="No recent documents match" />
        ) : null}
      </div>
    </section>
  );
}

function AdminStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="admin-dashboard-stat">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AdminFolderCard({
  binderById,
  documentCount,
  draft,
  folder,
  index,
  isEditing,
  lessonsByBinderId,
  noteCount,
  showDropTarget,
}: {
  binderById: Map<string, Binder>;
  documentCount: number;
  draft: DashboardOrganizationDraft;
  folder: Folder;
  index: number;
  isEditing: boolean;
  lessonsByBinderId: Record<string, BinderLesson[]>;
  noteCount: number;
  showDropTarget: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderSortableId(folder.id),
    disabled: !isEditing,
  });
  const binderIds = draft.folderBinderOrderByFolderId[folder.id] ?? [];
  const body = (
    <>
      <div className="admin-folder-card__top">
        {isEditing ? (
          <button
            aria-label={`Drag ${folder.name} to reorder`}
            className="admin-drag-handle"
            type="button"
          >
            <GripVertical />
          </button>
        ) : (
          <span className="admin-folder-card__icon">
            <FolderOpen />
          </span>
        )}
        <ChevronRight className="admin-card-arrow" />
      </div>
      <h3>{getDisplayTitle(folder.name, "Recovered Folder")}</h3>
      <p>
        {binderIds.length} binders / {documentCount} documents / {noteCount} notes
      </p>
      <div className="admin-folder-card__preview">
        {binderIds.slice(0, 3).map((binderId) => {
          const binder = binderById.get(binderId);
          return binder ? (
            <span key={binder.id}>
              {deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])}
            </span>
          ) : null;
        })}
        {binderIds.length === 0 ? <span>No binders yet</span> : null}
      </div>
    </>
  );

  return isEditing ? (
    <article
      className={cn(
        "admin-folder-card",
        isDragging && "admin-card--dragging",
        showDropTarget && "admin-folder-card--over",
      )}
      data-admin-sortable-id={folderSortableId(folder.id)}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        "--stagger-index": index,
        transform: CSS.Transform.toString(transform),
        transition,
      } as CSSProperties}
    >
      {body}
    </article>
  ) : (
    <Link
      className={cn("admin-folder-card", showDropTarget && "admin-folder-card--over")}
      style={{ "--stagger-index": index } as CSSProperties}
      to={`/folders/${folder.id}`}
    >
      {body}
    </Link>
  );
}

function StaticAdminFolderCard({
  binderById,
  documentCount,
  draft,
  folder,
  index,
  lessonsByBinderId,
  noteCount,
}: {
  binderById: Map<string, Binder>;
  documentCount: number;
  draft: DashboardOrganizationDraft;
  folder: Folder;
  index: number;
  lessonsByBinderId: Record<string, BinderLesson[]>;
  noteCount: number;
}) {
  const binderIds = draft.folderBinderOrderByFolderId[folder.id] ?? [];

  return (
    <Link
      className="admin-folder-card"
      style={{ "--stagger-index": index } as CSSProperties}
      to={`/folders/${folder.id}`}
    >
      <div className="admin-folder-card__top">
        <span className="admin-folder-card__icon">
          <FolderOpen />
        </span>
        <ChevronRight className="admin-card-arrow" />
      </div>
      <h3>{getDisplayTitle(folder.name, "Recovered Folder")}</h3>
      <p>
        {binderIds.length} binders / {documentCount} documents / {noteCount} notes
      </p>
      <div className="admin-folder-card__preview">
        {binderIds.slice(0, 3).map((binderId) => {
          const binder = binderById.get(binderId);
          return binder ? (
            <span key={binder.id}>
              {deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])}
            </span>
          ) : null;
        })}
        {binderIds.length === 0 ? <span>No binders yet</span> : null}
      </div>
    </Link>
  );
}

function AdminBinderCard({
  binder,
  folder,
  index,
  isEditing,
  lessons,
}: {
  binder: Binder;
  folder: Folder | null;
  index: number;
  isEditing: boolean;
  lessons: BinderLesson[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: binderSortableId(binder.id),
    disabled: !isEditing,
  });
  const title = deriveBinderTitle(binder, lessons);
  const body = (
    <>
      <div className="admin-binder-card__cover">
        {binder.cover_url ? <img alt="" src={binder.cover_url} /> : <LibraryBig />}
        {isEditing ? (
          <button
            aria-label={`Drag ${title} to reorder`}
            className="admin-drag-handle"
            type="button"
          >
            <GripVertical />
          </button>
        ) : null}
      </div>
      <div className="admin-binder-card__body">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{binder.subject}</Badge>
          {folder ? <Badge variant="outline">{getDisplayTitle(folder.name, "Recovered Folder")}</Badge> : null}
        </div>
        <h3>{title}</h3>
        <p>{binder.description}</p>
      </div>
    </>
  );

  return isEditing ? (
    <article
      className={cn("admin-binder-card", isDragging && "admin-card--dragging")}
      data-admin-sortable-id={binderSortableId(binder.id)}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        "--stagger-index": index,
        transform: CSS.Transform.toString(transform),
        transition,
      } as CSSProperties}
    >
      {body}
    </article>
  ) : (
    <Link
      className="admin-binder-card"
      style={{ "--stagger-index": index } as CSSProperties}
      to={`/binders/${binder.id}`}
    >
      {body}
    </Link>
  );
}

function StaticAdminBinderCard({
  binder,
  folder,
  index,
  lessons,
}: {
  binder: Binder;
  folder: Folder | null;
  index: number;
  lessons: BinderLesson[];
}) {
  const title = deriveBinderTitle(binder, lessons);

  return (
    <Link
      className="admin-binder-card"
      style={{ "--stagger-index": index } as CSSProperties}
      to={`/binders/${binder.id}`}
    >
      <div className="admin-binder-card__cover">
        {binder.cover_url ? <img alt="" src={binder.cover_url} /> : <LibraryBig />}
      </div>
      <div className="admin-binder-card__body">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{binder.subject}</Badge>
          {folder ? <Badge variant="outline">{getDisplayTitle(folder.name, "Recovered Folder")}</Badge> : null}
        </div>
        <h3>{title}</h3>
        <p>{binder.description}</p>
      </div>
    </Link>
  );
}

function FolderDropZone({
  binderById,
  draft,
  folder,
  isEditing,
  lessonsByBinderId,
}: {
  binderById: Map<string, Binder>;
  draft: DashboardOrganizationDraft;
  folder: Folder;
  isEditing: boolean;
  lessonsByBinderId: Record<string, BinderLesson[]>;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: folderDropId(folder.id),
    disabled: !isEditing,
  });
  const binderIds = draft.folderBinderOrderByFolderId[folder.id] ?? [];

  return (
    <article
      className={cn("admin-folder-drop-zone", isOver && "admin-folder-drop-zone--over")}
      data-admin-drop-id={folderDropId(folder.id)}
      ref={setNodeRef}
    >
      <div className="admin-folder-drop-zone__header">
        <FolderOpen />
        <div>
          <h3>{getDisplayTitle(folder.name, "Recovered Folder")}</h3>
          <p>{isEditing ? "Drop binders here" : `${binderIds.length} binders`}</p>
        </div>
      </div>
      <SortableContext
        disabled={!isEditing}
        items={binderIds.map((binderId) => folderBinderSortableId(folder.id, binderId))}
        strategy={verticalListSortingStrategy}
      >
        <div className="admin-folder-drop-zone__list">
          {binderIds.map((binderId) => {
            const binder = binderById.get(binderId);
            return binder ? (
              <FolderBinderChip
                binder={binder}
                folderId={folder.id}
                isEditing={isEditing}
                key={binder.id}
                lessons={lessonsByBinderId[binder.id] ?? []}
              />
            ) : null;
          })}
          {binderIds.length === 0 ? <p className="admin-drop-empty">No binders in this folder.</p> : null}
        </div>
      </SortableContext>
    </article>
  );
}

function StaticFolderDropZone({
  binderById,
  draft,
  folder,
  lessonsByBinderId,
}: {
  binderById: Map<string, Binder>;
  draft: DashboardOrganizationDraft;
  folder: Folder;
  lessonsByBinderId: Record<string, BinderLesson[]>;
}) {
  const binderIds = draft.folderBinderOrderByFolderId[folder.id] ?? [];

  return (
    <article className="admin-folder-drop-zone">
      <div className="admin-folder-drop-zone__header">
        <FolderOpen />
        <div>
          <h3>{getDisplayTitle(folder.name, "Recovered Folder")}</h3>
          <p>{binderIds.length} binders</p>
        </div>
      </div>
      <div className="admin-folder-drop-zone__list">
        {binderIds.map((binderId) => {
          const binder = binderById.get(binderId);
          return binder ? (
            <div className="admin-folder-binder-chip" key={binder.id}>
              <span>{deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])}</span>
            </div>
          ) : null;
        })}
        {binderIds.length === 0 ? <p className="admin-drop-empty">No binders in this folder.</p> : null}
      </div>
    </article>
  );
}

function FolderBinderChip({
  binder,
  folderId,
  isEditing,
  lessons,
}: {
  binder: Binder;
  folderId: string;
  isEditing: boolean;
  lessons: BinderLesson[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderBinderSortableId(folderId, binder.id),
    disabled: !isEditing,
  });
  const title = deriveBinderTitle(binder, lessons);

  return (
    <div
      className={cn("admin-folder-binder-chip", isDragging && "admin-card--dragging")}
      data-admin-sortable-id={folderBinderSortableId(folderId, binder.id)}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {isEditing ? (
        <button
          aria-label={`Drag ${title} to reorder`}
          className="admin-mini-drag-handle"
          type="button"
        >
          <GripVertical />
        </button>
      ) : null}
      <span>{title}</span>
    </div>
  );
}

function StaticUnfiledDropZone({
  binders,
  lessonsByBinderId,
}: {
  binders: Binder[];
  lessonsByBinderId: Record<string, BinderLesson[]>;
}) {
  return (
    <article className="admin-folder-drop-zone admin-folder-drop-zone--unfiled">
      <div className="admin-folder-drop-zone__header">
        <LibraryBig />
        <div>
          <h3>Unfiled binders</h3>
          <p>{binders.length} binders</p>
        </div>
      </div>
      <div className="admin-folder-drop-zone__list">
        {binders.map((binder) => (
          <div className="admin-folder-binder-chip" key={binder.id}>
            <span>{deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])}</span>
          </div>
        ))}
        {binders.length === 0 ? <p className="admin-drop-empty">Everything is filed.</p> : null}
      </div>
    </article>
  );
}

function UnfiledDropZone({
  binders,
  isEditing,
  lessonsByBinderId,
}: {
  binders: Binder[];
  isEditing: boolean;
  lessonsByBinderId: Record<string, BinderLesson[]>;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: folderDropId(unfiledDashboardFolderId),
    disabled: !isEditing,
  });

  return (
    <article
      className={cn("admin-folder-drop-zone admin-folder-drop-zone--unfiled", isOver && "admin-folder-drop-zone--over")}
      data-admin-drop-id={folderDropId(unfiledDashboardFolderId)}
      ref={setNodeRef}
    >
      <div className="admin-folder-drop-zone__header">
        <LibraryBig />
        <div>
          <h3>Unfiled binders</h3>
          <p>{isEditing ? "Drop here to remove from folders" : `${binders.length} binders`}</p>
        </div>
      </div>
      <div className="admin-folder-drop-zone__list">
        {binders.map((binder) => (
          <div className="admin-folder-binder-chip" key={binder.id}>
            <span>{deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])}</span>
          </div>
        ))}
        {binders.length === 0 ? <p className="admin-drop-empty">Everything is filed.</p> : null}
      </div>
    </article>
  );
}

function useDebouncedValue<T>(value: T, delayMs = 120) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
