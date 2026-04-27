import { historyPresetDefinitions } from "@/lib/history-suite-seeds";
import type {
  WorkspaceBreakpoint,
  WorkspaceGridItem,
  WorkspaceGridLayout,
  WorkspaceModuleId,
  WorkspacePresetId,
  WorkspacePresetDefinition,
  WorkspaceWindowFrame,
} from "@/types";

const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_PADDING = 20;

export type WorkspacePresetValidationResult = {
  valid: boolean;
  errors: string[];
};

const GLOBAL_PRESET_SCOPE = "__global__";

function buildPresetRegistryKey(
  presetId: WorkspacePresetId,
  suiteTemplateId?: string | null,
) {
  return `${suiteTemplateId ?? GLOBAL_PRESET_SCOPE}:${presetId}`;
}

function seedPresetRegistry() {
  const registry = new Map<string, WorkspacePresetDefinition>();

  historyPresetDefinitions.forEach((preset) => {
    registry.set(buildPresetRegistryKey(preset.id, preset.suiteTemplateId), preset);
    if (!registry.has(buildPresetRegistryKey(preset.id))) {
      registry.set(buildPresetRegistryKey(preset.id), preset);
    }
  });

  return registry;
}

export const presetRegistry = seedPresetRegistry();

export function registerPresetDefinitions(definitions: WorkspacePresetDefinition[]) {
  definitions.forEach((definition) => {
    presetRegistry.set(
      buildPresetRegistryKey(definition.id, definition.suiteTemplateId),
      definition,
    );
    if (!presetRegistry.has(buildPresetRegistryKey(definition.id))) {
      presetRegistry.set(buildPresetRegistryKey(definition.id), definition);
    }
  });
}

export function resetPresetRegistryForTests() {
  presetRegistry.clear();
  seedPresetRegistry().forEach((definition, key) => {
    presetRegistry.set(key, definition);
  });
}

export function getPresetDefinition(
  presetId: WorkspacePresetId,
  suiteTemplateId?: string | null,
) {
  return (
    (suiteTemplateId
      ? presetRegistry.get(buildPresetRegistryKey(presetId, suiteTemplateId))
      : null) ?? presetRegistry.get(buildPresetRegistryKey(presetId))
  );
}

export function validatePresetDefinition(
  definition: WorkspacePresetDefinition,
  allowedPanelTypes: readonly WorkspaceModuleId[],
): WorkspacePresetValidationResult {
  const errors: string[] = [];
  const allowed = new Set<WorkspaceModuleId>(allowedPanelTypes);

  definition.requiredPanels.forEach((panelId) => {
    if (!allowed.has(panelId)) {
      errors.push(`Unknown required panel type: ${panelId}`);
    }
  });

  (Object.entries(definition.breakpoints) as Array<[WorkspaceBreakpoint, WorkspaceGridLayout | undefined]>).forEach(
    ([breakpoint, layout]) => {
      if (!layout) {
        return;
      }

      const result = validateGridLayout(layout, definition.requiredPanels, allowed);
      if (!result.valid) {
        result.errors.forEach((error) => errors.push(`${definition.id}/${breakpoint}: ${error}`));
      }
    },
  );

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validatePresetCatalog(
  presets: readonly { id: string; name: string }[],
): WorkspacePresetValidationResult {
  const errors: string[] = [];
  const titleByKey = new Map<string, string>();

  presets.forEach((preset) => {
    const key = preset.name.trim().toLowerCase();
    if (!key) {
      errors.push(`Preset ${preset.id} has an empty title.`);
      return;
    }

    const existingId = titleByKey.get(key);
    if (existingId) {
      errors.push(`Duplicate preset title "${preset.name}" used by ${existingId} and ${preset.id}.`);
      return;
    }

    titleByKey.set(key, preset.id);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateGridLayout(
  layout: WorkspaceGridLayout,
  requiredPanels: readonly WorkspaceModuleId[],
  allowedPanelTypes: Set<WorkspaceModuleId>,
): WorkspacePresetValidationResult {
  const errors: string[] = [];
  const seenRequired = new Set<WorkspaceModuleId>();
  const occupied = new Set<string>();

  layout.items.forEach((item) => {
    if (!allowedPanelTypes.has(item.panelType)) {
      errors.push(`Unknown panel type ${item.panelType}`);
    }

    if (item.x < 0 || item.y < 0) {
      errors.push(`Panel ${item.panelId} has negative coordinates.`);
    }

    if (item.w <= 0 || item.h <= 0 || item.minW <= 0 || item.minH <= 0) {
      errors.push(`Panel ${item.panelId} has invalid width/height.`);
    }

    if (item.w < item.minW || item.h < item.minH) {
      errors.push(`Panel ${item.panelId} is smaller than its minimum size.`);
    }

    if (item.w < 2 || item.h < 2 || item.w * item.h < 4) {
      errors.push(`Panel ${item.panelId} is too small to be usable.`);
    }

    if (item.x + item.w > layout.columns) {
      errors.push(`Panel ${item.panelId} exceeds grid width.`);
    }

    requiredPanels.forEach((panelId) => {
      if (item.panelId === panelId) {
        seenRequired.add(panelId);
      }
    });

    occupyGrid(occupied, item, errors);
  });

  requiredPanels.forEach((panelId) => {
    if (!seenRequired.has(panelId)) {
      errors.push(`Missing required panel ${panelId}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function gridLayoutToWindowFrames(
  layout: WorkspaceGridLayout,
  canvasWidth = DEFAULT_CANVAS_WIDTH,
  padding = DEFAULT_PADDING,
): Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>> {
  const usableWidth = canvasWidth - padding * 2 - layout.gap * (layout.columns - 1);
  const columnWidth = usableWidth / Math.max(layout.columns, 1);

  return Object.fromEntries(
    layout.items.map((item, index) => {
      const x = padding + item.x * (columnWidth + layout.gap);
      const y = padding + item.y * (layout.rowHeight + layout.gap);
      const w = item.w * columnWidth + layout.gap * (item.w - 1);
      const h = item.h * layout.rowHeight + layout.gap * (item.h - 1);

      return [
        item.panelId,
        {
          x: Math.round(x),
          y: Math.round(y),
          w: Math.round(w),
          h: Math.round(h),
          z: index + 1,
        },
      ];
    }),
  ) as Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
}

function occupyGrid(occupied: Set<string>, item: WorkspaceGridItem, errors: string[]) {
  for (let y = item.y; y < item.y + item.h; y += 1) {
    for (let x = item.x; x < item.x + item.w; x += 1) {
      const key = `${x}:${y}`;
      if (occupied.has(key)) {
        errors.push(`Panel ${item.panelId} overlaps another panel.`);
        return;
      }
      occupied.add(key);
    }
  }
}
