import {
  CheckCircle2,
  Focus,
  Layers3,
  Settings2,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceModeSwitcher } from "@/components/workspace/workspace-mode-switcher";
import {
  workspaceModuleRegistry,
  type WorkspaceModuleContext,
} from "@/components/workspace/workspace-modules";
import {
  getVisibleWorkspacePresets,
  workspacePresets,
} from "@/lib/workspace-preferences";
import { getFaceliftWorkspacePresetDesign } from "@/lib/workspace-preset-designs";
import { getPrimaryFolder } from "@/lib/workspace-structure";
import { cn } from "@/lib/utils";
import type { WorkspaceModuleId, WorkspacePreferences, WorkspaceViewMode } from "@/types";

type StudyPanelsShellProps = {
  context: WorkspaceModuleContext;
  currentViewMode: WorkspaceViewMode;
  focusModeActive?: boolean;
  isCompact?: boolean;
  onChangeMode: (mode: WorkspaceViewMode) => void;
  onCreateSticky?: () => void;
  onOpenSettings: () => void;
  onToggleFocus?: () => void;
  preferences: WorkspacePreferences;
};

type StudyPanelTab = {
  id: string;
  label: string;
  helper: string;
  moduleId: WorkspaceModuleId;
};

const defaultTools: WorkspaceModuleId[] = [
  "recent-highlights",
  "comments",
  "lesson-outline",
  "search",
  "formula-sheet",
  "desmos-graph",
  "scientific-calculator",
  "saved-graphs",
  "history-timeline",
  "history-evidence",
  "history-argument",
];

const studyPanelLayoutStoragePrefix = "bindernotes.study-panels.layout";

