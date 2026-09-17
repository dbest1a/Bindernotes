import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  FlaskConical,
  GitBranch,
  Link2,
  Radar,
  RotateCcw,
  ShieldCheck,
  Shuffle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { useBetaFeatures } from "@/hooks/use-beta-features";
import type { BetaFeaturesPreference } from "@/lib/beta-features";
import {
  buildLearningAcceleratorDeck,
  defaultLearningAcceleratorFeatures,
  type LearningAcceleratorCard,
  type LearningAcceleratorFeatureId,
} from "@/lib/learning-accelerators";
import { cn } from "@/lib/utils";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";

const iconByFeature: Record<LearningAcceleratorFeatureId, typeof Shuffle> = {
  transferForge: Shuffle,
  evidenceLock: ShieldCheck,
  misstepMuseum: RotateCcw,
  conceptWeather: Radar,
  representationSwitchboard: GitBranch,
  examGhostMode: Brain,
  whiteboardReplay: ArrowRight,
  prereqXray: BadgeCheck,
  memoryWeave: Link2,
  oneMinuteLab: FlaskConical,
};

const toneClass: Record<LearningAcceleratorCard["tone"], string> = {
  evidence: "border-sky-300/30 bg-sky-400/10",
  experiment: "border-emerald-300/30 bg-emerald-400/10",
  forecast: "border-violet-300/30 bg-violet-400/10",
  practice: "border-primary/25 bg-primary/10",
  repair: "border-amber-300/35 bg-amber-400/10",
};

export function LearningAcceleratorsModule({
  context,
  featureFlags,
}: {
  context: WorkspaceModuleContext;
  featureFlags?: BetaFeaturesPreference;
}) {
  const betaFeatures = useBetaFeatures(context.ownerId);
  const activeFeatureFlags = featureFlags ?? betaFeatures.preference;
  const enabledFeatures = useMemo(
    () =>
      defaultLearningAcceleratorFeatures.filter(
        (feature) => activeFeatureFlags.enabled && activeFeatureFlags[feature],
      ),
    [activeFeatureFlags],
  );
  const learnerNote = context.noteId
    ? {
        id: context.noteId,
        owner_id: context.ownerId ?? "",
        binder_id: context.binder.id,
        lesson_id: context.selectedLesson.id,
        folder_id: null,
        title: context.noteTitle,
        content: context.noteContent,
        math_blocks: context.noteMath,
        pinned: false,
        created_at: "",
        updated_at: "",
      }
    : null;
  const cards = useMemo(
    () =>
      buildLearningAcceleratorDeck({
        binderTitle: context.binder.title,
        subject: context.binder.subject,
        selectedLesson: context.selectedLesson,
        lessons: context.lessons,
        learnerNote,
        highlights: context.highlights,
        conceptLabels: context.conceptNodes.map((node) => node.label),
        enabledFeatures,
      }),
    [
      context.binder.subject,
      context.binder.title,
      context.conceptNodes,
      context.highlights,
      context.lessons,
      context.selectedLesson,
      enabledFeatures,
      learnerNote,
    ],
  );
  const [activeCardId, setActiveCardId] = useState<LearningAcceleratorFeatureId | null>(
    cards[0]?.id ?? null,
  );
  const activeCard = cards.find((card) => card.id === activeCardId) ?? cards[0] ?? null;

  return (
    <WorkspacePanel
      description="Deterministic study tools that use your lesson, notes, highlights, formulas, and graphs."
      title="Learning Accelerators"
    >
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5">
          <p className="text-sm font-semibold">Turn on one Learning Accelerator beta to start.</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            These tools run from local BinderNotes signals. They do not call outside generation services.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1fr)]">
          <div className="grid gap-2">
            {cards.map((card) => {
              const Icon = iconByFeature[card.id];
              const selected = activeCard?.id === card.id;
              return (
                <button
                  aria-label={`Open ${card.title}`}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-left transition hover:border-primary/40 hover:bg-accent/50",
                    selected ? "border-primary/45 bg-primary/10 shadow-sm" : "border-border/70 bg-card/70",
                  )}
                  key={card.id}
                  onClick={() => setActiveCardId(card.id)}
                  type="button"
                >
                  <span className="flex items-start gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{card.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{card.tagline}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {activeCard ? (
            <article
              className={cn("rounded-3xl border p-4 shadow-sm", toneClass[activeCard.tone])}
              data-testid="learning-accelerator-active-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="secondary">No generation cost</Badge>
                  <h3 className="mt-3 text-xl font-semibold">{activeCard.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCard.studentPrompt}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <section className="rounded-2xl border border-border/70 bg-background/65 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Use as evidence
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeCard.evidence.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-border/70 bg-background/65 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Student actions
                  </p>
                  <ol className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
                    {activeCard.actions.map((action) => (
                      <li className="flex gap-2" key={action}>
                        <span className="mt-2 size-1.5 rounded-full bg-primary" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => context.onOpenWorkspaceTool?.("private-notes")} size="sm" type="button">
                  Open notes
                </Button>
                <Button onClick={() => context.onOpenWorkspaceTool?.("lesson")} size="sm" type="button" variant="outline">
                  Open source
                </Button>
              </div>
            </article>
          ) : null}
        </div>
      )}
    </WorkspacePanel>
  );
}
