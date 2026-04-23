import type { JSONContent } from "@tiptap/react";
import { supabase } from "@/lib/supabase";
import {
  demoBinders,
  demoComments,
  demoConceptEdges,
  demoConceptNodes,
  demoDashboard,
  demoFolderBinders,
  demoFolders,
  demoHighlights,
  demoLessons,
  demoNotes,
} from "@/lib/demo-data";
import {
  buildSystemFolderFromSuite,
  SYSTEM_BINDER_IDS,
  SYSTEM_SUITE_IDS,
  systemSuiteTemplates,
} from "@/lib/history-suite-seeds";
import { getSeedHealthForBinder, localHistorySuiteSeed } from "@/services/history-service";
import { ensureWorkspacePresetDefinitionsLoaded } from "@/services/workspace-preset-service";
import {
  buildHighlightSelector,
  mergeStoredHighlightMetadata,
  persistHighlightMetadata,
  removeStoredHighlightMetadata,
  removeStoredHighlightMetadataByScope,
} from "@/lib/highlights";
import {
  createHealthySeedHealth,
  createMissingSeedError,
  findSystemSuiteByBinderId,
  isMissingSeedError,
  isSystemBinderId,
  strictSeedHealthMode,
} from "@/lib/seed-health";
import {
  buildSeedHealthFromCounts,
  buildWorkspaceDiagnostics,
  classifyCountCheck,
  classifyQueryError,
  classifyRuntimeError,
  createEnvironmentMismatchDiagnostic,
} from "@/lib/workspace-diagnostics";
import {
  createDefaultWorkspacePreferences,
  loadWorkspacePreferences,
  normalizeWorkspacePreferences,
  saveGlobalThemeSettings,
  saveWorkspacePreferences,
} from "@/lib/workspace-preferences";
import { deriveLessonTitle, filterVisibleWorkspaceData } from "@/lib/workspace-records";
import type {
  Binder,
  BinderOverviewData,
  BinderBundle,
  BinderLesson,
  Comment,
  ConceptEdge,
  ConceptNode,
  DashboardData,
  Folder,
  FolderBinderLink,
  FolderWorkspaceData,
  Highlight,
  HighlightColor,
  LearnerNote,
  MathBlock,
  Profile,
  SeedHealth,
  SuiteTemplate,
  UpsertBinderInput,
  UpsertLessonInput,
  WorkspaceDiagnostic,
  WorkspacePreferences,
} from "@/types";
import { emptyDoc, slugify } from "@/lib/utils";

const now = () => new Date().toISOString();
const DASHBOARD_BINDER_SELECT = [
  "id",
  "owner_id",
  "title",
  "slug",
  "description",
  "subject",
  "level",
  "status",
  "price_cents",
  "cover_url",
  "pinned",
  "created_at",
  "updated_at",
].join(", ");
const DEMO_DATA_STORAGE_KEY = "binder-notes:demo-data:v1";
const DEMO_HIGHLIGHT_RESET_MARKER_KEY = "binder-notes:demo-highlight-reset:v1";
const SHADOW_DATA_STORAGE_KEY = "binder-notes:shadow-content:v1";
const BUNDLED_CONTENT_STATUS_STORAGE_KEY = "binder-notes:bundled-content-status:v1";
const DEMO_RESET_LESSON_IDS = new Set([
  "lesson-algebra-like-terms",
  "lesson-algebra-polynomials",
  "lesson-algebra-factoring",
  "lesson-algebra-quadratics",
  "lesson-algebra-functions",
  "lesson-algebra-lines",
  "lesson-algebra-inequalities",
  "lesson-algebra-systems",
  "lesson-algebra-vocab",
  "lesson-limits",
]);

type DemoState = {
  notes: LearnerNote[];
  comments: Comment[];
  highlights: Highlight[];
};

type ShadowState = {
  notes: LearnerNote[];
  comments: Comment[];
  highlights: Highlight[];
  workspacePreferences: WorkspacePreferences[];
};

type BundledContentStorageMode = "remote" | "shadow";

type BundledContentStatus = Record<
  string,
  {
    checkedAt: string;
    mode: BundledContentStorageMode;
  }
>;

type WorkspacePreferencesRecord = {
  preferences: WorkspacePreferences | null;
};

function createBootstrapProfile(userId: string, email: string): Profile {
  return {
    id: userId,
    email,
    full_name: email.split("@")[0] ?? "Learner",
    role: "learner",
    created_at: now(),
    updated_at: now(),
  };
}

function getLocalBundledFolders() {
  return [...demoFolders, localHistorySuiteSeed.folder];
}

function getLocalBundledFolderLinks(): FolderBinderLink[] {
  return [
    ...demoFolderBinders,
    {
      id: `folder-link:${localHistorySuiteSeed.folder.id}:${localHistorySuiteSeed.binder.id}`,
      owner_id: localHistorySuiteSeed.folder.owner_id,
      folder_id: localHistorySuiteSeed.folder.id,
      binder_id: localHistorySuiteSeed.binder.id,
      created_at: localHistorySuiteSeed.folder.created_at,
      updated_at: localHistorySuiteSeed.folder.updated_at,
    },
  ];
}

function getLocalBundledLessons() {
  return [...demoLessons, ...localHistorySuiteSeed.lessons];
}

function getLocalBundledBinders() {
  return [...demoBinders, localHistorySuiteSeed.binder];
}

function buildSyntheticSystemFolderArtifacts(
  binders: Binder[],
  viewerId?: string,
): {
  folders: Folder[];
  folderLinks: FolderBinderLink[];
} {
  const foldersById = new Map<string, Folder>();
  const folderLinks: FolderBinderLink[] = [];

  binders.forEach((binder) => {
    const suite =
      (binder.suite_template_id
        ? systemSuiteTemplates.find((candidate) => candidate.id === binder.suite_template_id) ?? null
        : null) ?? findSystemSuiteByBinderId(binder.id);
    if (!suite) {
      return;
    }

    const folder = foldersById.get(`folder-${suite.id}`) ?? buildSystemFolderFromSuite(suite);
    foldersById.set(folder.id, folder);
    folderLinks.push({
      id: `folder-link:${folder.id}:${binder.id}`,
      owner_id: viewerId ?? folder.owner_id,
      folder_id: folder.id,
      binder_id: binder.id,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
    });
  });

  return {
    folders: [...foldersById.values()],
    folderLinks,
  };
}

function mergeFolders(remoteFolders: Folder[], syntheticFolders: Folder[]) {
  const byId = new Map(remoteFolders.map((folder) => [folder.id, folder]));
  syntheticFolders.forEach((folder) => {
    if (!byId.has(folder.id)) {
      byId.set(folder.id, folder);
    }
  });
  return [...byId.values()];
}

function mergeFolderLinks(
  remoteLinks: FolderBinderLink[],
  syntheticLinks: FolderBinderLink[],
) {
  const byId = new Map<string, FolderBinderLink>();
  remoteLinks.forEach((link) => {
    byId.set(link.id, link);
  });
  syntheticLinks.forEach((link) => {
    const identity = `${link.folder_id}:${link.binder_id}`;
    const alreadyPresent = [...byId.values()].some(
      (candidate) => `${candidate.folder_id}:${candidate.binder_id}` === identity,
    );
    if (!alreadyPresent) {
      byId.set(link.id, link);
    }
  });
  return [...byId.values()];
}

function getDemoBinderById(binderId: string) {
  return getLocalBundledBinders().find((binder) => binder.id === binderId) ?? null;
}

function isBundledPublishedBinder(binderId: string) {
  return getDemoBinderById(binderId)?.status === "published";
}

function createBundledSeedError(binderId: string) {
  if (isSystemBinderId(binderId)) {
    return createMissingSeedError(binderId);
  }

  return new Error("This published binder is missing backend seed data in Supabase.");
}

function getBundledLessonIds(binderId: string) {
  return getLocalBundledLessons()
    .filter((lesson) => lesson.binder_id === binderId)
    .map((lesson) => lesson.id);
}

function getSystemSuiteByFolderId(folderId: string) {
  return (
    systemSuiteTemplates.find((suite) => buildSystemFolderFromSuite(suite).id === folderId) ?? null
  );
}

function getLocalSeedHealthForBinder(binder: Binder) {
  const suite = binder.suite_template_id
    ? systemSuiteTemplates.find((candidate) => candidate.id === binder.suite_template_id) ?? null
    : findSystemSuiteByBinderId(binder.id);

  return suite ? createHealthySeedHealth(suite) : null;
}

function getSystemBinderIdForSuite(suiteTemplateId: string) {
  switch (suiteTemplateId) {
    case SYSTEM_SUITE_IDS.algebra:
      return SYSTEM_BINDER_IDS.algebra;
    case SYSTEM_SUITE_IDS.riseOfRome:
      return SYSTEM_BINDER_IDS.riseOfRome;
    case SYSTEM_SUITE_IDS.historyDemo:
      return SYSTEM_BINDER_IDS.frenchRevolution;
    default:
      return null;
  }
}

