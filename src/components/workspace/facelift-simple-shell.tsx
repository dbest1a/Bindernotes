import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FunctionSquare,
  Layers3,
  type LucideIcon,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  NotebookPen,
  PanelLeft,
  Save,
  Settings2,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  workspaceModuleRegistry,
  type WorkspaceModuleContext,
} from "@/components/workspace/workspace-modules";
import { WorkspaceModeSwitcher } from "@/components/workspace/workspace-mode-switcher";
import {
  getVisibleWorkspacePresets,
  workspacePresets,
} from "@/lib/workspace-preferences";
import {
  getFaceliftWorkspacePresetDesign,
  getWorkspaceMobileModuleTabs,
  selectFaceliftSurfaceModules,
} from "@/lib/workspace-preset-designs";
import { getPrimaryFolder } from "@/lib/workspace-structure";
import { cn } from "@/lib/utils";
import type {
  FaceliftDensity,
  WorkspaceModuleId,
  WorkspacePreferences,
  WorkspacePresetId,
  WorkspaceViewMode,
} from "@/types";

type FaceliftSimpleShellProps = {
  context: WorkspaceModuleContext;
  preferences: WorkspacePreferences;
  focusModeActive?: boolean;
  onChange: (preferences: WorkspacePreferences) => void;
  onChangeWorkspaceViewMode?: (mode: WorkspaceViewMode) => void;
  onChangeView?: () => void;
  onCreateSticky?: () => void;
  onOpenSettings: () => void;
  onToggleFocus?: () => void;
  isCompact?: boolean;
  workspaceViewMode?: WorkspaceViewMode;
};

type OpenConsumerPanel = "study" | "tools" | "view" | "map" | "recent" | null;
type WorkspacePresetOption = (typeof workspacePresets)[number];
type StudyShortcutLabel = "Read" | "Notes" | "Graph" | "Board" | "Timeline" | "Evidence" | "Argument";

const densityLabels: Record<FaceliftDensity, string> = {
  comfortable: "Comfortable",
  compact: "Compact",
  focus: "Focus",
};

const nextBestStepByPreset: Record<WorkspacePresetId, string> = {
  "focused-reading": "Read one section, mark the sentence that explains the main idea, then keep moving.",
  "split-study": "Read the next paragraph, then rewrite it once in your own words.",
  "notes-focus": "Turn the lesson into a clean explanation you could study tomorrow.",
  "annotation-mode": "Pick a source sentence, mark why it matters, then leave a quick note.",
  "math-study": "Compare the lesson, formula, and graph until the relationship clicks.",
  "math-simple-presentation": "Follow the example first; open graphing only when the formula needs a visual.",
  "math-guided-study": "Follow the explanation, check the math block, then write the reason in notes.",
  "math-graph-lab": "Change one graph idea, watch what moves, then write the pattern you notice.",
  "math-proof-concept": "Name the rule, explain why it works, then test it against one example.",
  "math-practice-mode": "Solve one problem, check the formula, then write the step that made it work.",
  "full-math-canvas": "Use the big work surface first; open extra tools only when they answer a question.",
  "chem-guided-study": "Read the chemistry idea, use one concept card, then write the rule in your own words.",
  "chem-element-explorer": "Pick an element, inspect the trend, then build the matching atom or ion.",
  "chem-bonding-studio": "Build the Lewis structure, then check geometry and formal charge.",
  "chem-reaction-studio": "Balance the equation, then explain it in particle and observation views.",
  "chem-stoichiometry-lab": "Complete the mole bridge and check that every unit cancels.",
  "chem-solutions-molarity-lab": "Calculate the dilution, then record the setup and safety note.",
  "chem-acid-base-titration-lab": "Add titrant carefully, then record the pH evidence near the endpoint.",
  "chem-kinetics-graph-lab": "Change one rate variable, then explain the graph shape.",
  "chem-thermochemistry-studio": "Calculate q, then classify the heat flow from the data.",
  "chem-full-studio": "Start from the challenge card and open only the chemistry tools you need.",
  "history-guided": "Read the source, place it in time, then save the evidence that proves the point.",
  "history-timeline-focus": "Find the next event, explain what changed, then connect it back to the source.",
  "history-source-evidence": "Collect one strong source detail, then explain what it proves.",
  "history-argument-builder": "Write the claim first, then attach the evidence that actually supports it.",
  "history-full-studio": "Move from timeline to source to evidence, then shape the argument.",
  "chemistry-lab": "Run the lab, record the measurements that matter, then write the conclusion from the data.",
};

