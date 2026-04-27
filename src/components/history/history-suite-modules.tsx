import { useEffect, useMemo, useState } from "react";
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

type TimelineEventRecord = HistoryEvent | HistoryEventTemplate;
type SourceRecord = HistorySource | HistorySourceTemplate;
type MythRecord = HistoryMythCheck | HistoryMythCheckTemplate;
type ChainEditableField = "prompt" | "thesis" | "context" | "counterargument" | "conclusion";

const MYTH_STATUS_ORDER: Record<MythRecord["status"], number> = {
  myth: 0,
  oversimplification: 1,
  contested: 2,
  evidence_supported: 3,
};

const MYTH_STATUS_LABEL: Record<MythRecord["status"], string> = {
  myth: "Myth",
  oversimplification: "Oversimplification",
  contested: "Contested",
  evidence_supported: "Evidence-supported",
};

export function mergeTimelineEvents(
  templateEvents: HistoryEventTemplate[],
  events: HistoryEvent[],
) {
  const merged = new Map<string, TimelineEventRecord>();
  const userEventsByTemplate = new Map<string, HistoryEvent>();

  events.forEach((event) => {
    if (!event.template_event_id) {
      return;
    }
    const existing = userEventsByTemplate.get(event.template_event_id);
    if (!existing || event.updated_at > existing.updated_at) {
      userEventsByTemplate.set(event.template_event_id, event);
    }
  });

  templateEvents.forEach((templateEvent) => {
    const override = userEventsByTemplate.get(templateEvent.id);
    if (override) {
      merged.set(`template:${templateEvent.id}`, override);
      return;
    }
    merged.set(`template:${templateEvent.id}`, templateEvent);
  });

  events.forEach((event) => {
    if (event.template_event_id) {
      merged.set(`template:${event.template_event_id}`, event);
      return;
    }
    merged.set(`event:${event.id}`, event);
  });

  return sortHistoryEvents([...merged.values()]);
}

export function mergeHistorySources(
  templateSources: HistorySourceTemplate[],
  sources: HistorySource[],
) {
  const merged = new Map<string, SourceRecord>();
  const userSourcesByTemplate = new Map<string, HistorySource>();

  sources.forEach((source) => {
    if (!source.template_source_id) {
      return;
    }
    const existing = userSourcesByTemplate.get(source.template_source_id);
    if (!existing || source.updated_at > existing.updated_at) {
      userSourcesByTemplate.set(source.template_source_id, source);
    }
  });

  templateSources.forEach((templateSource) => {
    const override = userSourcesByTemplate.get(templateSource.id);
    if (override) {
      merged.set(`template:${templateSource.id}`, override);
      return;
    }
    merged.set(`template:${templateSource.id}`, templateSource);
  });

  sources.forEach((source) => {
    if (source.template_source_id) {
      merged.set(`template:${source.template_source_id}`, source);
      return;
    }
    merged.set(`source:${source.id}`, source);
  });

  return [...merged.values()].sort((left, right) => {
    if (left.source_type !== right.source_type) {
      return left.source_type === "primary" ? -1 : 1;
    }
    return left.title.localeCompare(right.title);
  });
}

export function mergeMythChecks(
  templateMyths: HistoryMythCheckTemplate[],
  myths: HistoryMythCheck[],
) {
  const merged = new Map<string, MythRecord>();
  const userByTemplate = new Map<string, HistoryMythCheck>();

  myths.forEach((myth) => {
    if (!myth.template_myth_check_id) {
      return;
    }
    const existing = userByTemplate.get(myth.template_myth_check_id);
    if (!existing || myth.updated_at > existing.updated_at) {
      userByTemplate.set(myth.template_myth_check_id, myth);
    }
  });

  templateMyths.forEach((templateMyth) => {
    const override = userByTemplate.get(templateMyth.id);
    if (override) {
      merged.set(`template:${templateMyth.id}`, override);
      return;
    }
    merged.set(`template:${templateMyth.id}`, templateMyth);
  });

  myths.forEach((myth) => {
    if (myth.template_myth_check_id) {
      merged.set(`template:${myth.template_myth_check_id}`, myth);
      return;
    }
    merged.set(`myth:${myth.id}`, myth);
  });

  return [...merged.values()].sort((left, right) => {
    const statusDelta = MYTH_STATUS_ORDER[left.status] - MYTH_STATUS_ORDER[right.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }
    return left.myth_text.localeCompare(right.myth_text);
  });
}

