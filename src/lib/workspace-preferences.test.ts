import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyThemeSettings,
  applyPreset,
  applyWorkspaceStyle,
  createDefaultWorkspacePreferences,
  defaultThemeSettings,
  ensureMathWorkspaceModules,
  ensureWindowFramesForEnabledModules,
  fitWorkspaceToViewport,
  loadWorkspacePreferences,
  resolveWorkspacePresetLayout,
  saveWorkspacePreferences,
} from "@/lib/workspace-preferences";
import type { WorkspacePresetId, WorkspaceStyle, WorkspaceWindowFrame } from "@/types";

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
    expect(preferences.styleChoiceCompleted).toBe(false);
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
    expect(fullStudio.locked).toBe(false);
    expect(fullStudio.styleChoiceCompleted).toBe(true);
    expect(fullStudio.windowLayout.lesson).toBeDefined();
    expect(fullStudio.windowLayout["private-notes"]).toBeDefined();
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

    expect(next.enabledModules).toEqual(["lesson", "private-notes"]);
    expect(lessonWindow).toBeDefined();
    expect(privateNotesWindow).toBeDefined();
    expect(lessonWindow!.w).toBeGreaterThanOrEqual(900);
    expect(privateNotesWindow!.w).toBeGreaterThanOrEqual(900);
    expect(lessonWindow!.h).toBeGreaterThanOrEqual(1300);
    expect(privateNotesWindow!.h).toBeGreaterThanOrEqual(1300);
  });

  it("resolves the same preset differently for each workspace style", () => {
    const guided = resolveWorkspacePresetLayout("annotation-mode", "guided");
    const flexible = resolveWorkspacePresetLayout("annotation-mode", "flexible");
    const studio = resolveWorkspacePresetLayout("annotation-mode", "full-studio");

    expect(guided.enabledModules).not.toEqual(studio.enabledModules);
    expect(flexible.enabledModules).not.toEqual(studio.enabledModules);
    expect(flexible.enabledModules).not.toContain("search");
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

      const annotation = resolveWorkspacePresetLayout("annotation-mode", style);
      expect(frameArea(annotation.windowLayout!.lesson!)).toBeGreaterThan(
        frameArea(annotation.windowLayout!["private-notes"]!) * 3,
      );
    });
  });

  it("keeps tall preset layouts vertically expansive when the workspace allows scroll", () => {
    const preferences = applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "annotation-mode");
    const fitted = fitWorkspaceToViewport(preferences, { width: 1280, height: 820 });
    const lessonWindow = fitted.windowLayout.lesson;
    const notesWindow = fitted.windowLayout["private-notes"];

    expect(lessonWindow).toBeDefined();
    expect(notesWindow).toBeDefined();
    expect(lessonWindow!.h).toBeGreaterThanOrEqual(880);
    expect(lessonWindow!.y + lessonWindow!.h).toBeGreaterThan(900);
    expect(notesWindow!.y).toBeGreaterThan(0);
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

  it("does not auto-inject extra math windows when math study is chosen", () => {
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
      "lesson",
      "private-notes",
      "desmos-graph",
      "scientific-calculator",
    ]);
    expect(reloaded.enabledModules).not.toContain("saved-graphs");
  });

  it("can inject math modules into an existing workspace", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const next = ensureMathWorkspaceModules(preferences);

    expect(next.enabledModules).toContain("scientific-calculator");
    expect(next.enabledModules).not.toContain("saved-graphs");
    expect(next.windowLayout["scientific-calculator"]).toBeDefined();
    expect(next.windowLayout["desmos-graph"]).toBeDefined();
  });

  it("reconciles overlapping locked windows to a stable non-overlapping layout", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const overlapping = {
      ...preferences,
      locked: true as const,
      windowLayout: {
        ...preferences.windowLayout,
        lesson: { x: 40, y: 40, w: 900, h: 700, z: 1 },
        "private-notes": { x: 60, y: 60, w: 900, h: 700, z: 2 },
      },
    };

    const next = ensureWindowFramesForEnabledModules(overlapping);

    expect(next.windowLayout.lesson).toBeDefined();
    expect(next.windowLayout["private-notes"]).toBeDefined();
    expect(
      framesOverlap(next.windowLayout.lesson!, next.windowLayout["private-notes"]!),
    ).toBe(false);
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
    expect(preferences.theme.showUtilityUi).toBe(defaultThemeSettings.showUtilityUi);
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
  });
});

function frameArea(frame: WorkspaceWindowFrame) {
  return frame.w * frame.h;
}

function framesOverlap(left: WorkspaceWindowFrame, right: WorkspaceWindowFrame) {
  return !(
    left.x + left.w <= right.x ||
    right.x + right.w <= left.x ||
    left.y + left.h <= right.y ||
    right.y + right.h <= left.y
  );
}
