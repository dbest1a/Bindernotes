import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Home,
  Maximize2,
  Minimize2,
  LayoutPanelLeft,
  Lock,
  RotateCcw,
  Save,
  SlidersHorizontal,
  StickyNote,
  Unlock,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { WindowedWorkspace } from "@/components/workspace/windowed-workspace";
import { WorkspaceRenderBoundary } from "@/components/workspace/workspace-render-boundary";
import { SimplePresentationShell } from "@/components/workspace/simple-presentation-shell";
import { SimpleSettingsPanel } from "@/components/workspace/simple-settings-panel";
import { WorkspaceSettings } from "@/components/workspace/workspace-settings";
import {
  type WorkspaceModuleContext,
  workspaceModuleRegistry,
} from "@/components/workspace/workspace-modules";
import { useAuth } from "@/hooks/use-auth";
import {
  useAnnotationMutations,
  useBinderBundle,
  useLearnerNoteMutation,
} from "@/hooks/use-binders";
import { useHistoryMutations, useHistorySuite } from "@/hooks/use-history-suite";
import { useMathWorkspace } from "@/hooks/use-math-workspace";
import { useSaveStatus } from "@/hooks/use-save-status";
import { useWorkspacePreferences } from "@/hooks/use-workspace-preferences";
import { detectMathSuggestions } from "@/lib/math-detection";
import {
  appendGraphBlock,
  appendMathBlock,
  type NoteInsertDraft,
  type NoteInsertRequest,
} from "@/lib/note-blocks";
import { buildBinderNotebookStructure } from "@/lib/notebook-structure";
import { formatNoteSavedAt, NOTE_SAVE_BEFORE_SIGN_OUT_EVENT } from "@/lib/note-save";
import { saveQueue } from "@/lib/save-queue";
import {
  buildSelectionQuoteContext,
  dedupeHighlights,
  extractRenderablePlainText,
  getHighlightRange,
  getSelectionRange,
  rangesOverlap,
  selectionExactlyMatchesHighlight,
  selectionMatchesHighlight,
  trimHighlightToRange,
} from "@/lib/highlights";
import { prepareExpressionForGraph } from "@/lib/scientific-calculator";
import { collectLessonSectionAnchors, findLessonSectionAnchorId } from "@/lib/study-references";
import {
  applyWorkspaceMode,
  applyPreset,
  createStickyNoteLayout,
  ensureMathWorkspaceModules,
  ensureWindowFramesForEnabledModules,
  fitWorkspaceToViewport,
  updateWorkspaceAppearance,
  workspacePresets,
  workspaceModeOptions,
} from "@/lib/workspace-preferences";
import { emptyDoc } from "@/lib/utils";
import { ensureWorkspacePresetDefinitionsLoaded } from "@/services/workspace-preset-service";
import type {
  BinderNotebookLessonEntry,
  BinderNotebookSection,
  BinderBundle,
  Comment,
  Highlight,
  HighlightColor,
  HistoryArgumentNode,
  HistorySource,
  HistorySourceTemplate,
  LessonTextSelection,
  MathBlock,
  WorkspaceModuleId,
  WorkspaceMode,
  WorkspacePreferences,
  WorkspacePresetId,
  WorkspaceWindowFrame,
} from "@/types";

type PendingNoteSave = {
  input: {
    id?: string;
    binderId: string;
    lessonId: string;
    folderId?: string | null;
    title: string;
    content: JSONContent;
    mathBlocks: MathBlock[];
  };
  scopeKey: string;
};

