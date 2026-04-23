import { systemSuiteTemplates } from "@/lib/history-suite-seeds";
import {
  createMissingSeedError,
  strictSeedHealthMode,
} from "@/lib/seed-health";
import {
  getPresetDefinition,
  registerPresetDefinitions,
  validatePresetDefinition,
} from "@/lib/preset-validator";
import { workspaceModules } from "@/lib/workspace-preferences";
import { supabase } from "@/lib/supabase";
import type {
  WorkspaceBreakpoint,
  WorkspaceGridLayout,
  WorkspacePresetDefinition,
  WorkspacePresetId,
} from "@/types";

type WorkspacePresetRow = {
  suite_template_id: string;
  preset_id: WorkspacePresetId;
  breakpoint: WorkspaceBreakpoint;
  layout_json: WorkspaceGridLayout;
  is_default: boolean;
};

const presetLoadCache = new Map<string, Promise<WorkspacePresetDefinition[]>>();

function suiteUsesSeededWorkspacePresets(suiteTemplateId: string) {
  return systemSuiteTemplates.some(
    (suite) => suite.id === suiteTemplateId && suite.history_mode,
  );
}

function getBinderIdForSuiteId(suiteTemplateId: string) {
  return (
    systemSuiteTemplates.find((suite) => suite.id === suiteTemplateId)?.id === suiteTemplateId
      ? {
          "suite-algebra-foundations": "binder-algebra-foundations",
          "suite-rise-of-rome": "binder-rise-of-rome",
          "suite-history-demo": "binder-french-revolution-history-suite",
        }[suiteTemplateId] ?? null
      : null
  );
}

export function buildWorkspacePresetDefinitionsFromRows(
  suiteTemplateId: string,
  rows: WorkspacePresetRow[],
) {
  const rowsByPreset = new Map<WorkspacePresetId, WorkspacePresetRow[]>();
  rows.forEach((row) => {
    const current = rowsByPreset.get(row.preset_id) ?? [];
    rowsByPreset.set(row.preset_id, [...current, row]);
  });

  const allowedPanelTypes = workspaceModules.map((module) => module.id);

  return [...rowsByPreset.entries()].map(([presetId, presetRows]) => {
    const baseDefinition = getPresetDefinition(presetId) ?? getPresetDefinition("history-guided");
    if (!baseDefinition) {
      throw new Error(`Preset metadata is missing for ${presetId}.`);
    }

    const breakpoints = Object.fromEntries(
      presetRows.map((row) => [row.breakpoint, row.layout_json]),
    ) as WorkspacePresetDefinition["breakpoints"];

    const definition: WorkspacePresetDefinition = {
      ...baseDefinition,
      suiteTemplateId,
      breakpoints,
    };

    const validation = validatePresetDefinition(definition, allowedPanelTypes);
    if (!validation.valid) {
      throw new Error(
        `Preset ${presetId} is invalid for suite ${suiteTemplateId}: ${validation.errors.join("; ")}`,
      );
    }

    return definition;
  });
}

export async function loadWorkspacePresetDefinitions(input: {
  suiteTemplateId: string | null | undefined;
  binderId?: string | null;
}) {
  if (!input.suiteTemplateId) {
    return [] satisfies WorkspacePresetDefinition[];
  }

  if (!suiteUsesSeededWorkspacePresets(input.suiteTemplateId)) {
    return [] satisfies WorkspacePresetDefinition[];
  }

  if (!supabase) {
    return [] satisfies WorkspacePresetDefinition[];
  }

  const { data, error } = await supabase
    .from("workspace_presets")
    .select("suite_template_id, preset_id, breakpoint, layout_json, is_default")
    .eq("suite_template_id", input.suiteTemplateId);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as WorkspacePresetRow[];
  if (rows.length === 0) {
    if (strictSeedHealthMode) {
      throw createMissingSeedError(
        input.binderId ?? getBinderIdForSuiteId(input.suiteTemplateId) ?? "missing-system-binder",
      );
    }

    return [] satisfies WorkspacePresetDefinition[];
  }

  const definitions = buildWorkspacePresetDefinitionsFromRows(
    input.suiteTemplateId,
    rows,
  );
  registerPresetDefinitions(definitions);
  return definitions;
}

export async function ensureWorkspacePresetDefinitionsLoaded(input: {
  suiteTemplateId: string | null | undefined;
  binderId?: string | null;
}) {
  if (!input.suiteTemplateId || !supabase) {
    return [] satisfies WorkspacePresetDefinition[];
  }

  if (!suiteUsesSeededWorkspacePresets(input.suiteTemplateId)) {
    return [] satisfies WorkspacePresetDefinition[];
  }

  const cacheKey = `${input.suiteTemplateId}:${input.binderId ?? ""}`;
  const existing = presetLoadCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const next = loadWorkspacePresetDefinitions(input).catch((error) => {
    presetLoadCache.delete(cacheKey);
    throw error;
  });
  presetLoadCache.set(cacheKey, next);
  return next;
}
