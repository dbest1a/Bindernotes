import { buildSystemFolderFromSuite, SYSTEM_BINDER_IDS, systemSuiteTemplates } from "@/lib/history-suite-seeds";
import { findSystemSuiteByBinderId, isMissingSeedError } from "@/lib/seed-health";
import { supabaseProjectRef } from "@/lib/supabase";
import type {
  Binder,
  SeedHealth,
  SuiteTemplate,
  WorkspaceDiagnostic,
} from "@/types";

type CountCheck = {
  count: number | null;
  error: unknown;
};

export function buildWorkspaceDiagnostics(input: {
  suites: SuiteTemplate[];
  currentSeedVersions: Array<{ suite_template_id: string; version: string }>;
  workspacePresetRows: Array<{ suite_template_id: string }>;
  binders: Binder[];
  folders: Array<{ id: string; suite_template_id?: string | null; source?: string | null }>;
  lessonsByBinderId: Record<string, number>;
  queryChecks?: Array<{ scope: string; error: unknown }>;
}) {
  const diagnostics: WorkspaceDiagnostic[] = [];
  const versionsBySuiteId = new Map(
    input.currentSeedVersions.map((version) => [version.suite_template_id, version.version]),
  );
  const presetCountBySuiteId = new Map<string, number>();
  input.workspacePresetRows.forEach((row) => {
    presetCountBySuiteId.set(
      row.suite_template_id,
      (presetCountBySuiteId.get(row.suite_template_id) ?? 0) + 1,
    );
  });

  input.queryChecks?.forEach((check) => {
    const diagnostic = classifyQueryError(check.scope, check.error);
    if (diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  for (const suite of systemSuiteTemplates) {
    const seededSuite = input.suites.find((candidate) => candidate.id === suite.id);
    const suiteBinders = input.binders.filter((binder) => resolveSuiteIdForBinder(binder) === suite.id);
    const expectedFolderId = buildSystemFolderFromSuite(suite).id;
    const suiteFolders = input.folders.filter((folder) => resolveSuiteIdForFolder(folder) === suite.id || folder.id === expectedFolderId);
    const seedVersion = versionsBySuiteId.get(suite.id) ?? null;
    const presetCount = presetCountBySuiteId.get(suite.id) ?? 0;

    if (!seededSuite) {
      diagnostics.push({
        code: "missing_suite_template",
        scope: suite.id,
        severity: "error",
        title: `${suite.title} suite template is missing`,
        message: `${suite.title} is not present in public.suite_templates.`,
        hint: buildProjectHint(),
      });
      continue;
    }

    if (!seedVersion) {
      diagnostics.push({
        code: "missing_seed_version",
        scope: suite.id,
        severity: "error",
        title: `${suite.title} seed version is missing`,
        message: `${suite.title} exists, but no current row is visible in public.seed_versions.`,
        hint: "Run the system seed after pushing the latest migrations.",
      });
    }

    if (suite.history_mode && presetCount === 0) {
      diagnostics.push({
        code: "missing_workspace_preset",
        scope: suite.id,
        severity: "error",
        title: `${suite.title} presets are missing`,
        message: `${suite.title} has no rows in public.workspace_presets.`,
        hint: "Seed the suite so the history layouts exist in Supabase.",
      });
    }

    if (suiteBinders.length === 0) {
      diagnostics.push({
        code: "missing_public_binder",
        scope: suite.id,
        severity: "error",
        title: `${suite.title} binder is missing`,
        message: `${suite.title} has no published binder row visible from the frontend.`,
        hint: "Check seed data, binder publish status, and binder RLS visibility.",
      });
    }

    if (suiteFolders.length === 0) {
      diagnostics.push({
        code: "missing_folder",
        scope: suite.id,
        severity: "warning",
        title: `${suite.title} folder is missing`,
        message: `${suite.title} has no visible system folder row.`,
        hint: "Check the folder seed and the system folder read policy.",
      });
    }

    suiteBinders.forEach((binder) => {
      const lessonCount = input.lessonsByBinderId[binder.id] ?? 0;
      if (lessonCount === 0) {
        diagnostics.push({
          code: "missing_lessons",
          scope: binder.id,
          severity: "warning",
          title: `${binder.title} has no lessons`,
          message: `${binder.title} is visible, but no binder_lessons rows were loaded for it.`,
          hint: "Seed binder_lessons and confirm the lessons read policy is active.",
        });
      }
    });
  }

  return dedupeDiagnostics(diagnostics);
}

function resolveSuiteIdForBinder(binder: Binder) {
  return binder.suite_template_id ?? findSystemSuiteByBinderId(binder.id)?.id ?? null;
}

function resolveSuiteIdForFolder(folder: { id: string; suite_template_id?: string | null; source?: string | null }) {
  if (folder.suite_template_id) {
    return folder.suite_template_id;
  }

  const suite = systemSuiteTemplates.find((candidate) => buildSystemFolderFromSuite(candidate).id === folder.id);
  return suite?.id ?? null;
}

export function buildLearnerWorkspaceMessage(diagnostics: WorkspaceDiagnostic[]) {
  if (diagnostics.some((diagnostic) => diagnostic.code === "env_mismatch")) {
    return "This workspace is connected to a Supabase project that does not have the expected study content yet.";
  }

  if (diagnostics.some((diagnostic) => diagnostic.code === "rls_denied")) {
    return "This workspace cannot read its study content right now.";
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "This workspace is not fully set up yet. Ask an admin to finish the Binder Notes system seed.";
  }

  return "This workspace is unavailable right now.";
}

export function buildSeedHealthFromCounts(input: {
  suites: SuiteTemplate[];
  currentSeedVersions: Array<{ suite_template_id: string; version: string }>;
  binders: Binder[];
  diagnostics: WorkspaceDiagnostic[];
  fallbackSeedHealth?: SeedHealth[];
}) {
  const versionsBySuiteId = new Map(
    input.currentSeedVersions.map((version) => [version.suite_template_id, version.version]),
  );

  return systemSuiteTemplates.map((suite) => {
    const seededSuite = input.suites.find((candidate) => candidate.id === suite.id);
    const suiteBinders = input.binders.filter((binder) => binder.suite_template_id === suite.id);
    const version = versionsBySuiteId.get(suite.id) ?? null;
    const suiteDiagnostics = input.diagnostics.filter((diagnostic) => diagnostic.scope === suite.id);

    if (!seededSuite || suiteBinders.length === 0) {
      return {
        suiteTemplateId: suite.id,
        suiteSlug: suite.slug,
        suiteTitle: suite.title,
        status: "missing" as const,
        expectedVersion: input.fallbackSeedHealth?.find(
          (health) => health.suiteTemplateId === suite.id,
        )?.expectedVersion ?? "unknown",
        actualVersion: version,
        message:
          suiteDiagnostics[0]?.message ?? `${suite.title} is not seeded in this environment yet.`,
        missingBinders: [systemBinderIdForSuite(suite.id)].filter(Boolean) as string[],
      };
    }

    return {
      suiteTemplateId: seededSuite.id,
      suiteSlug: seededSuite.slug,
      suiteTitle: seededSuite.title,
      status:
        version && !suiteDiagnostics.some((diagnostic) => diagnostic.severity === "error")
          ? ("healthy" as const)
          : ("stale" as const),
      expectedVersion: input.fallbackSeedHealth?.find(
        (health) => health.suiteTemplateId === suite.id,
      )?.expectedVersion ?? "unknown",
      actualVersion: version,
      message:
        suiteDiagnostics[0]?.message ??
        (version
          ? `${suite.title} seed is present.`
          : `${suite.title} is missing its current seed version row.`),
    };
  });
}

export function classifyCountCheck(scope: string, check: CountCheck): WorkspaceDiagnostic[] {
  if (!check.error) {
    return [];
  }

  const diagnostic = classifyRuntimeError(scope, check.error);
  return diagnostic.length ? diagnostic : [];
}

export function classifyRuntimeError(scope: string, error: unknown): WorkspaceDiagnostic[] {
  if (isMissingSeedError(error)) {
    return [
      {
        code: "missing_seed_version",
        scope: error.suiteTemplateId,
        severity: "error",
        title: `${error.seedHealth.suiteTitle} seed is missing`,
        message: error.message,
        hint: "Push the latest migrations, then run the Binder Notes system seed against this Supabase project.",
      },
    ];
  }

  const diagnostic = classifyQueryError(scope, error);
  return diagnostic ? [diagnostic] : [];
}

export function classifyQueryError(scope: string, error: unknown): WorkspaceDiagnostic | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const code = record.code ?? "";
  const message = record.message ?? "Unknown Supabase error.";
  const detail = [record.details, record.hint].filter(Boolean).join(" ").trim() || null;
  const normalized = `${message} ${record.details ?? ""} ${record.hint ?? ""}`.toLowerCase();

  if (
    code === "42P01" ||
    code === "PGRST205" ||
    (normalized.includes("relation") && normalized.includes("does not exist")) ||
    normalized.includes("could not find the table")
  ) {
    const tableName = extractQuotedIdentifier(message) ?? scope;
    return {
      code: "missing_table",
      scope,
      severity: "error",
      title: `Missing table or view: ${tableName}`,
      message: `The configured Supabase project is missing ${tableName}.`,
      detail,
      hint: "Run the latest Supabase migrations against the same project this app is using.",
    };
  }

  if (
    code === "42703" ||
    code === "PGRST204" ||
    (normalized.includes("column") && normalized.includes("does not exist")) ||
    normalized.includes("could not find the") && normalized.includes("column")
  ) {
    return {
      code: "missing_column",
      scope,
      severity: "error",
      title: `Missing column while reading ${scope}`,
      message: `A newer frontend query expects a column that is not present yet.`,
      detail,
      hint: "Push the latest migrations before retrying the workspace load.",
    };
  }

  if (code === "42501" || normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return {
      code: "rls_denied",
      scope,
      severity: "error",
      title: `Read blocked by RLS or permissions: ${scope}`,
      message: `The frontend session cannot read ${scope} in this project.`,
      detail,
      hint: "Check select policies for published/system content and confirm you are using the right project.",
    };
  }

  return {
    code: "query_failed",
    scope,
    severity: "error",
    title: `Failed to load ${scope}`,
    message,
    detail,
    hint: buildProjectHint(),
  };
}

export function createEnvironmentMismatchDiagnostic(): WorkspaceDiagnostic {
  return {
    code: "env_mismatch",
    scope: "supabase",
    severity: "warning",
    title: "Supabase project may not match the expected workspace",
    message:
      "The app is configured for a Supabase project, but the seeded Binder Notes system content is still missing or invisible.",
    hint: buildProjectHint(),
  };
}

function dedupeDiagnostics(diagnostics: WorkspaceDiagnostic[]) {
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

function extractQuotedIdentifier(message: string) {
  const match = message.match(/"([^"]+)"/);
  return match?.[1] ?? null;
}

function buildProjectHint() {
  return supabaseProjectRef
    ? `Configured project ref: ${supabaseProjectRef}. If that is not the seeded project, update your env vars.`
    : "Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY point at the intended Supabase project.";
}

function systemBinderIdForSuite(suiteId: string) {
  switch (suiteId) {
    case systemSuiteTemplates[0]?.id:
      return SYSTEM_BINDER_IDS.algebra;
    case systemSuiteTemplates[1]?.id:
      return SYSTEM_BINDER_IDS.riseOfRome;
    case systemSuiteTemplates[2]?.id:
      return SYSTEM_BINDER_IDS.frenchRevolution;
    default:
      return null;
  }
}
