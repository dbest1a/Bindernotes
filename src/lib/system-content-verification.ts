import {
  SYSTEM_BINDER_IDS,
  SYSTEM_SEED_VERSION,
  systemSuiteTemplates,
} from "@/lib/history-suite-seeds";
import { planSystemContentRepair, type SystemRepairDataset } from "@/lib/system-content-repair";
import { isPlaceholderTitle } from "@/lib/workspace-records";
import type { Binder } from "@/types";

const SYSTEM_BINDER_ID_VALUES = new Set<string>(Object.values(SYSTEM_BINDER_IDS));

export type SystemContentCounts = {
  suiteTemplates: number;
  seedVersions: number;
  workspacePresets: number;
  folders: number;
  folderBinders: number;
  binders: number;
  lessons: number;
};

export type SystemVerificationReport = {
  ok: boolean;
  issues: string[];
  summary: {
    expectedSeedVersion: string;
    algebraLessonCount: number;
    systemFolderLinks: number;
    placeholderPublicBinders: number;
    pendingRepairActions: number;
    touchedPrivateRows: number;
  };
};

type VerificationInput = {
  counts: SystemContentCounts;
  seedVersions: Array<{ suite_template_id: string; version: string; status: string }>;
  binders: Binder[];
  dataset: SystemRepairDataset;
};

export function buildSystemVerificationReport(input: VerificationInput): SystemVerificationReport {
  const issues: string[] = [];
  const algebraBinder = input.binders.find((binder) => binder.id === SYSTEM_BINDER_IDS.algebra) ?? null;
  const algebraLessonCount = input.dataset.lessons.filter(
    (lesson) => lesson.binder_id === SYSTEM_BINDER_IDS.algebra,
  ).length;
  const systemFolderLinks = input.dataset.folderBinders.filter((link) =>
    SYSTEM_BINDER_ID_VALUES.has(link.binder_id),
  ).length;
  const placeholderPublicBinders = input.binders.filter(
    (binder) =>
      binder.status === "published" &&
      isPlaceholderTitle(binder.title) &&
      isSystemScopedBinder(binder, input.dataset),
  ).length;
  const repairPlan = planSystemContentRepair(input.dataset);
  const touchedPrivateRows = repairPlan.actions.filter((action) => {
    const binder = input.binders.find((candidate) => candidate.id === action.id);
    return binder ? !isSystemScopedBinder(binder, input.dataset) : true;
  }).length;

  if (input.counts.suiteTemplates === 0) {
    issues.push("public.suite_templates is still empty.");
  }

  if (input.counts.seedVersions === 0) {
    issues.push("public.seed_versions is still empty.");
  }

  if (input.counts.workspacePresets === 0) {
    issues.push("public.workspace_presets is still empty.");
  }

  if (
    !input.seedVersions.some(
      (seedVersion) =>
        seedVersion.version === SYSTEM_SEED_VERSION && seedVersion.status === "current",
    )
  ) {
    issues.push(`${SYSTEM_SEED_VERSION} is missing from public.seed_versions.`);
  }

  if (!algebraBinder) {
    issues.push("binder-algebra-foundations is missing.");
  }

  if (algebraLessonCount === 0) {
    issues.push("Algebra 1 Foundations has no lessons.");
  }

  if (systemFolderLinks === 0) {
    issues.push("System folder_binders links are missing.");
  }

  if (placeholderPublicBinders > 0) {
    issues.push("Placeholder public system binders are still visible.");
  }

  if (repairPlan.actions.length > 0) {
    issues.push("System placeholder repair actions are still pending.");
  }

  if (touchedPrivateRows > 0) {
    issues.push("Repair plan would touch non-system rows.");
  }

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      expectedSeedVersion: SYSTEM_SEED_VERSION,
      algebraLessonCount,
      systemFolderLinks,
      placeholderPublicBinders,
      pendingRepairActions: repairPlan.actions.length,
      touchedPrivateRows,
    },
  };
}

function isSystemScopedBinder(binder: Binder, dataset: SystemRepairDataset) {
  if (SYSTEM_BINDER_ID_VALUES.has(binder.id)) {
    return true;
  }

  if (binder.suite_template_id && systemSuiteTemplates.some((suite) => suite.id === binder.suite_template_id)) {
    return true;
  }

  return dataset.folderBinders.some(
    (link) =>
      link.binder_id === binder.id &&
      systemSuiteTemplates.some((suite) => `folder-${suite.id}` === link.folder_id),
  );
}
