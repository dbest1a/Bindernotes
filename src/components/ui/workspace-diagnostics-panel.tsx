import { AlertTriangle, DatabaseZap, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WorkspaceDiagnostic } from "@/types";

export function WorkspaceDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: WorkspaceDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[22px] border border-border/75 bg-card/88 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseZap className="size-4 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight">Workspace diagnostics</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Binder Notes is using the configured Supabase project and staying strict about backend-native
            suite data. These checks explain exactly what is missing or blocked.
          </p>
        </div>
        <Badge variant="outline">{diagnostics.length} issue{diagnostics.length === 1 ? "" : "s"}</Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {diagnostics.map((diagnostic) => (
          <article
            className="rounded-2xl border border-border/70 bg-background/72 p-4"
            key={`${diagnostic.code}:${diagnostic.scope}:${diagnostic.message}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {diagnostic.code === "rls_denied" ? (
                  <LockKeyhole className="mt-0.5 size-4 shrink-0 text-amber-500" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                )}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {diagnostic.scope}
                  </p>
                  <h3 className="mt-1 text-base font-semibold">{diagnostic.title}</h3>
                </div>
              </div>
              <Badge className="capitalize" variant={diagnostic.severity === "warning" ? "outline" : "secondary"}>
                {diagnostic.severity}
              </Badge>
            </div>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">{diagnostic.message}</p>
            {diagnostic.detail ? (
              <p className="mt-3 rounded-xl border border-border/60 bg-card/88 px-3 py-2 text-sm leading-6 text-foreground">
                {diagnostic.detail}
              </p>
            ) : null}
            {diagnostic.hint ? (
              <p className="mt-3 text-sm leading-6 text-primary">{diagnostic.hint}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