export function HistoryTimelineModule({
  activeEventId,
  evidenceCards,
  events,
  onCreateStarterEvent,
  onReplayTimeline,
  onSelectEvent,
  status,
  templateEvents,
}: {
  activeEventId: string | null;
  evidenceCards: HistoryEvidenceCard[];
  events: HistoryEvent[];
  onCreateStarterEvent: () => void;
  onReplayTimeline: () => void;
  onSelectEvent: (eventId: string) => void;
  status: SaveStatusSnapshot;
  templateEvents: HistoryEventTemplate[];
}) {
  const timelineEvents = useMemo(() => {
    const mergedEvents = mergeTimelineEvents(templateEvents, events);
    const eventIds = new Set(mergedEvents.map((event) => event.id));
    const templateToEventId = new Map<string, string>();
    mergedEvents.forEach((event) => {
      if ("template_event_id" in event && event.template_event_id) {
        templateToEventId.set(event.template_event_id, event.id);
      } else {
        templateToEventId.set(event.id, event.id);
      }
    });

    const evidenceCountByEventId = new Map<string, number>();
    const sourceTokensByEventId = new Map<string, Set<string>>();

    evidenceCards.forEach((card) => {
      const snapshot = card.source_snapshot_json ?? {};
      const snapshotEventId =
        typeof snapshot.eventId === "string"
          ? snapshot.eventId
          : typeof snapshot.templateEventId === "string"
            ? snapshot.templateEventId
            : null;
      if (!snapshotEventId) {
        return;
      }

      const resolvedEventId = eventIds.has(snapshotEventId)
        ? snapshotEventId
        : templateToEventId.get(snapshotEventId) ?? null;
      if (!resolvedEventId) {
        return;
      }

      evidenceCountByEventId.set(
        resolvedEventId,
        (evidenceCountByEventId.get(resolvedEventId) ?? 0) + 1,
      );

      const snapshotSourceToken =
        typeof snapshot.sourceId === "string"
          ? snapshot.sourceId
          : typeof snapshot.templateSourceId === "string"
            ? snapshot.templateSourceId
            : null;
      const sourceToken = card.source_id ?? snapshotSourceToken;
      if (!sourceToken) {
        return;
      }

      const sourceSet = sourceTokensByEventId.get(resolvedEventId) ?? new Set<string>();
      sourceSet.add(sourceToken);
      sourceTokensByEventId.set(resolvedEventId, sourceSet);
    });

    return mergedEvents.map((event) => ({
      ...event,
      evidenceCount: evidenceCountByEventId.get(event.id) ?? 0,
      sourceCount: sourceTokensByEventId.get(event.id)?.size ?? 0,
    }));
  }, [evidenceCards, events, templateEvents]);

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
                event.id === activeEvent?.id
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
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {event.summary || "Summary coming soon."}
                  </p>
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
              description="Seeded chronology appears here when this binder includes timeline events."
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
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {activeEvent.significance || "Add why this turning point matters."}
              </p>
              <div className="mt-4 rounded-2xl border border-border/70 bg-background/74 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Landmark className="size-4" />
                  Map-style location
                </div>
                <div className="mt-3 rounded-2xl border border-border/60 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.2),transparent_28%),radial-gradient(circle_at_70%_35%,rgba(59,130,246,0.18),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.04),transparent)] p-4">
                  <p className="text-sm font-medium">
                    {activeEvent.location_label ?? "Location unavailable"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Use this as a geographic cue to keep spatial context visible while studying.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <FactRow
                  label="Why it mattered"
                  value={activeEvent.significance || "Explain why this event changes the story."}
                />
                <FactRow label="Themes" value={activeEvent.themes.join(", ") || "No themes yet"} />
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
    () => mergeHistorySources(templateSources, sources),
    [sources, templateSources],
  );
  const activeSource =
    combinedSources.find((source) => source.id === activeSourceId) ?? combinedSources[0] ?? null;

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
                source.id === activeSource?.id
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
                    {source.source_type} source · {source.date_label || "Date not specified"}
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
                <Button onClick={() => onCreateEvidenceFromActiveSource(source)} size="sm" type="button">
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
                <FactRow
                  label="Reliability note"
                  value={activeSource.reliability_note ?? "No reliability note yet."}
                />
                <FactRow
                  label="Supports"
                  value={activeSource.claim_supports ?? "No explicit supported claim yet."}
                />
                <FactRow
                  label="Challenges"
                  value={activeSource.claim_challenges ?? "No explicit challenged claim yet."}
                />
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
                  <p className="text-sm font-medium">
                    {card.quote_text ?? card.paraphrase ?? "Evidence card"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.claim_supports ?? card.claim_challenges ?? "Claim link coming next"}
                  </p>
                </div>
              ))}
              {evidenceCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Highlights and source actions can turn into reusable evidence cards.
                </p>
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
  onUpdateChain,
  onUseEvidencePrompt,
  starterTopic = "french",
  status,
}: {
  activeChain: HistoryArgumentChain | null;
  edges: HistoryArgumentEdge[];
  nodes: HistoryArgumentNode[];
  onCreateStarterChain: () => void;
  onUpdateChain?: (
    chainId: string,
    patch: Partial<
      Pick<HistoryArgumentChain, "prompt" | "thesis" | "context" | "counterargument" | "conclusion">
    >,
  ) => void;
  onUseEvidencePrompt: () => void;
  starterTopic?: "french" | "rome" | "russian";
  status: SaveStatusSnapshot;
}) {
  const [draft, setDraft] = useState(() => buildChainDraft(activeChain, starterTopic));

  useEffect(() => {
    setDraft(buildChainDraft(activeChain, starterTopic));
  }, [activeChain?.id, activeChain?.updated_at, starterTopic]);

  const orderedNodes = useMemo(() => {
    if (!activeChain) {
      return [];
    }
    return [...nodes]
      .filter((node) => node.chain_id === activeChain.id)
      .sort((left, right) => left.sort_order - right.sort_order);
  }, [activeChain, nodes]);

  const outgoingEdgeByNodeId = useMemo(() => {
    if (!activeChain) {
      return new Map<string, HistoryArgumentEdge>();
    }
    const map = new Map<string, HistoryArgumentEdge>();
    edges
      .filter((edge) => edge.chain_id === activeChain.id)
      .forEach((edge) => {
        if (!map.has(edge.from_node_id)) {
          map.set(edge.from_node_id, edge);
        }
      });
    return map;
  }, [activeChain, edges]);

  const commitField = (field: ChainEditableField, value: string) => {
    if (!activeChain || !onUpdateChain) {
      return;
    }
    const previous = (activeChain[field] ?? "").trim();
    const next = value.trim();
    if (previous === next) {
      return;
    }
    onUpdateChain(activeChain.id, { [field]: value });
  };

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
            <Textarea
              className="mt-2 min-h-[88px]"
              onBlur={(event) => commitField("prompt", event.target.value)}
              onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
              value={draft.prompt}
            />
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/74 p-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Thesis
            </label>
            <Textarea
              className="mt-2 min-h-[120px]"
              onBlur={(event) => commitField("thesis", event.target.value)}
              onChange={(event) => setDraft((current) => ({ ...current, thesis: event.target.value }))}
              value={draft.thesis}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={onUseEvidencePrompt} size="sm" type="button" variant="outline">
                <BookOpen data-icon="inline-start" />
                Pull in evidence
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ChainFieldCard
              label="Context"
              onBlur={(value) => commitField("context", value)}
              onChange={(value) => setDraft((current) => ({ ...current, context: value }))}
              value={draft.context}
            />
            <ChainFieldCard
              label="Counterargument"
              onBlur={(value) => commitField("counterargument", value)}
              onChange={(value) => setDraft((current) => ({ ...current, counterargument: value }))}
              value={draft.counterargument}
            />
            <div className="rounded-2xl border border-border/70 bg-card/88 p-4 md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Evidence notes
              </p>
              <Textarea
                className="mt-2 min-h-[120px]"
                defaultValue=""
                placeholder="Capture the strongest evidence links from the source panel."
              />
            </div>
            <ChainFieldCard
              label="Conclusion"
              onBlur={(value) => commitField("conclusion", value)}
              onChange={(value) => setDraft((current) => ({ ...current, conclusion: value }))}
              value={draft.conclusion}
            />
            <div className="rounded-2xl border border-border/70 bg-card/88 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Cause sequence notes
              </p>
              <Textarea
                className="mt-2 min-h-[120px]"
                defaultValue=""
                placeholder="Use node cards on the right to structure the chain."
              />
            </div>
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
                  const outgoingEdge = outgoingEdgeByNodeId.get(node.id);
                  return (
                    <div key={node.id}>
                      <div className="rounded-xl border border-border/70 bg-background/74 p-3">
                        <p className="text-sm font-semibold">{node.title || node.node_type}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {node.body || "Explain what happens here and why it matters."}
                        </p>
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
                  description={
                    starterTopic === "rome"
                      ? "Create a starter chain to seed the Rise of Rome cause sequence."
                      : starterTopic === "russian"
                        ? "Create a starter chain to seed the Russian Revolution cause sequence."
                      : "Create a starter chain to seed the French Revolution cause sequence."
                  }
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
              <p className="mt-2 text-sm font-semibold">
                {activeChain.prompt || "Untitled argument chain"}
              </p>
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
  const cards = useMemo(
    () => mergeMythChecks(templateMythChecks, mythChecks),
    [mythChecks, templateMythChecks],
  );

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
                {MYTH_STATUS_LABEL[card.status]}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-card/88 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Scale className="size-4" />
                  What evidence suggests
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {card.corrected_claim || "Add an evidence-supported correction."}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/88 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Quote className="size-4" />
                  Why this status fits
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {card.explanation || "Explain why this status best fits the evidence."}
                </p>
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

const starterChainDrafts = {
  french: {
    prompt: "What were the most important causes of the French Revolution?",
    thesis:
      "The French Revolution was caused not by one event, but by the combination of financial crisis, social inequality, and Enlightenment political ideas.",
    context:
      "Use chronology to show why structural problems became a political revolution in 1789.",
    counterargument:
      "Some explanations overstate one cause, such as bread prices, and miss the broader crisis.",
    conclusion:
      "The strongest answer shows how economic stress, representation disputes, and political ideas intensified one another.",
  },
  rome: {
    prompt: "How did Rome's republic transform into an empire?",
    thesis:
      "Rome's imperial system grew out of expansion, elite rivalry, military loyalty, and civil war rather than a smooth constitutional handoff.",
    context:
      "Use the timeline to connect republican offices, Mediterranean expansion, reform conflict, Caesar, and Augustus.",
    counterargument:
      "A size-only explanation misses how social inequality, army politics, and elite competition changed the republic from within.",
    conclusion:
      "The strongest answer shows how overseas power created pressures that republican institutions could not absorb without one-man rule.",
  },
  russian: {
    prompt: "Why did imperial Russia collapse and Bolshevik power survive?",
    thesis:
      "The Russian Revolution grew from autocracy, land hunger, industrial unrest, war collapse, and Bolshevik organization converging during a legitimacy crisis.",
    context:
      "Use the timeline to connect 1861, 1905, World War I, February, dual power, October, civil war, NEP, and USSR formation.",
    counterargument:
      "A war-only explanation misses the older land, labor, nationality, and institutional problems that made wartime failure revolutionary.",
    conclusion:
      "The strongest answer shows why February destroyed the monarchy but October and civil war created a very different one-party state.",
  },
} as const;

function buildChainDraft(
  activeChain: HistoryArgumentChain | null,
  starterTopic: keyof typeof starterChainDrafts,
) {
  const starter = starterChainDrafts[starterTopic];
  return {
    prompt: activeChain?.prompt ?? starter.prompt,
    thesis: activeChain?.thesis ?? starter.thesis,
    context: activeChain?.context ?? starter.context,
    counterargument: activeChain?.counterargument ?? starter.counterargument,
    conclusion: activeChain?.conclusion ?? starter.conclusion,
  };
}

function ChainFieldCard({
  label,
  onBlur,
  onChange,
  value,
}: {
  label: string;
  onBlur: (value: string) => void;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/88 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <Textarea
        className="mt-2 min-h-[120px]"
        onBlur={(event) => onBlur(event.target.value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Write the ${label.toLowerCase()} here`}
        value={value}
      />
    </div>
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
