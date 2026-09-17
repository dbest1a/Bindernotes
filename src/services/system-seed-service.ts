import type { SupabaseClient } from "@supabase/supabase-js";
import { demoBinders, demoConceptEdges, demoConceptNodes, demoLessons } from "@/lib/demo-data";
import {
  chemistryShowcaseBinder,
  chemistryShowcaseFolder,
  chemistryShowcaseFolderLink,
  chemistryShowcaseLessons,
} from "@/lib/chemistry/chemistry-showcase-content";
import {
  buildSystemFolderFromSuite,
  frenchRevolutionBinder,
  frenchRevolutionEventTemplates,
  frenchRevolutionLessons,
  frenchRevolutionMythCheckTemplates,
  frenchRevolutionSourceTemplates,
  riseOfRomeEventTemplates,
  riseOfRomeMythCheckTemplates,
  riseOfRomeSourceTemplates,
  historyPresetDefinitions,
  SYSTEM_BINDER_IDS,
  SYSTEM_SEED_VERSION,
  SYSTEM_SUITE_IDS,
  systemSuiteTemplates,
} from "@/lib/history-suite-seeds";
import {
  russianRevolutionBinder,
  russianRevolutionConceptEdges,
  russianRevolutionConceptNodes,
  russianRevolutionEventTemplates,
  russianRevolutionLessons,
  russianRevolutionMythCheckTemplates,
  russianRevolutionSourceTemplates,
} from "@/lib/russian-revolution-seeds";
import type {
  Binder,
  BinderLesson,
  ConceptEdge,
  ConceptNode,
  Folder,
  FolderBinderLink,
  HistoryEventTemplate,
  HistoryMythCheckTemplate,
  HistorySourceTemplate,
  Profile,
  SeedVersion,
  SuiteTemplate,
  WorkspaceBreakpoint,
} from "@/types";

