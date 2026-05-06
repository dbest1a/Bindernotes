import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
  BookCopy,
  Check,
  ChevronRight,
  FolderOpen,
  GripVertical,
  LibraryBig,
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
            return binder ? deriveBinderTitle(binder, lessonsByBinderId[binderId] ?? []) : "";
          })
          .join(" ")}`.toLowerCase().includes(normalizedQuery),
      ),
    [binderById, draft.folderBinderOrderByFolderId, lessonsByBinderId, normalizedQuery, orderedFolders],
  );
  const filteredBinders = useMemo(
    () =>
      orderedBinders.filter((binder) =>
        `${deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])} ${binder.subject} ${binder.description}`
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [lessonsByBinderId, normalizedQuery, orderedBinders],
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
              placeholder="Search folders, binders, documents"
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
          filteredBinders={filteredBinders}
          filteredFolders={filteredFolders}
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
          recentDocuments={recentDocuments}
        />
      ) : (
        <AdminDashboardReadOnlySections
          binderById={binderById}
          documentCountByFolderId={documentCountByFolderId}
          draft={draft}
          filteredBinders={filteredBinders}
          filteredFolders={filteredFolders}
          folderById={folderById}
          lessonsByBinderId={lessonsByBinderId}
          noteCountByFolderId={noteCountByFolderId}
          orderedBinders={orderedBinders}
          orderedFolders={orderedFolders}
          recentDocuments={recentDocuments}
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
}: AdminDashboardSectionsProps) {
  return (
    <>
      <RecentDocumentsSection recentDocuments={recentDocuments} />

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
      <RecentDocumentsSection recentDocuments={recentDocuments} />

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
    <section className="admin-dashboard-section">
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