export function StudyPanelsShell({
  context,
  currentViewMode,
  focusModeActive = false,
  isCompact = false,
  onChangeMode,
  onCreateSticky,
  onOpenSettings,
  onToggleFocus,
  preferences,
}: StudyPanelsShellProps) {
  const design = getFaceliftWorkspacePresetDesign(preferences.preset);
  const preset = workspacePresets.find((candidate) => candidate.id === preferences.preset);
  const folder = context.library
    ? getPrimaryFolder(
        context.library.binders,
        context.library.folders,
        context.library.folderBinders,
        context.binder.id,
      )
    : undefined;
  const tabs = useMemo(() => buildStudyPanelTabs(context, preferences), [context, preferences]);
  const preferredTabId = tabs.find((tab) => tab.moduleId === design.primaryModule)?.id ?? tabs[0]?.id ?? "lesson";
  const [activeTabId, setActiveTabId] = useState(preferredTabId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeToolId, setActiveToolId] = useState<WorkspaceModuleId>("recent-highlights");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setActiveTabId((current) => (tabs.some((tab) => tab.id === current) ? current : preferredTabId));
  }, [preferredTabId, tabs]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const primaryModuleId = activeTab?.moduleId ?? design.primaryModule;
  const secondaryModuleId = isCompact || focusModeActive ? null : chooseSecondaryModule(primaryModuleId, context, preferences);
  const defaultSplitLayout = getDefaultSplitLayout(primaryModuleId);
  const splitLayoutStorageKey = `${studyPanelLayoutStoragePrefix}:${context.binder.id}:${context.selectedLesson.id}`;
  const savedSplitLayout = useMemo(
    () => loadStudyPanelSplitLayout(splitLayoutStorageKey, defaultSplitLayout),
    [defaultSplitLayout, splitLayoutStorageKey],
  );
  const toolModuleIds = useMemo(
    () => getToolModules(preferences, primaryModuleId, secondaryModuleId),
    [preferences, primaryModuleId, secondaryModuleId],
  );
  const safeActiveToolId = toolModuleIds.includes(activeToolId) ? activeToolId : toolModuleIds[0];
  const visiblePresets = getVisibleWorkspacePresets(preferences, {
    binderSubject: context.binder.subject,
    historyEnabled: context.history.enabled,
    includeAdvanced: false,
  }).slice(0, 5);

  const renderModule = (moduleId: WorkspaceModuleId, slot: "primary" | "secondary" | "drawer") => (
    <article className="study-panels-card" data-study-panel-module={moduleId} data-study-panel-slot={slot}>
      {workspaceModuleRegistry[moduleId]?.render(
        moduleId === "whiteboard"
          ? {
              ...context,
              surface: "whiteboard",
              whiteboardCardDensity: "compact",
              whiteboardSourceDisplayMode: "summary",
              whiteboardShowMathInline: false,
            }
          : context,
      )}
    </article>
  );

  const moveTabFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = tabs.length - 1;
    const nextIndex =
      event.key === "ArrowRight"
        ? index === lastIndex ? 0 : index + 1
        : event.key === "ArrowLeft"
          ? index === 0 ? lastIndex : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? lastIndex
              : null;

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTabId(nextTab.id);
    focusTabAfterFrame(tabRefs.current[nextIndex]);
  };

  return (
    <section
      className="study-panels-shell"
      data-study-panels-density={preferences.modular.panelDensity}
      data-testid="study-panels-shell"
      data-workspace-presentation="study-panels"
      data-workspace-view="modular"
    >
      <header className="study-panels-shell__top">
        <div className="study-panels-shell__identity">
          <div className="study-panels-shell__eyebrow">
            <Badge variant="secondary">Study Panels</Badge>
            <span>{preferences.modular.panelDensity}</span>
            <span>{preset?.name ?? "General Study"}</span>
          </div>
          <h1>{context.selectedLesson.title}</h1>
          <p>
            {[folder?.name, context.binder.title, context.selectedLesson.title].filter(Boolean).join(" / ")}
          </p>
        </div>

        <div className="study-panels-shell__mode">
          <Sparkles className="size-4" />
          <div>
            <span>Recommended flow</span>
            <strong>{design.studentCommand.primaryAction}</strong>
          </div>
        </div>

        <div className="study-panels-shell__actions">
          <div className="study-panels-save-status" aria-label="Saved status">
            <CheckCircle2 className="size-4" />
            <span>{context.noteSaveLabel}</span>
          </div>
          <WorkspaceModeSwitcher currentMode={currentViewMode} onChangeMode={onChangeMode} />
          {onToggleFocus ? (
            <Button onClick={onToggleFocus} size="sm" type="button" variant="outline">
              <Focus className="size-4" />
              {focusModeActive ? "Exit focus" : "Focus panel"}
            </Button>
          ) : null}
          <Button
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((current) => !current)}
            size="sm"
            type="button"
            variant={drawerOpen ? "default" : "outline"}
          >
            <Layers3 className="size-4" />
            Tools
          </Button>
          {onCreateSticky ? (
            <Button onClick={onCreateSticky} size="sm" type="button" variant="outline">
              <StickyNote className="size-4" />
              Sticky
            </Button>
          ) : null}
          <Button onClick={onOpenSettings} size="sm" type="button" variant="default">
            <Settings2 className="size-4" />
            Settings
          </Button>
        </div>
      </header>

      <nav className="study-panels-tabs" role="tablist" aria-label="Study panel modules">
        {tabs.map((tab, index) => (
          <button
            aria-controls={`study-panel-${tab.id}`}
            aria-selected={activeTabId === tab.id}
            className="study-panels-tab"
            id={`study-panel-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            onKeyDown={(event) => moveTabFocus(event, index)}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            role="tab"
            tabIndex={activeTabId === tab.id ? 0 : -1}
            type="button"
          >
            <span>{tab.label}</span>
            <small>{tab.helper}</small>
          </button>
        ))}
      </nav>

      <div className="study-panels-preset-strip" aria-label="Study Panel presets">
        {visiblePresets.map((candidate) => (
          <button
            aria-current={candidate.id === preferences.preset ? "true" : undefined}
            key={candidate.id}
            onClick={() => context.onApplyPreset(candidate.id)}
            type="button"
          >
            {candidate.name}
          </button>
        ))}
      </div>

      <main
        className={cn(
          "study-panels-shell__body",
          drawerOpen && safeActiveToolId && "study-panels-shell__body--with-drawer",
        )}
        data-study-drawer-tool={drawerOpen && safeActiveToolId ? safeActiveToolId : undefined}
        data-study-primary={primaryModuleId}
        id={`study-panel-${activeTab?.id ?? "lesson"}`}
        role="tabpanel"
        aria-labelledby={`study-panel-tab-${activeTab?.id ?? "lesson"}`}
      >
        {isCompact || !secondaryModuleId ? (
          <section className="study-panels-single">
            {renderModule(primaryModuleId, "primary")}
          </section>
        ) : (
          <Group
            className="study-panels-split"
            defaultLayout={savedSplitLayout}
            id={`bindernotes-study-panels:${context.binder.id}:${context.selectedLesson.id}`}
            onLayoutChanged={(layout) => saveStudyPanelSplitLayout(splitLayoutStorageKey, layout)}
            orientation="horizontal"
          >
            <Panel defaultSize={savedSplitLayout.primary} id="primary" minSize={38}>
              {renderModule(primaryModuleId, "primary")}
            </Panel>
            <Separator className="study-panels-resize-handle" aria-label="Resize study panels" id="study-panels-resize" />
            <Panel defaultSize={savedSplitLayout.secondary} id="secondary" minSize={28}>
              {renderModule(secondaryModuleId, "secondary")}
            </Panel>
          </Group>
        )}

        {drawerOpen && safeActiveToolId ? (
          <aside className="study-panels-drawer" aria-label="Study tools">
            <div className="study-panels-drawer__tabs">
              {toolModuleIds.map((moduleId) => (
                <button
                  aria-current={safeActiveToolId === moduleId ? "true" : undefined}
                  key={moduleId}
                  onClick={() => setActiveToolId(moduleId)}
                  type="button"
                >
                  {workspaceModuleRegistry[moduleId]?.title ?? moduleId}
                </button>
              ))}
            </div>
            {renderModule(safeActiveToolId, "drawer")}
          </aside>
        ) : null}
      </main>
    </section>
  );
}

function focusTabAfterFrame(tab: HTMLButtonElement | null) {
  if (typeof window === "undefined" || !tab) {
    return;
  }

  const focus = () => tab.focus();
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focus);
    return;
  }

  window.setTimeout(focus, 0);
}

function getDefaultSplitLayout(primaryModuleId: WorkspaceModuleId): Layout {
  const primary = primaryModuleId === "desmos-graph" || primaryModuleId === "whiteboard" ? 62 : 56;
  return {
    primary,
    secondary: 100 - primary,
  };
}

function loadStudyPanelSplitLayout(storageKey: string, fallback: Layout): Layout {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) {
      return fallback;
    }
    const parsed = JSON.parse(value) as Partial<Layout>;
    const primary = typeof parsed.primary === "number" ? parsed.primary : fallback.primary;
    const secondary = typeof parsed.secondary === "number" ? parsed.secondary : fallback.secondary;

    if (primary < 38 || secondary < 28 || primary + secondary < 90) {
      return fallback;
    }

    return { primary, secondary };
  } catch {
    return fallback;
  }
}

function saveStudyPanelSplitLayout(storageKey: string, layout: Layout) {
  if (typeof window === "undefined") {
    return;
  }

  const primary = typeof layout.primary === "number" ? layout.primary : null;
  const secondary = typeof layout.secondary === "number" ? layout.secondary : null;
  if (primary === null || secondary === null) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify({ primary, secondary }));
}

function buildStudyPanelTabs(
  context: WorkspaceModuleContext,
  preferences: WorkspacePreferences,
): StudyPanelTab[] {
  const subject = `${context.binder.subject ?? ""} ${preferences.preset}`.toLowerCase();
  const isMath = subject.includes("math") || preferences.enabledModules.some((moduleId) => moduleId.includes("graph"));
  const isHistory = context.history.enabled || subject.includes("history");
  const tabs: StudyPanelTab[] = [
    { id: "lesson", label: "Lesson", helper: "Read", moduleId: "lesson" },
    { id: "notes", label: "Notes", helper: "Write", moduleId: "private-notes" },
  ];

  if (isMath) {
    tabs.push(
      { id: "graph", label: "Graph", helper: "Visual", moduleId: "desmos-graph" },
      { id: "formulas", label: "Formulas", helper: "Reference", moduleId: "formula-sheet" },
    );
    if (preferences.enabledModules.includes("whiteboard") || preferences.preset.includes("practice")) {
      tabs.push({ id: "board", label: "Board", helper: "Work", moduleId: "whiteboard" });
    }
  }

  if (isHistory) {
    tabs.push(
      { id: "timeline", label: "Timeline", helper: "Sequence", moduleId: "history-timeline" },
      { id: "evidence", label: "Evidence", helper: "Proof", moduleId: "history-evidence" },
      { id: "argument", label: "Argument", helper: "Claim", moduleId: "history-argument" },
    );
  }

  tabs.push(
    { id: "highlights", label: "Highlights", helper: "Review", moduleId: "recent-highlights" },
    { id: "tools", label: "Tools", helper: "Extra", moduleId: "comments" },
  );

  const seen = new Set<WorkspaceModuleId>();
  return tabs.filter((tab) => {
    if (!workspaceModuleRegistry[tab.moduleId] || seen.has(tab.moduleId)) {
      return false;
    }
    seen.add(tab.moduleId);
    return true;
  });
}

function chooseSecondaryModule(
  primaryModuleId: WorkspaceModuleId,
  context: WorkspaceModuleContext,
  preferences: WorkspacePreferences,
): WorkspaceModuleId | null {
  const preferred =
    primaryModuleId === "lesson"
      ? "private-notes"
      : primaryModuleId === "private-notes"
        ? "lesson"
        : primaryModuleId === "desmos-graph"
          ? "formula-sheet"
          : primaryModuleId === "formula-sheet"
            ? "private-notes"
            : primaryModuleId.startsWith("history-")
              ? "lesson"
              : primaryModuleId === "whiteboard"
                ? "private-notes"
                : "lesson";

  const candidates: WorkspaceModuleId[] = [
    preferred,
    "private-notes",
    "lesson",
    context.history.enabled ? "history-evidence" : "recent-highlights",
    preferences.enabledModules.includes("formula-sheet") ? "formula-sheet" : "recent-highlights",
  ];

  return candidates.find((moduleId) => moduleId !== primaryModuleId && workspaceModuleRegistry[moduleId]) ?? null;
}

function getToolModules(
  preferences: WorkspacePreferences,
  primaryModuleId: WorkspaceModuleId,
  secondaryModuleId: WorkspaceModuleId | null,
) {
  const design = getFaceliftWorkspacePresetDesign(preferences.preset);
  const ordered = [
    ...design.collapsedModules,
    ...design.optionalModules,
    ...defaultTools,
  ];
  const blocked = new Set([primaryModuleId, secondaryModuleId].filter(Boolean));
  const unique = new Set<WorkspaceModuleId>();

  return ordered.filter((moduleId) => {
    if (blocked.has(moduleId) || unique.has(moduleId) || !workspaceModuleRegistry[moduleId]) {
      return false;
    }
    unique.add(moduleId);
    return true;
  });
}
