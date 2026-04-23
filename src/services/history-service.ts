import { supabase } from "@/lib/supabase";
import {
  buildSystemFolderFromSuite,
  frenchRevolutionBinder,
  frenchRevolutionEventTemplates,
  frenchRevolutionLessons,
  frenchRevolutionMythCheckTemplates,
  frenchRevolutionSourceTemplates,
  SYSTEM_BINDER_IDS,
  systemSuiteTemplates,
} from "@/lib/history-suite-seeds";
import {
  createHealthySeedHealth,
  createLegacySeedHealth,
  createMissingSeedError,
  findSystemSuiteByBinderId,
  isMissingSeedError,
  strictSeedHealthMode,
} from "@/lib/seed-health";
import type {
  Binder,
  BinderLesson,
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
  HistorySuiteData,
  Profile,
  SeedHealth,
  SuiteTemplate,
} from "@/types";

const HISTORY_LOCAL_STORAGE_KEY = "binder-notes:history-suite-state:v1";

type LocalHistoryState = {
  events: HistoryEvent[];
  sources: HistorySource[];
  evidenceCards: HistoryEvidenceCard[];
  argumentChains: HistoryArgumentChain[];
  argumentNodes: HistoryArgumentNode[];
  argumentEdges: HistoryArgumentEdge[];
  mythChecks: HistoryMythCheck[];
};

const now = () => new Date().toISOString();

export async function getSeedHealthForBinder(binder: Binder): Promise<SeedHealth | null> {
  const fallbackSuite = resolveSuiteTemplateForBinder(binder);
  if (!fallbackSuite) {
    return null;
  }

  if (!supabase) {
    return createHealthySeedHealth(fallbackSuite);
  }

  const legacySeedHealth = await getLegacySeedHealthForBinder(binder, fallbackSuite);

  const { data: suiteData, error: suiteError } = await supabase
    .from("suite_templates")
    .select("*")
    .eq("id", fallbackSuite.id)
    .maybeSingle();

  if (suiteError) {
    if (legacySeedHealth && isMissingBackendSeedSchemaError(suiteError)) {
      return legacySeedHealth;
    }
    throw suiteError;
  }

  if (!suiteData) {
    if (legacySeedHealth) {
      return legacySeedHealth;
    }

    if (strictSeedHealthMode) {
      throw createMissingSeedError(binder.id);
    }

    return getMissingSeedHealth(binder.id);
  }

  const { data: seedData, error: seedError } = await supabase
    .from("seed_versions")
    .select("*")
    .eq("suite_template_id", fallbackSuite.id)
    .eq("status", "current")
    .order("seeded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seedError) {
    if (legacySeedHealth && isMissingBackendSeedSchemaError(seedError)) {
      return legacySeedHealth;
    }
    throw seedError;
  }

  return {
    ...createHealthySeedHealth(suiteData as SuiteTemplate),
    actualVersion: (seedData?.version as string | null | undefined) ?? null,
  };
}

