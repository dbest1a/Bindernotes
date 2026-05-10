import { describe, expect, it } from "vitest";
import {
  applyWorkspacePresetDesignAvailability,
  buildFaceliftPresetFrames,
  buildFaceliftSplitStudyFrames,
  faceliftWorkspacePresetDesigns,
  getWorkspaceModuleMinimumSize,
  getFaceliftWorkspacePresetDesign,
  getWorkspaceMobileModuleTabs,
  getWorkspacePresetDesign,
  getWorkspaceStarterChoices,
  selectFaceliftSurfaceModules,
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
  "recall-lab",
  "chem-guided-study",
  "chem-element-explorer",
  "chem-bonding-studio",
  "chem-reaction-studio",
  "chem-stoichiometry-lab",
  "chem-solutions-molarity-lab",
  "chem-acid-base-titration-lab",
  "chem-kinetics-graph-lab",
  "chem-thermochemistry-studio",
  "chem-full-studio",
  "chemistry-lab",
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
  it("defines Facelift metadata and responsive behavior for every workspace preset", () => {
    designedPresetIds.forEach((presetId) => {
      const design = getFaceliftWorkspacePresetDesign(presetId);

      expect(design, presetId).toBeDefined();
      expect(design.purpose.trim().length, presetId).toBeGreaterThan(12);
      expect(design.primaryModule, presetId).toBeTruthy();
      expect(design.secondaryModules.length, presetId).toBeGreaterThan(0);
      expect(design.collapsedModules.length, presetId).toBeGreaterThan(0);
      expect(design.minimumUsefulSizes[design.primaryModule]?.width, presetId).toBeGreaterThanOrEqual(420);
      expect(design.layoutRecipe.desktop.trim().length, presetId).toBeGreaterThan(12);
      expect(design.layoutRecipe.laptop.trim().length, presetId).toBeGreaterThan(12);
      expect(design.layoutRecipe.tablet.trim().length, presetId).toBeGreaterThan(12);
      expect(design.layoutRecipe.phone.trim().length, presetId).toBeGreaterThan(12);
      expect(design.studentCommand.label.trim().length, presetId).toBeGreaterThan(2);
      expect(design.studentCommand.primaryAction.trim().length, presetId).toBeGreaterThan(8);
      expect(design.studentCommand.followUpAction.trim().length, presetId).toBeGreaterThan(8);
      expect(design.performanceBudget.maxComfortableModules, presetId).toBeGreaterThanOrEqual(3);
      expect(design.performanceBudget.maxCompactModules, presetId).toBeLessThanOrEqual(3);
      expect(design.performanceBudget.mobilePrimaryModule, presetId).toBeTruthy();
      expect(design.reasoning.trim().length, presetId).toBeGreaterThan(18);
      expect(design.visibleModules.length, presetId).toBeLessThanOrEqual(6);
    });

    expect(Object.keys(faceliftWorkspacePresetDesigns).sort()).toEqual([...designedPresetIds].sort());
  });

  it("makes Facelift Split Study a true full-height, full-width two-pane recipe", () => {
    const frames = buildFaceliftSplitStudyFrames({ width: 1440, height: 820 });

    expect(frames.lesson).toEqual({ x: 0, y: 0, w: 720, h: 820, z: 1 });
    expect(frames["private-notes"]).toEqual({ x: 720, y: 0, w: 720, h: 820, z: 2 });
  });

  it("makes Desmos graph integration explicit and prominent in Facelift math presets", () => {
    const graphForwardPresets: WorkspacePresetId[] = [
      "math-study",
      "math-graph-lab",
      "math-guided-study",
      "full-math-canvas",
    ];

    graphForwardPresets.forEach((presetId) => {
      const design = getFaceliftWorkspacePresetDesign(presetId);

      expect(design.graphIntegration?.module, presetId).toBe("desmos-graph");
      expect(design.graphIntegration?.companionModules.length, presetId).toBeGreaterThanOrEqual(2);
      expect(design.densityVisibleModules.comfortable, presetId).toContain("desmos-graph");
      expect(design.placement.desktopPriority, presetId).toContain("desmos-graph");
    });

    expect(
      selectFaceliftSurfaceModules("math-graph-lab", {
        density: "compact",
        enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet", "saved-graphs"],
      }),
    ).toEqual(["desmos-graph", "formula-sheet", "private-notes"]);
  });

  it("builds Facelift Canvas math frames with Desmos as a useful work surface", () => {
    const frames = buildFaceliftPresetFrames("math-graph-lab", { width: 1680, height: 900 });
    const visibleModules = selectFaceliftSurfaceModules("math-graph-lab", {
      density: "comfortable",
      enabledModules: ["lesson", "private-notes", "desmos-graph", "formula-sheet", "saved-graphs"],
    });

    expect(frames["desmos-graph"]?.w).toBeGreaterThanOrEqual(760);
    expect(frames["desmos-graph"]?.h).toBeGreaterThanOrEqual(600);
    expect(frames["desmos-graph"]?.x).toBeGreaterThan(frames.lesson?.x ?? -1);
    expect(frames["formula-sheet"]?.x).toBeLessThan(frames["desmos-graph"]?.x ?? 0);
    expect(frames["private-notes"]?.x).toBeGreaterThan(frames["desmos-graph"]?.x ?? 0);

    expect(
      validateDesignedLayout({
        design: getWorkspacePresetDesign("math-graph-lab"),
        frames,
        moduleIds: visibleModules,
        viewport: { width: 1680, height: 900 },
      }).valid,
    ).toBe(true);
  });

  it("gives every Facelift history preset a distinct workflow and readable primary frame", () => {
    const expectedLeads: Record<WorkspacePresetId, WorkspaceModuleId> = {
      "history-guided": "lesson",
      "history-timeline-focus": "history-timeline",
      "history-source-evidence": "history-evidence",
      "history-argument-builder": "history-argument",
      "history-full-studio": "history-timeline",
      "focused-reading": "lesson",
      "notes-focus": "private-notes",
      "split-study": "lesson",
      "math-study": "desmos-graph",
      "math-simple-presentation": "lesson",
      "math-guided-study": "lesson",
      "math-graph-lab": "desmos-graph",
      "math-proof-concept": "lesson",
      "math-practice-mode": "whiteboard",
      "full-math-canvas": "desmos-graph",
      "recall-lab": "flashcards",
      "chem-guided-study": "lesson",
      "chem-element-explorer": "chem-periodic-table",
      "chem-bonding-studio": "chem-molecule-builder",
      "chem-reaction-studio": "chem-tri-reaction-view",
      "chem-stoichiometry-lab": "chem-stoichiometry-coach",
      "chem-solutions-molarity-lab": "chem-solution-mixer",
      "chem-acid-base-titration-lab": "chem-titration-lab",
      "chem-kinetics-graph-lab": "chem-desmos-kinetics-plot",
      "chem-thermochemistry-studio": "chem-calorimetry-lab",
      "chem-full-studio": "chem-periodic-table",
      "chemistry-lab": "chem-titration-lab",
      "annotation-mode": "lesson",
    };

    ([
      "history-guided",
      "history-timeline-focus",
      "history-source-evidence",
      "history-argument-builder",
      "history-full-studio",
    ] as WorkspacePresetId[]).forEach((presetId) => {
      const design = getFaceliftWorkspacePresetDesign(presetId);
      const frames = buildFaceliftPresetFrames(presetId, { width: 1440, height: 840 });
      const leadFrame = frames[expectedLeads[presetId]];

      expect(design.historyWorkflow?.leadModule, presetId).toBe(expectedLeads[presetId]);
      expect(design.historyWorkflow?.sequence.length, presetId).toBeGreaterThanOrEqual(3);
      expect(leadFrame?.w, presetId).toBeGreaterThanOrEqual(420);
      expect(leadFrame?.h, presetId).toBeGreaterThanOrEqual(320);
    });
  });

  it("keeps Revamp history presets readable and collapses optional history tools first", () => {
    const guided = getFaceliftWorkspacePresetDesign("history-guided");
    const timeline = buildFaceliftPresetFrames("history-timeline-focus", { width: 1440, height: 840 });
    const sourceEvidence = buildFaceliftPresetFrames("history-source-evidence", { width: 1440, height: 840 });
    const argument = buildFaceliftPresetFrames("history-argument-builder", { width: 1440, height: 840 });
    const fullStudio = getFaceliftWorkspacePresetDesign("history-full-studio");
    const fullFrames = buildFaceliftPresetFrames("history-full-studio", { width: 1440, height: 840 });

    expect(guided.visibleModules).toEqual(["lesson", "history-timeline", "history-evidence", "private-notes"]);
    expect(guided.collapsedModules).toEqual(
      expect.arrayContaining(["history-argument", "history-myth-checks"]),
    );

    expect(timeline["history-timeline"]?.w).toBe(1440);
    expect(timeline["history-timeline"]?.h ?? 0).toBeGreaterThan(timeline.lesson?.h ?? 0);
    expect(sourceEvidence.lesson?.w).toBeGreaterThanOrEqual(420);
    expect(sourceEvidence["history-evidence"]?.w).toBeGreaterThanOrEqual(520);
    expect(argument["history-argument"]?.w ?? 0).toBeGreaterThan(argument["history-evidence"]?.w ?? 0);

    expect(fullStudio.visibleModules).toEqual([
      "history-timeline",
      "lesson",
      "history-evidence",
      "history-argument",
    ]);
    expect(fullStudio.collapsedModules).toEqual(
      expect.arrayContaining(["private-notes", "history-myth-checks"]),
    );
    expect(fullStudio.performanceBudget.maxComfortableModules).toBe(4);
    expect(fullStudio.performanceBudget.lazyModules).toEqual(
      expect.arrayContaining(["history-timeline", "history-evidence", "history-argument"]),
    );
    expect(
      validateDesignedLayout({
        design: getWorkspacePresetDesign("history-full-studio"),
        frames: fullFrames,
        moduleIds: fullStudio.visibleModules,
        viewport: { width: 1440, height: 840 },
      }).valid,
    ).toBe(true);
  });

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

  it("adds a chemistry lab preset with lab-first modules and phone-friendly tabs", () => {
    const design = getFaceliftWorkspacePresetDesign("chemistry-lab");
    const frames = buildFaceliftPresetFrames("chemistry-lab", { width: 1440, height: 820 });

    expect(getWorkspacePresetDesign("chemistry-lab").defaultVisible).toEqual([
      "lesson",
      "chem-titration-lab",
      "chem-lab-notebook",
    ]);
    expect(design.primaryModule).toBe("chem-titration-lab");
    expect(design.performanceBudget.lazyModules).toContain("chem-titration-lab");
    expect(frames["chem-titration-lab"]?.w).toBeGreaterThan(frames.lesson?.w ?? 0);
    expect(
      getWorkspaceMobileModuleTabs("chemistry-lab", [
        "lesson",
        "chem-titration-lab",
        "chem-lab-notebook",
        "chem-reference-safety",
      ]).map((tab) => tab.label),
    ).toEqual(["Lesson", "Lab", "Notes", "Tools"]);
  });

  it("adds chemistry showcase presets without smashing flagship modules", () => {
    const elementExplorer = getFaceliftWorkspacePresetDesign("chem-element-explorer");
    const titration = getFaceliftWorkspacePresetDesign("chem-acid-base-titration-lab");
    const frames = buildFaceliftPresetFrames("chem-element-explorer", { width: 1440, height: 820 });

    expect(elementExplorer.primaryModule).toBe("chem-periodic-table");
    expect(titration.visibleModules).toContain("chem-desmos-titration-curve");
    expect(frames["chem-periodic-table"]?.w).toBeGreaterThanOrEqual(520);
    expect(
      getWorkspaceMobileModuleTabs("chem-full-studio", [
        "lesson",
        "private-notes",
        "chem-periodic-table",
        "chem-titration-lab",
        "chem-desmos-titration-curve",
        "chem-quick-tools",
      ]).map((tab) => tab.label),
    ).toEqual(["Lesson", "Notes", "Table", "Lab", "Curve", "Tools"]);
  });

  it("places the Facelift Math Practice whiteboard as the usable primary surface", () => {
    const frames = buildFaceliftPresetFrames("math-practice-mode", { width: 1680, height: 900 });

    expect(frames.whiteboard?.x).toBeGreaterThan(frames["formula-sheet"]?.x ?? -1);
    expect(frames.whiteboard?.w).toBeGreaterThan(frames["private-notes"]?.w ?? 0);
    expect(frames.whiteboard?.h).toBe(900);
    expect(frames["desmos-graph"]?.x).toBeGreaterThan(frames.whiteboard?.x ?? 0);
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

    expect(
      getWorkspaceMobileModuleTabs("annotation-mode", [
        "lesson",
        "private-notes",
        "recent-highlights",
        "comments",
        "lesson-outline",
      ]).map((tab) => tab.label),
    ).toEqual(["Lesson", "Notes", "Highlights", "Comments", "Outline"]);

    expect(
      getWorkspaceMobileModuleTabs("history-full-studio", [
        "lesson",
        "history-timeline",
        "history-evidence",
        "history-argument",
        "private-notes",
      ]).map((tab) => tab.label),
    ).toEqual(["Lesson", "Timeline", "Evidence", "Argument", "Notes"]);
    expect(
      selectWorkspacePresetVisibleModules("history-full-studio", {
        viewport: { width: 390, height: 844 },
      }),
    ).toEqual(["lesson"]);
  });

  it("recommends first-time starter choices by subject without demo content", () => {
    expect(getWorkspaceStarterChoices({ binderSubject: "Mathematics" }).map((choice) => choice.id)).toEqual([
      "read",
      "notes",
      "math",
      "canvas",
    ]);
    expect(getWorkspaceStarterChoices({ binderSubject: "World History", historyEnabled: true }).map((choice) => choice.id)).toEqual([
      "read",
      "notes",
      "history",
      "canvas",
    ]);
    expect(getWorkspaceStarterChoices().map((choice) => choice.presetId)).toEqual([
      "focused-reading",
      "notes-focus",
      "split-study",
    ]);
  });

  it("keeps heavy Facelift modules behind explicit visible or lazy budgets", () => {
    const mathPractice = getFaceliftWorkspacePresetDesign("math-practice-mode");
    const graphLab = getFaceliftWorkspacePresetDesign("math-graph-lab");

    expect(mathPractice.performanceBudget.mobilePrimaryModule).toBe("whiteboard");
    expect(mathPractice.performanceBudget.lazyModules).toEqual(
      expect.arrayContaining(["whiteboard", "desmos-graph", "scientific-calculator"]),
    );
    expect(graphLab.performanceBudget.lazyModules).toEqual(
      expect.arrayContaining(["desmos-graph", "whiteboard", "saved-graphs"]),
    );
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
