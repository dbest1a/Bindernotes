import type { JSONContent } from "@tiptap/react";
import {
  BadgeCheck,
  BookOpen,
  Check,
  ClipboardList,
  Eye,
  Link2,
  RotateCcw,
  Sparkles,
  Tags,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { createDraftsFromProvider } from "@/lib/recall/recall-draft-providers";
import { summarizeRecallHealth } from "@/lib/recall/recall-health";
import {
  buildCheckpointSession,
  buildGuidedRecallQueue,
  compareRecallAnswer,
  isRecallCardDue,
  rateRecallCard,
} from "@/lib/recall/recall-scheduler";
import {
  appendRecallSession,
  loadRecallCards,
  loadRecallSessions,
  recallStorageKey,
  saveRecallCards,
} from "@/lib/recall/recall-storage";
import type {
  RecallCard,
  RecallCardStatus,
  RecallCardType,
  RecallDeckScope,
  RecallMissReason,
  RecallPracticeMode,
  RecallReviewRating,
  RecallSourceSeed,
  RecallSourceType,
} from "@/lib/recall/recall-types";
import { cn } from "@/lib/utils";
import type { Binder, BinderLesson, Comment, Highlight } from "@/types";

type RecallLabProps = {
  betaEnabled?: boolean;
  binder: Binder;
  comments?: Comment[];
  highlights?: Highlight[];
  lesson: BinderLesson;
  lessons?: BinderLesson[];
  noteContent?: JSONContent;
  noteTitle?: string;
  onOpenSource?: () => void;
  subject?: string | null;
  userId?: string | null;
};

type ManualCardForm = {
  front: string;
  back: string;
  explanation: string;
  whyItMatters: string;
  tags: string;
  cardType: RecallCardType;
};

const emptyForm: ManualCardForm = {
  front: "",
  back: "",
  explanation: "",
  whyItMatters: "",
  tags: "",
  cardType: "basic_qa",
};

const cardTypeOptions: Array<{ label: string; value: RecallCardType; subject?: string }> = [
  { label: "Basic Q/A", value: "basic_qa" },
  { label: "Term / Definition", value: "term_definition" },
  { label: "Cloze", value: "cloze" },
  { label: "Concept -> Example", value: "concept_example" },
  { label: "Compare / Contrast", value: "compare_contrast" },
  { label: "Process Steps", value: "process_steps" },
  { label: "Formula meaning", value: "formula_meaning", subject: "math" },
  { label: "Graph interpretation", value: "graph_interpretation", subject: "math" },
  { label: "Proof step", value: "proof_step", subject: "math" },
  { label: "Element fact", value: "element_fact", subject: "chemistry" },
  { label: "Reaction balancing", value: "reaction_balancing", subject: "chemistry" },
  { label: "Lab observation", value: "lab_observation", subject: "chemistry" },
  { label: "Evidence -> claim", value: "evidence_claim", subject: "history" },
  { label: "Timeline ordering", value: "timeline_ordering", subject: "history" },
  { label: "Claim/evidence/reasoning", value: "claim_evidence_reasoning" },
];

const practiceModes: RecallPracticeMode[] = [
  "Flip",
  "Type answer",
  "Cloze",
  "Multiple choice",
  "Pair Builder",
  "Teach-back",
  "Mistake review",
  "Checkpoint",
  "Guided Recall",
];

const missReasons: RecallMissReason[] = [
  "Forgot term",
  "Confused similar concept",
  "Did not understand source",
  "Careless error",
  "Need example",
  "Card is wrong/vague",
  "Other",
];

function storage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function tagList(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function plainTextFromJson(content: JSONContent | undefined): string {
  if (!content) return "";
  const values: string[] = [];
  const visit = (node: JSONContent) => {
    if (typeof node.text === "string") {
      values.push(node.text);
    }
    node.content?.forEach(visit);
  };
  visit(content);
  return values.join(" ").replace(/\s+/g, " ").trim();
}

function cardDisplayStatus(card: RecallCard) {
  if (card.draftStatus !== "accepted") return "Draft";
  if (card.status === "Mastered") return "Mastered";
  if (card.status === "Weak" || card.status === "Confused") return "Weak";
  if (card.status === "Source gap") return "Source gap";
  return card.status;
}

function sourceLabel(sourceType: RecallSourceType) {
  return sourceType.replace(/_/g, " ");
}

function updateCard(cards: RecallCard[], card: RecallCard) {
  return cards.map((candidate) => (candidate.id === card.id ? card : candidate));
}

export function RecallLab({
  betaEnabled = false,
  binder,
  comments = [],
  highlights = [],
  lesson,
  lessons = [],
  noteContent,
  noteTitle,
  onOpenSource,
  subject,
  userId,
}: RecallLabProps) {
  const scope = useMemo<RecallDeckScope>(
    () => ({
      userId,
      binderId: binder.id,
      documentId: lesson.id,
      lessonId: lesson.id,
    }),
    [binder.id, lesson.id, userId],
  );
  const scopeKey = useMemo(() => recallStorageKey(scope), [scope]);
  const [cards, setCards] = useState<RecallCard[]>([]);
  const [sessions, setSessions] = useState(() => loadRecallSessions(scope, storage()));
  const [manualForm, setManualForm] = useState<ManualCardForm>(emptyForm);
  const [selectedText, setSelectedText] = useState("");
  const [selectedHighlightId, setSelectedHighlightId] = useState("");
  const [selectedNoteExcerpt, setSelectedNoteExcerpt] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [practiceMode, setPracticeMode] = useState<RecallPracticeMode>("Flip");
  const [showBack, setShowBack] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [clozeAnswer, setClozeAnswer] = useState("");
  const [teachBack, setTeachBack] = useState("");
  const [missReason, setMissReason] = useState<RecallMissReason>("Forgot term");
  const [missNote, setMissNote] = useState("");
  const [message, setMessage] = useState("");
  const [fullSurface, setFullSurface] = useState(false);

  useEffect(() => {
    setCards(loadRecallCards(scope, storage()));
    setSessions(loadRecallSessions(scope, storage()));
  }, [scopeKey]);

  const acceptedCards = useMemo(() => cards.filter((card) => card.draftStatus === "accepted"), [cards]);
  const draftCards = useMemo(
    () => cards.filter((card) => card.draftStatus === "needs_review" || card.draftStatus === "draft"),
    [cards],
  );
  const dueQueue = useMemo(
    () => buildGuidedRecallQueue(acceptedCards, scope, "Current lesson"),
    [acceptedCards, scope],
  );
  const activeCard =
    cards.find((card) => card.id === activeCardId) ?? dueQueue[0] ?? acceptedCards[0] ?? draftCards[0] ?? null;
  const health = useMemo(
    () => summarizeRecallHealth(cards, { lessonId: lesson.id, sessions }),
    [cards, lesson.id, sessions],
  );
  const noteText = useMemo(() => plainTextFromJson(noteContent), [noteContent]);
  const noteExcerpt = selectedNoteExcerpt.trim() || noteText.slice(0, 360);
  const visibleCardTypes = useMemo(() => {
    const normalizedSubject = `${subject ?? binder.subject ?? ""}`.toLowerCase();
    return cardTypeOptions.filter((option) => !option.subject || normalizedSubject.includes(option.subject));
  }, [binder.subject, subject]);

  const saveCards = (nextCards: RecallCard[]) => {
    setCards(nextCards);
    saveRecallCards(scope, nextCards, storage());
  };

  const addDrafts = (drafts: RecallCard[], success: string) => {
    if (!drafts.length) {
      setMessage("Add a source passage or card text first.");
      return;
    }

    saveCards([...drafts, ...cards]);
    setActiveCardId(drafts[0].id);
    setMessage(success);
  };

  const createManualDraft = () => {
    const drafts = createDraftsFromProvider(
      "manualCardProvider",
      {
        ...manualForm,
        tags: tagList(manualForm.tags),
      },
      {
        ...scope,
        subject: subject ?? binder.subject,
        tags: [lesson.title],
      },
    );
    addDrafts(drafts, "Manual draft added to review.");
    setManualForm(emptyForm);
  };

  const createSelectedTextDraft = () => {
    const drafts = createDraftsFromProvider(
      "selectedTextDraftProvider",
      { text: selectedText, tags: [lesson.title] },
      { ...scope, subject: subject ?? binder.subject, tags: [lesson.title] },
    );
    addDrafts(drafts, "Source-linked draft created from selected text.");
    setSelectedText("");
  };

  const createHighlightDraft = () => {
    const selectedHighlight = highlights.find((highlight) => highlight.id === selectedHighlightId) ?? highlights[0];
    const source: RecallSourceSeed | undefined = selectedHighlight
      ? {
          id: selectedHighlight.id,
          text: selectedHighlight.selected_text ?? selectedHighlight.anchor_text,
          anchor: selectedHighlight.anchor_text,
          tags: [selectedHighlight.color, lesson.title],
        }
      : undefined;
    const drafts = createDraftsFromProvider(
      "highlightDraftProvider",
      { sources: source ? [source] : [] },
      { ...scope, subject: subject ?? binder.subject, tags: [lesson.title] },
    );
    addDrafts(drafts, "Highlight draft added to review.");
  };

  const createNoteDraft = () => {
    const source = noteExcerpt
      ? {
          id: noteTitle ?? "current-note",
          text: noteExcerpt,
          anchor: noteTitle ?? lesson.title,
          tags: [lesson.title],
        }
      : undefined;
    const drafts = createDraftsFromProvider(
      "noteDraftProvider",
      { sources: source ? [source] : [] },
      { ...scope, subject: subject ?? binder.subject, tags: [lesson.title] },
    );
    addDrafts(drafts, "Note draft added to review.");
  };

  const createStickyDraft = () => {
    const stickySources = comments
      .filter((comment) => comment.body.trim())
      .slice(0, 3)
      .map((comment) => ({
        id: comment.id,
        text: comment.body,
        anchor: comment.anchor_text ?? null,
        tags: [lesson.title],
      }));
    const drafts = createDraftsFromProvider(
      "stickyDraftProvider",
      { sources: stickySources },
      { ...scope, subject: subject ?? binder.subject, tags: [lesson.title] },
    );
    addDrafts(drafts, "Sticky-note draft added to review.");
  };

  const setCardStatus = (card: RecallCard, status: RecallCardStatus) => {
    const updated: RecallCard = {
      ...card,
      status,
      qualityStatus:
        status === "Duplicate"
          ? "duplicate"
          : status === "Too vague"
            ? "too_vague"
            : status === "Wrong"
              ? "wrong"
              : status === "Source gap"
                ? "source_gap"
                : card.qualityStatus,
      updatedAt: new Date().toISOString(),
    };
    saveCards(updateCard(cards, updated));
    setActiveCardId(updated.id);
  };

  const acceptDraft = (card: RecallCard) => {
    if (!card.front.trim() || !card.back.trim()) {
      setMessage("Complete the front and back before saving the final card.");
      setActiveCardId(card.id);
      return;
    }

    const now = new Date().toISOString();
    const updated: RecallCard = {
      ...card,
      draftStatus: "accepted",
      status: "Learning",
      nextReviewAt: now,
      updatedAt: now,
    };
    saveCards(updateCard(cards, updated));
    setActiveCardId(updated.id);
    setMessage("Card saved to this lesson's source deck.");
  };

  const editCard = (card: RecallCard, patch: Partial<RecallCard>) => {
    const updated = { ...card, ...patch, updatedAt: new Date().toISOString() };
    saveCards(updateCard(cards, updated));
    setActiveCardId(updated.id);
  };

  const rateCard = (rating: RecallReviewRating) => {
    if (!activeCard || activeCard.draftStatus !== "accepted") return;
    const updated = rateRecallCard(activeCard, rating);
    saveCards(updateCard(cards, updated));
    setActiveCardId(updated.id);
    setShowBack(false);
    setTypedAnswer("");
    setClozeAnswer("");
    setMessage(`${rating} recorded. Next due state updated.`);
  };

  const recordMiss = () => {
    if (!activeCard) return;
    const now = new Date().toISOString();
    const updated: RecallCard = {
      ...activeCard,
      missReasons: [...(activeCard.missReasons ?? []), { reason: missReason, note: missNote, createdAt: now }],
      status: missReason === "Did not understand source" ? "Source gap" : "Weak",
      updatedAt: now,
    };
    saveCards(updateCard(cards, updated));
    setActiveCardId(updated.id);
    setMissNote("");
    setMessage("Miss recorded in the Mistake Notebook.");
  };

  const saveTeachBack = () => {
    if (!activeCard || !teachBack.trim()) return;
    const now = new Date().toISOString();
    const updated: RecallCard = {
      ...activeCard,
      teachBackReflections: [
        ...(activeCard.teachBackReflections ?? []),
        { text: teachBack.trim(), createdAt: now },
      ],
      updatedAt: now,
    };
    saveCards(updateCard(cards, updated));
    setTeachBack("");
    setMessage("Teach-back reflection saved locally for this card.");
  };

  const createCheckpoint = () => {
    const session = buildCheckpointSession(acceptedCards, scope, {
      count: Math.min(10, Math.max(1, acceptedCards.length)),
      modes: ["Flip", "Type answer", "Cloze", "Multiple choice"],
      goal: "Checkpoint prep",
    });
    const nextSessions = appendRecallSession(scope, session, storage());
    setSessions(nextSessions);
    setPracticeMode("Checkpoint");
    setMessage("Checkpoint session prepared from this source deck.");
  };

  if (!betaEnabled) {
    return (
      <WorkspacePanel description="Source-linked active recall" title="Recall Lab">
        <EmptyState
          description="Turn on Beta Features to preview source-linked recall cards for this lesson."
          title="Recall Lab is in beta"
        />
      </WorkspacePanel>
    );
  }

  return (
    <WorkspacePanel description="Source-linked active recall" title="Recall Lab">
      <section
        className={cn("recall-lab", fullSurface && "recall-lab--full")}
        data-recall-lab="true"
        data-recall-scope={scopeKey}
      >
        <header className="recall-lab__hero">
          <div>
            <Badge variant="secondary">Beta</Badge>
            <h2>Recall Lab</h2>
            <p>Turn this lesson's highlights, notes, and source passages into source-linked recall cards.</p>
          </div>
          <div className="recall-lab__hero-actions">
            <Button onClick={() => setFullSurface((current) => !current)} size="sm" type="button" variant="outline">
              <Eye className="size-4" />
              {fullSurface ? "Exit full surface" : "Full surface"}
            </Button>
            {onOpenSource ? (
              <Button onClick={onOpenSource} size="sm" type="button" variant="outline">
                <BookOpen className="size-4" />
                Open source
              </Button>
            ) : null}
          </div>
        </header>

        <div className="recall-lab__health" aria-label="Recall Health summary">
          {[
            ["Due today", health.dueCards],
            ["Weak", health.weakCards],
            ["Mastered", health.masteredCards],
            ["Source gaps", health.sourceGaps],
            ["From notes", health.cardsFromNotes],
            ["From highlights", health.cardsFromHighlights],
          ].map(([label, value]) => (
            <div className="recall-lab__metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        {message ? <div className="recall-lab__message" role="status">{message}</div> : null}

        <div className="recall-lab__grid">
          <aside className="recall-lab__rail" aria-label="Source deck selector">
            <div className="recall-lab__section-heading">
              <span>Source deck</span>
              <Badge variant="outline">{cards.length} cards</Badge>
            </div>
            <button className="recall-lab__deck-card" type="button">
              <strong>{lesson.title}</strong>
              <span>{binder.title}</span>
              <small>{acceptedCards.filter((card) => isRecallCardDue(card)).length} due now</small>
            </button>
            {lessons.length > 1 ? (
              <div className="recall-lab__lesson-list">
                {lessons.slice(0, 5).map((candidate) => (
                  <span aria-current={candidate.id === lesson.id ? "true" : undefined} key={candidate.id}>
                    {candidate.title}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="recall-lab__section-heading">
              <span>Due queue</span>
              <Badge variant="secondary">{dueQueue.length}</Badge>
            </div>
            <div className="recall-lab__queue">
              {dueQueue.slice(0, 8).map((card) => (
                <button
                  aria-current={card.id === activeCard?.id ? "true" : undefined}
                  key={card.id}
                  onClick={() => setActiveCardId(card.id)}
                  type="button"
                >
                  <strong>{card.front || "Untitled card"}</strong>
                  <small>{cardDisplayStatus(card)}</small>
                </button>
              ))}
              {!dueQueue.length ? <p>No due cards yet. Accept a draft to start the queue.</p> : null}
            </div>
          </aside>

          <main className="recall-lab__practice" aria-label="Practice surface">
            <div className="recall-lab__mode-strip">
              {practiceModes.map((mode) => (
                <button
                  aria-pressed={practiceMode === mode}
                  key={mode}
                  onClick={() => {
                    setPracticeMode(mode);
                    if (mode === "Checkpoint") createCheckpoint();
                  }}
                  type="button"
                >
                  {mode}
                </button>
              ))}
            </div>

            {!cards.length ? (
              <EmptyState
                description="No recall cards yet. Turn this lesson's highlights, notes, or source passages into cards."
                title="No recall cards yet"
              />
            ) : (
              <CurrentRecallCard
                activeCard={activeCard}
                acceptedCards={acceptedCards}
                clozeAnswer={clozeAnswer}
                onClozeAnswerChange={setClozeAnswer}
                onRate={rateCard}
                onRecordMiss={recordMiss}
                onSaveTeachBack={saveTeachBack}
                onShowBackChange={setShowBack}
                onTypedAnswerChange={setTypedAnswer}
                onUpdateMissNote={setMissNote}
                onUpdateMissReason={setMissReason}
                onUpdateTeachBack={setTeachBack}
                practiceMode={practiceMode}
                showBack={showBack}
                teachBack={teachBack}
                typedAnswer={typedAnswer}
                missNote={missNote}
                missReason={missReason}
              />
            )}

            <section className="recall-lab__editor" aria-label="Card editor">
              <div className="recall-lab__section-heading">
                <span>Create card panel</span>
                <Badge variant="secondary">Draft-reviewed</Badge>
              </div>
              <div className="recall-lab__form-grid">
                <label>
                  Front
                  <Input
                    value={manualForm.front}
                    onChange={(event) => setManualForm((current) => ({ ...current, front: event.target.value }))}
                    placeholder="Question or prompt"
                  />
                </label>
                <label>
                  Back
                  <Input
                    value={manualForm.back}
                    onChange={(event) => setManualForm((current) => ({ ...current, back: event.target.value }))}
                    placeholder="Answer or explanation"
                  />
                </label>
                <label>
                  Card type
                  <select
                    value={manualForm.cardType}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        cardType: event.target.value as RecallCardType,
                      }))
                    }
                  >
                    {visibleCardTypes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tags
                  <Input
                    value={manualForm.tags}
                    onChange={(event) => setManualForm((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="comma, separated, tags"
                  />
                </label>
              </div>
              <label>
                Explanation
                <Textarea
                  value={manualForm.explanation}
                  onChange={(event) =>
                    setManualForm((current) => ({ ...current, explanation: event.target.value }))
                  }
                  placeholder="Optional detail in your own words"
                />
              </label>
              <label>
                Why it matters
                <Textarea
                  value={manualForm.whyItMatters}
                  onChange={(event) =>
                    setManualForm((current) => ({ ...current, whyItMatters: event.target.value }))
                  }
                  placeholder="Optional memory hook or source connection"
                />
              </label>
              <div className="recall-lab__button-row">
                <Button onClick={createManualDraft} size="sm" type="button">
                  <ClipboardList className="size-4" />
                  Create manual draft
                </Button>
              </div>
            </section>
          </main>

          <aside className="recall-lab__context" aria-label="Source context and draft review">
            <section className="recall-lab__source-builder">
              <div className="recall-lab__section-heading">
                <span>Source-linked drafts</span>
                <Badge variant="outline">{draftCards.length} waiting</Badge>
              </div>
              <label>
                Selected source text
                <Textarea
                  value={selectedText}
                  onChange={(event) => setSelectedText(event.target.value)}
                  placeholder="Paste selected lesson text here, then shape the card yourself."
                />
              </label>
              <Button onClick={createSelectedTextDraft} size="sm" type="button" variant="outline">
                <Link2 className="size-4" />
                Create from selected text
              </Button>

              <label>
                Highlight
                <select
                  value={selectedHighlightId}
                  onChange={(event) => setSelectedHighlightId(event.target.value)}
                >
                  <option value="">First available highlight</option>
                  {highlights.map((highlight) => (
                    <option key={highlight.id} value={highlight.id}>
                      {(highlight.selected_text ?? highlight.anchor_text).slice(0, 72)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="recall-lab__button-row">
                <Button onClick={createHighlightDraft} size="sm" type="button" variant="outline">
                  Create from highlights
                </Button>
                <Button onClick={createStickyDraft} size="sm" type="button" variant="outline">
                  Create from sticky notes
                </Button>
              </div>
              <label>
                Note excerpt
                <Textarea
                  value={selectedNoteExcerpt}
                  onChange={(event) => setSelectedNoteExcerpt(event.target.value)}
                  placeholder={noteText ? noteText.slice(0, 140) : "Choose a note excerpt to turn into a draft."}
                />
              </label>
              <Button onClick={createNoteDraft} size="sm" type="button" variant="outline">
                Create from private notes
              </Button>
            </section>

            <section className="recall-lab__drafts">
              <div className="recall-lab__section-heading">
                <span>Draft review queue</span>
                <Badge variant="secondary">Review required</Badge>
              </div>
              {draftCards.length ? (
                draftCards.slice(0, 8).map((card) => (
                  <DraftReviewCard
                    card={card}
                    key={card.id}
                    onAccept={() => acceptDraft(card)}
                    onEdit={(patch) => editCard(card, patch)}
                    onReject={() => setCardStatus(card, "Wrong")}
                    onStatus={(status) => setCardStatus(card, status)}
                  />
                ))
              ) : (
                <p className="recall-lab__quiet">Drafts appear here before final cards are saved.</p>
              )}
            </section>

            <section className="recall-lab__source-context">
              <div className="recall-lab__section-heading">
                <span>Source context</span>
                <Badge variant="outline">{activeCard ? sourceLabel(activeCard.sourceType) : "none"}</Badge>
              </div>
              {activeCard?.sourceExcerpt ? (
                <blockquote>{activeCard.sourceExcerpt}</blockquote>
              ) : (
                <p className="recall-lab__quiet">No source excerpt attached to the current card.</p>
              )}
              {activeCard?.tags.length ? (
                <div className="recall-lab__tags">
                  {activeCard.tags.map((tag) => (
                    <Badge key={`${activeCard.id}-${tag}`} variant="secondary">
                      <Tags className="size-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </section>
    </WorkspacePanel>
  );
}

function CurrentRecallCard({
  acceptedCards,
  activeCard,
  clozeAnswer,
  missNote,
  missReason,
  onClozeAnswerChange,
  onRate,
  onRecordMiss,
  onSaveTeachBack,
  onShowBackChange,
  onTypedAnswerChange,
  onUpdateMissNote,
  onUpdateMissReason,
  onUpdateTeachBack,
  practiceMode,
  showBack,
  teachBack,
  typedAnswer,
}: {
  acceptedCards: RecallCard[];
  activeCard: RecallCard | null;
  clozeAnswer: string;
  missNote: string;
  missReason: RecallMissReason;
  onClozeAnswerChange: (value: string) => void;
  onRate: (rating: RecallReviewRating) => void;
  onRecordMiss: () => void;
  onSaveTeachBack: () => void;
  onShowBackChange: (value: boolean) => void;
  onTypedAnswerChange: (value: string) => void;
  onUpdateMissNote: (value: string) => void;
  onUpdateMissReason: (value: RecallMissReason) => void;
  onUpdateTeachBack: (value: string) => void;
  practiceMode: RecallPracticeMode;
  showBack: boolean;
  teachBack: string;
  typedAnswer: string;
}) {
  if (!activeCard || activeCard.draftStatus !== "accepted") {
    return (
      <div className="recall-lab__current-card" aria-label="Current card">
        <EmptyState
          description="Accept a reviewed draft before starting practice."
          title="No final cards ready"
        />
      </div>
    );
  }

  const answerIsCorrect = compareRecallAnswer(typedAnswer, activeCard.back);
  const clozeIsCorrect = compareRecallAnswer(clozeAnswer, activeCard.back);
  const otherChoices = acceptedCards
    .filter((card) => card.id !== activeCard.id && card.back.trim())
    .map((card) => card.back)
    .slice(0, 3);
  const multipleChoiceOptions = [activeCard.back, ...otherChoices];

  return (
    <section className="recall-lab__current-card" aria-label="Current card">
      <div className="recall-lab__card-topline">
        <Badge variant="secondary">{activeCard.cardType.replace(/_/g, " ")}</Badge>
        <Badge variant={isRecallCardDue(activeCard) ? "default" : "outline"}>
          {isRecallCardDue(activeCard) ? "Due today" : "Next due later"}
        </Badge>
      </div>
      <h3>{activeCard.front || "Untitled recall card"}</h3>

      {practiceMode === "Flip" || practiceMode === "Guided Recall" ? (
        <>
          {showBack ? (
            <div className="recall-lab__answer">
              <strong>Back</strong>
              <p>{activeCard.back}</p>
              {activeCard.explanation ? <small>{activeCard.explanation}</small> : null}
            </div>
          ) : (
            <p className="recall-lab__quiet">Try recalling the answer, then reveal it.</p>
          )}
          <Button onClick={() => onShowBackChange(!showBack)} type="button" variant="outline">
            <RotateCcw className="size-4" />
            {showBack ? "Hide answer" : "Reveal answer"}
          </Button>
        </>
      ) : null}

      {practiceMode === "Type answer" ? (
        <div className="recall-lab__practice-block">
          <label>
            Your answer
            <Input value={typedAnswer} onChange={(event) => onTypedAnswerChange(event.target.value)} />
          </label>
          <p data-answer-match={answerIsCorrect ? "true" : "false"}>
            {typedAnswer ? (answerIsCorrect ? "Looks close. You decide if it counts." : "Not a close match yet.") : "Type your answer to compare."}
          </p>
          <div className="recall-lab__button-row">
            <Button onClick={() => onRate("Good")} size="sm" type="button" variant="outline">
              Mark correct
            </Button>
            <Button onClick={() => onRate("Again")} size="sm" type="button" variant="outline">
              Mark missed
            </Button>
          </div>
        </div>
      ) : null}

      {practiceMode === "Cloze" ? (
        <div className="recall-lab__practice-block">
          <p>{activeCard.front.includes("{{") ? activeCard.front.replace(/\{\{.*?\}\}/g, "_____") : `${activeCard.front} _____`}</p>
          <label>
            Fill the blank
            <Input value={clozeAnswer} onChange={(event) => onClozeAnswerChange(event.target.value)} />
          </label>
          <p data-answer-match={clozeIsCorrect ? "true" : "false"}>
            {clozeAnswer ? (clozeIsCorrect ? "Close match." : "Keep checking your source.") : "Write the hidden term or idea."}
          </p>
        </div>
      ) : null}

      {practiceMode === "Multiple choice" ? (
        <div className="recall-lab__practice-block">
          {multipleChoiceOptions.length < 4 ? (
            <p>Add more cards to use this mode.</p>
          ) : (
            multipleChoiceOptions.map((choice) => (
              <button key={choice} onClick={() => onRate(choice === activeCard.back ? "Good" : "Again")} type="button">
                {choice}
              </button>
            ))
          )}
        </div>
      ) : null}

      {practiceMode === "Pair Builder" ? (
        <div className="recall-lab__practice-block">
          {acceptedCards.length < 4 ? (
            <p>Add more cards to use Pair Builder.</p>
          ) : (
            <p>Pair Builder is ready with {Math.min(acceptedCards.length, 8)} source-linked pairs.</p>
          )}
        </div>
      ) : null}

      {practiceMode === "Teach-back" ? (
        <div className="recall-lab__practice-block">
          <label>
            Explain it in your own words
            <Textarea value={teachBack} onChange={(event) => onUpdateTeachBack(event.target.value)} />
          </label>
          <Button onClick={onSaveTeachBack} size="sm" type="button">
            Save teach-back
          </Button>
        </div>
      ) : null}

      {practiceMode === "Mistake review" ? (
        <div className="recall-lab__practice-block">
          <label>
            Why did you miss this?
            <select
              value={missReason}
              onChange={(event) => onUpdateMissReason(event.target.value as RecallMissReason)}
            >
              {missReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
          <label>
            Short note
            <Textarea value={missNote} onChange={(event) => onUpdateMissNote(event.target.value)} />
          </label>
          <Button onClick={onRecordMiss} size="sm" type="button">
            Record miss
          </Button>
        </div>
      ) : null}

      {practiceMode === "Checkpoint" ? (
        <div className="recall-lab__practice-block">
          <p>Checkpoint uses the current due queue and mixes available card formats.</p>
        </div>
      ) : null}

      <div className="recall-lab__ratings" aria-label="Review ratings">
        {(["Again", "Hard", "Good", "Easy"] as RecallReviewRating[]).map((rating) => (
          <button key={rating} onClick={() => onRate(rating)} type="button">
            {rating}
          </button>
        ))}
      </div>
    </section>
  );
}

function DraftReviewCard({
  card,
  onAccept,
  onEdit,
  onReject,
  onStatus,
}: {
  card: RecallCard;
  onAccept: () => void;
  onEdit: (patch: Partial<RecallCard>) => void;
  onReject: () => void;
  onStatus: (status: RecallCardStatus) => void;
}) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [explanation, setExplanation] = useState(card.explanation ?? "");

  useEffect(() => {
    setFront(card.front);
    setBack(card.back);
    setExplanation(card.explanation ?? "");
  }, [card.id, card.front, card.back, card.explanation]);

  return (
    <article className="recall-lab__draft-card">
      <div>
        <Badge variant="outline">{sourceLabel(card.sourceType)}</Badge>
        <Badge variant="secondary">Draft card</Badge>
      </div>
      <label>
        Front
        <Input value={front} onChange={(event) => setFront(event.target.value)} onBlur={() => onEdit({ front })} />
      </label>
      <label>
        Back
        <Input value={back} onChange={(event) => setBack(event.target.value)} onBlur={() => onEdit({ back })} />
      </label>
      <label>
        Explanation
        <Textarea
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          onBlur={() => onEdit({ explanation })}
        />
      </label>
      <div className="recall-lab__button-row">
        <Button onClick={onAccept} size="sm" type="button">
          <Check className="size-4" />
          Save final card
        </Button>
        <Button onClick={() => onStatus("Duplicate")} size="sm" type="button" variant="outline">
          Mark duplicate
        </Button>
        <Button onClick={() => onStatus("Too vague")} size="sm" type="button" variant="outline">
          Too vague
        </Button>
        <Button onClick={onReject} size="sm" type="button" variant="outline">
          <X className="size-4" />
          Reject
        </Button>
      </div>
      {card.sourceExcerpt ? <blockquote>{card.sourceExcerpt}</blockquote> : null}
    </article>
  );
}

export function RecallHealthBadge({ cards }: { cards: RecallCard[] }) {
  const health = summarizeRecallHealth(cards);
  if (!cards.length) {
    return <Badge variant="outline">No recall cards</Badge>;
  }

  if (health.dueCards > 0) {
    return (
      <Badge variant="default">
        <Sparkles className="size-3" />
        {health.dueCards} due
      </Badge>
    );
  }

  if (health.masteredCards > 0) {
    return (
      <Badge variant="secondary">
        <BadgeCheck className="size-3" />
        Recall ready
      </Badge>
    );
  }

  return <Badge variant="secondary">{cards.length} recall cards</Badge>;
}
