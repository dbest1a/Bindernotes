import { Clock3, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inferMathBlockLabel } from "@/lib/study-references";
import type { SavedGraphState } from "@/hooks/use-math-workspace";
import type { MathBlock } from "@/types";

type LessonGraphBlock = Extract<MathBlock, { type: "graph" }>;

export function GraphStateList({
  canSave,
  embedded = false,
  lessonGraphs,
  onDelete,
  onJumpToSource,
  onLoad,
  onLoadLessonGraph,
  onNameChange,
  onSave,
  savedGraphs,
  snapshotName,
}: {
  canSave: boolean;
  embedded?: boolean;
  lessonGraphs: LessonGraphBlock[];
  onDelete: (id: string) => void;
  onJumpToSource?: (block: LessonGraphBlock) => void;
  onLoad: (id: string) => void;
  onLoadLessonGraph: (block: LessonGraphBlock) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  savedGraphs: SavedGraphState[];
  snapshotName: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Saved graphs
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Graph library</h2>
        </div>
        <Button disabled={!canSave} onClick={onSave} type="button">
          <Save data-icon="inline-start" />
          Save
        </Button>
      </div>

      <Input
        className="mt-4"
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Name this graph state"
        value={snapshotName}
      />

      <div className="mt-4 flex flex-col gap-4">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Lesson graph references</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Reopen the graph setups tied to this lesson before you branch into your own saves.
              </p>
            </div>
            <span className="rounded-full border border-border/70 bg-secondary/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {lessonGraphs.length}
            </span>
          </div>

          {lessonGraphs.length > 0 ? (
            lessonGraphs.map((graph) => (
              <div className="rounded-lg border border-border/75 bg-background/80 p-4" key={graph.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{inferMathBlockLabel(graph)}</p>
                      <GraphModeBadge mode={graph.graphMode ?? "2d"} />
                    </div>
                    {graph.sourceHeading ? (
                      <button
                        className="mt-1 text-left text-xs text-muted-foreground transition hover:text-foreground"
                        onClick={() => onJumpToSource?.(graph)}
                        type="button"
                      >
                        {graph.sourceHeading}
                      </button>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Lesson graph reference
                      </p>
                    )}
                  </div>
                  <Button onClick={() => onLoadLessonGraph(graph)} size="sm" type="button" variant="outline">
                    Load
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
              This lesson does not have premade graph references yet.
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold">Your saved snapshots</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              These are the graph states you saved while working in this lesson.
            </p>
          </div>

          {savedGraphs.map((graph) => (
            <div className="rounded-lg border border-border/75 bg-background/80 p-4" key={graph.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{graph.name}</p>
                    <GraphModeBadge mode={graph.calculatorMode} />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" />
                    {formatSavedTime(graph.updatedAt)}
                  </p>
                </div>
                <Button onClick={() => onDelete(graph.id)} size="icon" type="button" variant="ghost">
                  <Trash2 data-icon="inline-start" />
                </Button>
              </div>
              <Button className="mt-3 w-full" onClick={() => onLoad(graph.id)} type="button" variant="outline">
                Load snapshot
              </Button>
            </div>
          ))}

          {savedGraphs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
              Save graph states as named snapshots so you can jump back into different algebra, precalculus,
              or calculus setups.
            </div>
          ) : null}
        </section>
      </div>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return <section className="page-shell p-5">{content}</section>;
}

function GraphModeBadge({ mode }: { mode: "2d" | "3d" }) {
  return (
    <span className="rounded-full border border-border/70 bg-secondary/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {mode === "3d" ? "3D Graph" : "2D Graph"}
    </span>
  );
}

function formatSavedTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
