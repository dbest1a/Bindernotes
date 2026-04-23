import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Landmark,
  Link2,
  Plus,
  Quote,
  Route,
  Scale,
} from "lucide-react";
import { SaveStatusPill } from "@/components/ui/save-status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { formatHistoricalDateLabel, sortHistoryEvents } from "@/lib/history-dates";
import { cn } from "@/lib/utils";
import type {
  HistoryArgumentChain,
  HistoryArgumentEdge,
  HistoryArgumentNode,
  HistoryEvidenceCard,
  HistoryEvent,
  HistoryEventTemplate,
  HistoryMythCheck,
  HistoryMythCheckTemplate,
  HistorySource,
  HistorySourceTemplate,
  SaveStatusSnapshot,
} from "@/types";

export function HistoryTimelineModule({
  activeEventId,
  evidenceCards,
  events,
  onCreateStarterEvent,
  onReplayTimeline,
  onSelectEvent,
  sources,
  status,
  templateEvents,
}: {
  activeEventId: string | null;
  evidenceCards: HistoryEvidenceCard[];
  events: HistoryEvent[];
  onCreateStarterEvent: () => void;
  onReplayTimeline: () => void;
  onSelectEvent: (eventId: string) => void;
  sources: HistorySource[];
  status: SaveStatusSnapshot;
  templateEvents: HistoryEventTemplate[];
}) {
  const timelineEvents = useMemo(() => {
    const base = sortHistoryEvents(templateEvents);
    const evidenceCountByEvent = new Map<string, number>();
    evidenceCards.forEach((card) => {
      const templateEventId =
        typeof card.source_snapshot_json?.templateEventId === "string"
          ? card.source_snapshot_json.templateEventId
          : null;
      const eventId =
        typeof card.source_snapshot_json?.eventId === "string"
          ? card.source_snapshot_json.eventId
          : templateEventId;
      if (eventId) {
        evidenceCountByEvent.set(eventId, (evidenceCountByEvent.get(eventId) ?? 0) + 1);
      }
    });
    const sourceCountByEvent = new Map<string, number>();
    sources.forEach((source) => {
      const templateEventId =
        typeof source.context_note === "string"
          ? base.find((event) => source.context_note?.toLowerCase().includes(event.title.toLowerCase()))?.id
          : null;
      if (templateEventId) {
        sourceCountByEvent.set(templateEventId, (sourceCountByEvent.get(templateEventId) ?? 0) + 1);
      }
    });

    return base.map((event) => ({
      ...event,
      evidenceCount: evidenceCountByEvent.get(event.id) ?? 0,
      sourceCount: sourceCountByEvent.get(event.id) ?? 0,
    }));
  }, [evidenceCards, sources, templateEvents]);

  const activeEvent =
    timelineEvents.find((event) => event.id === activeEventId) ?? timelineEvents[0] ?? null;

  return (
    <WorkspacePanel
      actions={
        <>
          <Button onClick={onReplayTimeline} size="sm" type="button" variant="outline">
            <Route data-icon="inline-start" />
            Replay timeline
          </Button>
          <Button onClick={onCreateStarterEvent} size="sm" type="button">
            <Plus data-icon="inline-start" />
            Add event
          </Button>
        </>
      }
      className="min-h-[640px]"
      description="Chronology first, then causes, then evidence."
      title="Timeline and map"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <div className="flex flex-col gap-3">
          {timelineEvents.map((event, index) => (
            <button
              className={cn(
                "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft",
                event.id === activeEventId
                  ? "border-primary/40 bg-accent/55"
                  : "border-border/70 bg-background/72",
              )}
              key={event.id}
              onClick={() => onSelectEvent(event.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")} · {formatHistoricalDateLabel(event)}
                  </p>
                  <h4 className="mt-2 text-base font-semibold">{event.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.summary}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline">{event.location_label ?? "No location"}</Badge>
                  <Badge variant="secondary">{event.themes[0] ?? "event"}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{event.sourceCount} sources</Badge>
                <Badge variant="outline">{event.evidenceCount} evidence cards</Badge>
                {event.themes.slice(0, 3).map((theme) => (
                  <Badge key={`${event.id}-${theme}`} variant="secondary">
                    {theme}
                  </Badge>
                ))}
              </div>
            </button>
          ))}
          {timelineEvents.length === 0 ? (
            <EmptyState
              description="Seeded history events will appear here once this binder has template chronology."
              title="No history events yet"
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <SaveStatusPill snapshot={status} />
          {activeEvent ? (
            <div className="rounded-2xl border border-border/70 bg-card/88 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Event detail
                  </p>
                  <h4 className="mt-2 text-lg font-semibold">{activeEvent.title}</h4>
                </div>
                <Badge variant="secondary">{formatHistoricalDateLabel(activeEvent)}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{activeEvent.significance}</p>
              <div className="mt-4 rounded-2xl border border-border/70 bg-background/74 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Landmark className="size-4" />
                  Map-style location
                </div>
                <div className="mt-3 rounded-2xl border border-border/60 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.2),transparent_28%),radial-gradient(circle_at_70%_35%,rgba(59,130,246,0.18),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.04),transparent)] p-4">
                  <p className="text-sm font-medium">{activeEvent.location_label ?? "Location unavailable"}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Use this as a geographic cue rather than a fully interactive map. The panel is meant to keep spatial thinking visible without needing a paid map API.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <FactRow label="Why it mattered" value={activeEvent.significance} />
                <FactRow label="Themes" value={activeEvent.themes.join(", ")} />
                <FactRow
                  label="Evidence"
                  value={`${activeEvent.evidenceCount} linked evidence cards · ${activeEvent.sourceCount} linked sources`}
                />
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </WorkspacePanel>
  );
}

export function SourceEvidenceModule({
  activeSourceId,
  evidenceCards,
  onCreateEvidenceFromActiveSource,
  onSelectSource,
  onUseSourceInArgument,
  sources,
  status,
  templateSources,
}: {
  activeSourceId: string | null;
  evidenceCards: HistoryEvidenceCard[];
  onCreateEvidenceFromActiveSource: (source: HistorySourceTemplate | HistorySource) => void;
  onSelectSource: (sourceId: string) => void;
  onUseSourceInArgument: (sourceId: string) => void;
  sources: HistorySource[];
  status: SaveStatusSnapshot;
  templateSources: HistorySourceTemplate[];
}) {
  const combinedSources = useMemo(
    () =>
      [...templateSources, ...sources].sort((left, right) => left.title.localeCompare(right.title)),
    [sources, templateSources],
  );
  const activeSource = combinedSources.find((source) => source.id === activeSourceId) ?? combinedSources[0] ?? null;

  return (
    <WorkspacePanel
      actions={<SaveStatusPill snapshot={status} />}
      className="min-h-[620px]"
      description="Source work turns passages into usable historical evidence."
      title="Source evidence"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <div className="grid gap-3">
          {combinedSources.map((source) => (
            <article
              className={cn(
                "rounded-2xl border p-4 shadow-sm transition",
                source.id === activeSourceId
                  ? "border-primary/40 bg-accent/55"
                  : "border-border/70 bg-background/72",
              )}
              key={source.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <button className="text-left" onClick={() => onSelectSource(source.id)} type="button">
                    <h4 className="text-base font-semibold">{source.title}</h4>
                  </button>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {source.source_type} source · {source.date_label}
                  </p>
                </div>
                <Badge variant={source.source_type === "primary" ? "default" : "outline"}>
                  {source.source_type}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <FactRow label="Author" value={source.author ?? "Unknown / collective"} />
                <FactRow label="Audience" value={source.audience ?? "Context note only"} />
                <FactRow label="Purpose" value={source.purpose ?? "Not specified"} />
                <FactRow label="Point of view" value={source.point_of_view ?? "Not specified"} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => onUseSourceInArgument(source.id)} size="sm" type="button" variant="outline">
                  <Link2 data-icon="inline-start" />
                  Use in argument
                </Button>
                <Button
                  onClick={() => onCreateEvidenceFromActiveSource(source)}
                  size="sm"
                  type="button"
                >
                  <Quote data-icon="inline-start" />
                  Save evidence
                </Button>
              </div>
            </article>
          ))}
          {combinedSources.length === 0 ? (
            <EmptyState
              description="Seeded historical sources will appear here when this binder includes evidence templates."
              title="No sources yet"
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          {activeSource ? (
            <div className="rounded-2xl border border-border/70 bg-card/88 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Evidence locker
                  </p>
                  <h4 className="mt-2 text-lg font-semibold">{activeSource.title}</h4>
                </div>
                <Badge variant={activeSource.source_type === "primary" ? "default" : "outline"}>
                  {activeSource.source_type}
                </Badge>
              </div>
              {activeSource.quote_text ? (
                <blockquote className="mt-4 rounded-2xl border border-border/70 bg-background/78 p-4 text-sm leading-7 text-foreground">
                  "{activeSource.quote_text}"
                </blockquote>
              ) : null}
              <div className="mt-4 grid gap-3">
                <FactRow label="Context note" value={activeSource.context_note ?? "No context note yet."} />
                <FactRow label="Reliability note" value={activeSource.reliability_note ?? "No reliability note yet."} />
                <FactRow label="Supports" value={activeSource.claim_supports ?? "No explicit supported claim yet."} />
                <FactRow label="Challenges" value={activeSource.claim_challenges ?? "No explicit challenged claim yet."} />
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/70 bg-background/76 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">Saved evidence cards</h4>
              <Badge variant="secondary">{evidenceCards.length}</Badge>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {evidenceCards.slice(0, 5).map((card) => (
                <div className="rounded-xl border border-border/60 bg-card/88 p-3" key={card.id}>
                  <p className="text-sm font-medium">{card.quote_text ?? card.paraphrase ?? "Evidence card"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.claim_supports ?? card.claim_challenges ?? "Claim link coming next"}
                  </p>
                </div>
              ))}
              {evidenceCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">Highlights and source actions can turn into reusable evidence cards.</p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </WorkspacePanel>
  );
}

export function ArgumentBuilderModule({
  activeChain,
  edges,
  nodes,
  onCreateStarterChain,
  onUseEvidencePrompt,
  status,
}: {
  activeChain: HistoryArgumentChain | null;
  edges: HistoryArgumentEdge[];
  nodes: HistoryArgumentNode[];
  onCreateStarterChain: () => void;
  onUseEvidencePrompt: () => void;
  status: SaveStatusSnapshot;
}) {
  const [localPrompt, setLocalPrompt] = useState(
    activeChain?.prompt ?? "What were the most important causes of the French Revolution?",
  );
  const [localThesis, setLocalThesis] = useState(
    activeChain?.thesis ??
      "The French Revolution was caused not by one event, but by the combination of financial crisis, social inequality, and Enlightenment political ideas.",
  );

  const orderedNodes = useMemo(
    () => [...nodes].sort((left, right) => left.sort_order - right.sort_order),
    [nodes],
  );

  return (
    <WorkspacePanel
      actions={
        <>
          <SaveStatusPill snapshot={status} />
          <Button onClick={onCreateStarterChain} size="sm" type="button">
            <Plus data-icon="inline-start" />
            Starter chain
          </Button>
        </>
      }
      className="min-h-[640px]"
      description="Turn chronology and evidence into claims with reasons attached."
      title="Argument builder"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border/70 bg-background/74 p-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Prompt
            </label>
            <Textarea className="mt-2 min-h-[88px]" onChange={(event) => setLocalPrompt(event.target.value)} value={localPrompt} />
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/74 p-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Thesis
            </label>
            <Textarea className="mt-2 min-h-[120px]" onChange={(event) => setLocalThesis(event.target.value)} value={localThesis} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={onUseEvidencePrompt} size="sm" type="button" variant="outline">
                <BookOpen data-icon="inline-start" />
                Pull in evidence
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              "Context",
              "Evidence",
              "Cause 1",
              "Cause 2",
              "Cause 3",
              "Counterargument",
              "Conclusion",
            ].map((label) => (
              <div className="rounded-2xl border border-border/70 bg-card/88 p-4" key={label}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {label}
                </p>
                <Textarea
                  className="mt-2 min-h-[120px]"
                  placeholder={`Write the ${label.toLowerCase()} here`}
                />
              </div>
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border/70 bg-card/88 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Compass className="size-4" />
              Cause and effect chain
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {orderedNodes.length > 0 ? (
                orderedNodes.map((node, index) => {
                  const outgoingEdge = edges.find((edge) => edge.from_node_id === node.id);
                  return (
                    <div key={node.id}>
                      <div className="rounded-xl border border-border/70 bg-background/74 p-3">
                        <p className="text-sm font-semibold">{node.title || node.node_type}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{node.body || "Explain what happens here and why it matters."}</p>
                      </div>
                      {outgoingEdge ? (
                        <div className="my-2 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          <ArrowRight className="size-3.5" />
                          {outgoingEdge.relation_type.replaceAll("_", " ")}
                        </div>
                      ) : index < orderedNodes.length - 1 ? (
                        <div className="my-2 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          <ArrowRight className="size-3.5" />
                          Add relation
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  description="Create a starter chain to seed the French Revolution cause sequence."
                  title="No chain nodes yet"
                />
              )}
            </div>
          </div>

          {activeChain ? (
            <div className="rounded-2xl border border-border/70 bg-background/76 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Active chain
              </p>
              <p className="mt-2 text-sm font-semibold">{activeChain.prompt || "Untitled argument chain"}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {activeChain.thesis || "Add a thesis to connect your evidence to a historical claim."}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </WorkspacePanel>
  );
}

export function MythHistoryModule({
  mythChecks,
  onCreateStarterMythCheck,
  status,
  templateMythChecks,
}: {
  mythChecks: HistoryMythCheck[];
  onCreateStarterMythCheck: () => void;
  status: SaveStatusSnapshot;
  templateMythChecks: HistoryMythCheckTemplate[];
}) {
  const cards = [...templateMythChecks, ...mythChecks];

  return (
    <WorkspacePanel
      actions={
        <>
          <SaveStatusPill snapshot={status} />
          <Button onClick={onCreateStarterMythCheck} size="sm" type="button" variant="outline">
            <Plus data-icon="inline-start" />
            New myth check
          </Button>
        </>
      }
      className="min-h-[620px]"
      description="Separate catchy stories from supported explanation."
      title="Myth vs history"
    >
      <div className="grid gap-4">
        {cards.map((card) => (
          <article className="rounded-2xl border border-border/70 bg-background/76 p-4 shadow-sm" key={card.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Popular claim
                </p>
                <h4 className="mt-2 text-base font-semibold">{card.myth_text}</h4>
              </div>
              <Badge className="capitalize" variant={card.status === "evidence_supported" ? "default" : "outline"}>
                {card.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-card/88 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Scale className="size-4" />
                  What evidence suggests
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.corrected_claim}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/88 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Quote className="size-4" />
                  Why this status fits
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.explanation}</p>
              </div>
            </div>
          </article>
        ))}
        {cards.length === 0 ? (
          <EmptyState
            description="Seeded myth checks will appear here when this binder includes myth/history content."
            title="No myth checks yet"
          />
        ) : null}
      </div>
    </WorkspacePanel>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/72 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}