function inferSuiteTemplateIdFromBinderId(binderId: string) {
  return findSystemSuiteByBinderId(binderId)?.id ?? null;
}

function normalizeDashboardBinder(binder: Binder): Binder {
  return {
    ...binder,
    suite_template_id: binder.suite_template_id ?? inferSuiteTemplateIdFromBinderId(binder.id),
  };
}

function debugWorkspaceQueryFailure(input: {
  table: string;
  select: string;
  filters: string[];
  error: unknown;
  userId?: string | null;
  workspaceId?: string | null;
  folderFilter?: string | null;
}) {
  if (!import.meta.env.DEV || !input.error || typeof console === "undefined") {
    return;
  }

  const record = input.error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };

  console.warn("[BinderNotes workspace query failed]", {
    table: input.table,
    select: input.select,
    filters: input.filters,
    userId: input.userId ?? null,
    workspaceId: input.workspaceId ?? null,
    folderFilter: input.folderFilter ?? null,
    error: {
      code: record?.code ?? null,
      message: record?.message ?? String(input.error),
      details: record?.details ?? null,
      hint: record?.hint ?? null,
    },
  });
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

async function ensureSeededWorkspacePresetsForBinder(
  binder: Pick<Binder, "id" | "suite_template_id"> | null,
) {
  if (!binder?.suite_template_id) {
    return;
  }

  await ensureWorkspacePresetDefinitionsLoaded({
    suiteTemplateId: binder.suite_template_id,
    binderId: binder.id,
  });
}

async function getDashboardStatus(
  binders: Binder[],
): Promise<{
  seedHealth: SeedHealth[];
  diagnostics: WorkspaceDiagnostic[];
}> {
  if (!supabase) {
    return {
      seedHealth: systemSuiteTemplates.map((suite) => createHealthySeedHealth(suite)),
      diagnostics: [],
    };
  }

  const suiteIds = systemSuiteTemplates.map((suite) => suite.id);
  const systemFolderIds = systemSuiteTemplates.map((suite) => buildSystemFolderFromSuite(suite).id);
  const [
    suitesResult,
    versionsResult,
    presetsResult,
    foldersResult,
    lessonsResult,
    suiteCountResult,
    versionCountResult,
    presetCountResult,
    binderCountResult,
    lessonCountResult,
  ] = await Promise.all([
    supabase.from("suite_templates").select("*").in("id", suiteIds),
    supabase
      .from("seed_versions")
      .select("suite_template_id, version")
      .eq("status", "current")
      .in("suite_template_id", suiteIds),
    supabase.from("workspace_presets").select("suite_template_id").in("suite_template_id", suiteIds),
    supabase.from("folders").select("id").in("id", systemFolderIds),
    binders.length > 0
      ? supabase.from("binder_lessons").select("id, binder_id").in("binder_id", binders.map((binder) => binder.id))
      : Promise.resolve({ data: [], error: null }),
    supabase.from("suite_templates").select("id", { count: "exact", head: true }).in("id", suiteIds),
    supabase
      .from("seed_versions")
      .select("id", { count: "exact", head: true })
      .eq("status", "current")
      .in("suite_template_id", suiteIds),
    supabase
      .from("workspace_presets")
      .select("id", { count: "exact", head: true })
      .in("suite_template_id", suiteIds),
    supabase
      .from("binders")
      .select("id", { count: "exact", head: true })
      .in("id", Object.values(SYSTEM_BINDER_IDS))
      .eq("status", "published"),
    supabase
      .from("binder_lessons")
      .select("id", { count: "exact", head: true })
      .in(
        "binder_id",
        Object.values(SYSTEM_BINDER_IDS),
      ),
  ]);

  [
    {
      table: "suite_templates",
      select: "*",
      filters: [`id in (${suiteIds.join(", ")})`],
      error: suitesResult.error,
    },
    {
      table: "seed_versions",
      select: "suite_template_id, version",
      filters: ["status = current", `suite_template_id in (${suiteIds.join(", ")})`],
      error: versionsResult.error,
    },
    {
      table: "workspace_presets",
      select: "suite_template_id",
      filters: [`suite_template_id in (${suiteIds.join(", ")})`],
      error: presetsResult.error,
    },
    {
      table: "folders",
      select: "id",
      filters: [`id in (${systemFolderIds.join(", ")})`],
      error: foldersResult.error,
    },
    {
      table: "binder_lessons",
      select: "id, binder_id",
      filters: binders.length > 0 ? [`binder_id in (${binders.map((binder) => binder.id).join(", ")})`] : ["no binder ids"],
      error: lessonsResult.error,
    },
    {
      table: "binders",
      select: "count(id)",
      filters: [`id in (${Object.values(SYSTEM_BINDER_IDS).join(", ")})`, "status = published"],
      error: binderCountResult.error,
    },
  ].forEach((query) => debugWorkspaceQueryFailure(query));

  const diagnostics = buildWorkspaceDiagnostics({
    suites: (suitesResult.data ?? []) as SuiteTemplate[],
    currentSeedVersions: (versionsResult.data ?? []) as Array<{
      suite_template_id: string;
      version: string;
    }>,
    workspacePresetRows: (presetsResult.data ?? []) as Array<{ suite_template_id: string }>,
    binders,
    folders: (foldersResult.data ?? []) as Array<{ id: string; suite_template_id?: string | null; source?: string | null }>,
    lessonsByBinderId: Object.fromEntries(
      ((lessonsResult.data ?? []) as Array<{ binder_id: string }>).reduce(
        (entries, lesson) => {
          entries.set(lesson.binder_id, (entries.get(lesson.binder_id) ?? 0) + 1);
          return entries;
        },
        new Map<string, number>(),
      ),
    ),
    queryChecks: [
      { scope: "suite_templates", error: suitesResult.error },
      { scope: "seed_versions", error: versionsResult.error },
      { scope: "workspace_presets", error: presetsResult.error },
      { scope: "folders", error: foldersResult.error },
      { scope: "binder_lessons", error: lessonsResult.error },
      { scope: "suite_templates(count)", error: suiteCountResult.error },
      { scope: "seed_versions(count)", error: versionCountResult.error },
      { scope: "workspace_presets(count)", error: presetCountResult.error },
      { scope: "binders(count)", error: binderCountResult.error },
      { scope: "binder_lessons(count)", error: lessonCountResult.error },
    ],
  });

  const countDiagnostics = [
    ...classifyCountCheck("suite_templates", {
      count: suiteCountResult.count ?? null,
      error: suiteCountResult.error,
    }),
    ...classifyCountCheck("seed_versions", {
      count: versionCountResult.count ?? null,
      error: versionCountResult.error,
    }),
    ...classifyCountCheck("workspace_presets", {
      count: presetCountResult.count ?? null,
      error: presetCountResult.error,
    }),
    ...classifyCountCheck("binders", {
      count: binderCountResult.count ?? null,
      error: binderCountResult.error,
    }),
    ...classifyCountCheck("binder_lessons", {
      count: lessonCountResult.count ?? null,
      error: lessonCountResult.error,
    }),
  ];

  const mergedDiagnostics = dedupeWorkspaceDiagnostics([...diagnostics, ...countDiagnostics]);
  if (
    (suiteCountResult.count ?? 0) === 0 &&
    (versionCountResult.count ?? 0) === 0 &&
    (presetCountResult.count ?? 0) === 0
  ) {
    mergedDiagnostics.push(createEnvironmentMismatchDiagnostic());
  }

  return {
    seedHealth: buildSeedHealthFromCounts({
      suites: (suitesResult.data ?? []) as SuiteTemplate[],
      currentSeedVersions: (versionsResult.data ?? []) as Array<{
        suite_template_id: string;
        version: string;
      }>,
      binders,
      lessonsByBinderId: Object.fromEntries(
        ((lessonsResult.data ?? []) as Array<{ binder_id: string }>).reduce(
          (entries, lesson) => {
            entries.set(lesson.binder_id, (entries.get(lesson.binder_id) ?? 0) + 1);
            return entries;
          },
          new Map<string, number>(),
        ),
      ),
      diagnostics: mergedDiagnostics,
      fallbackSeedHealth: systemSuiteTemplates.map((suite) => createHealthySeedHealth(suite)),
    }),
    diagnostics: mergedDiagnostics,
  };
}

async function getBinderSuiteTemplateId(binderId: string) {
  const fallbackSuite = findSystemSuiteByBinderId(binderId)?.id ?? null;
  if (!supabase) {
    return fallbackSuite;
  }

  const { data, error } = await supabase
    .from("binders")
    .select("id, suite_template_id")
    .eq("id", binderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    if (isSystemBinderId(binderId)) {
      throw createMissingSeedError(binderId);
    }
    return fallbackSuite;
  }

  return (data.suite_template_id as string | null | undefined) ?? fallbackSuite;
}

function determineBundledContentStorageMode(
  binderId: string,
  remoteBinder: Binder | null | undefined,
  remoteLessons: BinderLesson[],
): BundledContentStorageMode {
  if (!isBundledPublishedBinder(binderId)) {
    return "remote";
  }

  const expectedLessonIds = getBundledLessonIds(binderId);
  const remoteLessonIds = new Set(remoteLessons.map((lesson) => lesson.id));
  const hasFullMirror =
    Boolean(remoteBinder) && expectedLessonIds.every((lessonId) => remoteLessonIds.has(lessonId));

  return hasFullMirror ? "remote" : "shadow";
}

