import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Home,
  Maximize2,
  Minimize2,
  Magnet,
  LayoutPanelLeft,
  Lock,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
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
import { useMathWorkspace, type GraphMode } from "@/hooks/use-math-workspace";
import { useResponsiveDevice } from "@/hooks/use-responsive-device";
import { useSaveStatus } from "@/hooks/use-save-status";
import { useTheme } from "@/hooks/use-theme";
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
import { extractPlainText, isWorkspaceContainerId } from "@/lib/workspace-records";
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
  applyFocusModeToViewport,
  applyGlobalAppearanceToWorkspace,
  applyWorkspaceModeToViewport,
  applyPresetToViewport,
  createStickyNoteLayout,
  ensureMathWorkspaceModules,
  ensureWindowFramesForEnabledModules,
  fitWorkspaceToViewport,
  getTopbarWorkspacePresetRecommendations,
  tidyWorkspaceLayout as tidyWorkspaceToViewport,
  updateWorkspaceAppearance,
  workspacePresets,
  workspaceModeOptions,
} from "@/lib/workspace-preferences";
import { getWorkspaceMobileModuleTabs } from "@/lib/workspace-preset-designs";
import {
  getWorkspaceModuleMinimumSize,
  WORKSPACE_MAX_CANVAS_HEIGHT,
} from "@/lib/workspace-layout-engine";
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

type WorkspaceCanvasView = {
  height: number;
  scrollLeft: number;
  scrollTop: number;
  width: number;
};

