import { Link, useSearchParams } from "react-router-dom";
import {
  BookPlus,
  BookCopy,
  ChevronRight,
  FileText,
  FolderPlus,
  FolderOpen,
  GripVertical,
  LibraryBig,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import {
  Suspense,
  lazy,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SeedHealthPanel } from "@/components/ui/seed-health-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceDiagnosticsPanel } from "@/components/ui/workspace-diagnostics-panel";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard, useDashboardWorkspaceMutations } from "@/hooks/use-binders";
import { useDashboardExperience } from "@/hooks/use-dashboard-experience";
import {
  dashboardWorkspaceScopeLabels,
  useDashboardWorkspaceViewPreference,
  type DashboardWorkspaceDensity,
  type DashboardWorkspaceScope,
  type DashboardWorkspaceSort,
  type DashboardWorkspaceWidth,
} from "@/hooks/use-dashboard-workspace-view";
import { useWorkspacePresentationPreference } from "@/hooks/use-workspace-presentation-preference";
import {
  deriveBinderTitle,
  deriveLessonTitle,
  filterActionableDiagnostics,
  getDisplayTitle,
  isPlaceholderBinder,
} from "@/lib/workspace-records";
import { isMissingSeedError } from "@/lib/seed-health";
import { buildLearnerWorkspaceMessage, classifyRuntimeError } from "@/lib/workspace-diagnostics";
import { createFolderSummary, getPrimaryFolder } from "@/lib/workspace-structure";
import {
  createDashboardOrganizationDraft,
  loadDashboardOrganizationDraft,
  saveDashboardOrganizationDraft,
} from "@/lib/dashboard-organization";
import { markDevPerformance, measureDevPerformance } from "@/lib/performance-marks";
import { cn } from "@/lib/utils";
import type { DashboardData, Profile } from "@/types";

const LazyAdminDashboardMakeover = lazy(() =>
  import("@/components/dashboard/admin-dashboard-makeover").then((module) => ({
    default: module.AdminDashboardMakeover,
  })),
);

type DashboardFilteredData = {
  folderSummaries: ReturnType<typeof createFolderSummary>[];
  folderNamesByBinderId: Record<string, string | null>;
  lessonsByBinderId: Record<string, DashboardData["lessons"]>;
  recentDocuments: DashboardData["recentLessons"];
  studyReadyBinders: DashboardData["binders"];
};

const dashboardNoticeDismissMs = 10000;
type WorkspaceCreateKind = "folder" | "binder" | "document";
const workspaceSubjectOptions = ["General", "Chemistry", "Mathematics", "History", "Study Skills"] as const;

function inferSubjectFromName(value: string | null | undefined) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("chem")) return "Chemistry";
  if (normalized.includes("math") || normalized.includes("algebra") || normalized.includes("calculus")) {
    return "Mathematics";
  }
  if (normalized.includes("history") || normalized.includes("rome") || normalized.includes("revolution")) {
    return "History";
  }
  if (normalized.includes("study") || normalized.includes("writing")) return "Study Skills";
  return "General";
}