type SeedWorkspacePresetRow = {
  id: string;
  suite_template_id: string;
  preset_id: string;
  breakpoint: WorkspaceBreakpoint;
  layout_json: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type SystemSeedPayload = {
  suites: SuiteTemplate[];
  seedVersions: SeedVersion[];
  folders: Folder[];
  folderBinders: FolderBinderLink[];
  binders: Binder[];
  lessons: BinderLesson[];
  conceptNodes: ConceptNode[];
  conceptEdges: ConceptEdge[];
  workspacePresets: SeedWorkspacePresetRow[];
  historyEventTemplates: HistoryEventTemplate[];
  historySourceTemplates: HistorySourceTemplate[];
  historyMythCheckTemplates: HistoryMythCheckTemplate[];
};

export type SystemSeedResult = {
  suiteCount: number;
  binderCount: number;
  lessonCount: number;
  presetCount: number;
  folderCount: number;
  templateCounts: {
    events: number;
    sources: number;
    mythChecks: number;
  };
};

export type SystemSeedCounts = {
  suiteTemplates: number;
  seedVersions: number;
  workspacePresets: number;
  folders: number;
  folderBinders: number;
  binders: number;
  lessons: number;
};

export type CatalogSeedClient = {
  rpc(
    name: "apply_catalog_seed",
    args: { p_payload: Record<string, unknown> },
  ): PromiseLike<{ error: { message: string } | null }>;
};

const SYSTEM_DEMO_BINDER_IDS = new Set<string>([SYSTEM_BINDER_IDS.algebra, SYSTEM_BINDER_IDS.riseOfRome]);

function systemNow() {
  return new Date().toISOString();
}

function requireAdmin(profile: Profile | null) {
  if (!profile) {
    throw new Error("Sign in as an admin before seeding system suites.");
  }

  if (profile.role !== "admin") {
    throw new Error("Only admin accounts can seed system suites.");
  }
}

function getSeededDemoBinders(ownerId: string) {
  return demoBinders
    .filter((binder) => SYSTEM_DEMO_BINDER_IDS.has(binder.id))
    .map((binder) => ({
      ...binder,
      owner_id: ownerId,
      suite_template_id:
        binder.id === SYSTEM_BINDER_IDS.algebra ? SYSTEM_SUITE_IDS.algebra : SYSTEM_SUITE_IDS.riseOfRome,
      updated_at: systemNow(),
    }));
}

function getSeededDemoLessons() {
  return demoLessons.filter((lesson) => SYSTEM_DEMO_BINDER_IDS.has(lesson.binder_id));
}

function getSeededConceptNodes() {
  return demoConceptNodes.filter((node) => SYSTEM_DEMO_BINDER_IDS.has(node.binder_id));
}

function getSeededConceptEdges() {
  return demoConceptEdges.filter((edge) => SYSTEM_DEMO_BINDER_IDS.has(edge.binder_id));
}

function buildWorkspacePresetRows(now: string): SeedWorkspacePresetRow[] {
  return systemSuiteTemplates
    .filter((suite) => suite.history_mode)
    .flatMap((suite) =>
      historyPresetDefinitions.flatMap((preset) =>
        (
          Object.entries(preset.breakpoints) as Array<
            [WorkspaceBreakpoint, (typeof preset.breakpoints)[WorkspaceBreakpoint]]
          >
        )
          .filter(([, layout]) => Boolean(layout))
          .map(([breakpoint, layout]) => ({
            id: `workspace-preset:${suite.id}:${preset.id}:${breakpoint}`,
            suite_template_id: suite.id,
            preset_id: preset.id,
            breakpoint,
            layout_json: layout as Record<string, unknown>,
            is_default: suite.default_preset_id === preset.id && breakpoint === "desktop",
            created_at: now,
            updated_at: now,
          })),
      ),
    );
}

export function buildSystemSeedPayload(profile: Profile): SystemSeedPayload {
  requireAdmin(profile);

  const now = systemNow();
  const algebraAndRomeBinders = getSeededDemoBinders(profile.id);
  const binders = [
    ...algebraAndRomeBinders,
    { ...frenchRevolutionBinder, owner_id: profile.id, updated_at: now },
    {
      ...russianRevolutionBinder,
      owner_id: profile.id,
      suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
      updated_at: now,
    },
  ];
  const folders = systemSuiteTemplates.map((suite) => ({
    ...buildSystemFolderFromSuite(suite),
    owner_id: profile.id,
    created_at: now,
    updated_at: now,
  }));
  const primaryFolderBinders = binders.map((binder) => {
    const suiteId = binder.suite_template_id;
    if (!suiteId) {
      throw new Error(`System binder ${binder.id} is missing suite_template_id.`);
    }
    const folder = folders.find((candidate) => candidate.suite_template_id === suiteId);
    if (!folder) {
      throw new Error(`No seeded folder found for suite ${suiteId}.`);
    }

    return {
      id: `folder-link:${folder.id}:${binder.id}`,
      owner_id: profile.id,
      folder_id: folder.id,
      binder_id: binder.id,
      created_at: now,
      updated_at: now,
    };
  });
  const historyFolder = folders.find((folder) => folder.suite_template_id === SYSTEM_SUITE_IDS.historyDemo);
  const historyShowcaseBinderIds = new Set<string>([
    SYSTEM_BINDER_IDS.riseOfRome,
    SYSTEM_BINDER_IDS.russianRevolution,
  ]);
  const historyShowcaseBinders = binders.filter((binder) => historyShowcaseBinderIds.has(binder.id));
  const folderBinders =
    historyFolder && historyShowcaseBinders.length > 0
      ? [
          ...primaryFolderBinders,
          ...historyShowcaseBinders
            .filter((binder) => binder.suite_template_id !== SYSTEM_SUITE_IDS.historyDemo)
            .map((binder) => ({
              id: `folder-link:${historyFolder.id}:${binder.id}`,
              owner_id: profile.id,
              folder_id: historyFolder.id,
              binder_id: binder.id,
              created_at: now,
              updated_at: now,
            })),
        ]
      : primaryFolderBinders;

  return {
    suites: systemSuiteTemplates.map((suite) => ({ ...suite, updated_at: now })),
    seedVersions: systemSuiteTemplates.map((suite) => ({
      id: `seed-version:${suite.id}:${SYSTEM_SEED_VERSION}`,
      suite_template_id: suite.id,
      version: SYSTEM_SEED_VERSION,
      checksum: `${suite.id}:${SYSTEM_SEED_VERSION}`,
      seeded_at: now,
      created_by: profile.id,
      status: "current",
    })),
    folders: [...folders, { ...chemistryShowcaseFolder, owner_id: profile.id, updated_at: now }],
    folderBinders: [
      ...folderBinders,
      { ...chemistryShowcaseFolderLink, owner_id: profile.id, updated_at: now },
    ],
    binders: [...binders, { ...chemistryShowcaseBinder, owner_id: profile.id, updated_at: now }],
    lessons: [
      ...getSeededDemoLessons(),
      ...frenchRevolutionLessons,
      ...russianRevolutionLessons,
      ...chemistryShowcaseLessons,
    ].map((lesson) => ({
      ...lesson,
      updated_at: now,
    })),
    conceptNodes: [...getSeededConceptNodes(), ...russianRevolutionConceptNodes],
    conceptEdges: [...getSeededConceptEdges(), ...russianRevolutionConceptEdges],
    workspacePresets: buildWorkspacePresetRows(now),
    historyEventTemplates: [
      ...frenchRevolutionEventTemplates,
      ...riseOfRomeEventTemplates,
      ...russianRevolutionEventTemplates,
    ].map((event) => ({
      ...event,
      updated_at: now,
    })),
    historySourceTemplates: [
      ...frenchRevolutionSourceTemplates,
      ...riseOfRomeSourceTemplates,
      ...russianRevolutionSourceTemplates,
    ].map((source) => ({
      ...source,
      updated_at: now,
    })),
    historyMythCheckTemplates: [
      ...frenchRevolutionMythCheckTemplates,
      ...riseOfRomeMythCheckTemplates,
      ...russianRevolutionMythCheckTemplates,
    ].map((myth) => ({
      ...myth,
      updated_at: now,
    })),
  };
}

export async function seedSystemSuitesWithClient(
  client: CatalogSeedClient,
  payload: SystemSeedPayload,
): Promise<SystemSeedResult> {
  const { error } = await client.rpc("apply_catalog_seed", {
    p_payload: {
      suite_templates: payload.suites,
      folders: payload.folders,
      binders: payload.binders,
      binder_lessons: payload.lessons,
      folder_binders: payload.folderBinders,
      concept_nodes: payload.conceptNodes,
      concept_edges: payload.conceptEdges,
      workspace_presets: payload.workspacePresets,
      history_event_templates: payload.historyEventTemplates,
      history_source_templates: payload.historySourceTemplates,
      history_myth_check_templates: payload.historyMythCheckTemplates,
      seed_versions: payload.seedVersions,
    },
  });
  if (error) throw new Error(`Transactional system seed failed: ${error.message}`);

  return {
    suiteCount: payload.suites.length,
    binderCount: payload.binders.length,
    lessonCount: payload.lessons.length,
    presetCount: payload.workspacePresets.length,
    folderCount: payload.folders.length,
    templateCounts: {
      events: payload.historyEventTemplates.length,
      sources: payload.historySourceTemplates.length,
      mythChecks: payload.historyMythCheckTemplates.length,
    },
  };
}

export async function resolveSystemSeedProfile(
  client: SupabaseClient,
  preferredProfileId?: string | null,
): Promise<Profile> {
  const query = preferredProfileId
    ? client.from("profiles").select("*").eq("id", preferredProfileId).maybeSingle()
    : client
        .from("profiles")
        .select("*")
        .eq("role", "admin")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      preferredProfileId
        ? `No profile with id ${preferredProfileId} exists in this Supabase project.`
        : "No admin profile was found in this Supabase project. Create or promote an admin user first.",
    );
  }

  const profile = data as Profile;
  requireAdmin(profile);
  return profile;
}