export async function getHistorySuiteData(input: {
  binder: Binder;
  lessons: BinderLesson[];
  profile: Profile | null;
}): Promise<HistorySuiteData> {
  const suite = resolveSuiteTemplateForBinder(input.binder);
  if (!suite) {
    return createEmptyHistorySuiteData(null, null);
  }

  if (!supabase) {
    return buildLocalHistorySuiteData({
      binder: input.binder,
      profile: input.profile,
      suite,
      seedHealth: createHealthySeedHealth(suite),
    });
  }

  const legacySeedHealth = await getLegacySeedHealthForBinder(input.binder, suite);

  const { data: suiteData, error: suiteError } = await supabase
    .from("suite_templates")
    .select("*")
    .eq("id", suite.id)
    .maybeSingle();

  if (suiteError) {
    if (legacySeedHealth && isMissingBackendSeedSchemaError(suiteError)) {
      return buildLocalHistorySuiteData({
        binder: input.binder,
        profile: input.profile,
        suite,
        seedHealth: legacySeedHealth,
      });
    }
    throw suiteError;
  }

  if (!suiteData) {
    if (legacySeedHealth) {
      return buildLocalHistorySuiteData({
        binder: input.binder,
        profile: input.profile,
        suite,
        seedHealth: legacySeedHealth,
      });
    }

    if (strictSeedHealthMode) {
      throw createMissingSeedError(input.binder.id);
    }

    return buildLocalHistorySuiteData({
      binder: input.binder,
      profile: input.profile,
      suite,
      seedHealth: getMissingSeedHealth(input.binder.id),
    });
  }

  const [seedVersionResult, templateEventsResult, templateSourcesResult, templateMythsResult] =
    await Promise.all([
      supabase
        .from("seed_versions")
        .select("*")
        .eq("suite_template_id", suite.id)
        .eq("status", "current")
        .order("seeded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("history_event_templates")
        .select("*")
        .eq("binder_id", input.binder.id)
        .order("sort_year", { ascending: true })
        .order("sort_month", { ascending: true })
        .order("sort_day", { ascending: true }),
      supabase
        .from("history_source_templates")
        .select("*")
        .eq("binder_id", input.binder.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("history_myth_check_templates")
        .select("*")
        .eq("binder_id", input.binder.id)
        .order("created_at", { ascending: true }),
    ]);

  const templateError =
    seedVersionResult.error ||
    templateEventsResult.error ||
    templateSourcesResult.error ||
    templateMythsResult.error;

  if (templateError) {
    if (legacySeedHealth && isMissingBackendSeedSchemaError(templateError)) {
      return buildLocalHistorySuiteData({
        binder: input.binder,
        profile: input.profile,
        suite,
        seedHealth: legacySeedHealth,
      });
    }
    throw templateError;
  }

  if (!input.profile) {
    return {
      ...createEmptyHistorySuiteData(
        suiteData as SuiteTemplate,
        {
          ...createHealthySeedHealth(suiteData as SuiteTemplate),
          actualVersion: (seedVersionResult.data?.version as string | null | undefined) ?? null,
        },
      ),
      templateEvents: (templateEventsResult.data ?? []) as HistoryEventTemplate[],
      templateSources: (templateSourcesResult.data ?? []) as HistorySourceTemplate[],
      templateMythChecks: (templateMythsResult.data ?? []) as HistoryMythCheckTemplate[],
    };
  }

  const [eventsResult, sourcesResult, evidenceCardsResult, argumentChainsResult, argumentNodesResult, argumentEdgesResult, mythChecksResult] =
    await Promise.all([
      supabase
        .from("history_events")
        .select("*")
        .eq("owner_id", input.profile.id)
        .eq("binder_id", input.binder.id)
        .order("sort_year", { ascending: true })
        .order("sort_month", { ascending: true })
        .order("sort_day", { ascending: true }),
      supabase
        .from("history_sources")
        .select("*")
        .eq("owner_id", input.profile.id)
        .eq("binder_id", input.binder.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("history_evidence_cards")
        .select("*")
        .eq("owner_id", input.profile.id)
        .eq("binder_id", input.binder.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("history_argument_chains")
        .select("*")
        .eq("owner_id", input.profile.id)
        .eq("binder_id", input.binder.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("history_argument_nodes")
        .select("*")
        .eq("owner_id", input.profile.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("history_argument_edges")
        .select("*")
        .eq("owner_id", input.profile.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("history_myth_checks")
        .select("*")
        .eq("owner_id", input.profile.id)
        .eq("binder_id", input.binder.id)
        .order("updated_at", { ascending: false }),
    ]);

  const userError =
    eventsResult.error ||
    sourcesResult.error ||
    evidenceCardsResult.error ||
    argumentChainsResult.error ||
    argumentNodesResult.error ||
    argumentEdgesResult.error ||
    mythChecksResult.error;

  if (userError) {
    throw userError;
  }

  return {
    suite: suiteData as SuiteTemplate,
    seedHealth: {
      ...createHealthySeedHealth(suiteData as SuiteTemplate),
      actualVersion: (seedVersionResult.data?.version as string | null | undefined) ?? null,
    },
    templateEvents: (templateEventsResult.data ?? []) as HistoryEventTemplate[],
    templateSources: (templateSourcesResult.data ?? []) as HistorySourceTemplate[],
    templateMythChecks: (templateMythsResult.data ?? []) as HistoryMythCheckTemplate[],
    events: (eventsResult.data ?? []) as HistoryEvent[],
    sources: (sourcesResult.data ?? []) as HistorySource[],
    evidenceCards: (evidenceCardsResult.data ?? []) as HistoryEvidenceCard[],
    argumentChains: (argumentChainsResult.data ?? []) as HistoryArgumentChain[],
    argumentNodes: (argumentNodesResult.data ?? []) as HistoryArgumentNode[],
    argumentEdges: (argumentEdgesResult.data ?? []) as HistoryArgumentEdge[],
    mythChecks: (mythChecksResult.data ?? []) as HistoryMythCheck[],
  };
}

async function getLegacySeedHealthForBinder(
  binder: Binder,
  suite: SuiteTemplate,
): Promise<SeedHealth | null> {
  if (!supabase || !findSystemSuiteByBinderId(binder.id)) {
    return null;
  }

  const { count, error } = await supabase
    .from("binder_lessons")
    .select("id", { count: "exact", head: true })
    .eq("binder_id", binder.id);

  if (error || !count) {
    return null;
  }

  return createLegacySeedHealth(
    suite,
    `${suite.title} is available through legacy published binder rows in this environment.`,
  );
}

function isMissingBackendSeedSchemaError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    code?: string;
    message?: string;
  };
  const message = record.message?.toLowerCase() ?? "";

  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    record.code === "42703" ||
    record.code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("could not find the")
  );
}

export async function createHistoryEvent(
  profile: Profile,
  input: Omit<HistoryEvent, "id" | "owner_id" | "created_at" | "updated_at">,
) {
  const next: HistoryEvent = {
    id: crypto.randomUUID(),
    owner_id: profile.id,
    created_at: now(),
    updated_at: now(),
    ...input,
  };

  if (!supabase) {
    return upsertLocalHistoryEntity("events", next);
  }

  const { data, error } = await supabase.from("history_events").insert(next).select("*").single();
  if (error) {
    throw error;
  }
  return data as HistoryEvent;
}

export async function getHistoryEvents(profile: Profile, binderId: string) {
  if (!supabase) {
    return loadLocalHistoryState().events
      .filter((event) => event.owner_id === profile.id && event.binder_id === binderId)
      .sort((left, right) => {
        if (left.sort_year !== right.sort_year) {
          return left.sort_year - right.sort_year;
        }

        return (left.sort_month ?? 0) - (right.sort_month ?? 0);
      });
  }

  const { data, error } = await supabase
    .from("history_events")
    .select("*")
    .eq("owner_id", profile.id)
    .eq("binder_id", binderId)
    .order("sort_year", { ascending: true })
    .order("sort_month", { ascending: true })
    .order("sort_day", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as HistoryEvent[];
}

export async function updateHistoryEvent(
  profile: Profile,
  eventId: string,
  patch: Partial<Omit<HistoryEvent, "id" | "owner_id" | "created_at" | "updated_at">>,
) {
  if (!supabase) {
    return upsertLocalHistoryEntity("events", {
      ...(findLocalHistoryEntity("events", eventId, profile.id) as HistoryEvent),
      ...patch,
      updated_at: now(),
    });
  }

  const { data, error } = await supabase
    .from("history_events")
    .update({
      ...patch,
      updated_at: now(),
    })
    .eq("id", eventId)
    .eq("owner_id", profile.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data as HistoryEvent;
}

export async function createHistorySource(
  profile: Profile,
  input: Omit<HistorySource, "id" | "owner_id" | "created_at" | "updated_at">,
) {
  const next: HistorySource = {
    id: crypto.randomUUID(),
    owner_id: profile.id,
    created_at: now(),
    updated_at: now(),
    ...input,
  };

  if (!supabase) {
    return upsertLocalHistoryEntity("sources", next);
  }

  const { data, error } = await supabase.from("history_sources").insert(next).select("*").single();
  if (error) {
    throw error;
  }
  return data as HistorySource;
}

export async function getHistorySources(profile: Profile, binderId: string) {
  if (!supabase) {
    return loadLocalHistoryState().sources.filter(
      (source) => source.owner_id === profile.id && source.binder_id === binderId,
    );
  }

  const { data, error } = await supabase
    .from("history_sources")
    .select("*")
    .eq("owner_id", profile.id)
    .eq("binder_id", binderId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as HistorySource[];
}

export async function updateHistorySource(
  profile: Profile,
  sourceId: string,
  patch: Partial<Omit<HistorySource, "id" | "owner_id" | "created_at" | "updated_at">>,
) {
  if (!supabase) {
    return upsertLocalHistoryEntity("sources", {
      ...(findLocalHistoryEntity("sources", sourceId, profile.id) as HistorySource),
      ...patch,
      updated_at: now(),
    });
  }

  const { data, error } = await supabase
    .from("history_sources")
    .update({
      ...patch,
      updated_at: now(),
    })
    .eq("id", sourceId)
    .eq("owner_id", profile.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as HistorySource;
}

export async function upsertEvidenceCard(
  profile: Profile,
  input: Partial<HistoryEvidenceCard> &
    Pick<HistoryEvidenceCard, "binder_id" | "evidence_strength">,
) {
  const next: HistoryEvidenceCard = {
    id: input.id ?? crypto.randomUUID(),
    owner_id: profile.id,
    binder_id: input.binder_id,
    lesson_id: input.lesson_id ?? null,
    source_id: input.source_id ?? null,
    highlight_id: input.highlight_id ?? null,
    quote_text: input.quote_text ?? null,
    paraphrase: input.paraphrase ?? null,
    claim_supports: input.claim_supports ?? null,
    claim_challenges: input.claim_challenges ?? null,
    evidence_strength: input.evidence_strength,
    source_snapshot_json: input.source_snapshot_json ?? null,
    created_at: input.created_at ?? now(),
    updated_at: now(),
  };

  if (!supabase) {
    return upsertLocalHistoryEntity("evidenceCards", next);
  }

  const { data, error } = await supabase
    .from("history_evidence_cards")
    .upsert(next, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data as HistoryEvidenceCard;
}

export async function getArgumentChains(profile: Profile, binderId: string) {
  if (!supabase) {
    return loadLocalHistoryState().argumentChains.filter(
      (chain) => chain.owner_id === profile.id && chain.binder_id === binderId,
    );
  }

  const { data, error } = await supabase
    .from("history_argument_chains")
    .select("*")
    .eq("owner_id", profile.id)
    .eq("binder_id", binderId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as HistoryArgumentChain[];
}

export async function createArgumentChain(
  profile: Profile,
  input: Omit<HistoryArgumentChain, "id" | "owner_id" | "created_at" | "updated_at">,
) {
  const next: HistoryArgumentChain = {
    id: crypto.randomUUID(),
    owner_id: profile.id,
    created_at: now(),
    updated_at: now(),
    ...input,
  };

  if (!supabase) {
    return upsertLocalHistoryEntity("argumentChains", next);
  }

  const { data, error } = await supabase
    .from("history_argument_chains")
    .insert(next)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data as HistoryArgumentChain;
}

export async function updateArgumentChain(
  profile: Profile,
  chainId: string,
  patch: Partial<
    Omit<HistoryArgumentChain, "id" | "owner_id" | "binder_id" | "lesson_id" | "created_at" | "updated_at">
  >,
) {
  if (!supabase) {
    return upsertLocalHistoryEntity("argumentChains", {
      ...(findLocalHistoryEntity("argumentChains", chainId, profile.id) as HistoryArgumentChain),
      ...patch,
      updated_at: now(),
    });
  }

  const { data, error } = await supabase
    .from("history_argument_chains")
    .update({
      ...patch,
      updated_at: now(),
    })
    .eq("id", chainId)
    .eq("owner_id", profile.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as HistoryArgumentChain;
}

export async function createArgumentNode(
  profile: Profile,
  input: Omit<HistoryArgumentNode, "id" | "owner_id" | "created_at" | "updated_at">,
) {
  const next: HistoryArgumentNode = {
    id: crypto.randomUUID(),
    owner_id: profile.id,
    created_at: now(),
    updated_at: now(),
    ...input,
  };

  if (!supabase) {
    return upsertLocalHistoryEntity("argumentNodes", next);
  }

  const { data, error } = await supabase
    .from("history_argument_nodes")
    .insert(next)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data as HistoryArgumentNode;
}

export async function createArgumentEdge(
  profile: Profile,
  input: Omit<HistoryArgumentEdge, "id" | "owner_id" | "created_at" | "updated_at">,
) {
  const next: HistoryArgumentEdge = {
    id: crypto.randomUUID(),
    owner_id: profile.id,
    created_at: now(),
    updated_at: now(),
    ...input,
  };

  if (!supabase) {
    return upsertLocalHistoryEntity("argumentEdges", next);
  }

  const { data, error } = await supabase
    .from("history_argument_edges")
    .insert(next)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data as HistoryArgumentEdge;
}

export async function getMythChecks(profile: Profile, binderId: string) {
  if (!supabase) {
    return loadLocalHistoryState().mythChecks.filter(
      (item) => item.owner_id === profile.id && item.binder_id === binderId,
    );
  }

  const { data, error } = await supabase
    .from("history_myth_checks")
    .select("*")
    .eq("owner_id", profile.id)
    .eq("binder_id", binderId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as HistoryMythCheck[];
}

export async function getSeedHealth(binder: Binder) {
  return getSeedHealthForBinder(binder);
}

export async function upsertMythCheck(
  profile: Profile,
  input: Partial<HistoryMythCheck> &
    Pick<HistoryMythCheck, "binder_id" | "myth_text" | "corrected_claim" | "status" | "explanation">,
) {
  const next: HistoryMythCheck = {
    id: input.id ?? crypto.randomUUID(),
    owner_id: profile.id,
    binder_id: input.binder_id,
    lesson_id: input.lesson_id ?? null,
    template_myth_check_id: input.template_myth_check_id ?? null,
    myth_text: input.myth_text,
    corrected_claim: input.corrected_claim,
    status: input.status,
    explanation: input.explanation,
    created_at: input.created_at ?? now(),
    updated_at: now(),
  };

  if (!supabase) {
    return upsertLocalHistoryEntity("mythChecks", next);
  }

  const { data, error } = await supabase
    .from("history_myth_checks")
    .upsert(next, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data as HistoryMythCheck;
}

function resolveSuiteTemplateForBinder(binder: Binder) {
  if (binder.suite_template_id) {
    return systemSuiteTemplates.find((candidate) => candidate.id === binder.suite_template_id) ?? null;
  }

  return findSystemSuiteByBinderId(binder.id);
}

function createEmptyHistorySuiteData(
  suite: SuiteTemplate | null,
  seedHealth: SeedHealth | null,
): HistorySuiteData {
  return {
    suite,
    seedHealth,
    templateEvents: [],
    templateSources: [],
    templateMythChecks: [],
    events: [],
    sources: [],
    evidenceCards: [],
    argumentChains: [],
    argumentNodes: [],
    argumentEdges: [],
    mythChecks: [],
  };
}

function buildLocalHistorySuiteData(input: {
  binder: Binder;
  profile: Profile | null;
  suite: SuiteTemplate;
  seedHealth: SeedHealth;
}) {
  const local = loadLocalHistoryState();
  const localEvents = input.profile
    ? local.events.filter((event) => event.owner_id === input.profile!.id && event.binder_id === input.binder.id)
    : [];
  const localSources = input.profile
    ? local.sources.filter((source) => source.owner_id === input.profile!.id && source.binder_id === input.binder.id)
    : [];
  const localEvidence = input.profile
    ? local.evidenceCards.filter((card) => card.owner_id === input.profile!.id && card.binder_id === input.binder.id)
    : [];
  const localChains = input.profile
    ? local.argumentChains.filter((chain) => chain.owner_id === input.profile!.id && chain.binder_id === input.binder.id)
    : [];
  const localNodes = input.profile
    ? local.argumentNodes.filter((node) => node.owner_id === input.profile!.id)
    : [];
  const localEdges = input.profile
    ? local.argumentEdges.filter((edge) => edge.owner_id === input.profile!.id)
    : [];
  const localMyths = input.profile
    ? local.mythChecks.filter((item) => item.owner_id === input.profile!.id && item.binder_id === input.binder.id)
    : [];

  if (input.binder.id === SYSTEM_BINDER_IDS.frenchRevolution) {
    return {
      suite: input.suite,
      seedHealth: input.seedHealth,
      templateEvents: frenchRevolutionEventTemplates,
      templateSources: frenchRevolutionSourceTemplates,
      templateMythChecks: frenchRevolutionMythCheckTemplates,
      events: localEvents,
      sources: localSources,
      evidenceCards: localEvidence,
      argumentChains: localChains,
      argumentNodes: localNodes,
      argumentEdges: localEdges,
      mythChecks: localMyths,
    };
  }

  return {
    suite: input.suite,
    seedHealth: input.seedHealth,
    templateEvents: [],
    templateSources: [],
    templateMythChecks: [],
    events: localEvents,
    sources: localSources,
    evidenceCards: localEvidence,
    argumentChains: localChains,
    argumentNodes: localNodes,
    argumentEdges: localEdges,
    mythChecks: localMyths,
  };
}

function getMissingSeedHealth(binderId: string) {
  const error = createMissingSeedError(binderId);
  if (isMissingSeedError(error)) {
    return error.seedHealth;
  }

  return {
    suiteTemplateId: `missing:${binderId}`,
    suiteSlug: `missing-${binderId}`,
    suiteTitle: "Missing system seed",
    status: "missing" as const,
    expectedVersion: "unknown",
    actualVersion: null,
    message: error.message,
    missingBinders: [binderId],
  };
}

function createEmptyLocalHistoryState(): LocalHistoryState {
  return {
    events: [],
    sources: [],
    evidenceCards: [],
    argumentChains: [],
    argumentNodes: [],
    argumentEdges: [],
    mythChecks: [],
  };
}

function loadLocalHistoryState(): LocalHistoryState {
  if (typeof window === "undefined") {
    return createEmptyLocalHistoryState();
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_LOCAL_STORAGE_KEY);
    if (!raw) {
      return createEmptyLocalHistoryState();
    }

    const parsed = JSON.parse(raw) as Partial<LocalHistoryState>;
    return {
      events: (parsed.events ?? []) as HistoryEvent[],
      sources: (parsed.sources ?? []) as HistorySource[],
      evidenceCards: (parsed.evidenceCards ?? []) as HistoryEvidenceCard[],
      argumentChains: (parsed.argumentChains ?? []) as HistoryArgumentChain[],
      argumentNodes: (parsed.argumentNodes ?? []) as HistoryArgumentNode[],
      argumentEdges: (parsed.argumentEdges ?? []) as HistoryArgumentEdge[],
      mythChecks: (parsed.mythChecks ?? []) as HistoryMythCheck[],
    };
  } catch {
    return createEmptyLocalHistoryState();
  }
}

function saveLocalHistoryState(state: LocalHistoryState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(HISTORY_LOCAL_STORAGE_KEY, JSON.stringify(state));
}

function upsertLocalHistoryEntity<
  T extends { id: string; owner_id: string; updated_at?: string; created_at?: string },
  K extends keyof LocalHistoryState,
>(
  key: K,
  entity: T,
) {
  const state = loadLocalHistoryState();
  const collection = [...((state[key] as unknown) as T[])];
  const index = collection.findIndex((item) => item.id === entity.id && item.owner_id === entity.owner_id);
  if (index >= 0) {
    collection[index] = {
      ...collection[index],
      ...entity,
    };
  } else {
    collection.unshift(entity);
  }

  state[key] = (collection as unknown) as LocalHistoryState[K];
  saveLocalHistoryState(state);
  return index >= 0 ? collection[index] : entity;
}

function findLocalHistoryEntity<K extends keyof LocalHistoryState>(
  key: K,
  id: string,
  ownerId: string,
) {
  return (loadLocalHistoryState()[key] as Array<{ id: string; owner_id: string }>).find(
    (item) => item.id === id && item.owner_id === ownerId,
  );
}

export const localHistorySuiteSeed = {
  suite: systemSuiteTemplates.find((suite) => suite.id === frenchRevolutionBinder.suite_template_id)!,
  folder: buildSystemFolderFromSuite(
    systemSuiteTemplates.find((suite) => suite.id === frenchRevolutionBinder.suite_template_id)!,
  ),
  binder: frenchRevolutionBinder,
  lessons: frenchRevolutionLessons,
  templateEvents: frenchRevolutionEventTemplates,
  templateSources: frenchRevolutionSourceTemplates,
  templateMythChecks: frenchRevolutionMythCheckTemplates,
};
