import type { ReactNode } from "react";
import {
  applyWorkspaceMode,
  simplePresentationFontSizeOptions,
  simplePresentationMotionOptions,
  simplePresentationReadingWidthOptions,
  simplePresentationThemeOptions,
  updateWorkspaceAppearance,
  workspaceModeOptions,
  workspaceThemes,
} from "@/lib/workspace-preferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AppearanceCustomPalette,
  SimplePresentationSettings,
  WorkspaceMode,
  WorkspacePreferences,
  WorkspaceThemeId,
} from "@/types";

export function SimpleSettingsPanel({
  onChange,
  onClose,
  preferences,
}: {
  preferences: WorkspacePreferences;
  onChange: (preferences: WorkspacePreferences) => void;
  onClose?: () => void;
}) {
  const setNext = (next: WorkspacePreferences) =>
    onChange({
      ...next,
      updatedAt: new Date().toISOString(),
    });

  const updateSimple = (patch: Partial<SimplePresentationSettings>) => {
    if (patch.theme) {
      setNext(updateWorkspaceAppearance(preferences, { studySurface: patch.theme }));
      return;
    }

    setNext({
      ...preferences,
      simple: {
        ...preferences.simple,
        ...patch,
      },
    });
  };

  const changeMode = (mode: WorkspaceMode) => {
    setNext(applyWorkspaceMode(preferences, mode));
  };

  const updateCustomColor = (key: keyof AppearanceCustomPalette, value: string) => {
    setNext(
      updateWorkspaceAppearance(preferences, {
        appTheme: "custom",
        studySurface: "custom",
        customPalette: {
          ...preferences.appearance.customPalette,
          [key]: value,
        },
      }),
    );
  };

  return (
    <aside
      className="simple-settings-panel workspace-panel flex min-h-0 flex-col overflow-hidden border border-border/80 bg-card shadow-lg"
      data-testid="simple-settings-panel"
    >
      <div className="workspace-settings__header flex items-start justify-between gap-3 p-4">
        <div>
          <Badge variant="outline">Settings</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Simple View</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Keep the study screen calm. Change text, color, and helpers without opening layout tools.
          </p>
        </div>
        {onClose ? (
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            Close
          </Button>
        ) : null}
      </div>

      <div className="workspace-settings__scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pr-3">
        <section className="workspace-settings__section mt-0 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Study mode</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Pick how much workspace control you want.
            </p>
          </div>
          <div className="grid gap-2">
            {workspaceModeOptions.map((mode) => (
              <button
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition hover:bg-secondary/80",
                  preferences.activeMode === mode.id
                    ? "border-primary bg-accent/75"
                    : "border-border/70 bg-background/55",
                )}
                key={mode.id}
                onClick={() => changeMode(mode.id)}
                type="button"
              >
                <span className="block text-sm font-medium">{mode.name}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {mode.description}
                </span>
              </button>
            ))}
          </div>
        </section>

        <SimpleSection
          description="Choose the overall app theme and the reading surface together."
          title="Appearance"
        >
          <ControlGroup title="App Theme">
            <div className="grid w-full gap-2 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
              {workspaceThemes.map((theme) => (
                <SimpleChoice
                  active={preferences.appearance.appTheme === theme.id}
                  key={theme.id}
                  onClick={() =>
                    setNext(updateWorkspaceAppearance(preferences, { appTheme: theme.id as WorkspaceThemeId }))
                  }
                >
                  <span className="block text-sm font-medium">{theme.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {theme.description}
                  </span>
                </SimpleChoice>
              ))}
            </div>
          </ControlGroup>

          <ControlGroup title="Study Surface">
            <div className="grid w-full gap-2 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
              {simplePresentationThemeOptions.map((theme) => (
                <SimpleChoice
                  active={preferences.appearance.studySurface === theme.id}
                  key={theme.id}
                  onClick={() =>
                    updateSimple({
                      theme: theme.id,
                      accentColor:
                        theme.id === "history-gold"
                          ? "history-gold"
                          : theme.id === "math-blue"
                            ? "math-blue"
                            : preferences.simple.accentColor,
                    })
                  }
                >
                  <span className="block text-sm font-medium">{theme.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {theme.description}
                  </span>
                </SimpleChoice>
              ))}
            </div>
          </ControlGroup>
          {preferences.appearance.appTheme === "custom" || preferences.simple.theme === "custom" ? (
            <CustomPaletteControls
              onChange={updateCustomColor}
              palette={preferences.appearance.customPalette}
            />
          ) : null}
        </SimpleSection>

        <SimpleSection description="Make the lesson comfortable to read." title="Reading">
          <ControlGroup title="Text size">
            {simplePresentationFontSizeOptions.map((option) => (
              <Button
                key={option.id}
                onClick={() => updateSimple({ fontSize: option.id })}
                type="button"
                variant={preferences.simple.fontSize === option.id ? "default" : "outline"}
              >
                {option.name}
              </Button>
            ))}
          </ControlGroup>
          <ControlGroup title="Reading width">
            {simplePresentationReadingWidthOptions.map((option) => (
              <Button
                key={option.id}
                onClick={() => updateSimple({ readingWidth: option.id })}
                type="button"
                variant={preferences.simple.readingWidth === option.id ? "default" : "outline"}
              >
                {option.name}
              </Button>
            ))}
          </ControlGroup>
        </SimpleSection>

        <SimpleSection description="Show only the helpers you want while studying." title="Study Helpers">
          <div className="grid gap-2">
            <SimpleToggle
              active={preferences.simple.showSideNotes}
              description="Keep a notes drawer beside the lesson."
              label="Show notes"
              onClick={() => updateSimple({ showSideNotes: !preferences.simple.showSideNotes })}
            />
            <SimpleToggle
              active={preferences.simple.showStudyDrawer}
              description="Show evidence, formulas, graph blocks, or timeline helpers."
              label="Show study drawer"
              onClick={() => updateSimple({ showStudyDrawer: !preferences.simple.showStudyDrawer })}
            />
            <SimpleToggle
              active={preferences.simple.showProgressBar}
              description="Show lesson or timeline progress at the bottom."
              label="Show progress"
              onClick={() => updateSimple({ showProgressBar: !preferences.simple.showProgressBar })}
            />
            <SimpleToggle
              active={preferences.simple.focusMode}
              description="Make the study surface immersive."
              label="Focus mode"
              onClick={() => updateSimple({ focusMode: !preferences.simple.focusMode })}
            />
          </div>
        </SimpleSection>

        <SimpleSection description="Reduce motion or increase contrast any time." title="Accessibility">
          <ControlGroup title="Motion">
            {simplePresentationMotionOptions.map((option) => (
              <Button
                key={option.id}
                onClick={() => updateSimple({ motion: option.id })}
                type="button"
                variant={preferences.simple.motion === option.id ? "default" : "outline"}
              >
                {option.name}
              </Button>
            ))}
          </ControlGroup>
          <SimpleToggle
            active={preferences.simple.highContrast}
            description="Use stronger borders and text contrast in Simple View."
            label="High contrast"
            onClick={() => updateSimple({ highContrast: !preferences.simple.highContrast })}
          />
        </SimpleSection>
      </div>
    </aside>
  );
}

function SimpleSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="workspace-settings__section mt-6 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ControlGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="grid gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="flex flex-wrap gap-2">{children}</div>
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
    <div className="grid gap-2 rounded-xl border border-border/70 bg-background/55 p-3">
      <h4 className="text-sm font-semibold">Custom colors</h4>
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

function SimpleChoice({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-xl border p-3 text-left transition hover:bg-secondary/80",
        active ? "border-primary bg-accent/70" : "border-border/70 bg-background/55",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SimpleToggle({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-xl border px-3 py-3 text-left transition hover:bg-secondary/80",
        active ? "border-primary bg-accent/70" : "border-border/70 bg-background/55",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
    </button>
  );
}
