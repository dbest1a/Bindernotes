import type { ReactNode } from "react";
import {
  accentOptions,
  animationLevelOptions,
  applyPreset,
  applyWorkspaceMode,
  backgroundStyleOptions,
  densityOptions,
  ensureWindowFramesForEnabledModules,
  fontOptions,
  graphAppearanceOptions,
  graphChromeOptions,
  highlightColorOptions,
  roundnessOptions,
  shadowOptions,
  updateWorkspaceAppearance,
  verticalSpaceOptions,
  workspaceModules,
  workspaceModeOptions,
  workspacePresets,
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
  lessonTitle?: string;
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

export function WorkspaceSettings({
  mode = "layout",
  onChange,
  onClose,
  onResetBinderHighlights,
  onResetLessonHighlights,
  binderTitle,
  isResettingHighlights = false,
  lessonTitle,
  preferences,
}: WorkspaceSettingsProps) {
  const isLayoutMode = mode === "layout";
  const isCanvas = preferences.activeMode === "canvas";
  const isModular = preferences.activeMode === "modular";
  const isFullStudio = isCanvas || preferences.workspaceStyle === "full-studio";
  const isGuided = preferences.workspaceStyle === "guided";

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
    setNext(applyWorkspaceMode(preferences, workspaceMode));
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

      <div
        className="workspace-settings__scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pr-3"
        data-workspace-settings-scroll="true"
      >
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

        <Section
          description={
            isLayoutMode
              ? "Start from a mode that fits the way you want to study."
              : "Switch the workspace balance without opening layout editing."
          }
          title="Presets"
        >
          <div className="grid gap-2">
            {workspacePresets.map((preset) => (
              <button
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition hover:bg-secondary/80",
                  preferences.preset === preset.id
                    ? "border-primary bg-accent/75"
                    : "border-border/70 bg-background/55",
                )}
                key={preset.id}
                onClick={() => setNext(applyPreset(preferences, preset.id))}
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

        {isModular ? (
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
                        theme: {
                          ...preferences.theme,
                          compactMode: density === "compact",
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

        <Section
          description="Theme, density, roundness, and color stay consistent across the app."
          title="Appearance"
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
              <ControlGroup title="Compact mode">
                <ToggleChoice
                  active={preferences.theme.compactMode}
                  label={preferences.theme.compactMode ? "On" : "Off"}
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

        {isCanvas ? (
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
                <ToggleChoice
                  active={preferences.theme.snapMode}
                  description="Snap windows to the visible canvas edges while dragging in creator mode"
                  label={preferences.theme.snapMode ? "On" : "Off"}
                  onClick={() =>
                    setNext({
                      ...preferences,
                      canvas: {
                        ...preferences.canvas,
                        snapBehavior: preferences.theme.snapMode ? "off" : "edges",
                      },
                      theme: {
                        ...preferences.theme,
                        snapMode: !preferences.theme.snapMode,
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
            </div>
          </Section>
        ) : null}

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

        <Section
          description="Keep normal study mode minimal, and hide extra helper UI unless you want it."
          title="Advanced"
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
                description="Preset chips and extra status controls"
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

        {isLayoutMode && !isGuided ? (
          <Section
            description={
              isFullStudio
                ? "Show or hide windows, and collapse the ones you want out of the way."
                : "Tune which supporting windows are visible without opening the full studio controls."
            }
            title="Layout"
          >
            <div className="grid gap-2">
              {workspaceModules
                .filter((module) =>
                  isFullStudio
                    ? true
                    : ["lesson", "private-notes", "comments", "lesson-outline", "search", "desmos-graph", "scientific-calculator", "recent-highlights"].includes(module.id),
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
      </div>
    </aside>
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
  description,
  label,
  onClick,
}: {
  active: boolean;
  description?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
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