const modeSummaryByPreset: Record<WorkspacePresetId, string> = {
  "focused-reading": "Read with the source front and center.",
  "split-study": "Source and notes side by side.",
  "notes-focus": "Write first with the lesson nearby.",
  "annotation-mode": "Mark up the source and capture notes.",
  "math-study": "Lesson, formulas, graph, and notes.",
  "math-simple-presentation": "A clean guided math walkthrough.",
  "math-guided-study": "Lesson, formula, graph, then notes.",
  "math-graph-lab": "Graph first with formulas close by.",
  "math-proof-concept": "Reason through rules and examples.",
  "math-practice-mode": "Practice problems with formulas close by.",
  "full-math-canvas": "Full math workspace without crowding.",
  "chem-guided-study": "Lesson, notes, concepts, and quick tools.",
  "chem-element-explorer": "Periodic table, atom builder, and trends.",
  "chem-bonding-studio": "Lewis structures, geometry, and notes.",
  "chem-reaction-studio": "Balance, particles, observations, notes.",
  "chem-stoichiometry-lab": "Mole bridge, mass, source, notes.",
  "chem-solutions-molarity-lab": "Solution bench, graph, notebook.",
  "chem-acid-base-titration-lab": "Titration bench, curve, pH, notebook.",
  "chem-kinetics-graph-lab": "Rate simulator, graph, data.",
  "chem-thermochemistry-studio": "Calorimetry, energy, calculation, notebook.",
  "chem-full-studio": "Full chemistry workspace, organized.",
  "history-guided": "Source, timeline, evidence, notes.",
  "history-timeline-focus": "Timeline first, source beside it.",
  "history-source-evidence": "Close-read and collect proof.",
  "history-argument-builder": "Build the claim from evidence.",
  "history-full-studio": "Full history workspace, organized.",
  "chemistry-lab": "Lab, notebook, stoichiometry, and safety.",
};

const shortcutDetails: Record<StudyShortcutLabel, { hint: string; Icon: LucideIcon }> = {
  Read: { hint: "Source", Icon: BookOpen },
  Notes: { hint: "Write", Icon: NotebookPen },
  Graph: { hint: "Visual", Icon: FunctionSquare },
  Board: { hint: "Work", Icon: PanelLeft },
  Timeline: { hint: "Sequence", Icon: MapIcon },
  Evidence: { hint: "Proof", Icon: Layers3 },
  Argument: { hint: "Claim", Icon: NotebookPen },
};

const presetGroups: Array<{ label: string; presetIds: WorkspacePresetId[] }> = [
  {
    label: "Start simple",
    presetIds: ["focused-reading", "notes-focus", "split-study"],
  },
  {
    label: "Math",
    presetIds: [
      "math-guided-study",
      "math-study",
      "math-graph-lab",
      "math-proof-concept",
      "math-practice-mode",
      "math-simple-presentation",
    ],
  },
  {
    label: "Chemistry",
    presetIds: [
      "chem-guided-study",
      "chem-element-explorer",
      "chem-bonding-studio",
      "chem-reaction-studio",
      "chem-stoichiometry-lab",
      "chem-acid-base-titration-lab",
    ],
  },
  {
    label: "History",
    presetIds: [
      "history-guided",
      "history-timeline-focus",
      "history-source-evidence",
      "history-argument-builder",
    ],
  },
  {
    label: "More power",
    presetIds: ["annotation-mode", "full-math-canvas", "chem-full-studio", "history-full-studio"],
  },
];

function isWorkspacePresetOption(
  candidate: WorkspacePresetOption | undefined,
): candidate is WorkspacePresetOption {
  return Boolean(candidate);
}