export function BinderReaderPage() {
  const { binderId, lessonId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { globalTheme, setGlobalTheme } = useTheme();
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
    graphMode?: GraphMode;
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
  const handledWhiteboardOpenIntentRef = useRef<string | null>(null);
  const pendingNoteSaveRef = useRef<PendingNoteSave | null>(null);
  const retryNoteSaveRef = useRef<PendingNoteSave | null>(null);
  const noteSaveTimerRef = useRef<number | null>(null);
  const noteMutationRef = useRef(noteMutation.mutateAsync);
  const noteSaveActiveRef = useRef(false);
  const noteScopeHydratedRef = useRef(false);
  const noteHasLocalEditsRef = useRef(false);
  const activeNoteScopeRef = useRef("");
  const latestVisibleNoteDraftRef = useRef<PendingNoteSave | null>(null);
  const submittedNoteSnapshotRef = useRef<{ scopeKey: string; snapshot: string } | null>(null);

  const responsiveDevice = useResponsiveDevice();
  const isCompact = !responsiveDevice.isDesktop;
  const syncedSnapshotRef = useRef("");
  const active = workspace.active;
  const isSimpleMode = active?.activeMode === "simple";
  const isCanvasMode = active?.activeMode === "canvas";
  const isLayoutEditing = layoutMode === "setup" && isCanvasMode;
  const isLayoutEditingRef = useRef(isLayoutEditing);
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

  useEffect(() => {
    isLayoutEditingRef.current = isLayoutEditing;
  }, [isLayoutEditing]);
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
  const activeFolderId = useMemo(() => {
    const folderId = binderQuery.data?.folderLinks[0]?.folder_id ?? null;
    if (!folderId || isWorkspaceContainerId(folderId)) {
      return null;
    }

    return binderQuery.data?.folders.some((folder) => folder.id === folderId) ? folderId : null;
  }, [binderQuery.data?.folderLinks, binderQuery.data?.folders]);
  const defaultHighlightColor: HighlightColor = active?.theme.defaultHighlightColor ?? "yellow";
  const commitWorkspacePreferences = useCallback(
    (next: WorkspacePreferences) => {
      const previous = workspace.draft ?? active;

      if (!next.appearance.saveLocalAppearance) {
        if (previous && appearanceColorsChanged(previous, next)) {
          setGlobalTheme(next.theme);
          return workspace.commit(applyGlobalAppearanceToWorkspace(next, next.theme));
        }

        return workspace.commit(applyGlobalAppearanceToWorkspace(next, globalTheme));
      }

      return workspace.commit(next);
    },
    [active, globalTheme, setGlobalTheme, workspace],
  );
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
  const { state: mathState, setGraphExpanded, setGraphVisible, setGraphMode, savedFunctionMap, ...mathController } =
    mathWorkspace;

  const updateWorkspace = useCallback(
    (updater: (current: WorkspacePreferences) => WorkspacePreferences) => {
      if (!active) {
        return;
      }

      const editingLayoutNow = isLayoutEditingRef.current || isLayoutEditing;

      if (!editingLayoutNow) {
        const next = ensureWindowFramesForEnabledModules(updater(active));
        commitWorkspacePreferences(next);
        return;
      }

      const editableDraft = {
        ...(workspace.draft ?? active),
        locked: false,
      };
      const next = ensureWindowFramesForEnabledModules(updater(editableDraft));
      let nextDraft = {
        ...next,
        locked: false,
        updatedAt: new Date().toISOString(),
      };

      if (!nextDraft.appearance.saveLocalAppearance && appearanceColorsChanged(editableDraft, nextDraft)) {
        setGlobalTheme(nextDraft.theme);
        nextDraft = applyGlobalAppearanceToWorkspace(nextDraft, nextDraft.theme);
      }

      workspace.updateDraft(() => nextDraft);
    },
    [active, commitWorkspacePreferences, isLayoutEditing, setGlobalTheme, workspace],
  );

  const updateLayoutDraftFromSettings = useCallback(
    (next: WorkspacePreferences) => {
      const previous = workspace.draft ?? active;
      let nextDraft = {
        ...next,
        locked: false,
        updatedAt: new Date().toISOString(),
      };

      if (previous && !nextDraft.appearance.saveLocalAppearance && appearanceColorsChanged(previous, nextDraft)) {
        setGlobalTheme(nextDraft.theme);
        nextDraft = applyGlobalAppearanceToWorkspace(nextDraft, nextDraft.theme);
      }

      workspace.updateDraft(() => nextDraft);
    },
    [active, setGlobalTheme, workspace],
  );

  const enterLayoutEditMode = useCallback(() => {
    if (!active) {
      return;
    }

    if (active.activeMode !== "canvas") {
      setPreferencesOpen(true);
      return;
    }

    isLayoutEditingRef.current = true;
    setLayoutMode("setup");
    workspace.updateDraft((current) => ({
      ...current,
      locked: false,
      updatedAt: new Date().toISOString(),
    }));
  }, [active, workspace]);

  const saveUnlockedLayout = useCallback(() => {
    isLayoutEditingRef.current = true;
    workspace.saveUnlocked();
    setLayoutMode("setup");
  }, [workspace]);

  const lockWorkspaceLayout = useCallback(() => {
    const current = workspace.draft ?? active;
    if (!current) {
      return;
    }

    const viewport = readWorkspaceViewport(workspaceRootRef.current);
    const updatedAt = new Date().toISOString();
    isLayoutEditingRef.current = false;
    commitWorkspacePreferences({
      ...current,
      locked: true,
      viewportFit: {
        width: viewport.width,
        height: viewport.height,
        updatedAt,
      },
      updatedAt,
    });
    setLayoutMode("study");
  }, [active, commitWorkspacePreferences, workspace]);

  const cancelLayoutEditing = useCallback(() => {
    const shouldRemainInSetup = workspace.saved?.activeMode === "canvas" && workspace.saved?.locked === false;
    isLayoutEditingRef.current = shouldRemainInSetup;
    workspace.cancel();
    setLayoutMode(shouldRemainInSetup ? "setup" : "study");
  }, [workspace]);

  const getWorkspaceViewport = useCallback(() => {
    return readWorkspaceViewport(workspaceRootRef.current);
  }, []);

  const getWorkspaceCanvasView = useCallback((): WorkspaceCanvasView => {
    const shell = workspaceRootRef.current?.querySelector(".workspace-canvas-shell");
    if (shell instanceof HTMLElement && shell.clientWidth > 0 && shell.clientHeight > 0) {
      return {
        width: shell.clientWidth,
        height: shell.clientHeight,
        scrollLeft: shell.scrollLeft,
        scrollTop: shell.scrollTop,
      };
    }

    return {
      width: window.innerWidth,
      height: Math.max(360, window.innerHeight - 168),
      scrollLeft: 0,
      scrollTop: 0,
    };
  }, []);

  const resetWorkspaceLayout = useCallback(() => {
    const viewport = getWorkspaceViewport();
    updateWorkspace((current) => applyPresetToViewport(current, current.preset, viewport));
    setLayoutMode("setup");
  }, [getWorkspaceViewport, updateWorkspace]);

  const applyWorkspacePreset = useCallback(
    (presetId: WorkspacePresetId) => {
      const viewport = getWorkspaceViewport();
      updateWorkspace((current) => applyPresetToViewport(current, presetId, viewport));
    },
    [getWorkspaceViewport, updateWorkspace],
  );

  useEffect(() => {
    if (!active || !binderId || !selectedLesson || searchParams.get("open") !== "whiteboard") {
      return;
    }

    const intentKey = `${binderId}:${selectedLesson.id}:whiteboard`;
    if (handledWhiteboardOpenIntentRef.current === intentKey) {
      return;
    }

    handledWhiteboardOpenIntentRef.current = intentKey;
    const viewport = getWorkspaceViewport();
    updateWorkspace((current) => {
      const canvasWorkspace =
        current.activeMode === "canvas"
          ? current
          : applyWorkspaceModeToViewport(current, "canvas", viewport);

      return applyPresetToViewport(canvasWorkspace, "math-practice-mode", viewport);
    });

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("open");
    setSearchParams(nextSearchParams, { replace: true });
  }, [
    active,
    binderId,
    getWorkspaceViewport,
    searchParams,
    selectedLesson,
    setSearchParams,
    updateWorkspace,
  ]);

  const fitWorkspaceToScreen = useCallback(() => {
    if (!active || active.activeMode === "simple") {
      return;
    }

    const viewport = getWorkspaceViewport();
    updateWorkspace((current) => fitWorkspaceToViewport(current, viewport, { force: true }));
  }, [active, getWorkspaceViewport, updateWorkspace]);

  const tidyWorkspaceLayout = useCallback(() => {
    if (!active || active.activeMode === "simple") {
      return;
    }

    const viewport = getWorkspaceViewport();
    updateWorkspace((current) => tidyWorkspaceToViewport(current, viewport));
  }, [active, getWorkspaceViewport, updateWorkspace]);

  const addCanvasSpaceBelow = useCallback(() => {
    if (!active || active.activeMode !== "canvas") {
      return;
    }

    const viewport = getWorkspaceViewport();
    updateWorkspace((current) => {
      const frameBottom = Math.max(
        viewport.height,
        ...Object.values(current.windowLayout).map((frame) =>
          frame ? frame.y + frame.h : 0,
        ),
      );
      return {
        ...current,
        canvas: {
          ...current.canvas,
          canvasHeight: Math.max(current.canvas.canvasHeight, frameBottom + 960),
        },
        theme: {
          ...current.theme,
          verticalSpace: "infinite",
        },
      };
    });
  }, [active, getWorkspaceViewport, updateWorkspace]);

  const toggleCanvasSnapMode = useCallback(() => {
    if (!active || active.activeMode !== "canvas") {
      return;
    }

    updateWorkspace((current) => {
      const nextSnapBehavior = current.canvas.snapBehavior === "off" ? "modules" : "off";
      return {
        ...current,
        canvas: {
          ...current.canvas,
          snapBehavior: nextSnapBehavior,
        },
        theme: {
          ...current.theme,
          snapMode: nextSnapBehavior !== "off",
        },
      };
    });
  }, [active, updateWorkspace]);

  const toggleSafeEdgePadding = useCallback(() => {
    if (!active || active.activeMode !== "canvas") {
      return;
    }

    updateWorkspace((current) => ({
      ...current,
      canvas: {
        ...current.canvas,
        safeEdgePadding: !current.canvas.safeEdgePadding,
      },
    }));
  }, [active, updateWorkspace]);

  const openWorkspaceModule = useCallback(
    (moduleId: WorkspaceModuleId) => {
      if (!active || active.activeMode !== "canvas") {
        return;
      }

      const view = getWorkspaceCanvasView();
      updateWorkspace((current) => {
        const enabledModules = current.enabledModules.includes(moduleId)
          ? current.enabledModules
          : [...current.enabledModules, moduleId];
        const next = ensureWorkspaceModuleVisibleOnCanvas(
          {
            ...current,
            enabledModules,
            canvas: {
              ...current.canvas,
              customModules: current.canvas.customModules.includes(moduleId)
                ? current.canvas.customModules
                : [...current.canvas.customModules, moduleId],
            },
            moduleLayout: {
              ...current.moduleLayout,
              [moduleId]: {
                ...current.moduleLayout[moduleId],
                span: current.moduleLayout[moduleId]?.span ?? "auto",
                collapsed: false,
              },
            },
          },
          moduleId,
          view,
        );

        return next;
      });
    },
    [active, getWorkspaceCanvasView, updateWorkspace],
  );

  const toggleWorkspaceModuleCollapsed = useCallback(
    (moduleId: WorkspaceModuleId, collapsed: boolean) => {
      const view = getWorkspaceCanvasView();
      updateWorkspace((current) => {
        const next: WorkspacePreferences = {
          ...current,
          moduleLayout: {
            ...current.moduleLayout,
            [moduleId]: {
              ...current.moduleLayout[moduleId],
              span: current.moduleLayout[moduleId]?.span ?? "auto",
              collapsed,
            },
          },
        };

        return collapsed
          ? next
          : ensureWorkspaceModuleVisibleOnCanvas(next, moduleId, view);
      });
    },
    [getWorkspaceCanvasView, updateWorkspace],
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
        commitWorkspacePreferences(next);
        setPreferencesOpen(true);
      } else if (isLayoutEditing) {
        workspace.updateDraft(() => ({
          ...next,
          locked: false,
        }));
      } else {
        commitWorkspacePreferences(next);
      }

      return true;
    },
    [active, commitWorkspacePreferences, isLayoutEditing, workspace],
  );

  const ensureNotesVisible = useCallback(() => {
    const viewport = getWorkspaceViewport();
    updateWorkspace((current) =>
      current.enabledModules.includes("private-notes")
        ? current
        : applyPresetToViewport(current, "split-study", viewport),
    );
  }, [getWorkspaceViewport, updateWorkspace]);

  const enterNotebookFocus = useCallback(() => {
    const viewport = getWorkspaceViewport();
    updateWorkspace((current) => {
      const next = applyPresetToViewport(current, "notes-focus", viewport);
      return {
        ...next,
        theme: {
          ...next.theme,
          focusMode: true,
        },
      };
    });
  }, [getWorkspaceViewport, updateWorkspace]);

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
      const viewport = getWorkspaceViewport();
      updateWorkspace((current) => applyPresetToViewport(current, "history-timeline-focus", viewport));
    }
  }, [active?.preset, getWorkspaceViewport, historyData?.events, historyData?.templateEvents, updateWorkspace]);

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
      const viewport = getWorkspaceViewport();
      updateWorkspace((current) => applyPresetToViewport(current, "history-argument-builder", viewport));
    },
    [getWorkspaceViewport, updateWorkspace],
  );

  const createHistoryStarterChain = useCallback(async () => {
    if (!profile || !binderId || !selectedLesson) {
      return;
    }

    await saveQueue.run({
      entityType: "history_argument",
      scopeKey: `history-argument:${binderId}:${profile.id}`,
      runner: async () => {
        const isRomeBinder = binderId === "binder-rise-of-rome";
        const isRussianBinder = binderId === "binder-russian-revolution";
        const starterDraft = isRomeBinder
          ? {
              prompt: "How did Rome's republic transform into an empire?",
              thesis:
                "Rome's imperial system grew out of expansion, elite rivalry, military loyalty, and civil war rather than a smooth constitutional handoff.",
              context:
                "Use the timeline to connect republican offices, Mediterranean expansion, reform conflict, Caesar, and Augustus.",
              counterargument:
                "A size-only explanation misses how social inequality, army politics, and elite competition changed the republic from within.",
              conclusion:
                "The strongest answer shows how overseas power created pressures that republican institutions could not absorb without one-man rule.",
            }
          : isRussianBinder
            ? {
                prompt: "Why did imperial Russia collapse and Bolshevik power survive?",
                thesis:
                  "The Russian Revolution grew from autocracy, land hunger, industrial unrest, war collapse, and Bolshevik organization converging during a legitimacy crisis.",
                context:
                  "Use the timeline to connect 1861, 1905, World War I, February, dual power, October, civil war, NEP, and USSR formation.",
                counterargument:
                  "A war-only explanation misses the older land, labor, nationality, and institutional problems that made wartime failure revolutionary.",
                conclusion:
                  "The strongest answer shows why February destroyed the monarchy but October and civil war created a very different one-party state.",
              }
          : {
              prompt: "What were the most important causes of the French Revolution?",
              thesis:
                "The French Revolution was caused not by one event, but by the combination of financial crisis, social inequality, and Enlightenment political ideas.",
              context:
                "Use chronology to show why structural problems became a political revolution in 1789.",
              counterargument:
                "Some explanations overstate one cause, such as bread prices, and miss the broader crisis.",
              conclusion:
                "The strongest answer shows how economic stress, representation disputes, and political ideas intensified one another.",
            };
        const chain = await historyMutations.createArgumentChain.mutateAsync({
          binder_id: binderId,
          lesson_id: selectedLesson.id,
          prompt: starterDraft.prompt,
          thesis: starterDraft.thesis,
          context: starterDraft.context,
          counterargument: starterDraft.counterargument,
          conclusion: starterDraft.conclusion,
        });

        const starterTitles = isRomeBinder
          ? [
              "Mediterranean expansion",
              "Land and citizenship conflict",
              "Military loyalty shifts",
              "Caesar crosses the Rubicon",
              "Civil war settlement",
              "Augustus stabilizes one-man rule",
            ]
          : isRussianBinder
            ? [
                "Autocracy and land hunger",
                "Industrial unrest",
                "World War I breakdown",
                "February dual power",
                "Bolshevik strategy",
                "Civil war consolidation",
              ]
          : [
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
            body: isRomeBinder
              ? `Explain how ${title.toLowerCase()} pushes Rome toward imperial rule.`
              : isRussianBinder
                ? `Explain how ${title.toLowerCase()} pushes Russia from imperial crisis toward Bolshevik power.`
              : `Explain how ${title.toLowerCase()} pushes the revolution forward.`,
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

        applyWorkspacePreset("history-argument-builder");
        return chain;
      },
    });
  }, [
    binderId,
    historyMutations.createArgumentChain,
    historyMutations.createArgumentEdge,
    historyMutations.createArgumentNode,
    applyWorkspacePreset,
    profile,
    selectedLesson,
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
    applyWorkspacePreset("history-source-evidence");
  }, [applyWorkspacePreset]);

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
      const viewport = getWorkspaceViewport();
      updateWorkspace((current) => applyWorkspaceModeToViewport(current, workspaceMode, viewport));
      setPreferencesOpen(false);
    },
    [getWorkspaceViewport, updateWorkspace],
  );

  const toggleFocusMode = useCallback(() => {
    const viewport = getWorkspaceViewport();
    updateWorkspace((current) => {
      const nextFocusMode =
        current.activeMode === "simple" ? !current.simple.focusMode : !current.theme.focusMode;
      return applyFocusModeToViewport(current, nextFocusMode, viewport);
    });
  }, [getWorkspaceViewport, updateWorkspace]);

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
      setGraphMode("2d");
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
      setGraphMode,
      setGraphVisible,
    ],
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    const mobileTabIds = getWorkspaceMobileModuleTabs(
      active.preset,
      active.enabledModules.filter((moduleId) => Boolean(workspaceModuleRegistry[moduleId])),
    ).map((tab) => tab.moduleId);
    setMobileModule((current) => (mobileTabIds.includes(current) ? current : mobileTabIds[0] ?? "lesson"));
  }, [active]);

  const searchableLessons = useMemo(
    () =>
      lessons.map((lesson) => ({
        lesson,
        searchText: `${lesson.title} ${extractPlainText(lesson.content)}`
          .replace(/\s+/g, " ")
          .toLowerCase(),
      })),
    [lessons],
  );

  const filteredLessons = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) {
      return lessons;
    }

    return searchableLessons
      .filter(({ searchText }) => searchText.includes(normalized))
      .map(({ lesson }) => lesson);
  }, [deferredQuery, lessons, searchableLessons]);

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
    submittedNoteSnapshotRef.current = {
      scopeKey: pendingDraft.scopeKey,
      snapshot: serializeNoteSnapshot(
        pendingDraft.input.title,
        pendingDraft.input.content,
        pendingDraft.input.mathBlocks,
      ),
    };

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
    const isOwnSubmittedSaveEcho =
      submittedNoteSnapshotRef.current?.scopeKey === currentNoteScopeKey &&
      submittedNoteSnapshotRef.current.snapshot === currentSnapshot;

    if (
      currentNoteScopeKey === activeNoteScopeRef.current &&
      noteScopeHydratedRef.current &&
      noteHasLocalEditsRef.current &&
      currentDraft?.scopeKey === currentNoteScopeKey &&
      currentSnapshot !== syncedSnapshotRef.current &&
      nextSnapshot !== currentSnapshot &&
      !isOwnSubmittedSaveEcho
    ) {
      setNoteSaveError(
        "A newer saved version is available in another tab. Save this note to keep your current draft.",
      );
      return;
    }

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
  const hasPersistedCurrentNote = Boolean(noteId || noteLastSavedAt);
  const noteSaveLabel =
    autosaveStatus === "saving"
      ? "Saving..."
      : autosaveStatus === "offline"
        ? "Offline - keep this tab open"
        : autosaveStatus === "error"
          ? "Save failed"
          : autosaveStatus === "unsaved"
            ? "Unsaved changes"
          : noteLastSavedAt
            ? `Saved ${formatNoteSavedAt(noteLastSavedAt)}`
              : hasPersistedCurrentNote
                ? "Saved"
                : "Ready";
  const noteSaveDetail =
    autosaveStatus === "saving"
      ? "Saving this lesson note to your account now."
      : autosaveStatus === "offline"
        ? "You're offline. Keep this tab open so this note can sync when the connection returns."
        : autosaveStatus === "error"
          ? noteSaveError ?? "Save failed. Retry to keep this lesson note."
          : autosaveStatus === "unsaved"
            ? "You have unsaved changes in this lesson note."
            : noteLastSavedAt
              ? `Saved to your account at ${formatNoteSavedAt(noteLastSavedAt)}.`
              : hasPersistedCurrentNote
                ? "Saved to your account."
                : "No private note saved for this lesson yet.";
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
      setGraphMode(block.graphMode ?? "2d");
      setPendingExpression(null);
      setPendingGraphLoad({
        id: crypto.randomUUID(),
        expressions: block.expressions,
        graphMode: block.graphMode ?? "2d",
        viewport: {
          xMin: block.xMin,
          xMax: block.xMax,
          yMin: block.yMin,
          yMax: block.yMax,
        },
      });
    },
    [ensureMathWorkspaceVisible, setGraphMode, setGraphVisible],
  );

  const mathModules = useMemo(
    () => ({
      controller: {
        state: mathState,
        setGraphExpanded,
        setGraphMode,
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
      setGraphMode,
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
  const visibleTopbarPresets = getTopbarWorkspacePresetRecommendations(active, {
    binderSubject: binderQuery.data.binder.subject,
    historyEnabled,
  });
  const showTopbarUtilityUi = isLayoutEditing;
  const workspaceModeLabel =
    workspaceModeOptions.find((option) => option.id === active.activeMode)?.name ?? "Simple View";
  const activeFocusMode =
    active.activeMode === "simple" ? active.simple.focusMode : active.theme.focusMode;

  const context: WorkspaceModuleContext = {
    ownerId,
    binder: binderQuery.data.binder,
    lessons,
    selectedLesson,
    filteredLessons,
    binderNotebookEntries,
    binderNotebookSections,
    currentNotebookSection,
    query,
    noteTitle,
    noteId,
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

  const mobileTabs = getWorkspaceMobileModuleTabs(
    active.preset,
    active.enabledModules.filter((moduleId) => Boolean(workspaceModuleRegistry[moduleId])),
  );
  const mobileModules = mobileTabs.map((tab) => tab.moduleId);
  const mobileActiveModule =
    workspaceModuleRegistry[mobileModule] ?? workspaceModuleRegistry[mobileModules[0]];

  return (
    <main
      className="workspace-page"
      data-maximize-module-space={active.theme.compactMode ? "true" : "false"}
      data-viewport-category={responsiveDevice.category}
      data-workspace-active-focus={activeFocusMode ? "true" : "false"}
      data-workspace-preset={active.preset}
      ref={workspaceRootRef}
    >
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
        data-layout-editing={isLayoutEditing ? "true" : "false"}
        data-utility-ui={showTopbarUtilityUi ? "true" : "false"}
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
          {showTopbarUtilityUi ? (
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
        {showTopbarUtilityUi ? (
          <div
            className="workspace-topbar__presets"
            data-visible="true"
          >
            {visibleTopbarPresets.map((preset) => (
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
        ) : null}
        <div className="workspace-topbar__actions">
          {activeFocusMode ? (
            <Button onClick={toggleFocusMode} size="sm" type="button" variant="default">
              <Minimize2 data-icon="inline-start" />
              Exit focus
            </Button>
          ) : (
            <>
              <Button asChild size="sm" type="button" variant="outline">
                <Link aria-label="Workspace home" to="/dashboard">
                  <Home data-icon="inline-start" />
                  Workspace
                </Link>
              </Button>
              <Button onClick={toggleFocusMode} size="sm" type="button" variant="outline">
                <Maximize2 data-icon="inline-start" />
                {active.activeMode === "simple" ? "Focus" : "Focus canvas"}
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
                    Save layout
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
                    Reset to preset
                  </Button>
                  <Button onClick={addCanvasSpaceBelow} size="sm" type="button" variant="outline">
                    <Plus data-icon="inline-start" />
                    Add space below
                  </Button>
                  <Button
                    onClick={toggleCanvasSnapMode}
                    size="sm"
                    type="button"
                    variant={active.canvas.snapBehavior !== "off" ? "default" : "outline"}
                  >
                    <Magnet data-icon="inline-start" />
                    Snap {active.canvas.snapBehavior !== "off" ? "on" : "off"}
                  </Button>
                  <Button
                    onClick={toggleSafeEdgePadding}
                    size="sm"
                    type="button"
                    variant={active.canvas.safeEdgePadding ? "default" : "outline"}
                  >
                    <ShieldCheck data-icon="inline-start" />
                    Safe edge {active.canvas.safeEdgePadding ? "on" : "off"}
                  </Button>
                </>
              )}
              {active.activeMode !== "simple" ? (
                <>
                  <Button onClick={fitWorkspaceToScreen} size="sm" type="button" variant="outline">
                    <Maximize2 data-icon="inline-start" />
                    {isLayoutEditing ? "Fit visible" : "Fit"}
                  </Button>
                  <Button onClick={tidyWorkspaceLayout} size="sm" type="button" variant="outline">
                    <LayoutPanelLeft data-icon="inline-start" />
                    Tidy
                  </Button>
                  <Button onClick={toggleStickyManager} size="sm" type="button" variant="outline">
                    <StickyNote data-icon="inline-start" />
                    {stickyManagerVisible ? "Hide stickies" : "Sticky manager"}
                  </Button>
                </>
              ) : null}
              <Button onClick={() => void createSticky(null, "")} size="sm" type="button" variant="outline">
                <StickyNote data-icon="inline-start" />
                New sticky
              </Button>
            </>
          )}
        </div>
      </section>

      {workspace.saveError ? (
        <p
          className="rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          role="alert"
        >
          {workspace.saveError}
        </p>
      ) : null}

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
                  onChange={commitWorkspacePreferences}
                  onClose={() => setPreferencesOpen(false)}
                  preferences={active}
                />
              </section>
            </>
          ) : null}
          <WorkspaceRenderBoundary
            resetKey={`${selectedLesson.id}:${active.activeMode}:simple`}
            title="This simple study view could not render"
          >
            <SimplePresentationShell
              context={context}
              onChange={commitWorkspacePreferences}
              onOpenSettings={() => setPreferencesOpen(true)}
              preferences={active}
            />
          </WorkspaceRenderBoundary>
        </section>
      ) : isCompact ? (
        <section className="responsive-mobile-workspace grid gap-4">
          {isLayoutEditing ? (
            <WorkspaceSettings
              binderTitle={binderQuery.data.binder.title}
              binderSubject={binderQuery.data.binder.subject}
              historyEnabled={historyEnabled}
              isResettingHighlights={annotations.resetHighlights.isPending}
              lessonTitle={selectedLesson.title}
              mode="layout"
              onResetBinderHighlights={resetBinderHighlights}
              onResetLessonHighlights={resetCurrentLessonHighlights}
              preferences={active}
              onChange={updateLayoutDraftFromSettings}
            />
          ) : null}

          {!isLayoutEditing && preferencesOpen ? (
            <WorkspaceSettings
              binderTitle={binderQuery.data.binder.title}
              binderSubject={binderQuery.data.binder.subject}
              historyEnabled={historyEnabled}
              isResettingHighlights={annotations.resetHighlights.isPending}
              lessonTitle={selectedLesson.title}
              mode="preferences"
              onChange={commitWorkspacePreferences}
              onClose={() => setPreferencesOpen(false)}
              onResetBinderHighlights={resetBinderHighlights}
              onResetLessonHighlights={resetCurrentLessonHighlights}
              preferences={active}
            />
          ) : null}

          <div className="responsive-mobile-tabs flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-card/86 p-3 shadow-sm">
            {mobileTabs.map((tab) => (
              <Button
                key={tab.moduleId}
                onClick={() => setMobileModule(tab.moduleId)}
                size="sm"
                type="button"
                variant={mobileModule === tab.moduleId ? "default" : "outline"}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {mobileActiveModule ? (
            <WorkspaceRenderBoundary
              resetKey={selectedLesson.id}
              title="This study module could not render"
            >
              <div className="responsive-mobile-module min-h-0">
                {mobileActiveModule.render(context)}
              </div>
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
                  binderSubject={binderQuery.data.binder.subject}
                  historyEnabled={historyEnabled}
                  isResettingHighlights={annotations.resetHighlights.isPending}
                  lessonTitle={selectedLesson.title}
                  mode="preferences"
                  onChange={commitWorkspacePreferences}
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
                binderSubject={binderQuery.data.binder.subject}
                historyEnabled={historyEnabled}
                isResettingHighlights={annotations.resetHighlights.isPending}
                lessonTitle={selectedLesson.title}
                mode="layout"
                onResetBinderHighlights={resetBinderHighlights}
                onResetLessonHighlights={resetCurrentLessonHighlights}
                preferences={active}
                onChange={updateLayoutDraftFromSettings}
              />
            ) : null}
            <WorkspaceRenderBoundary
              resetKey={`${selectedLesson.id}:${active.activeMode}:${active.preset}`}
              title="This document workspace could not render"
            >
              <WindowedWorkspace
                context={context}
                mode={isLayoutEditing ? "setup" : "study"}
                onCanvasHeightChange={(canvasHeight) =>
                  updateWorkspace((current) => ({
                    ...current,
                    canvas: {
                      ...current.canvas,
                      canvasHeight,
                    },
                  }))
                }
                onCommitFrame={(moduleId: WorkspaceModuleId, frame: WorkspaceWindowFrame) =>
                  updateWorkspace((current) => ({
                    ...current,
                    canvas:
                      current.activeMode === "canvas"
                        ? {
                            ...current.canvas,
                            canvasHeight: Math.max(
                              current.canvas.canvasHeight,
                              frame.y + frame.h + 320,
                            ),
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
                onFitViewport={(viewport) => {
                  if (isLayoutEditingRef.current) {
                    return;
                  }

                  updateWorkspace((current) => fitWorkspaceToViewport(current, viewport));
                }}
                onOpenModule={openWorkspaceModule}
                onToggleCollapsed={toggleWorkspaceModuleCollapsed}
                preferences={active}
              />
            </WorkspaceRenderBoundary>
          </section>
        </section>
      )}
    </main>
  );
}

function readWorkspaceViewport(root: HTMLElement | null) {
  const shell = root?.querySelector(".workspace-canvas-shell");
  if (shell instanceof HTMLElement && shell.clientWidth > 0 && shell.clientHeight > 0) {
    return {
      width: shell.clientWidth,
      height: shell.clientHeight,
    };
  }

  return {
    width: window.innerWidth,
    height: Math.max(360, window.innerHeight - 168),
  };
}

function ensureWorkspaceModuleVisibleOnCanvas(
  preferences: WorkspacePreferences,
  moduleId: WorkspaceModuleId,
  view: WorkspaceCanvasView,
): WorkspacePreferences {
  const minimum = getWorkspaceModuleMinimumSize(moduleId);
  const currentFrame = preferences.windowLayout[moduleId] ?? preferences.canvas.panelPositions[moduleId];
  const topZ = Math.max(
    1,
    ...Object.values(preferences.windowLayout).map((frame) => frame?.z ?? 1),
  );
  const usableFrame = currentFrame
    ? {
        ...currentFrame,
        w: Math.max(currentFrame.w, minimum.width),
        h: Math.max(currentFrame.h, minimum.height),
        z: Math.max(currentFrame.z, topZ + 1),
      }
    : null;
  const frame = usableFrame && isWorkspaceFrameUsablyVisible(usableFrame, view, minimum)
    ? usableFrame
    : createRestoredWorkspaceFrame(moduleId, view, minimum, topZ + 1);

  return writeWorkspaceFrame(preferences, moduleId, frame);
}

function createRestoredWorkspaceFrame(
  moduleId: WorkspaceModuleId,
  view: WorkspaceCanvasView,
  minimum: { width: number; height: number },
  z: number,
): WorkspaceWindowFrame {
  const offset = (z % 5) * 28;
  const width = Math.max(
    minimum.width,
    Math.min(
      moduleId === "desmos-graph" ? 760 : Math.max(minimum.width + 160, Math.round(view.width * 0.52)),
      Math.max(minimum.width, view.width - 48),
    ),
  );
  const height = Math.max(
    minimum.height,
    Math.min(
      moduleId === "lesson" || moduleId === "private-notes"
        ? Math.max(minimum.height, Math.round(view.height * 0.72))
        : Math.max(minimum.height + 120, Math.round(view.height * 0.56)),
      Math.max(minimum.height, view.height - 48),
    ),
  );

  return {
    x: Math.max(0, Math.round(view.scrollLeft + 24 + offset)),
    y: Math.max(0, Math.round(view.scrollTop + 72 + offset)),
    w: Math.round(width),
    h: Math.round(height),
    z,
  };
}

function isWorkspaceFrameUsablyVisible(
  frame: WorkspaceWindowFrame,
  view: WorkspaceCanvasView,
  minimum: { width: number; height: number },
) {
  if (frame.w < minimum.width || frame.h < minimum.height) {
    return false;
  }

  const visibleLeft = view.scrollLeft;
  const visibleRight = view.scrollLeft + view.width;
  const visibleTop = view.scrollTop;
  const visibleBottom = view.scrollTop + view.height;
  const visibleWidth = Math.min(frame.x + frame.w, visibleRight) - Math.max(frame.x, visibleLeft);
  const visibleHeight = Math.min(frame.y + frame.h, visibleBottom) - Math.max(frame.y, visibleTop);

  return (
    visibleWidth >= Math.min(180, frame.w * 0.35) &&
    visibleHeight >= Math.min(140, frame.h * 0.25)
  );
}

function writeWorkspaceFrame(
  preferences: WorkspacePreferences,
  moduleId: WorkspaceModuleId,
  frame: WorkspaceWindowFrame,
): WorkspacePreferences {
  const canvasHeight = Math.min(
    WORKSPACE_MAX_CANVAS_HEIGHT,
    Math.max(preferences.canvas.canvasHeight, frame.y + frame.h + 320),
  );

  return {
    ...preferences,
    canvas: {
      ...preferences.canvas,
      canvasHeight,
      panelPositions: {
        ...preferences.canvas.panelPositions,
        [moduleId]: frame,
      },
    },
    windowLayout: {
      ...preferences.windowLayout,
      [moduleId]: frame,
    },
  };
}

function appearanceColorsChanged(
  previous: WorkspacePreferences,
  next: WorkspacePreferences,
) {
  return (
    previous.appearance.appTheme !== next.appearance.appTheme ||
    previous.appearance.accent !== next.appearance.accent ||
    previous.appearance.studySurface !== next.appearance.studySurface ||
    previous.appearance.density !== next.appearance.density ||
    previous.appearance.roundness !== next.appearance.roundness ||
    previous.appearance.motion !== next.appearance.motion ||
    previous.theme.accent !== next.theme.accent ||
    previous.theme.shadow !== next.theme.shadow ||
    previous.theme.font !== next.theme.font ||
    previous.theme.backgroundStyle !== next.theme.backgroundStyle ||
    previous.theme.graphAppearance !== next.theme.graphAppearance ||
    previous.theme.graphChrome !== next.theme.graphChrome ||
    previous.theme.defaultHighlightColor !== next.theme.defaultHighlightColor ||
    previous.appearance.customPalette.primary !== next.appearance.customPalette.primary ||
    previous.appearance.customPalette.secondary !== next.appearance.customPalette.secondary ||
    previous.appearance.customPalette.accent !== next.appearance.customPalette.accent ||
    previous.appearance.customPalette.sourceTheme !== next.appearance.customPalette.sourceTheme
  );
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
