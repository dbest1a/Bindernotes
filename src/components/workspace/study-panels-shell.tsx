import {
  BookOpenText,
  CheckCircle2,
  ClipboardList,
  Highlighter,
  Layers3,
  LineChart,
  Maximize2,
  Minimize2,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  Quote,
  Settings2,
  Sigma,
  Sparkles,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBetaFeatures } from "@/hooks/use-beta-features";
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
import type { WorkspaceModuleId, WorkspacePreferences, WorkspacePresetId, WorkspaceViewMode } from "@/types";

type StudyPanelsShellProps = {
  compactStudyChrome?: boolean;
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

type StudySubject = "general" | "math" | "history" | "chemistry";

type StudyToolPreview = {
  moduleId: WorkspaceModuleId;
  title: string;
  description: string;
  subject: StudySubject;
  stability: "stable" | "beta";
  actionLabel?: string;
  unavailableMessage?: string;
};

const defaultTools: WorkspaceModuleId[] = [
  "recent-highlights",
  "comments",
  "flashcards",
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

const chemistryDefaultTools: WorkspaceModuleId[] = [
  "chem-lab-coach",
  "chem-quick-tools",
  "chem-concept-cards",
  "chem-periodic-table",
  "chem-element-builder",
  "chem-periodic-trends-graph",
  "chem-electron-config-builder",
  "chem-molecule-builder",
  "chem-geometry-viewer",
  "chem-reaction-balancer",
  "chem-tri-reaction-view",
  "chem-stoichiometry-coach",
  "chem-molar-mass-calculator",
  "chem-solution-mixer",
  "chem-molarity-calculator",
  "chem-desmos-concentration-graph",
  "chem-ph-calculator",
  "chem-titration-lab",
  "chem-desmos-titration-curve",
  "chem-kinetics-simulator",
  "chem-desmos-kinetics-plot",
  "chem-data-table",
  "chem-calorimetry-lab",
  "chem-energy-diagram",
  "chem-calculation-sheet",
  "chem-safety-cards",
  "chem-review-queue",
  "chem-lab-notebook",
  "chem-reference-safety",
];

const studyPanelLayoutStoragePrefix = "bindernotes.study-panels.layout";

export function StudyPanelsShell({
  compactStudyChrome: compactStudyChromeProp = false,
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
  const betaFeatures = useBetaFeatures(context.ownerId);
  const betaFeaturesEnabled = betaFeatures.betaFeaturesEnabled;
  const compactStudyChrome =
    compactStudyChromeProp || betaFeatures.isFeatureEnabled("compactStudyChrome");
  const revampBetaEnabled = betaFeatures.revampBetaEnabled;
  const recallLabEnabled = betaFeatures.isFeatureEnabled("recallLab");
  const studyPanelsV2 = betaFeatures.isFeatureEnabled("studyPanelsV2");
  const isHistoryPanels =
    context.history.enabled ||
    `${context.binder.subject ?? ""} ${preferences.preset}`.toLowerCase().includes("history");
  const folder = context.library
    ? getPrimaryFolder(
        context.library.binders,
        context.library.folders,
        context.library.folderBinders,
        context.binder.id,
      )
    : undefined;
  const tabs = useMemo(
    () => buildStudyPanelTabs(context, preferences, betaFeaturesEnabled),
    [betaFeaturesEnabled, context, preferences],
  );
  const preferredTabId = tabs.find((tab) => tab.moduleId === design.primaryModule)?.id ?? tabs[0]?.id ?? "lesson";
  const [activeTabId, setActiveTabId] = useState(preferredTabId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeToolId, setActiveToolId] = useState<WorkspaceModuleId>("recent-highlights");
  const [actionStatus, setActionStatus] = useState("");
  const [hasSelectedText, setHasSelectedText] = useState(false);
  const shellRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const previousPresetRef = useRef(preferences.preset);

  useEffect(() => {
    const presetChanged = previousPresetRef.current !== preferences.preset;
    previousPresetRef.current = preferences.preset;

    setActiveTabId((current) => {
      if (presetChanged) {
        return preferredTabId;
      }

      return tabs.some((tab) => tab.id === current) ? current : preferredTabId;
    });

    if (presetChanged) {
      setDrawerOpen(false);
    }
  }, [preferences.preset, preferredTabId, tabs]);

  useEffect(() => {
    if (!studyPanelsV2 || !actionStatus) {
      return;
    }

    const timeout = window.setTimeout(() => setActionStatus(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [actionStatus, studyPanelsV2]);

  useEffect(() => {
    if (!studyPanelsV2 || typeof document === "undefined") {
      setHasSelectedText(false);
      return;
    }

    const syncSelection = () => {
      setHasSelectedText(Boolean(document.getSelection()?.toString().trim()));
    };

    syncSelection();
    document.addEventListener("selectionchange", syncSelection);
    return () => document.removeEventListener("selectionchange", syncSelection);
  }, [studyPanelsV2]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const primaryModuleId = activeTab?.moduleId ?? design.primaryModule;
  const focusSecondaryModuleId =
    focusModeActive && !isCompact && primaryModuleId === "whiteboard" && workspaceModuleRegistry["private-notes"]
      ? "private-notes"
      : null;
  const rawSecondaryModuleId =
    isCompact
      ? null
      : focusModeActive
        ? focusSecondaryModuleId
      : studyPanelsV2
        ? chooseStudyPanelsV2SecondaryModule(primaryModuleId, context, preferences)
        : chooseSecondaryModule(primaryModuleId, context, preferences);
  const secondaryVisibilityStorageKey = `${studyPanelLayoutStoragePrefix}.secondary:${context.binder.id}:${context.selectedLesson.id}:${activeTab?.id ?? "lesson"}`;
  const [secondaryPanelHidden, setSecondaryPanelHidden] = useState(false);

  useEffect(() => {
    if (!studyPanelsV2 || !rawSecondaryModuleId) {
      setSecondaryPanelHidden(false);
      return;
    }

    setSecondaryPanelHidden(loadStudyPanelSecondaryHidden(secondaryVisibilityStorageKey));
  }, [rawSecondaryModuleId, secondaryVisibilityStorageKey, studyPanelsV2]);

  const secondaryModuleId =
    studyPanelsV2 && secondaryPanelHidden ? null : rawSecondaryModuleId;
  const defaultSplitLayout = getDefaultSplitLayout(primaryModuleId);
  const splitLayoutStorageKey = studyPanelsV2
    ? `${studyPanelLayoutStoragePrefix}:${context.binder.id}:${context.selectedLesson.id}:${activeTab?.id ?? "lesson"}`
    : `${studyPanelLayoutStoragePrefix}:${context.binder.id}:${context.selectedLesson.id}`;
  const savedSplitLayout = useMemo(
    () => loadStudyPanelSplitLayout(splitLayoutStorageKey, defaultSplitLayout),
    [defaultSplitLayout, splitLayoutStorageKey],
  );
  const toolModuleIds = useMemo(
    () => getToolModules(preferences, primaryModuleId, secondaryModuleId, context),
    [context, preferences, primaryModuleId, secondaryModuleId],
  );
  const toolPreviewCards = useMemo(
    () =>
      getStudyToolPreviewCards({
        betaFeaturesEnabled,
        context,
        moduleIds: toolModuleIds,
        preferences,
        recallLabEnabled,
      }),
    [betaFeaturesEnabled, context, preferences, recallLabEnabled, toolModuleIds],
  );
  const previewModuleIds = toolPreviewCards.map((card) => card.moduleId);
  const safeActiveToolId = previewModuleIds.includes(activeToolId) ? activeToolId : previewModuleIds[0];
  const visiblePresets = getVisibleWorkspacePresets(preferences, {
    binderSubject: context.binder.subject,
    historyEnabled: context.history.enabled,
    includeAdvanced: false,
  }).slice(0, 5);

  const activateTab = (tab: StudyPanelTab) => {
    setActiveTabId(tab.id);
    setDrawerOpen(tab.id === "tools");
    setActionStatus(`${tab.label} panel active.`);
  };

  const applyStudyPanelPreset = (presetId: WorkspacePresetId) => {
    const nextTabId = getPreferredTabIdForPreset(tabs, presetId);
    setActiveTabId(nextTabId);
    setDrawerOpen(false);

    const nextPresetName = workspacePresets.find((candidate) => candidate.id === presetId)?.name ?? "Study mode";
    if (presetId === preferences.preset) {
      setActionStatus(`${nextPresetName} is already active. Refocused ${getTabLabel(tabs, nextTabId)}.`);
      return;
    }

    setActionStatus(`${nextPresetName} applied.`);
    context.onApplyPreset(presetId);
  };
  const openToolPreview = (card: StudyToolPreview) => {
    setActiveToolId(card.moduleId);
    setDrawerOpen(true);
    setActionStatus(`${card.title} opened.`);
  };
  const openRecallLab = (status = "Recall Lab opened.") => {
    setActiveToolId("flashcards");
    setDrawerOpen(true);
    setActionStatus(status);
  };
  const showGuidedActions =
    shouldShowGuidedSplitActions(primaryModuleId, secondaryModuleId, preferences) &&
    (!studyPanelsV2 || ["lesson", "notes"].includes(activeTab?.id ?? ""));
  const selectedTextForAction = () =>
    typeof document === "undefined" ? "" : document.getSelection()?.toString().trim() ?? "";
  const selectionActionDisabled = studyPanelsV2 && !hasSelectedText;
  const tabStripHidden = focusModeActive;
  const showSecondaryPanelControl = studyPanelsV2 && Boolean(rawSecondaryModuleId) && !isCompact && !focusModeActive;
  const actionStatusControl = actionStatus ? (
    <div className="study-panels-action-status" role="status">
      {actionStatus}
    </div>
  ) : null;
  const secondaryPanelControl = showSecondaryPanelControl ? (
    <div className="study-panels-panel-controls">
      <button
        aria-pressed={secondaryPanelHidden}
        data-study-panel-secondary-toggle="true"
        onClick={() => {
          const next = !secondaryPanelHidden;
          setSecondaryPanelHidden(next);
          saveStudyPanelSecondaryHidden(secondaryVisibilityStorageKey, next);
          setActionStatus(
            next
              ? `${activeTab?.label ?? "Panel"} secondary panel hidden.`
              : `${activeTab?.label ?? "Panel"} secondary panel restored.`,
          );
        }}
        type="button"
      >
        {secondaryPanelHidden ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        {secondaryPanelHidden
          ? `Show secondary panel for ${activeTab?.label ?? "this tab"}`
          : `Hide secondary panel for ${activeTab?.label ?? "this tab"}`}
      </button>
    </div>
  ) : null;
  const guidedActionsControl = showGuidedActions ? (
    <section
      className="study-panels-guided-actions"
      data-guided-actions-placement={studyPanelsV2 ? "floating" : "inline"}
      role="region"
      aria-label="Guided Split Study actions"
    >
      <div>
        <span>Split actions</span>
        <strong>Move evidence into your notes without leaving the study flow.</strong>
      </div>
      <div className="study-panels-guided-actions__buttons">
        <button
          disabled={selectionActionDisabled}
          onClick={() => {
            context.onCreateQuoteExcerpt(selectedTextForAction());
            setActionStatus("Quote action sent to notes.");
          }}
          type="button"
        >
          <Quote className="size-4" />
          Quote to note
        </button>
        <button
          onClick={() => {
            context.onPrepareComment("Question to revisit");
            setActionStatus("Question pin prepared.");
          }}
          type="button"
        >
          <StickyNote className="size-4" />
          Pin question
        </button>
        <button
          onClick={() => {
            if (onCreateSticky) {
              onCreateSticky();
            } else {
              context.onCreateLooseSticky();
            }
            setActionStatus("Sticky note opened.");
          }}
          type="button"
        >
          <StickyNote className="size-4" />
          Make sticky
        </button>
        <button
          disabled={selectionActionDisabled}
          onClick={() => {
            context.onSendSelectionToNotes(selectedTextForAction());
            setActionStatus("Highlight send action opened.");
          }}
          type="button"
        >
          <Highlighter className="size-4" />
          Send highlight to notes
        </button>
        {recallLabEnabled ? (
          <>
            <button
              disabled={selectionActionDisabled}
              onClick={() => openRecallLab("Selected text is ready for a Recall Lab draft.")}
              type="button"
            >
              <ClipboardList className="size-4" />
              Make recall card
            </button>
            <button
              disabled={selectionActionDisabled}
              onClick={() => openRecallLab("Cloze draft flow opened in Recall Lab.")}
              type="button"
            >
              <BookOpenText className="size-4" />
              Make cloze card
            </button>
            <button onClick={() => openRecallLab("Source deck opened.")} type="button">
              <Layers3 className="size-4" />
              Open source deck
            </button>
          </>
        ) : null}
      </div>
    </section>
  ) : null;

  const requestStudyPanelsFullscreen = () => {
    if (typeof document === "undefined" || document.fullscreenElement) {
      return;
    }

    const shell = shellRef.current;
    if (!shell?.requestFullscreen) {
      return;
    }

    void shell.requestFullscreen().catch(() => {
      // CSS fullscreen focus still covers the app chrome if the browser denies native fullscreen.
    });
  };

  const exitStudyPanelsFullscreen = () => {
    if (typeof document === "undefined" || !document.fullscreenElement || !document.exitFullscreen) {
      return;
    }

    void document.exitFullscreen().catch(() => {
      // App focus mode exits independently, so a browser-level exit denial should not trap the user.
    });
  };

  const handleToggleFocusMode = () => {
    if (!onToggleFocus) {
      return;
    }

    if (focusModeActive) {
      exitStudyPanelsFullscreen();
    } else {
      requestStudyPanelsFullscreen();
    }

    onToggleFocus();
  };

  const renderModule = (moduleId: WorkspaceModuleId, slot: "primary" | "secondary" | "drawer") => {
    const embeddedContext: WorkspaceModuleContext = {
      ...context,
      graphKeypad: studyPanelsV2 && moduleId === "desmos-graph" ? false : context.graphKeypad,
      studyPanelsV2,
      whiteboardSidebarDefaultCollapsed:
        studyPanelsV2 && moduleId === "whiteboard" ? true : context.whiteboardSidebarDefaultCollapsed,
      onOpenWorkspaceTool: (targetModuleId) => {
        const target = workspaceModuleRegistry[targetModuleId];
        setActiveToolId(targetModuleId);
        setDrawerOpen(true);
        setActionStatus(`${target?.title ?? "Tool"} opened.`);
      },
      ...(moduleId === "whiteboard"
        ? {
            surface: "whiteboard" as const,
            whiteboardCardDensity: "compact" as const,
            whiteboardSourceDisplayMode: "summary" as const,
            whiteboardShowMathInline: false,
            onExitWhiteboardFocus:
              focusModeActive && onToggleFocus ? handleToggleFocusMode : context.onExitWhiteboardFocus,
          }
        : {}),
    };

    return (
      <article className="study-panels-card" data-study-panel-module={moduleId} data-study-panel-slot={slot}>
        {workspaceModuleRegistry[moduleId]?.render(embeddedContext)}
      </article>
    );
  };

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
    activateTab(nextTab);
    focusTabAfterFrame(tabRefs.current[nextIndex]);
  };

  return (
    <section
      className="study-panels-shell"
      data-compact-study-chrome={compactStudyChrome ? "true" : "false"}
      data-focus-mode-active={focusModeActive ? "true" : "false"}
      data-history-study-panels={isHistoryPanels ? "true" : "false"}
      data-revamp-beta={revampBetaEnabled ? "true" : "false"}
      data-study-panels-density={preferences.modular.panelDensity}
      data-study-panels-tab-strip={tabStripHidden ? "hidden" : "visible"}
      data-study-panels-v2={studyPanelsV2 ? "true" : "false"}
      data-secondary-preset-strip={
        preferences.modular.showSecondaryPresetStrip ? "visible" : "hidden"
      }
      data-testid="study-panels-shell"
      data-workspace-presentation="study-panels"
      data-workspace-view="modular"
      ref={shellRef}
    >
      {focusModeActive ? (
        <div className="study-panels-focus-dock" aria-label="Fullscreen study controls" role="toolbar">
          {onToggleFocus ? (
            <Button
              aria-label="Exit full screen"
              onClick={handleToggleFocusMode}
              size="sm"
              title="Exit full screen"
              type="button"
              variant="default"
            >
              <Minimize2 className="size-4" />
              <span>Exit full screen</span>
            </Button>
          ) : null}
          <Button
            aria-label={drawerOpen ? "Hide toolbox" : "Show toolbox"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((current) => !current)}
            size="sm"
            title={drawerOpen ? "Hide toolbox" : "Show toolbox"}
            type="button"
            variant={drawerOpen ? "default" : "outline"}
          >
            <Layers3 className="size-4" />
            <span>{drawerOpen ? "Hide toolbox" : "Toolbox"}</span>
          </Button>
        </div>
      ) : (
        <>
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
            <span>{compactStudyChrome ? "Next" : "Recommended flow"}</span>
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
            <Button
              aria-label="Full screen panel"
              onClick={handleToggleFocusMode}
              size="sm"
              title="Full screen panel"
              type="button"
              variant="outline"
            >
              <Maximize2 className="size-4" />
              <span className="study-panels-action-label">
                Full screen
              </span>
            </Button>
          ) : null}
          <Button
            aria-label="Tools"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((current) => !current)}
            size="sm"
            title="Tools"
            type="button"
            variant={drawerOpen ? "default" : "outline"}
          >
            <Layers3 className="size-4" />
            <span className="study-panels-action-label">Tools</span>
          </Button>
          {onCreateSticky ? (
            <Button
              aria-label="Sticky"
              onClick={onCreateSticky}
              size="sm"
              title="Sticky"
              type="button"
              variant="outline"
            >
              <StickyNote className="size-4" />
              <span className="study-panels-action-label">Sticky</span>
            </Button>
          ) : null}
          <Button
            aria-label="Settings"
            onClick={onOpenSettings}
            size="sm"
            title="Settings"
            type="button"
            variant="default"
          >
            <Settings2 className="size-4" />
            <span className="study-panels-action-label">Settings</span>
          </Button>
        </div>
      </header>

      {!tabStripHidden ? (
      <nav className="study-panels-tabs" role="tablist" aria-label="Study panel modules">
        {tabs.map((tab, index) => {
          const tabLabel = studyPanelsV2 || (compactStudyChrome && tab.id === "tools") ? getStudyPanelV2TabLabel(tab) : tab.label;
          const TabIcon = getStudyPanelTabIcon(tab);

          return (
          <button
            aria-label={studyPanelsV2 && isHistoryPanels ? getHistoryStudyPanelTabLabel(tab) : undefined}
            aria-controls={`study-panel-${tab.id}`}
            aria-selected={activeTabId === tab.id}
            className="study-panels-tab"
            id={`study-panel-tab-${tab.id}`}
            key={tab.id}
            onClick={() => activateTab(tab)}
            onKeyDown={(event) => moveTabFocus(event, index)}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            role="tab"
            tabIndex={activeTabId === tab.id ? 0 : -1}
            type="button"
          >
            {studyPanelsV2 ? <TabIcon aria-hidden="true" className="size-3.5" /> : null}
            <span>{tabLabel}</span>
            {!studyPanelsV2 ? <small>{tab.helper}</small> : null}
          </button>
          );
        })}
      </nav>
      ) : null}

      {preferences.modular.showSecondaryPresetStrip ? (
        <div className="study-panels-preset-strip" aria-label="Study Panel presets">
          {visiblePresets.map((candidate) => (
            <button
              aria-current={candidate.id === preferences.preset ? "true" : undefined}
              key={candidate.id}
              onClick={() => applyStudyPanelPreset(candidate.id)}
              type="button"
            >
              {candidate.name}
            </button>
          ))}
        </div>
      ) : null}
      {studyPanelsV2 && (actionStatusControl || guidedActionsControl || secondaryPanelControl) ? (
        <div className="study-panels-compact-action-row" data-study-panels-action-row="compact">
          {actionStatusControl}
          {guidedActionsControl}
          {secondaryPanelControl}
        </div>
      ) : (
        <>
          {actionStatusControl}
          {secondaryPanelControl}
          {guidedActionsControl}
        </>
      )}
        </>
      )}

      <main
        className={cn(
          "study-panels-shell__body",
          drawerOpen && safeActiveToolId && "study-panels-shell__body--with-drawer",
        )}
        data-study-drawer-tool={drawerOpen && safeActiveToolId ? safeActiveToolId : undefined}
        data-study-primary={primaryModuleId}
        data-study-secondary={secondaryModuleId ?? undefined}
        data-secondary-panel-hidden={studyPanelsV2 && secondaryPanelHidden ? "true" : "false"}
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
            data-study-split-layout={`${savedSplitLayout.primary}/${savedSplitLayout.secondary}`}
            data-study-split-storage-key={splitLayoutStorageKey}
            id={`bindernotes-study-panels:${context.binder.id}:${context.selectedLesson.id}`}
            key={studyPanelsV2 ? activeTab?.id ?? "lesson" : "classic"}
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
            <div className="study-panels-drawer__intro">
              <span>{getStudySubjectLabel(detectStudySubject(context, preferences))} tools</span>
              <strong>Open one surface at a time.</strong>
              <p>Cards launch real BinderNotes modules or a compact beta preview when the full tool is still in progress.</p>
            </div>
            <div className="study-panels-tool-previews" data-beta-features={betaFeaturesEnabled ? "on" : "off"}>
              {toolPreviewCards.map((card) => (
                <article
                  className="study-panels-tool-card"
                  data-study-tool-active={safeActiveToolId === card.moduleId ? "true" : "false"}
                  data-study-tool-stability={card.stability}
                  data-testid={`study-tool-preview-${card.moduleId}`}
                  key={card.moduleId}
                >
                  <div>
                    <span>{getStudySubjectLabel(card.subject)}</span>
                    <Badge variant={card.stability === "beta" ? "default" : "secondary"}>
                      {card.stability === "beta" ? "Beta" : "Stable"}
                    </Badge>
                  </div>
                  <strong>{card.title}</strong>
                  <p>{card.description}</p>
                  {card.unavailableMessage ? <small>{card.unavailableMessage}</small> : null}
                  <button
                    aria-pressed={safeActiveToolId === card.moduleId}
                    onClick={() => openToolPreview(card)}
                    type="button"
                  >
                    {card.actionLabel ?? `Open ${card.title}`}
                  </button>
                </article>
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

function loadStudyPanelSecondaryHidden(storageKey: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(storageKey) === "hidden";
}

function saveStudyPanelSecondaryHidden(storageKey: string, hidden: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (hidden) {
    window.localStorage.setItem(storageKey, "hidden");
    return;
  }

  window.localStorage.removeItem(storageKey);
}

function getStudyPanelV2TabLabel(tab: StudyPanelTab) {
  return tab.id === "tools" ? "Extras" : tab.label;
}

function getHistoryStudyPanelTabLabel(tab: StudyPanelTab) {
  if (tab.id === "tools") {
    return "Sticky Notes Extra";
  }

  return `${tab.label} ${tab.helper}`.trim();
}

function getStudyPanelTabIcon(tab: StudyPanelTab): LucideIcon {
  if (tab.moduleId === "lesson") {
    return BookOpenText;
  }
  if (tab.moduleId === "private-notes") {
    return NotebookPen;
  }
  if (tab.moduleId === "desmos-graph" || tab.id.includes("graph") || tab.id === "curve") {
    return LineChart;
  }
  if (tab.moduleId === "formula-sheet" || tab.id === "formulas" || tab.id === "mass") {
    return Sigma;
  }
  if (tab.moduleId === "whiteboard" || tab.id === "board") {
    return PanelTop;
  }
  if (tab.id === "tools" || tab.id === "quick-chem") {
    return Layers3;
  }
  if (tab.id === "highlights" || tab.moduleId === "recent-highlights") {
    return Highlighter;
  }

  return Sparkles;
}

function getPreferredTabIdForPreset(tabs: StudyPanelTab[], presetId: WorkspacePresetId) {
  if (presetId === "chem-guided-study") {
    const guideTab = tabs.find((tab) => tab.moduleId === "chem-lab-coach");
    if (guideTab) {
      return guideTab.id;
    }
  }

  const design = getFaceliftWorkspacePresetDesign(presetId);
  return tabs.find((tab) => tab.moduleId === design.primaryModule)?.id ?? tabs[0]?.id ?? "lesson";
}

function getTabLabel(tabs: StudyPanelTab[], tabId: string) {
  return tabs.find((tab) => tab.id === tabId)?.label ?? "the active panel";
}

function shouldShowGuidedSplitActions(
  primaryModuleId: WorkspaceModuleId,
  secondaryModuleId: WorkspaceModuleId | null,
  preferences: WorkspacePreferences,
) {
  const visible = new Set([primaryModuleId, secondaryModuleId].filter(Boolean));
  return (
    preferences.preset === "split-study" ||
    preferences.preset === "notes-focus" ||
    (visible.has("lesson") && visible.has("private-notes"))
  );
}

function detectStudySubject(context: WorkspaceModuleContext, preferences: WorkspacePreferences): StudySubject {
  const subject = `${context.binder.subject ?? ""} ${context.binder.title ?? ""} ${preferences.preset}`.toLowerCase();

  if (subject.includes("chem") || preferences.enabledModules.some((moduleId) => moduleId.startsWith("chem-"))) {
    return "chemistry";
  }

  if (context.history.enabled || subject.includes("history")) {
    return "history";
  }

  if (
    subject.includes("math") ||
    subject.includes("algebra") ||
    subject.includes("calculus") ||
    preferences.enabledModules.some((moduleId) =>
      ["desmos-graph", "formula-sheet", "math-blocks", "scientific-calculator", "saved-graphs", "whiteboard"].includes(
        moduleId,
      ),
    )
  ) {
    return "math";
  }

  return "general";
}

function getStudySubjectLabel(subject: StudySubject) {
  return subject === "math"
    ? "Math"
    : subject === "history"
      ? "History"
      : subject === "chemistry"
        ? "Chemistry"
        : "General";
}

const toolPreviewCopy: Record<
  WorkspaceModuleId,
  Pick<StudyToolPreview, "title" | "description" | "subject" | "stability" | "actionLabel">
> = {
  lesson: {
    title: "Source lesson",
    description: "Return to the reading surface and keep the source beside your work.",
    subject: "general",
    stability: "stable",
    actionLabel: "Focus source lesson",
  },
  "private-notes": {
    title: "Private notes",
    description: "Open your writing surface for explanations, checks, and study notes.",
    subject: "general",
    stability: "stable",
    actionLabel: "Open Private notes",
  },
  "recent-highlights": {
    title: "Highlights",
    description: "Review saved source anchors and jump back to important evidence.",
    subject: "general",
    stability: "stable",
    actionLabel: "Open Highlights",
  },
  comments: {
    title: "Sticky notes",
    description: "Pin a question, reminder, or quick comment to the current lesson.",
    subject: "general",
    stability: "stable",
    actionLabel: "Open Sticky notes",
  },
  "lesson-outline": {
    title: "Lesson outline",
    description: "Scan the lesson structure before choosing where to read next.",
    subject: "general",
    stability: "stable",
    actionLabel: "Open Lesson outline",
  },
  search: {
    title: "Search lesson",
    description: "Find words, definitions, and repeated ideas in the current source.",
    subject: "general",
    stability: "stable",
    actionLabel: "Open Search",
  },
  "desmos-graph": {
    title: "Desmos Graph",
    description: "Graph equations and compare functions.",
    subject: "math",
    stability: "stable",
  },
  "formula-sheet": {
    title: "Formula Sheet",
    description: "Keep formulas beside your work.",
    subject: "math",
    stability: "stable",
  },
  "scientific-calculator": {
    title: "Scientific Calculator",
    description: "Calculate without leaving the study panel.",
    subject: "math",
    stability: "stable",
  },
  "saved-graphs": {
    title: "Saved Graphs",
    description: "Reopen graph snapshots and compare previous visual work.",
    subject: "math",
    stability: "stable",
  },
  "math-blocks": {
    title: "Math Blocks",
    description: "Work through steps and scratch reasoning next to the lesson.",
    subject: "math",
    stability: "stable",
  },
  whiteboard: {
    title: "Whiteboard",
    description: "Sketch work and keep live study modules nearby.",
    subject: "math",
    stability: "stable",
  },
  "history-timeline": {
    title: "Timeline",
    description: "Place events in order and connect cause/effect.",
    subject: "history",
    stability: "stable",
    actionLabel: "Open Timeline",
  },
  "history-evidence": {
    title: "Evidence",
    description: "Collect source details and tie them to claims.",
    subject: "history",
    stability: "stable",
    actionLabel: "Open Evidence",
  },
  "history-argument": {
    title: "Argument Builder",
    description: "Turn evidence into a claim and paragraph.",
    subject: "history",
    stability: "stable",
    actionLabel: "Open Argument Builder",
  },
  "history-myth-checks": {
    title: "Myth checks",
    description: "Test a claim against sources and counterevidence.",
    subject: "history",
    stability: "stable",
    actionLabel: "Open Myth checks",
  },
  "chem-periodic-table": {
    title: "Element Explorer",
    description: "Inspect valence, ions, bonding, and element facts.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-lab-coach": {
    title: "Chemistry Lab Coach",
    description: "Move through objective, safety, observation, data, graphing, and conclusion steps.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-element-builder": {
    title: "Element Builder",
    description: "Build isotopes and ions from protons, neutrons, and electrons.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-titration-lab": {
    title: "Titration Lab",
    description: "Record increments and watch the endpoint curve.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-stoichiometry-coach": {
    title: "Lab Coach",
    description: "Walk through mole bridges, ratios, and unit cancellation.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-safety-cards": {
    title: "Safety / reagent cards",
    description: "Check safety reminders and reagent notes before virtual lab work.",
    subject: "chemistry",
    stability: "stable",
  },
  "chem-reference-safety": {
    title: "Chemistry reference",
    description: "Review safety, conservation, and misconception checks.",
    subject: "chemistry",
    stability: "stable",
  },
  "chem-quick-tools": {
    title: "Chemistry Quick Tools",
    description: "Use molar mass, pH, ions, solubility, and sig-fig helpers.",
    subject: "chemistry",
    stability: "stable",
  },
  "chem-concept-cards": {
    title: "Chemistry Concept Cards",
    description: "Review formulas, misconceptions, and AP/Gen Chem tags.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-lab-notebook": {
    title: "Lab Notebook",
    description: "Write hypothesis, procedure, data, calculations, and conclusion.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-ph-calculator": {
    title: "pH Calculator",
    description: "Calculate pH, pOH, and acid/base relationships.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-reaction-balancer": {
    title: "Reaction Balancer",
    description: "Balance equations and check atom conservation.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-tri-reaction-view": {
    title: "Reaction View",
    description: "Compare symbolic, particle, and macroscopic reaction views.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-periodic-trends-graph": {
    title: "Periodic Trends Graph",
    description: "Compare trends with a compact graph or Desmos-backed view.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-electron-config-builder": {
    title: "Electron Configuration",
    description: "Practice orbital filling and noble-gas shorthand.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-molecule-builder": {
    title: "Molecule Builder",
    description: "Build Lewis structures, lone pairs, and simple geometry.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-geometry-viewer": {
    title: "Geometry Viewer",
    description: "Check simple VSEPR geometry suggestions.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-molar-mass-calculator": {
    title: "Molar Mass Calculator",
    description: "Calculate formula masses quickly.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-solution-mixer": {
    title: "Solution Mixer",
    description: "Plan molarity and dilution setups.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-molarity-calculator": {
    title: "Molarity Calculator",
    description: "Use M1V1 and concentration calculations.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-desmos-concentration-graph": {
    title: "Concentration Graph",
    description: "Graph dilution and concentration relationships.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-desmos-titration-curve": {
    title: "Titration Curve",
    description: "Watch the endpoint curve with a fallback if Desmos is unavailable.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-kinetics-simulator": {
    title: "Kinetics Simulator",
    description: "Adjust reaction order and rate behavior.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-desmos-kinetics-plot": {
    title: "Kinetics Plot",
    description: "Compare concentration versus time and linearized plots.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-data-table": {
    title: "Chemistry Data Table",
    description: "Keep lab measurements in a compact table.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-calorimetry-lab": {
    title: "Calorimetry Lab",
    description: "Calculate q = mc delta T and classify heat flow.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-energy-diagram": {
    title: "Energy Diagram",
    description: "Compare endothermic and exothermic energy profiles.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-calculation-sheet": {
    title: "Calculation Sheet",
    description: "Organize chemistry calculations beside your lab.",
    subject: "chemistry",
    stability: "beta",
  },
  "chem-review-queue": {
    title: "Chem Challenge Queue",
    description: "Try deterministic review prompts for the current unit.",
    subject: "chemistry",
    stability: "beta",
  },
  "binder-notebook": {
    title: "Binder notebook",
    description: "Review lesson notes across the binder.",
    subject: "general",
    stability: "stable",
  },
  tasks: {
    title: "Tasks",
    description: "Keep a simple study checklist nearby.",
    subject: "general",
    stability: "stable",
  },
  "related-concepts": {
    title: "Related concepts",
    description: "Review linked terms, people, and ideas.",
    subject: "general",
    stability: "stable",
  },
  flashcards: {
    title: "Recall Lab",
    description: "Turn this lesson's notes, highlights, and source passages into source-linked recall cards.",
    subject: "general",
    stability: "beta",
    actionLabel: "Open Recall Lab",
  },
  "mini-tools": {
    title: "Quick actions",
    description: "Open small focus helpers and checklists.",
    subject: "general",
    stability: "stable",
  },
  "graph-panel": {
    title: "Graph panel",
    description: "Open a graph-focused math surface.",
    subject: "math",
    stability: "stable",
  },
};

function getStudyToolPreviewCards({
  betaFeaturesEnabled,
  context,
  moduleIds,
  preferences,
  recallLabEnabled,
}: {
  betaFeaturesEnabled: boolean;
  context: WorkspaceModuleContext;
  moduleIds: WorkspaceModuleId[];
  preferences: WorkspacePreferences;
  recallLabEnabled?: boolean;
}) {
  const subject = detectStudySubject(context, preferences);
  const subjectModules: Record<StudySubject, WorkspaceModuleId[]> = {
    general: ["private-notes", "recent-highlights", "comments", "flashcards", "lesson", "lesson-outline", "search", "mini-tools"],
    math: [
      "desmos-graph",
      "formula-sheet",
      "scientific-calculator",
      "saved-graphs",
      "math-blocks",
      "whiteboard",
      "flashcards",
      "private-notes",
      "recent-highlights",
    ],
    history: [
      "history-timeline",
      "history-evidence",
      "history-argument",
      "history-myth-checks",
      "flashcards",
      "private-notes",
      "recent-highlights",
      "lesson",
    ],
    chemistry: [
      "chem-lab-coach",
      "flashcards",
      "chem-quick-tools",
      "chem-reference-safety",
      "chem-periodic-table",
      "chem-titration-lab",
      "chem-stoichiometry-coach",
      "chem-safety-cards",
      "private-notes",
      "lesson",
    ],
  };
  const ordered = [...subjectModules[subject], ...moduleIds, ...subjectModules.general];
  const seen = new Set<WorkspaceModuleId>();
  const hasDesmosApiKey = Boolean(import.meta.env.VITE_DESMOS_API_KEY);

  return ordered.flatMap((moduleId) => {
    if (seen.has(moduleId) || !workspaceModuleRegistry[moduleId]) {
      return [];
    }
    seen.add(moduleId);

    const copy = toolPreviewCopy[moduleId];
    if (!copy) {
      return [];
    }

    if (copy.stability === "beta" && !betaFeaturesEnabled) {
      return [];
    }

    if (moduleId === "flashcards" && !recallLabEnabled) {
      return [];
    }

    const desmosUnavailable =
      !hasDesmosApiKey && (moduleId === "desmos-graph" || moduleId.startsWith("chem-desmos-"));

    return [
      {
        ...copy,
        moduleId,
        unavailableMessage: desmosUnavailable
          ? "Desmos key is not available here, so BinderNotes will show the compact fallback instead of a broken graph."
          : undefined,
      },
    ];
  });
}

function buildStudyPanelTabs(
  context: WorkspaceModuleContext,
  preferences: WorkspacePreferences,
  betaFeaturesEnabled: boolean,
): StudyPanelTab[] {
  const subject = `${context.binder.subject ?? ""} ${preferences.preset}`.toLowerCase();
  const isChemistry =
    subject.includes("chem") || preferences.enabledModules.some((moduleId) => moduleId.startsWith("chem-"));
  const isMath =
    !isChemistry &&
    (subject.includes("math") ||
      subject.includes("algebra") ||
      subject.includes("calculus") ||
      preferences.enabledModules.some((moduleId) =>
        ["desmos-graph", "formula-sheet", "math-blocks", "scientific-calculator", "saved-graphs"].includes(moduleId),
      ));
  const isHistory = context.history.enabled || subject.includes("history");
  const tabs: StudyPanelTab[] = [
    { id: "lesson", label: "Lesson", helper: "Read", moduleId: "lesson" },
    { id: "notes", label: "Notes", helper: "Write", moduleId: "private-notes" },
  ];

  if (isChemistry) {
    tabs.push(...getChemistryStudyPanelTabs(preferences.preset, betaFeaturesEnabled));
  }

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

function getChemistryStudyPanelTabs(presetId: WorkspacePresetId, betaFeaturesEnabled: boolean): StudyPanelTab[] {
  const tabSets: Partial<Record<WorkspacePresetId, StudyPanelTab[]>> = {
    "chem-guided-study": [
      ...(betaFeaturesEnabled
        ? [{ id: "guide", label: "Guide", helper: "Coach", moduleId: "chem-lab-coach" } as StudyPanelTab]
        : []),
      { id: "concepts", label: "Concepts", helper: "Review", moduleId: "chem-concept-cards" },
      { id: "quick-chem", label: "Quick", helper: "Tools", moduleId: "chem-quick-tools" },
    ],
    "chem-element-explorer": [
      { id: "table", label: "Table", helper: "Elements", moduleId: "chem-periodic-table" },
      { id: "element", label: "Element", helper: "Build", moduleId: "chem-element-builder" },
      { id: "trends", label: "Trends", helper: "Graph", moduleId: "chem-periodic-trends-graph" },
      { id: "orbitals", label: "Orbitals", helper: "Config", moduleId: "chem-electron-config-builder" },
    ],
    "chem-bonding-studio": [
      { id: "builder", label: "Builder", helper: "Lewis", moduleId: "chem-molecule-builder" },
      { id: "geometry", label: "Geometry", helper: "VSEPR", moduleId: "chem-geometry-viewer" },
    ],
    "chem-reaction-studio": [
      { id: "reaction", label: "Reaction", helper: "Particles", moduleId: "chem-tri-reaction-view" },
      { id: "balance", label: "Balance", helper: "Equation", moduleId: "chem-reaction-balancer" },
    ],
    "chem-stoichiometry-lab": [
      { id: "ladder", label: "Ladder", helper: "Moles", moduleId: "chem-stoichiometry-coach" },
      { id: "mass", label: "Mass", helper: "Formula", moduleId: "chem-molar-mass-calculator" },
    ],
    "chem-solutions-molarity-lab": [
      { id: "solution", label: "Lab", helper: "Mixer", moduleId: "chem-solution-mixer" },
      { id: "molarity", label: "Molarity", helper: "Calc", moduleId: "chem-molarity-calculator" },
      { id: "concentration", label: "Graph", helper: "Desmos", moduleId: "chem-desmos-concentration-graph" },
      { id: "notebook", label: "Notebook", helper: "Lab", moduleId: "chem-lab-notebook" },
    ],
    "chem-acid-base-titration-lab": [
      { id: "lab", label: "Lab", helper: "Titrate", moduleId: "chem-titration-lab" },
      { id: "curve", label: "Curve", helper: "Graph", moduleId: "chem-desmos-titration-curve" },
      { id: "ph", label: "pH", helper: "Calc", moduleId: "chem-ph-calculator" },
      { id: "notebook", label: "Notebook", helper: "Lab", moduleId: "chem-lab-notebook" },
    ],
    "chem-kinetics-graph-lab": [
      { id: "sim", label: "Sim", helper: "Rate", moduleId: "chem-kinetics-simulator" },
      { id: "kinetics-graph", label: "Graph", helper: "Plot", moduleId: "chem-desmos-kinetics-plot" },
      { id: "data", label: "Data", helper: "Table", moduleId: "chem-data-table" },
    ],
    "chem-thermochemistry-studio": [
      { id: "calorimetry", label: "Lab", helper: "Heat", moduleId: "chem-calorimetry-lab" },
      { id: "energy", label: "Energy", helper: "Diagram", moduleId: "chem-energy-diagram" },
      { id: "calc", label: "Calc", helper: "q=mc dT", moduleId: "chem-calculation-sheet" },
      { id: "notebook", label: "Notebook", helper: "Lab", moduleId: "chem-lab-notebook" },
    ],
    "chem-full-studio": [
      { id: "table", label: "Table", helper: "Elements", moduleId: "chem-periodic-table" },
      { id: "reaction", label: "Reaction", helper: "Balance", moduleId: "chem-reaction-balancer" },
      { id: "curve", label: "Curve", helper: "Graph", moduleId: "chem-desmos-titration-curve" },
      { id: "notebook", label: "Notebook", helper: "Lab", moduleId: "chem-lab-notebook" },
    ],
    "chemistry-lab": [
      { id: "lab", label: "Lab", helper: "Titrate", moduleId: "chem-titration-lab" },
      { id: "notebook", label: "Notebook", helper: "Lab", moduleId: "chem-lab-notebook" },
      { id: "ladder", label: "Ladder", helper: "Moles", moduleId: "chem-stoichiometry-coach" },
      { id: "reference", label: "Safety", helper: "Reference", moduleId: "chem-reference-safety" },
    ],
  };

  return tabSets[presetId] ?? [
    ...(betaFeaturesEnabled
      ? [{ id: "guide", label: "Guide", helper: "Coach", moduleId: "chem-lab-coach" } as StudyPanelTab]
      : []),
    { id: "table", label: "Table", helper: "Elements", moduleId: "chem-periodic-table" },
    { id: "lab", label: "Lab", helper: "Experiment", moduleId: "chem-titration-lab" },
    { id: "quick-chem", label: "Quick", helper: "Tools", moduleId: "chem-quick-tools" },
  ];
}

function chooseStudyPanelsV2SecondaryModule(
  primaryModuleId: WorkspaceModuleId,
  context: WorkspaceModuleContext,
  preferences: WorkspacePreferences,
): WorkspaceModuleId | null {
  if (primaryModuleId === "lesson") {
    return workspaceModuleRegistry["private-notes"] ? "private-notes" : null;
  }

  if (primaryModuleId === "private-notes") {
    return workspaceModuleRegistry.lesson ? "lesson" : null;
  }

  if (primaryModuleId === "desmos-graph") {
    return workspaceModuleRegistry["formula-sheet"] ? "formula-sheet" : null;
  }

  if (primaryModuleId === "formula-sheet") {
    return workspaceModuleRegistry["private-notes"] ? "private-notes" : null;
  }

  if (primaryModuleId === "whiteboard") {
    return workspaceModuleRegistry["private-notes"] ? "private-notes" : null;
  }

  if (primaryModuleId === "recent-highlights" || primaryModuleId === "comments") {
    return null;
  }

  if (primaryModuleId.startsWith("history-")) {
    const byHistoryPrimary: Partial<Record<WorkspaceModuleId, WorkspaceModuleId[]>> = {
      "history-timeline": ["lesson", "private-notes"],
      "history-evidence": ["lesson", "private-notes"],
      "history-argument": ["history-evidence", "lesson"],
      "history-myth-checks": ["lesson", "private-notes"],
    };
    const candidates = byHistoryPrimary[primaryModuleId] ?? ["lesson", "private-notes"];
    return candidates.find((moduleId) => moduleId !== primaryModuleId && workspaceModuleRegistry[moduleId]) ?? null;
  }

  if (primaryModuleId.startsWith("chem-")) {
    return getChemistrySecondaryCandidates(primaryModuleId).find(
      (moduleId) => moduleId !== primaryModuleId && workspaceModuleRegistry[moduleId],
    ) ?? null;
  }

  return chooseSecondaryModule(primaryModuleId, context, preferences);
}

function chooseSecondaryModule(
  primaryModuleId: WorkspaceModuleId,
  context: WorkspaceModuleContext,
  preferences: WorkspacePreferences,
): WorkspaceModuleId | null {
  if (primaryModuleId.startsWith("chem-")) {
    const chemistrySecondary = getChemistrySecondaryCandidates(primaryModuleId).find(
      (moduleId) => moduleId !== primaryModuleId && workspaceModuleRegistry[moduleId],
    );

    if (chemistrySecondary) {
      return chemistrySecondary;
    }
  }

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

function getChemistrySecondaryCandidates(primaryModuleId: WorkspaceModuleId): WorkspaceModuleId[] {
  const byPrimary: Partial<Record<WorkspaceModuleId, WorkspaceModuleId[]>> = {
    "chem-lab-coach": ["chem-titration-lab", "chem-lab-notebook", "chem-reference-safety"],
    "chem-concept-cards": ["private-notes", "lesson", "chem-quick-tools"],
    "chem-quick-tools": ["lesson", "private-notes", "chem-concept-cards"],
    "chem-periodic-table": ["chem-element-builder", "chem-periodic-trends-graph", "lesson"],
    "chem-element-builder": ["chem-periodic-table", "chem-periodic-trends-graph", "lesson"],
    "chem-electron-config-builder": ["chem-periodic-table", "chem-element-builder", "lesson"],
    "chem-periodic-trends-graph": ["chem-periodic-table", "chem-element-builder", "lesson"],
    "chem-molecule-builder": ["chem-geometry-viewer", "lesson", "private-notes"],
    "chem-geometry-viewer": ["chem-molecule-builder", "lesson", "private-notes"],
    "chem-reaction-balancer": ["chem-tri-reaction-view", "lesson", "private-notes"],
    "chem-tri-reaction-view": ["chem-reaction-balancer", "lesson", "private-notes"],
    "chem-stoichiometry-coach": ["chem-molar-mass-calculator", "lesson", "private-notes"],
    "chem-molar-mass-calculator": ["chem-stoichiometry-coach", "lesson", "private-notes"],
    "chem-solution-mixer": ["chem-molarity-calculator", "chem-desmos-concentration-graph", "chem-lab-notebook"],
    "chem-molarity-calculator": ["chem-solution-mixer", "chem-desmos-concentration-graph", "chem-lab-notebook"],
    "chem-desmos-concentration-graph": ["chem-solution-mixer", "chem-lab-notebook", "lesson"],
    "chem-ph-calculator": ["chem-titration-lab", "chem-desmos-titration-curve", "chem-lab-notebook"],
    "chem-titration-lab": ["chem-desmos-titration-curve", "chem-ph-calculator", "chem-lab-notebook"],
    "chem-desmos-titration-curve": ["chem-titration-lab", "chem-ph-calculator", "chem-lab-notebook"],
    "chem-kinetics-simulator": ["chem-desmos-kinetics-plot", "chem-data-table", "lesson"],
    "chem-desmos-kinetics-plot": ["chem-kinetics-simulator", "chem-data-table", "lesson"],
    "chem-data-table": ["chem-kinetics-simulator", "chem-desmos-kinetics-plot", "lesson"],
    "chem-calorimetry-lab": ["chem-energy-diagram", "chem-calculation-sheet", "chem-lab-notebook"],
    "chem-energy-diagram": ["chem-calorimetry-lab", "chem-calculation-sheet", "chem-lab-notebook"],
    "chem-calculation-sheet": ["chem-calorimetry-lab", "chem-energy-diagram", "chem-lab-notebook"],
    "chem-safety-cards": ["chem-reference-safety", "lesson", "chem-lab-notebook"],
    "chem-review-queue": ["lesson", "private-notes", "chem-quick-tools"],
    "chem-lab-notebook": ["chem-titration-lab", "chem-safety-cards", "lesson"],
    "chem-reference-safety": ["chem-safety-cards", "lesson", "chem-lab-notebook"],
  };

  return byPrimary[primaryModuleId] ?? ["lesson", "private-notes"];
}

function getToolModules(
  preferences: WorkspacePreferences,
  primaryModuleId: WorkspaceModuleId,
  secondaryModuleId: WorkspaceModuleId | null,
  context: WorkspaceModuleContext,
) {
  const design = getFaceliftWorkspacePresetDesign(preferences.preset);
  const isChemistry =
    preferences.preset.startsWith("chem-") ||
    preferences.preset === "chemistry-lab" ||
    context.binder.subject?.toLowerCase().includes("chem") ||
    preferences.enabledModules.some((moduleId) => moduleId.startsWith("chem-"));
  const ordered = [
    ...design.collapsedModules,
    ...design.optionalModules,
    ...(isChemistry ? chemistryDefaultTools : []),
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
