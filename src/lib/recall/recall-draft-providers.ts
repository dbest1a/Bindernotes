import type {
  RecallCardDraft,
  RecallCardType,
  RecallCreatedVia,
  RecallDraftContext,
  RecallDraftInput,
  RecallDraftProvider,
  RecallSourceSeed,
  RecallSourceType,
} from "@/lib/recall/recall-types";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function trimExcerpt(value: string | undefined | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 500);
}

export function createRecallDraftCard({
  context,
  createdVia,
  input,
  source,
  sourceType,
}: {
  context: RecallDraftContext;
  createdVia: RecallCreatedVia;
  input: RecallDraftInput;
  source?: RecallSourceSeed;
  sourceType: RecallSourceType;
}): RecallCardDraft {
  const createdAt = nowIso();
  const sourceExcerpt = trimExcerpt(source?.text ?? input.text);
  const tags = Array.from(new Set([...(context.tags ?? []), ...(source?.tags ?? []), ...(input.tags ?? [])]))
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    id: createId("recall-card"),
    userId: context.userId ?? null,
    binderId: context.binderId,
    documentId: context.documentId,
    lessonId: context.lessonId,
    sourceType,
    sourceId: source?.id ?? null,
    sourceExcerpt,
    sourceAnchor: source?.anchor ?? null,
    front: input.front?.trim() || defaultFrontForSource(sourceType),
    back: input.back?.trim() || "",
    explanation: input.explanation?.trim() ?? "",
    whyItMatters: input.whyItMatters?.trim() ?? "",
    tags,
    subject: context.subject ?? null,
    cardType: input.cardType ?? defaultCardTypeForSource(sourceType),
    status: "Draft",
    difficulty: "new",
    confidence: 0,
    lastReviewedAt: null,
    nextReviewAt: createdAt,
    reviewCount: 0,
    lapseCount: 0,
    createdVia,
    draftStatus: "needs_review",
    qualityStatus: "good",
    missReasons: [],
    teachBackReflections: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function defaultFrontForSource(sourceType: RecallSourceType) {
  switch (sourceType) {
    case "highlight":
      return "What should this highlighted source help you remember?";
    case "note":
      return "What question should this note answer?";
    case "sticky":
      return "What should this sticky note remind you to recall?";
    case "math_tool":
      return "What does this math work show?";
    case "chemistry_observation":
      return "What chemistry idea does this observation support?";
    case "history_evidence":
      return "What claim does this evidence support?";
    case "selected_text":
      return "What should this source passage help you remember?";
    case "manual":
      return "";
  }
}

function defaultCardTypeForSource(sourceType: RecallSourceType): RecallCardType {
  switch (sourceType) {
    case "math_tool":
      return "formula_meaning";
    case "chemistry_observation":
      return "lab_observation";
    case "history_evidence":
      return "evidence_claim";
    case "highlight":
    case "selected_text":
      return "source_evidence";
    case "note":
    case "sticky":
    case "manual":
      return "basic_qa";
  }
}

const commonCapabilities: RecallDraftProvider["capabilities"] = [
  "supportsDrafts",
  "supportsSourceLinks",
  "requiresUserReview",
];

export const manualCardProvider: RecallDraftProvider = {
  id: "manualCardProvider",
  label: "Manual card",
  capabilities: ["supportsDrafts", "requiresUserReview"],
  createDrafts: (input, context) => [
    createRecallDraftCard({
      context,
      createdVia: "manual",
      input,
      sourceType: "manual",
    }),
  ],
};

export const selectedTextDraftProvider: RecallDraftProvider = {
  id: "selectedTextDraftProvider",
  label: "Selected text draft",
  capabilities: commonCapabilities,
  createDrafts: (input, context) => {
    const text = trimExcerpt(input.text ?? input.source?.text);
    return text
      ? [
          createRecallDraftCard({
            context,
            createdVia: "selected_text",
            input: { ...input, text },
            source: { ...input.source, text, sourceType: "selected_text" },
            sourceType: "selected_text",
          }),
        ]
      : [];
  },
};

function sourceListProvider({
  createdVia,
  input,
  context,
  sourceType,
}: {
  createdVia: RecallCreatedVia;
  input: RecallDraftInput;
  context: RecallDraftContext;
  sourceType: RecallSourceType;
}) {
  const sources = input.sources?.length ? input.sources : input.source ? [input.source] : [];

  return sources
    .map((source) => ({ ...source, text: trimExcerpt(source.text), sourceType, createdVia }))
    .filter((source) => source.text)
    .map((source) =>
      createRecallDraftCard({
        context,
        createdVia,
        input: { ...input, text: source.text },
        source,
        sourceType,
      }),
    );
}

export const highlightDraftProvider: RecallDraftProvider = {
  id: "highlightDraftProvider",
  label: "Highlight draft",
  capabilities: [...commonCapabilities, "supportsBatchCreate"],
  createDrafts: (input, context) =>
    sourceListProvider({ createdVia: "highlight", input, context, sourceType: "highlight" }),
};

export const noteDraftProvider: RecallDraftProvider = {
  id: "noteDraftProvider",
  label: "Note draft",
  capabilities: commonCapabilities,
  createDrafts: (input, context) =>
    sourceListProvider({ createdVia: "note", input, context, sourceType: "note" }),
};

export const stickyDraftProvider: RecallDraftProvider = {
  id: "stickyDraftProvider",
  label: "Sticky draft",
  capabilities: commonCapabilities,
  createDrafts: (input, context) =>
    sourceListProvider({ createdVia: "sticky", input, context, sourceType: "sticky" }),
};

export const subjectToolDraftProvider: RecallDraftProvider = {
  id: "subjectToolDraftProvider",
  label: "Subject tool draft",
  capabilities: [...commonCapabilities, "supportsBatchCreate"],
  createDrafts: (input, context) => {
    const sourceType = input.source?.sourceType ?? input.sources?.[0]?.sourceType ?? "math_tool";
    const createdVia = input.source?.createdVia ?? input.sources?.[0]?.createdVia ?? sourceType;
    return sourceListProvider({ createdVia, input, context, sourceType });
  },
};

export const recallDraftProviderRegistry = {
  manualCardProvider,
  selectedTextDraftProvider,
  highlightDraftProvider,
  noteDraftProvider,
  stickyDraftProvider,
  subjectToolDraftProvider,
} satisfies Record<RecallDraftProvider["id"], RecallDraftProvider>;

export const deterministicRecallDraftProviders = Object.values(recallDraftProviderRegistry);

export function getRecallDraftProvider(providerId: RecallDraftProvider["id"]) {
  return recallDraftProviderRegistry[providerId];
}

export function createDraftsFromProvider(
  providerId: RecallDraftProvider["id"],
  input: RecallDraftInput,
  context: RecallDraftContext,
) {
  return getRecallDraftProvider(providerId).createDrafts(input, context);
}