export async function getSystemSeedCounts(client: SupabaseClient): Promise<SystemSeedCounts> {
  const suiteIds = systemSuiteTemplates.map((suite) => suite.id);
  const binderIds = [...Object.values(SYSTEM_BINDER_IDS), chemistryShowcaseBinder.id];
  const folderIds = [
    ...systemSuiteTemplates.map((suite) => buildSystemFolderFromSuite(suite).id),
    chemistryShowcaseFolder.id,
  ];

  const exactCount = async (
    promise: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  ) => {
    const { count, error } = await promise;
    if (error) {
      throw error;
    }
    return count ?? 0;
  };

  const [suiteTemplates, seedVersions, workspacePresets, folders, folderBinders, binders, lessons] =
    await Promise.all([
      exactCount(
        client.from("suite_templates").select("id", { count: "exact", head: true }).in("id", suiteIds),
      ),
      exactCount(
        client
          .from("seed_versions")
          .select("id", { count: "exact", head: true })
          .eq("status", "current")
          .in("suite_template_id", suiteIds),
      ),
      exactCount(
        client
          .from("workspace_presets")
          .select("id", { count: "exact", head: true })
          .in("suite_template_id", suiteIds),
      ),
      exactCount(
        client
          .from("folders")
          .select("id", { count: "exact", head: true })
          .eq("source", "system")
          .in("id", folderIds),
      ),
      exactCount(
        client.from("folder_binders").select("id", { count: "exact", head: true }).in("binder_id", binderIds),
      ),
      exactCount(client.from("binders").select("id", { count: "exact", head: true }).in("id", binderIds)),
      exactCount(
        client.from("binder_lessons").select("id", { count: "exact", head: true }).in("binder_id", binderIds),
      ),
    ]);

  return {
    suiteTemplates,
    seedVersions,
    workspacePresets,
    folders,
    folderBinders,
    binders,
    lessons,
  };
}

/** Browser entry retained only to give old callers an explicit safe failure. */
export async function seedSystemSuites(profile: Profile): Promise<SystemSeedResult> {
  requireAdmin(profile);
  throw new Error(
    "System seeding requires the trusted server CLI and service-role credentials. Browser seeding is disabled.",
  );
}
