import { Link, useSearchParams } from "react-router-dom";
import {
  BookCopy,
  ChevronRight,
  FolderOpen,
  LibraryBig,
  Search,
  Sparkles,
} from "lucide-react";
import { Suspense, lazy, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SeedHealthPanel } from "@/components/ui/seed-health-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceDiagnosticsPanel } from "@/components/ui/workspace-diagnostics-panel";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/hooks/use-binders";
import { useDashboardExperience } from "@/hooks/use-dashboard-experience";
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
import { markDevPerformance, measureDevPerformance } from "@/lib/performance-marks";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/types";

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

export function DashboardPage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error } = useDashboard(profile);
  const dashboardExperience = useDashboardExperience(profile?.role === "admin");
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
    const recentDocumentSearchTextById = new Map(
      data.recentLessons.map((lesson) => [
        lesson.id,
        deriveLessonTitle(lesson).toLowerCase(),
      ]),
    );
    const binderSearchTextById = new Map(
      data.binders.map((binder) => [
        binder.id,
        `${deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])} ${binder.subject} ${binder.description}`.toLowerCase(),
      ]),
    );
    const folderNamesByBinderId = Object.fromEntries(
      data.binders.map((binder) => [
        binder.id,
        getPrimaryFolder(data.binders, data.folders, data.folderBinders, binder.id)?.name ?? null,
      ]),
    ) as Record<string, string | null>;

    return {
      binderSearchTextById,
      folderNamesByBinderId,
      lessonsByBinderId,
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
          lessonsByBinderId,
          recentDocumentSearchTextById,
        } = dashboardSearchIndex;

        const folderSummaries = data.folders
          .map((folder) =>
            createFolderSummary(folder, data.binders, data.folderBinders, data.notes, data.lessons),
          )
          .filter((summary) =>
            `${getDisplayTitle(summary.folder.name, "Recovered Folder")} ${summary.binders
              .map((binder) => deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? []))
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

  if (dashboardExperience.isMinimalActive && data && filtered && !isLoading && !error) {
    return (
      <MinimalDashboardView
        canOpenAdminMakeover={profile?.role === "admin"}
        data={data}
        filtered={resolvedFiltered}
        hasVisibleContent={hasVisibleContent}
        learnerDiagnosticsMessage={learnerDiagnosticsMessage}
        onOpenAdminMakeover={() => dashboardExperience.setViewMode("admin-makeover")}
        onQueryChange={setQuery}
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
  canOpenAdminMakeover,
  data,
  filtered,
  hasVisibleContent,
  learnerDiagnosticsMessage,
  onOpenAdminMakeover,
  onQueryChange,
  query,
  showSystemDiagnostics,
  workspacePresentation,
}: {
  canOpenAdminMakeover: boolean;
  data: DashboardData;
  filtered: DashboardFilteredData;
  hasVisibleContent: boolean;
  learnerDiagnosticsMessage: string | null;
  onOpenAdminMakeover: () => void;
  onQueryChange: (query: string) => void;
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

  return (
    <main
      className="dashboard-page minimal-dashboard-page app-page"
      data-dashboard-appearance="minimal"
      data-testid="dashboard-page"
      data-workspace-presentation={workspacePresentation}
    >
      <section className="minimal-dashboard-command-bar" data-testid="minimal-dashboard-command-bar">
        <div className="minimal-dashboard-command-bar__identity">
          <Badge variant="outline">Workspace</Badge>
          <div>
            <h1>Workspace</h1>
            <p>Folders, binders, and recent documents in the quickest scan view.</p>
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
            data-testid="minimal-dashboard-search"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search folders, binders, documents"
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

      <section className="minimal-dashboard-section">
        <div className="minimal-dashboard-section__heading">
          <span className="page-kicker">Folders</span>
          <h2>Open a workspace container</h2>
        </div>
        <div className="minimal-folder-grid" data-testid="minimal-folder-grid">
          {filtered.folderSummaries.map((summary) => (
            <Link
              className="minimal-folder-card dashboard-folder-card ui-click-tile"
              data-testid="minimal-folder-card"
              key={summary.folder.id}
              to={`/folders/${summary.folder.id}`}
            >
              <span
                aria-hidden="true"
                className="minimal-folder-card__mark"
                style={{ backgroundColor: folderColor(summary.folder.color) }}
              >
                <FolderOpen className="size-4" />
              </span>
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
          {filtered.folderSummaries.length === 0 ? (
            <EmptyState
              description="Organized folders will show up here once they contain real binders."
              title="No folders to open yet"
            />
          ) : null}
        </div>
      </section>

      <section className="minimal-dashboard-main-grid">
        <div className="minimal-dashboard-section">
          <div className="minimal-dashboard-section__heading">
            <span className="page-kicker">Binders</span>
            <h2>Ready to study</h2>
          </div>
          <div className="minimal-binder-grid" data-testid="minimal-binder-grid">
            {minimalStudyBinders.map((binder) => {
              const binderLessons = filtered.lessonsByBinderId[binder.id] ?? [];
              const binderTitle = deriveBinderTitle(binder, binderLessons);
              const folderName = filtered.folderNamesByBinderId[binder.id];

              return (
                <Link
                  className="minimal-binder-card dashboard-binder-card ui-click-tile"
                  data-testid="minimal-binder-card"
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
            {minimalStudyBinders.length === 0 ? (
              <EmptyState
                description={query.trim() ? "Try a different search term." : "Your visible binders will show up here as soon as they're ready to study."}
                title={query.trim() ? "No binders match" : "No binders ready yet"}
              />
            ) : null}
          </div>
        </div>

        <aside className="minimal-dashboard-section minimal-document-panel">
          <div className="minimal-dashboard-section__heading">
            <span className="page-kicker">Documents</span>
            <h2>Recent documents</h2>
          </div>
          <div className="minimal-document-list" data-testid="minimal-document-list">
            {filtered.recentDocuments.map((lesson) => (
              <Link
                className="minimal-document-row dashboard-recent-document ui-click-tile"
                data-testid="minimal-document-row"
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
      </section>

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
