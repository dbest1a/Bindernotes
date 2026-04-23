import { Link, Navigate, useParams } from "react-router-dom";
import { BookCopy, ChevronRight, FileText, FolderTree, NotebookPen } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { SeedHealthPanel } from "@/components/ui/seed-health-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceDiagnosticsPanel } from "@/components/ui/workspace-diagnostics-panel";
import { useAuth } from "@/hooks/use-auth";
import { useBinderOverview } from "@/hooks/use-binders";
import { isMissingSeedError } from "@/lib/seed-health";
import { classifyRuntimeError } from "@/lib/workspace-diagnostics";
import { getBinderDocumentSummaries } from "@/lib/workspace-structure";

export function BinderPage() {
  const { binderId } = useParams();
  const { profile } = useAuth();
  const { data, isLoading, error } = useBinderOverview(binderId, profile);
  const runtimeDiagnostics =
    error && (profile?.role === "admin" || import.meta.env.DEV)
      ? classifyRuntimeError("binders", error)
      : [];

  if (!profile) {
    return <Navigate replace to="/auth" />;
  }

  if (isLoading) {
    return (
      <main className="app-page">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[520px]" />
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
        {isMissingSeedError(error) ? (
          <div className="mb-4">
            <SeedHealthPanel
              description="This system binder depends on backend-seeded suite rows in Supabase."
              items={[error.seedHealth]}
              title="Seed status"
            />
          </div>
        ) : null}
        <EmptyState
          description={error instanceof Error ? error.message : "This binder is unavailable."}
          title="Binder unavailable"
        />
      </main>
    );
  }

  const primaryFolder = data.folders[0];
  const documents = getBinderDocumentSummaries(data.lessons, data.notes);

  return (
    <main className="app-page">
      <Breadcrumbs
        items={[
          { label: "Workspace", to: "/dashboard" },
          ...(primaryFolder ? [{ label: primaryFolder.name, to: `/folders/${primaryFolder.id}` }] : []),
          { label: data.binder.title },
        ]}
      />

      <section className="hero-grid">
        <div className="page-shell overflow-hidden">
          {data.binder.cover_url ? (
            <img alt="" className="h-48 w-full object-cover" src={data.binder.cover_url} />
          ) : (
            <div className="h-48 bg-gradient-to-br from-accent via-secondary to-background" />
          )}
          <div className="p-6 sm:p-8">
            <Badge variant="outline">Binder</Badge>
            <h1 className="mt-4 page-heading max-w-4xl text-4xl sm:text-5xl">{data.binder.title}</h1>
            <p className="mt-4 max-w-2xl page-copy">{data.binder.description}</p>
          </div>
        </div>

        <aside className="hero-aside">
          <div className="grid gap-3">
            <Stat label="Documents" value={String(data.lessons.length)} icon={<BookCopy className="size-4" />} />
            <Stat label="Private notes" value={String(data.notes.length)} icon={<NotebookPen className="size-4" />} />
            <Stat label="Location" value={primaryFolder?.name ?? "Workspace"} icon={<FolderTree className="size-4" />} />
          </div>
          {data.seedHealth ? (
            <div className="mt-4">
              <SeedHealthPanel
                compact
                description="This binder is attached to a seeded system suite."
                items={[data.seedHealth]}
                title="Seed status"
              />
            </div>
          ) : null}
        </aside>
      </section>

      <section className="grid gap-4">
        <div>
          <span className="page-kicker">Documents</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Choose a document to open</h2>
        </div>
        <div className="grid gap-4">
          {documents.map((document, index) => (
            <Link
              className="ui-click-tile page-shell block p-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
              key={document.lesson.id}
              to={`/binders/${data.binder.id}/documents/${document.lesson.id}`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Document {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">{document.lesson.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {document.hasPrivateNote
                      ? `Private note: ${document.note?.title ?? "Saved"}`
                      : "No private note yet. Open the document to start one."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {document.lesson.is_preview ? <Badge variant="secondary">Preview</Badge> : null}
                  {document.hasPrivateNote ? <Badge>Has notes</Badge> : <Badge variant="outline">New note</Badge>}
                  <ChevronRight className="text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
          {documents.length === 0 ? (
            <EmptyState
              description="Add binder lessons first so this binder can contain actual documents."
              title="No documents in this binder"
            />
          ) : null}
        </div>
      </section>

      {documents.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {documents.slice(0, 3).map((document) => (
            <Link
              className="ui-click-tile rounded-lg border border-border/75 bg-card/82 p-5 shadow-soft transition hover:bg-secondary/70"
              key={`${document.lesson.id}-summary`}
              to={`/binders/${data.binder.id}/documents/${document.lesson.id}`}
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="size-4" />
                Study card
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{document.lesson.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {document.hasPrivateNote ? "Continue your note and annotations." : "Open and create your first note."}
              </p>
            </Link>
          ))}
        </section>
      ) : null}
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