export function BinderReaderPage() {
  const { binderId, lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const binderQuery = useBinderBundle(binderId, profile);
  const noteMutation = useLearnerNoteMutation(profile, binderId);
  const annotations = useAnnotationMutations(profile, binderId);
  const workspace = useWorkspacePreferences(
    profile?.id,
    binderId,
    binderQuery.data?.binder?.suite_template_id ?? null,
  );
  const historyQuery = useHistorySuite(
    binderQuery.data?.binder,
    binderQuery.data?.lessons ?? [],
    profile,
  );
  const historyMutations = useHistoryMutations(binderQuery.data?.binder, profile);

  const [query, setQuery] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentAnchor, setCommentAnchor] = useState<string | null>(null);
  const [hiddenStickyIds, setHiddenStickyIds] = useState<string[]>([]);
  const [dismissedMath, setDismissedMath] = useState<string[]>([]);
  const [mobileModule, setMobileModule] = useState<WorkspaceModuleId>("lesson");
  const [layoutMode, setLayoutMode] = useState<"study" | "setup">("study");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [pendingExpression, setPendingExpression] = useState<{
    id: string;
    latex: string;
  } | null>(null);
  const [pendingGraphLoad, setPendingGraphLoad] = useState<{
    id: string;
    expressions: string[];
    viewport: {
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
    };
  } | null>(null);
  const [noteId, setNoteId] = useState<string | undefined>(undefined);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState<JSONContent>(emptyDoc());
  const [noteMath, setNoteMath] = useState<MathBlock[]>([]);
  const [noteInsertRequest, setNoteInsertRequest] = useState<NoteInsertRequest | null>(null);
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);
  const [isNoteSaveActive, setIsNoteSaveActive] = useState(false);
  const [noteLastSavedAt, setNoteLastSavedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [activeHistoryEventId, setActiveHistoryEventId] = useState<string | null>(null);
  const [activeHistorySourceId, setActiveHistorySourceId] = useState<string | null>(null);
  const [presetLoadError, setPresetLoadError] = useState<Error | null>(null);
  const workspaceRootRef = useRef<HTMLElement | null>(null);
  const pendingNoteSaveRef = useRef<PendingNoteSave | null>(null);
  const retryNoteSaveRef = useRef<PendingNoteSave | null>(null);
  const noteSaveTimerRef = useRef<number | null>(null);
  const noteMutationRef = useRef(noteMutation.mutateAsync);
  const noteSaveActiveRef = useRef(false);
  const noteScopeHydratedRef = useRef(false);
  const noteHasLocalEditsRef = useRef(false);
  const activeNoteScopeRef = useRef("");
  const latestVisibleNoteDraftRef = useRef<PendingNoteSave | null>(null);

  const isCompact = useCompactWorkspace();
  const syncedSnapshotRef = useRef("");
  const active = workspace.active;
  const isSimpleMode = active?.activeMode === "simple";
  const isCanvasMode = active?.activeMode === "canvas";
  const isLayoutEditing = layoutMode === "setup" && isCanvasMode;
  const deferredNoteContent = useDeferredValue(noteContent);
  const deferredQuery = useDeferredValue(query);
  const lessons = binderQuery.data?.lessons ?? [];
  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === lessonId) ?? lessons[0],
    [lessonId, lessons],
  );
  const historyTimelineStatus = useSaveStatus(
    `history-timeline:${binderId ?? "none"}:${profile?.id ?? "anon"}`,
  );
  const historyEvidenceStatus = useSaveStatus(
    `history-evidence:${binderId ?? "none"}:${profile?.id ?? "anon"}`,
  );
  const historyArgumentStatus = useSaveStatus(
    `history-argument:${binderId ?? "none"}:${profile?.id ?? "anon"}`,
  );
  const historyMythStatus = useSaveStatus(
    `history-myth:${binderId ?? "none"}:${profile?.id ?? "anon"}`,
  );
  const highlightScopeKey =
    binderId && selectedLesson && profile
      ? `highlight:${binderId}:${selectedLesson.id}:${profile.id}`
      : "highlight:none";
  const highlightStatus = useSaveStatus(highlightScopeKey);
  const historyData = historyQuery.data;
  const highlightOperationRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const suiteTemplateId = binderQuery.data?.binder?.suite_template_id;
    if (!suiteTemplateId || !binderId) {
      setPresetLoadError(null);
      return;
    }

    void ensureWorkspacePresetDefinitionsLoaded({
      suiteTemplateId,
      binderId,
    })
      .then(() => {
        setPresetLoadError(null);
      })
      .catch((error) => {
        const resolved =
          error instanceof Error ? error : new Error("Failed to load seeded workspace presets.");
        setPresetLoadError(resolved);
        console.error("Failed to load seeded workspace presets.", resolved);
      });
  }, [binderId, binderQuery.data?.binder?.suite_template_id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const firstEventId = historyData?.templateEvents[0]?.id ?? historyData?.events[0]?.id ?? null;
    setActiveHistoryEventId((current) => current ?? firstEventId);
  }, [historyData?.events, historyData?.templateEvents]);

  useEffect(() => {
    const firstSourceId = historyData?.templateSources[0]?.id ?? historyData?.sources[0]?.id ?? null;
    setActiveHistorySourceId((current) => current ?? firstSourceId);
  }, [historyData?.sources, historyData?.templateSources]);

  const clearNoteSaveTimer = useCallback(() => {
    if (noteSaveTimerRef.current !== null) {
      window.clearTimeout(noteSaveTimerRef.current);
      noteSaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (active.activeMode !== "canvas") {
      setLayoutMode("study");
      return;
    }

    setLayoutMode(active.locked ? "study" : "setup");
    if (!active.locked) {
      setPreferencesOpen(false);
    }
  }, [active?.activeMode, active?.binderId, active?.locked, active?.updatedAt]);

  const historyEnabled =
    binderQuery.data?.binder.subject === "History" ||
    Boolean(historyData?.suite?.history_mode);
  const showSystemDiagnostics =
    (profile?.role === "admin" || import.meta.env.DEV) &&
    searchParams.get("debug") === "system";
  const historySeedHealthMessage = (() => {
    if (!historyQuery.error && historyData?.seedHealth?.status !== "missing") {
      return null;
    }

    if (showSystemDiagnostics) {
      if (historyQuery.error instanceof Error) {
        return historyQuery.error.message;
      }
      if (historyData?.seedHealth?.status === "missing") {
        return historyData.seedHealth.message;
      }
      return "History suite content is unavailable for this binder.";
    }

    return "History suite content is still being prepared for this binder.";
  })();
  const ownerId = profile?.id ?? null;
  const currentNoteScopeKey = binderId && selectedLesson ? `${binderId}:${selectedLesson.id}` : "";
  const activeFolderId = binderQuery.data?.folderLinks[0]?.folder_id ?? null;
  const defaultHighlightColor: HighlightColor = active?.theme.defaultHighlightColor ?? "yellow";
  const updateNoteMathDraft = useCallback(
    (updater: MathBlock[] | ((current: MathBlock[]) => MathBlock[])) => {
      noteHasLocalEditsRef.current = true;
      setNoteMath(updater);
    },
    [],
  );

  useEffect(() => {
    noteMutationRef.current = noteMutation.mutateAsync;
  }, [noteMutation.mutateAsync]);

  const mathWorkspace = useMathWorkspace(
    profile?.id,
    binderId && selectedLesson ? `${binderId}:${selectedLesson.id}` : "binder-workspace",
  );
  const { state: mathState, setGraphExpanded, setGraphVisible, savedFunctionMap, ...mathController } =
    mathWorkspace;

  const updateWorkspace = useCallback(
    (updater: (current: WorkspacePreferences) => WorkspacePreferences) => {
      if (!active) {
        return;
      }

      if (!isLayoutEditing) {
        const next = ensureWindowFramesForEnabledModules(updater(active));
        workspace.commit(next);
        return;
      }

      workspace.updateDraft((current) =>
        ensureWindowFramesForEnabledModules(updater(current)),
      );
    },
    [active, isLayoutEditing, workspace],
  );

  useEffect(() => {
    const handleAppearanceChange = (event: Event) => {
      const detail = (event as CustomEvent<{
        appTheme?: WorkspacePreferences["appearance"]["appTheme"];
        customPalette?: WorkspacePreferences["appearance"]["customPalette"];
      }>).detail;

      if (!detail?.appTheme && !detail?.customPalette) {
        return;
      }

      updateWorkspace((current) =>
        updateWorkspaceAppearance(current, {
          ...(detail.appTheme ? { appTheme: detail.appTheme } : {}),
          ...(detail.customPalette ? { customPalette: detail.customPalette } : {}),
        }),
      );
    };

    window.addEventListener("binder-notes:appearance-change", handleAppearanceChange);
    return () => window.removeEventListener("binder-notes:appearance-change", handleAppearanceChange);
  }, [updateWorkspace]);

  const enterLayoutEditMode = useCallback(() => {
    if (!active) {
      return;
    }

    if (active.activeMode !== "canvas") {
      setPreferencesOpen(true);
      return;
    }

    setLayoutMode("setup");
    workspace.updateDraft((current) => ({
      ...current,
      locked: false,
      updatedAt: new Date().toISOString(),
    }));
  }, [active, workspace]);

  const saveUnlockedLayout = useCallback(() => {
    workspace.saveUnlocked();
    setLayoutMode("setup");
  }, [workspace]);

  const lockWorkspaceLayout = useCallback(() => {
    const current = workspace.draft ?? active;
    if (!current) {
      return;
    }

    workspace.commit({
      ...current,
      locked: true,
      updatedAt: new Date().toISOString(),
    });
    setLayoutMode("study");
  }, [active, workspace]);

  const cancelLayoutEditing = useCallback(() => {
    workspace.cancel();
    setLayoutMode(workspace.saved?.activeMode === "canvas" && workspace.saved?.locked === false ? "setup" : "study");
  }, [workspace]);

  const resetWorkspaceLayout = useCallback(() => {
    const next = workspace.reset();
    setLayoutMode(next?.activeMode === "canvas" && next?.locked === false ? "setup" : "study");
  }, [workspace]);

  const applyWorkspacePreset = useCallback(
    (presetId: WorkspacePresetId) => {
      updateWorkspace((current) => applyPreset(current, presetId));
    },
    [updateWorkspace],
  );

  const ensureModulesVisible = useCallback(
    (
      moduleIds: WorkspaceModuleId[],
      options?: {
        enterLayoutWhenAdded?: boolean;
        applyMathDefaults?: boolean;
      },
    ) => {
      const current = workspace.draft ?? active;
      if (!current) {
        return false;
      }

      const missing = moduleIds.filter((moduleId) => !current.enabledModules.includes(moduleId));
      if (missing.length === 0) {
        return false;
      }

      let next: WorkspacePreferences = {
        ...current,
        enabledModules: [...current.enabledModules, ...missing],
        updatedAt: new Date().toISOString(),
      };
      if (options?.applyMathDefaults) {
        next = ensureMathWorkspaceModules(next);
      }
      next = ensureWindowFramesForEnabledModules(next);

      if (options?.enterLayoutWhenAdded && next.activeMode === "canvas") {
        workspace.updateDraft(() => ({
          ...next,
          locked: false,
        }));
        setLayoutMode("setup");
        setPreferencesOpen(false);
      } else if (options?.enterLayoutWhenAdded) {
        workspace.commit(next);
        setPreferencesOpen(true);
      } else if (isLayoutEditing) {
        workspace.updateDraft(() => next);
      } else {
        workspace.commit(next);
      }

      return true;
    },
    [active, isLayoutEditing, workspace],
  );

  const ensureNotesVisible = useCallback(() => {
    updateWorkspace((current) =>
      current.enabledModules.includes("private-notes")
        ? current
        : applyPreset(current, "split-study"),
    );
  }, [updateWorkspace]);

  const enterNotebookFocus = useCallback(() => {
    updateWorkspace((current) => {
      const next = applyPreset(current, "notes-focus");
      return {
        ...next,
        theme: {
          ...next.theme,
          focusMode: true,
        },
      };
    });
  }, [updateWorkspace]);

  const selectHistoryEvent = useCallback((eventId: string) => {
    setActiveHistoryEventId(eventId);
  }, []);

  const selectHistorySource = useCallback((sourceId: string) => {
    setActiveHistorySourceId(sourceId);
  }, []);

  const replayHistoryTimeline = useCallback(() => {
    const nextEventId = historyData?.templateEvents[0]?.id ?? historyData?.events[0]?.id ?? null;
    setActiveHistoryEventId(nextEventId);
    if (active?.preset !== "history-timeline-focus") {
      updateWorkspace((current) => applyPreset(current, "history-timeline-focus"));
    }
  }, [active?.preset, historyData?.events, historyData?.templateEvents, updateWorkspace]);

  const createHistoryStarterEvent = useCallback(async () => {
    if (!profile || !binderId || !selectedLesson) {
      return;
    }

    await saveQueue.run({
      entityType: "history_event",
      scopeKey: `history-timeline:${binderId}:${profile.id}`,
      runner: () =>
        historyMutations.createEvent.mutateAsync({
          binder_id: binderId,
          lesson_id: selectedLesson.id,
          template_event_id: null,
          title: "New turning point",
          summary: "Add the event summary here.",
          significance: "Explain why this event changes the story.",
          location_label: null,
          location_lat: null,
          location_lng: null,
          date_label: "1790",
          sort_year: 1790,
          sort_month: null,
          sort_day: null,
          era: "ce",
          precision: "year",
          approximate: true,
          themes: ["new event"],
          status: "active",
        }),
    });
  }, [binderId, historyMutations.createEvent, profile, selectedLesson]);

  const createHistoryEvidenceFromSource = useCallback(
    async (source: HistorySourceTemplate | HistorySource) => {
      if (!profile || !binderId) {
        return;
      }

      const isUserSource = "template_source_id" in source;
      const sourceId = isUserSource ? source.id : null;
      const templateSourceId = isUserSource ? source.template_source_id : source.id;

      await saveQueue.run({
        entityType: "history_evidence",
        scopeKey: `history-evidence:${binderId}:${profile.id}`,
        runner: () =>
          historyMutations.upsertEvidence.mutateAsync({
            binder_id: binderId,
            lesson_id: selectedLesson?.id ?? null,
            source_id: sourceId,
            highlight_id: null,
            quote_text: source.quote_text ?? null,
            paraphrase: source.context_note ?? source.reliability_note ?? null,
            claim_supports: source.claim_supports ?? null,
            claim_challenges: source.claim_challenges ?? null,
            evidence_strength: "supported",
            source_snapshot_json: {
              sourceId,
              templateSourceId,
              templateEventId: activeHistoryEventId,
              title: source.title,
              lessonId: selectedLesson?.id ?? null,
            },
          }),
      });
    },
    [activeHistoryEventId, binderId, historyMutations.upsertEvidence, profile, selectedLesson],
  );

  const saveSelectionAsEvidence = useCallback(
    async (selection: LessonTextSelection) => {
      if (!profile || !binderId || !selectedLesson || !selection.text.trim()) {
        return;
      }

      const savedHighlight = await annotations.highlight.mutateAsync({
        binderId,
        lessonId: selectedLesson.id,
        anchorText: selection.text.trim(),
        selectedText: selection.text.trim(),
        color: defaultHighlightColor,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        prefixText: selection.prefixText,
        suffixText: selection.suffixText,
        blockId: selection.blockId ?? null,
      });

      await saveQueue.run({
        entityType: "history_evidence",
        scopeKey: `history-evidence:${binderId}:${profile.id}`,
        runner: () =>
          historyMutations.upsertEvidence.mutateAsync({
            binder_id: binderId,
            lesson_id: selectedLesson.id,
            source_id: null,
            highlight_id: savedHighlight.id,
            quote_text: selection.text.trim(),
            paraphrase: null,
            claim_supports: null,
            claim_challenges: null,
            evidence_strength: "supported",
            source_snapshot_json: {
              eventId: activeHistoryEventId,
              lessonId: selectedLesson.id,
              startOffset: selection.startOffset,
              endOffset: selection.endOffset,
              selectedText: selection.text.trim(),
            },
          }),
      });
    },
    [
      activeHistoryEventId,
      annotations.highlight,
      binderId,
      defaultHighlightColor,
      historyMutations.upsertEvidence,
      profile,
      selectedLesson,
    ],
  );

  const useHistorySourceInArgument = useCallback(
    (sourceId: string) => {
      setActiveHistorySourceId(sourceId);
      updateWorkspace((current) => applyPreset(current, "history-argument-builder"));
    },
    [updateWorkspace],
  );

  const createHistoryStarterChain = useCallback(async () => {
    if (!profile || !binderId || !selectedLesson) {
      return;
    }

    await saveQueue.run({
      entityType: "history_argument",
      scopeKey: `history-argument:${binderId}:${profile.id}`,
      runner: async () => {
        const chain = await historyMutations.createArgumentChain.mutateAsync({
          binder_id: binderId,
          lesson_id: selectedLesson.id,
          prompt: "What were the most important causes of the French Revolution?",
          thesis:
            "The French Revolution was caused not by one event, but by the combination of financial crisis, social inequality, and Enlightenment political ideas.",
          context:
            "Use chronology to show why structural problems became a political revolution in 1789.",
          counterargument:
            "Some explanations overstate one cause, such as bread prices, and miss the broader crisis.",
          conclusion:
            "The strongest answer shows how economic stress, representation disputes, and political ideas intensified one another.",
        });

        const starterTitles = [
          "Financial crisis",
          "Estates-General called",
          "Political conflict grows",
          "Tennis Court Oath",
          "Revolutionary momentum",
          "Storming of the Bastille",
        ];

        const createdNodes: HistoryArgumentNode[] = [];
        for (const [index, title] of starterTitles.entries()) {
          const node = await historyMutations.createArgumentNode.mutateAsync({
            chain_id: chain.id,
            node_type: index === 0 ? "cause" : index === starterTitles.length - 1 ? "effect" : "cause",
            title,
            body: `Explain how ${title.toLowerCase()} pushes the revolution forward.`,
            sort_order: index,
            event_id: null,
            source_id: null,
            evidence_id: null,
          });
          createdNodes.push(node);
        }

        for (let index = 0; index < createdNodes.length - 1; index += 1) {
          await historyMutations.createArgumentEdge.mutateAsync({
            chain_id: chain.id,
            from_node_id: createdNodes[index].id,
            to_node_id: createdNodes[index + 1].id,
            relation_type: index === 0 ? "caused" : index === 2 ? "triggered" : "contributed_to",
            strength: 3,
            explanation: "Add the connective explanation for this step.",
            source_id: null,
            evidence_id: null,
          });
        }

        updateWorkspace((current) => applyPreset(current, "history-argument-builder"));
        return chain;
      },
    });
  }, [
    binderId,
    historyMutations.createArgumentChain,
    historyMutations.createArgumentEdge,
    historyMutations.createArgumentNode,
    profile,
    selectedLesson,
    updateWorkspace,
  ]);

  const updateHistoryArgumentChain = useCallback(
    async (
      chainId: string,
      patch: Partial<{
        prompt: string;
        thesis: string;
        context: string;
        counterargument: string;
        conclusion: string;
      }>,
    ) => {
      if (!profile || !binderId) {
        return;
      }

      await saveQueue.run({
        entityType: "history_argument",
        scopeKey: `history-argument:${binderId}:${profile.id}`,
        runner: () => historyMutations.updateArgumentChain.mutateAsync({ chainId, patch }),
      });
    },
    [binderId, historyMutations.updateArgumentChain, profile],
  );

  const useHistoryEvidencePrompt = useCallback(() => {
    updateWorkspace((current) => applyPreset(current, "history-source-evidence"));
  }, [updateWorkspace]);

  const createHistoryMythCheck = useCallback(async () => {
    if (!profile || !binderId) {
      return;
    }

    const starter = historyData?.templateMythChecks[0];
    await saveQueue.run({
      entityType: "myth_check",
      scopeKey: `history-myth:${binderId}:${profile.id}`,
      runner: () =>
        historyMutations.upsertMythCheck.mutateAsync({
          binder_id: binderId,
          lesson_id: selectedLesson?.id ?? null,
          myth_text: starter?.myth_text ?? "Add a popular claim",
          corrected_claim: starter?.corrected_claim ?? "Write the evidence-supported explanation.",
          status: starter?.status ?? "oversimplification",
          explanation: starter?.explanation ?? "Explain why the status fits the evidence.",
        }),
    });
  }, [binderId, historyData?.templateMythChecks, historyMutations.upsertMythCheck, profile, selectedLesson]);

  const queueNoteInsert = useCallback(
    (request: NoteInsertDraft) => {
      ensureNotesVisible();
      setNoteInsertRequest({
        ...request,
        id: crypto.randomUUID(),
      });
    },
    [ensureNotesVisible],
  );

  const applyModeChoice = useCallback(
    (workspaceMode: WorkspaceMode) => {
      updateWorkspace((current) => applyWorkspaceMode(current, workspaceMode));
      setPreferencesOpen(false);
    },
    [updateWorkspace],
  );

  const toggleFocusMode = useCallback(() => {
    updateWorkspace((current) => ({
      ...current,
      simple:
        current.activeMode === "simple"
          ? {
              ...current.simple,
              focusMode: !current.simple.focusMode,
            }
          : current.simple,
      theme:
        current.activeMode === "simple"
          ? current.theme
          : {
              ...current.theme,
              focusMode: !current.theme.focusMode,
            },
    }));
  }, [updateWorkspace]);

  useEffect(() => {
    const node = workspaceRootRef.current;
    if (!node || typeof document === "undefined") {
      return;
    }

    const syncFocusState = () => {
      if (document.fullscreenElement === node) {
        return;
      }

      const focusMode =
        active?.activeMode === "simple" ? active.simple.focusMode : active?.theme.focusMode;

      if (focusMode) {
        updateWorkspace((current) =>
          current.activeMode === "simple" && current.simple.focusMode
            ? {
                ...current,
                simple: {
                  ...current.simple,
                  focusMode: false,
                },
              }
            : current.theme.focusMode
              ? {
                  ...current,
                  theme: {
                    ...current.theme,
                    focusMode: false,
                  },
                }
              : current,
        );
      }
    };

    document.addEventListener("fullscreenchange", syncFocusState);

    const focusMode =
      active?.activeMode === "simple" ? active.simple.focusMode : active?.theme.focusMode;

    if (focusMode) {
      if (document.fullscreenElement !== node && node.requestFullscreen) {
        void node.requestFullscreen().catch(() => {
          // Keep the CSS-driven focus fallback even if the browser fullscreen request is denied.
        });
      }
    } else if (document.fullscreenElement === node && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => {
        // If exit fails we leave the browser fullscreen state alone instead of interrupting the page.
      });
    }

    return () => document.removeEventListener("fullscreenchange", syncFocusState);
  }, [active?.activeMode, active?.simple.focusMode, active?.theme.focusMode, updateWorkspace]);

  const ensureMathWorkspaceVisible = useCallback(
    (options?: { enterLayoutWhenAdded?: boolean }) => {
      ensureModulesVisible(["desmos-graph", "scientific-calculator", "saved-graphs"], {
        applyMathDefaults: true,
        enterLayoutWhenAdded: options?.enterLayoutWhenAdded,
      });
    },
    [ensureModulesVisible],
  );

  const stickyManagerVisible = Boolean(active?.enabledModules.includes("comments"));

  const toggleStickyManager = useCallback(() => {
    if (!active) {
      return;
    }

    if (active.enabledModules.includes("comments")) {
      updateWorkspace((current) => ({
        ...current,
        enabledModules: current.enabledModules.filter((moduleId) => moduleId !== "comments"),
      }));
      return;
    }

    ensureModulesVisible(["comments"], {
      enterLayoutWhenAdded: false,
    });
  }, [active, ensureModulesVisible, updateWorkspace]);

  const sourceLabel = useMemo(
    () =>
      binderQuery.data && selectedLesson
        ? `${binderQuery.data.binder.title} - ${selectedLesson.title}`
        : "Source lesson",
    [binderQuery.data, selectedLesson],
  );

  const pushExpressionToGraph = useCallback(
    (expression?: string) => {
      const latex = prepareExpressionForGraph(
        expression ?? mathState.calculatorExpression,
        savedFunctionMap,
      );
      if (!latex) {
        return;
      }

      ensureMathWorkspaceVisible({ enterLayoutWhenAdded: true });
      setGraphVisible(true);
      setPendingGraphLoad(null);
      setPendingExpression({
        id: crypto.randomUUID(),
        latex,
      });
    },
    [
      ensureMathWorkspaceVisible,
      mathState.calculatorExpression,
      savedFunctionMap,
      setGraphVisible,
    ],
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    setMobileModule((current) =>
      active.enabledModules.includes(current) ? current : active.enabledModules[0] ?? "lesson",
    );
  }, [active]);

  const filteredLessons = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) {
      return lessons;
    }

    return lessons.filter((lesson) =>
      `${lesson.title} ${JSON.stringify(lesson.content)}`.toLowerCase().includes(normalized),
    );
  }, [deferredQuery, lessons]);

  const currentNote = useMemo(() => {
    if (!binderQuery.data || !profile || !selectedLesson) {
      return null;
    }

    return (
      binderQuery.data.notes.find(
        (note) => note.lesson_id === selectedLesson.id && note.owner_id === profile.id,
      ) ?? null
    );
  }, [binderQuery.data, profile, selectedLesson]);

  const queueCurrentDraftForSave = useCallback(() => {
    if (!noteScopeHydratedRef.current) {
      return false;
    }

    if (!noteHasLocalEditsRef.current) {
      return false;
    }

    const currentDraft = latestVisibleNoteDraftRef.current;
    if (!currentDraft) {
      return false;
    }

    const currentSnapshot = serializeNoteSnapshot(
      currentDraft.input.title,
      currentDraft.input.content,
      currentDraft.input.mathBlocks,
    );
    if (currentSnapshot === syncedSnapshotRef.current) {
      return false;
    }

    pendingNoteSaveRef.current = currentDraft;
    retryNoteSaveRef.current = null;
    return true;
  }, []);

  useEffect(() => {
    noteScopeHydratedRef.current = false;
    noteHasLocalEditsRef.current = false;
    clearNoteSaveTimer();
    const previousDraft = latestVisibleNoteDraftRef.current;
    if (
      previousDraft &&
      previousDraft.scopeKey &&
      previousDraft.scopeKey !== currentNoteScopeKey
    ) {
      const previousSnapshot = serializeNoteSnapshot(
        previousDraft.input.title,
        previousDraft.input.content,
        previousDraft.input.mathBlocks,
      );

      if (previousSnapshot !== syncedSnapshotRef.current) {
        pendingNoteSaveRef.current = previousDraft;
        retryNoteSaveRef.current = null;
      }
    }

    activeNoteScopeRef.current = currentNoteScopeKey;
  }, [clearNoteSaveTimer, currentNoteScopeKey]);

  const flushQueuedNoteSave = useCallback(async () => {
    if (noteSaveActiveRef.current) {
      return;
    }

    if (!isOnline) {
      return;
    }

    const pendingDraft = pendingNoteSaveRef.current;
    if (!pendingDraft) {
      return;
    }

    pendingNoteSaveRef.current = null;
    noteSaveActiveRef.current = true;
    setIsNoteSaveActive(true);
    setNoteSaveError(null);

    try {
      const savedNote = await noteMutationRef.current(pendingDraft.input);
      retryNoteSaveRef.current = null;
      if (pendingDraft.scopeKey === activeNoteScopeRef.current) {
        const savedSnapshot = serializeNoteSnapshot(
          savedNote.title,
          savedNote.content,
          savedNote.math_blocks,
        );
        setNoteId(savedNote.id);
        setNoteLastSavedAt(savedNote.updated_at);
        syncedSnapshotRef.current = savedSnapshot;
        setNoteSaveError(null);
        const visibleDraft = latestVisibleNoteDraftRef.current;
        const visibleSnapshot =
          visibleDraft && visibleDraft.scopeKey === pendingDraft.scopeKey
            ? serializeNoteSnapshot(
                visibleDraft.input.title,
                visibleDraft.input.content,
                visibleDraft.input.mathBlocks,
              )
            : savedSnapshot;
        noteHasLocalEditsRef.current = visibleSnapshot !== savedSnapshot;
      }
    } catch (caught) {
      retryNoteSaveRef.current = pendingDraft;
      if (pendingDraft.scopeKey === activeNoteScopeRef.current) {
        setNoteSaveError(getLearnerNoteSaveErrorMessage(caught));
      }
    } finally {
      noteSaveActiveRef.current = false;
      setIsNoteSaveActive(false);
      if (pendingNoteSaveRef.current && isOnline) {
        void flushQueuedNoteSave();
      }
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline || !pendingNoteSaveRef.current || noteSaveActiveRef.current) {
      return;
    }

    void flushQueuedNoteSave();
  }, [currentNoteScopeKey, flushQueuedNoteSave, isOnline]);

  const retryFailedNoteSave = useCallback(() => {
    const retryDraft = retryNoteSaveRef.current ?? latestVisibleNoteDraftRef.current;
    if (!retryDraft) {
      return;
    }

    pendingNoteSaveRef.current = retryDraft;
    void flushQueuedNoteSave();
  }, [flushQueuedNoteSave]);

  const saveNoteNow = useCallback(() => {
    clearNoteSaveTimer();
    const queued = queueCurrentDraftForSave();
    if (queued) {
      void flushQueuedNoteSave();
    }
  }, [clearNoteSaveTimer, flushQueuedNoteSave, queueCurrentDraftForSave]);

  useEffect(() => {
    if (!isOnline || noteSaveActiveRef.current) {
      return;
    }

    if (!pendingNoteSaveRef.current && retryNoteSaveRef.current) {
      pendingNoteSaveRef.current = retryNoteSaveRef.current;
    }

    if (pendingNoteSaveRef.current) {
      void flushQueuedNoteSave();
    }
  }, [flushQueuedNoteSave, isOnline]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const flushCurrentDraft = () => {
      if (queueCurrentDraftForSave() && isOnline) {
        void flushQueuedNoteSave();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushCurrentDraft();
      }
    };

    const handleBeforeSignOut = (event: Event) => {
      if (!queueCurrentDraftForSave() || !isOnline) {
        return;
      }

      const detail = (event as CustomEvent<{ promises?: Promise<unknown>[] }>).detail;
      const promise = flushQueuedNoteSave();
      if (detail?.promises) {
        detail.promises.push(promise);
      }
    };

    window.addEventListener("pagehide", flushCurrentDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(
      NOTE_SAVE_BEFORE_SIGN_OUT_EVENT,
      handleBeforeSignOut as EventListener,
    );

    return () => {
      window.removeEventListener("pagehide", flushCurrentDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(
        NOTE_SAVE_BEFORE_SIGN_OUT_EVENT,
        handleBeforeSignOut as EventListener,
      );
    };
  }, [flushQueuedNoteSave, isOnline, queueCurrentDraftForSave]);

  useEffect(() => {
    if (!noteScopeHydratedRef.current || !ownerId || !binderId || !selectedLesson) {
      latestVisibleNoteDraftRef.current = null;
      return;
    }

    latestVisibleNoteDraftRef.current = {
      input: {
        id: noteId,
        binderId,
        lessonId: selectedLesson.id,
        folderId: activeFolderId,
        title: noteTitle.trim() || `${selectedLesson.title} notes`,
        content: noteContent,
        mathBlocks: noteMath,
      },
      scopeKey: currentNoteScopeKey,
    };
  }, [
    activeFolderId,
    binderId,
    currentNoteScopeKey,
    noteContent,
    noteId,
    noteMath,
    noteTitle,
    ownerId,
    selectedLesson,
  ]);

  useEffect(() => {
    if (!selectedLesson) {
      return;
    }

    const nextTitle = currentNote?.title ?? `${selectedLesson.title} notes`;
    const nextContent = currentNote?.content ?? emptyDoc();
    const nextMath = currentNote?.math_blocks ?? [];
    const nextSnapshot = serializeNoteSnapshot(nextTitle, nextContent, nextMath);
    const currentDraft = latestVisibleNoteDraftRef.current;
    const currentSnapshot = currentDraft
      ? serializeNoteSnapshot(
          currentDraft.input.title,
          currentDraft.input.content,
          currentDraft.input.mathBlocks,
        )
      : "";

    if (
      currentNoteScopeKey === activeNoteScopeRef.current &&
      currentDraft?.scopeKey === currentNoteScopeKey &&
      currentNote?.id === currentDraft?.input.id &&
      nextSnapshot === currentSnapshot
    ) {
      noteScopeHydratedRef.current = true;
      syncedSnapshotRef.current = nextSnapshot;
      return;
    }

    setNoteId(currentNote?.id);
    setNoteTitle(nextTitle);
    setNoteContent(nextContent);
    setNoteMath(nextMath);
    setDismissedMath([]);
    setCommentAnchor(null);
    setHiddenStickyIds([]);
    setPendingExpression(null);
    setPendingGraphLoad(null);
    setNoteSaveError(null);
    setNoteLastSavedAt(currentNote?.updated_at ?? null);
    retryNoteSaveRef.current = null;
    noteScopeHydratedRef.current = true;
    noteHasLocalEditsRef.current = false;
    syncedSnapshotRef.current = nextSnapshot;
  }, [
    currentNote,
    currentNoteScopeKey,
    selectedLesson,
  ]);

  useEffect(() => {
    if (!noteScopeHydratedRef.current || !ownerId || !binderId || !selectedLesson) {
      clearNoteSaveTimer();
      return;
    }

    if (!noteHasLocalEditsRef.current) {
      clearNoteSaveTimer();
      return;
    }

    const title = noteTitle.trim() || `${selectedLesson.title} notes`;
    const snapshot = serializeNoteSnapshot(title, noteContent, noteMath);
    if (snapshot === syncedSnapshotRef.current) {
      clearNoteSaveTimer();
      setNoteSaveError(null);
      retryNoteSaveRef.current = null;
      noteHasLocalEditsRef.current = false;
      return;
    }

    clearNoteSaveTimer();
    noteSaveTimerRef.current = window.setTimeout(() => {
      pendingNoteSaveRef.current = {
        input: {
          id: noteId,
          binderId,
          lessonId: selectedLesson.id,
          folderId: activeFolderId,
          title,
          content: noteContent,
          mathBlocks: noteMath,
        },
        scopeKey: currentNoteScopeKey,
      };
      retryNoteSaveRef.current = null;
      noteSaveTimerRef.current = null;
      if (isOnline) {
        void flushQueuedNoteSave();
      }
    }, 700);

    return clearNoteSaveTimer;
  }, [
    activeFolderId,
    binderId,
    clearNoteSaveTimer,
    noteContent,
    noteId,
    noteMath,
    noteTitle,
    ownerId,
    currentNoteScopeKey,
    isOnline,
    selectedLesson,
  ]);

  const mathSuggestions = useMemo(
    () =>
      detectMathSuggestions(deferredNoteContent, noteMath).filter(
        (suggestion) => !dismissedMath.includes(suggestion.key),
      ),
    [deferredNoteContent, dismissedMath, noteMath],
  );

  const lessonComments = useMemo(
    () =>
      (binderQuery.data?.comments ?? []).filter(
        (comment) =>
          comment.lesson_id === selectedLesson?.id && !hiddenStickyIds.includes(comment.id),
      ),
    [binderQuery.data?.comments, hiddenStickyIds, selectedLesson?.id],
  );

  const lessonHighlights = useMemo(
    () =>
      dedupeHighlights(
        (binderQuery.data?.highlights ?? []).filter(
        (highlight) => highlight.lesson_id === selectedLesson?.id,
        ),
      ),
    [binderQuery.data?.highlights, selectedLesson?.id],
  );
  const lessonPlainText = useMemo(
    () => (selectedLesson ? extractRenderablePlainText(selectedLesson.content) : ""),
    [selectedLesson],
  );
  const buildHighlightInputFromSelection = useCallback(
    (
      selection: LessonTextSelection,
      color: HighlightColor,
      activeBinderId: string,
      lessonId: string,
    ) => ({
      binderId: activeBinderId,
      lessonId,
      anchorText: selection.text.trim(),
      selectedText: selection.text.trim(),
      color,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      prefixText: selection.prefixText,
      suffixText: selection.suffixText,
      blockId: selection.blockId ?? null,
    }),
    [],
  );
  const buildHighlightInputFromStoredHighlight = useCallback(
    (highlight: Highlight, activeBinderId: string, lessonId: string) => {
      const startOffset = highlight.start_offset ?? 0;
      const endOffset = highlight.end_offset ?? startOffset;
      const quoteContext = buildSelectionQuoteContext(lessonPlainText, startOffset, endOffset);

      return {
        binderId: activeBinderId,
        lessonId,
        anchorText: highlight.anchor_text,
        selectedText: highlight.selected_text ?? highlight.anchor_text,
        color: highlight.color,
        startOffset: highlight.start_offset ?? undefined,
        endOffset: highlight.end_offset ?? undefined,
        prefixText: highlight.prefix_text ?? quoteContext.prefixText,
        suffixText: highlight.suffix_text ?? quoteContext.suffixText,
        blockId:
          highlight.selector_json && "selectors" in highlight.selector_json
            ? (highlight.selector_json.selectors.find((selector) => selector.type === "BlockSelector")?.blockId ?? null)
            : highlight.selector_json && highlight.selector_json.type === "BlockSelector"
              ? highlight.selector_json.blockId
              : null,
      };
    },
    [lessonPlainText],
  );
  const readCurrentHighlights = useCallback(
    (activeBinderId: string) =>
      queryClient.getQueryData<BinderBundle>(["binder", activeBinderId, profile?.id])?.highlights ??
      binderQuery.data?.highlights ??
      [],
    [binderQuery.data?.highlights, profile?.id, queryClient],
  );
  const runQueuedHighlightOperation = useCallback(
    <T,>(scopeKey: string, runner: () => Promise<T>): Promise<T> => {
      const run = () =>
        saveQueue.run({
          entityType: "highlight",
          scopeKey,
          runner,
        });
      const next = highlightOperationRef.current.then(run, run);
      highlightOperationRef.current = next.catch(() => undefined);
      return next;
    },
    [],
  );
  const lessonAnchors = useMemo(
    () => (selectedLesson ? collectLessonSectionAnchors(selectedLesson.content, selectedLesson.id) : []),
    [selectedLesson],
  );
  const lessonGraphBlocks = useMemo(
    () =>
      (selectedLesson?.math_blocks ?? []).filter(
        (block): block is Extract<MathBlock, { type: "graph" }> => block.type === "graph",
      ),
    [selectedLesson],
  );
  const selectedLessonTitle = selectedLesson?.title ?? "Study notes";
  const notebookStructure = useMemo<{
    entries: BinderNotebookLessonEntry[];
    sections: BinderNotebookSection[];
  }>(() => {
    if (!binderQuery.data || !profile) {
      return {
        entries: [],
        sections: [],
      };
    }

    return buildBinderNotebookStructure({
      binder: binderQuery.data.binder,
      lessons,
      notes: binderQuery.data.notes,
      ownerId: profile.id,
    });
  }, [binderQuery.data, lessons, profile]);
  const binderNotebookEntries = notebookStructure.entries;
  const binderNotebookSections = notebookStructure.sections;
  const currentNotebookSection = useMemo(
    () =>
      binderNotebookSections.find((section) =>
        section.lessons.some((entry) => entry.lesson.id === selectedLesson?.id),
      ) ??
      binderNotebookSections[0] ??
      null,
    [binderNotebookSections, selectedLesson?.id],
  );
  const autosaveSnapshot = useMemo(
    () => serializeNoteSnapshot(noteTitle.trim() || `${selectedLessonTitle} notes`, noteContent, noteMath),
    [noteContent, noteMath, noteTitle, selectedLessonTitle],
  );
  const hasUnsavedChanges = autosaveSnapshot !== syncedSnapshotRef.current;
  const autosaveStatus: "saved" | "saving" | "unsaved" | "offline" | "error" = isNoteSaveActive
    ? "saving"
    : !isOnline && hasUnsavedChanges
      ? "offline"
      : noteSaveError && hasUnsavedChanges
        ? "error"
        : hasUnsavedChanges
          ? "unsaved"
          : "saved";
  const noteSaveLabel =
    autosaveStatus === "saving"
      ? "Saving..."
      : autosaveStatus === "offline"
        ? "Offline - will sync"
        : autosaveStatus === "error"
          ? "Save failed"
          : autosaveStatus === "unsaved"
            ? "Unsaved changes"
            : noteLastSavedAt
              ? `Saved ${formatNoteSavedAt(noteLastSavedAt)}`
              : "Saved";
  const noteSaveDetail =
    autosaveStatus === "saving"
      ? "Saving this lesson note to your account now."
      : autosaveStatus === "offline"
        ? "You're offline. Your latest lesson note changes will sync when you're back online."
        : autosaveStatus === "error"
          ? noteSaveError ?? "Save failed. Retry to keep this lesson note."
          : autosaveStatus === "unsaved"
            ? "You have unsaved changes in this lesson note."
            : noteLastSavedAt
              ? `Saved to your account at ${formatNoteSavedAt(noteLastSavedAt)}.`
              : "Saved to your account.";
  const canRetryNoteSave = autosaveStatus === "error";

  const createSticky = useCallback(
    async (anchorText?: string | null, body = "") => {
      if (!binderId || !selectedLesson) {
        return;
      }

      setCommentAnchor(anchorText ?? null);
      const saved = await annotations.comment.mutateAsync({
        binderId,
        lessonId: selectedLesson.id,
        body,
        anchorText: anchorText ?? null,
      });

      updateWorkspace((current) => ({
        ...current,
        enabledModules: current.enabledModules.includes("comments")
          ? current.enabledModules
          : [...current.enabledModules, "comments"],
        stickyNotes: {
          ...current.stickyNotes,
          [saved.id]:
            current.stickyNotes[saved.id] ??
            createStickyNoteLayout(
              lessonComments.length + Object.keys(current.stickyNotes).length,
            ),
        },
      }));
      setCommentAnchor(null);
      setCommentDraft("");
    },
    [annotations.comment, binderId, lessonComments.length, selectedLesson, updateWorkspace],
  );

  const handleSendSelectionToNotes = useCallback(
    (anchorText?: string) => {
      if (!anchorText) {
        return;
      }

      queueNoteInsert({
        kind: "linked-excerpt",
        excerpt: anchorText,
        sourceLabel,
      });
    },
    [queueNoteInsert, sourceLabel],
  );

  const handleCreateQuoteExcerpt = useCallback(
    (anchorText?: string) => {
      if (!anchorText) {
        return;
      }

      queueNoteInsert({
        kind: "quote-response",
        excerpt: anchorText,
        sourceLabel,
      });
    },
    [queueNoteInsert, sourceLabel],
  );

  const handleSendStickyToNotes = useCallback(
    (comment: Comment) => {
      queueNoteInsert({
        kind: "sticky-note",
        anchorText: comment.anchor_text,
        body: comment.body.trim() || "Review this sticky note.",
        sourceLabel,
      });
    },
    [queueNoteInsert, sourceLabel],
  );

  const jumpToLessonAnchor = useCallback((anchorId: string) => {
    if (typeof document === "undefined") {
      return;
    }

    const target = document.querySelector(
      `[data-lesson-anchor="${anchorId}"]`,
    );
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    target.classList.add("lesson-highlight--focus");
    window.setTimeout(() => target.classList.remove("lesson-highlight--focus"), 1400);
  }, []);

  const jumpToMathSource = useCallback(
    (block: MathBlock) => {
      const anchorId = findLessonSectionAnchorId(
        lessonAnchors,
        block.sourceHeading,
        block.sourceAnchorId,
      );
      if (anchorId) {
        jumpToLessonAnchor(anchorId);
      }
    },
    [jumpToLessonAnchor, lessonAnchors],
  );

  const openGraphBlock = useCallback(
    (block: Extract<MathBlock, { type: "graph" }>) => {
      ensureMathWorkspaceVisible({ enterLayoutWhenAdded: true });
      setGraphVisible(true);
      setPendingExpression(null);
      setPendingGraphLoad({
        id: crypto.randomUUID(),
        expressions: block.expressions,
        viewport: {
          xMin: block.xMin,
          xMax: block.xMax,
          yMin: block.yMin,
          yMax: block.yMax,
        },
      });
    },
    [ensureMathWorkspaceVisible, setGraphVisible],
  );

  const mathModules = useMemo(
    () => ({
      controller: {
        state: mathState,
        setGraphExpanded,
        setGraphVisible,
        savedFunctionMap,
        ...mathController,
      },
      jumpToGraphSource: jumpToMathSource,
      lessonGraphs: lessonGraphBlocks,
      loadLessonGraph: openGraphBlock,
      pendingGraphLoad,
      pendingExpression,
      snapshotName,
      setSnapshotName,
      pushExpressionToGraph,
      onExpressionApplied: (id: string) => {
        setPendingExpression((current) => (current?.id === id ? null : current));
      },
      onGraphLoadApplied: (id: string) => {
        setPendingGraphLoad((current) => (current?.id === id ? null : current));
      },
    }),
    [
      jumpToMathSource,
      lessonGraphBlocks,
      mathController,
      mathState,
      openGraphBlock,
      pendingGraphLoad,
      pendingExpression,
      pushExpressionToGraph,
      savedFunctionMap,
      setGraphExpanded,
      setGraphVisible,
      snapshotName,
    ],
  );

  const jumpToHighlight = useCallback((highlightId: string) => {
    if (typeof document === "undefined") {
      return;
    }

    const target = document.querySelector(
      `[data-highlight-id="${highlightId}"]`,
    );
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    target.classList.add("lesson-highlight--focus");
    window.setTimeout(() => target.classList.remove("lesson-highlight--focus"), 1400);
  }, []);

  const resetCurrentLessonHighlights = useCallback(async () => {
    if (!binderId || !selectedLesson) {
      return;
    }

    await annotations.resetHighlights.mutateAsync({
      binderId,
      lessonId: selectedLesson.id,
    });
  }, [annotations.resetHighlights, binderId, selectedLesson]);

  const resetBinderHighlights = useCallback(async () => {
    if (!binderId) {
      return;
    }

    await annotations.resetHighlights.mutateAsync({ binderId });
  }, [annotations.resetHighlights, binderId]);

  if (!profile) {
    return <Navigate replace to="/auth" />;
  }

  if (binderQuery.isLoading || !active) {
    return (
      <main className="app-page !max-w-[1650px]">
        <Skeleton className="h-14" />
        <Skeleton className="h-[170px]" />
        <Skeleton className="h-[860px]" />
      </main>
    );
  }

  if (binderQuery.error || presetLoadError || !binderQuery.data || !selectedLesson) {
    return (
      <main className="app-page max-w-[980px]">
        <EmptyState
          description={
            binderQuery.error instanceof Error
              ? binderQuery.error.message
              : presetLoadError instanceof Error
                ? presetLoadError.message
                : "This study document is unavailable."
          }
          title="Document unavailable"
        />
      </main>
    );
  }

  if (lessonId !== selectedLesson.id) {
    return <Navigate replace to={`/binders/${binderId}/documents/${selectedLesson.id}`} />;
  }

  const primaryFolder = binderQuery.data.folders.find((folder) =>
    binderQuery.data.folderLinks.some((link) => link.folder_id === folder.id),
  );
  const currentPresetLabel =
    workspacePresets.find((preset) => preset.id === active.preset)?.name ?? "Split Study";
  const showUtilityUi = isLayoutEditing || active.theme.showUtilityUi;
  const workspaceModeLabel =
    workspaceModeOptions.find((option) => option.id === active.activeMode)?.name ?? "Simple View";
  const activeFocusMode =
    active.activeMode === "simple" ? active.simple.focusMode : active.theme.focusMode;

  const context: WorkspaceModuleContext = {
    binder: binderQuery.data.binder,
    lessons,
    selectedLesson,
    filteredLessons,
    binderNotebookEntries,
    binderNotebookSections,
    currentNotebookSection,
    query,
    noteTitle,
    noteContent,
    noteMath,
    commentDraft,
    commentAnchor,
    comments: lessonComments,
    highlights: lessonHighlights,
    defaultHighlightColor: active.theme.defaultHighlightColor,
    conceptNodes: binderQuery.data.conceptNodes,
    conceptEdges: binderQuery.data.conceptEdges,
    stickyLayouts: active.stickyNotes,
    mathSuggestions,
    isSetupMode: !active.locked,
    workspaceStyle: active.workspaceStyle,
    autosaveStatus,
    highlightStatus,
    noteSaveLabel,
    noteSaveDetail,
    noteSaveError,
    canRetryNoteSave,
    noteInsertRequest,
    mathModules,
    stickyManagerVisible,
    hasUnsavedNoteChanges: hasUnsavedChanges,
    history: {
      enabled: historyEnabled,
      seedHealthMessage: historySeedHealthMessage,
      templateEvents: historyData?.templateEvents ?? [],
      events: historyData?.events ?? [],
      templateSources: historyData?.templateSources ?? [],
      sources: historyData?.sources ?? [],
      evidenceCards: historyData?.evidenceCards ?? [],
      argumentChains: historyData?.argumentChains ?? [],
      argumentNodes: historyData?.argumentNodes ?? [],
      argumentEdges: historyData?.argumentEdges ?? [],
      templateMythChecks: historyData?.templateMythChecks ?? [],
      mythChecks: historyData?.mythChecks ?? [],
      activeEventId: activeHistoryEventId,
      activeSourceId: activeHistorySourceId,
      status: {
        timeline: historyTimelineStatus,
        evidence: historyEvidenceStatus,
        argument: historyArgumentStatus,
        myth: historyMythStatus,
      },
    },
    onApplyPreset: applyWorkspacePreset,
    onEnterNotebookFocus: enterNotebookFocus,
    onSelectLesson: (lesson) => navigate(`/binders/${binderId}/documents/${lesson.id}`),
    onQueryChange: setQuery,
    onNoteTitleChange: (value) => {
      noteHasLocalEditsRef.current = true;
      setNoteTitle(value);
    },
    onNoteContentChange: (value) => {
      noteHasLocalEditsRef.current = true;
      setNoteContent(value);
    },
    onNoteMathChange: (value) => {
      noteHasLocalEditsRef.current = true;
      setNoteMath(value);
    },
    onCommentDraftChange: setCommentDraft,
    onSaveNoteNow: saveNoteNow,
    onRetryNoteSave: retryFailedNoteSave,
    onPrepareComment: (anchorText) => {
      void createSticky(anchorText ?? null, "");
    },
    onClearPreparedComment: () => {
      setCommentAnchor(null);
      setCommentDraft("");
    },
    onAddComment: () => {
      void createSticky(commentAnchor, commentDraft);
    },
    onCreateLooseSticky: () => {
      void createSticky(null, "");
    },
    onToggleStickyManager: toggleStickyManager,
    onDeleteComment: (commentId) => {
      const previousLayout = active.stickyNotes[commentId];
      setHiddenStickyIds((current) =>
        current.includes(commentId) ? current : [...current, commentId],
      );
      updateWorkspace((current) => {
        const nextStickyNotes = { ...current.stickyNotes };
        delete nextStickyNotes[commentId];
        return {
          ...current,
          stickyNotes: nextStickyNotes,
        };
      });
      annotations.deleteComment.mutate(
        { commentId },
        {
          onError: () => {
            setHiddenStickyIds((current) => current.filter((id) => id !== commentId));
            if (!previousLayout) {
              return;
            }
            updateWorkspace((current) => ({
              ...current,
              stickyNotes: {
                ...current.stickyNotes,
                [commentId]: previousLayout,
              },
            }));
          },
          onSettled: () => {
            setHiddenStickyIds((current) => current.filter((id) => id !== commentId));
          },
        },
      );
    },
    onUpdateComment: (commentId, body) => {
      annotations.updateComment.mutate({ commentId, body });
    },
    onAddHighlight: (selection, color) => {
      if (!binderId || !selectedLesson || !profile || !selection.text.trim()) {
        return;
      }

      const activeBinderId = binderId;
      const activeLessonId = selectedLesson.id;
      const activeLessonPlainText = lessonPlainText;
      const operationScopeKey = `highlight:${activeBinderId}:${activeLessonId}:${profile.id}`;

      void runQueuedHighlightOperation(operationScopeKey, async () => {
        const selectionRange = getSelectionRange(selection);
        const allMatchingHighlights = readCurrentHighlights(activeBinderId).filter(
          (highlight) =>
            highlight.lesson_id === activeLessonId &&
            selectionMatchesHighlight(selection, highlight),
        );
        const exactMatches = allMatchingHighlights.filter((highlight) =>
          selectionExactlyMatchesHighlight(selection, highlight),
        );
        const exactPrimary = exactMatches.at(0) ?? null;

        if (exactPrimary) {
          const duplicateExactMatches = exactMatches.filter(
            (highlight) => highlight.id !== exactPrimary.id,
          );
          await Promise.all(
            duplicateExactMatches.map((highlight) =>
              annotations.deleteHighlight.mutateAsync({ highlightId: highlight.id }),
            ),
          );

          if (exactPrimary.color === color) {
            return;
          }

          await annotations.updateHighlight.mutateAsync({
            highlightId: exactPrimary.id,
            ...buildHighlightInputFromSelection(
              selection,
              color,
              activeBinderId,
              activeLessonId,
            ),
          });
          return;
        }

        const overlappingHighlights = allMatchingHighlights.filter((highlight) => {
          const range = getHighlightRange(highlight);
          return range ? rangesOverlap(range, selectionRange) : true;
        });

        await Promise.all(
          overlappingHighlights.map(async (highlight) => {
            const range = getHighlightRange(highlight);
            if (!range) {
              await annotations.deleteHighlight.mutateAsync({ highlightId: highlight.id });
              return;
            }

            const left = trimHighlightToRange(
              highlight,
              { start: range.start, end: selectionRange.start },
              activeLessonPlainText,
            );
            const right = trimHighlightToRange(
              highlight,
              { start: selectionRange.end, end: range.end },
              activeLessonPlainText,
            );

            await annotations.deleteHighlight.mutateAsync({ highlightId: highlight.id });

            if (left) {
              await annotations.highlight.mutateAsync(
                buildHighlightInputFromStoredHighlight(left, activeBinderId, activeLessonId),
              );
            }

            if (right) {
              await annotations.highlight.mutateAsync(
                buildHighlightInputFromStoredHighlight(right, activeBinderId, activeLessonId),
              );
            }
          }),
        );

        await annotations.highlight.mutateAsync(
          buildHighlightInputFromSelection(selection, color, activeBinderId, activeLessonId),
        );
      }).catch(() => undefined);
    },
    onRemoveHighlight: (selection, highlightIds) => {
      if (!binderId || !selectedLesson || !profile) {
        return;
      }

      const activeBinderId = binderId;
      const activeLessonId = selectedLesson.id;
      const activeLessonPlainText = lessonPlainText;
      const operationScopeKey = `highlight:${activeBinderId}:${activeLessonId}:${profile.id}`;

      void runQueuedHighlightOperation(operationScopeKey, async () => {
        const rawLessonHighlights = readCurrentHighlights(activeBinderId).filter(
          (highlight) => highlight.lesson_id === activeLessonId,
        );
        const matches =
          highlightIds.length > 0
            ? rawLessonHighlights.filter((highlight) => highlightIds.includes(highlight.id))
            : rawLessonHighlights.filter((highlight) => selectionMatchesHighlight(selection, highlight));
        const selectionRange = getSelectionRange(selection);

        await Promise.all(
          matches.map(async (highlight) => {
            const range = getHighlightRange(highlight);
            if (!range) {
              await annotations.deleteHighlight.mutateAsync({ highlightId: highlight.id });
              return;
            }

            const left = trimHighlightToRange(
              highlight,
              { start: range.start, end: selectionRange.start },
              activeLessonPlainText,
            );
            const right = trimHighlightToRange(
              highlight,
              { start: selectionRange.end, end: range.end },
              activeLessonPlainText,
            );

            await annotations.deleteHighlight.mutateAsync({ highlightId: highlight.id });

            if (left) {
              await annotations.highlight.mutateAsync(
                buildHighlightInputFromStoredHighlight(left, activeBinderId, activeLessonId),
              );
            }

            if (right) {
              await annotations.highlight.mutateAsync(
                buildHighlightInputFromStoredHighlight(right, activeBinderId, activeLessonId),
              );
            }
          }),
        );
      }).catch(() => undefined);
    },
    onSaveSelectionAsEvidence: (selection) => {
      void saveSelectionAsEvidence(selection);
    },
    onStickyMove: (_commentId, layout) => {
      updateWorkspace((current) => ({
        ...current,
        stickyNotes: {
          ...current.stickyNotes,
          [_commentId]: layout,
        },
      }));
    },
    onSendStickyToNotes: handleSendStickyToNotes,
    onAcceptMathSuggestion: (suggestion) => {
      setDismissedMath((current) => [...current, suggestion.key]);
      if (suggestion.kind === "latex") {
        updateNoteMathDraft((current) => appendMathBlock(current, suggestion.source));
        return;
      }

      updateNoteMathDraft((current) => appendGraphBlock(current, suggestion.source));
      pushExpressionToGraph(suggestion.source);
    },
    onGraphMathSuggestion: (suggestion) => {
      setDismissedMath((current) => [...current, suggestion.key]);
      updateNoteMathDraft((current) => appendGraphBlock(current, suggestion.source));
      pushExpressionToGraph(suggestion.source);
    },
    onDismissMathSuggestion: (key) => {
      setDismissedMath((current) => [...current, key]);
    },
    onSendSelectionToNotes: handleSendSelectionToNotes,
    onCreateQuoteExcerpt: handleCreateQuoteExcerpt,
    onInsertCallout: () =>
      queueNoteInsert({ kind: "callout", title: "Callout", body: "Capture the key idea here." }),
    onInsertChecklist: () =>
      queueNoteInsert({ kind: "checklist", items: ["Review", "Explain", "Test yourself"] }),
    onInsertDefinition: () =>
      queueNoteInsert({
        kind: "definition",
        term: "Definition",
        meaning: "Explain the idea in your own words.",
        whyItMatters: "Why does this definition matter in the lesson?",
      }),
    onInsertTheorem: () =>
      queueNoteInsert({
        kind: "theorem",
        title: "Theorem",
        statement: "State the theorem clearly.",
        conditions: "List the conditions that make it usable.",
      }),
    onInsertProof: () =>
      queueNoteInsert({
        kind: "proof",
        claim: "Claim",
        strategy: "What is the proof idea?",
        steps: [
          "State what is given.",
          "Move through the argument one justified step at a time.",
          "Mark the hinge step where the conclusion becomes inevitable.",
        ],
        conclusion: "Restate the claim in its final proved form.",
      }),
    onInsertFormulaReference: () => {
      queueNoteInsert({
        kind: "formula-reference",
        title: "Formula reference",
        formula: "Write the formula here.",
        useCase: "When should you use it?",
      });
      updateNoteMathDraft((current) => appendMathBlock(current));
    },
    onInsertGraphNote: () => {
      queueNoteInsert({
        kind: "graph-note",
        title: "Graph note",
        focus: "What feature or relationship should you watch for?",
        observation: "What does the graph tell you?",
      });
      updateNoteMathDraft((current) => appendGraphBlock(current));
      ensureMathWorkspaceVisible({ enterLayoutWhenAdded: true });
    },
    onInsertWorkedExample: () =>
      queueNoteInsert({
        kind: "worked-example",
        title: "Worked example",
        steps: [
          "State the problem in your own words.",
          "Work the key steps in order.",
          "Write the answer clearly.",
        ],
        takeaway: "What pattern should you remember from this example?",
      }),
    onInsertMathBlock: () => updateNoteMathDraft((current) => appendMathBlock(current)),
    onInsertGraphBlock: () => {
      updateNoteMathDraft((current) => appendGraphBlock(current));
      ensureMathWorkspaceVisible({ enterLayoutWhenAdded: true });
    },
    onNoteInsertApplied: (id) => {
      setNoteInsertRequest((current) => (current?.id === id ? null : current));
    },
    onJumpToHighlight: (highlightId) => jumpToHighlight(highlightId),
    onJumpToMathSource: jumpToMathSource,
    onOpenGraphBlock: openGraphBlock,
    onSelectHistoryEvent: selectHistoryEvent,
    onSelectHistorySource: selectHistorySource,
    onReplayHistoryTimeline: replayHistoryTimeline,
    onCreateHistoryStarterEvent: () => {
      void createHistoryStarterEvent();
    },
    onCreateHistoryEvidenceFromSource: (source) => {
      void createHistoryEvidenceFromSource(source);
    },
    onUseHistorySourceInArgument: useHistorySourceInArgument,
    onCreateHistoryStarterChain: () => {
      void createHistoryStarterChain();
    },
    onUpdateHistoryArgumentChain: (chainId, patch) => {
      void updateHistoryArgumentChain(chainId, patch);
    },
    onUseHistoryEvidencePrompt: useHistoryEvidencePrompt,
    onCreateHistoryMythCheck: () => {
      void createHistoryMythCheck();
    },
  };

  const mobileModules = active.enabledModules.filter(
    (moduleId) => Boolean(workspaceModuleRegistry[moduleId]),
  );
  const mobileActiveModule =
    workspaceModuleRegistry[mobileModule] ?? workspaceModuleRegistry[mobileModules[0]];

  return (
    <main className="workspace-page" ref={workspaceRootRef}>
      <Breadcrumbs
        items={[
          { label: "Workspace", to: "/dashboard" },
          ...(primaryFolder ? [{ label: primaryFolder.name, to: `/folders/${primaryFolder.id}` }] : []),
          { label: binderQuery.data.binder.title, to: `/binders/${binderQuery.data.binder.id}` },
          { label: selectedLesson.title },
        ]}
      />

      <section
        className="workspace-topbar"
        data-utility-ui={showUtilityUi ? "true" : "false"}
      >
        <div className="workspace-topbar__summary">
          <p className="workspace-topbar__eyebrow">
            {binderQuery.data.binder.title}
          </p>
          <h1 className="workspace-topbar__title">{selectedLesson.title}</h1>
          <p className="workspace-topbar__copy">
            {workspaceModeLabel}
            {" • "}
            {active.activeMode === "simple" ? "Learning module" : currentPresetLabel}
            {" • "}
            {isLayoutEditing
              ? "Layout editing"
              : active.activeMode === "simple"
                ? "Simple study"
                : active.locked
                  ? "Locked study mode"
                  : "Studio mode"}
          </p>
          {showUtilityUi ? (
              <div className="workspace-topbar__meta">
                <Badge variant="outline">Study workspace</Badge>
                <Badge variant="secondary">
                  {isLayoutEditing ? "Edit mode" : active.locked ? "Locked" : "Studio"}
                </Badge>
                <Badge variant="outline">
                  {noteSaveLabel}
                </Badge>
              </div>
            ) : null}
        </div>
        <div
          className="workspace-topbar__presets"
          data-visible={showUtilityUi ? "true" : "false"}
        >
          {workspacePresets.map((preset) => (
            <button
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active.preset === preset.id
                  ? "border-primary bg-accent/80 text-foreground shadow-sm"
                  : "border-border/70 bg-background/70 text-muted-foreground hover:border-primary/35 hover:text-foreground"
              }`}
              key={preset.id}
              onClick={() => applyWorkspacePreset(preset.id)}
              type="button"
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div className="workspace-topbar__actions">
          <Button asChild size="sm" type="button" variant="outline">
            <Link aria-label="Workspace home" to="/dashboard">
              <Home data-icon="inline-start" />
              Workspace
            </Link>
          </Button>
          <Button
            onClick={toggleFocusMode}
            size="sm"
            type="button"
            variant={activeFocusMode ? "default" : "outline"}
          >
            {activeFocusMode ? (
              <Minimize2 data-icon="inline-start" />
            ) : (
              <Maximize2 data-icon="inline-start" />
            )}
            {activeFocusMode ? "Exit focus" : active.activeMode === "simple" ? "Focus" : "Focus canvas"}
          </Button>
          {!isLayoutEditing ? (
            <Button
              onClick={() => setPreferencesOpen((current) => !current)}
              size="sm"
              type="button"
              variant={preferencesOpen ? "default" : "outline"}
            >
              <SlidersHorizontal data-icon="inline-start" />
              Settings
            </Button>
          ) : null}
          {!isLayoutEditing ? (
            <Button
              onClick={enterLayoutEditMode}
              size="sm"
              type="button"
              variant="outline"
            >
              <LayoutPanelLeft data-icon="inline-start" />
              {active.activeMode === "simple"
                ? "Change view"
                : active.activeMode === "modular"
                  ? "Adjust panels"
                  : "Edit layout"}
            </Button>
          ) : (
            <>
              <Button onClick={saveUnlockedLayout} size="sm" type="button" variant="outline">
                <Save data-icon="inline-start" />
                Save
              </Button>
              <Button onClick={lockWorkspaceLayout} size="sm" type="button">
                <Lock data-icon="inline-start" />
                Lock
              </Button>
              <Button onClick={cancelLayoutEditing} size="sm" type="button" variant="ghost">
                <Unlock data-icon="inline-start" />
                Cancel
              </Button>
              <Button onClick={resetWorkspaceLayout} size="sm" type="button" variant="ghost">
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
            </>
          )}
          <Button onClick={() => void createSticky(null, "")} size="sm" type="button" variant="outline">
            <StickyNote data-icon="inline-start" />
            New sticky
          </Button>
        </div>
      </section>

      {!active.styleChoiceCompleted ? (
        <section className="grid gap-3 rounded-[22px] border border-border/70 bg-card/90 p-5 shadow-soft">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Choose your study view
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Start with the amount of workspace control that feels right.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Simple View keeps the lesson calm and full-screen. Study Panels gives you structured modules.
              Canvas opens the advanced movable workspace. You can switch later in settings.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {workspaceModeOptions.map((option) => (
              <button
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  active.activeMode === option.id
                    ? "border-primary bg-accent/75"
                    : "border-border/70 bg-background/65 hover:border-primary/35 hover:bg-secondary/70"
                }`}
                key={option.id}
                onClick={() => applyModeChoice(option.id)}
                type="button"
              >
                <p className="text-sm font-semibold">{option.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {active.activeMode === "simple" ? (
        <section className="simple-presentation-stage">
          {preferencesOpen ? (
            <>
              <button
                aria-label="Close simple settings"
                className="workspace-preferences-backdrop"
                onClick={() => setPreferencesOpen(false)}
                type="button"
              />
              <section className="workspace-preferences-popover">
                <SimpleSettingsPanel
                  onChange={(next) => workspace.commit(next)}
                  onClose={() => setPreferencesOpen(false)}
                  preferences={active}
                />
              </section>
            </>
          ) : null}
          <WorkspaceRenderBoundary
            resetKey={`${selectedLesson.id}:${active.updatedAt}:simple`}
            title="This simple study view could not render"
          >
            <SimplePresentationShell
              context={context}
              onChange={(next) => workspace.commit(next)}
              onOpenSettings={() => setPreferencesOpen(true)}
              preferences={active}
            />
          </WorkspaceRenderBoundary>
        </section>
      ) : isCompact ? (
        <section className="grid gap-4">
          {isLayoutEditing ? (
            <WorkspaceSettings
              binderTitle={binderQuery.data.binder.title}
              isResettingHighlights={annotations.resetHighlights.isPending}
              lessonTitle={selectedLesson.title}
              mode="layout"
              onResetBinderHighlights={resetBinderHighlights}
              onResetLessonHighlights={resetCurrentLessonHighlights}
              preferences={active}
              onChange={(next) => workspace.updateDraft(() => next)}
            />
          ) : null}

          {!isLayoutEditing && preferencesOpen ? (
            <WorkspaceSettings
              binderTitle={binderQuery.data.binder.title}
              isResettingHighlights={annotations.resetHighlights.isPending}
              lessonTitle={selectedLesson.title}
              mode="preferences"
              onChange={(next) => workspace.commit(next)}
              onClose={() => setPreferencesOpen(false)}
              onResetBinderHighlights={resetBinderHighlights}
              onResetLessonHighlights={resetCurrentLessonHighlights}
              preferences={active}
            />
          ) : null}

          <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-card/86 p-3 shadow-sm">
            {mobileModules.map((moduleId) => (
              <Button
                key={moduleId}
                onClick={() => setMobileModule(moduleId)}
                size="sm"
                type="button"
                variant={mobileModule === moduleId ? "default" : "outline"}
              >
                {workspaceModuleRegistry[moduleId]?.title ?? moduleId}
              </Button>
            ))}
          </div>

          {mobileActiveModule ? (
            <WorkspaceRenderBoundary
              resetKey={selectedLesson.id}
              title="This study module could not render"
            >
              <div className="min-h-0">{mobileActiveModule.render(context)}</div>
            </WorkspaceRenderBoundary>
          ) : (
            <EmptyState
              description="Enable a module or pick a preset to continue."
              title="No mobile module available"
            />
          )}
        </section>
      ) : (
        <section className="workspace-stage-shell">
          {!isLayoutEditing && preferencesOpen ? (
            <>
              <button
                aria-label="Close workspace settings"
                className="workspace-preferences-backdrop"
                onClick={() => setPreferencesOpen(false)}
                type="button"
              />
              <section className="workspace-preferences-popover">
                <WorkspaceSettings
                  binderTitle={binderQuery.data.binder.title}
                  isResettingHighlights={annotations.resetHighlights.isPending}
                  lessonTitle={selectedLesson.title}
                  mode="preferences"
                  onChange={(next) => workspace.commit(next)}
                  onClose={() => setPreferencesOpen(false)}
                  onResetBinderHighlights={resetBinderHighlights}
                  onResetLessonHighlights={resetCurrentLessonHighlights}
                  preferences={active}
                />
              </section>
            </>
          ) : null}

          <section className={`workspace-stage ${isLayoutEditing ? "" : "workspace-stage-locked"}`}>
            {isLayoutEditing ? (
              <WorkspaceSettings
                binderTitle={binderQuery.data.binder.title}
                isResettingHighlights={annotations.resetHighlights.isPending}
                lessonTitle={selectedLesson.title}
                mode="layout"
                onResetBinderHighlights={resetBinderHighlights}
                onResetLessonHighlights={resetCurrentLessonHighlights}
                preferences={active}
                onChange={(next) => workspace.updateDraft(() => next)}
              />
            ) : null}
            <WorkspaceRenderBoundary
              resetKey={`${selectedLesson.id}:${active.updatedAt}`}
              title="This document workspace could not render"
            >
              <WindowedWorkspace
                context={context}
                mode={isLayoutEditing ? "setup" : "study"}
                onCommitFrame={(moduleId: WorkspaceModuleId, frame: WorkspaceWindowFrame) =>
                  updateWorkspace((current) => ({
                    ...current,
                    canvas:
                      current.activeMode === "canvas"
                        ? {
                            ...current.canvas,
                            panelPositions: {
                              ...current.canvas.panelPositions,
                              [moduleId]: frame,
                            },
                          }
                        : current.canvas,
                    windowLayout: {
                      ...current.windowLayout,
                      [moduleId]: frame,
                    },
                  }))
                }
                onFitViewport={(viewport) =>
                  updateWorkspace((current) => fitWorkspaceToViewport(current, viewport))
                }
                onToggleCollapsed={(moduleId: WorkspaceModuleId, collapsed: boolean) =>
                  updateWorkspace((current) => ({
                    ...current,
                    moduleLayout: {
                      ...current.moduleLayout,
                      [moduleId]: {
                        ...current.moduleLayout[moduleId],
                        span: current.moduleLayout[moduleId]?.span ?? "auto",
                        collapsed,
                      },
                    },
                  }))
                }
                preferences={active}
              />
            </WorkspaceRenderBoundary>
          </section>
        </section>
      )}
    </main>
  );
}

function useCompactWorkspace() {
  const [compact, setCompact] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < 1100,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(max-width: 1099px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
}

function serializeNoteSnapshot(title: string, content: JSONContent, mathBlocks: MathBlock[]) {
  return JSON.stringify({
    title,
    content,
    mathBlocks,
  });
}

function getLearnerNoteSaveErrorMessage(caught: unknown) {
  const fallback = "Private notes could not be saved right now.";
  const message = caught instanceof Error ? caught.message : fallback;

  if (
    message.includes("learner_notes_binder_id_fkey") ||
    message.includes("learner_notes_lesson_id_fkey")
  ) {
    return "This lesson is not available in live storage yet. Refresh once and try again.";
  }

  if (message.toLowerCase().includes("row-level security")) {
    return "Your session could not write this note. Sign in again and try once more.";
  }

  if (
    message.toLowerCase().includes("refresh token") ||
    message.toLowerCase().includes("jwt") ||
    message.toLowerCase().includes("auth session missing")
  ) {
    return "Your session expired before this note could save. Sign in again and retry.";
  }

  if (
    message.toLowerCase().includes("failed to fetch") ||
    message.toLowerCase().includes("network")
  ) {
    return "Connection was interrupted while saving. Retry once you're back online.";
  }

  return message;
}
