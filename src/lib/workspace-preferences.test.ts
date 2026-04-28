import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyGlobalAppearanceToWorkspace,
  applyFocusModeToViewport,
  applyPresetToViewport,
  applyWorkspaceMode,
  applyThemeSettings,
  applyPreset,
  applyWorkspaceStyle,
  createDefaultWorkspacePreferences,
  defaultCustomPalette,
  defaultThemeSettings,
  ensureMathWorkspaceModules,
  ensureWindowFramesForEnabledModules,
  fitWorkspaceToViewport,
  getTopbarWorkspacePresetRecommendations,
  getVisibleWorkspacePresets,
  loadWorkspacePreferences,
  normalizeWorkspacePreferences,
  resolveWorkspacePresetLayout,
  saveWorkspacePreferences,
  simplePresentationThemeOptions,
  tidyWorkspaceLayout,
  updateWorkspaceAppearance,
  workspaceModules,
  workspacePresets,
} from "@/lib/workspace-preferences";
import {
  getWorkspaceModuleMinimumSize,
  getWorkspacePresetDesign,
  selectWorkspacePresetVisibleModules,
} from "@/lib/workspace-preset-designs";
import type { WorkspaceModuleId, WorkspacePresetId, WorkspaceStyle, WorkspaceWindowFrame } from "@/types";

