import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { BookCopy, BookPlus, ChevronRight, FileText, FolderOpen, LibraryBig } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SeedHealthPanel } from "@/components/ui/seed-health-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceDiagnosticsPanel } from "@/components/ui/workspace-diagnostics-panel";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardWorkspaceMutations, useFolderWorkspace } from "@/hooks/use-binders";
import { useWorkspacePresentationPreference } from "@/hooks/use-workspace-presentation-preference";
import { isMissingSeedError } from "@/lib/seed-health";
import { classifyRuntimeError } from "@/lib/workspace-diagnostics";
import { getBinderDocumentSummaries } from "@/lib/workspace-structure";
import { scheduleUserRecentItem } from "@/services/activity-service";
import type { FolderWorkspaceData } from "@/types";

type FolderCreateKind = "binder" | "document";

function inferSubjectFromFolderName(value: string) {
  const normalized = value.toLowerCase();
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

export function FolderPage() {
  const { folderId } = useParams();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { data, isLoading, error } = useFolderWorkspace(folderId, profile);
  const workspaceMutations = useDashboardWorkspaceMutations(profile);
  const workspacePresentation = useWorkspacePresentationPreference();
  const [createKind, setCreateKind] = useState<FolderCreateKind | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBinderId, setDraftBinderId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const showSystemDiagnostics =
    (profile?.role === "admin" || import.meta.env.DEV) &&
    searchParams.get("debug") === "system";
  const runtimeDiagnostics =
    error && showSystemDiagnostics
      ? classifyRuntimeError("folders", error)
      : [];
  const profileId = profile?.id ?? null;
  const canManageWorkspace = profile?.role === "admin";
  const firstBinderId = data?.binders[0]?.id ?? "";
  const lessonsByBinderId = useMemo(() => {
    const grouped: Record<string, FolderWorkspaceData["lessons"]> = {};
    if (!data) {
      return grouped;
    }
    for (const lesson of data.lessons) {
      grouped[lesson.binder_id] = [...(grouped[lesson.binder_id] ?? []), lesson];
    }
    return grouped;
  }, [data]);
  const createPending =
    workspaceMutations.createBinder.isPending || workspaceMutations.createDocument.isPending;

  useEffect(() => {
    if (!profileId || !data) {
      return;
    }

    scheduleUserRecentItem({
      userId: profileId,
      itemType: "folder",
      itemId: data.folder.id,
      folderId: data.folder.id,
      titleSnapshot: data.folder.name,
      metadata: {
        route: "folder",
      },
    });
  }, [data, profileId]);

  if (!profile) {
    return <Navigate replace to="/auth" />;
  }

  if (isLoading) {
    return (
      <main className="app-page">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[420px]" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="app-page max-w-[960px]">
        {runtimeDiagnostics.length ? (
          <div className="mb-4">
            <WorkspaceDiagnosticsPanel diagnostics={runtimeDiagnostics} />
          </div>
        ) : null}
        {showSystemDiagnostics && isMissingSeedError(error) ? (
          <div className="mb-4">
            <SeedHealthPanel
              description="This system folder depends on backend-seeded suite rows in Supabase."
              items={[error.seedHealth]}
              showTechnicalDetails
              title="Seed status"
            />
          </div>
        ) : null}
        <EmptyState
          description={error instanceof Error ? error.message : "This folder is unavailable."}
          title="Folder unavailable"
        />
      </main>
    );
  }

  const beginCreate = (kind: FolderCreateKind) => {
    setCreateKind(kind);
    setDraftTitle(kind === "binder" ? `${data.folder.name} binder` : "New document");
    setDraftBinderId(firstBinderId);
    setNotice(null);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageWorkspace || !createKind) {
      return;
    }

    const title = draftTitle.trim();
    if (!title) {
      setNotice("Add a name before creating it.");
      return;
    }

    try {
      if (createKind === "binder") {
        await workspaceMutations.createBinder.mutateAsync({
          folderId: data.folder.id,
          subject: inferSubjectFromFolderName(data.folder.name),
          title,
        });
        setNotice(`Created binder "${title}".`);
      } else {
        const binderId = draftBinderId || firstBinderId;
        if (!binderId) {
          setNotice("Create a binder first, then add a document inside it.");
          return;
        }
        await workspaceMutations.createDocument.mutateAsync({
          binderId,
          orderIndex: (lessonsByBinderId[binderId]?.length ?? 0) + 1,
          title,
        });
        setNotice(`Created document "${title}".`);
      }
      setCreateKind(null);
      setDraftTitle("");
    } catch (createError) {
      setNotice(
        createError instanceof Error
          ? createError.message
          : "BinderNotes could not create that item. Try again.",
      );
    }
  };

  return (
    <main className="app-page" data-workspace-presentation={workspacePresentation}>
      <Breadcrumbs items={[{ label: "Workspace", to: "/dashboard" }, { label: data.folder.name }]} />

      <section className="hero-grid">
        <div className="page-shell p-6 sm:p-8">
          <Badge variant="outline">Folder</Badge>
          <h1 className="mt-4 page-heading max-w-4xl text-4xl sm:text-5xl">{data.folder.name}</h1>
          <p className="mt-4 max-w-2xl page-copy">
            Open a binder from this folder, then choose the specific document you want to study.
          </p>
          {canManageWorkspace ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => beginCreate("binder")} type="button">
                <BookPlus className="size-4" />
                New binder
              </Button>
              <Button
                disabled={data.binders.length === 0}
                onClick={() => beginCreate("document")}
                type="button"
                variant="outline"
              >
                <FileText className="size-4" />
                New document
              </Button>
            </div>
          ) : null}
        </div>
        <aside className="hero-aside">
          <div className="grid gap-3">
            <Stat label="Binders" value={String(data.binders.length)} icon={<LibraryBig className="size-4" />} />
            <Stat label="Documents" value={String(data.lessons.length)} icon={<BookCopy className="size-4" />} />
            <Stat label="Private notes" value={String(data.notes.length)} icon={<FolderOpen className="size-4" />} />
          </div>
          {showSystemDiagnostics && data.seedHealth ? (
            <div className="mt-4">
              <SeedHealthPanel
                compact
                description="System folders now depend on backend-seeded suite content."
                items={[data.seedHealth]}
                showTechnicalDetails
                title="Seed status"
              />
            </div>
          ) : null}
        </aside>
      </section>

      {createKind ? (
        <form className="page-shell grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={submitCreate}>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {createKind === "binder" ? "Binder name" : "Document title"}
            </span>
            <Input
              aria-label={createKind === "binder" ? "Binder name" : "Document title"}
              autoFocus
              className="mt-2"
              onChange={(event) => setDraftTitle(event.target.value)}
              value={draftTitle}
            />
          </label>
          {createKind === "document" ? (
            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Binder</span>
              <select
                aria-label="Binder"
                className="appearance-select mt-2"
                onChange={(event) => setDraftBinderId(event.target.value)}
                value={draftBinderId}
              >
                {data.binders.map((binder) => (
                  <option key={binder.id} value={binder.id}>
                    {binder.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex gap-2">
            <Button disabled={createPending} type="submit">
              {createPending ? "Creating..." : createKind === "binder" ? "Create binder" : "Create document"}
            </Button>
            <Button onClick={() => setCreateKind(null)} type="button" variant="outline">
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-border/80 bg-background/85 px-4 py-3 text-sm text-muted-foreground" role="status">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4">
        <div>
          <span className="page-kicker">Binders</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Choose a binder container</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.binders.map((binder) => {
            const documentCount = data.lessons.filter((lesson) => lesson.binder_id === binder.id).length;
            const noteCount = data.notes.filter((note) => note.binder_id === binder.id).length;

            return (
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
                    <Badge variant="secondary">{binder.subject}</Badge>
                    <ChevronRight className="text-muted-foreground transition group-hover:text-foreground" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight">{binder.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{binder.description}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {documentCount} documents · {noteCount} private notes
                  </p>
                </div>
              </Link>
            );
          })}
          {data.binders.length === 0 ? (
            <EmptyState
              action={
                canManageWorkspace ? (
                  <Button onClick={() => beginCreate("binder")} type="button">
                    Create binder
                  </Button>
                ) : undefined
              }
              description="Place a binder in this folder to create a real document stack."
              title="No binders in this folder"
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <span className="page-kicker">Documents</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Recent documents in this folder</h2>
        </div>
        <div className="page-shell p-4">
          <div className="grid gap-3 md:grid-cols-2">
            {data.binders.flatMap((binder) =>
              getBinderDocumentSummaries(
                data.lessons.filter((lesson) => lesson.binder_id === binder.id),
                data.notes.filter((note) => note.binder_id === binder.id),
              ).slice(0, 2),
            ).map((document) => (
              <Link
                className="ui-click-tile rounded-lg border border-border/75 bg-background/88 p-4 transition hover:bg-secondary/80"
                key={document.lesson.id}
                to={`/binders/${document.lesson.binder_id}/documents/${document.lesson.id}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Document
                </p>
                <p className="mt-2 font-medium">{document.lesson.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {document.hasPrivateNote ? "Has private notes" : "No private note yet"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/75 bg-background/72 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
