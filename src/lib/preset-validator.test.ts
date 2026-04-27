import { afterEach, describe, expect, it } from "vitest";
import { historyPresetDefinitions } from "@/lib/history-suite-seeds";
import {
  getPresetDefinition,
  gridLayoutToWindowFrames,
  registerPresetDefinitions,
  resetPresetRegistryForTests,
  validatePresetCatalog,
  validateGridLayout,
  validatePresetDefinition,
} from "@/lib/preset-validator";
import type { WorkspacePresetDefinition } from "@/types";
import { workspaceModules, workspacePresets } from "@/lib/workspace-preferences";

afterEach(() => {
  resetPresetRegistryForTests();
});

describe("preset-validator", () => {
  const allowedPanelTypes = workspaceModules.map((module) => module.id);

  it("validates all seeded history presets", () => {
    for (const preset of historyPresetDefinitions) {
      expect(validatePresetDefinition(preset, allowedPanelTypes)).toEqual({
        valid: true,
        errors: [],
      });
    }
  });

  it("detects overlapping panels", () => {
    const preset = getPresetDefinition("history-guided");
    expect(preset).toBeTruthy();
    const desktop = preset?.breakpoints.desktop;
    expect(desktop).toBeTruthy();
    if (!desktop || !preset) {
      return;
    }

    const overlapping = {
      ...desktop,
      items: [
        ...desktop.items,
        {
          panelId: "history-evidence",
          panelType: "history-evidence",
          x: desktop.items[0].x,
          y: desktop.items[0].y,
          w: 1,
          h: 1,
          minW: 1,
          minH: 1,
        } as const,
      ],
    };

    const result = validateGridLayout(
      overlapping,
      preset.requiredPanels,
      new Set(allowedPanelTypes),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("overlaps another panel"))).toBe(true);
  });

  it("detects panels that are too small to be useful", () => {
    const preset = getPresetDefinition("history-guided");
    const desktop = preset?.breakpoints.desktop;
    expect(desktop).toBeTruthy();
    if (!desktop || !preset) {
      return;
    }

    const tiny = {
      ...desktop,
      items: [
        {
          ...desktop.items[0],
          w: 1,
          h: 1,
          minW: 1,
          minH: 1,
        },
      ],
    };

    const result = validateGridLayout(tiny, preset.requiredPanels, new Set(allowedPanelTypes));

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("too small"))).toBe(true);
  });

  it("detects duplicate preset titles in a catalog", () => {
    const validCatalog = validatePresetCatalog(workspacePresets);
    const duplicateCatalog = validatePresetCatalog([
      ...workspacePresets,
      {
        id: "duplicate",
        name: "Math Graph Lab",
      },
    ]);

    expect(validCatalog.valid).toBe(true);
    expect(duplicateCatalog.valid).toBe(false);
    expect(duplicateCatalog.errors.some((error) => error.includes("Duplicate preset title"))).toBe(true);
  });

  it("derives positive window frames from grid layouts", () => {
    const preset = getPresetDefinition("history-full-studio");
    expect(preset?.breakpoints.desktop).toBeTruthy();
    if (!preset?.breakpoints.desktop) {
      return;
    }

    const frames = gridLayoutToWindowFrames(preset.breakpoints.desktop);
    const timelineFrame = frames["history-timeline"];
    expect(timelineFrame).toBeTruthy();
    expect(timelineFrame?.w ?? 0).toBeGreaterThan(0);
    expect(timelineFrame?.h ?? 0).toBeGreaterThan(0);
    expect(timelineFrame?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(timelineFrame?.y ?? -1).toBeGreaterThanOrEqual(0);
  });

  it("keeps history presets centered on source text and learner notes", () => {
    for (const preset of historyPresetDefinitions) {
      const desktop = preset.breakpoints.desktop;
      expect(desktop, `${preset.id} should include a desktop layout`).toBeTruthy();
      if (!desktop) {
        continue;
      }

      const panelIds = desktop.items.map((item) => item.panelId);
      expect(panelIds, `${preset.id} should include source text`).toContain("lesson");
      expect(panelIds, `${preset.id} should include learner notes`).toContain("private-notes");

      const lesson = desktop.items.find((item) => item.panelId === "lesson");
      const notes = desktop.items.find((item) => item.panelId === "private-notes");
      expect((lesson?.w ?? 0) * (lesson?.h ?? 0), `${preset.id} source should not be tiny`).toBeGreaterThanOrEqual(20);
      expect((notes?.w ?? 0) * (notes?.h ?? 0), `${preset.id} notes should not be tiny`).toBeGreaterThanOrEqual(15);
    }
  });

  it("prefers suite-specific preset definitions when they are registered", () => {
    const localOverride: WorkspacePresetDefinition = {
      ...historyPresetDefinitions[0],
      suiteTemplateId: "suite-rise-of-rome",
      breakpoints: {
        desktop: {
          columns: 12,
          rowHeight: 90,
          gap: 12,
          items: [
            {
              panelId: "history-timeline",
              panelType: "history-timeline",
              x: 0,
              y: 0,
              w: 12,
              h: 6,
              minW: 6,
              minH: 4,
            },
          ],
        },
      },
      requiredPanels: ["history-timeline"],
    };

    registerPresetDefinitions([localOverride]);

    const suitePreset = getPresetDefinition("history-guided", "suite-rise-of-rome");
    const globalPreset = getPresetDefinition("history-guided");

    expect(suitePreset?.suiteTemplateId).toBe("suite-rise-of-rome");
    expect(suitePreset?.breakpoints.desktop?.items).toHaveLength(1);
    expect(globalPreset?.suiteTemplateId).not.toBe("suite-rise-of-rome");
  });
});
