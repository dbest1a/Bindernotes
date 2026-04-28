import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  accentOptions,
  animationLevelOptions,
  applyPresetToViewport,
  applyWorkspaceModeToViewport,
  backgroundStyleOptions,
  densityOptions,
  ensureWindowFramesForEnabledModules,
  fontOptions,
  getVisibleWorkspacePresets,
  graphAppearanceOptions,
  graphChromeOptions,
  highlightColorOptions,
  roundnessOptions,
  shadowOptions,
  updateWorkspaceAppearance,
  verticalSpaceOptions,
  workspaceModules,
  workspaceModeOptions,
  workspaceThemes,
} from "@/lib/workspace-preferences";
import type {
  AccentColor,
  AppearanceCustomPalette,
  WorkspaceMode,
  WorkspaceModuleId,
  WorkspacePreferences,
  WorkspaceThemeId,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkspaceSettingsProps = {
  preferences: WorkspacePreferences;
  onChange: (preferences: WorkspacePreferences) => void;
  onClose?: () => void;
  onResetBinderHighlights?: () => Promise<void> | void;
  onResetLessonHighlights?: () => Promise<void> | void;
  binderTitle?: string;
  binderSubject?: string;
  lessonTitle?: string;
  historyEnabled?: boolean;
  isResettingHighlights?: boolean;
  mode?: "layout" | "preferences";
};

const backgroundLabels = {
  none: "None",
  "subtle-grid": "Subtle grid",
  "graph-paper": "Graph paper",
  "dot-grid": "Dot grid",
} as const;

const animationLabels = {
  none: "No motion",
  subtle: "Subtle",
  full: "Full",
} as const;

const graphAppearanceLabels = {
  sync: "Sync theme",
  light: "Light",
  dark: "Dark",
} as const;

const graphChromeLabels = {
  standard: "Standard",
  focused: "Focused",
} as const;

const verticalSpaceLabels = {
  fit: "Fit to viewport height",
  balanced: "Balanced vertical space",
  extended: "Extended vertical workspace",
  infinite: "Infinite vertical canvas",
} as const;

const settingsSearchAliases = {
  snap: ["snap", "alignment", "magnet", "grid"],
  safeEdgePadding: ["safe", "padding", "bezel", "edge", "corner", "margin", "edge margin"],
  fit: ["fit", "fit visible", "fit to screen", "viewport", "screen"],
  tidy: ["tidy", "tidy layout", "layout", "arrange", "clean"],
  preset: ["preset", "layout", "mode", "composition", "fit", "tidy", "reset"],
  theme: ["theme", "appearance", "color", "surface", "study surface"],
  graph: ["graph", "desmos", "calculator", "scientific calculator", "math"],
  mobile: ["phone", "mobile", "tablet", "responsive", "small screen", "touch"],
  header: ["header", "space", "compact", "maximize", "chrome", "module", "source", "lesson", "notes"],
  whiteboard: ["whiteboard", "board", "canvas", "drawing", "sketch", "module", "math board"],
  launcher: ["launcher", "module launcher", "canvas launcher", "side menu", "selected module", "inspector", "builder", "launch"],
} as const;

type SettingsFolderId =
  | "layout-presets"
  | "edit-layout"
  | "snapping-canvas"
  | "module-display"
  | "colors-study-surface"
  | "motion-performance"
  | "tools-modules"
  | "advanced";

const settingsFolderStoragePrefix = "bindernotes.workspace-settings.folders";

export function WorkspaceSettings({
  mode = "layout",
  onChange,
  onClose,
  onResetBinderHighlights,
  onResetLessonHighlights,
  binderTitle,
  binderSubject,
  historyEnabled = false,
  isResettingHighlights = false,
  lessonTitle,
  preferences,
}: WorkspaceSettingsProps) {
  const [showAdvancedCustomization, setShowAdvancedCustomization] = useState(mode === "layout");
  const [settingsQuery, setSettingsQuery] = useState("");
  const deferredSettingsQuery = useDeferredValue(settingsQuery);
  const isLayoutMode = mode === "layout";
  const isCanvas = preferences.activeMode === "canvas";
  const isModular = preferences.activeMode === "modular";
  const isFullStudio = isCanvas || preferences.workspaceStyle === "full-studio";
  const isGuided = preferences.workspaceStyle === "guided";
  const hasAdvancedCustomization = showAdvancedCustomization || isLayoutMode;
  const normalizedSettingsQuery = useMemo(() => normalizeSearch(deferredSettingsQuery), [deferredSettingsQuery]);
  const isSearchingSettings = normalizedSettingsQuery.length > 0;
  const defaultExpandedFolders = useMemo<Record<SettingsFolderId, boolean>>(
    () => ({
      "layout-presets": true,
      "edit-layout": isLayoutMode,
      "snapping-canvas": isLayoutMode && isCanvas,
      "module-display": true,
      "colors-study-surface": true,
      "motion-performance": false,
      "tools-modules": false,
      advanced: false,
    }),
    [isCanvas, isLayoutMode],
  );
  const folderStorageKey = `${settingsFolderStoragePrefix}:${mode}`;
  const [expandedFolders, setExpandedFolders] = useState<Record<SettingsFolderId, boolean>>(() =>
    loadSettingsFolderState(folderStorageKey, defaultExpandedFolders),
  );

  useEffect(() => {
    setExpandedFolders((current) => ({
      ...defaultExpandedFolders,
      ...current,
    }));
  }, [defaultExpandedFolders]);

  useEffect(() => {
    saveSettingsFolderState(folderStorageKey, expandedFolders);
  }, [expandedFolders, folderStorageKey]);

  const visiblePresets = useMemo(
    () =>
      getVisibleWorkspacePresets(preferences, {
        binderSubject,
        historyEnabled,
        includeAdvanced: hasAdvancedCustomization,
      }),
    [binderSubject, hasAdvancedCustomization, historyEnabled, preferences],
  );
  const matchesSetting = (terms: Array<string | undefined | null>) =>
    matchesSettingsSearch(normalizedSettingsQuery, terms);
  const folderMatches = (
    title: string,
    description: string,
    aliasKeys: Array<keyof typeof settingsSearchAliases> = [],
  ) =>
    isSearchingSettings &&
    matchesSetting([
      title,
      description,
      ...aliasKeys.flatMap((key) => aliases(key)),
    ]);
  const layoutPresetsFolderMatch = folderMatches(
    "Layout & Presets",
    "Workspace mode, presets, fit, tidy, and reset to preset controls.",
    ["preset", "fit", "tidy"],
  );
  const editLayoutFolderMatch = folderMatches(
    "Edit Layout",
    "Edit layout mode controls, module inspector, save layout, cancel, add module, and add space below.",
    ["preset", "header", "launcher"],
  );
  const snappingCanvasFolderMatch = folderMatches(
    "Snapping & Canvas",
    "Snap Mode, Safe Edge Padding, grid, alignment, and canvas height controls.",
    ["snap", "safeEdgePadding", "fit", "whiteboard"],
  );
  const moduleDisplayFolderMatch = folderMatches(
    "Module Display",
    "Maximize module space, compact headers, panel density, chrome, source lesson, and notes display.",
    ["header", "mobile"],
  );
  const colorsFolderMatch = folderMatches(
    "Colors & Study Surface",
    "Theme, study surface, color scheme, app theme matching, and surface presets.",
    ["theme"],
  );
  const motionFolderMatch = folderMatches(
    "Motion & Performance",
    "Animation controls, reduced motion, performance, and responsive phone, mobile, and tablet behavior.",
    ["mobile"],
  );
  const toolsFolderMatch = folderMatches(
    "Tools & Modules",
    "Desmos graph, calculator, notes tools, history, math, and module toggles.",
    ["graph", "header", "whiteboard"],
  );
  const advancedFolderMatch = folderMatches(
    "Advanced",
    "Power-user customization and diagnostics-like workspace settings.",
    ["header"],
  );
  const showStudyModeSettings = matchesSetting([
    "Study mode",
    "workspace control",
    "Simple View",
    "Study Panels",
    "Canvas",
    ...aliases("mobile"),
  ]);
  const showPresetSettings = matchesSetting([
    "Presets",
    "Start from a mode",
    ...visiblePresets.flatMap((preset) => [preset.name, preset.description]),
    ...aliases("preset", "fit", "tidy"),
  ]);
  const showCustomizationDepthSettings = matchesSetting([
    "Customization depth",
    "full canvas",
    "module controls",
    "advanced",
    ...aliases("preset"),
  ]);
  const showStudyPanelSettings = isModular && matchesSetting([
    "Study panels",
    "Panel density",
    "Side panel",
    "Save layout per binder",
    "compact",
    "responsive",
    ...aliases("mobile", "header"),
  ]);
  const showColorSettings = matchesSetting([
    "Colors & Study Surface",
    "Workspace colors",
    "App Theme",
    "Accent",
    "Custom colors",
    "study surface",
    ...aliases("theme"),
  ]);
  const showModuleDisplaySettings = matchesSetting([
    "Module Display",
    "Density",
    "Maximize module space",
    "Compact module headers",
    "Roundness",
    "Shadow",
    "Font",
    ...aliases("header", "mobile"),
  ]);
  const showMotionSettings = matchesSetting([
    "Motion & Performance",
    "Motion",
    "Animation level",
    "Hover motion",
    "reduced motion",
    "performance",
  ]);
  const showResponsiveSettings = matchesSetting([
    "Responsive layout",
    "Phone and tablet layouts adapt automatically so settings stay touch-friendly.",
    ...aliases("mobile"),
  ]);
  const showCanvasSettings = isCanvas && matchesSetting([
    "Snapping & Canvas",
    "Canvas / workspace",
    "Background",
    "Vertical workspace",
    "Snap mode",
    "Safe edge padding",
    "Focus mode",
    "Whiteboard",
    "phone",
    "mobile",
    ...aliases("snap", "safeEdgePadding", "fit", "tidy", "mobile", "whiteboard"),
  ]);
  const showGraphSettings = matchesSetting([
    "Tools & Modules",
    "Graphs",
    "Graph appearance",
    "Graph chrome",
    ...aliases("graph"),
  ]);
  const showHighlightSettings = matchesSetting([
    "Tools & Modules",
    "Highlights",
    "Default highlight meaning",
    "Reset highlights",
  ]);
  const showAdvancedSettings = hasAdvancedCustomization && matchesSetting([
    "Advanced",
    "Sticky notes",
    "Reduced chrome",
    "Utility UI",
    "Canvas launcher",
    "header",
    "space",
    ...aliases("header", "launcher"),
  ]);
  const showLayoutSettings =
    hasAdvancedCustomization &&
    isLayoutMode &&
    !isGuided &&
    matchesSetting([
      "Edit Layout",
      "Layout",
      "Show or hide windows",
      "collapse",
      "hide",
      "module",
      "Canvas launcher",
      "Module launcher",
      "Selected module",
      "Launch modules from the side menu or the wide canvas launcher.",
      ...aliases("launcher"),
      ...workspaceModules.flatMap((module) => [module.name, module.description]),
    ]);
  const renderStudyModeSettings = showStudyModeSettings || layoutPresetsFolderMatch;
  const renderPresetSettings = showPresetSettings || layoutPresetsFolderMatch;
  const renderCustomizationDepthSettings =
    showCustomizationDepthSettings || layoutPresetsFolderMatch;
  const renderStudyPanelSettings = showStudyPanelSettings || moduleDisplayFolderMatch;
  const renderColorSettings = showColorSettings || colorsFolderMatch;
  const renderModuleDisplaySettings = showModuleDisplaySettings || moduleDisplayFolderMatch;
  const renderMotionSettings = showMotionSettings || motionFolderMatch;
  const renderResponsiveSettings = showResponsiveSettings || motionFolderMatch;
  const renderCanvasSettings = showCanvasSettings || snappingCanvasFolderMatch;
  const renderGraphSettings = showGraphSettings || toolsFolderMatch;
  const renderHighlightSettings = showHighlightSettings || toolsFolderMatch;
  const renderAdvancedSettings = showAdvancedSettings || (hasAdvancedCustomization && advancedFolderMatch);
  const renderLayoutSettings = showLayoutSettings || editLayoutFolderMatch;
  const layoutPresetsFolderVisible =
    renderStudyModeSettings || renderPresetSettings || renderCustomizationDepthSettings;
  const editLayoutFolderVisible = isLayoutMode && renderLayoutSettings;
  const snappingCanvasFolderVisible = renderCanvasSettings;
  const moduleDisplayFolderVisible = renderStudyPanelSettings || renderModuleDisplaySettings;
  const colorsFolderVisible = renderColorSettings;
  const motionFolderVisible = renderMotionSettings || renderResponsiveSettings;
  const toolsFolderVisible = renderGraphSettings || renderHighlightSettings;
  const advancedFolderVisible = renderAdvancedSettings;
  const visibleSettingsFolders = [
    layoutPresetsFolderVisible,
    editLayoutFolderVisible,
    snappingCanvasFolderVisible,
    moduleDisplayFolderVisible,
    colorsFolderVisible,
    motionFolderVisible,
    toolsFolderVisible,
    advancedFolderVisible,
  ].filter(Boolean).length;

  const isFolderExpanded = (folderId: SettingsFolderId) =>
    isSearchingSettings ? true : expandedFolders[folderId] ?? defaultExpandedFolders[folderId];
  const toggleFolder = (folderId: SettingsFolderId) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderId]: !(current[folderId] ?? defaultExpandedFolders[folderId]),
    }));
  };

  const setNext = (next: WorkspacePreferences) =>
    onChange({
      ...next,
      updatedAt: new Date().toISOString(),
    });

  const updateTheme = (
    updater: (current: WorkspacePreferences["theme"]) => WorkspacePreferences["theme"],
  ) => {
    const nextTheme = updater(preferences.theme);
    setNext(
      updateWorkspaceAppearance(
        {
          ...preferences,
          theme: nextTheme,
        },
        {
          appTheme: nextTheme.id,
          density: nextTheme.density,
          roundness: nextTheme.roundness,
          motion:
            nextTheme.animationLevel === "full"
              ? "full"
              : nextTheme.animationLevel === "subtle"
                ? "reduced"
                : "minimal",
          customPalette: nextTheme.customPalette ?? preferences.appearance.customPalette,
        },
      ),
    );
  };

  const updateCustomColor = (key: keyof AppearanceCustomPalette, value: string) => {
    setNext(
      updateWorkspaceAppearance(preferences, {
        appTheme: "custom",
        customPalette: {
          ...preferences.appearance.customPalette,
          [key]: value,
        },
      }),
    );
  };

  const updateAppTheme = (appTheme: WorkspaceThemeId) => {
    setNext(updateWorkspaceAppearance(preferences, { appTheme }));
  };

  const updateAccent = (accent: AccentColor) => {
    setNext(updateWorkspaceAppearance(preferences, { accent }));
  };

  const changeMode = (workspaceMode: WorkspaceMode) => {
    setNext(applyWorkspaceModeToViewport(preferences, workspaceMode, getWorkspaceSettingsViewport()));
  };

  const confirmAndRunReset = async (
    resetAction: (() => Promise<void> | void) | undefined,
    scopeLabel: string,
  ) => {
    if (!resetAction) {
      return;
    }

    const confirmed = window.confirm(
      `Reset highlights for ${scopeLabel}? This removes the saved highlights and gives you a clean lesson surface.`,
    );
    if (!confirmed) {
      return;
    }

    await resetAction();
  };

  const toggleModule = (moduleId: WorkspaceModuleId) => {
    const module = workspaceModules.find((candidate) => candidate.id === moduleId);
    if (!module) {
      return;
    }

    const enabled = preferences.enabledModules.includes(moduleId);
    if (module.steady && enabled) {
      return;
    }

    const nextEnabled = enabled
      ? preferences.enabledModules.filter((id) => id !== moduleId)
      : [...preferences.enabledModules, moduleId];

    setNext(
      ensureWindowFramesForEnabledModules({
        ...preferences,
        enabledModules: nextEnabled,
      }),
    );
  };

  const toggleCollapsed = (moduleId: WorkspaceModuleId) => {
    setNext({
      ...preferences,
      moduleLayout: {
        ...preferences.moduleLayout,
        [moduleId]: {
          ...preferences.moduleLayout[moduleId],
          span: preferences.moduleLayout[moduleId]?.span ?? "auto",
          collapsed: !preferences.moduleLayout[moduleId]?.collapsed,
        },
      },
    });
  };

  return (
    <aside
      className={cn(
        "workspace-settings workspace-panel flex min-h-0 flex-col overflow-hidden border border-border/80 bg-card shadow-lg",
        isLayoutMode ? "h-full" : "max-h-[min(78svh,840px)]",
      )}
      data-workspace-settings="true"
      data-workspace-settings-mode={mode}
    >
      <div className="workspace-settings__header flex items-start justify-between gap-3 p-4">
        <div>
          <Badge variant="outline">{isLayoutMode ? "Edit layout" : "Preferences"}</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {isLayoutMode ? "Workspace setup" : "Workspace settings"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {isLayoutMode
              ? "Arrange windows on the canvas, then tune the calmer reading and writing preferences here."
              : "Tune the workspace feel without dropping back into layout editing."}
          </p>
        </div>
        {onClose ? (
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            Close
          </Button>
        ) : null}
      </div>

      <div className="border-b border-border/60 px-4 py-3">
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Search settings</span>
          <input
            className="h-10 rounded-xl border border-border/80 bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/45 focus:ring-4 focus:ring-ring/15"
            onChange={(event) => setSettingsQuery(event.target.value)}
            placeholder="Search settings"
            type="search"
            value={settingsQuery}
          />
        </label>
      </div>

      <div
        className="workspace-settings__scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pr-3"
        data-workspace-settings-scroll="true"
      >
        {visibleSettingsFolders === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/55 p-4 text-sm text-muted-foreground">
            No settings found.
          </div>
        ) : null}

        {layoutPresetsFolderVisible ? (
          <SettingsFolder
            description="Workspace modes, presets, and the controls that decide how much layout power is visible."
            expanded={isFolderExpanded("layout-presets")}
            id="layout-presets"
            onToggle={toggleFolder}
            title="Layout & Presets"
          >
        {renderStudyModeSettings ? (
        <Section
          description="Choose how much workspace control BinderNotes should expose."
          title="Study mode"
        >
          <div className="grid gap-2">
            {workspaceModeOptions.map((workspaceMode) => (
              <button
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition hover:bg-secondary/80",
                  preferences.activeMode === workspaceMode.id
                    ? "border-primary bg-accent/75"
                    : "border-border/70 bg-background/55",
                )}
                key={workspaceMode.id}
                onClick={() => changeMode(workspaceMode.id)}
                type="button"
              >
                <span className="block text-sm font-medium">{workspaceMode.name}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {workspaceMode.description}
                </span>
              </button>
            ))}
          </div>
        </Section>
        ) : null}

        {renderPresetSettings ? (
        <Section
          description={
            isLayoutMode
              ? "Start from a mode that fits the way you want to study."
              : "Switch the workspace balance without opening layout editing."
          }
          title="Presets"
        >
          <div className="grid gap-2">
            {visiblePresets.map((preset) => (
              <button
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition hover:bg-secondary/80",
                  preferences.preset === preset.id
                    ? "border-primary bg-accent/75"
                    : "border-border/70 bg-background/55",
                )}
                key={preset.id}
                onClick={() =>
                  setNext(applyPresetToViewport(preferences, preset.id, getWorkspaceSettingsViewport()))
                }
                type="button"
              >
                <span className="block text-sm font-medium">{preset.name}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </Section>
        ) : null}

        {renderCustomizationDepthSettings ? (
        <div className="mt-6 rounded-xl border border-border/70 bg-background/55 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Customization depth</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Keep the normal workspace compact, or expand the full canvas and module controls.
              </p>
            </div>
            <Button
              onClick={() => setShowAdvancedCustomization((current) => !current)}
              size="sm"
              type="button"
              variant={hasAdvancedCustomization ? "default" : "outline"}
            >
              {hasAdvancedCustomization ? "Expanded" : "Customize"}
            </Button>
          </div>
        </div>
        ) : null}
          </SettingsFolder>
        ) : null}

        {moduleDisplayFolderVisible ? (
          <SettingsFolder
            description="Panel density, compact headers, module chrome, and source/notes display comfort."
            expanded={isFolderExpanded("module-display")}
            id="module-display"
            onToggle={toggleFolder}
            title="Module Display"
          >
        {renderStudyPanelSettings ? (
          <Section
            description="Keep study panels orderly without opening the full canvas controls."
            title="Study panels"
          >
            <div className="grid gap-4">
              <ControlGroup title="Panel density">
                {(["comfortable", "compact"] as const).map((density) => (
                  <ThemeChoice
                    active={preferences.modular.panelDensity === density}
                    key={density}
                    onClick={() =>
                      setNext({
                        ...preferences,
                        modular: {
                          ...preferences.modular,
                          panelDensity: density,
                        },
                      })
                    }
                  >
                    {density === "comfortable" ? "Comfortable" : "Compact"}
                  </ThemeChoice>
                ))}
              </ControlGroup>

              <ControlGroup title="Side panel">
                {(["left", "right"] as const).map((position) => (
                  <ThemeChoice
                    active={preferences.modular.sidePanelPosition === position}
                    key={position}
                    onClick={() =>
                      setNext({
                        ...preferences,
                        modular: {
                          ...preferences.modular,
                          sidePanelPosition: position,
                        },
                      })
                    }
                  >
                    {position === "left" ? "Left side" : "Right side"}
                  </ThemeChoice>
                ))}
              </ControlGroup>

              <ControlGroup title="Save layout per binder">
                <ToggleChoice
                  active={preferences.modular.saveLayoutPerBinder}
                  description="Remember this binder's selected preset and panel mix."
                  label={preferences.modular.saveLayoutPerBinder ? "On" : "Off"}
                  onClick={() =>
                    setNext({
                      ...preferences,
                      modular: {
                        ...preferences.modular,
                        saveLayoutPerBinder: !preferences.modular.saveLayoutPerBinder,
                      },
                    })
                  }
                />
              </ControlGroup>
            </div>
          </Section>
        ) : null}

        {renderModuleDisplaySettings ? (
        <Section
          description="Keep module chrome readable without crowding lesson, notes, or tool surfaces."
          title="Module chrome"
        >
          <div className="grid gap-4">
            <div className="grid gap-4">
              <ControlGroup title="Density">
                {densityOptions.map((density) => (
                  <ThemeChoice
                    active={preferences.theme.density === density}
                    key={density}
                    onClick={() =>
                      updateTheme((current) => ({
                        ...current,
                        density,
                      }))
                    }
                  >
                    {density}
                  </ThemeChoice>
                ))}
              </ControlGroup>
              <ControlGroup title="Maximize module space">
                <ToggleChoice
                  active={preferences.theme.compactMode}
                  description={
                    preferences.theme.compactMode
                      ? "Large module headers stay compact so source and notes get more room."
                      : "Keep the normal decorative module headers."
                  }
                  label="Maximize module space"
                  onClick={() =>
                    updateTheme((current) => ({
                      ...current,
                      compactMode: !current.compactMode,
                    }))
                  }
                />
              </ControlGroup>
              <ControlGroup title="Roundness">
                {roundnessOptions.map((roundness) => (
                  <ThemeChoice
                    active={preferences.theme.roundness === roundness}
                    key={roundness}
                    onClick={() =>
                      updateTheme((current) => ({
                        ...current,
                        roundness,
                      }))
                    }
                  >
                    {roundness}
                  </ThemeChoice>
                ))}
              </ControlGroup>
              <ControlGroup title="Shadow">
                {shadowOptions.map((shadow) => (
                  <ThemeChoice
                    active={preferences.theme.shadow === shadow}
                    key={shadow}
                    onClick={() =>
                      updateTheme((current) => ({
                        ...current,
                        shadow,
                      }))
                    }
                  >
                    {shadow}
                  </ThemeChoice>
                ))}
              </ControlGroup>
              <ControlGroup title="Font">
                {fontOptions.map((font) => (
                  <ThemeChoice
                    active={preferences.theme.font === font}
                    key={font}
                    onClick={() =>
                      updateTheme((current) => ({
                        ...current,
                        font,
                      }))
                    }
                  >
                    {font}
                  </ThemeChoice>
                ))}
              </ControlGroup>
            </div>
          </div>
        </Section>
        ) : null}
          </SettingsFolder>
        ) : null}

        {colorsFolderVisible ? (
          <SettingsFolder
            description="Theme, study surface, app color scheme, and custom palette controls."
            expanded={isFolderExpanded("colors-study-surface")}
            id="colors-study-surface"
            onToggle={toggleFolder}
            title="Colors & Study Surface"
          >
        {renderColorSettings ? (
        <Section
          description="Theme, density, roundness, and color stay consistent across the app."
          title="Color Settings"
        >
          <div className="grid gap-4">
            <ControlGroup title="Workspace colors">
              <ToggleChoice
                active={preferences.appearance.saveLocalAppearance}
                description={
                  preferences.appearance.saveLocalAppearance
                    ? "Remember this workspace's color choices."
                    : "Use the current app theme when this workspace opens."
                }
                label="Save color scheme for this workspace"
                onClick={() =>
                  setNext({
                    ...preferences,
                    appearance: {
                      ...preferences.appearance,
                      saveLocalAppearance: !preferences.appearance.saveLocalAppearance,
                    },
                  })
                }
              />
            </ControlGroup>

            <ControlGroup title="App Theme">
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
                {workspaceThemes.map((theme) => (
                  <button
                    className={cn(
                      "rounded-xl border p-3 text-left transition hover:bg-secondary/80",
                      preferences.appearance.appTheme === theme.id
                        ? "border-primary bg-accent/70"
                        : "border-border/70 bg-background/55",
                    )}
                    key={theme.id}
                    onClick={() => updateAppTheme(theme.id as WorkspaceThemeId)}
                    type="button"
                  >
                    <span className="mb-3 flex gap-2">
                      {[theme.vars.primary, theme.vars.accent, theme.vars.secondary].map((value) => (
                        <span
                          className="size-5 rounded-full border border-border/60"
                          key={value}
                          style={{ background: `hsl(${value})` }}
                        />
                      ))}
                    </span>
                    <span className="block text-sm font-medium">{theme.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {theme.description}
                    </span>
                  </button>
                ))}
              </div>
            </ControlGroup>

            <ControlGroup title="Accent">
              {accentOptions.map((accent) => (
                <ThemeChoice
                  active={preferences.appearance.accent === accent.id}
                  key={accent.id}
                  onClick={() => updateAccent(accent.id)}
                >
                  {accent.name}
                </ThemeChoice>
              ))}
            </ControlGroup>

            {preferences.appearance.appTheme === "custom" ? (
              <ControlGroup title="Custom colors">
                <CustomPaletteControls
                  onChange={updateCustomColor}
                  palette={preferences.appearance.customPalette}
                />
              </ControlGroup>
            ) : null}
          </div>
        </Section>
        ) : null}
          </SettingsFolder>
        ) : null}

        {motionFolderVisible ? (
          <SettingsFolder
            description="Animation settings plus automatic phone, tablet, and reduced-motion behavior."
            expanded={isFolderExpanded("motion-performance")}
            id="motion-performance"
            onToggle={toggleFolder}
            title="Motion & Performance"
          >
        {renderMotionSettings ? (
        <Section
          description="Dial motion up only when you actually want it."
          title="Motion"
        >
          <div className="grid gap-4">
            <ControlGroup title="Animation level">
              {animationLevelOptions.map((level) => (
                <ThemeChoice
                  active={preferences.theme.animationLevel === level}
                  key={level}
                  onClick={() =>
                    setNext({
                      ...preferences,
                      modular: {
                        ...preferences.modular,
                        motionLevel: isModular ? level : preferences.modular.motionLevel,
                      },
                      theme: {
                        ...preferences.theme,
                        animationLevel: level,
                      },
                    })
                  }
                >
                  {animationLabels[level]}
                </ThemeChoice>
              ))}
            </ControlGroup>

            <ControlGroup title="Hover motion">
              <ToggleChoice
                active={preferences.theme.hoverMotion}
                description="Panel lift and tile motion"
                label={preferences.theme.hoverMotion ? "Enabled" : "Off"}
                onClick={() =>
                  updateTheme((current) => ({
                    ...current,
                    hoverMotion: !current.hoverMotion,
                  }))
                }
              />
            </ControlGroup>
          </div>
        </Section>
        ) : null}
        {renderResponsiveSettings ? (
          <Section
            description="Phone and tablet layouts adapt automatically while desktop keeps the full canvas experience."
            title="Responsive layout"
          >
            <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-sm leading-6 text-muted-foreground">
              BinderNotes uses viewport size, touch input, and reduced-motion preferences to keep settings usable on phone, tablet, and desktop.
            </div>
          </Section>
        ) : null}
          </SettingsFolder>
        ) : null}

        {snappingCanvasFolderVisible ? (
          <SettingsFolder
            description="Snapping, edge spacing, canvas background, and vertical workspace behavior."
            expanded={isFolderExpanded("snapping-canvas")}
            id="snapping-canvas"
            onToggle={toggleFolder}
            title="Snapping & Canvas"
          >
        {renderCanvasSettings ? (
          <Section
            description="Adjust the study atmosphere and how much room the canvas gives you vertically."
            title="Canvas / workspace"
          >
            <div className="grid gap-4">
              <ControlGroup layout="grid" title="Background">
                {backgroundStyleOptions.map((backgroundStyle) => (
                  <ThemeChoice
                    active={preferences.theme.backgroundStyle === backgroundStyle}
                    className="min-h-11 justify-start whitespace-normal px-3 py-2.5 text-left leading-5"
                    key={backgroundStyle}
                    onClick={() =>
                      updateTheme((current) => ({
                        ...current,
                        backgroundStyle,
                      }))
                    }
                  >
                    {backgroundLabels[backgroundStyle]}
                  </ThemeChoice>
                ))}
              </ControlGroup>

              <ControlGroup layout="stack" title="Vertical workspace">
                {verticalSpaceOptions.map((verticalSpace) => (
                  <ThemeChoice
                    active={preferences.theme.verticalSpace === verticalSpace}
                    className="min-h-12 w-full justify-start whitespace-normal px-3 py-2.5 text-left leading-5"
                    key={verticalSpace}
                    onClick={() =>
                      updateTheme((current) => ({
                        ...current,
                        verticalSpace,
                      }))
                    }
                  >
                    {verticalSpaceLabels[verticalSpace]}
                  </ThemeChoice>
                ))}
              </ControlGroup>

              <ControlGroup title="Snap mode">
                {(["off", "edges", "modules"] as const).map((snapBehavior) => (
                  <ThemeChoice
                    active={preferences.canvas.snapBehavior === snapBehavior}
                    key={snapBehavior}
                    onClick={() =>
                      setNext({
                        ...preferences,
                        canvas: {
                          ...preferences.canvas,
                          snapBehavior,
                        },
                        theme: {
                          ...preferences.theme,
                          snapMode: snapBehavior !== "off",
                        },
                      })
                    }
                  >
                    {snapBehavior === "off"
                      ? "Off"
                      : snapBehavior === "edges"
                        ? "Edges"
                        : "Edges + modules"}
                  </ThemeChoice>
                ))}
              </ControlGroup>

              <ControlGroup title="Safe Edge Padding">
                <ToggleChoice
                  active={preferences.canvas.safeEdgePadding}
                  ariaLabel={`Safe Edge Padding ${preferences.canvas.safeEdgePadding ? "On" : "Off"}`}
                  description={
                    preferences.canvas.safeEdgePadding
                      ? "Keep an 8px edge margin while editing."
                      : "Allow windows to sit exactly on canvas edges and corners."
                  }
                  label={preferences.canvas.safeEdgePadding ? "On" : "Off"}
                  onClick={() =>
                    setNext({
                      ...preferences,
                      canvas: {
                        ...preferences.canvas,
                        safeEdgePadding: !preferences.canvas.safeEdgePadding,
                      },
                    })
                  }
                />
              </ControlGroup>

              <ControlGroup title="Focus mode">
                <ToggleChoice
                  active={preferences.theme.focusMode}
                  description="Reduce workspace chrome and let the canvas feel more immersive"
                  label={preferences.theme.focusMode ? "On" : "Off"}
                  onClick={() =>
                    updateTheme((current) => ({
                      ...current,
                      focusMode: !current.focusMode,
                    }))
                  }
                />
              </ControlGroup>

              <ControlGroup title="Whiteboard">
                <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-sm leading-6 text-muted-foreground">
                  Math Whiteboard uses local draft autosave, graph-paper templates, and live BinderNotes module cards.
                </div>
              </ControlGroup>
            </div>
          </Section>
        ) : null}
          </SettingsFolder>
        ) : null}

        {toolsFolderVisible ? (
          <SettingsFolder
            description="Graph, calculator, note, history, math, and highlight tools."
            expanded={isFolderExpanded("tools-modules")}
            id="tools-modules"
            onToggle={toggleFolder}
            title="Tools & Modules"
          >
        {renderGraphSettings ? (
        <Section
          description="Keep graphs readable without having to enter layout mode."
          title="Graphs"
        >
          <div className="grid gap-4">
            <ControlGroup layout="grid" title="Graph appearance">
              {graphAppearanceOptions.map((graphAppearance) => (
                <ThemeChoice
                  active={preferences.theme.graphAppearance === graphAppearance}
                  className="min-h-11 justify-start whitespace-normal px-3 py-2.5 text-left leading-5"
                  key={graphAppearance}
                  onClick={() =>
                    updateTheme((current) => ({
                      ...current,
                      graphAppearance,
                    }))
                  }
                >
                  {graphAppearanceLabels[graphAppearance]}
                </ThemeChoice>
              ))}
            </ControlGroup>

            <ControlGroup layout="grid" title="Graph chrome">
              {graphChromeOptions.map((graphChrome) => (
                <ThemeChoice
                  active={preferences.theme.graphChrome === graphChrome}
                  className="min-h-11 justify-start whitespace-normal px-3 py-2.5 text-left leading-5"
                  key={graphChrome}
                  onClick={() =>
                    updateTheme((current) => ({
                      ...current,
                      graphChrome,
                    }))
                  }
                >
                  {graphChromeLabels[graphChrome]}
                </ThemeChoice>
              ))}
            </ControlGroup>
          </div>
        </Section>
        ) : null}

        {renderHighlightSettings ? (
        <Section
          description="Keep highlight capture consistent with the way you study."
          title="Highlights"
        >
          <div className="grid gap-4">
            <ControlGroup layout="grid" title="Default highlight meaning">
              {highlightColorOptions.map((option) => (
                <ThemeChoice
                  active={preferences.theme.defaultHighlightColor === option.id}
                  className="min-h-12 justify-start whitespace-normal px-3 py-2.5 text-left leading-5"
                  key={option.id}
                  onClick={() =>
                    updateTheme((current) => ({
                      ...current,
                      defaultHighlightColor: option.id,
                    }))
                  }
                >
                  {option.name}
                </ThemeChoice>
              ))}
            </ControlGroup>

            {onResetLessonHighlights || onResetBinderHighlights ? (
              <ControlGroup layout="stack" title="Reset highlights">
                {onResetLessonHighlights ? (
                  <button
                    className="rounded-xl border border-border/70 bg-background/55 px-3 py-3 text-left transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isResettingHighlights}
                    onClick={() =>
                      void confirmAndRunReset(
                        onResetLessonHighlights,
                        lessonTitle ? `"${lessonTitle}"` : "this lesson",
                      )
                    }
                    type="button"
                  >
                    <span className="block text-sm font-medium">Reset current lesson highlights</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      Clear saved highlights for the lesson you are looking at right now.
                    </span>
                  </button>
                ) : null}

                {onResetBinderHighlights ? (
                  <button
                    className="rounded-xl border border-border/70 bg-background/55 px-3 py-3 text-left transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isResettingHighlights}
                    onClick={() =>
                      void confirmAndRunReset(
                        onResetBinderHighlights,
                        binderTitle ? `"${binderTitle}"` : "this binder",
                      )
                    }
                    type="button"
                  >
                    <span className="block text-sm font-medium">Reset binder highlights</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      Clear all saved highlights for this binder if the state gets messy.
                    </span>
                  </button>
                ) : null}
              </ControlGroup>
            ) : null}
          </div>
        </Section>
        ) : null}
          </SettingsFolder>
        ) : null}

        {advancedFolderVisible ? (
          <SettingsFolder
            description="Power-user switches that keep the main settings list calmer until you need them."
            expanded={isFolderExpanded("advanced")}
            id="advanced"
            onToggle={toggleFolder}
            title="Advanced"
          >
        {renderAdvancedSettings ? (
          <Section
            description="Keep normal study mode minimal, and hide extra helper UI unless you want it."
            title="Power-user settings"
          >
            <div className="grid gap-4">
              <ControlGroup title="Sticky notes">
                <ToggleChoice
                  active={preferences.enabledModules.includes("comments")}
                  description="Show or hide floating sticky notes and the annotation manager"
                  label={preferences.enabledModules.includes("comments") ? "Shown" : "Hidden"}
                  onClick={() => toggleModule("comments")}
                />
              </ControlGroup>

              <ControlGroup title="Reduced chrome in locked mode">
                <ToggleChoice
                  active={preferences.theme.reducedChrome}
                  description="Hide extra panel framing while studying"
                  label={preferences.theme.reducedChrome ? "On" : "Off"}
                  onClick={() =>
                    updateTheme((current) => ({
                      ...current,
                      reducedChrome: !current.reducedChrome,
                    }))
                  }
                />
              </ControlGroup>

              <ControlGroup title="Utility UI">
                <ToggleChoice
                  active={preferences.theme.showUtilityUi}
                  description="Wide edit-layout launcher, selected-module controls, preset chips, and extra status controls"
                  label={preferences.theme.showUtilityUi ? "Shown" : "Minimal"}
                  onClick={() =>
                    updateTheme((current) => ({
                      ...current,
                      showUtilityUi: !current.showUtilityUi,
                    }))
                  }
                />
              </ControlGroup>
            </div>
          </Section>
        ) : null}
          </SettingsFolder>
        ) : null}

        {editLayoutFolderVisible ? (
          <SettingsFolder
            description="Edit-layout module visibility and collapse controls."
            expanded={isFolderExpanded("edit-layout")}
            id="edit-layout"
            onToggle={toggleFolder}
            title="Edit Layout"
          >
        {renderLayoutSettings ? (
          <Section
            description={
              isFullStudio
                ? "Show or hide windows, and collapse the ones you want out of the way."
                : "Tune which supporting windows are visible without opening the full studio controls."
            }
            title="Layout"
          >
            <ControlGroup title="Canvas launcher">
              <ToggleChoice
                active={preferences.theme.showUtilityUi}
                ariaLabel={`Canvas launcher ${preferences.theme.showUtilityUi ? "Shown" : "Hidden"}`}
                description={
                  preferences.theme.showUtilityUi
                    ? "Show the wide module launcher and selected-module controls above the canvas."
                    : "Hide the wide launcher and use this side menu to add or restore modules."
                }
                label={preferences.theme.showUtilityUi ? "Shown" : "Hidden"}
                onClick={() =>
                  updateTheme((current) => ({
                    ...current,
                    showUtilityUi: !current.showUtilityUi,
                  }))
                }
              />
            </ControlGroup>

            <div className="grid gap-2">
              {workspaceModules
                .filter((module) =>
                  isFullStudio
                    ? true
                    : ["lesson", "private-notes", "comments", "lesson-outline", "search", "desmos-graph", "scientific-calculator", "recent-highlights", "whiteboard"].includes(module.id),
                )
                .map((module) => {
                const enabled = preferences.enabledModules.includes(module.id);
                const collapsed = preferences.moduleLayout[module.id]?.collapsed;
                return (
                  <div
                    className="rounded-xl border border-border/70 bg-background/55 p-3"
                    key={module.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{module.name}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {module.description}
                        </p>
                      </div>
                      <Button
                        disabled={module.steady && enabled}
                        onClick={() => toggleModule(module.id)}
                        size="sm"
                        type="button"
                        variant={enabled ? "default" : "outline"}
                      >
                        {enabled ? "Visible" : "Hidden"}
                      </Button>
                    </div>
                    {enabled && isFullStudio ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          onClick={() => toggleCollapsed(module.id)}
                          size="sm"
                          type="button"
                          variant={collapsed ? "default" : "outline"}
                        >
                          {collapsed ? "Collapsed" : "Expanded"}
                        </Button>
                        {module.steady ? <Badge variant="secondary">Core</Badge> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Section>
        ) : null}
          </SettingsFolder>
        ) : null}
      </div>
    </aside>
  );
}

function SettingsFolder({
  children,
  description,
  expanded,
  id,
  onToggle,
  title,
}: {
  children: ReactNode;
  description: string;
  expanded: boolean;
  id: SettingsFolderId;
  onToggle: (id: SettingsFolderId) => void;
  title: string;
}) {
  const contentId = `workspace-settings-folder-${id}`;

  return (
    <section
      className="workspace-settings-folder"
      data-settings-folder={id}
    >
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className="workspace-settings-folder__trigger"
        onClick={() => onToggle(id)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
        <span className="workspace-settings-folder__chevron" aria-hidden="true">
          {expanded ? "−" : "+"}
        </span>
      </button>
      {expanded ? (
        <div className="workspace-settings-folder__content" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function Section({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="workspace-settings__section mt-6 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ControlGroup({
  children,
  layout = "wrap",
  title,
}: {
  children: ReactNode;
  layout?: "wrap" | "grid" | "stack";
  title: string;
}) {
  return (
    <div className="workspace-settings__control-group">
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div
        className={cn(
          layout === "stack" && "grid gap-2",
          layout === "grid" &&
            "grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]",
          layout === "wrap" && "flex flex-wrap gap-2",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function CustomPaletteControls({
  onChange,
  palette,
}: {
  palette: AppearanceCustomPalette;
  onChange: (key: keyof AppearanceCustomPalette, value: string) => void;
}) {
  return (
    <div className="grid w-full gap-2 rounded-xl border border-border/70 bg-background/55 p-3">
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(7rem,1fr))]">
        {(["primary", "secondary", "accent"] as const).map((key) => (
          <label className="grid gap-1 text-xs font-medium text-muted-foreground" key={key}>
            <span className="capitalize">{key}</span>
            <input
              aria-label={`Custom ${key} color`}
              className="h-10 w-full rounded-lg border border-border/80 bg-card p-1"
              onChange={(event) => onChange(key, event.target.value)}
              type="color"
              value={palette[key]}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function ThemeChoice({
  active,
  children,
  className,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <Button
      className={cn("workspace-settings__choice", className)}
      onClick={onClick}
      type="button"
      variant={active ? "default" : "outline"}
    >
      {children}
    </Button>
  );
}

function ToggleChoice({
  active,
  ariaLabel,
  description,
  label,
  onClick,
}: {
  active: boolean;
  ariaLabel?: string;
  description?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "workspace-settings__choice rounded-xl border px-3 py-2.5 text-left transition",
        active ? "border-primary bg-accent/70" : "border-border/70 bg-background/55",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="block text-sm font-medium">{label}</span>
      {description ? (
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      ) : null}
    </button>
  );
}

function getWorkspaceSettingsViewport() {
  if (typeof window === "undefined") {
    return { width: 1366, height: 768 };
  }

  const shell = document.querySelector(".workspace-canvas-shell");
  if (shell instanceof HTMLElement && shell.clientWidth > 0 && shell.clientHeight > 0) {
    return {
      width: shell.clientWidth,
      height: shell.clientHeight,
    };
  }

  return {
    width: window.innerWidth || 1366,
    height: Math.max(360, (window.innerHeight || 900) - 168),
  };
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function loadSettingsFolderState(
  storageKey: string,
  defaults: Record<SettingsFolderId, boolean>,
) {
  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (!stored) {
      return defaults;
    }

    return {
      ...defaults,
      ...(JSON.parse(stored) as Partial<Record<SettingsFolderId, boolean>>),
    };
  } catch {
    return defaults;
  }
}

function saveSettingsFolderState(
  storageKey: string,
  expandedFolders: Record<SettingsFolderId, boolean>,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(expandedFolders));
  } catch {
    // Session persistence is a convenience; settings behavior should never depend on it.
  }
}

function aliases(...keys: Array<keyof typeof settingsSearchAliases>) {
  return keys.flatMap((key) => settingsSearchAliases[key]);
}

function matchesSettingsSearch(query: string, terms: Array<string | undefined | null>) {
  if (!query) {
    return true;
  }

  return terms
    .filter((term): term is string => Boolean(term))
    .some((term) => term.toLowerCase().includes(query));
}
