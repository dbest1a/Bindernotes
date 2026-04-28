import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  reorderDashboardBinders,
  reorderDashboardFolders,
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
import { cn } from "@/lib/utils";

type AdminDashboardMakeoverProps = {
  data: DashboardData;
  profile: Profile;
  query: string;
  onQueryChange: (query: string) => void;
  onSwitchNormal: () => void;
};

type SaveState = "idle" | "saved" | "draft";

const folderSortableId = (folderId: string) => `folder:${folderId}`;
const binderSortableId = (binderId: string) => `binder:${binderId}`;
const folderBinderSortableId = (folderId: string, binderId: string) =>
  `folder-binder:${folderId}:${binderId}`;
const folderDropId = (folderId: string) => `folder-drop:${folderId}`;

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
  onSwitchNormal,
  profile,
  query,
}: AdminDashboardMakeoverProps) {
  const [draft, setDraft] = useState<DashboardOrganizationDraft>(() =>
    loadDashboardOrganizationDraft(profile.id, data),
  );
  const [savedDraft, setSavedDraft] = useState<DashboardOrganizationDraft>(() =>
    loadDashboardOrganizationDraft(profile.id, data),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDragId, setOverDragId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const deferredQuery = useDeferredValue(query);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const nextDraft = loadDashboardOrganizationDraft(profile.id, data);
    setDraft(nextDraft);
    setSavedDraft(nextDraft);
  }, [data, profile.id]);

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
  const activeFolderId = activeDragId ? stripPrefix(activeDragId, "folder:") : null;
  const activeBinder = activeBinderId ? binderById.get(activeBinderId) ?? null : null;
  const activeFolder = activeFolderId ? folderById.get(activeFolderId) ?? null : null;
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
          `${deriveLessonTitle(lesson)} ${JSON.stringify(lesson.content)}`.toLowerCase(),
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
    setActiveDragId(String(event.active.id));
    setOverDragId(null);
  };

  const onDragOver = (event: DragOverEvent) => {
    const nextOverId = event.over?.id ? String(event.over.id) : null;
    setOverDragId((currentOverId) => (currentOverId === nextOverId ? currentOverId : nextOverId));
  };

  const clearDragState = () => {
    setActiveDragId(null);
    setOverDragId(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) {
      clearDragState();
      return;
    }

    const activeFolderId = stripPrefix(activeId, "folder:");
    if (activeFolderId) {
      const overFolderId = stripPrefix(overId, "folder:");
      if (overFolderId) {
        setDraft((current) => reorderDashboardFolders(current, activeFolderId, overFolderId));
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

    const overFolderId = stripPrefix(overId, "folder-drop:") ?? stripPrefix(overId, "folder:");
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

    const overFolderBinder = parseFolderBinderSortableId(overId);
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

    const overBinderId = stripPrefix(overId, "binder:");
    if (overBinderId) {
      setDraft((current) => reorderDashboardBinders(current, activeBinderId, overBinderId));
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
      data-testid="admin-dashboard-makeover"
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
            <button className="admin-dashboard-toggle__item admin-dashboard-toggle__item--active" type="button">
              Admin Makeover
            </button>
            <button className="admin-dashboard-toggle__item" onClick={onSwitchNormal} type="button">
              Normal
            </button>
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

      <DndContext
        collisionDetection={closestCenter}
        onDragCancel={clearDragState}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        sensors={sensors}
      >
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

        <section className="admin-dashboard-section">
          <div className="admin-dashboard-section__header">
            <div>
              <span className="admin-dashboard-kicker">Folders</span>
              <h2>Drive-style spaces</h2>
            </div>
          </div>
          <SortableContext
            disabled={!isEditing}
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
                  isEditing={isEditing}
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
            disabled={!isEditing}
            items={filteredBinders.map((binder) => binderSortableId(binder.id))}
            strategy={rectSortingStrategy}
          >
            <div className="admin-binder-grid">
              {filteredBinders.map((binder, index) => (
                <AdminBinderCard
                  binder={binder}
                  folder={folderById.get(draft.binderFolderIdByBinderId[binder.id] ?? "") ?? null}
                  index={index}
                  isEditing={isEditing}
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
                isEditing={isEditing}
                key={folder.id}
                lessonsByBinderId={lessonsByBinderId}
              />
            ))}
            <UnfiledDropZone
              binders={orderedBinders.filter((binder) => !draft.binderFolderIdByBinderId[binder.id])}
              isEditing={isEditing}
              lessonsByBinderId={lessonsByBinderId}
            />
          </div>
        </section>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
          {activeFolder ? (
            <div className="admin-drag-preview admin-drag-preview--folder">
              <FolderOpen />
              <span>{getDisplayTitle(activeFolder.name, "Recovered Folder")}</span>
            </div>
          ) : activeBinder ? (
            <div className="admin-drag-preview admin-drag-preview--binder">
              <LibraryBig />
              <span>{deriveBinderTitle(activeBinder, lessonsByBinderId[activeBinder.id] ?? [])}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </main>
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
            {...attributes}
            {...listeners}
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
      ref={setNodeRef}
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
            {...attributes}
            {...listeners}
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
      ref={setNodeRef}
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
      ref={setNodeRef}
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
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </button>
      ) : null}
      <span>{title}</span>
    </div>
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