function loadBundledContentStatus(): BundledContentStatus {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(BUNDLED_CONTENT_STATUS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as BundledContentStatus;
  } catch {
    return {};
  }
}

function saveBundledContentStatus(status: BundledContentStatus) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(BUNDLED_CONTENT_STATUS_STORAGE_KEY, JSON.stringify(status));
}

function readBundledContentStorageMode(binderId: string): BundledContentStorageMode | null {
  return loadBundledContentStatus()[binderId]?.mode ?? null;
}

function recordBundledContentStorageMode(binderId: string, mode: BundledContentStorageMode) {
  if (!isBundledPublishedBinder(binderId)) {
    return;
  }

  const status = loadBundledContentStatus();
  status[binderId] = {
    checkedAt: now(),
    mode,
  };
  saveBundledContentStatus(status);
}

async function resolveBundledContentStorageMode(binderId: string): Promise<BundledContentStorageMode> {
  if (!supabase || !isBundledPublishedBinder(binderId)) {
    return "remote";
  }

  const cached = readBundledContentStorageMode(binderId);
  if (cached && (!strictSeedHealthMode || cached === "remote")) {
    return cached;
  }

  try {
    const [binderResult, lessonsResult] = await Promise.all([
      supabase.from("binders").select("*").eq("id", binderId).maybeSingle(),
      supabase.from("binder_lessons").select("*").eq("binder_id", binderId),
    ]);

    if (binderResult.error || lessonsResult.error) {
      if (strictSeedHealthMode) {
        throw createBundledSeedError(binderId);
      }
      recordBundledContentStorageMode(binderId, "shadow");
      return "shadow";
    }

    const mode = determineBundledContentStorageMode(
      binderId,
      (binderResult.data as Binder | null | undefined) ?? null,
      (lessonsResult.data ?? []) as BinderLesson[],
    );
    if (mode === "shadow") {
      if (strictSeedHealthMode) {
        throw createBundledSeedError(binderId);
      }

      if (isSystemBinderId(binderId)) {
        throw createMissingSeedError(binderId);
      }
    }
    recordBundledContentStorageMode(binderId, mode);
    return mode;
  } catch {
    if (strictSeedHealthMode || isSystemBinderId(binderId)) {
      throw createBundledSeedError(binderId);
    }
    recordBundledContentStorageMode(binderId, "shadow");
    return "shadow";
  }
}

function isSupabaseContentReferenceError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const code = record.code ?? "";
  const message = (record.message ?? "").toLowerCase();
  const details = (record.details ?? "").toLowerCase();
  const hint = (record.hint ?? "").toLowerCase();

  return (
    code === "23503" ||
    message.includes("foreign key") ||
    details.includes("foreign key") ||
    hint.includes("foreign key")
  );
}

function shouldUseShadowFallback(binderId: string, error: unknown) {
  if (!isBundledPublishedBinder(binderId) || !isSupabaseContentReferenceError(error)) {
    return false;
  }

  if (strictSeedHealthMode || isSystemBinderId(binderId)) {
    throw createBundledSeedError(binderId);
  }

  return true;
}

function isLegacyHighlightSchemaError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { message?: string };
  const message = record.message?.toLowerCase() ?? "";

  return [
    "start_offset",
    "end_offset",
    "document_id",
    "selected_text",
    "prefix_text",
    "suffix_text",
    "selector_json",
    "reanchor_confidence",
    "source_version_id",
    "status",
    "updated_at",
  ].some((token) => message.includes(token));
}

function buildLegacyHighlightInsertPayload(input: {
  ownerId: string;
  binderId: string;
  lessonId: string;
  anchorText: string;
  color: HighlightColor;
  startOffset?: number;
  endOffset?: number;
}) {
  return {
    owner_id: input.ownerId,
    binder_id: input.binderId,
    lesson_id: input.lessonId,
    anchor_text: input.anchorText,
    color: input.color,
    note_id: null,
    start_offset: input.startOffset ?? null,
    end_offset: input.endOffset ?? null,
  };
}

function buildLegacyHighlightInsertPayloadWithoutOffsets(input: {
  ownerId: string;
  binderId: string;
  lessonId: string;
  anchorText: string;
  color: HighlightColor;
}) {
  return {
    owner_id: input.ownerId,
    binder_id: input.binderId,
    lesson_id: input.lessonId,
    anchor_text: input.anchorText,
    color: input.color,
    note_id: null,
  };
}

function buildLegacyHighlightUpdatePayload(input: {
  anchorText: string;
  color: HighlightColor;
  startOffset?: number;
  endOffset?: number;
}) {
  return {
    anchor_text: input.anchorText,
    color: input.color,
    start_offset: input.startOffset ?? null,
    end_offset: input.endOffset ?? null,
  };
}

function buildLegacyHighlightUpdatePayloadWithoutOffsets(input: {
  anchorText: string;
  color: HighlightColor;
}) {
  return {
    anchor_text: input.anchorText,
    color: input.color,
  };
}

function mergePublishedDemoBinders(remoteBinders: Binder[]) {
  return [...remoteBinders].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return Number(right.pinned) - Number(left.pinned);
    }

    return Date.parse(right.updated_at) - Date.parse(left.updated_at);
  });
}

function mergeDemoLessons(remoteLessons: BinderLesson[], binderId?: string) {
  return remoteLessons
    .filter((lesson) => (binderId ? lesson.binder_id === binderId : true))
    .sort((left, right) => {
      if (left.binder_id !== right.binder_id) {
        return left.binder_id.localeCompare(right.binder_id);
      }

      return left.order_index - right.order_index;
    });
}

function mergeDemoConceptNodes(remoteNodes: ConceptNode[], binderId: string) {
  return remoteNodes.filter((node) => node.binder_id === binderId);
}

function mergeDemoConceptEdges(remoteEdges: ConceptEdge[], binderId: string) {
  return remoteEdges.filter((edge) => edge.binder_id === binderId);
}

