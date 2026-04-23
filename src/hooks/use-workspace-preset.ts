import { useMemo } from "react";
import { getPresetDefinition } from "@/lib/preset-validator";
import type {
  WorkspaceBreakpoint,
  WorkspaceGridLayout,
  WorkspacePresetDefinition,
  WorkspacePresetId,
} from "@/types";

export function useWorkspacePreset(
  presetId: WorkspacePresetId,
  suiteTemplateId?: string | null,
  viewportWidth?: number,
) {
  return useMemo(() => {
    const preset = getPresetDefinition(presetId, suiteTemplateId) ?? null;
    if (!preset) {
      return {
        preset: null as WorkspacePresetDefinition | null,
        breakpoint: null as WorkspaceBreakpoint | null,
        layout: null as WorkspaceGridLayout | null,
      };
    }

    const breakpoint = resolveBreakpoint(viewportWidth);
    const layout =
      preset.breakpoints[breakpoint] ??
      preset.breakpoints.desktop ??
      preset.breakpoints.tablet ??
      preset.breakpoints.mobile ??
      null;

    return {
      preset,
      breakpoint,
      layout,
    };
  }, [presetId, suiteTemplateId, viewportWidth]);
}

function resolveBreakpoint(viewportWidth?: number): WorkspaceBreakpoint {
  if (!viewportWidth || viewportWidth >= 1200) {
    return "desktop";
  }

  if (viewportWidth >= 760) {
    return "tablet";
  }

  return "mobile";
}