beforeEach(() => {
  vi.stubEnv("VITE_DESMOS_API_KEY", "test-desmos-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspace preferences", () => {
  it("creates locked defaults for a user and binder", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");

    expect(preferences.locked).toBe(true);
    expect(preferences.userId).toBe("user-1");
    expect(preferences.binderId).toBe("binder-1");
    expect(preferences.enabledModules).toContain("lesson");
    expect(preferences.enabledModules).toContain("private-notes");
    expect(preferences.workspaceStyle).toBe("guided");
    expect(preferences.activeMode).toBe("simple");
    expect(preferences.styleChoiceCompleted).toBe(false);
    expect(preferences.simple.theme).toBe("match");
    expect(preferences.appearance.appTheme).toBe(preferences.theme.id);
    expect(preferences.appearance.studySurface).toBe("match");
    expect(preferences.appearance.saveLocalAppearance).toBe(false);
    expect(preferences.theme.studySurface).toBe("match");
    expect(preferences.modular.selectedPreset).toBe(preferences.preset);
    expect(preferences.canvas.snapBehavior).toBe("off");
    expect(preferences.windowLayout.lesson).toBeDefined();
    expect(preferences.windowLayout["private-notes"]).toBeDefined();
    expect(preferences.theme.backgroundStyle).toBe("subtle-grid");
    expect(preferences.theme.verticalSpace).toBe("balanced");
    expect(preferences.theme.defaultHighlightColor).toBe("yellow");
    expect(preferences.theme.hoverMotion).toBe(false);
    expect(preferences.theme.snapMode).toBe(false);
    expect(preferences.theme.focusMode).toBe(false);
    expect(preferences.theme.animationLevel).toBe("none");
    expect(preferences.theme.reducedChrome).toBe(true);
  });

  it("registers Whiteboard as a math workspace module without changing Split Study defaults", () => {
    expect(workspaceModules.find((module) => module.id === "whiteboard")).toMatchObject({
      name: "Whiteboard",
    });
    expect(workspacePresets.find((preset) => preset.id === "math-practice-mode")?.description).toContain("practice");
    expect(
      // Whiteboard should be available from settings/module launchers but not injected into the core two-pane preset.
      createDefaultWorkspacePreferences("user-1", "binder-1").enabledModules,
    ).not.toContain("whiteboard");
  });

  it("can switch workspace styles without replacing the shared engine", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const flexible = applyWorkspaceStyle(preferences, "flexible");
    const fullStudio = applyWorkspaceStyle(preferences, "full-studio");

    expect(flexible.workspaceStyle).toBe("flexible");
    expect(flexible.locked).toBe(true);
    expect(flexible.styleChoiceCompleted).toBe(true);
    expect(flexible.windowLayout.lesson).toBeDefined();
    expect(flexible.windowLayout["private-notes"]).toBeDefined();

    expect(fullStudio.workspaceStyle).toBe("full-studio");
    expect(fullStudio.locked).toBe(true);
    expect(fullStudio.styleChoiceCompleted).toBe(true);
    expect(fullStudio.windowLayout.lesson).toBeDefined();
    expect(fullStudio.windowLayout["private-notes"]).toBeDefined();
  });

  it("switches learner modes while keeping each mode's settings separate", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const mathPreset = applyPreset(preferences, "math-study");
    const canvasFrame: WorkspaceWindowFrame = { x: 444, y: 88, w: 720, h: 640, z: 22 };
    const withCanvasMemory = {
      ...mathPreset,
      canvas: {
        ...mathPreset.canvas,
        panelPositions: {
          lesson: canvasFrame,
        },
      },
    };

    const simple = applyWorkspaceMode(withCanvasMemory, "simple");
    const simpleThemeChanged = updateWorkspaceAppearance(simple, { studySurface: "night-study" });
    const modular = applyWorkspaceMode(simpleThemeChanged, "modular");
    const canvas = applyWorkspaceMode(simpleThemeChanged, "canvas");

    expect(simple.activeMode).toBe("simple");
    expect(simple.locked).toBe(true);
    expect(simpleThemeChanged.canvas.panelPositions.lesson).toEqual(canvasFrame);
    expect(modular.activeMode).toBe("modular");
    expect(modular.preset).toBe("math-study");
    expect(modular.appearance.studySurface).toBe("night-study");
    expect(modular.theme.id).toBe(simpleThemeChanged.theme.id);
    expect(canvas.activeMode).toBe("canvas");
    expect(canvas.locked).toBe(true);
    expect(canvas.canvas.panelPositions.lesson).toEqual(canvasFrame);
    expect(canvas.windowLayout.lesson).toBeDefined();
  });

  it("keeps appearance shared across simple, modular, and canvas settings", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const withAppearance = updateWorkspaceAppearance(preferences, {
      appTheme: "custom",
      studySurface: "warm-paper",
      customPalette: {
        primary: "#2563eb",
        secondary: "#f8fafc",
        accent: "#f59e0b",
      },
    });
    const modular = applyWorkspaceMode(withAppearance, "modular");
    const canvas = applyWorkspaceMode(withAppearance, "canvas");

    expect(withAppearance.theme.id).toBe("custom");
    expect(withAppearance.theme.studySurface).toBe("warm-paper");
    expect(withAppearance.simple.theme).toBe("warm-paper");
    expect(withAppearance.appearance.customPalette.primary).toBe("#2563eb");
    expect(modular.theme.id).toBe("custom");
    expect(modular.theme.studySurface).toBe("warm-paper");
    expect(modular.appearance.studySurface).toBe("warm-paper");
    expect(canvas.theme.id).toBe("custom");
    expect(canvas.theme.studySurface).toBe("warm-paper");
    expect(canvas.appearance.customPalette.accent).toBe("#f59e0b");
  });

  it("updates app theme without mutating mode or layout state", () => {
    const preferences = applyWorkspaceMode(
      applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "math-study"),
      "canvas",
    );
    const previousFrame = preferences.windowLayout.lesson;
    const next = updateWorkspaceAppearance(preferences, { appTheme: "ocean" });

    expect(next.activeMode).toBe("canvas");
    expect(next.workspaceStyle).toBe("full-studio");
    expect(next.windowLayout.lesson).toEqual(previousFrame);
    expect(next.appearance.appTheme).toBe("ocean");
    expect(next.theme.id).toBe("ocean");
    expect(next.theme.accent).toBe("193 86% 32%");
  });

  it("preserves unlocked edit draft frames below the first viewport instead of clamping them back", () => {
    const preferences = applyWorkspaceMode(
      applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "history-guided"),
      "canvas",
    );
    const unlocked = normalizeWorkspacePreferences({
      ...preferences,
      locked: false,
      canvas: {
        ...preferences.canvas,
        canvasHeight: 7600,
      },
      theme: {
        ...preferences.theme,
        verticalSpace: "infinite",
      },
      windowLayout: {
        ...preferences.windowLayout,
        lesson: { x: 24, y: 6200, w: 680, h: 520, z: 11 },
      },
    });

    expect(unlocked.windowLayout.lesson).toMatchObject({
      x: 24,
      y: 6200,
      w: 680,
      h: 520,
      z: 11,
    });
    expect(unlocked.canvas.canvasHeight).toBe(7600);
  });

  it("clones a built-in app theme into Custom when the accent changes", () => {
    const preferences = updateWorkspaceAppearance(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      { appTheme: "space" },
    );

    const next = updateWorkspaceAppearance(preferences, { accent: "amber" });

    expect(next.appearance.appTheme).toBe("custom");
    expect(next.appearance.accent).toBe("amber");
    expect(next.theme.id).toBe("custom");
    expect(next.theme.accentColor).toBe("amber");
    expect(next.theme.accent).toBe("174 67% 48%");
    expect(next.appearance.customPalette.primary).toBe("#28ccbc");
    expect(next.appearance.customPalette.secondary).toBe("#101219");
    expect(next.appearance.customPalette.accent).toBe("#eb8a0f");
    expect(next.appearance.customPalette.sourceTheme).toBe("space");
  });

  it("updates only the Custom accent bucket when the accent changes again", () => {
    const customSpace = updateWorkspaceAppearance(
      updateWorkspaceAppearance(
        updateWorkspaceAppearance(createDefaultWorkspacePreferences("user-1", "binder-1"), {
          appTheme: "space",
        }),
        { accent: "amber" },
      ),
      {
        appTheme: "custom",
        customPalette: {
          primary: "#123456",
          secondary: "#202020",
          accent: "#445566",
          sourceTheme: "space",
        },
      },
    );

    const next = updateWorkspaceAppearance(customSpace, { accent: "emerald" });

    expect(next.appearance.appTheme).toBe("custom");
    expect(next.appearance.accent).toBe("emerald");
    expect(next.appearance.customPalette.primary).toBe("#123456");
    expect(next.appearance.customPalette.secondary).toBe("#202020");
    expect(next.appearance.customPalette.accent).toBe("#0d9668");
    expect(next.appearance.customPalette.sourceTheme).toBe("space");
    expect(next.theme.id).toBe("custom");
  });

  it("repairs legacy Custom palettes where accent was persisted in the primary bucket", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const corrupted = normalizeWorkspacePreferences({
      ...preferences,
      appearance: {
        ...preferences.appearance,
        appTheme: "custom",
        accent: "amber",
        customPalette: {
          primary: "#eb8a0f",
          secondary: "#101219",
          accent: "#5f3f11",
          sourceTheme: "space",
        },
      },
      theme: {
        ...preferences.theme,
        id: "custom",
        accent: "35 92% 48%",
        accentColor: "amber",
        customPalette: {
          primary: "#eb8a0f",
          secondary: "#101219",
          accent: "#5f3f11",
          sourceTheme: "space",
        },
      },
    });

    expect(corrupted.appearance.customPalette.primary).toBe("#28ccbc");
    expect(corrupted.appearance.customPalette.secondary).toBe("#101219");
    expect(corrupted.appearance.customPalette.accent).toBe("#eb8a0f");
    expect(corrupted.theme.accent).toBe("174 67% 48%");
  });

  it("keeps high contrast as a shared study surface token", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const next = updateWorkspaceAppearance(preferences, { studySurface: "high-contrast" });

    expect(next.appearance.studySurface).toBe("high-contrast");
    expect(next.simple.theme).toBe("high-contrast");
    expect(next.theme.studySurface).toBe("high-contrast");
  });

  it("defaults Simple View to Study Surface Match and keeps app-theme matching live", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const ocean = updateWorkspaceAppearance(preferences, { appTheme: "ocean" });
    const manual = updateWorkspaceAppearance(ocean, { studySurface: "warm-paper" });
    const afterManualThemeChange = updateWorkspaceAppearance(manual, { appTheme: "space" });

    expect(simplePresentationThemeOptions[0]?.id).toBe("match");
    expect(simplePresentationThemeOptions.some((option) => option.id === "custom")).toBe(false);
    expect(ocean.appearance.studySurface).toBe("match");
    expect(ocean.simple.theme).toBe("match");
    expect(afterManualThemeChange.appearance.studySurface).toBe("warm-paper");
    expect(afterManualThemeChange.simple.theme).toBe("warm-paper");
  });

  it("filters presets by subject and mode without duplicate Math Graph Lab titles", () => {
    const math = applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "modular");
    const history = applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-history"), "modular");
    const simple = createDefaultWorkspacePreferences("user-1", "binder-1");
    const mathPresets = getVisibleWorkspacePresets(math, { binderSubject: "Mathematics" });
    const historyPresets = getVisibleWorkspacePresets(history, {
      binderSubject: "History",
      historyEnabled: true,
    });
    const simplePresets = getVisibleWorkspacePresets(simple, { binderSubject: "Mathematics" });
    const graphLabTitles = workspacePresets.filter((preset) => preset.name === "Math Graph Lab");

    expect(graphLabTitles).toHaveLength(1);
    expect(mathPresets.map((preset) => preset.id)).toContain("math-graph-lab");
    expect(mathPresets.map((preset) => preset.id)).not.toContain("history-guided");
    expect(historyPresets.map((preset) => preset.id)).toContain("history-guided");
    expect(historyPresets.map((preset) => preset.id)).not.toContain("math-graph-lab");
    expect(simplePresets.map((preset) => preset.id)).toContain("math-simple-presentation");
    expect(simplePresets.map((preset) => preset.id)).not.toContain("math-graph-lab");
  });

  it("keeps the top preset bar to two relevant recommendations for math canvas work", () => {
    const preferences = applyWorkspaceMode(
      applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "math-graph-lab"),
      "canvas",
    );

    const recommendations = getTopbarWorkspacePresetRecommendations(preferences, {
      binderSubject: "Mathematics",
    });

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0]?.id).toBe("math-graph-lab");
    expect(recommendations.map((preset) => preset.id)).toEqual(
      expect.arrayContaining(["math-graph-lab"]),
    );
    expect(
      recommendations.every((preset) =>
        [
          "split-study",
          "math-study",
          "math-guided-study",
          "math-graph-lab",
          "math-proof-concept",
          "math-practice-mode",
          "full-math-canvas",
        ].includes(preset.id),
      ),
    ).toBe(true);
  });

  it("applies a preset module arrangement and generates window frames", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const next = applyPreset(preferences, "math-study");
    const preset = resolveWorkspacePresetLayout("math-study", preferences.workspaceStyle);

    expect(next.preset).toBe("math-study");
    expect(next.enabledModules).toEqual(preset.enabledModules);
    expect(next.enabledModules).toContain("desmos-graph");
    expect(next.windowLayout["desmos-graph"]).toBeDefined();
    expect(next.windowLayout["scientific-calculator"]).toBeDefined();
  });

  it("applies preset selection through the same viewport-aware fit path as the Fit button", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const viewport = { width: 1180, height: 760 };

    const selected = applyPresetToViewport(preferences, "math-proof-concept", viewport);
    const manuallyFitted = fitWorkspaceToViewport(
      applyPreset(preferences, "math-proof-concept"),
      viewport,
      { force: true },
    );
    const visibleModules = selected.enabledModules.filter(
      (moduleId) => !selected.moduleLayout[moduleId]?.collapsed,
    );

    expect(selected.preset).toBe("math-proof-concept");
    expect(selected.viewportFit).toMatchObject({ width: viewport.width, height: viewport.height });
    expect(selected.windowLayout).toEqual(manuallyFitted.windowLayout);
    visibleModules.forEach((moduleId) => {
      const frame = selected.windowLayout[moduleId]!;
      const minimum = getWorkspaceModuleMinimumSize(
        moduleId,
        (getWorkspacePresetDesign("math-proof-concept").primary as readonly WorkspaceModuleId[]).includes(moduleId)
          ? "primary"
          : "secondary",
      );

      expect(frame.w, `${moduleId} width`).toBeGreaterThanOrEqual(minimum.width);
      expect(frame.h, `${moduleId} height`).toBeGreaterThanOrEqual(minimum.height);
      expect(frame.x + frame.w, `${moduleId} offscreen x`).toBeLessThanOrEqual(viewport.width);
      expect(frame.y + frame.h, `${moduleId} offscreen y`).toBeLessThanOrEqual(viewport.height);
    });
  });

  it("auto-fits Split Study with lesson and notes stretched to the usable viewport bottom", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const viewport = { width: 1366, height: 760 };

    const selected = applyPresetToViewport(preferences, "split-study", viewport);
    const lessonWindow = selected.windowLayout.lesson;
    const privateNotesWindow = selected.windowLayout["private-notes"];

    expect(lessonWindow).toBeDefined();
    expect(privateNotesWindow).toBeDefined();
    expect(lessonWindow!.y).toBe(privateNotesWindow!.y);
    expect(lessonWindow!.h).toBe(privateNotesWindow!.h);
    expect(lessonWindow!.y + lessonWindow!.h).toBeLessThanOrEqual(viewport.height);
    expect(privateNotesWindow!.y + privateNotesWindow!.h).toBeLessThanOrEqual(viewport.height);
    expect(viewport.height - (privateNotesWindow!.y + privateNotesWindow!.h)).toBeLessThanOrEqual(8);
  });

  it("fits Split Study as two edge-to-edge panes meeting at the center", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const viewport = { width: 1366, height: 760 };

    const selected = applyPresetToViewport(preferences, "split-study", viewport);
    const lessonWindow = selected.windowLayout.lesson!;
    const privateNotesWindow = selected.windowLayout["private-notes"]!;

    expect(lessonWindow.x).toBe(0);
    expect(lessonWindow.y).toBe(0);
    expect(privateNotesWindow.y).toBe(0);
    expect(lessonWindow.x + lessonWindow.w).toBe(privateNotesWindow.x);
    expect(privateNotesWindow.x + privateNotesWindow.w).toBe(viewport.width);
    expect(lessonWindow.h).toBe(viewport.height);
    expect(privateNotesWindow.h).toBe(viewport.height);
    expect(selected.canvas.canvasHeight).toBe(viewport.height);
  });

  it("fits Split Study to the focus viewport when focus mode is enabled", () => {
    const preferences = applyPresetToViewport(
      applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      "split-study",
      { width: 1260, height: 760 },
    );
    const focused = applyFocusModeToViewport(preferences, true, { width: 2048, height: 940 });
    const lessonWindow = focused.windowLayout.lesson;
    const privateNotesWindow = focused.windowLayout["private-notes"];

    expect(focused.theme.focusMode).toBe(true);
    expect(focused.viewportFit).toMatchObject({ width: 2048, height: 940 });
    expect(lessonWindow).toBeDefined();
    expect(privateNotesWindow).toBeDefined();
    expect(lessonWindow!.x).toBeLessThanOrEqual(8);
    expect(lessonWindow!.w).toBeGreaterThanOrEqual(980);
    expect(privateNotesWindow!.w).toBeGreaterThanOrEqual(980);
    expect(privateNotesWindow!.x + privateNotesWindow!.w).toBeLessThanOrEqual(2048);
    expect(Math.abs(lessonWindow!.w - privateNotesWindow!.w)).toBeLessThanOrEqual(1);
  });

  it("phone preset fit collapses to a mobile-friendly module set instead of smashing canvas windows", () => {
    const preferences = applyWorkspaceMode(
      applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "math-graph-lab"),
      "canvas",
    );

    const fitted = fitWorkspaceToViewport(preferences, { width: 390, height: 760 }, { force: true });
    const visibleModules = fitted.enabledModules.filter(
      (moduleId) => !fitted.moduleLayout[moduleId]?.collapsed,
    );

    expect(visibleModules).toEqual(["desmos-graph"]);
    expect(fitted.theme.verticalSpace).toBe("fit");
    visibleModules.forEach((moduleId) => {
      const frame = fitted.windowLayout[moduleId]!;
      expect(frame.w).toBeGreaterThanOrEqual(getWorkspaceModuleMinimumSize(moduleId, "primary").width);
      expect(frame.h).toBeGreaterThanOrEqual(getWorkspaceModuleMinimumSize(moduleId, "primary").height);
    });
  });

  it("keeps notes focus preset centered on a large writing surface and a binder notebook", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const next = applyPreset(preferences, "notes-focus");
    const notesWindow = next.windowLayout["private-notes"];
    const binderNotebookWindow = next.windowLayout["binder-notebook"];

    expect(next.enabledModules).toEqual(resolveWorkspacePresetLayout("notes-focus", "guided").enabledModules);
    expect(next.enabledModules).toContain("binder-notebook");
    expect(notesWindow).toBeDefined();
    expect(binderNotebookWindow).toBeDefined();
    expect(notesWindow!.w).toBeGreaterThanOrEqual(860);
    expect(notesWindow!.h).toBeGreaterThanOrEqual(1300);
    expect(binderNotebookWindow!.w).toBeGreaterThanOrEqual(560);
    expect(binderNotebookWindow!.h).toBeGreaterThanOrEqual(1300);
  });

  it("keeps split study preset focused on large source and notes windows", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const next = applyPreset(preferences, "split-study");
    const lessonWindow = next.windowLayout.lesson;
    const privateNotesWindow = next.windowLayout["private-notes"];

    expect(next.enabledModules).toEqual(
      expect.arrayContaining(["lesson", "private-notes", "recent-highlights", "tasks", "comments"]),
    );
    expect(next.moduleLayout["recent-highlights"]?.collapsed).toBe(true);
    expect(next.moduleLayout.tasks?.collapsed).toBe(true);
    expect(next.moduleLayout.comments?.collapsed).toBe(true);
    expect(lessonWindow).toBeDefined();
    expect(privateNotesWindow).toBeDefined();
    expect(lessonWindow!.w).toBeGreaterThanOrEqual(900);
    expect(privateNotesWindow!.w).toBeGreaterThanOrEqual(900);
    expect(lessonWindow!.h).toBeGreaterThanOrEqual(1300);
    expect(privateNotesWindow!.h).toBeGreaterThanOrEqual(1300);
  });

  it("resolves annotation presets with consistent design hierarchy across workspace styles", () => {
    const guided = resolveWorkspacePresetLayout("annotation-mode", "guided");
    const flexible = resolveWorkspacePresetLayout("annotation-mode", "flexible");
    const studio = resolveWorkspacePresetLayout("annotation-mode", "full-studio");
    const visible = (layout: typeof guided) =>
      layout.enabledModules.filter((moduleId) => !layout.moduleLayout?.[moduleId]?.collapsed);

    expect(visible(guided)).toEqual(["lesson", "private-notes", "comments", "recent-highlights"]);
    expect(visible(flexible)).toEqual(visible(guided));
    expect(visible(studio)).toEqual(visible(guided));
    expect(flexible.moduleLayout?.search?.collapsed).toBe(true);
    expect(studio.enabledModules).toContain("search");
    expect(guided.windowLayout?.comments?.w).toBeGreaterThan(studio.windowLayout?.comments?.w ?? 0);
  });

  it("keeps every preset layout free of overlapping windows across workspace styles", () => {
    const styles: WorkspaceStyle[] = ["guided", "flexible", "full-studio"];
    const presets: WorkspacePresetId[] = [
      "focused-reading",
      "notes-focus",
      "split-study",
      "math-study",
      "math-simple-presentation",
      "math-guided-study",
      "math-graph-lab",
      "math-proof-concept",
      "math-practice-mode",
      "full-math-canvas",
      "annotation-mode",
    ];

    presets.forEach((presetId) => {
      styles.forEach((style) => {
        const layout = resolveWorkspacePresetLayout(presetId, style);
        const frames = Object.entries(layout.windowLayout ?? {}).filter((entry): entry is [string, WorkspaceWindowFrame] =>
          Boolean(entry[1]),
        );

        for (let index = 0; index < frames.length; index += 1) {
          for (let compareIndex = index + 1; compareIndex < frames.length; compareIndex += 1) {
            const [leftId, leftFrame] = frames[index];
            const [rightId, rightFrame] = frames[compareIndex];
            expect(
              framesOverlap(leftFrame, rightFrame),
              `${presetId}/${style} overlaps ${leftId} with ${rightId}`,
            ).toBe(false);
          }
        }
      });
    });
  });

  it("gives each preset a clear dominant surface instead of equal-sized windows", () => {
    const styles: WorkspaceStyle[] = ["guided", "flexible", "full-studio"];

    styles.forEach((style) => {
      const focusedReading = resolveWorkspacePresetLayout("focused-reading", style);
      expect(frameArea(focusedReading.windowLayout!.lesson!)).toBeGreaterThan(
        frameArea(focusedReading.windowLayout!["lesson-outline"]!) * 4,
      );

      const notesFocus = resolveWorkspacePresetLayout("notes-focus", style);
      expect(frameArea(notesFocus.windowLayout!["private-notes"]!)).toBeGreaterThan(
        frameArea(notesFocus.windowLayout!.lesson!) * 3,
      );
      if (notesFocus.windowLayout!["binder-notebook"]) {
        expect(frameArea(notesFocus.windowLayout!["private-notes"]!)).toBeGreaterThan(
          frameArea(notesFocus.windowLayout!["binder-notebook"]!),
        );
      }

      const splitStudy = resolveWorkspacePresetLayout("split-study", style);
      expect(frameArea(splitStudy.windowLayout!.lesson!)).toBeGreaterThanOrEqual(
        frameArea(splitStudy.windowLayout!["private-notes"]!) * 0.9,
      );
      expect(frameArea(splitStudy.windowLayout!["private-notes"]!)).toBeGreaterThanOrEqual(
        frameArea(splitStudy.windowLayout!.lesson!) * 0.9,
      );

      const mathStudy = resolveWorkspacePresetLayout("math-study", style);
      expect(frameArea(mathStudy.windowLayout!["desmos-graph"]!)).toBeGreaterThan(
        frameArea(mathStudy.windowLayout!["private-notes"]!) * 2.8,
      );

      const graphLab = resolveWorkspacePresetLayout("math-graph-lab", style);
      expect(frameArea(graphLab.windowLayout!["desmos-graph"]!)).toBeGreaterThan(
        frameArea(graphLab.windowLayout!.lesson!) * 3,
      );

      const proofMode = resolveWorkspacePresetLayout("math-proof-concept", style);
      expect(frameArea(proofMode.windowLayout!.lesson!)).toBeGreaterThan(
        frameArea(proofMode.windowLayout!["related-concepts"]!),
      );

      const annotation = resolveWorkspacePresetLayout("annotation-mode", style);
      expect(frameArea(annotation.windowLayout!.lesson!)).toBeGreaterThan(
        frameArea(annotation.windowLayout!["private-notes"]!) * 3,
      );
    });
  });

  it("keeps math canvas presets intentionally sparse by default", () => {
    expect(visiblePresetModules("math-proof-concept")).toEqual([
      "lesson",
      "math-blocks",
      "related-concepts",
      "private-notes",
    ]);
    expect(collapsedPresetModules("math-proof-concept")).toEqual(
      expect.arrayContaining([
        "formula-sheet",
        "desmos-graph",
        "scientific-calculator",
        "saved-graphs",
        "comments",
        "recent-highlights",
      ]),
    );

    expect(visiblePresetModules("math-graph-lab")).toEqual([
      "desmos-graph",
      "formula-sheet",
      "lesson",
      "private-notes",
    ]);
    expect(collapsedPresetModules("math-graph-lab")).toEqual(
      expect.arrayContaining(["saved-graphs", "scientific-calculator", "math-blocks", "whiteboard"]),
    );

    expect(visiblePresetModules("math-guided-study")).toEqual([
      "lesson",
      "private-notes",
      "math-blocks",
      "desmos-graph",
    ]);
    expect(collapsedPresetModules("math-guided-study")).toEqual(
      expect.arrayContaining(["formula-sheet", "saved-graphs", "scientific-calculator"]),
    );

    expect(visiblePresetModules("math-practice-mode")).toEqual([
      "whiteboard",
      "math-blocks",
      "private-notes",
      "formula-sheet",
    ]);
    expect(collapsedPresetModules("math-practice-mode")).toEqual(
      expect.arrayContaining(["desmos-graph", "scientific-calculator", "saved-graphs"]),
    );

    expect(visiblePresetModules("full-math-canvas")).toEqual([
      "desmos-graph",
      "whiteboard",
      "math-blocks",
      "lesson",
      "private-notes",
      "formula-sheet",
      "related-concepts",
    ]);
    expect(collapsedPresetModules("full-math-canvas")).toEqual(
      expect.arrayContaining(["saved-graphs", "scientific-calculator", "comments", "recent-highlights"]),
    );
  });

  it("tidies math presets into semantic zones instead of a tiny bottom strip", () => {
    const presets: WorkspacePresetId[] = [
      "math-proof-concept",
      "math-graph-lab",
      "math-guided-study",
      "math-practice-mode",
      "full-math-canvas",
    ];

    presets.forEach((presetId) => {
      const preferences = forceAllPresetModulesVisible(presetId);
      const tidied = tidyWorkspaceLayout(preferences, { width: 1440, height: 900 });
      const visibleModules = tidied.enabledModules.filter(
        (moduleId) => !tidied.moduleLayout[moduleId]?.collapsed,
      );
      const visibleFrames = visibleModules.map((moduleId) => ({
        moduleId,
        frame: tidied.windowLayout[moduleId]!,
      }));

      expect(visibleModules, presetId).toEqual(
        selectWorkspacePresetVisibleModules(presetId, {
          viewport: { width: 1440, height: 900 },
          availability: { desmosApiKeyAvailable: true },
        }),
      );
      visibleFrames.forEach(({ frame, moduleId }) => {
        expect(frame, `${presetId}/${moduleId} should have a frame`).toBeDefined();
        expect(frame.x + frame.w, `${presetId}/${moduleId} offscreen x`).toBeLessThanOrEqual(1440);
        expect(frame.y + frame.h, `${presetId}/${moduleId} offscreen y`).toBeLessThanOrEqual(900);
        expect(frame.w, `${presetId}/${moduleId} too narrow`).toBeGreaterThanOrEqual(
          moduleId === "lesson" || moduleId === "private-notes" || moduleId === "desmos-graph"
            ? 420
            : 300,
        );
        expect(frame.h, `${presetId}/${moduleId} too short`).toBeGreaterThanOrEqual(220);
      });
      expect(hasTinyBottomStrip(visibleFrames.map((entry) => entry.frame))).toBe(false);
    });
  });

  it("keeps history canvas presets focused on readable study zones by default", () => {
    expect(visiblePresetModules("history-guided")).toEqual([
      "lesson",
      "history-timeline",
      "history-evidence",
      "private-notes",
    ]);
    expect(collapsedPresetModules("history-guided")).toEqual(
      expect.arrayContaining(["history-argument", "history-myth-checks"]),
    );

    expect(visiblePresetModules("history-timeline-focus")).toEqual([
      "history-timeline",
      "lesson",
      "private-notes",
    ]);
    expect(collapsedPresetModules("history-timeline-focus")).toEqual(
      expect.arrayContaining(["history-evidence", "history-argument", "history-myth-checks"]),
    );

    expect(visiblePresetModules("history-source-evidence")).toEqual([
      "lesson",
      "history-evidence",
      "private-notes",
    ]);
    expect(collapsedPresetModules("history-source-evidence")).toEqual(
      expect.arrayContaining(["history-timeline", "history-argument", "history-myth-checks"]),
    );

    expect(visiblePresetModules("history-argument-builder")).toEqual([
      "history-argument",
      "history-evidence",
      "lesson",
    ]);
    expect(collapsedPresetModules("history-argument-builder")).toEqual(
      expect.arrayContaining(["history-timeline", "private-notes", "history-myth-checks"]),
    );

    expect(visiblePresetModules("history-full-studio")).toEqual([
      "lesson",
      "history-timeline",
      "history-evidence",
      "history-argument",
    ]);
    expect(collapsedPresetModules("history-full-studio")).toEqual(
      expect.arrayContaining(["private-notes", "history-myth-checks"]),
    );
  });

  it("tidies history presets into purpose-built compositions with the right dominant module", () => {
    const expectations: Array<{
      presetId: WorkspacePresetId;
      primary: WorkspaceModuleId;
      secondary: WorkspaceModuleId[];
    }> = [
      { presetId: "history-guided", primary: "lesson", secondary: ["history-timeline", "history-evidence", "private-notes"] },
      { presetId: "history-timeline-focus", primary: "history-timeline", secondary: ["lesson", "private-notes"] },
      { presetId: "history-source-evidence", primary: "history-evidence", secondary: ["lesson", "private-notes"] },
      { presetId: "history-argument-builder", primary: "history-argument", secondary: ["history-evidence", "lesson"] },
      { presetId: "history-full-studio", primary: "history-argument", secondary: ["lesson", "history-timeline", "history-evidence"] },
    ];

    expectations.forEach(({ presetId, primary, secondary }) => {
      const tidied = tidyWorkspaceLayout(forceAllPresetModulesVisible(presetId), {
        width: 1440,
        height: 900,
      });
      const visibleModules = tidied.enabledModules.filter(
        (moduleId) => !tidied.moduleLayout[moduleId]?.collapsed,
      );
      const primaryFrame = tidied.windowLayout[primary]!;
      const secondaryFrames = secondary.map((moduleId) => tidied.windowLayout[moduleId]!);

      expect(visibleModules, presetId).toEqual(
        selectWorkspacePresetVisibleModules(presetId, {
          viewport: { width: 1440, height: 900 },
          availability: { desmosApiKeyAvailable: true },
        }),
      );
      expect(primaryFrame, `${presetId}/${primary} frame`).toBeDefined();
      secondaryFrames.forEach((frame, index) => {
        const moduleId = secondary[index];
        const minimum = getWorkspaceModuleMinimumSize(moduleId);
        expect(frame.w, `${presetId}/${moduleId} width`).toBeGreaterThanOrEqual(minimum.width);
        expect(frame.h, `${presetId}/${moduleId} height`).toBeGreaterThanOrEqual(minimum.height);
      });
      expect(hasTinyBottomStrip(visibleModules.map((moduleId) => tidied.windowLayout[moduleId]!))).toBe(false);

      if (
        presetId !== "history-guided" &&
        presetId !== "history-source-evidence" &&
        presetId !== "history-full-studio"
      ) {
        const largestSecondaryArea = Math.max(...secondaryFrames.map(frameArea));
        expect(frameArea(primaryFrame), `${presetId}/${primary} should dominate`).toBeGreaterThan(
          largestSecondaryArea,
        );
      }
    });
  });

  it("tidies every designed preset into readable frames across laptop viewports", () => {
    const presets: WorkspacePresetId[] = [
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
    const viewports = [
      { width: 1366, height: 768 },
      { width: 1280, height: 720 },
      { width: 1024, height: 700 },
    ];

    presets.forEach((presetId) => {
      viewports.forEach((viewport) => {
        const preferences = forceAllPresetModulesVisible(presetId);
        const tidied = tidyWorkspaceLayout(preferences, viewport);
        const expectedVisible = selectWorkspacePresetVisibleModules(presetId, {
          viewport,
          availability: { desmosApiKeyAvailable: true },
        });
        const visibleModules = tidied.enabledModules.filter(
          (moduleId) => !tidied.moduleLayout[moduleId]?.collapsed,
        );
        const visibleFrames = visibleModules.map((moduleId) => ({
          moduleId,
          frame: tidied.windowLayout[moduleId]!,
        }));

        expect(visibleModules, `${presetId}/${viewport.width}`).toEqual(expectedVisible);
        visibleFrames.forEach(({ moduleId, frame }) => {
          const minimum = getWorkspaceModuleMinimumSize(
            moduleId,
            (getWorkspacePresetDesign(presetId).primary as readonly WorkspaceModuleId[]).includes(moduleId)
              ? "primary"
              : "secondary",
          );
          expect(frame.x, `${presetId}/${moduleId} x`).toBeGreaterThanOrEqual(0);
          expect(frame.y, `${presetId}/${moduleId} y`).toBeGreaterThanOrEqual(0);
          expect(frame.x + frame.w, `${presetId}/${moduleId} offscreen x`).toBeLessThanOrEqual(viewport.width);
          expect(frame.y + frame.h, `${presetId}/${moduleId} offscreen y`).toBeLessThanOrEqual(viewport.height);
          expect(frame.w, `${presetId}/${moduleId} too narrow`).toBeGreaterThanOrEqual(minimum.width);
          expect(frame.h, `${presetId}/${moduleId} too short`).toBeGreaterThanOrEqual(minimum.height);
        });
        expect(hasTinyBottomStrip(visibleFrames.map((entry) => entry.frame))).toBe(false);
      });
    });
  });

  it("fits designed presets by preserving their composition instead of generic packing", () => {
    const preferences = forceAllPresetModulesVisible("history-timeline-focus");
    const packedInsideViewport = {
      ...preferences,
      windowLayout: {
        "history-timeline": { x: 0, y: 0, w: 1366, h: 420, z: 1 },
        lesson: { x: 0, y: 436, w: 320, h: 240, z: 2 },
        "private-notes": { x: 336, y: 436, w: 320, h: 240, z: 3 },
        "history-evidence": { x: 672, y: 436, w: 320, h: 240, z: 4 },
        "history-argument": { x: 1008, y: 436, w: 320, h: 240, z: 5 },
      },
    };

    const fitted = fitWorkspaceToViewport(
      packedInsideViewport,
      { width: 1366, height: 768 },
      { force: true },
    );
    const visibleModules = fitted.enabledModules.filter(
      (moduleId) => !fitted.moduleLayout[moduleId]?.collapsed,
    );
    const visibleFrames = visibleModules.map((moduleId) => fitted.windowLayout[moduleId]!);

    expect(visibleModules).toEqual(["history-timeline", "lesson", "private-notes"]);
    expect(fitted.windowLayout["history-timeline"]!.w).toBeGreaterThan(
      fitted.windowLayout.lesson!.w,
    );
    expect(hasTinyBottomStrip(visibleFrames)).toBe(false);
  });

  it("fits tall preset layouts into the visible viewport without unreadable panels", () => {
    const preferences = applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "annotation-mode");
    const fitted = fitWorkspaceToViewport(preferences, { width: 1280, height: 820 }, { force: true });
    const lessonWindow = fitted.windowLayout.lesson;
    const notesWindow = fitted.windowLayout["private-notes"];

    expect(lessonWindow).toBeDefined();
    expect(notesWindow).toBeDefined();
    expect(lessonWindow!.h).toBeGreaterThanOrEqual(360);
    expect(notesWindow!.h).toBeGreaterThanOrEqual(360);
    expect(lessonWindow!.x + lessonWindow!.w).toBeLessThanOrEqual(1280);
    expect(notesWindow!.y + notesWindow!.h).toBeLessThanOrEqual(820);
  });

  it("packs wide presets close to the canvas edges instead of leaving large side gutters", () => {
    const preferences = applyWorkspaceStyle(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "full-studio",
    );
    const next = applyPreset(preferences, "math-study");
    const fitted = fitWorkspaceToViewport(next, { width: 2048, height: 1220 });
    const frames = Object.values(fitted.windowLayout).filter(Boolean);
    const minX = Math.min(...frames.map((frame) => frame.x));
    const maxX = Math.max(...frames.map((frame) => frame.x + frame.w));

    expect(minX).toBeLessThanOrEqual(20);
    expect(maxX).toBeGreaterThanOrEqual(1980);
  });

  it("tidies a broken layout instead of returning the same broken frames", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const broken = {
      ...preferences,
      preset: "split-study" as WorkspacePresetId,
      enabledModules: ["lesson", "private-notes"] as WorkspaceModuleId[],
      windowLayout: {
        lesson: { x: 1400, y: 600, w: 360, h: 260, z: 1 },
        "private-notes": { x: 1420, y: 620, w: 360, h: 260, z: 2 },
      },
    };

    const tidied = tidyWorkspaceLayout(broken, { width: 1180, height: 760 });

    expect(tidied.windowLayout).not.toEqual(broken.windowLayout);
    expect(tidied.windowLayout.lesson?.x).toBeLessThanOrEqual(16);
    expect(tidied.windowLayout["private-notes"]?.x).toBeGreaterThanOrEqual(
      tidied.windowLayout.lesson!.x + tidied.windowLayout.lesson!.w,
    );
    expect(tidied.windowLayout.lesson!.y + tidied.windowLayout.lesson!.h).toBeLessThanOrEqual(760);
    expect(
      tidied.windowLayout["private-notes"]!.y + tidied.windowLayout["private-notes"]!.h,
    ).toBeLessThanOrEqual(760);
  });

  it("keeps the math graph lab preset intentionally connected without post-load injection", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });

    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    saveWorkspacePreferences(applyPreset(preferences, "math-study"));
    const reloaded = loadWorkspacePreferences("user-1", "binder-1");

    expect(reloaded.enabledModules).toEqual([
      "desmos-graph",
      "lesson",
      "private-notes",
      "formula-sheet",
      "saved-graphs",
      "scientific-calculator",
      "math-blocks",
      "whiteboard",
    ]);
    expect(reloaded.moduleLayout["saved-graphs"]?.collapsed).toBe(true);
    expect(reloaded.moduleLayout["scientific-calculator"]?.collapsed).toBe(true);
    expect(reloaded.moduleLayout["math-blocks"]?.collapsed).toBe(true);
    expect(reloaded.moduleLayout.whiteboard?.collapsed).toBe(true);
  });

  it("can inject math modules into an existing workspace", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const next = ensureMathWorkspaceModules(preferences);

    expect(next.enabledModules).toContain("scientific-calculator");
    expect(next.enabledModules).not.toContain("saved-graphs");
    expect(next.windowLayout["scientific-calculator"]).toBeDefined();
    expect(next.windowLayout["desmos-graph"]).toBeDefined();
  });

  it("preserves locked user-sized windows even when they overlap until Fit or Tidy is explicit", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const lessonFrame = { x: 40, y: 40, w: 900, h: 700, z: 1 };
    const notesFrame = { x: 60, y: 60, w: 900, h: 700, z: 2 };
    const overlapping = {
      ...preferences,
      locked: true as const,
      windowLayout: {
        ...preferences.windowLayout,
        lesson: lessonFrame,
        "private-notes": notesFrame,
      },
    };

    const next = ensureWindowFramesForEnabledModules(overlapping);

    expect(next.windowLayout.lesson).toEqual(lessonFrame);
    expect(next.windowLayout["private-notes"]).toEqual(notesFrame);
  });

  it("migrates legacy graph-panel layouts to the Desmos graph module", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });

    window.localStorage.setItem(
      "binder-notes:workspace:v1:user-legacy:binder-legacy",
      JSON.stringify({
        version: 1,
        userId: "user-legacy",
        binderId: "binder-legacy",
        locked: true,
        preset: "creator-mode",
        enabledModules: ["lesson", "graph-panel"],
        zones: {
          "left-rail": [],
          "center-left": ["lesson"],
          "center-right": [],
          "right-rail": ["graph-panel"],
          bottom: [],
        },
        paneLayout: {
          leftRail: 14,
          centerLeft: 42,
          centerRight: 30,
          rightRail: 14,
        },
        moduleLayout: {
          lesson: { span: "wide" },
          "graph-panel": { span: "wide" },
        },
        windowLayout: {},
        stickyNotes: {},
        theme: {
          id: "paper-studio",
          accent: "172 82% 27%",
          density: "cozy",
          roundness: "round",
          shadow: "lifted",
          font: "system",
        },
        updatedAt: new Date().toISOString(),
      }),
    );

    const migrated = loadWorkspacePreferences("user-legacy", "binder-legacy");

    expect(migrated.enabledModules).toContain("desmos-graph");
    expect(migrated.enabledModules).not.toContain("graph-panel");
    expect(migrated.windowLayout["desmos-graph"]).toBeDefined();
  });

  it("fills in new global theme defaults when loading an older theme payload", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });

    window.localStorage.setItem(
      "binder-notes:theme:v1",
      JSON.stringify({
        id: "space",
        accent: "212 86% 52%",
        density: "compact",
        roundness: "soft",
        shadow: "quiet",
        font: "mono",
      }),
    );

    const preferences = loadWorkspacePreferences("user-theme", "binder-theme");

    expect(preferences.theme.id).toBe("space");
    expect(preferences.theme.font).toBe("mono");
    expect(preferences.theme.backgroundStyle).toBe(defaultThemeSettings.backgroundStyle);
    expect(preferences.theme.graphAppearance).toBe(defaultThemeSettings.graphAppearance);
    expect(preferences.theme.verticalSpace).toBe(defaultThemeSettings.verticalSpace);
    expect(preferences.theme.compactMode).toBe(true);
    expect(preferences.theme.showUtilityUi).toBe(defaultThemeSettings.showUtilityUi);
  });

  it("uses the global theme for workspace colors unless local color saving is enabled", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });

    window.localStorage.setItem(
      "binder-notes:theme:v1",
      JSON.stringify({
        ...defaultThemeSettings,
        id: "space",
        studySurface: "night-study",
        focusMode: true,
      }),
    );
    const saved = createDefaultWorkspacePreferences("user-theme", "binder-theme");
    const normalized = normalizeWorkspacePreferences({
      ...saved,
      theme: {
        ...saved.theme,
        id: "paper-studio",
        studySurface: "warm-paper",
        focusMode: false,
      },
    });
    const inherited = applyGlobalAppearanceToWorkspace(normalized);

    expect(normalized.theme.id).toBe("paper-studio");
    expect(normalized.theme.studySurface).toBe("night-study");
    expect(inherited.theme.id).toBe("space");
    expect(inherited.theme.studySurface).toBe("night-study");
    expect(inherited.appearance.saveLocalAppearance).toBe(false);
    expect(normalized.theme.focusMode).toBe(false);
    expect(loadWorkspacePreferences("missing-user", "missing-binder").theme.focusMode).toBe(false);
  });

  it("keeps explicit workspace colors when local color saving is enabled", () => {
    const preferences = updateWorkspaceAppearance(
      createDefaultWorkspacePreferences("user-theme", "binder-theme"),
      {
        appTheme: "ocean",
        studySurface: "warm-paper",
        saveLocalAppearance: true,
      },
    );

    expect(preferences.appearance.saveLocalAppearance).toBe(true);
    expect(preferences.theme.id).toBe("ocean");
    expect(preferences.theme.studySurface).toBe("warm-paper");
  });

  it("applies theme datasets for workspace behavior controls", () => {
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: {
        colorScheme: "",
        setProperty: vi.fn(),
      },
      classList: {
        toggle: vi.fn(),
      },
    };
    vi.stubGlobal("document", { documentElement });

    applyThemeSettings({
      ...defaultThemeSettings,
      backgroundStyle: "graph-paper",
      hoverMotion: true,
      snapMode: false,
      focusMode: true,
      compactMode: true,
      animationLevel: "none",
      graphAppearance: "dark",
      graphChrome: "focused",
      verticalSpace: "extended",
      reducedChrome: false,
      showUtilityUi: true,
    });

    expect(documentElement.dataset.workspaceBackground).toBe("graph-paper");
    expect(documentElement.dataset.workspaceHoverMotion).toBe("on");
    expect(documentElement.dataset.workspaceSnapMode).toBe("off");
    expect(documentElement.dataset.workspaceFocusMode).toBe("on");
    expect(documentElement.dataset.workspaceCompactMode).toBe("on");
    expect(documentElement.dataset.workspaceAnimation).toBe("none");
    expect(documentElement.dataset.workspaceGraphAppearance).toBe("dark");
    expect(documentElement.dataset.workspaceGraphChrome).toBe("focused");
    expect(documentElement.dataset.workspaceVerticalSpace).toBe("extended");
    expect(documentElement.dataset.workspaceHighlightColor).toBe("yellow");
    expect(documentElement.dataset.workspaceReducedChrome).toBe("off");
    expect(documentElement.dataset.workspaceUtilityUi).toBe("on");
    expect(documentElement.dataset.studySurface).toBe("match");
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--bg-app", expect.any(String));
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--accent-primary", expect.any(String));
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--study-bg", expect.any(String));
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--study-surface", expect.any(String));
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--study-accent", expect.any(String));
  });

  it("applies a custom three-color palette through the shared theme tokens", () => {
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: {
        colorScheme: "",
        setProperty: vi.fn(),
      },
      classList: {
        toggle: vi.fn(),
      },
    };
    vi.stubGlobal("document", { documentElement });

    applyThemeSettings({
      ...defaultThemeSettings,
      id: "custom",
      studySurface: "custom",
      customPalette: {
        ...defaultCustomPalette,
        primary: "#2563eb",
        secondary: "#111827",
        accent: "#f59e0b",
        sourceTheme: "space",
      },
    });

    expect(documentElement.dataset.workspaceTheme).toBe("custom");
    expect(documentElement.dataset.workspaceCustomPalette).toBe("on");
    expect(documentElement.dataset.studySurface).toBe("custom");
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--primary", "221 83% 54%");
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--bg-app", "221 39% 8%");
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--bg-surface", "221 36% 12%");
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--accent-secondary", "38 70% 24%");
    expect(documentElement.style.setProperty).toHaveBeenCalledWith("--study-accent", "221 83% 54%");
  });
});