export function DashboardPage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error } = useDashboard(profile);
  const isAdminProfile = profile?.role === "admin";
  const dashboardExperience = useDashboardExperience(profile ? isAdminProfile : undefined);
  const workspacePresentation = useWorkspacePresentationPreference();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const deferredQuery = useDeferredValue(debouncedQuery);
  const showSystemDiagnostics =
    (profile?.role === "admin" || import.meta.env.DEV) &&
    searchParams.get("debug") === "system";

  useEffect(() => {
    markDevPerformance("dashboard-render");
  });

  const dashboardSearchIndex = useMemo(() => {
    if (!data) {
      return null;
    }

    const lessonsByBinderId = data.lessons.reduce<Record<string, typeof data.lessons>>((groups, lesson) => {
      groups[lesson.binder_id] = groups[lesson.binder_id] ?? [];
      groups[lesson.binder_id].push(lesson);
      return groups;
    }, {});
    for (const binder of data.binders) {
      lessonsByBinderId[binder.id] = lessonsByBinderId[binder.id] ?? [];
    }
    const folderNamesByBinderId = Object.fromEntries(
      data.binders.map((binder) => [
        binder.id,
        getPrimaryFolder(data.binders, data.folders, data.folderBinders, binder.id)?.name ?? null,
      ]),
    ) as Record<string, string | null>;
    const lessonSearchTextByBinderId = new Map(
      data.binders.map((binder) => [
        binder.id,
        (lessonsByBinderId[binder.id] ?? []).map((lesson) => deriveLessonTitle(lesson)).join(" "),
      ]),
    );
    const noteSearchTextByBinderId = new Map(
      data.binders.map((binder) => [
        binder.id,
        data.notes
          .filter((note) => note.binder_id === binder.id)
          .map((note) => note.title)
          .join(" "),
      ]),
    );
    const recentDocumentSearchTextById = new Map(
      data.recentLessons.map((lesson) => {
        const binder = data.binders.find((candidate) => candidate.id === lesson.binder_id);
        return [
          lesson.id,
          `${deriveLessonTitle(lesson)} ${folderNamesByBinderId[lesson.binder_id] ?? ""} ${
            binder ? deriveBinderTitle(binder, lessonsByBinderId[lesson.binder_id] ?? []) : ""
          }`.toLowerCase(),
        ];
      }),
    );
    const binderSearchTextById = new Map(
      data.binders.map((binder) => [
        binder.id,
        `${deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])} ${binder.subject} ${binder.description} ${
          folderNamesByBinderId[binder.id] ?? ""
        } ${lessonSearchTextByBinderId.get(binder.id) ?? ""} ${
          noteSearchTextByBinderId.get(binder.id) ?? ""
        }`.toLowerCase(),
      ]),
    );

    return {
      binderSearchTextById,
      folderNamesByBinderId,
      lessonSearchTextByBinderId,
      lessonsByBinderId,
      noteSearchTextByBinderId,
      recentDocumentSearchTextById,
    };
  }, [data]);

  const filtered = useMemo(
    () =>
      measureDevPerformance("dashboard-search", () => {
        if (!data || !dashboardSearchIndex) {
          return null;
        }

        const normalized = deferredQuery.trim().toLowerCase();
        const {
          binderSearchTextById,
          folderNamesByBinderId,
          lessonSearchTextByBinderId,
          lessonsByBinderId,
          noteSearchTextByBinderId,
          recentDocumentSearchTextById,
        } = dashboardSearchIndex;

        const folderSummaries = data.folders
          .map((folder) =>
            createFolderSummary(folder, data.binders, data.folderBinders, data.notes, data.lessons),
          )
          .filter((summary) =>
            `${getDisplayTitle(summary.folder.name, "Recovered Folder")} ${summary.binders
              .map(
                (binder) =>
                  `${deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])} ${
                    lessonSearchTextByBinderId.get(binder.id) ?? ""
                  } ${noteSearchTextByBinderId.get(binder.id) ?? ""}`,
              )
              .join(" ")}`
              .toLowerCase()
              .includes(normalized),
          );

        const studyReadyBinders = data.binders.filter((binder) =>
          (binderSearchTextById.get(binder.id) ?? "").includes(normalized),
        );

        const recentDocuments = data.recentLessons
          .filter((lesson) => (recentDocumentSearchTextById.get(lesson.id) ?? "").includes(normalized))
          .slice(0, 6);

        return { folderSummaries, studyReadyBinders, recentDocuments, lessonsByBinderId, folderNamesByBinderId };
      }),
    [dashboardSearchIndex, data, deferredQuery],
  );

  const actionableDiagnostics = filterActionableDiagnostics(data?.diagnostics ?? []);
  const learnerDiagnosticsMessage = actionableDiagnostics.length
    ? buildLearnerWorkspaceMessage(actionableDiagnostics)
    : null;
  const runtimeDiagnostics =
    error && showSystemDiagnostics
      ? classifyRuntimeError("workspace", error)
      : [];
  const resolvedFiltered: DashboardFilteredData = filtered ?? {
    folderSummaries: [],
    studyReadyBinders: [],
    recentDocuments: [],
    lessonsByBinderId: {},
    folderNamesByBinderId: {} as Record<string, string | null>,
  };
  const hasVisibleContent =
    resolvedFiltered.folderSummaries.length > 0 ||
    resolvedFiltered.studyReadyBinders.length > 0 ||
    resolvedFiltered.recentDocuments.length > 0;

  if (
    profile?.role === "admin" &&
    dashboardExperience.isAdminMakeoverActive &&
    data &&
    filtered &&
    !isLoading &&
    !error
  ) {
    return (
      <Suspense
        fallback={
          <main className="app-page">
            <Skeleton className="h-[420px]" />
          </main>
        }
      >
        <LazyAdminDashboardMakeover
          data={data}
          onQueryChange={setQuery}
          onViewModeChange={dashboardExperience.setViewMode}
          profile={profile}
          query={query}
          viewMode={dashboardExperience.effectiveViewMode}
        />
      </Suspense>
    );
  }

  if (dashboardExperience.isMinimalActive && profile && data && filtered && !isLoading && !error) {
    return (
      <MinimalDashboardView
        appearance="minimal"
        canOpenAdminMakeover={isAdminProfile}
        data={data}
        filtered={resolvedFiltered}
        hasVisibleContent={hasVisibleContent}
        learnerDiagnosticsMessage={learnerDiagnosticsMessage}
        onOpenAdminMakeover={() => dashboardExperience.setViewMode("admin-makeover")}
        onQueryChange={setQuery}
        profile={profile}
        query={query}
        showSystemDiagnostics={showSystemDiagnostics}
        workspacePresentation={workspacePresentation}
      />
    );
  }

  if (profile && data && filtered && !isLoading && !error) {
    return (
      <MinimalDashboardView
        appearance="normal"
        canOpenAdminMakeover={isAdminProfile}
        data={data}
        filtered={resolvedFiltered}
        hasVisibleContent={hasVisibleContent}
        learnerDiagnosticsMessage={learnerDiagnosticsMessage}
        onOpenAdminMakeover={() => dashboardExperience.setViewMode("admin-makeover")}
        onQueryChange={setQuery}
        profile={profile}
        query={query}
        showSystemDiagnostics={showSystemDiagnostics}
        workspacePresentation={workspacePresentation}
      />
    );
  }

  return (
    <main
      className={cn("dashboard-page app-page", dashboardExperience.isMinimalActive && "dashboard-page--minimal")}
      data-dashboard-appearance={dashboardExperience.effectiveViewMode}
      data-testid="dashboard-page"
      data-workspace-presentation={workspacePresentation}
    >
      <section className="dashboard-hero hero-grid">
        <div className="page-shell p-6 sm:p-8">
          <Badge variant="outline">Workspace</Badge>
          <h1 className="mt-4 page-heading max-w-4xl text-4xl sm:text-5xl">
            A real study hierarchy: folders, binders, then documents.
          </h1>
          <p className="mt-4 max-w-2xl page-copy">
            Start at the workspace, open a folder, move into a binder, and only then step into the
            specific document you want to study.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Metric label="Folders" value={data?.folders.length ?? 0} icon={<FolderOpen />} />
            <Metric label="Binders" value={data?.binders.length ?? 0} icon={<LibraryBig />} />
            <Metric label="Documents" value={data?.lessons.length ?? 0} icon={<BookCopy />} />
          </div>
        </div>

        <aside className="hero-aside">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              data-icon="inline-start"
            />
            <Input
              className="pl-10"
              data-testid="dashboard-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search folders, binders, documents"
              value={query}
            />
          </div>
          <div className="mt-5 space-y-3">
            <div className="utility-panel">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Sparkles className="text-primary" data-icon="inline-start" />
                Better document flow
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Real study material stays near the top. Empty drafts and backend diagnostics no longer
                crowd the main workspace view.
              </p>
              <Button asChild className="mt-3" size="sm" type="button" variant="outline">
                <Link data-testid="dashboard-primary-action" to="/tutorial">
                  Open feature tutorial
                  <ChevronRight data-icon="inline-start" />
                </Link>
              </Button>
              {profile?.role === "admin" ? (
                <Button
                  className="mt-3"
                  onClick={() => dashboardExperience.setViewMode("admin-makeover")}
                  size="sm"
                  type="button"
                >
                  <Sparkles data-icon="inline-start" />
                  Open Admin Makeover
                </Button>
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      {error ? (
        <div className="grid gap-4">
          {runtimeDiagnostics.length ? (
            <WorkspaceDiagnosticsPanel diagnostics={runtimeDiagnostics} />
          ) : null}
          {showSystemDiagnostics && isMissingSeedError(error) ? (
            <SeedHealthPanel items={[error.seedHealth]} />
          ) : null}
          <EmptyState
            description={
              showSystemDiagnostics && error instanceof Error
                ? error.message
                : "This workspace is temporarily unavailable. Try again in a moment."
            }
            title="Could not load workspace"
          />
        </div>
      ) : null}

      {isLoading || (!filtered && !error) ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[240px]" />
          <Skeleton className="h-[240px]" />
          <Skeleton className="h-[240px]" />
        </div>
      ) : !error ? (
        <>
          <section className="grid gap-4">
            <div>
              <span className="page-kicker">Folders</span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">Open a workspace container</h2>
            </div>
            <div className="dashboard-minimal-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {resolvedFiltered.folderSummaries.map((summary) => (
                <Link
                  className="dashboard-folder-card ui-click-tile group page-shell block p-6 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
                  data-testid="dashboard-folder-card"
                  key={summary.folder.id}
                  to={`/folders/${summary.folder.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex size-12 items-center justify-center rounded-lg text-white shadow-sm"
                      style={{ backgroundColor: folderColor(summary.folder.color) }}
                    >
                      <FolderOpen className="size-5" />
                    </div>
                    <ChevronRight className="text-muted-foreground transition group-hover:text-foreground" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                    {getDisplayTitle(summary.folder.name, "Recovered Folder")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {summary.binders.length} binders · {summary.lessons.length} documents · {summary.notes.length} personal notes
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {summary.binders.slice(0, 3).map((binder) => (
                      <span
                        className="rounded-md border border-border/70 bg-background/80 px-2.5 py-1 text-xs font-medium"
                        key={binder.id}
                      >
                        {deriveBinderTitle(
                          binder,
                          resolvedFiltered.lessonsByBinderId[binder.id] ?? [],
                        )}
                      </span>
                    ))}
                    {summary.binders.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No binders in this folder yet</span>
                    ) : null}
                  </div>
                </Link>
              ))}
              {resolvedFiltered.folderSummaries.length === 0 ? (
                <EmptyState
                  description="Organized folders will show up here once they contain real binders."
                  title="No folders to open yet"
                />
              ) : null}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid gap-4">
              <div>
                <span className="page-kicker">Binders</span>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight">Ready to study</h2>
              </div>
              <div className="dashboard-minimal-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {resolvedFiltered.studyReadyBinders.map((binder) => (
                  <Link
                    className="dashboard-binder-card ui-click-tile group page-shell block overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
                    data-testid="dashboard-binder-card"
                    key={binder.id}
                    to={`/binders/${binder.id}`}
                  >
                    {binder.cover_url ? (
                      <img alt="" className="h-44 w-full object-cover" src={binder.cover_url} />
                    ) : (
                      <div className="h-44 bg-gradient-to-br from-accent via-secondary to-background" />
                    )}
                    <div className="p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{binder.subject}</Badge>
                          {resolvedFiltered.folderNamesByBinderId[binder.id] ? (
                            <Badge variant="outline">
                              {getDisplayTitle(
                                resolvedFiltered.folderNamesByBinderId[binder.id],
                                "Recovered Folder",
                              )}
                            </Badge>
                          ) : null}
                        </div>
                        <ChevronRight className="text-muted-foreground transition group-hover:text-foreground" />
                      </div>
                      <h3 className="mt-4 text-xl font-semibold tracking-tight">
                        {deriveBinderTitle(
                          binder,
                          resolvedFiltered.lessonsByBinderId[binder.id] ?? [],
                        )}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{binder.description}</p>
                    </div>
                  </Link>
                ))}
                {resolvedFiltered.studyReadyBinders.length === 0 ? (
                  <EmptyState
                    description={query.trim() ? "Try a different search term." : "Your visible binders will show up here as soon as they're ready to study."}
                    title={query.trim() ? "No binders match" : "No binders ready yet"}
                  />
                ) : null}
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <span className="page-kicker">Documents</span>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight">Recent documents</h2>
              </div>
              <div className="page-shell p-4">
                <div className="flex flex-col gap-3">
                  {resolvedFiltered.recentDocuments.map((lesson) => (
                    <Link
                      className="dashboard-recent-document ui-click-tile rounded-lg border border-border/75 bg-background/88 p-4 transition hover:bg-secondary/80"
                      data-testid="dashboard-recent-document"
                      key={lesson.id}
                      to={`/binders/${lesson.binder_id}/documents/${lesson.id}`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Document
                      </p>
                      <p className="mt-2 font-medium">{deriveLessonTitle(lesson)}</p>
                    </Link>
                  ))}
                  {resolvedFiltered.recentDocuments.length === 0 ? (
                    <EmptyState
                      description={
                        query.trim()
                          ? "Try a different search term."
                          : "Open a binder and add your first document when you're ready."
                      }
                      title={query.trim() ? "No documents match" : "No recent documents yet"}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {!hasVisibleContent && learnerDiagnosticsMessage ? (
            <EmptyState
              description={learnerDiagnosticsMessage}
              title="Workspace unavailable"
            />
          ) : null}
          {!hasVisibleContent &&
          showSystemDiagnostics &&
          data?.seedHealth.some((item) => item.status !== "healthy") ? (
            <SeedHealthPanel
              items={data.seedHealth.filter((item) => item.status !== "healthy")}
              showTechnicalDetails
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function MinimalDashboardView({
  appearance,
  canOpenAdminMakeover,
  data,
  filtered,
  hasVisibleContent,
  learnerDiagnosticsMessage,
  onOpenAdminMakeover,
  onQueryChange,
  profile,
  query,
  showSystemDiagnostics,
  workspacePresentation,
}: {
  appearance: "minimal" | "normal";
  canOpenAdminMakeover: boolean;
  data: DashboardData;
  filtered: DashboardFilteredData;
  hasVisibleContent: boolean;
  learnerDiagnosticsMessage: string | null;
  onOpenAdminMakeover: () => void;
  onQueryChange: (query: string) => void;
  profile: Profile;
  query: string;
  showSystemDiagnostics: boolean;
  workspacePresentation: string;
}) {
  const stats = [
    { icon: <FolderOpen />, label: "Folders", value: data.folders.length },
    { icon: <LibraryBig />, label: "Binders", value: data.binders.length },
    { icon: <BookCopy />, label: "Documents", value: data.lessons.length },
  ];
  const notesByBinderId = useMemo(
    () =>
      data.notes.reduce<Record<string, DashboardData["notes"]>>((groups, note) => {
        groups[note.binder_id] = groups[note.binder_id] ?? [];
        groups[note.binder_id].push(note);
        return groups;
      }, {}),
    [data.notes],
  );
  const minimalStudyBinders = useMemo(
    () =>
      filtered.studyReadyBinders.filter(
        (binder) =>
          !isPlaceholderBinder({
            binder,
            lessons: filtered.lessonsByBinderId[binder.id] ?? [],
            notes: notesByBinderId[binder.id] ?? [],
          }),
    ),
    [filtered.lessonsByBinderId, filtered.studyReadyBinders, notesByBinderId],
  );
  const canManageWorkspace = profile.role === "admin";
  const workspaceMutations = useDashboardWorkspaceMutations(profile);
  const filebarRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [openDriveMenu, setOpenDriveMenu] = useState<"new" | "browse" | "open" | "view" | null>(null);
  const [createKind, setCreateKind] = useState<WorkspaceCreateKind | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBinderId, setDraftBinderId] = useState("");
  const [draftFolderId, setDraftFolderId] = useState("");
  const [draftSubject, setDraftSubject] = useState<string>("General");
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);
  const [workspaceView, updateWorkspaceView] = useDashboardWorkspaceViewPreference(profile.id);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [folderOrder, setFolderOrder] = useState<string[]>(() =>
    loadDashboardOrganizationDraft(profile.id, data).folderOrder,
  );

  useEffect(() => {
    if (!dashboardNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDashboardNotice(null);
    }, dashboardNoticeDismissMs);

    return () => window.clearTimeout(timeoutId);
  }, [dashboardNotice]);

  const dashboardPrefix = appearance === "minimal" ? "minimal" : "normal";
  const isMinimalAppearance = appearance === "minimal";
  const dashboardIntro =
    appearance === "minimal"
      ? "Folders, binders, and recent documents in the quickest scan view."
      : "Browse folders, binders, and lesson documents from one organized workspace.";
  const nextDocument = filtered.recentDocuments[0];
  const folderSummaryById = useMemo(
    () => new Map(filtered.folderSummaries.map((summary) => [summary.folder.id, summary])),
    [filtered.folderSummaries],
  );
  const orderedFolderSummaries = useMemo(() => {
    const ordered = folderOrder
      .map((folderId) => folderSummaryById.get(folderId))
      .filter(Boolean) as DashboardFilteredData["folderSummaries"];
    return [
      ...ordered,
      ...filtered.folderSummaries.filter(
        (summary) => !folderOrder.includes(summary.folder.id),
      ),
    ];
  }, [filtered.folderSummaries, folderOrder, folderSummaryById]);
  const sortedFolderSummaries = useMemo(() => {
    const summaries = [...orderedFolderSummaries];
    if (workspaceView.sort === "name") {
      return summaries.sort((left, right) =>
        getDisplayTitle(left.folder.name, "Recovered Folder").localeCompare(
          getDisplayTitle(right.folder.name, "Recovered Folder"),
        ),
      );
    }
    if (workspaceView.sort === "documents") {
      return summaries.sort((left, right) => right.lessons.length - left.lessons.length);
    }
    return summaries;
  }, [orderedFolderSummaries, workspaceView.sort]);
  const sortedStudyBinders = useMemo(() => {
    const binders = [...minimalStudyBinders];
    if (workspaceView.sort === "name") {
      return binders.sort((left, right) =>
        deriveBinderTitle(left, filtered.lessonsByBinderId[left.id] ?? []).localeCompare(
          deriveBinderTitle(right, filtered.lessonsByBinderId[right.id] ?? []),
        ),
      );
    }
    if (workspaceView.sort === "documents") {
      return binders.sort(
        (left, right) =>
          (filtered.lessonsByBinderId[right.id]?.length ?? 0) -
          (filtered.lessonsByBinderId[left.id]?.length ?? 0),
      );
    }
    return binders;
  }, [filtered.lessonsByBinderId, minimalStudyBinders, workspaceView.sort]);
  const showFolders = workspaceView.scope === "all" || workspaceView.scope === "folders";
  const showBinders = workspaceView.scope === "all" || workspaceView.scope === "binders";
  const showDocuments =
    workspaceView.showRecentDocuments &&
    (workspaceView.scope === "all" || workspaceView.scope === "documents");
  const firstFolder = sortedFolderSummaries[0];
  const firstBinder = sortedStudyBinders[0];
  const createPending =
    workspaceMutations.createBinder.isPending ||
    workspaceMutations.createDocument.isPending ||
    workspaceMutations.createFolder.isPending;

  useEffect(() => {
    setFolderOrder(loadDashboardOrganizationDraft(profile.id, data).folderOrder);
  }, [data, profile.id]);

  useEffect(() => {
    if (!openDriveMenu) {
      return;
    }

    const closeOnOutside = (event: PointerEvent) => {
      if (!filebarRef.current?.contains(event.target as Node)) {
        setOpenDriveMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDriveMenu(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openDriveMenu]);

  const persistFolderOrder = useCallback(
    (nextOrder: string[]) => {
      setFolderOrder(nextOrder);
      saveDashboardOrganizationDraft(profile.id, {
        ...createDashboardOrganizationDraft(data),
        folderOrder: nextOrder,
        updatedAt: new Date().toISOString(),
      });
      setDashboardNotice("Folder order saved for this workspace.");
    },
    [data, profile.id],
  );

  const moveFolderBefore = useCallback(
    (activeFolderId: string, overFolderId: string) => {
      if (!canManageWorkspace || activeFolderId === overFolderId) {
        return;
      }

      const currentOrder = [
        ...orderedFolderSummaries.map((summary) => summary.folder.id),
      ];
      const fromIndex = currentOrder.indexOf(activeFolderId);
      const toIndex = currentOrder.indexOf(overFolderId);
      if (fromIndex < 0 || toIndex < 0) {
        return;
      }

      const nextOrder = [...currentOrder];
      const [moved] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, moved);
      persistFolderOrder(nextOrder);
    },
    [canManageWorkspace, orderedFolderSummaries, persistFolderOrder],
  );

  const handleFolderDragStart = (folderId: string) => {
    if (!canManageWorkspace) {
      return;
    }
    setDraggingFolderId(folderId);
  };

  const handleFolderDrop = (event: DragEvent<HTMLElement>, overFolderId: string) => {
    event.preventDefault();
    if (draggingFolderId) {
      moveFolderBefore(draggingFolderId, overFolderId);
    }
    setDraggingFolderId(null);
  };

  const beginCreate = (kind: WorkspaceCreateKind) => {
    setCreateKind(kind);
    setDraftTitle(
      kind === "folder" ? "New folder" : kind === "binder" ? "New binder" : "New document",
    );
    setDraftFolderId(firstFolder?.folder.id ?? "");
    setDraftBinderId(firstBinder?.id ?? "");
    setDraftSubject(inferSubjectFromName(firstFolder?.folder.name));
    setOpenDriveMenu(null);
    setDashboardNotice(null);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageWorkspace || !createKind) {
      return;
    }

    const title = draftTitle.trim();
    if (!title) {
      setDashboardNotice("Add a name before creating it.");
      return;
    }

    try {
      if (createKind === "folder") {
        await workspaceMutations.createFolder.mutateAsync({ name: title, color: "teal" });
        setDashboardNotice(`Created folder "${title}".`);
      } else if (createKind === "binder") {
        await workspaceMutations.createBinder.mutateAsync({
          title,
          folderId: draftFolderId || null,
          subject: draftSubject,
        });
        setDashboardNotice(`Created binder "${title}".`);
      } else {
        const binderId = draftBinderId || firstBinder?.id || "";
        if (!binderId) {
          setDashboardNotice("Create or choose a binder before adding a document.");
          return;
        }
        await workspaceMutations.createDocument.mutateAsync({
          binderId,
          orderIndex: (filtered.lessonsByBinderId[binderId]?.length ?? 0) + 1,
          title,
        });
        setDashboardNotice(`Created document "${title}".`);
      }
    } catch (createError) {
      setDashboardNotice(
        createError instanceof Error
          ? createError.message
          : "BinderNotes could not create that item. Try again.",
      );
      return;
    }

    setCreateKind(null);
    setDraftTitle("");
    setDraftBinderId("");
  };

  const focusDashboardSearch = () => {
    searchInputRef.current?.focus();
  };

  const changeScope = (scope: DashboardWorkspaceScope, options?: { focusSearch?: boolean }) => {
    updateWorkspaceView({
      scope,
      ...(scope === "documents" ? { showRecentDocuments: true } : {}),
    });
    setOpenDriveMenu(null);
    setDashboardNotice(`Showing ${dashboardWorkspaceScopeLabels[scope]}`);
    if (options?.focusSearch) {
      focusDashboardSearch();
    }
  };

  const changeDensity = (density: DashboardWorkspaceDensity) => {
    updateWorkspaceView({ density });
    setOpenDriveMenu(null);
    setDashboardNotice(
      density === "compact"
        ? "Compact rows are on. More files fit on screen."
        : "Comfortable rows are on. Cards have more breathing room.",
    );
  };

  const changeSort = (sort: DashboardWorkspaceSort) => {
    updateWorkspaceView({ sort });
    setOpenDriveMenu(null);
    setDashboardNotice(
      sort === "name"
        ? "Sorted by name."
        : sort === "documents"
          ? "Sorted by document count."
          : "Using your saved folder order.",
    );
  };

  const changeWidth = (width: DashboardWorkspaceWidth) => {
    updateWorkspaceView({ width });
    setOpenDriveMenu(null);
    setDashboardNotice(
      width === "full"
        ? "Full width is on. The dashboard now uses the whole browser width."
        : "Focused width is on. The dashboard is back to the centered study layout.",
    );
  };

  const toggleRecentDocuments = (showRecentDocuments: boolean) => {
    updateWorkspaceView({ showRecentDocuments });
    setOpenDriveMenu(null);
    setDashboardNotice(
      showRecentDocuments
        ? "Recent documents are visible."
        : "Recent documents are hidden. Folders and binders stay in focus.",
    );
  };

  return (
    <main
      className={cn(
        "dashboard-page app-page",
        isMinimalAppearance ? "minimal-dashboard-page" : "normal-dashboard-page",
      )}
      data-dashboard-appearance={appearance}
      data-dashboard-density={workspaceView.density}
      data-dashboard-recent-documents={workspaceView.showRecentDocuments ? "visible" : "hidden"}
      data-dashboard-scope={workspaceView.scope}
      data-dashboard-sort={workspaceView.sort}
      data-dashboard-width={workspaceView.width}
      data-minimal-density={isMinimalAppearance ? workspaceView.density : undefined}
      data-minimal-recent-documents={
        isMinimalAppearance
          ? workspaceView.showRecentDocuments
            ? "visible"
            : "hidden"
          : undefined
      }
      data-minimal-scope={isMinimalAppearance ? workspaceView.scope : undefined}
      data-minimal-sort={isMinimalAppearance ? workspaceView.sort : undefined}
      data-minimal-width={isMinimalAppearance ? workspaceView.width : undefined}
      data-testid="dashboard-page"
      data-workspace-presentation={workspacePresentation}
    >
      <section className="minimal-dashboard-command-bar" data-testid={`${dashboardPrefix}-dashboard-command-bar`}>
        <div className="minimal-dashboard-command-bar__identity">
          <Badge variant="outline">Workspace</Badge>
          <div>
            <h1>Workspace</h1>
            <p>{dashboardIntro}</p>
          </div>
        </div>

        <div aria-label="Workspace totals" className="minimal-dashboard-stats">
          {stats.map((stat) => (
            <div className="minimal-dashboard-stat" data-testid="minimal-dashboard-stat" key={stat.label}>
              <span aria-hidden="true">{stat.icon}</span>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="minimal-dashboard-search" data-testid="dashboard-search">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            data-icon="inline-start"
          />
          <Input
            className="pl-9"
            data-testid={`${dashboardPrefix}-dashboard-search`}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search folders, binders, documents, lessons"
            ref={searchInputRef}
            value={query}
          />
        </div>

        <div className="minimal-dashboard-actions">
          <Button asChild size="sm" type="button" variant="outline">
            <Link data-testid="dashboard-primary-action" to="/tutorial">
              Tutorial
              <ChevronRight data-icon="inline-start" />
            </Link>
          </Button>
          {canOpenAdminMakeover ? (
            <Button onClick={onOpenAdminMakeover} size="sm" type="button" variant="ghost">
              <Sparkles data-icon="inline-start" />
              Admin Makeover
            </Button>
          ) : null}
        </div>
      </section>

      <nav
        aria-label="Workspace file controls"
        className="minimal-dashboard-filebar"
        data-testid={`${dashboardPrefix}-dashboard-filebar`}
        ref={filebarRef}
      >
        <div className="minimal-dashboard-filebar__new">
          {canManageWorkspace ? (
            <button
              aria-expanded={openDriveMenu === "new"}
              className="minimal-dashboard-new-button"
              data-testid={`${dashboardPrefix}-dashboard-new-button`}
              onClick={() => setOpenDriveMenu((current) => (current === "new" ? null : "new"))}
              type="button"
            >
              <Plus className="size-4" />
              New
            </button>
          ) : null}
          {openDriveMenu === "new" ? (
            <div className="minimal-dashboard-filebar__menu" role="menu">
              <button onClick={() => beginCreate("folder")} role="menuitem" type="button">
                <FolderPlus className="size-4" />
                Folder
              </button>
              <button onClick={() => beginCreate("binder")} role="menuitem" type="button">
                <BookPlus className="size-4" />
                Binder
              </button>
              <button onClick={() => beginCreate("document")} role="menuitem" type="button">
                <FileText className="size-4" />
                Document
              </button>
            </div>
          ) : null}
        </div>

        <div className="minimal-dashboard-filebar__menus">
          {[
            { id: "browse" as const, label: "Browse" },
            { id: "open" as const, label: "Open" },
            { id: "view" as const, label: "View" },
          ].map((menu) => (
            <div className="minimal-dashboard-filebar__menu-wrap" key={menu.id}>
              <button
                aria-expanded={openDriveMenu === menu.id}
                className="minimal-dashboard-filebar__trigger"
                onClick={() => setOpenDriveMenu((current) => (current === menu.id ? null : menu.id))}
                type="button"
              >
                {menu.label}
              </button>
              {openDriveMenu === menu.id ? (
                <div className="minimal-dashboard-filebar__menu" role="menu">
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
                        <Link onClick={() => setOpenDriveMenu(null)} role="menuitem" to={`/folders/${firstFolder.folder.id}`}>
                          <FolderOpen className="size-4" />
                          {getDisplayTitle(firstFolder.folder.name, "First folder")}
                        </Link>
                      ) : null}
                      {firstBinder ? (
                        <Link onClick={() => setOpenDriveMenu(null)} role="menuitem" to={`/binders/${firstBinder.id}`}>
                          <LibraryBig className="size-4" />
                          {deriveBinderTitle(firstBinder, filtered.lessonsByBinderId[firstBinder.id] ?? [])}
                        </Link>
                      ) : null}
                      {nextDocument ? (
                        <Link onClick={() => setOpenDriveMenu(null)} role="menuitem" to={`/binders/${nextDocument.binder_id}/documents/${nextDocument.id}`}>
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
                        Folder order
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

        <ol className="minimal-dashboard-filebar__path" aria-label="Current workspace path">
          <li>My Drive</li>
          <li>{dashboardWorkspaceScopeLabels[workspaceView.scope]}</li>
          {query.trim() ? <li>Search: {query.trim()}</li> : null}
        </ol>

        <div className="minimal-dashboard-filebar__primary">
          {nextDocument ? (
            <Button asChild size="sm" type="button">
            <Link data-testid={`${dashboardPrefix}-dashboard-open-next`} to={`/binders/${nextDocument.binder_id}/documents/${nextDocument.id}`}>
                Open next
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : firstBinder ? (
            <Button asChild size="sm" type="button">
            <Link data-testid={`${dashboardPrefix}-dashboard-open-next`} to={`/binders/${firstBinder.id}`}>
                Open binder
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </nav>

      {createKind ? (
        <form className="minimal-dashboard-create-card" data-testid={`${dashboardPrefix}-dashboard-create-card`} onSubmit={submitCreate}>
          <div>
            <span className="page-kicker">
              {createKind === "folder"
                ? "New folder"
                : createKind === "binder"
                  ? "New binder"
                  : "New document"}
            </span>
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
                {sortedFolderSummaries.map((summary) => (
                  <option key={summary.folder.id} value={summary.folder.id}>
                    {getDisplayTitle(summary.folder.name, "Recovered Folder")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {createKind === "binder" ? (
            <label>
              <span>Subject</span>
              <select
                className="appearance-select"
                onChange={(event) => setDraftSubject(event.target.value)}
                value={draftSubject}
              >
                {workspaceSubjectOptions.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {createKind === "document" ? (
            <label>
              <span>Binder</span>
              <select
                className="appearance-select"
                onChange={(event) => setDraftBinderId(event.target.value)}
                value={draftBinderId}
              >
                {sortedStudyBinders.length === 0 ? (
                  <option value="">Create a binder first</option>
                ) : null}
                {sortedStudyBinders.map((binder) => (
                  <option key={binder.id} value={binder.id}>
                    {deriveBinderTitle(binder, filtered.lessonsByBinderId[binder.id] ?? [])}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="minimal-dashboard-create-card__actions">
            <Button disabled={createPending} size="sm" type="submit">
              {createPending
                ? "Creating..."
                : createKind === "folder"
                  ? "Create folder"
                  : createKind === "binder"
                    ? "Create binder"
                    : "Create document"}
            </Button>
            <Button onClick={() => setCreateKind(null)} size="sm" type="button" variant="outline">
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {dashboardNotice ? (
        <div className="minimal-dashboard-notice" data-testid={`${dashboardPrefix}-dashboard-notice`} role="status">
          {dashboardNotice}
        </div>
      ) : null}

      {showFolders ? (
      <section className="minimal-dashboard-section" id="minimal-folders">
        <div className="minimal-dashboard-section__heading">
          <span className="page-kicker">Folders</span>
          <h2>Open a workspace container</h2>
        </div>
        <div className="minimal-folder-grid" data-testid={`${dashboardPrefix}-folder-grid`}>
          {sortedFolderSummaries.map((summary) => (
            <Link
              className={cn(
                "minimal-folder-card dashboard-folder-card ui-click-tile",
                canManageWorkspace && "minimal-folder-card--draggable",
                draggingFolderId === summary.folder.id && "minimal-folder-card--dragging",
              )}
              data-testid={`${dashboardPrefix}-folder-card`}
              draggable={canManageWorkspace}
              key={summary.folder.id}
              onDragEnd={() => setDraggingFolderId(null)}
              onDragOver={(event) => {
                if (canManageWorkspace) {
                  event.preventDefault();
                }
              }}
              onDragStart={() => handleFolderDragStart(summary.folder.id)}
              onDrop={(event) => handleFolderDrop(event, summary.folder.id)}
              to={`/folders/${summary.folder.id}`}
            >
              <span
                aria-hidden="true"
                className="minimal-folder-card__mark"
                style={{ backgroundColor: folderColor(summary.folder.color) }}
              >
                <FolderOpen className="size-4" />
              </span>
              {canManageWorkspace ? (
                <span className="minimal-folder-card__drag-hint" title="Drag to reorder folders">
                  <GripVertical className="size-4" />
                </span>
              ) : null}
              <div className="minimal-folder-card__body">
                <div className="minimal-folder-card__title-row">
                  <h3>{getDisplayTitle(summary.folder.name, "Recovered Folder")}</h3>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
                <p>
                  {summary.binders.length} binders / {summary.lessons.length} documents / {summary.notes.length} notes
                </p>
                <div className="minimal-folder-card__chips">
                  {summary.binders.slice(0, 2).map((binder) => (
                    <span key={binder.id}>
                      {deriveBinderTitle(
                        binder,
                        filtered.lessonsByBinderId[binder.id] ?? [],
                      )}
                    </span>
                  ))}
                  {summary.binders.length > 2 ? <span>+{summary.binders.length - 2} more</span> : null}
                  {summary.binders.length === 0 ? <span>No binders yet</span> : null}
                </div>
              </div>
            </Link>
          ))}
          {sortedFolderSummaries.length === 0 ? (
            <EmptyState
              description="Organized folders will show up here once they contain real binders."
              title="No folders to open yet"
            />
          ) : null}
        </div>
      </section>
      ) : null}

      {(showBinders || showDocuments) ? (
      <section className="minimal-dashboard-main-grid">
        {showBinders ? (
        <div className="minimal-dashboard-section" id="minimal-binders">
          <div className="minimal-dashboard-section__heading">
            <span className="page-kicker">Binders</span>
            <h2>Ready to study</h2>
          </div>
          <div className="minimal-binder-grid" data-testid={`${dashboardPrefix}-binder-grid`}>
            {sortedStudyBinders.map((binder) => {
              const binderLessons = filtered.lessonsByBinderId[binder.id] ?? [];
              const binderTitle = deriveBinderTitle(binder, binderLessons);
              const folderName = filtered.folderNamesByBinderId[binder.id];

              return (
                <Link
                  className="minimal-binder-card dashboard-binder-card ui-click-tile"
                  data-testid={`${dashboardPrefix}-binder-card`}
                  key={binder.id}
                  to={`/binders/${binder.id}`}
                >
                  <div className="minimal-binder-card__cover">
                    {binder.cover_url ? (
                      <img alt="" src={binder.cover_url} />
                    ) : (
                      <LibraryBig className="size-5" />
                    )}
                  </div>
                  <div className="minimal-binder-card__body">
                    <div className="minimal-binder-card__meta">
                      <Badge variant="secondary">{binder.subject}</Badge>
                      {folderName ? (
                        <Badge variant="outline">{getDisplayTitle(folderName, "Recovered Folder")}</Badge>
                      ) : null}
                    </div>
                    <h3>{binderTitle}</h3>
                    <p>{binder.description}</p>
                    <span>{binderLessons.length} documents</span>
                  </div>
                  <ChevronRight className="minimal-binder-card__arrow" />
                </Link>
              );
            })}
            {sortedStudyBinders.length === 0 ? (
              <EmptyState
                description={query.trim() ? "Try a different search term." : "Your visible binders will show up here as soon as they're ready to study."}
                title={query.trim() ? "No binders match" : "No binders ready yet"}
              />
            ) : null}
          </div>
        </div>
        ) : null}

        {showDocuments ? (
        <aside className="minimal-dashboard-section minimal-document-panel" id="minimal-documents">
          <div className="minimal-dashboard-section__heading">
            <span className="page-kicker">Documents</span>
            <h2>Recent documents</h2>
          </div>
          <div className="minimal-document-list" data-testid={`${dashboardPrefix}-document-list`}>
            {filtered.recentDocuments.map((lesson) => (
              <Link
                className="minimal-document-row dashboard-recent-document ui-click-tile"
                data-testid={`${dashboardPrefix}-document-row`}
                key={lesson.id}
                to={`/binders/${lesson.binder_id}/documents/${lesson.id}`}
              >
                <BookCopy className="size-4 text-primary" />
                <span>
                  <strong>{deriveLessonTitle(lesson)}</strong>
                  <small>Open document</small>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
            {filtered.recentDocuments.length === 0 ? (
              <EmptyState
                description={
                  query.trim()
                    ? "Try a different search term."
                    : "Open a binder and add your first document when you're ready."
                }
                title={query.trim() ? "No documents match" : "No recent documents yet"}
              />
            ) : null}
          </div>
        </aside>
        ) : null}
      </section>
      ) : null}

      {!hasVisibleContent && learnerDiagnosticsMessage ? (
        <EmptyState
          description={learnerDiagnosticsMessage}
          title="Workspace unavailable"
        />
      ) : null}
      {!hasVisibleContent &&
      showSystemDiagnostics &&
      data.seedHealth.some((item) => item.status !== "healthy") ? (
        <SeedHealthPanel
          items={data.seedHealth.filter((item) => item.status !== "healthy")}
          showTechnicalDetails
        />
      ) : null}
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border/75 bg-background/78 p-4 shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
        {icon}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function folderColor(color: string) {
  switch (color) {
    case "violet":
      return "rgb(124 58 237)";
    case "rose":
      return "rgb(225 29 72)";
    case "blue":
      return "rgb(37 99 235)";
    case "emerald":
      return "rgb(5 150 105)";
    default:
      return "rgb(13 148 136)";
  }
}

function useDebouncedValue<T>(value: T, delayMs = 120) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
