import { describe, expect, it } from "vitest";
import {
  applyWorkspacePresetDesignAvailability,
  getWorkspaceModuleMinimumSize,
  getWorkspaceMobileModuleTabs,
  getWorkspacePresetDesign,
  selectWorkspacePresetVisibleModules,
  validateDesignedLayout,
  workspacePresetDesigns,
} from "@/lib/workspace-preset-designs";
import type { WorkspaceModuleId, WorkspacePresetId, WorkspaceWindowFrame } from "@/types";

const designedPresetIds: WorkspacePresetId[] = [
  "focused-reading",
  "split-study",
  "notes-focus",
  "annotation-mode",
  "math-study",
  "math-simple-presentation",
  "math-guided-study",
  "math-graph-lab",
  "math-proof-concept",
  "math-practice-mode",
  "full-math-canvas",
  "history-guided",
  "history-timeline-focus",
  "history-source-evidence",
  "history-argument-builder",
  "history-full-studio",
];

function frame(x: number, y: number, w: number, h: number, z = 1): WorkspaceWindowFrame {
  return { x, y, w, h, z };
}

describe("workspace preset design catalog", () => {
  it("defines an intentional design contract for every modular and canvas preset", () => {
    designedPresetIds.forEach((presetId) => {
      const design = getWorkspacePresetDesign(presetId);

      expect(design, presetId).toBeDefined();
      expect(design.purpose.trim().length, presetId).toBeGreaterThan(12);
      expect(design.primary.length, presetId).toBeGreaterThan(0);
      expect(design.defaultVisible.length, presetId).toBeGreaterThan(0);
      expect(design.desktopRecipe, presetId).toBeTruthy();
      expect(design.smallScreenVisible.length, presetId).toBeGreaterThan(0);
      expect(design.fitStrategy, presetId).toBe("preserve-composition");
      design.defaultVisible.forEach((moduleId) => {
        expect(
          ([...design.primary, ...design.secondary] as readonly WorkspaceModuleId[]).includes(moduleId),
          `${presetId}/${moduleId} should be primary or secondary when visible by default`,
        ).toBe(true);
      });
      design.collapsedByDefault.forEach((moduleId) => {
        expect(
          (design.defaultVisible as readonly WorkspaceModuleId[]).includes(moduleId),
          `${presetId}/${moduleId} visible and collapsed`,
        ).toBe(false);
      });
    });

    expect(Object.keys(workspacePresetDesigns).sort()).toEqual([...designedPresetIds].sort());
  });

  it("uses minimum useful module sizes instead of allowing smashed visible panels", () => {
    expect(getWorkspaceModuleMinimumSize("private-notes")).toEqual({ width: 480, height: 360 });
    expect(getWorkspaceModuleMinimumSize("desmos-graph", "primary")).toEqual({ width: 620, height: 480 });
    expect(getWorkspaceModuleMinimumSize("desmos-graph", "secondary")).toEqual({ width: 480, height: 320 });
    expect(getWorkspaceModuleMinimumSize("history-argument", "primary")).toEqual({ width: 520, height: 360 });
    expect(getWorkspaceModuleMinimumSize("whiteboard", "primary")).toEqual({ width: 640, height: 480 });
  });

  it("makes whiteboard a math-first tool without disrupting Split Study", () => {
    expect(getWorkspacePresetDesign("split-study").defaultVisible).not.toContain("whiteboard");
    expect(getWorkspacePresetDesign("math-graph-lab").collapsedByDefault).toContain("whiteboard");
    expect(getWorkspacePresetDesign("math-practice-mode").defaultVisible).toContain("whiteboard");
    expect(getWorkspacePresetDesign("full-math-canvas").defaultVisible).toContain("whiteboard");
  });

  it("collapses Desmos graph and calculator tools when the API key is unavailable", () => {
    const graphLab = applyWorkspacePresetDesignAvailability(
      getWorkspacePresetDesign("math-graph-lab"),
      { desmosApiKeyAvailable: false },
    );
    const fullCanvas = applyWorkspacePresetDesignAvailability(
      getWorkspacePresetDesign("full-math-canvas"),
      { desmosApiKeyAvailable: false },
    );

    expect(graphLab.defaultVisible).not.toContain("desmos-graph");
    expect(graphLab.collapsedByDefault).toEqual(
      expect.arrayContaining(["desmos-graph", "scientific-calculator", "saved-graphs"]),
    );
    expect(fullCanvas.defaultVisible).not.toContain("desmos-graph");
    expect(fullCanvas.collapsedByDefault).toContain("desmos-graph");
  });

  it("selects a smaller thoughtful visible set before crushing modules on small laptops", () => {
    const visible = selectWorkspacePresetVisibleModules("math-graph-lab", {
      viewport: { width: 1024, height: 700 },
      availability: { desmosApiKeyAvailable: true },
    });

    expect(visible).toEqual(["desmos-graph", "formula-sheet"]);
  });

  it("maps phone presets to purpose-built module tabs instead of desktop window packing", () => {
    expect(
      getWorkspaceMobileModuleTabs("math-graph-lab", [
        "desmos-graph",
        "formula-sheet",
        "lesson",
        "private-notes",
        "scientific-calculator",
      ]).map((tab) => tab.moduleId),
    ).toEqual(["desmos-graph", "formula-sheet", "lesson", "private-notes"]);

    expect(
      getWorkspaceMobileModuleTabs("history-argument-builder", [
        "history-argument",
        "history-evidence",
        "lesson",
        "history-timeline",
        "private-notes",
      ]).map((tab) => tab.label),
    ).toEqual(["Argument", "Evidence", "Lesson", "Timeline", "Notes"]);
  });

  it("rejects offscreen, overlapped, bottom-strip, and unreadably small designed layouts", () => {
    const moduleIds: WorkspaceModuleId[] = [
      "history-timeline",
      "lesson",
      "private-notes",
      "history-evidence",
    ];
    const result = validateDesignedLayout({
      design: getWorkspacePresetDesign("history-timeline-focus"),
      frames: {
        "history-timeline": frame(0, 0, 1024, 420),
        lesson: frame(0, 436, 240, 190, 2),
        "private-notes": frame(256, 436, 240, 190, 3),
        "history-evidence": frame(512, 436, 240, 190, 4),
      },
      moduleIds,
      viewport: { width: 1024, height: 700 },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("too small"),
        expect.stringContaining("bottom strip"),
      ]),
    );
  });
});