function frameArea(frame: WorkspaceWindowFrame) {
  return frame.w * frame.h;
}

function visiblePresetModules(presetId: WorkspacePresetId, style: WorkspaceStyle = "full-studio") {
  const layout = resolveWorkspacePresetLayout(presetId, style);
  return layout.enabledModules.filter((moduleId) => !layout.moduleLayout?.[moduleId]?.collapsed);
}

function collapsedPresetModules(presetId: WorkspacePresetId, style: WorkspaceStyle = "full-studio") {
  const layout = resolveWorkspacePresetLayout(presetId, style);
  return layout.enabledModules.filter((moduleId) => layout.moduleLayout?.[moduleId]?.collapsed);
}

function forceAllPresetModulesVisible(presetId: WorkspacePresetId) {
  const preferences = applyWorkspaceMode(
    applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), presetId),
    "canvas",
  );
  const layout = resolveWorkspacePresetLayout(presetId, "full-studio");
  const allModulesVisible = Object.fromEntries(
    layout.enabledModules.map((moduleId) => [
      moduleId,
      {
        ...(preferences.moduleLayout[moduleId] ?? { span: "auto" as const }),
        collapsed: false,
      },
    ]),
  ) as typeof preferences.moduleLayout;

  return {
    ...preferences,
    preset: presetId,
    enabledModules: layout.enabledModules,
    moduleLayout: {
      ...preferences.moduleLayout,
      ...allModulesVisible,
    },
    windowLayout: Object.fromEntries(
      layout.enabledModules.map((moduleId, index) => [
        moduleId,
        { x: 1200 + index * 18, y: 620 + index * 14, w: 280, h: 190, z: index + 1 },
      ]),
    ) as typeof preferences.windowLayout,
  };
}

function hasTinyBottomStrip(frames: WorkspaceWindowFrame[]) {
  if (frames.length < 4) {
    return false;
  }

  const bottomRows = new Map<number, WorkspaceWindowFrame[]>();
  frames.forEach((frame) => {
    const key = Math.round(frame.y / 24) * 24;
    bottomRows.set(key, [...(bottomRows.get(key) ?? []), frame]);
  });

  return [...bottomRows.entries()].some(([rowY, rowFrames]) => {
    const narrowFrames = rowFrames.filter((frame) => frame.w < 340 || frame.h < 240);
    return rowY > 500 && rowFrames.length >= 3 && narrowFrames.length >= 2;
  });
}

function framesOverlap(left: WorkspaceWindowFrame, right: WorkspaceWindowFrame) {
  return !(
    left.x + left.w <= right.x ||
    right.x + right.w <= left.x ||
    left.y + left.h <= right.y ||
    right.y + right.h <= left.y
  );
}