export async function getProfile(userId: string, email: string): Promise<Profile> {
  if (!supabase) {
    return {
      ...createBootstrapProfile(userId, email),
      full_name: email.split("@")[0] ?? "Demo user",
      role: email.includes("admin") ? "admin" : "learner",
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as Profile;
  }

  const bootstrap = createBootstrapProfile(userId, email);
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: bootstrap.id,
        email: bootstrap.email,
        full_name: bootstrap.full_name,
        role: bootstrap.role,
        updated_at: now(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted as Profile;
}

export async function getDashboard(profile: Profile): Promise<DashboardData> {
  if (!supabase) {
    const demoState = loadDemoState();
    const lessons = getLocalBundledLessons();
    const visible = filterVisibleWorkspaceData({
      binders: getLocalBundledBinders(),
      folders: getLocalBundledFolders(),
      folderBinders: getLocalBundledFolderLinks(),
      lessons,
      notes: demoState.notes,
    });
    return {
      binders: visible.binders,
      folders: visible.folders,
      folderBinders: visible.folderBinders,
      notes: demoState.notes,
      lessons: visible.lessons,
      recentLessons: visible.lessons
        .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
        .slice(0, 6),
      seedHealth: systemSuiteTemplates.map((suite) => createHealthySeedHealth(suite)),
      diagnostics: [],
    };
  }

  const bindersQuery =
    profile.role === "admin"
      ? supabase.from("binders").select(DASHBOARD_BINDER_SELECT).order("updated_at", { ascending: false })
      : supabase
          .from("binders")
          .select(DASHBOARD_BINDER_SELECT)
          .eq("status", "published")
          .order("pinned", { ascending: false })
          .order("updated_at", { ascending: false });

  const [bindersResult, foldersResult, folderBindersResult, notesResult] = await Promise.all([
    bindersQuery,
    supabase.from("folders").select("*").order("updated_at", { ascending: false }),
    supabase.from("folder_binders").select("*"),
    supabase
      .from("learner_notes")
      .select("*")
      .eq("owner_id", profile.id)
      .order("updated_at", { ascending: false }),
  ]);

  debugWorkspaceQueryFailure({
    table: "binders",
    select: DASHBOARD_BINDER_SELECT,
    filters:
      profile.role === "admin"
        ? ["order updated_at desc"]
        : ["status = published", "order pinned desc", "order updated_at desc"],
    error: bindersResult.error,
    userId: profile.id,
  });
  debugWorkspaceQueryFailure({
    table: "folders",
    select: "*",
    filters: ["order updated_at desc"],
    error: foldersResult.error,
    userId: profile.id,
  });
  debugWorkspaceQueryFailure({
    table: "folder_binders",
    select: "*",
    filters: [],
    error: folderBindersResult.error,
    userId: profile.id,
  });
  debugWorkspaceQueryFailure({
    table: "learner_notes",
    select: "*",
    filters: [`owner_id = ${profile.id}`, "order updated_at desc"],
    error: notesResult.error,
    userId: profile.id,
  });

  const candidateBinders = mergePublishedDemoBinders(
    ((bindersResult.data ?? []) as unknown as Binder[]).map(normalizeDashboardBinder),
  ).filter((binder) => (profile.role === "admin" ? binder.status === "published" || binder.owner_id === profile.id : true));
  let status: { seedHealth: SeedHealth[]; diagnostics: WorkspaceDiagnostic[] };
  try {
    status = await getDashboardStatus(candidateBinders);
  } catch (error) {
    const diagnostics = dedupeWorkspaceDiagnostics(classifyRuntimeError("workspace", error));
    return {
      binders: candidateBinders,
      folders: [],
      folderBinders: [],
      notes: [],
      lessons: [],
      recentLessons: [],
      seedHealth: isMissingSeedError(error) ? [error.seedHealth] : [],
      diagnostics,
    };
  }

  const lessonsResult =
    candidateBinders.length > 0
      ? await supabase
          .from("binder_lessons")
          .select("*")
          .in(
            "binder_id",
            candidateBinders.map((binder) => binder.id),
          )
          .order("updated_at", { ascending: false })
      : { data: [], error: null };
  debugWorkspaceQueryFailure({
    table: "binder_lessons",
    select: "*",
    filters:
      candidateBinders.length > 0
        ? [`binder_id in (${candidateBinders.map((binder) => binder.id).join(", ")})`, "order updated_at desc"]
        : ["no binder ids"],
    error: lessonsResult.error,
    userId: profile.id,
  });
  const queryDiagnostics = [
    bindersResult.error ? classifyQueryError("binders", bindersResult.error) : null,
    foldersResult.error ? classifyQueryError("folders", foldersResult.error) : null,
    folderBindersResult.error ? classifyQueryError("folder_binders", folderBindersResult.error) : null,
    notesResult.error ? classifyQueryError("learner_notes", notesResult.error) : null,
    lessonsResult.error ? classifyQueryError("binder_lessons", lessonsResult.error) : null,
  ].filter(Boolean) as WorkspaceDiagnostic[];
  const diagnostics = dedupeWorkspaceDiagnostics([...(status.diagnostics ?? []), ...queryDiagnostics]);

  const shadowState = loadShadowState();
  const shadowNotes = shadowState.notes.filter((note) => note.owner_id === profile.id);
  const notes = notesResult.error
    ? shadowNotes
    : mergeShadowNotes((notesResult.data ?? []) as LearnerNote[], shadowNotes);
  const visible = filterVisibleWorkspaceData({
    binders: candidateBinders,
    folders: foldersResult.error ? [] : ((foldersResult.data ?? []) as Folder[]),
    folderBinders: folderBindersResult.error ? [] : ((folderBindersResult.data ?? []) as FolderBinderLink[]),
    lessons: lessonsResult.error ? [] : mergeDemoLessons((lessonsResult.data ?? []) as BinderLesson[]),
    notes,
  });
  const recentLessons = [...visible.lessons]
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
    .slice(0, 6);

  return {
    binders: visible.binders,
    folders: visible.folders,
    folderBinders: visible.folderBinders,
    notes,
    lessons: visible.lessons,
    recentLessons,
    seedHealth: status.seedHealth,
    diagnostics,
  };
}

function dedupeWorkspaceDiagnostics(diagnostics: WorkspaceDiagnostic[]) {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}:${diagnostic.scope}:${diagnostic.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function getBinderBundle(
  binderId: string,
  profile: Profile,
): Promise<BinderBundle> {
  if (!supabase) {
    const binders = getLocalBundledBinders();
    const binder = binders.find((item) => item.id === binderId) ?? binders[0];
    const folderLinks = getLocalBundledFolderLinks().filter((link) => link.binder_id === binder.id);
    const folderIds = folderLinks.map((link) => link.folder_id);
    const demoState = loadDemoState();
    return {
      binder,
      lessons: getLocalBundledLessons().filter((lesson) => lesson.binder_id === binder.id),
      notes: demoState.notes.filter((note) => note.binder_id === binder.id),
      comments: demoState.comments.filter((comment) => comment.binder_id === binder.id),
      highlights: mergeStoredHighlightMetadata(
        demoState.highlights.filter((highlight) => highlight.binder_id === binder.id),
      ),
      folders: getLocalBundledFolders().filter((folder) => folderIds.includes(folder.id)),
      folderLinks,
      conceptNodes: demoConceptNodes.filter((node) => node.binder_id === binder.id),
      conceptEdges: demoConceptEdges.filter((edge) => edge.binder_id === binder.id),
      seedHealth: getLocalSeedHealthForBinder(binder),
    };
  }

  const [
    binderResult,
    lessonsResult,
    notesResult,
    commentsResult,
    highlightsResult,
    folderLinksResult,
    conceptNodesResult,
    conceptEdgesResult,
  ] = await Promise.all([
    supabase.from("binders").select("*").eq("id", binderId).maybeSingle(),
    supabase
      .from("binder_lessons")
      .select("*")
      .eq("binder_id", binderId)
      .order("order_index", { ascending: true }),
    supabase
      .from("learner_notes")
      .select("*")
      .eq("binder_id", binderId)
      .eq("owner_id", profile.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("comments")
      .select("*")
      .eq("binder_id", binderId)
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("highlights")
      .select("*")
      .eq("binder_id", binderId)
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase.from("folder_binders").select("*").eq("binder_id", binderId),
    supabase.from("concept_nodes").select("*").eq("binder_id", binderId),
    supabase.from("concept_edges").select("*").eq("binder_id", binderId),
  ]);

  const error =
    lessonsResult.error ||
    notesResult.error ||
    commentsResult.error ||
    highlightsResult.error ||
    folderLinksResult.error ||
    conceptNodesResult.error ||
    conceptEdgesResult.error;

  if (error) {
    throw error;
  }

  const binder = binderResult.data as Binder | null;
  if (!binder) {
    if (isSystemBinderId(binderId)) {
      throw createMissingSeedError(binderId);
    }
    throw binderResult.error ?? new Error("Binder not found.");
  }
  await ensureSeededWorkspacePresetsForBinder(binder);

  const folderIds = (folderLinksResult.data ?? []).map((link) => link.folder_id);
  const foldersResult = folderIds.length
    ? await supabase.from("folders").select("*").in("id", folderIds)
    : { data: [], error: null };

  if (foldersResult.error) {
    throw foldersResult.error;
  }
  const storageMode = determineBundledContentStorageMode(
    binderId,
    (binderResult.data as Binder | null | undefined) ?? null,
    (lessonsResult.data ?? []) as BinderLesson[],
  );
  if (isSystemBinderId(binderId) && storageMode === "shadow") {
    throw createMissingSeedError(binderId);
  }
  recordBundledContentStorageMode(binderId, storageMode);

  const shadowState = profile ? getShadowBinderState(profile.id, binderId) : null;
  const seedHealth = await getSeedHealthForBinder(binder);

  return {
    binder,
    lessons: mergeDemoLessons((lessonsResult.data ?? []) as BinderLesson[], binderId),
    notes: mergeShadowNotes((notesResult.data ?? []) as LearnerNote[], shadowState?.notes ?? []),
    comments: mergeShadowComments(
      (commentsResult.data ?? []) as Comment[],
      shadowState?.comments ?? [],
    ),
    highlights: mergeShadowHighlights(
      mergeStoredHighlightMetadata((highlightsResult.data ?? []) as Highlight[]),
      shadowState?.highlights ?? [],
    ),
    folders: (foldersResult.data ?? []) as Folder[],
    folderLinks: (folderLinksResult.data ?? []) as FolderBinderLink[],
    conceptNodes: mergeDemoConceptNodes((conceptNodesResult.data ?? []) as ConceptNode[], binderId),
    conceptEdges: mergeDemoConceptEdges((conceptEdgesResult.data ?? []) as ConceptEdge[], binderId),
    seedHealth,
  };
}

export async function getFolderWorkspace(
  folderId: string,
  profile: Profile,
): Promise<FolderWorkspaceData> {
  if (!supabase) {
    const folders = getLocalBundledFolders();
    const folder = folders.find((item) => item.id === folderId) ?? folders[0];
    const folderBinders = getLocalBundledFolderLinks().filter((link) => link.folder_id === folder.id);
    const binderIds = folderBinders.map((link) => link.binder_id);
    const demoState = loadDemoState();

    return {
      folder,
      binders: getLocalBundledBinders().filter((binder) => binderIds.includes(binder.id)),
      folderBinders,
      notes: demoState.notes.filter((note) => note.folder_id === folder.id),
      lessons: getLocalBundledLessons().filter((lesson) => binderIds.includes(lesson.binder_id)),
      seedHealth: null,
    };
  }

  const systemSuite = getSystemSuiteByFolderId(folderId);
  const [folderResult, linksResult] = await Promise.all([
    supabase.from("folders").select("*").eq("id", folderId).maybeSingle(),
    supabase.from("folder_binders").select("*").eq("folder_id", folderId),
  ]);

  const initialError = folderResult.error || linksResult.error;
  if (initialError) {
    throw initialError;
  }

  if (!folderResult.data) {
    if (systemSuite) {
      throw createMissingSeedError(
        getSystemBinderIdForSuite(systemSuite.id) ?? localHistorySuiteSeed.binder.id,
      );
    }
    throw new Error("Folder not found.");
  }

  const binderIds = (linksResult.data ?? []).map((link) => link.binder_id);
  const [bindersResult, notesResult, lessonsResult] = await Promise.all([
    binderIds.length
      ? supabase.from("binders").select("*").in("id", binderIds).order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    binderIds.length
      ? supabase
          .from("learner_notes")
          .select("*")
          .eq("owner_id", profile.id)
          .in("binder_id", binderIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    binderIds.length
      ? supabase.from("binder_lessons").select("*").in("binder_id", binderIds).order("order_index", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const error = bindersResult.error || notesResult.error || lessonsResult.error;
  if (error) {
    throw error;
  }

  if (systemSuite && binderIds.length === 0) {
    throw createMissingSeedError(
      getSystemBinderIdForSuite(systemSuite.id) ?? localHistorySuiteSeed.binder.id,
    );
  }

  const binders = mergePublishedDemoBinders((bindersResult.data ?? []) as Binder[]).filter((binder) =>
    binderIds.includes(binder.id),
  );
  await Promise.all(binders.map((binder) => ensureSeededWorkspacePresetsForBinder(binder)));
  const lessons = mergeDemoLessons((lessonsResult.data ?? []) as BinderLesson[]).filter((lesson) =>
    binderIds.includes(lesson.binder_id),
  );
  const remoteLessons = (lessonsResult.data ?? []) as BinderLesson[];
  const remoteBindersById = new Map(((bindersResult.data ?? []) as Binder[]).map((binder) => [binder.id, binder]));
  for (const candidateBinderId of binderIds) {
    const storageMode = determineBundledContentStorageMode(
      candidateBinderId,
      remoteBindersById.get(candidateBinderId) ?? null,
      remoteLessons.filter((lesson) => lesson.binder_id === candidateBinderId),
    );
    if (isSystemBinderId(candidateBinderId) && storageMode === "shadow") {
      throw createMissingSeedError(candidateBinderId);
    }
    recordBundledContentStorageMode(candidateBinderId, storageMode);
  }
  const shadowState = loadShadowState();
  const shadowNotes = shadowState.notes.filter(
    (note) => note.owner_id === profile.id && binderIds.includes(note.binder_id),
  );

  return {
    folder: folderResult.data as Folder,
    binders,
    folderBinders: (linksResult.data ?? []) as FolderBinderLink[],
    notes: mergeShadowNotes((notesResult.data ?? []) as LearnerNote[], shadowNotes),
    lessons,
    seedHealth: binders[0] ? await getSeedHealthForBinder(binders[0]) : null,
  };
}

export async function getBinderOverview(
  binderId: string,
  profile: Profile,
): Promise<BinderOverviewData> {
  if (!supabase) {
    const binders = getLocalBundledBinders();
    const binder = binders.find((item) => item.id === binderId) ?? binders[0];
    const folderLinks = getLocalBundledFolderLinks().filter((link) => link.binder_id === binder.id);
    const folderIds = folderLinks.map((link) => link.folder_id);
    const demoState = loadDemoState();

    return {
      binder,
      lessons: getLocalBundledLessons().filter((lesson) => lesson.binder_id === binder.id),
      notes: demoState.notes.filter((note) => note.binder_id === binder.id),
      folderLinks,
      folders: getLocalBundledFolders().filter((folder) => folderIds.includes(folder.id)),
      seedHealth: getLocalSeedHealthForBinder(binder),
    };
  }

  const [binderResult, lessonsResult, notesResult, folderLinksResult] = await Promise.all([
    supabase.from("binders").select("*").eq("id", binderId).maybeSingle(),
    supabase.from("binder_lessons").select("*").eq("binder_id", binderId).order("order_index", { ascending: true }),
    supabase
      .from("learner_notes")
      .select("*")
      .eq("binder_id", binderId)
      .eq("owner_id", profile.id)
      .order("updated_at", { ascending: false }),
    supabase.from("folder_binders").select("*").eq("binder_id", binderId),
  ]);

  const initialError =
    lessonsResult.error || notesResult.error || folderLinksResult.error;
  if (initialError) {
    throw initialError;
  }

  const folderIds = (folderLinksResult.data ?? []).map((link) => link.folder_id);
  const foldersResult = folderIds.length
    ? await supabase.from("folders").select("*").in("id", folderIds)
    : { data: [], error: null };

  if (foldersResult.error) {
    throw foldersResult.error;
  }

  const binder = binderResult.data as Binder | null;
  if (!binder) {
    if (isSystemBinderId(binderId)) {
      throw createMissingSeedError(binderId);
    }
    throw binderResult.error ?? new Error("Binder not found.");
  }
  await ensureSeededWorkspacePresetsForBinder(binder);
  const storageMode = determineBundledContentStorageMode(
    binderId,
    (binderResult.data as Binder | null | undefined) ?? null,
    (lessonsResult.data ?? []) as BinderLesson[],
  );
  if (isSystemBinderId(binderId) && storageMode === "shadow") {
    throw createMissingSeedError(binderId);
  }
  recordBundledContentStorageMode(binderId, storageMode);

  const shadowState = profile ? getShadowBinderState(profile.id, binderId) : null;
  const seedHealth = await getSeedHealthForBinder(binder);

  return {
    binder,
    lessons: mergeDemoLessons((lessonsResult.data ?? []) as BinderLesson[], binderId),
    notes: mergeShadowNotes((notesResult.data ?? []) as LearnerNote[], shadowState?.notes ?? []),
    folderLinks: (folderLinksResult.data ?? []) as FolderBinderLink[],
    folders: (foldersResult.data ?? []) as Folder[],
    seedHealth,
  };
}

export async function upsertLearnerNote(input: {
  id?: string;
  ownerId: string;
  binderId: string;
  lessonId: string;
  folderId?: string | null;
  title: string;
  content: JSONContent;
  mathBlocks: MathBlock[];
}): Promise<LearnerNote> {
  const normalizedTitle = input.title.trim() || "Private lesson notes";
  const note: LearnerNote = {
    id: input.id ?? crypto.randomUUID(),
    owner_id: input.ownerId,
    binder_id: input.binderId,
    lesson_id: input.lessonId,
    folder_id: input.folderId ?? null,
    title: normalizedTitle,
    content: input.content,
    math_blocks: input.mathBlocks,
    pinned: false,
    created_at: now(),
    updated_at: now(),
  };

  if (!supabase) {
    const demoState = loadDemoState();
    const index = demoState.notes.findIndex(
      (item) =>
        item.id === note.id ||
        (item.owner_id === note.owner_id &&
          item.binder_id === note.binder_id &&
          item.lesson_id === note.lesson_id),
    );
    if (index >= 0) {
      demoState.notes[index] = {
        ...demoState.notes[index],
        ...note,
        id: demoState.notes[index].id,
      };
    } else {
      demoState.notes.unshift(note);
    }
    saveDemoState(demoState);
    return note;
  }

  if ((await resolveBundledContentStorageMode(input.binderId)) === "shadow") {
    return upsertShadowLearnerNote(note);
  }

  const { data, error } = await supabase
    .from("learner_notes")
    .upsert(
      {
        owner_id: input.ownerId,
        binder_id: input.binderId,
        lesson_id: input.lessonId,
        folder_id: input.folderId ?? null,
        title: normalizedTitle,
        content: input.content,
        math_blocks: input.mathBlocks,
        pinned: false,
        updated_at: now(),
      },
      { onConflict: "owner_id,lesson_id" },
    )
    .select("*")
    .single();

  if (error) {
    if (shouldUseShadowFallback(input.binderId, error)) {
      return upsertShadowLearnerNote(note);
    }
    throw error;
  }

  return data as LearnerNote;
}

export async function createHighlight(input: {
  ownerId: string;
  binderId: string;
  lessonId: string;
  anchorText: string;
  color: HighlightColor;
  startOffset?: number;
  endOffset?: number;
  selectedText?: string;
  prefixText?: string;
  suffixText?: string;
  blockId?: string | null;
}): Promise<Highlight> {
  const highlight = {
    owner_id: input.ownerId,
    binder_id: input.binderId,
    lesson_id: input.lessonId,
    document_id: input.lessonId,
    source_version_id: null,
    anchor_text: input.anchorText,
    selected_text: input.selectedText ?? input.anchorText,
    prefix_text: input.prefixText ?? null,
    suffix_text: input.suffixText ?? null,
    selector_json: buildHighlightSelector({
      text: input.selectedText ?? input.anchorText,
      startOffset: input.startOffset ?? 0,
      endOffset: input.endOffset ?? input.startOffset ?? 0,
      prefixText: input.prefixText,
      suffixText: input.suffixText,
      blockId: input.blockId ?? null,
    }),
    color: input.color,
    note_id: null,
    status: "active" as const,
    reanchor_confidence: 1,
    updated_at: now(),
  };
  const highlightWithOffsets = {
    ...highlight,
    start_offset: input.startOffset ?? null,
    end_offset: input.endOffset ?? null,
  };

  if (!supabase) {
    const demoState = loadDemoState();
    const saved = {
      id: crypto.randomUUID(),
      ...highlight,
      start_offset: input.startOffset ?? null,
      end_offset: input.endOffset ?? null,
      created_at: now(),
    };
    demoState.highlights.unshift(saved);
    saveDemoState(demoState);
    persistHighlightMetadata(saved);
    return saved;
  }

  if ((await resolveBundledContentStorageMode(input.binderId)) === "shadow") {
    const saved: Highlight = {
      id: crypto.randomUUID(),
      ...highlight,
      start_offset: input.startOffset ?? null,
      end_offset: input.endOffset ?? null,
      created_at: now(),
    };
    return upsertShadowHighlight(saved);
  }

  let data: unknown = null;
  let error: unknown = null;

  const attemptWithOffsets = await supabase
    .from("highlights")
    .insert(highlightWithOffsets)
    .select("*")
    .single();

  if (attemptWithOffsets.error) {
    if (!isLegacyHighlightSchemaError(attemptWithOffsets.error)) {
      if (shouldUseShadowFallback(input.binderId, attemptWithOffsets.error)) {
        const saved: Highlight = {
          id: crypto.randomUUID(),
          ...highlight,
          start_offset: input.startOffset ?? null,
          end_offset: input.endOffset ?? null,
          created_at: now(),
        };
        return upsertShadowHighlight(saved);
      }
      throw attemptWithOffsets.error;
    }

    const legacyAttemptWithOffsets = await supabase
      .from("highlights")
      .insert(
        buildLegacyHighlightInsertPayload({
          ownerId: input.ownerId,
          binderId: input.binderId,
          lessonId: input.lessonId,
          anchorText: input.anchorText,
          color: input.color,
          startOffset: input.startOffset,
          endOffset: input.endOffset,
        }),
      )
      .select("*")
      .single();

    if (legacyAttemptWithOffsets.error && isLegacyHighlightSchemaError(legacyAttemptWithOffsets.error)) {
      const legacyAttemptWithoutOffsets = await supabase
        .from("highlights")
        .insert(
          buildLegacyHighlightInsertPayloadWithoutOffsets({
            ownerId: input.ownerId,
            binderId: input.binderId,
            lessonId: input.lessonId,
            anchorText: input.anchorText,
            color: input.color,
          }),
        )
        .select("*")
        .single();

      data = legacyAttemptWithoutOffsets.data;
      error = legacyAttemptWithoutOffsets.error;
    } else {
      data = legacyAttemptWithOffsets.data;
      error = legacyAttemptWithOffsets.error;
    }
  } else {
    data = attemptWithOffsets.data;
    error = attemptWithOffsets.error;
  }

  if (error) {
    if (shouldUseShadowFallback(input.binderId, error)) {
      const saved: Highlight = {
        id: crypto.randomUUID(),
        ...highlight,
        start_offset: input.startOffset ?? null,
        end_offset: input.endOffset ?? null,
        created_at: now(),
      };
      return upsertShadowHighlight(saved);
    }
    throw error;
  }

  const saved = {
    ...(data as Highlight),
    start_offset: input.startOffset ?? null,
    end_offset: input.endOffset ?? null,
  };
  persistHighlightMetadata(saved);
  return saved;
}

export async function updateHighlight(input: {
  ownerId: string;
  highlightId: string;
  anchorText: string;
  color: HighlightColor;
  startOffset?: number;
  endOffset?: number;
  selectedText?: string;
  prefixText?: string;
  suffixText?: string;
  blockId?: string | null;
}): Promise<Highlight> {
  const patch = {
    anchor_text: input.anchorText,
    selected_text: input.selectedText ?? input.anchorText,
    prefix_text: input.prefixText ?? null,
    suffix_text: input.suffixText ?? null,
    selector_json: buildHighlightSelector({
      text: input.selectedText ?? input.anchorText,
      startOffset: input.startOffset ?? 0,
      endOffset: input.endOffset ?? input.startOffset ?? 0,
      prefixText: input.prefixText,
      suffixText: input.suffixText,
      blockId: input.blockId ?? null,
    }),
    color: input.color,
    start_offset: input.startOffset ?? null,
    end_offset: input.endOffset ?? null,
    status: "active" as const,
    reanchor_confidence: 1,
    updated_at: now(),
  };

  if (!supabase) {
    const demoState = loadDemoState();
    const index = demoState.highlights.findIndex(
      (highlight) => highlight.id === input.highlightId && highlight.owner_id === input.ownerId,
    );
    if (index < 0) {
      throw new Error("Highlight not found.");
    }

    const saved: Highlight = {
      ...demoState.highlights[index],
      ...patch,
    };
    demoState.highlights[index] = saved;
    saveDemoState(demoState);
    persistHighlightMetadata(saved);
    return saved;
  }

  const shadowState = loadShadowState();
  const shadowIndex = shadowState.highlights.findIndex(
    (highlight) => highlight.id === input.highlightId && highlight.owner_id === input.ownerId,
  );
  if (shadowIndex >= 0) {
    const saved: Highlight = {
      ...shadowState.highlights[shadowIndex],
      ...patch,
    };
    return upsertShadowHighlight(saved);
  }

  let data: unknown = null;
  let error: unknown = null;

  const attemptWithOffsets = await supabase
    .from("highlights")
    .update(patch)
    .eq("owner_id", input.ownerId)
    .eq("id", input.highlightId)
    .select("*")
    .single();

  if (attemptWithOffsets.error) {
    if (!isLegacyHighlightSchemaError(attemptWithOffsets.error)) {
      throw attemptWithOffsets.error;
    }

    const legacyAttemptWithOffsets = await supabase
      .from("highlights")
      .update(
        buildLegacyHighlightUpdatePayload({
          anchorText: input.anchorText,
          color: input.color,
          startOffset: input.startOffset,
          endOffset: input.endOffset,
        }),
      )
      .eq("owner_id", input.ownerId)
      .eq("id", input.highlightId)
      .select("*")
      .single();

    if (legacyAttemptWithOffsets.error && isLegacyHighlightSchemaError(legacyAttemptWithOffsets.error)) {
      const legacyAttemptWithoutOffsets = await supabase
        .from("highlights")
        .update(
          buildLegacyHighlightUpdatePayloadWithoutOffsets({
            anchorText: input.anchorText,
            color: input.color,
          }),
        )
        .eq("owner_id", input.ownerId)
        .eq("id", input.highlightId)
        .select("*")
        .single();

      data = legacyAttemptWithoutOffsets.data;
      error = legacyAttemptWithoutOffsets.error;
    } else {
      data = legacyAttemptWithOffsets.data;
      error = legacyAttemptWithOffsets.error;
    }
  } else {
    data = attemptWithOffsets.data;
    error = attemptWithOffsets.error;
  }

  if (error) {
    throw error;
  }

  const saved = {
    ...(data as Highlight),
    start_offset: input.startOffset ?? null,
    end_offset: input.endOffset ?? null,
  };
  persistHighlightMetadata(saved);
  return saved;
}

export async function deleteHighlight(input: {
  ownerId: string;
  highlightId: string;
}): Promise<void> {
  if (!supabase) {
    const demoState = loadDemoState();
    const index = demoState.highlights.findIndex(
      (highlight) => highlight.id === input.highlightId && highlight.owner_id === input.ownerId,
    );
    if (index >= 0) {
      demoState.highlights.splice(index, 1);
      saveDemoState(demoState);
    }
    removeStoredHighlightMetadata(input.highlightId);
    return;
  }

  const shadowState = loadShadowState();
  const shadowExists = shadowState.highlights.some(
    (highlight) => highlight.id === input.highlightId && highlight.owner_id === input.ownerId,
  );
  if (shadowExists) {
    deleteShadowHighlight(input.ownerId, input.highlightId);
    return;
  }

  const { error } = await supabase
    .from("highlights")
    .delete()
    .eq("owner_id", input.ownerId)
    .eq("id", input.highlightId);

  if (error) {
    throw error;
  }

  removeStoredHighlightMetadata(input.highlightId);
}

export async function resetHighlights(input: {
  ownerId: string;
  binderId: string;
  lessonId?: string;
}): Promise<void> {
  if (!supabase) {
    const demoState = loadDemoState();
    demoState.highlights = demoState.highlights.filter((highlight) => {
      if (highlight.owner_id !== input.ownerId || highlight.binder_id !== input.binderId) {
        return true;
      }

      return input.lessonId ? highlight.lesson_id !== input.lessonId : false;
    });
    saveDemoState(demoState);
    removeStoredHighlightMetadataByScope({
      binderId: input.binderId,
      lessonId: input.lessonId,
    });
    return;
  }

  const shadowState = loadShadowState();
  const shadowExists = shadowState.highlights.some(
    (highlight) =>
      highlight.owner_id === input.ownerId &&
      highlight.binder_id === input.binderId &&
      (!input.lessonId || highlight.lesson_id === input.lessonId),
  );
  if (shadowExists) {
    resetShadowHighlights(input.ownerId, input.binderId, input.lessonId);
    return;
  }

  let query = supabase
    .from("highlights")
    .delete()
    .eq("owner_id", input.ownerId)
    .eq("binder_id", input.binderId);

  if (input.lessonId) {
    query = query.eq("lesson_id", input.lessonId);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }

  removeStoredHighlightMetadataByScope({
    binderId: input.binderId,
    lessonId: input.lessonId,
  });
}

export async function createComment(input: {
  ownerId: string;
  binderId: string;
  lessonId: string;
  body: string;
  anchorText?: string | null;
}): Promise<Comment> {
  const comment = {
    owner_id: input.ownerId,
    binder_id: input.binderId,
    lesson_id: input.lessonId,
    body: input.body,
    anchor_text: input.anchorText ?? null,
    parent_id: null,
  };

  if (!supabase) {
    const demoState = loadDemoState();
    const saved = {
      id: crypto.randomUUID(),
      ...comment,
      resolved_at: null,
      created_at: now(),
      updated_at: now(),
    };
    demoState.comments.unshift(saved);
    saveDemoState(demoState);
    return saved;
  }

  if ((await resolveBundledContentStorageMode(input.binderId)) === "shadow") {
    return createShadowComment({
      id: crypto.randomUUID(),
      ...comment,
      resolved_at: null,
      created_at: now(),
      updated_at: now(),
    });
  }

  const { data, error } = await supabase
    .from("comments")
    .insert(comment)
    .select("*")
    .single();

  if (error) {
    if (shouldUseShadowFallback(input.binderId, error)) {
      return createShadowComment({
        id: crypto.randomUUID(),
        ...comment,
        resolved_at: null,
        created_at: now(),
        updated_at: now(),
      });
    }
    throw error;
  }

  return data as Comment;
}

export async function updateComment(input: {
  commentId: string;
  ownerId: string;
  body: string;
}): Promise<Comment> {
  if (!supabase) {
    const demoState = loadDemoState();
    const index = demoState.comments.findIndex(
      (comment) => comment.id === input.commentId && comment.owner_id === input.ownerId,
    );
    if (index < 0) {
      throw new Error("Comment not found.");
    }

    demoState.comments[index] = {
      ...demoState.comments[index],
      body: input.body,
      updated_at: now(),
    };
    saveDemoState(demoState);
    return demoState.comments[index];
  }

  const shadowState = loadShadowState();
  const shadowIndex = shadowState.comments.findIndex(
    (comment) => comment.id === input.commentId && comment.owner_id === input.ownerId,
  );
  if (shadowIndex >= 0) {
    return updateShadowComment(input.commentId, input.ownerId, input.body);
  }

  const { data, error } = await supabase
    .from("comments")
    .update({
      body: input.body,
      updated_at: now(),
    })
    .eq("id", input.commentId)
    .eq("owner_id", input.ownerId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Comment;
}

export async function deleteComment(input: {
  commentId: string;
  ownerId: string;
}) {
  if (!supabase) {
    const demoState = loadDemoState();
    const index = demoState.comments.findIndex(
      (comment) => comment.id === input.commentId && comment.owner_id === input.ownerId,
    );
    if (index >= 0) {
      demoState.comments.splice(index, 1);
      saveDemoState(demoState);
    }
    return;
  }

  const shadowState = loadShadowState();
  const shadowExists = shadowState.comments.some(
    (comment) => comment.id === input.commentId && comment.owner_id === input.ownerId,
  );
  if (shadowExists) {
    deleteShadowComment(input.commentId, input.ownerId);
    return;
  }

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", input.commentId)
    .eq("owner_id", input.ownerId);

  if (error) {
    throw error;
  }
}

export async function getWorkspacePreferencesRecord(
  userId: string,
  binderId: string,
): Promise<WorkspacePreferences> {
  const suiteTemplateId = await getBinderSuiteTemplateId(binderId);
  if (!supabase) {
    return loadWorkspacePreferences(userId, binderId, suiteTemplateId);
  }

  await ensureWorkspacePresetDefinitionsLoaded({
    suiteTemplateId,
    binderId,
  });

  const shadowPreferences = getShadowWorkspacePreferences(userId, binderId);
  if ((await resolveBundledContentStorageMode(binderId)) === "shadow") {
    return shadowPreferences ?? createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId);
  }
  const { data, error } = await supabase
    .from("workspace_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .eq("binder_id", binderId)
    .maybeSingle();

  if (error) {
    if (shouldUseShadowFallback(binderId, error)) {
      return shadowPreferences ?? createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId);
    }
    throw error;
  }

  if (!data?.preferences) {
    return shadowPreferences ?? createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId);
  }

  return normalizeWorkspacePreferences({
    ...createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId),
    ...(data.preferences as WorkspacePreferences),
    userId,
    binderId,
  });
}

export async function upsertWorkspacePreferencesRecord(
  preferences: WorkspacePreferences,
): Promise<WorkspacePreferences> {
  const suiteTemplateId = preferences.suiteTemplateId ?? (await getBinderSuiteTemplateId(preferences.binderId));
  const next = {
    ...normalizeWorkspacePreferences(preferences),
    suiteTemplateId,
    updatedAt: now(),
  };

  if (!supabase) {
    return saveWorkspacePreferences(next);
  }

  if ((await resolveBundledContentStorageMode(next.binderId)) === "shadow") {
    return upsertShadowWorkspacePreferences(next);
  }

  const { data, error } = await supabase
    .from("workspace_preferences")
    .upsert(
      {
        user_id: next.userId,
        binder_id: next.binderId,
        preferences: next,
        updated_at: now(),
      },
      { onConflict: "user_id,binder_id" },
    )
    .select("preferences")
    .single<WorkspacePreferencesRecord>();

  if (error) {
    if (shouldUseShadowFallback(next.binderId, error)) {
      return upsertShadowWorkspacePreferences(next);
    }
    throw error;
  }

  const saved = normalizeWorkspacePreferences({
    ...createDefaultWorkspacePreferences(next.userId, next.binderId, next.suiteTemplateId),
    ...(data.preferences ?? next),
    userId: next.userId,
    binderId: next.binderId,
  });

  saveGlobalThemeSettings(saved.theme);
  return saved;
}

function loadDemoState(): DemoState {
  if (typeof window === "undefined") {
    return {
      notes: [...demoNotes],
      comments: [...demoComments],
      highlights: mergeStoredHighlightMetadata([...demoHighlights]),
    };
  }

  try {
    const raw = window.localStorage.getItem(DEMO_DATA_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(DEMO_HIGHLIGHT_RESET_MARKER_KEY, "true");
      return {
        notes: [...demoNotes],
        comments: [...demoComments],
        highlights: mergeStoredHighlightMetadata([...demoHighlights]),
      };
    }

    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return {
      notes: parsed.notes ?? [...demoNotes],
      comments: parsed.comments ?? [...demoComments],
      highlights: mergeStoredHighlightMetadata(
        sanitizeDemoHighlights((parsed.highlights ?? [...demoHighlights]) as Highlight[]),
      ),
    };
  } catch {
    window.localStorage.setItem(DEMO_HIGHLIGHT_RESET_MARKER_KEY, "true");
    return {
      notes: [...demoNotes],
      comments: [...demoComments],
      highlights: mergeStoredHighlightMetadata([...demoHighlights]),
    };
  }
}

function saveDemoState(state: DemoState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEMO_HIGHLIGHT_RESET_MARKER_KEY, "true");
  window.localStorage.setItem(DEMO_DATA_STORAGE_KEY, JSON.stringify(state));
}

function createEmptyShadowState(): ShadowState {
  return {
    notes: [],
    comments: [],
    highlights: [],
    workspacePreferences: [],
  };
}

function loadShadowState(): ShadowState {
  if (typeof window === "undefined") {
    return createEmptyShadowState();
  }

  try {
    const raw = window.localStorage.getItem(SHADOW_DATA_STORAGE_KEY);
    if (!raw) {
      return createEmptyShadowState();
    }

    const parsed = JSON.parse(raw) as Partial<ShadowState>;
    return {
      notes: (parsed.notes ?? []) as LearnerNote[],
      comments: (parsed.comments ?? []) as Comment[],
      highlights: mergeStoredHighlightMetadata((parsed.highlights ?? []) as Highlight[]),
      workspacePreferences: (parsed.workspacePreferences ?? []) as WorkspacePreferences[],
    };
  } catch {
    return createEmptyShadowState();
  }
}

function saveShadowState(state: ShadowState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SHADOW_DATA_STORAGE_KEY, JSON.stringify(state));
}

function getShadowBinderState(ownerId: string, binderId: string) {
  const shadowState = loadShadowState();
  return {
    notes: shadowState.notes.filter(
      (note) => note.owner_id === ownerId && note.binder_id === binderId,
    ),
    comments: shadowState.comments.filter(
      (comment) => comment.owner_id === ownerId && comment.binder_id === binderId,
    ),
    highlights: shadowState.highlights.filter(
      (highlight) => highlight.owner_id === ownerId && highlight.binder_id === binderId,
    ),
  };
}

function upsertShadowLearnerNote(note: LearnerNote): LearnerNote {
  const shadowState = loadShadowState();
  const index = shadowState.notes.findIndex(
    (item) =>
      item.id === note.id ||
      (item.owner_id === note.owner_id &&
        item.binder_id === note.binder_id &&
        item.lesson_id === note.lesson_id),
  );

  if (index >= 0) {
    shadowState.notes[index] = {
      ...shadowState.notes[index],
      ...note,
      id: shadowState.notes[index].id,
    };
  } else {
    shadowState.notes.unshift(note);
  }

  saveShadowState(shadowState);
  return index >= 0 ? shadowState.notes[index] : note;
}

function upsertShadowHighlight(highlight: Highlight): Highlight {
  const shadowState = loadShadowState();
  const index = shadowState.highlights.findIndex(
    (item) => item.id === highlight.id && item.owner_id === highlight.owner_id,
  );

  if (index >= 0) {
    shadowState.highlights[index] = {
      ...shadowState.highlights[index],
      ...highlight,
    };
  } else {
    shadowState.highlights.unshift(highlight);
  }

  saveShadowState(shadowState);
  persistHighlightMetadata(highlight);
  return index >= 0 ? shadowState.highlights[index] : highlight;
}

function deleteShadowHighlight(ownerId: string, highlightId: string) {
  const shadowState = loadShadowState();
  shadowState.highlights = shadowState.highlights.filter(
    (highlight) => !(highlight.id === highlightId && highlight.owner_id === ownerId),
  );
  saveShadowState(shadowState);
  removeStoredHighlightMetadata(highlightId);
}

function resetShadowHighlights(ownerId: string, binderId: string, lessonId?: string) {
  const shadowState = loadShadowState();
  shadowState.highlights = shadowState.highlights.filter((highlight) => {
    if (highlight.owner_id !== ownerId || highlight.binder_id !== binderId) {
      return true;
    }

    return lessonId ? highlight.lesson_id !== lessonId : false;
  });
  saveShadowState(shadowState);
  removeStoredHighlightMetadataByScope({ binderId, lessonId });
}

function createShadowComment(comment: Comment): Comment {
  const shadowState = loadShadowState();
  shadowState.comments.unshift(comment);
  saveShadowState(shadowState);
  return comment;
}

function updateShadowComment(commentId: string, ownerId: string, body: string): Comment {
  const shadowState = loadShadowState();
  const index = shadowState.comments.findIndex(
    (comment) => comment.id === commentId && comment.owner_id === ownerId,
  );
  if (index < 0) {
    throw new Error("Comment not found.");
  }

  shadowState.comments[index] = {
    ...shadowState.comments[index],
    body,
    updated_at: now(),
  };
  saveShadowState(shadowState);
  return shadowState.comments[index];
}

function deleteShadowComment(commentId: string, ownerId: string) {
  const shadowState = loadShadowState();
  shadowState.comments = shadowState.comments.filter(
    (comment) => !(comment.id === commentId && comment.owner_id === ownerId),
  );
  saveShadowState(shadowState);
}

function getShadowWorkspacePreferences(
  userId: string,
  binderId: string,
): WorkspacePreferences | null {
  const shadowState = loadShadowState();
  return (
    shadowState.workspacePreferences.find(
      (preferences) => preferences.userId === userId && preferences.binderId === binderId,
    ) ?? null
  );
}

function upsertShadowWorkspacePreferences(
  preferences: WorkspacePreferences,
): WorkspacePreferences {
  const normalized = normalizeWorkspacePreferences(preferences);
  const shadowState = loadShadowState();
  const index = shadowState.workspacePreferences.findIndex(
    (item) => item.userId === normalized.userId && item.binderId === normalized.binderId,
  );

  if (index >= 0) {
    shadowState.workspacePreferences[index] = normalized;
  } else {
    shadowState.workspacePreferences.push(normalized);
  }

  saveShadowState(shadowState);
  saveGlobalThemeSettings(normalized.theme);
  return normalized;
}

function mergeShadowNotes(remoteNotes: LearnerNote[], shadowNotes: LearnerNote[]) {
  const byKey = new Map<string, LearnerNote>();
  for (const note of remoteNotes) {
    byKey.set(`${note.owner_id}:${note.lesson_id}`, note);
  }
  for (const note of shadowNotes) {
    byKey.set(`${note.owner_id}:${note.lesson_id}`, note);
  }
  return [...byKey.values()].sort(
    (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at),
  );
}

function mergeShadowComments(remoteComments: Comment[], shadowComments: Comment[]) {
  const byId = new Map<string, Comment>(remoteComments.map((comment) => [comment.id, comment]));
  for (const comment of shadowComments) {
    byId.set(comment.id, comment);
  }
  return [...byId.values()].sort(
    (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at),
  );
}

function mergeShadowHighlights(remoteHighlights: Highlight[], shadowHighlights: Highlight[]) {
  const byId = new Map<string, Highlight>(
    remoteHighlights.map((highlight) => [buildHighlightShadowKey(highlight), highlight]),
  );
  for (const highlight of shadowHighlights) {
    byId.set(buildHighlightShadowKey(highlight), highlight);
  }
  return [...byId.values()].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
}

function buildHighlightShadowKey(highlight: Highlight) {
  if (
    typeof highlight.start_offset === "number" &&
    typeof highlight.end_offset === "number" &&
    highlight.end_offset > highlight.start_offset
  ) {
    return `${highlight.owner_id}:${highlight.binder_id}:${highlight.lesson_id}:${highlight.start_offset}:${highlight.end_offset}`;
  }

  return `${highlight.owner_id}:${highlight.binder_id}:${highlight.lesson_id}:${highlight.anchor_text.trim().toLowerCase()}`;
}

function sanitizeDemoHighlights(highlights: Highlight[]) {
  if (typeof window === "undefined") {
    return highlights.filter((highlight) => !DEMO_RESET_LESSON_IDS.has(highlight.lesson_id));
  }

  if (window.localStorage.getItem(DEMO_HIGHLIGHT_RESET_MARKER_KEY)) {
    return highlights;
  }

  const filtered = highlights.filter(
    (highlight) => !DEMO_RESET_LESSON_IDS.has(highlight.lesson_id),
  );
  window.localStorage.setItem(DEMO_HIGHLIGHT_RESET_MARKER_KEY, "true");
  return filtered;
}

export async function upsertBinder(
  input: Partial<UpsertBinderInput> & { ownerId: string },
): Promise<Binder> {
  const title = input.title?.trim();
  if (!title) {
    throw new Error("Binder title is required before saving.");
  }
  const binder = {
    id: input.id ?? crypto.randomUUID(),
    owner_id: input.ownerId,
    title,
    slug: input.slug || slugify(title),
    description: input.description ?? "",
    subject: input.subject ?? "General",
    level: input.level ?? "Foundations",
    status: input.status ?? "draft",
    price_cents: input.price_cents ?? 0,
    cover_url: input.cover_url ?? null,
    pinned: input.pinned ?? false,
    updated_at: now(),
  };

  if (!supabase) {
    const saved = {
      ...binder,
      created_at: now(),
    };
    const index = demoBinders.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      demoBinders[index] = saved;
    } else {
      demoBinders.unshift(saved);
    }
    return saved;
  }

  const { data, error } = await supabase
    .from("binders")
    .upsert(binder)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Binder;
}

export async function upsertLesson(input: Partial<UpsertLessonInput>): Promise<BinderLesson> {
  if (!input.binder_id) {
    throw new Error("Lesson needs a binder id.");
  }

  const fallbackTitle = deriveLessonTitle({
    title: input.title ?? "",
    content: input.content ?? emptyDoc(""),
    math_blocks: input.math_blocks ?? [],
    order_index: input.order_index ?? 1,
  });
  const lesson = {
    id: input.id ?? crypto.randomUUID(),
    binder_id: input.binder_id,
    title: input.title?.trim() || fallbackTitle,
    order_index: input.order_index ?? 1,
    content: input.content ?? emptyDoc("Write the lesson content here."),
    math_blocks: input.math_blocks ?? [],
    is_preview: input.is_preview ?? false,
    updated_at: now(),
  };

  if (!supabase) {
    const saved = {
      ...lesson,
      created_at: now(),
    };
    const index = demoLessons.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      demoLessons[index] = saved;
    } else {
      demoLessons.push(saved);
    }
    return saved;
  }

  const { data, error } = await supabase
    .from("binder_lessons")
    .upsert(lesson)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as BinderLesson;
}

export async function deleteLesson(lessonId: string) {
  if (!supabase) {
    const index = demoLessons.findIndex((lesson) => lesson.id === lessonId);
    if (index >= 0) {
      demoLessons.splice(index, 1);
    }
    return;
  }

  const { error } = await supabase.from("binder_lessons").delete().eq("id", lessonId);

  if (error) {
    throw error;
  }
}