export function FaceliftSimpleShell({
  context,
  focusModeActive = false,
  isCompact = false,
  onChange,
  onChangeWorkspaceViewMode,
  onChangeView,
  onCreateSticky,
  onOpenSettings,
  onToggleFocus,
  preferences,
  workspaceViewMode = "facelift",
}: FaceliftSimpleShellProps) {
  const [openPanel, setOpenPanel] = useState<OpenConsumerPanel>(null);
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
  const visibleModules = selectFaceliftSurfaceModules(preferences.preset, {
    density: preferences.facelift.density,
    enabledModules: preferences.enabledModules,
  });
  const visibleModuleSet = new Set(visibleModules);
  const visibleModuleKey = visibleModules.join("|");
  const isGraphLabTwoPane =
    preferences.preset === "math-graph-lab" &&
    visibleModules.length === 2 &&
    visibleModuleSet.has("desmos-graph") &&
    visibleModuleSet.has("formula-sheet");
  const collapsedModules = Array.from(new Set(design.collapsedModules)).filter(
    (moduleId) => workspaceModuleRegistry[moduleId] && !visibleModuleSet.has(moduleId),
  );
  const visiblePresets = getVisibleWorkspacePresets(preferences, {
    binderSubject: context.binder.subject,
    historyEnabled: context.history.enabled,
    includeAdvanced: preferences.facelift.expandedControls,
  });
  const visiblePresetById = useMemo(
    () => new Map(visiblePresets.map((candidate) => [candidate.id, candidate])),
    [visiblePresets],
  );
  const quickPresetShortcuts = useMemo(() => {
    const graphPresetId: WorkspacePresetId = visiblePresetById.has("math-graph-lab")
      ? "math-graph-lab"
      : "math-study";
    const candidates: Array<{ label: StudyShortcutLabel; presetId: WorkspacePresetId }> = [
      { label: "Read", presetId: "focused-reading" as WorkspacePresetId },
      { label: "Notes", presetId: "notes-focus" as WorkspacePresetId },
      ...(visiblePresetById.has("math-practice-mode")
        ? [{ label: "Board" as StudyShortcutLabel, presetId: "math-practice-mode" as WorkspacePresetId }]
        : []),
      ...(visiblePresetById.has(graphPresetId)
        ? [{ label: "Graph" as StudyShortcutLabel, presetId: graphPresetId }]
        : []),
      ...(visiblePresetById.has("history-timeline-focus")
        ? [{ label: "Timeline" as StudyShortcutLabel, presetId: "history-timeline-focus" as WorkspacePresetId }]
        : []),
      ...(visiblePresetById.has("history-source-evidence")
        ? [{ label: "Evidence" as StudyShortcutLabel, presetId: "history-source-evidence" as WorkspacePresetId }]
        : []),
      ...(visiblePresetById.has("history-argument-builder")
        ? [{ label: "Argument" as StudyShortcutLabel, presetId: "history-argument-builder" as WorkspacePresetId }]
        : []),
    ];
    const unique = new Map<WorkspacePresetId, { label: StudyShortcutLabel; presetId: WorkspacePresetId }>();
    candidates.forEach((shortcut) => {
      if (visiblePresetById.has(shortcut.presetId) && !unique.has(shortcut.presetId)) {
        unique.set(shortcut.presetId, shortcut);
      }
    });

    return Array.from(unique.values()).slice(0, 4);
  }, [visiblePresetById]);
  const groupedVisiblePresets = useMemo(
    () =>
      presetGroups
        .map((group) => ({
          label: group.label,
          presets: group.presetIds
            .map((presetId) => visiblePresetById.get(presetId))
            .filter(isWorkspacePresetOption),
        }))
        .filter((group) => group.presets.length > 0),
    [visiblePresetById],
  );
  const selectedOrder = context.selectedLesson.order_index ?? 0;
  const nextLesson = context.lessons.find((lesson) => (lesson.order_index ?? 0) > selectedOrder);
  const primaryModuleTitle = workspaceModuleRegistry[design.primaryModule]?.title ?? "Study surface";
  const nextBestStep = nextBestStepByPreset[preferences.preset] ?? design.purpose;
  const modeSummary = modeSummaryByPreset[preferences.preset] ?? design.purpose;
  const visiblePanelCountLabel = `${visibleModules.length} panel${visibleModules.length === 1 ? "" : "s"} live`;
  const studentCommand = design.studentCommand;
  const mobileTabs = useMemo(
    () => {
      const mobileVisibleModules = new Set(visibleModules);
      return getWorkspaceMobileModuleTabs(
        preferences.preset,
        preferences.enabledModules.filter((moduleId) => Boolean(workspaceModuleRegistry[moduleId])),
      ).filter((tab) => mobileVisibleModules.has(tab.moduleId));
    },
    [preferences.enabledModules, preferences.preset, visibleModuleKey],
  );
  const [activeMobileModuleId, setActiveMobileModuleId] = useState<WorkspaceModuleId | null>(null);
  const firstVisibleModuleId = visibleModules[0] ?? null;
  const mobileActiveModuleId = mobileTabs.some((tab) => tab.moduleId === activeMobileModuleId)
    ? activeMobileModuleId
    : mobileTabs[0]?.moduleId ?? firstVisibleModuleId;
  const renderedModules =
    isCompact && mobileActiveModuleId
      ? visibleModules.filter((moduleId) => moduleId === mobileActiveModuleId)
      : visibleModules;

  useEffect(() => {
    setActiveMobileModuleId((current) =>
      current && mobileTabs.some((tab) => tab.moduleId === current)
        ? current
        : mobileTabs[0]?.moduleId ?? firstVisibleModuleId,
    );
  }, [firstVisibleModuleId, mobileTabs]);

  const togglePanel = (panel: Exclude<OpenConsumerPanel, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const updateDensity = (density: FaceliftDensity) => {
    onChange({
      ...preferences,
      facelift: {
        ...preferences.facelift,
        density,
      },
    });
  };

  return (
    <section
      className={cn(
        "facelift-simple-shell",
        preferences.facelift.navigationMode === "sidebar" && "facelift-simple-shell--with-sidebar",
        preferences.facelift.moduleChrome === "minimal" && "facelift-simple-shell--minimal-chrome",
      )}
      data-facelift-density={preferences.facelift.density}
      data-facelift-module-chrome={preferences.facelift.moduleChrome}
      data-facelift-mobile-active={mobileActiveModuleId ?? undefined}
      data-facelift-navigation={preferences.facelift.navigationMode}
      data-facelift-surface="simple"
      data-testid="facelift-simple-shell"
      data-workspace-presentation="facelift"
    >
      <header className="facelift-simple-shell__top">
        <div className="facelift-simple-shell__identity">
          <div className="facelift-simple-shell__overline">
            <Badge variant="secondary">Study workspace</Badge>
            <span>{densityLabels[preferences.facelift.density]} view</span>
            <span>{visiblePanelCountLabel}</span>
          </div>
          <div className="facelift-simple-shell__path" aria-label="Workspace hierarchy">
            <Link to="/dashboard">Workspace</Link>
            {folder ? (
              <>
                <ChevronRight aria-hidden="true" className="size-4" />
                <Link to={`/folders/${folder.id}`}>{folder.name}</Link>
              </>
            ) : null}
            <ChevronRight aria-hidden="true" className="size-4" />
            <Link to={`/binders/${context.binder.id}`}>{context.binder.title}</Link>
            <ChevronRight aria-hidden="true" className="size-4" />
            <span>{context.selectedLesson.title}</span>
          </div>
          <div>
            <h1>{context.selectedLesson.title}</h1>
            <p className="facelift-simple-shell__subtitle">
              {context.binder.subject || "Study"} - {preset?.name ?? "Split Study"} -{" "}
              {primaryModuleTitle}
            </p>
          </div>
          <div className="facelift-next-step">
            <Sparkles className="size-4" />
            <span>Next best step</span>
            <strong>{nextBestStep}</strong>
          </div>
        </div>

        <div className="facelift-consumer-mode" data-testid="facelift-study-command-bar">
          <button
            aria-expanded={openPanel === "study"}
            aria-label={`Study mode ${preset?.name ?? "Split Study"}`}
            className="facelift-consumer-mode__button"
            onClick={() => togglePanel("study")}
            type="button"
          >
            <Sparkles className="facelift-consumer-mode__mark" />
            <span className="facelift-consumer-mode__copy">
              <span>Study mode</span>
              <strong>{preset?.name ?? "Split Study"}</strong>
              <small>{modeSummary}</small>
            </span>
            <span className="facelift-consumer-mode__chevron" aria-hidden="true">
              <ChevronDown className="size-4" />
            </span>
          </button>
          <div className="facelift-consumer-shortcuts" aria-label="Quick study switches">
            {quickPresetShortcuts.map((shortcut) => {
              const shortcutDetail = shortcutDetails[shortcut.label as StudyShortcutLabel];
              const ShortcutIcon = shortcutDetail.Icon;

              return (
                <button
                  aria-label={shortcut.label}
                  className={cn(
                    "facelift-consumer-shortcut",
                    preferences.preset === shortcut.presetId && "facelift-consumer-shortcut--active",
                  )}
                  key={shortcut.presetId}
                  onClick={() => context.onApplyPreset(shortcut.presetId)}
                  type="button"
                >
                  <ShortcutIcon className="size-4" />
                  <span>{shortcut.label}</span>
                  <small>{shortcutDetail.hint}</small>
                </button>
              );
            })}
          </div>
          {openPanel === "study" ? (
            <div className="facelift-menu facelift-menu--study" role="menu" aria-label="Study mode choices">
              {groupedVisiblePresets.map((group) => (
                <div className="facelift-menu__group" key={group.label}>
                  <span>{group.label}</span>
                  <div>
                    {group.presets.map((candidate) => (
                      <button
                        className={cn(
                          "facelift-menu-item",
                          candidate.id === preferences.preset && "facelift-menu-item--active",
                        )}
                        key={candidate.id}
                        onClick={() => {
                          context.onApplyPreset(candidate.id);
                          setOpenPanel(null);
                        }}
                        type="button"
                      >
                        {candidate.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="facelift-simple-shell__actions">
          <div className="facelift-quiet-status" aria-label="Saved status">
            <CheckCircle2 className="size-4" />
            <span>{context.noteSaveLabel ?? "Saved status"}</span>
          </div>
          {onToggleFocus ? (
            <Button className="facelift-primary-action" onClick={onToggleFocus} size="sm" type="button" variant="outline">
              {focusModeActive ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              {focusModeActive ? "Exit focus" : "Enter focus"}
            </Button>
          ) : null}
          <div className="facelift-disclosure">
            <Button
              aria-expanded={openPanel === "view"}
              onClick={() => togglePanel("view")}
              size="sm"
              type="button"
              variant="outline"
            >
              <Eye className="size-4" />
              View
            </Button>
            {openPanel === "view" ? (
              <div className="facelift-menu" role="menu" aria-label="View controls">
                <div className="facelift-density-switch" aria-label="Facelift density">
                  {(["comfortable", "compact", "focus"] as FaceliftDensity[]).map((density) => (
                    <button
                      className={cn(
                        "facelift-density-switch__button",
                        preferences.facelift.density === density && "facelift-density-switch__button--active",
                      )}
                      key={density}
                      onClick={() => updateDensity(density)}
                      type="button"
                    >
                      {densityLabels[density]}
                    </button>
                  ))}
                </div>
                {onChangeWorkspaceViewMode ? (
                  <WorkspaceModeSwitcher
                    currentMode={workspaceViewMode}
                    onChangeMode={onChangeWorkspaceViewMode}
                  />
                ) : null}
                {onChangeView ? (
                  <button className="facelift-menu-item" onClick={onChangeView} type="button">
                    <PanelLeft className="size-4" />
                    Change view
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="facelift-disclosure">
            <Button
              aria-expanded={openPanel === "tools"}
              onClick={() => togglePanel("tools")}
              size="sm"
              type="button"
              variant="outline"
            >
              <Layers3 className="size-4" />
              Tools
            </Button>
            {openPanel === "tools" ? (
              <div className="facelift-menu" role="menu" aria-label="Study tools">
                <button className="facelift-menu-item" onClick={context.onSaveNoteNow} type="button">
                  <Save className="size-4" />
                  Save now
                </button>
                <button className="facelift-menu-item" onClick={context.onEnterNotebookFocus} type="button">
                  <NotebookPen className="size-4" />
                  Notebook focus
                </button>
                {onCreateSticky ? (
                  <button className="facelift-menu-item" onClick={onCreateSticky} type="button">
                    <StickyNote className="size-4" />
                    New sticky
                  </button>
                ) : null}
                <Link className="facelift-menu-item" to={`/binders/${context.binder.id}`}>
                  <BookOpen className="size-4" />
                  Open binder
                </Link>
              </div>
            ) : null}
          </div>
          <Button onClick={onOpenSettings} size="sm" type="button" variant="default">
            <Settings2 className="size-4" />
            Settings
          </Button>
        </div>
        <div className="facelift-context-ribbon" aria-label="Current workspace context">
          <span>
            <strong>Primary</strong>
            {primaryModuleTitle}
          </span>
          <span>
            <strong>Mode</strong>
            {preset?.name ?? "Split Study"}
          </span>
          <span>
            <strong>Visible</strong>
            {visiblePanelCountLabel}
          </span>
        </div>
      </header>

      <div className="facelift-simple-shell__body">
        <section className="facelift-next-board" data-testid="facelift-next-board" aria-label="What to do next">
          <div>
            <span>{studentCommand.label}</span>
            <strong>{studentCommand.primaryAction}</strong>
            <p>{studentCommand.followUpAction}</p>
          </div>
          <div className="facelift-next-board__actions">
            {nextLesson ? (
              <button onClick={() => context.onSelectLesson(nextLesson)} type="button">
                <ChevronRight className="size-4" />
                Next document
              </button>
            ) : null}
            <button onClick={() => context.onApplyPreset(preferences.preset)} type="button">
              <Sparkles className="size-4" />
              Keep studying
            </button>
          </div>
        </section>

        <section className="facelift-guide-row" aria-label="Study guide">
          <button
            aria-expanded={openPanel === "map"}
            className="facelift-guide-card"
            onClick={() => togglePanel("map")}
            type="button"
          >
            <MapIcon className="size-4" />
            <span>Where am I?</span>
            <strong>
              {folder?.name ?? "Workspace"} / {context.binder.title}
            </strong>
          </button>
          {nextLesson ? (
            <button
              className="facelift-guide-card facelift-guide-card--next"
              onClick={() => context.onSelectLesson(nextLesson)}
              type="button"
            >
              <ChevronRight className="size-4" />
              <span>Next up</span>
              <strong>{nextLesson.title}</strong>
            </button>
          ) : (
            <div className="facelift-guide-card" aria-label="Current document">
              <BookOpen className="size-4" />
              <span>Current document</span>
              <strong>{context.selectedLesson.title}</strong>
            </div>
          )}
          <button
            aria-expanded={openPanel === "recent"}
            className="facelift-guide-card"
            onClick={() => togglePanel("recent")}
            type="button"
          >
            <PanelLeft className="size-4" />
            <span>Next / Recent</span>
            <strong>{context.lessons.length} documents in this binder</strong>
          </button>
        </section>

        {openPanel === "map" ? (
          <section className="facelift-guide-panel" aria-label="Workspace map">
            <ol>
              <li>
                <span>Workspace</span>
                <strong>Dashboard</strong>
              </li>
              <li>
                <span>Folder</span>
                <strong>{folder?.name ?? "Unfiled"}</strong>
              </li>
              <li>
                <span>Binder</span>
                <strong>{context.binder.title}</strong>
              </li>
              <li>
                <span>Document</span>
                <strong>{context.selectedLesson.title}</strong>
              </li>
            </ol>
          </section>
        ) : null}

        {openPanel === "recent" ? (
          <section className="facelift-guide-panel facelift-guide-panel--recent" aria-label="Recent in binder">
            {context.lessons.slice(0, 6).map((lesson, index) => (
              <button
                className={cn(
                  "facelift-lesson-link",
                  lesson.id === context.selectedLesson.id && "facelift-lesson-link--active",
                )}
                key={lesson.id}
                onClick={() => context.onSelectLesson(lesson)}
                type="button"
              >
                <span>{(lesson.order_index ?? index) + 1}</span>
                <strong>{lesson.title}</strong>
              </button>
            ))}
          </section>
        ) : null}

        <main
          className={cn(
            "facelift-simple-shell__main",
            `facelift-simple-shell__main--${preferences.preset}`,
          )}
          data-facelift-preset={preferences.preset}
        >
          {isCompact && mobileTabs.length > 1 ? (
            <nav className="facelift-mobile-switcher" aria-label="Mobile study modules">
              {mobileTabs.map((tab) => (
                <button
                  aria-current={mobileActiveModuleId === tab.moduleId ? "page" : undefined}
                  key={tab.moduleId}
                  onClick={() => setActiveMobileModuleId(tab.moduleId)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          ) : null}
          <section
            className="facelift-module-grid"
            data-facelift-graph-lab-layout={isGraphLabTwoPane ? "two-pane" : undefined}
            data-facelift-module-count={renderedModules.length}
            data-testid="facelift-module-grid"
          >
            {renderedModules.map((moduleId) => (
              <article
                className={cn(
                  "facelift-module-cell",
                  moduleId === design.primaryModule && "facelift-module-cell--primary",
                )}
                data-facelift-module={moduleId}
                key={moduleId}
              >
                {workspaceModuleRegistry[moduleId].render(
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
            ))}
          </section>

          {collapsedModules.length > 0 ? (
            <section className="facelift-collapsed-modules" aria-label="Collapsed modules">
              <div className="facelift-collapsed-modules__label">
                <PanelLeft className="size-4" />
                <span>Extra tools</span>
              </div>
              <div>
                {collapsedModules.slice(0, 7).map((moduleId) => (
                  <button
                    className="facelift-collapsed-chip"
                    key={moduleId}
                    onClick={() => context.onApplyPreset(preferences.preset)}
                    type="button"
                  >
                    <Layers3 className="size-3.5" />
                    {workspaceModuleRegistry[moduleId].title}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </section>
  );
}
