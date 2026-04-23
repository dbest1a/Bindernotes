import { DatabaseZap, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SeedHealth } from "@/types";

export function SeedHealthPanel({
  items,
  title = "System seed health",
  description = "Backend-native demo suites should load from seeded Supabase rows, not local fallback data.",
  compact = false,
}: {
  items: SeedHealth[];
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(
        "rounded-[22px] border border-border/75 bg-card/88 shadow-sm",
        compact ? "p-4" : "p-5 sm:p-6",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseZap className="size-4 text-primary" />
            <p className="text-sm font-semibold tracking-tight">{title}</p>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Badge variant={items.every((item) => item.status === "healthy") ? "secondary" : "outline"}>
          {items.filter((item) => item.status !== "healthy").length === 0
            ? "All seeded"
            : `${items.filter((item) => item.status !== "healthy").length} attention needed`}
        </Badge>
      </div>

      <div className={cn("mt-4 grid gap-3", compact ? "" : "lg:grid-cols-2")}>
        {items.map((item) => (
          <article
            className="rounded-2xl border border-border/70 bg-background/72 p-4"
            key={item.suiteTemplateId}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {item.suiteSlug}
                </p>
                <h3 className="mt-1 text-base font-semibold">{item.suiteTitle}</h3>
              </div>
              <Badge
                className="capitalize"
                variant={item.status === "healthy" ? "secondary" : "outline"}
              >
                {item.status}
              </Badge>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <FactRow label="Expected version" value={item.expectedVersion} />
              <FactRow label="Actual version" value={item.actualVersion ?? "Missing"} />
              <FactRow label="Status note" value={item.message} />
              {item.missingBinders?.length ? (
                <FactRow label="Missing binders" value={item.missingBinders.join(", ")} />
              ) : null}
            </div>

            {item.status !== "healthy" ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-100/70 p-3 text-sm text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <p>Seed this suite in Supabase before relying on highlights, layouts, or history data here.</p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/88 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 leading-6 text-foreground">{value}</p>
    </div>
  );
}
