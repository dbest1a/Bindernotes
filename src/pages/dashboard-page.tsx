import { Link } from "react-router-dom";
import {
  BookCopy,
  ChevronRight,
  FolderOpen,
  LibraryBig,
  Search,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SeedHealthPanel } from "@/components/ui/seed-health-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceDiagnosticsPanel } from "@/components/ui/workspace-diagnostics-panel";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/hooks/use-binders";
import {
  deriveBinderTitle,
  deriveLessonTitle,
  filterActionableDiagnostics,
  getDisplayTitle,
} from "@/lib/workspace-records";
import { isMissingSeedError } from "@/lib/seed-health";
import { buildLearnerWorkspaceMessage, classifyRuntimeError } from "@/lib/workspace-diagnostics";
import { createFolderSummary, getPrimaryFolder } from "@/lib/workspace-structure";

export function DashboardPage() {
  const { profile } = useAuth();
  const { data, isLoading, error } = useDashboard(profile);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) {
      return null;
    }

    const normalized = query.trim().toLowerCase();
    const lessonsByBinderId = Object.fromEntries(
      data.binders.map((binder) => [
        binder.id,
        data.lessons.filter((lesson) => lesson.binder_id === binder.id),
      ]),
    ) as Record<string, typeof data.lessons>;

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
      `${deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])} ${binder.subject} ${binder.description}`
        .toLowerCase()
        .includes(normalized),
    );

    const folderNamesByBinderId = Object.fromEntries(
      data.binders.map((binder) => [
        binder.id,
        getPrimaryFolder(data.binders, data.folders, data.folderBinders, binder.id)?.name ?? null,
      ]),
    ) as Record<string, string | null>;

    const recentDocuments = data.recentLessons
      .filter((lesson) =>
        `${deriveLessonTitle(lesson)} ${JSON.stringify(lesson.content)}`.toLowerCase().includes(normalized),
      )
      .slice(0, 6);

    return { folderSummaries, studyReadyBinders, recentDocuments, lessonsByBinderId, folderNamesByBinderId };
  }, [data, query]);

  const actionableDiagnostics = filterActionableDiagnostics(data?.diagnostics ?? []);
  const learnerDiagnosticsMessage = actionableDiagnostics.length
    ? buildLearnerWorkspaceMessage(actionableDiagnostics)
    : null;
  const runtimeDiagnostics =
    error && (profile?.role === "admin" || import.meta.env.DEV)
      ? classifyRuntimeError("workspace", error)
      : [];
  const resolvedFiltered = filtered ?? {
    folderSummaries: [],
    studyReadyBinders: [],
    recentDocuments: [],
    lessonsByBinderId: {} as Record<string, typeof data extends { lessons: infer Lessons } ? Lessons : never>,
    folderNamesByBinderId: {} as Record<string, string | null>,
  };
  const hasVisibleContent =
    resolvedFiltered.folderSummaries.length > 0 ||
    resolvedFiltered.studyReadyBinders.length > 0 ||
    resolvedFiltered.recentDocuments.length > 0;

  return (
    <main className="app-page">
      <section className="hero-grid">
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
            </div>
          </div>
        </aside>
      </section>

      {error ? (
        <div className="grid gap-4">
          {runtimeDiagnostics.length ? (
            <WorkspaceDiagnosticsPanel diagnostics={runtimeDiagnostics} />
          ) : null}
          {isMissingSeedError(error) ? (
            <SeedHealthPanel items={[error.seedHealth]} />
          ) : null}
          <EmptyState
            description={
              error instanceof Error ? error.message : "Check Supabase configuration and policies."
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {resolvedFiltered.folderSummaries.map((summary) => (
                <Link
                  className="ui-click-tile group page-shell block p-6 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {resolvedFiltered.studyReadyBinders.map((binder) => (
                  <Link
                    className="ui-click-tile group page-shell block overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
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
                      className="ui-click-tile rounded-lg border border-border/75 bg-background/88 p-4 transition hover:bg-secondary/80"
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
          {!hasVisibleContent && data?.seedHealth.some((item) => item.status !== "healthy") ? (
            <SeedHealthPanel items={data.seedHealth.filter((item) => item.status !== "healthy")} />
          ) : null}
        </>
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
    default:
      return "rgb(13 148 136)";
  }
}
