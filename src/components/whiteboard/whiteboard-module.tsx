import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import {
  BookOpen,
  Calculator,
  GripVertical,
  Home,
  LineChart,
  Maximize2,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import { WhiteboardBoardList } from "@/components/whiteboard/whiteboard-board-list";
import { WhiteboardCanvas, type WhiteboardCanvasActions } from "@/components/whiteboard/whiteboard-canvas";
import { WhiteboardStudyTools } from "@/components/whiteboard/whiteboard-study-tools";
import { getWhiteboardModuleExportFrame, whiteboardPlainText } from "@/lib/whiteboards/whiteboard-navigation";
import { WhiteboardFloatingUiLayer } from "@/components/whiteboard/whiteboard-floating-ui-layer";
import { WhiteboardModuleLauncher } from "@/components/whiteboard/whiteboard-module-launcher";
import {
  WhiteboardPinnedObjectLayer,
  syncWhiteboardPinnedModuleLayerToViewport,
} from "@/components/whiteboard/whiteboard-pinned-object-layer";
import { WhiteboardTemplatePicker } from "@/components/whiteboard/whiteboard-template-picker";
import { WhiteboardToolbar } from "@/components/whiteboard/whiteboard-toolbar";
import {
  findOpenWhiteboardModuleFrame,
  findOpenWhiteboardModuleFrameNearViewport,
  findOpenWhiteboardViewportModuleFrame,
  normalizeWhiteboardLabModules,
} from "@/lib/whiteboards/whiteboard-layout";
import {
  defaultWhiteboardViewportTransform,
  extractWhiteboardViewportTransform,
  getWhiteboardModuleAnchorMode,
  whiteboardViewportTransformsEqual,
  type WhiteboardViewportTransform,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import {
  computeViewportTransformForNewModule,
  isUnsafeModuleCreationZoom,
} from "@/lib/whiteboards/whiteboard-module-focus";
import {
  getAnnotationOriginFromModule,
  resolvePrivateNotesTarget,
  type PrivateNotesTargetCandidate,
} from "@/lib/whiteboards/whiteboard-note-targeting";
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_OBJECTS_WARNING,
  MAX_WHITEBOARD_DESMOS_GRAPHS,
  MAX_WHITEBOARDS_PER_USER,
} from "@/lib/whiteboards/whiteboard-limits";
import {
  WHITEBOARD_LIMIT_MESSAGE,
  archiveWhiteboard,
  createWhiteboard,
  createScratchWhiteboard,
  isScratchWhiteboard,
  listLocalWhiteboards,
  listWhiteboards,
  loadWhiteboard,
  saveWhiteboard,
} from "@/lib/whiteboards/whiteboard-storage";
import { countWhiteboardObjects, validateWhiteboardForStorage } from "@/lib/whiteboards/whiteboard-serialization";
import { hasPersistentWhiteboardSceneChange } from "@/lib/whiteboards/whiteboard-serialization";
import type {
  BinderWhiteboard,
  WhiteboardModuleElement,
  WhiteboardSaveStatus,
  WhiteboardSceneData,
  WhiteboardScope,
  WhiteboardTemplate,
} from "@/lib/whiteboards/whiteboard-types";
import {
  getDefaultWhiteboardModuleAnchorMode,
  getWhiteboardModuleDefinition,
  type WhiteboardModuleContextKind,
  type WhiteboardModuleDefinition,
} from "@/lib/whiteboards/whiteboard-module-registry";
import { mathWhiteboardTemplates } from "@/lib/whiteboards/whiteboard-templates";
import { getWhiteboardRecoveryMessage, readWhiteboardRecoveryDraft, writeWhiteboardRecoveryDraft } from "@/lib/whiteboards/whiteboard-recovery";
import "@/whiteboard-release.css";
import type { JSONContent } from "@tiptap/react";

type WhiteboardModuleProps = {
  context: WorkspaceModuleContext;
  renderModule: (
    moduleId: WhiteboardModuleElement["moduleId"],
    context: WorkspaceModuleContext,
  ) => ReactElement | null;
  onBack?: () => void;
  variant?: "module" | "lab";
};

type PendingZoomAction = {
  title: string;
  body: string;
  frame: Pick<WhiteboardModuleElement, "x" | "y" | "width" | "height">;
  run: () => void;
};

type PendingNotesInsertion = {
  text: string;
  prefix: "Source quote" | "Quote block" | "Sticky note";
  sourceModuleId: string;
  candidates?: PrivateNotesTargetCandidate[];
};

function emptyNoteDoc(): JSONContent {
  return { type: "doc", content: [] };
}

function appendParagraph(content: JSONContent | undefined, text: string): JSONContent {
  const cleanText = text.trim();
  const current = content ?? emptyNoteDoc();
  if (!cleanText) {
    return current;
  }

  return {
    type: "doc",
    content: [
      ...((current.content as JSONContent[] | undefined) ?? []),
      {
        type: "paragraph",
        content: [{ type: "text", text: cleanText }],
      },
    ],
  };
}

function getBoardPinnedGeometrySnapshot(modules: WhiteboardModuleElement[]) {
  return modules
    .filter((moduleElement) => getWhiteboardModuleAnchorMode(moduleElement) === "board")
    .map((moduleElement) =>
      [
        moduleElement.id,
        moduleElement.anchorMode,
        moduleElement.x,
        moduleElement.y,
        moduleElement.width,
        moduleElement.height,
      ].join(":"),
    )
    .join("|");
}

function keepSceneCameraInSync(
  scene: WhiteboardSceneData,
  transform: WhiteboardViewportTransform,
): WhiteboardSceneData {
  const appState =
    scene.appState && typeof scene.appState === "object" ? (scene.appState as Record<string, unknown>) : {};

  return {
    ...scene,
    appState: {
      ...appState,
      scrollX: transform.scrollX,
      scrollY: transform.scrollY,
      zoom: { value: transform.zoom },
    },
  };
}

function mapSaveResultStatus(status: "saved" | "local-draft" | "error" | "limit" | "storage-limit" | "unavailable"): WhiteboardSaveStatus {
  if (status === "saved") {
    return "saved";
  }
  if (status === "limit") {
    return "limit";
  }
  if (status === "storage-limit") {
    return "storage-limit";
  }
  if (status === "unavailable") {
    return "unavailable";
  }
  if (status === "error") {
    return "error";
  }
  return "offline-draft";
}

function shouldChooseSourceBeforeOpening(moduleId: WhiteboardModuleElement["moduleId"], labMode: boolean) {
  if (!labMode) {
    return false;
  }

  return (
    moduleId === "lesson" ||
    moduleId === "comments" ||
    moduleId === "recent-highlights" ||
    moduleId === "related-concepts" ||
    moduleId === "formula-sheet" ||
    moduleId === "math-blocks"
  );
}

function createDesmosGraphInstanceId(moduleId: WhiteboardModuleElement["moduleId"]) {
  return moduleId === "desmos-graph" ? `whiteboard-desmos-${crypto.randomUUID()}` : undefined;
}

function countDesmosGraphModules(modules: WhiteboardModuleElement[]) {
  return modules.filter((moduleElement) => moduleElement.moduleId === "desmos-graph").length;
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"))
    : false;
}

function getWhiteboardContextKind(context: WorkspaceModuleContext): WhiteboardModuleContextKind {
  const subject = context.binder.subject?.toLowerCase() ?? "";
  if (context.history?.enabled || subject.includes("history")) {
    return "history";
  }

  if (
    subject.includes("math") ||
    subject.includes("geometry") ||
    subject.includes("algebra") ||
    subject.includes("calculus")
  ) {
    return "math";
  }

  return "general";
}

function getSidebarRailModuleIds(contextKind: WhiteboardModuleContextKind): Array<WhiteboardModuleElement["moduleId"]> {
  if (contextKind === "history") {
    return ["lesson", "private-notes", "history-timeline", "history-evidence"];
  }

  if (contextKind === "math") {
    return ["lesson", "private-notes", "desmos-graph", "scientific-calculator"];
  }

  return ["lesson", "private-notes", "comments"];
}

const sidebarRailIcons: Partial<Record<WhiteboardModuleElement["moduleId"], typeof BookOpen>> = {
  lesson: BookOpen,
  "private-notes": NotebookText,
  "desmos-graph": LineChart,
  "scientific-calculator": Calculator,
  comments: NotebookText,
  "history-timeline": LineChart,
  "history-evidence": BookOpen,
};

const WHITEBOARD_SIDEBAR_WIDTH_KEY = "bindernotes:whiteboard-sidebar-width";
const WHITEBOARD_SIDEBAR_DEFAULT_WIDTH = 248;
const WHITEBOARD_SIDEBAR_MIN_WIDTH = 176;
const WHITEBOARD_SIDEBAR_MAX_WIDTH = 420;

function clampWhiteboardSidebarWidth(width: number) {
  return Math.min(WHITEBOARD_SIDEBAR_MAX_WIDTH, Math.max(WHITEBOARD_SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function getInitialWhiteboardSidebarWidth() {
  if (typeof window === "undefined") {
    return WHITEBOARD_SIDEBAR_DEFAULT_WIDTH;
  }

  const stored = window.localStorage.getItem(WHITEBOARD_SIDEBAR_WIDTH_KEY);
  const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN;
  return Number.isFinite(parsed) ? clampWhiteboardSidebarWidth(parsed) : WHITEBOARD_SIDEBAR_DEFAULT_WIDTH;
}

function getWhiteboardLoadedMessage(backend: "local" | "supabase", compactWhiteboardTools: boolean) {
  if (backend === "supabase") {
    return "Board loaded";
  }

  return "Local draft";
}

function getWhiteboardSavedMessage(
  status: "saved" | "local-draft" | "error" | "limit" | "storage-limit" | "unavailable",
  message: string,
  compactWhiteboardTools: boolean,
) {
  if (status === "saved") {
    return compactWhiteboardTools ? "Saved to your account" : "Saved";
  }

  return message;
}

export function WhiteboardModule({ context, onBack, renderModule, variant = "module" }: WhiteboardModuleProps) {
  const ownerId = context.ownerId;
  const labMode = variant === "lab";
  const compactWhiteboardTools = Boolean(context.compactWhiteboardTools);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    Boolean(compactWhiteboardTools || context.whiteboardSidebarDefaultCollapsed),
  );
  const [sidebarWidth, setSidebarWidth] = useState(getInitialWhiteboardSidebarWidth);
  const [templatesOpen, setTemplatesOpen] = useState(() => !compactWhiteboardTools);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const enterWhiteboardFocus = context.onEnterWhiteboardFocus;
  const exitWhiteboardFocus = onBack ?? context.onExitWhiteboardFocus;
  const [showFocusExitHint, setShowFocusExitHint] = useState(() => Boolean(exitWhiteboardFocus));
  const moduleContextKind = useMemo(() => getWhiteboardContextKind(context), [context]);
  const scope = useMemo<WhiteboardScope | null>(
    () =>
      ownerId
        ? {
            ownerId,
            binderId: context.binder.id,
            lessonId: context.selectedLesson.id,
          }
        : null,
    [context.binder.id, context.selectedLesson.id, ownerId],
  );
  const [boards, setBoards] = useState<BinderWhiteboard[]>([]);
  const [activeBoard, setActiveBoard] = useState<BinderWhiteboard | null>(null);
  const [saveStatus, setSaveStatus] = useState<WhiteboardSaveStatus>("offline-draft");
  const [saveMessage, setSaveMessage] = useState("Local draft");
  const [warning, setWarning] = useState<string | null>(null);
  const [pendingZoomAction, setPendingZoomAction] = useState<PendingZoomAction | null>(null);
  const [pendingNotesInsertion, setPendingNotesInsertion] = useState<PendingNotesInsertion | null>(null);
  const latestSceneRef = useRef<WhiteboardSceneData | null>(null);
  const boardRef = useRef<BinderWhiteboard | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const viewportTransformRef = useRef<WhiteboardViewportTransform>(defaultWhiteboardViewportTransform);
  const boardPinnedGeometrySnapshotRef = useRef("");
  const lastCountUpdateRef = useRef(0);
  const saveStatusRef = useRef(saveStatus);
  const saveRequestIdRef = useRef(0);
  const transitionIdRef = useRef(0);
  const editGenerationRef = useRef(0);
  const dirtyRef = useRef(false);
  const flushBoardRef = useRef<() => void>(() => {});
  const creatingRef = useRef(false);
  const moduleHistoryRef = useRef<{ boardId: string | null; past: WhiteboardModuleElement[][]; future: WhiteboardModuleElement[][] }>({ boardId: null, past: [], future: [] });
  const [moduleHistoryCounts, setModuleHistoryCounts] = useState({ boardId: null as string | null, undo: 0, redo: 0 });
  const canUndoModules = moduleHistoryCounts.boardId === activeBoard?.id && moduleHistoryCounts.undo > 0;
  const canRedoModules = moduleHistoryCounts.boardId === activeBoard?.id && moduleHistoryCounts.redo > 0;
  const canvasActionsRef = useRef<WhiteboardCanvasActions | null>(null);
  const canvasActionsBoardIdRef = useRef<string | null>(null);
  const bindCanvasActions = useCallback((boardId: string, actions: WhiteboardCanvasActions | null) => {
    if (actions && boardRef.current?.id === boardId) {
      canvasActionsRef.current = actions;
      canvasActionsBoardIdRef.current = boardId;
    } else if (!actions && canvasActionsBoardIdRef.current === boardId) {
      canvasActionsRef.current = null;
      canvasActionsBoardIdRef.current = null;
    }
  }, []);
  const getCurrentCanvasScene = useCallback(() => canvasActionsBoardIdRef.current === boardRef.current?.id
    ? canvasActionsRef.current?.getScene() ?? null : null, []);
  const lastUsedPrivateNotesModuleRef = useRef<string | null>(null);
  const requestViewportTransformRef = useRef<((transform: WhiteboardViewportTransform) => void) | null>(null);
  const pendingViewportTransformRef = useRef<WhiteboardViewportTransform | null>(null);
  const viewportUpdateRafRef = useRef<number | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const pinnedObjectLayerRef = useRef<HTMLDivElement | null>(null);
  const [viewportTransform, setViewportTransform] = useState<WhiteboardViewportTransform>(
    defaultWhiteboardViewportTransform,
  );

  const layoutStyle = useMemo(
    () =>
      ({
        "--whiteboard-sidebar-width": `${sidebarWidth}px`,
      }) as CSSProperties,
    [sidebarWidth],
  );

  const commitSidebarWidth = useCallback((width: number) => {
    const nextWidth = clampWhiteboardSidebarWidth(width);
    setSidebarWidth(nextWidth);
    layoutRef.current?.style.setProperty("--whiteboard-sidebar-width", `${nextWidth}px`);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WHITEBOARD_SIDEBAR_WIDTH_KEY, String(nextWidth));
    }
  }, []);

  const handleSidebarResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (sidebarCollapsed || !layoutRef.current) {
        return;
      }

      event.preventDefault();
      const startX = event.clientX;
      const startWidth = sidebarWidth;
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      handle.dataset.dragging = "true";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = clampWhiteboardSidebarWidth(startWidth + moveEvent.clientX - startX);
        layoutRef.current?.style.setProperty("--whiteboard-sidebar-width", `${nextWidth}px`);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        const nextWidth = clampWhiteboardSidebarWidth(startWidth + upEvent.clientX - startX);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        handle.dataset.dragging = "false";
        commitSidebarWidth(nextWidth);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
    },
    [commitSidebarWidth, sidebarCollapsed, sidebarWidth],
  );

  const handleSidebarResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
        return;
      }

      event.preventDefault();
      if (event.key === "Home") {
        commitSidebarWidth(WHITEBOARD_SIDEBAR_MIN_WIDTH);
        return;
      }
      if (event.key === "End") {
        commitSidebarWidth(WHITEBOARD_SIDEBAR_MAX_WIDTH);
        return;
      }

      commitSidebarWidth(sidebarWidth + (event.key === "ArrowLeft" ? -24 : 24));
    },
    [commitSidebarWidth, sidebarWidth],
  );

  useEffect(() => {
    if (!compactWhiteboardTools) {
      return;
    }

    setSidebarCollapsed(true);
    setTemplatesOpen(false);
  }, [compactWhiteboardTools]);

  const repairBoardModules = useCallback(
    (board: BinderWhiteboard): BinderWhiteboard => {
      if (!labMode) {
        return board;
      }

      const modules = normalizeWhiteboardLabModules(board.modules);
      return {
        ...board,
        modules,
      };
    },
    [labMode],
  );

  const rememberBoardPinnedGeometry = useCallback((modules: WhiteboardModuleElement[]) => {
    boardPinnedGeometrySnapshotRef.current = getBoardPinnedGeometrySnapshot(modules);
  }, []);

  const handleViewportChange = useCallback((transform: WhiteboardViewportTransform) => {
    if (import.meta.env.DEV && boardRef.current) {
      const nextGeometry = getBoardPinnedGeometrySnapshot(boardRef.current.modules);
      if (boardPinnedGeometrySnapshotRef.current && nextGeometry !== boardPinnedGeometrySnapshotRef.current) {
        console.error("BUG: board-pinned module geometry changed during camera movement", {
          before: boardPinnedGeometrySnapshotRef.current,
          after: nextGeometry,
        });
      }
    }

    if (whiteboardViewportTransformsEqual(viewportTransformRef.current, transform)) {
      return;
    }

    viewportTransformRef.current = transform;
    syncWhiteboardPinnedModuleLayerToViewport(pinnedObjectLayerRef.current, transform);
    pendingViewportTransformRef.current = transform;
    if (viewportUpdateRafRef.current !== null) {
      return;
    }

    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      setViewportTransform(transform);
      pendingViewportTransformRef.current = null;
      return;
    }

    viewportUpdateRafRef.current = window.requestAnimationFrame(() => {
      viewportUpdateRafRef.current = null;
      const nextTransform = pendingViewportTransformRef.current;
      pendingViewportTransformRef.current = null;
      if (nextTransform) {
        setViewportTransform(nextTransform);
      }
    });
  }, []);
  const getLatestViewportTransform = useCallback(() => viewportTransformRef.current, []);

  useEffect(() => {
    const boardId = activeBoard?.id ?? null;
    if (moduleHistoryRef.current.boardId !== boardId) {
      moduleHistoryRef.current = { boardId, past: [], future: [] };
      setModuleHistoryCounts({ boardId, undo: 0, redo: 0 });
    }
  }, [activeBoard?.id]);

  const activateScratchBoard = useCallback(
    (template: WhiteboardTemplate = mathWhiteboardTemplates[0]) => {
      if (!scope) {
        return null;
      }

      const scratchBoard = repairBoardModules(
        createScratchWhiteboard(scope, {
          title: `${context.selectedLesson.title} scratch board`,
          subject: context.binder.subject,
          template,
        }),
      );

      flushBoardRef.current();
      transitionIdRef.current += 1;
      saveRequestIdRef.current += 1;
      dirtyRef.current = false;
      setActiveBoard(scratchBoard);
      boardRef.current = scratchBoard;
      latestSceneRef.current = scratchBoard.scene;
      rememberBoardPinnedGeometry(scratchBoard.modules);
      handleViewportChange(extractWhiteboardViewportTransform(scratchBoard.scene.appState));
      setSaveStatus("offline-draft");
      setSaveMessage("Scratch board - not saved yet");
      setWarning("Saved boards are untouched. This scratch board stays local until you choose what to keep.");
      return scratchBoard;
    },
    [
      context.binder.subject,
      context.selectedLesson.title,
      handleViewportChange,
      rememberBoardPinnedGeometry,
      repairBoardModules,
      scope,
    ],
  );

  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  const applyWhiteboardListResult = useCallback(
    (boards: BinderWhiteboard[], nextActiveId?: string) => {
      const current = boardRef.current;
      const repairedBoards = boards.map((board) => current?.id === board.id && dirtyRef.current ? current : repairBoardModules(board));
      if (current && dirtyRef.current && !repairedBoards.some((board) => board.id === current.id) && !isScratchWhiteboard(current)) {
        repairedBoards.unshift(current);
      }
      setBoards(repairedBoards);
      const requestedBoard = nextActiveId ? repairedBoards.find((board) => board.id === nextActiveId) ?? null : null;
      const documentBoard =
        scope && compactWhiteboardTools
          ? repairedBoards.find((board) => board.binderId === scope.binderId && board.lessonId === scope.lessonId) ?? null
          : null;
      const currentScratchBoard =
        compactWhiteboardTools && boardRef.current && isScratchWhiteboard(boardRef.current)
          ? repairBoardModules(boardRef.current)
          : null;
      const nextActive = (dirtyRef.current && current && (!nextActiveId || nextActiveId === current.id) ? current : null) ??
        requestedBoard ??
        (compactWhiteboardTools ? documentBoard ?? currentScratchBoard : repairedBoards[0]) ??
        null;
      if (nextActive?.contentLoaded === false && scope) {
        const transitionId = ++transitionIdRef.current;
        const generation = editGenerationRef.current;
        setSaveMessage("Loading board…");
        void loadWhiteboard(scope, nextActive.id).then((result) => {
          if (transitionId !== transitionIdRef.current || generation !== editGenerationRef.current) return;
          const loaded = result.boards.find((board) => board.id === nextActive.id && board.contentLoaded !== false);
          if (!loaded) { setWarning(result.message || "Could not load board content."); return; }
          const repaired = repairBoardModules(loaded);
          saveRequestIdRef.current += 1;
          dirtyRef.current = repaired.storageMode === "local-draft";
          boardRef.current = repaired;
          latestSceneRef.current = repaired.scene;
          setActiveBoard(repaired);
          rememberBoardPinnedGeometry(repaired.modules);
          handleViewportChange(extractWhiteboardViewportTransform(repaired.scene.appState));
          setSaveStatus(dirtyRef.current ? "offline-draft" : "saved");
          setSaveMessage(dirtyRef.current ? getWhiteboardRecoveryMessage(repaired) : "Board loaded");
          if (repaired.recoveryStorage === "memory") setWarning(getWhiteboardRecoveryMessage(repaired));
        });
        return;
      }
      if (!nextActive && compactWhiteboardTools && scope && repairedBoards.length >= MAX_WHITEBOARDS_PER_USER) {
        activateScratchBoard();
        return;
      }
      setActiveBoard(nextActive);
      boardRef.current = nextActive;
      dirtyRef.current = Boolean(nextActive && ((nextActive.id === current?.id && dirtyRef.current) ||
        readWhiteboardRecoveryDraft({ ownerId: nextActive.ownerId }, nextActive.id)));
      if (nextActive?.id !== current?.id) saveRequestIdRef.current += 1;
      rememberBoardPinnedGeometry(nextActive?.modules ?? []);
      if (nextActive) {
        latestSceneRef.current = nextActive.scene;
        handleViewportChange(extractWhiteboardViewportTransform(nextActive.scene.appState));
      } else {
        latestSceneRef.current = null;
      }
    },
    [
      activateScratchBoard,
      compactWhiteboardTools,
      handleViewportChange,
      rememberBoardPinnedGeometry,
      repairBoardModules,
      scope,
    ],
  );

  const refreshBoards = useCallback(
    (nextActiveId?: string) => {
      if (!scope) {
        return;
      }

      const transitionId = transitionIdRef.current;
      void listWhiteboards(scope).then((result) => {
        if (transitionId !== transitionIdRef.current) return;
        const currentBoard = boardRef.current;
        if (result.boards.length > 0 || !currentBoard) {
          applyWhiteboardListResult(result.boards, nextActiveId ?? currentBoard?.id);
        } else {
          setBoards((currentBoards) => {
            const withoutCurrent = currentBoards.filter((candidate) => candidate.id !== currentBoard.id);
            return [currentBoard, ...withoutCurrent].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
          });
        }
        const activeAfterRefresh = boardRef.current;
        if (activeAfterRefresh && isScratchWhiteboard(activeAfterRefresh)) {
          setSaveStatus("offline-draft");
          setSaveMessage("Scratch board - not saved yet");
        } else {
          const localDraft = activeAfterRefresh?.storageMode === "local-draft" || dirtyRef.current;
          setSaveStatus(localDraft ? "offline-draft" : result.backend === "supabase" ? "saved" : "offline-draft");
          setSaveMessage(localDraft && activeAfterRefresh ? getWhiteboardRecoveryMessage(activeAfterRefresh) : getWhiteboardLoadedMessage(result.backend, compactWhiteboardTools));
        }
        setWarning(activeAfterRefresh?.recoveryStorage === "memory" ? getWhiteboardRecoveryMessage(activeAfterRefresh) : result.error ? result.message : null);
      });
    },
    [applyWhiteboardListResult, compactWhiteboardTools, scope],
  );

  useEffect(() => {
    boardRef.current = null;
    latestSceneRef.current = null;
    dirtyRef.current = false;
    setActiveBoard(null);
    setBoards([]);
    return () => {
      flushBoardRef.current();
      transitionIdRef.current += 1;
      saveRequestIdRef.current += 1;
    };
  }, [scope]);

  useEffect(() => {
    if (!scope) {
      return;
    }

    const localBoards = listLocalWhiteboards(scope).map(repairBoardModules);
    if (localBoards.length === 0) {
      return;
    }

    applyWhiteboardListResult(localBoards, boardRef.current?.id);
    setSaveStatus("offline-draft");
    setSaveMessage("Local draft");
  }, [applyWhiteboardListResult, repairBoardModules, scope]);

  useEffect(() => {
    if (!scope) {
      return;
    }

    let active = true;
    void listWhiteboards(scope).then((result) => {
      if (!active) {
        return;
      }

      const currentBoard = boardRef.current;
      if (result.boards.length > 0) {
        applyWhiteboardListResult(result.boards, boardRef.current?.id);
        const activeAfterList = boardRef.current;
        if (activeAfterList && isScratchWhiteboard(activeAfterList)) {
          setSaveStatus("offline-draft");
          setSaveMessage("Scratch board - not saved yet");
        } else {
          const localDraft = activeAfterList?.storageMode === "local-draft" || dirtyRef.current;
          setSaveStatus(localDraft ? "offline-draft" : result.backend === "supabase" ? "saved" : "offline-draft");
          setSaveMessage(localDraft && activeAfterList ? getWhiteboardRecoveryMessage(activeAfterList) : getWhiteboardLoadedMessage(result.backend, compactWhiteboardTools));
        }
      } else if (!currentBoard) {
        applyWhiteboardListResult([], undefined);
        setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(getWhiteboardLoadedMessage(result.backend, compactWhiteboardTools));
      } else {
        setBoards((currentBoards) => {
          const withoutCurrent = currentBoards.filter((candidate) => candidate.id !== currentBoard.id);
          return [currentBoard, ...withoutCurrent].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        });
        if (isScratchWhiteboard(currentBoard)) {
          setSaveStatus("offline-draft");
          setSaveMessage("Scratch board - not saved yet");
        } else {
          const localDraft = currentBoard.storageMode === "local-draft" || dirtyRef.current;
          setSaveStatus(localDraft ? "offline-draft" : result.backend === "supabase" ? "saved" : "offline-draft");
          setSaveMessage(localDraft ? getWhiteboardRecoveryMessage(currentBoard) : getWhiteboardLoadedMessage(result.backend, compactWhiteboardTools));
        }
      }
      if (boardRef.current?.recoveryStorage === "memory") {
        setWarning(getWhiteboardRecoveryMessage(boardRef.current));
      } else if (result.error && result.backend === "local") {
        setWarning(result.message);
      } else {
        setWarning(null);
      }
    });

    return () => {
      active = false;
    };
  }, [applyWhiteboardListResult, compactWhiteboardTools, scope]);

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      if (viewportUpdateRafRef.current !== null) {
        window.cancelAnimationFrame(viewportUpdateRafRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!exitWhiteboardFocus) {
      setShowFocusExitHint(false);
      return;
    }

    setShowFocusExitHint(true);
    const timeout = window.setTimeout(() => setShowFocusExitHint(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [exitWhiteboardFocus]);

  useEffect(() => {
    if (!exitWhiteboardFocus) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isEditableKeyboardTarget(event.target)) {
        return;
      }

      exitWhiteboardFocus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exitWhiteboardFocus]);

  const persistBoard = useCallback(
    (board: BinderWhiteboard) => {
      try {
        if (board.contentLoaded === false || board.id !== boardRef.current?.id) return null;
        const requestId = saveRequestIdRef.current + 1;
        saveRequestIdRef.current = requestId;
        const generation = editGenerationRef.current;
        const scene = getCurrentCanvasScene() ?? latestSceneRef.current ?? board.scene;
        latestSceneRef.current = scene;
        const saved = { ...board, scene, objectCount: countWhiteboardObjects({ scene, modules: board.modules }) };
        const recovery = writeWhiteboardRecoveryDraft(saved);
        saved.recoveryStorage = recovery.memoryToken ? "memory" : undefined;
        setActiveBoard(saved);
        boardRef.current = saved;
        rememberBoardPinnedGeometry(saved.modules);
        if (isScratchWhiteboard(saved)) {
          setSaveStatus("offline-draft");
          setSaveMessage("Scratch board - not saved yet");
          setWarning(null);
          return saved;
        }
        setSaveStatus("saving");
        setSaveMessage("Saving...");
        const validation = validateWhiteboardForStorage(saved);
        setWarning(recovery.error ?? validation.warnings[0] ?? null);
        void saveWhiteboard(saved, { backend: "supabase", createVersion: saveStatusRef.current !== "saving" }).then(
          (result) => {
            if (requestId !== saveRequestIdRef.current || boardRef.current?.id !== saved.id || result.board.id !== saved.id || generation !== editGenerationRef.current) {
              return;
            }
            dirtyRef.current = result.status !== "saved";
            const nextBoard = repairBoardModules(result.board);
            setActiveBoard(nextBoard);
            boardRef.current = nextBoard;
            rememberBoardPinnedGeometry(nextBoard.modules);
            setSaveStatus(mapSaveResultStatus(result.status));
            setSaveMessage(getWhiteboardSavedMessage(result.status, result.message, compactWhiteboardTools));
            if (result.status !== "saved") {
              setWarning(result.message);
            } else {
              setWarning(result.warning ?? validateWhiteboardForStorage(nextBoard).warnings[0] ?? null);
            }
            setBoards((currentBoards) => {
              const withoutSaved = currentBoards.filter((candidate) => candidate.id !== nextBoard.id);
              return [nextBoard, ...withoutSaved].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
            });
          },
          (error) => {
            if (requestId !== saveRequestIdRef.current || boardRef.current?.id !== saved.id || generation !== editGenerationRef.current) {
              return;
            }
            setSaveStatus("error");
            const message = error instanceof Error ? error.message : "Could not save this board.";
            setSaveMessage("Remote save failed");
            setWarning(message);
          },
        );
        return saved;
      } catch (error) {
        setSaveStatus("error");
        const message = error instanceof Error ? error.message : "Could not save this board.";
        setSaveMessage("Remote save failed");
        setWarning(message);
        return null;
      }
    },
    [compactWhiteboardTools, getCurrentCanvasScene, rememberBoardPinnedGeometry, repairBoardModules],
  );

  const saveLatestBoard = useCallback(() => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = null;
    const current = boardRef.current;
    if (!current) {
      return;
    }

    latestSceneRef.current = getCurrentCanvasScene() ?? latestSceneRef.current;
    const nextBoard = latestSceneRef.current
      ? {
          ...current,
          scene: latestSceneRef.current,
          objectCount: countWhiteboardObjects({
            scene: latestSceneRef.current,
            modules: current.modules,
          }),
        }
      : current;
    setSaveStatus("saving");
    persistBoard(nextBoard);
  }, [getCurrentCanvasScene, persistBoard]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    if (saveStatusRef.current !== "saving") {
      saveStatusRef.current = "saving";
      setSaveStatus("saving");
    }
    autosaveTimerRef.current = window.setTimeout(saveLatestBoard, AUTOSAVE_DEBOUNCE_MS);
  }, [saveLatestBoard]);

  flushBoardRef.current = () => {
    const current = boardRef.current;
    const scene = getCurrentCanvasScene();
    if (current && (dirtyRef.current || (scene && hasPersistentWhiteboardSceneChange(current.scene, scene)))) saveLatestBoard();
  };
  useEffect(() => {
    const flush = () => flushBoardRef.current();
    const hide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("online", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("online", flush);
    };
  }, []);

  const toggleBrowserFullscreen = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      setBrowserFullscreen(false);
      return;
    }

    void document.documentElement.requestFullscreen?.();
    setBrowserFullscreen(true);
  }, []);

  const handleSceneChange = useCallback(
    (scene: WhiteboardSceneData, sourceBoardId?: string) => {
      const current = boardRef.current;
      if (!current || (sourceBoardId && current.id !== sourceBoardId)) {
        return;
      }
      const previousScene = latestSceneRef.current ?? current.scene;
      latestSceneRef.current = scene;

      const objectCount = countWhiteboardObjects({ scene, modules: current.modules });
      const now = performance.now();
      if (now - lastCountUpdateRef.current > 1000) {
        lastCountUpdateRef.current = now;
        setActiveBoard((board) => (board ? { ...board, objectCount } : board));
        setWarning(objectCount >= MAX_OBJECTS_WARNING ? `This board has ${objectCount} objects. Use sections before it gets slow.` : null);
      }
      if (!hasPersistentWhiteboardSceneChange(previousScene, scene)) {
        return;
      }
      editGenerationRef.current += 1;
      dirtyRef.current = true;
      boardRef.current = { ...current, scene, objectCount, updatedAt: new Date().toISOString() };
      const recovery = writeWhiteboardRecoveryDraft(boardRef.current);
      boardRef.current.recoveryStorage = recovery.memoryToken ? "memory" : undefined;
      if (recovery.error) setWarning(recovery.error);
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  // Keep canvas registrations stable during toolbar, save-status, and camera renders.
  const activeCanvasBoardId = activeBoard?.id;
  const handleActiveSceneChange = useCallback((scene: WhiteboardSceneData) => {
    if (activeCanvasBoardId) handleSceneChange(scene, activeCanvasBoardId);
  }, [activeCanvasBoardId, handleSceneChange]);
  const handleActiveCanvasActions = useCallback((actions: WhiteboardCanvasActions | null) => {
    if (activeCanvasBoardId) bindCanvasActions(activeCanvasBoardId, actions);
  }, [activeCanvasBoardId, bindCanvasActions]);
  const handleViewportRequestReady = useCallback((requestViewport: ((transform: WhiteboardViewportTransform) => void) | null) => {
    if (boardRef.current?.id === activeCanvasBoardId) requestViewportTransformRef.current = requestViewport;
  }, [activeCanvasBoardId]);

  const updateBoardModules = useCallback(
    (updater: (modules: WhiteboardModuleElement[]) => WhiteboardModuleElement[], recordHistory = true) => {
      const current = boardRef.current;
      if (!current) {
        return;
      }

      const nextScene = keepSceneCameraInSync(
        latestSceneRef.current ?? current.scene,
        viewportTransformRef.current,
      );
      const nextBoard = {
        ...current,
        scene: nextScene,
        modules: updater(current.modules),
        updatedAt: new Date().toISOString(),
      };
      if (JSON.stringify(current.modules) === JSON.stringify(nextBoard.modules)) return;
      if (recordHistory) {
        const history = moduleHistoryRef.current.boardId === current.id
          ? moduleHistoryRef.current : { boardId: current.id, past: [], future: [] };
        history.past = [...history.past.slice(-49), JSON.parse(JSON.stringify(current.modules)) as WhiteboardModuleElement[]];
        history.future = [];
        moduleHistoryRef.current = history;
        setModuleHistoryCounts({ boardId: current.id, undo: history.past.length, redo: 0 });
      }
      nextBoard.objectCount = countWhiteboardObjects(nextBoard);
      editGenerationRef.current += 1;
      dirtyRef.current = true;
      setActiveBoard(nextBoard);
      boardRef.current = nextBoard;
      latestSceneRef.current = nextScene;
      rememberBoardPinnedGeometry(nextBoard.modules);
      persistBoard(nextBoard);
    },
    [persistBoard, rememberBoardPinnedGeometry],
  );

  const undoModuleChange = useCallback(() => {
    const current = boardRef.current;
    const history = moduleHistoryRef.current;
    if (!current || history.boardId !== current.id || history.past.length === 0) return;
    const previous = history.past.pop()!;
    history.future.push(JSON.parse(JSON.stringify(current.modules)) as WhiteboardModuleElement[]);
    updateBoardModules(() => previous, false);
    setModuleHistoryCounts({ boardId: current.id, undo: history.past.length, redo: history.future.length });
  }, [updateBoardModules]);

  const redoModuleChange = useCallback(() => {
    const current = boardRef.current;
    const history = moduleHistoryRef.current;
    if (!current || history.boardId !== current.id || history.future.length === 0) return;
    const next = history.future.pop()!;
    history.past.push(JSON.parse(JSON.stringify(current.modules)) as WhiteboardModuleElement[]);
    updateBoardModules(() => next, false);
    setModuleHistoryCounts({ boardId: current.id, undo: history.past.length, redo: history.future.length });
  }, [updateBoardModules]);

  const createBoardFromTemplate = useCallback(
    (template: WhiteboardTemplate) => {
      if (!scope) {
        return;
      }

      if (boards.length >= MAX_WHITEBOARDS_PER_USER) {
        if (compactWhiteboardTools) {
          activateScratchBoard(template);
          return;
        }

        setSaveStatus("limit");
        setSaveMessage(WHITEBOARD_LIMIT_MESSAGE);
        setWarning(WHITEBOARD_LIMIT_MESSAGE);
        return;
      }

      if (creatingRef.current) return;
      creatingRef.current = true;
      flushBoardRef.current();
      const transitionId = ++transitionIdRef.current;
      saveRequestIdRef.current += 1;
      setSaveStatus("saving");
      setSaveMessage("Creating board…");
      const baseTitle = template.id === "blank-board" ? context.selectedLesson.title + " whiteboard" : template.name;
      let uniqueTitle = baseTitle;
      for (let number = 2; boards.some((board) => board.title === uniqueTitle); number++) uniqueTitle = baseTitle + " " + number;
      void createWhiteboard(scope, {
        title: uniqueTitle,
        subject: context.binder.subject,
        template,
      }).then((result) => {
        creatingRef.current = false;
        if (transitionId !== transitionIdRef.current) return;
        if (result.status === "limit" || result.status === "error") {
          setSaveStatus(result.status);
          setSaveMessage(result.message);
          setWarning(result.message);
          return;
        }

        flushBoardRef.current();
        saveRequestIdRef.current += 1;
        dirtyRef.current = result.status !== "saved";
        const nextBoard = repairBoardModules(result.board);
        setActiveBoard(nextBoard);
        boardRef.current = nextBoard;
        latestSceneRef.current = nextBoard.scene;
        rememberBoardPinnedGeometry(nextBoard.modules);
        handleViewportChange(extractWhiteboardViewportTransform(nextBoard.scene.appState));
        setSaveStatus(mapSaveResultStatus(result.status));
        setSaveMessage(getWhiteboardSavedMessage(result.status, result.message, compactWhiteboardTools));
        setBoards((currentBoards) => {
          const withoutCreated = currentBoards.filter((candidate) => candidate.id !== nextBoard.id);
          return [nextBoard, ...withoutCreated].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        });
        setWarning(result.status === "saved" ? null : result.message);
        if (result.backend === "supabase" && result.status === "saved") {
          refreshBoards(nextBoard.id);
        }
      }).catch((error: unknown) => {
        creatingRef.current = false;
        if (transitionId !== transitionIdRef.current) return;
        setSaveStatus("error");
        setWarning(error instanceof Error ? error.message : "Could not create the board. Your current board is retained.");
      });
    },
    [
      boards,
      activateScratchBoard,
      compactWhiteboardTools,
      context.binder.subject,
      context.selectedLesson.title,
      handleViewportChange,
      refreshBoards,
      rememberBoardPinnedGeometry,
      repairBoardModules,
      scope,
    ],
  );

  const selectBoard = useCallback(
    (boardId: string) => {
      if (!scope) {
        return;
      }
      if (boardRef.current?.id === boardId) return;
      flushBoardRef.current();
      const transitionId = ++transitionIdRef.current;
      saveRequestIdRef.current += 1;
      const generation = editGenerationRef.current;
      dirtyRef.current = false;
      const cached = readWhiteboardRecoveryDraft(scope, boardId) ?? boards.find((board) => board.id === boardId);
      if (cached && cached.contentLoaded !== false) {
        const repaired = repairBoardModules(cached);
        latestSceneRef.current = repaired.scene;
        handleViewportChange(extractWhiteboardViewportTransform(repaired.scene.appState));
        setActiveBoard(repaired);
        boardRef.current = repaired;
        dirtyRef.current = repaired.storageMode === "local-draft";
        rememberBoardPinnedGeometry(repaired.modules);
        setSaveStatus(repaired.storageMode === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(getWhiteboardLoadedMessage(repaired.storageMode === "supabase" ? "supabase" : "local", compactWhiteboardTools));
      }
      void loadWhiteboard(scope, boardId).then((result) => {
        if (transitionId !== transitionIdRef.current || generation !== editGenerationRef.current) return;
        const remoteLoaded = result.boards[0];
        if (!remoteLoaded || remoteLoaded.id !== boardId || remoteLoaded.contentLoaded === false) {
          setWarning(result.message || "Could not open this board. Your draft is retained.");
          return;
        }
        const nextBoard = repairBoardModules(remoteLoaded);
        latestSceneRef.current = nextBoard.scene;
        handleViewportChange(extractWhiteboardViewportTransform(nextBoard.scene.appState));
        setActiveBoard(nextBoard);
        boardRef.current = nextBoard;
        dirtyRef.current = nextBoard.storageMode === "local-draft";
        rememberBoardPinnedGeometry(nextBoard.modules);
        setSaveStatus(dirtyRef.current ? "offline-draft" : "saved");
        setSaveMessage(dirtyRef.current ? getWhiteboardRecoveryMessage(nextBoard) : "Board loaded");
        if (nextBoard.recoveryStorage === "memory") setWarning(getWhiteboardRecoveryMessage(nextBoard));
      });
    },
    [boards, compactWhiteboardTools, handleViewportChange, rememberBoardPinnedGeometry, repairBoardModules, scope],
  );

  const archiveBoardById = useCallback(
    (boardId: string) => {
      if (!scope) {
        return;
      }

      flushBoardRef.current();
      const transitionId = ++transitionIdRef.current;
      saveRequestIdRef.current += 1;
      setSaveStatus("saving");
      setSaveMessage("Archiving...");
      void archiveWhiteboard(scope, boardId).then((result) => {
        if (result.status === "error") {
          if (transitionId !== transitionIdRef.current) return;
          setSaveStatus("error");
          setSaveMessage(result.message);
          setWarning(result.error ?? result.message);
          return;
        }

        setBoards((currentBoards) => currentBoards.filter((board) => board.id !== boardId));
        if (transitionId !== transitionIdRef.current) return;
        const current = boardRef.current;
        const remaining = boards.filter((board) => board.id !== boardId);
        const nextActive = current?.id === boardId ? remaining[0] ?? null : current;
        if (current?.id === boardId && autosaveTimerRef.current) {
          window.clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        saveRequestIdRef.current += 1;
        setActiveBoard(nextActive);
        boardRef.current = nextActive;
        dirtyRef.current = nextActive?.storageMode === "local-draft";
        rememberBoardPinnedGeometry(nextActive?.modules ?? []);
        if (nextActive) {
          latestSceneRef.current = nextActive.scene;
          handleViewportChange(extractWhiteboardViewportTransform(nextActive.scene.appState));
        }
        setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(result.message);
        setWarning(null);
        refreshBoards(nextActive?.id);
      });
    },
    [boards, handleViewportChange, refreshBoards, rememberBoardPinnedGeometry, scope],
  );

  const createBlankBoard = useCallback(() => {
    createBoardFromTemplate(mathWhiteboardTemplates[0]);
  }, [createBoardFromTemplate]);

  const runWithModuleCreationZoomSafety = useCallback(
    (
      frame: Pick<WhiteboardModuleElement, "x" | "y" | "width" | "height">,
      run: () => void,
      options?: { skipZoomPrompt?: boolean },
    ) => {
      const transform = viewportTransformRef.current;
      if (options?.skipZoomPrompt || !isUnsafeModuleCreationZoom(transform.zoom)) {
        run();
        return;
      }

      setPendingZoomAction({
        title: "Zoom to 100%?",
        body: "Live modules may not be usable at this zoom level. Zoom to 100% and open the module?",
        frame,
        run,
      });
    },
    [],
  );

  const confirmPendingZoomAction = useCallback(() => {
    const pending = pendingZoomAction;
    if (!pending) {
      return;
    }

    const nextTransform = computeViewportTransformForNewModule(
      pending.frame,
      viewportTransformRef.current,
      { desiredZoom: 1 },
    );
    requestViewportTransformRef.current?.(nextTransform);
    handleViewportChange(nextTransform);
    setPendingZoomAction(null);
    pending.run();
  }, [handleViewportChange, pendingZoomAction]);

  const cancelPendingZoomAction = useCallback(() => {
    setPendingZoomAction(null);
  }, []);

  const appendTextToPrivateNotesModule = useCallback(
    (targetModuleId: string, text: string) => {
      const current = boardRef.current;
      if (!current) {
        return;
      }

      updateBoardModules((modules) =>
        modules.map((moduleElement) => {
          if (moduleElement.id !== targetModuleId) {
            return moduleElement;
          }

          return {
            ...moduleElement,
            mode: "live",
            noteTitle: moduleElement.noteTitle ?? moduleElement.title ?? "Private Notes",
            title: moduleElement.title ?? "Private Notes",
            noteContent: appendParagraph(moduleElement.noteContent, text),
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      lastUsedPrivateNotesModuleRef.current = targetModuleId;
      setSaveMessage("Added to Private Notes");
    },
    [updateBoardModules],
  );

  const createPrivateNotesModuleWithText = useCallback(
    (pending: PendingNotesInsertion) => {
      const current = boardRef.current;
      if (!current) {
        return;
      }

      const sourceModule = current.modules.find((moduleElement) => moduleElement.id === pending.sourceModuleId);
      const definition: WhiteboardModuleDefinition = {
        moduleId: "private-notes",
        label: "Private Notes",
        description: "Whiteboard notes",
        heavy: false,
        defaultWidth: 560,
        defaultHeight: 440,
        defaultAnchorMode: sourceModule?.anchorMode ?? "board-fixed-size",
      };
      const frame = sourceModule
        ? {
            x: sourceModule.x + Math.min(96, sourceModule.width / 3),
            y: sourceModule.y + Math.min(96, sourceModule.height / 3),
            width: definition.defaultWidth,
            height: definition.defaultHeight,
          }
        : findOpenWhiteboardModuleFrameNearViewport(current.modules, definition, viewportTransformRef.current);
      const timestamp = new Date().toISOString();
      const targetId = `module-private-notes-${crypto.randomUUID()}`;
      const noteText = `${pending.prefix}: ${pending.text}`;
      const moduleElement: WhiteboardModuleElement = {
        id: targetId,
        type: "bindernotes-module",
        moduleId: "private-notes",
        binderId: context.binder.id,
        lessonId: context.selectedLesson.id,
        anchorMode: definition.defaultAnchorMode,
        pinned: definition.defaultAnchorMode !== "viewport",
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        zIndex: current.modules.length + 10,
        mode: "live",
        title: "Private Notes",
        noteTitle: "Private Notes",
        noteContent: appendParagraph(undefined, noteText),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const createModule = () => {
        updateBoardModules((modules) => [...modules, moduleElement]);
        lastUsedPrivateNotesModuleRef.current = targetId;
        setPendingNotesInsertion(null);
        setSaveMessage("Opened Private Notes and added the note.");
      };

      runWithModuleCreationZoomSafety(frame, createModule);
    },
    [
      context.binder.id,
      context.selectedLesson.id,
      runWithModuleCreationZoomSafety,
      updateBoardModules,
    ],
  );

  const routeSelectionToPrivateNotes = useCallback(
    (request: { anchorText?: string; prefix: "Source quote" | "Quote block" | "Sticky note"; sourceModuleId: string }) => {
      const text = request.anchorText?.trim();
      const current = boardRef.current;
      if (!text || !current) {
        return;
      }

      const sourceModule = current.modules.find((moduleElement) => moduleElement.id === request.sourceModuleId);
      const resolution = resolvePrivateNotesTarget({
        modules: current.modules,
        origin: sourceModule
          ? getAnnotationOriginFromModule(sourceModule)
          : {
              kind: "screen",
              point: {
                x: viewportTransformRef.current.viewportWidth / 2,
                y: viewportTransformRef.current.viewportHeight / 2,
              },
            },
        viewportTransform: viewportTransformRef.current,
        lastUsedTargetId: lastUsedPrivateNotesModuleRef.current,
      });

      if (resolution.status === "target-found") {
        appendTextToPrivateNotesModule(resolution.moduleId, `${request.prefix}: ${text}`);
        return;
      }

      setPendingNotesInsertion({
        text,
        prefix: request.prefix,
        sourceModuleId: request.sourceModuleId,
        candidates: resolution.status === "ambiguous" ? resolution.candidates : undefined,
      });
    },
    [appendTextToPrivateNotesModule],
  );

  const addModule = useCallback(
    (definition: WhiteboardModuleDefinition) => {
      const current = boardRef.current;
      if (!current) {
        return;
      }

      if (
        definition.moduleId === "desmos-graph" &&
        countDesmosGraphModules(current.modules) >= MAX_WHITEBOARD_DESMOS_GRAPHS
      ) {
        const message = `You can keep up to ${MAX_WHITEBOARD_DESMOS_GRAPHS} unique Desmos graphs on one whiteboard. Delete one before opening another.`;
        setSaveStatus("limit");
        setSaveMessage(message);
        setWarning(message);
        return;
      }

      const timestamp = new Date().toISOString();
      const anchorMode = getDefaultWhiteboardModuleAnchorMode(definition.moduleId);
      const frame =
        anchorMode === "viewport"
          ? findOpenWhiteboardViewportModuleFrame(current.modules, definition, viewportTransformRef.current)
          : labMode
            ? findOpenWhiteboardModuleFrameNearViewport(current.modules, definition, viewportTransformRef.current)
            : findOpenWhiteboardModuleFrame(current.modules, definition);
      const chooseSourceFirst = shouldChooseSourceBeforeOpening(definition.moduleId, labMode);
      const moduleId = `module-${definition.moduleId}-${crypto.randomUUID()}`;
      const moduleElement: WhiteboardModuleElement = {
        id: moduleId,
        type: "bindernotes-module",
        moduleId: definition.moduleId,
        binderId: chooseSourceFirst ? undefined : context.binder.id,
        lessonId: chooseSourceFirst ? undefined : context.selectedLesson.id,
        graphInstanceId: createDesmosGraphInstanceId(definition.moduleId),
        sourceConfirmed: chooseSourceFirst ? false : undefined,
        anchorMode,
        pinned: anchorMode !== "viewport",
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        zIndex: current.modules.length + 10,
        mode: labMode || !definition.heavy ? "live" : "preview",
        title: definition.label,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      runWithModuleCreationZoomSafety(
        frame,
        () => updateBoardModules((modules) => [...modules, moduleElement]),
        { skipZoomPrompt: anchorMode === "viewport" },
      );
    },
    [context.binder.id, context.selectedLesson.id, labMode, runWithModuleCreationZoomSafety, updateBoardModules],
  );

  const addModuleById = useCallback(
    (moduleId: WhiteboardModuleElement["moduleId"]) => {
      const definition = getWhiteboardModuleDefinition(moduleId);
      if (!definition) {
        return;
      }

      addModule(definition);
    },
    [addModule],
  );

  const addLinkedModule = useCallback(
    (patch: Partial<WhiteboardModuleElement> & Pick<WhiteboardModuleElement, "moduleId">) => {
      const current = boardRef.current;
      if (!current) {
        return;
      }

      if (patch.moduleId === "desmos-graph" && countDesmosGraphModules(current.modules) >= MAX_WHITEBOARD_DESMOS_GRAPHS) {
        const message = `You can keep up to ${MAX_WHITEBOARD_DESMOS_GRAPHS} unique Desmos graphs on one whiteboard. Delete one before opening another.`;
        setSaveStatus("limit");
        setSaveMessage(message);
        setWarning(message);
        return;
      }

      const definition = {
        moduleId: patch.moduleId,
        defaultWidth: patch.width ?? 360,
        defaultHeight: patch.height ?? 320,
      } as WhiteboardModuleDefinition;
      const timestamp = new Date().toISOString();
      const anchorMode = patch.anchorMode ?? getDefaultWhiteboardModuleAnchorMode(patch.moduleId);
      const frame =
        anchorMode === "viewport"
          ? findOpenWhiteboardViewportModuleFrame(current.modules, definition, viewportTransformRef.current)
          : labMode
            ? findOpenWhiteboardModuleFrameNearViewport(current.modules, definition, viewportTransformRef.current)
            : findOpenWhiteboardModuleFrame(current.modules, definition);

      const moduleId = `module-${patch.moduleId}-${crypto.randomUUID()}`;
      const moduleElement: WhiteboardModuleElement = {
        id: moduleId,
        type: "bindernotes-module",
        moduleId: patch.moduleId,
        binderId: patch.binderId ?? context.binder.id,
        lessonId: patch.lessonId ?? context.selectedLesson.id,
        sourceConfirmed: true,
        graphInstanceId: createDesmosGraphInstanceId(patch.moduleId),
        anchorMode,
        pinned: anchorMode !== "viewport",
        x: frame.x,
        y: frame.y,
        width: patch.width ?? frame.width,
        height: patch.height ?? frame.height,
        zIndex: current.modules.length + 10,
        mode: patch.mode ?? "live",
        title: patch.title ?? patch.moduleId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      runWithModuleCreationZoomSafety(
        frame,
        () => updateBoardModules((modules) => [...modules, moduleElement]),
        { skipZoomPrompt: anchorMode === "viewport" },
      );
    },
    [context.binder.id, context.selectedLesson.id, labMode, runWithModuleCreationZoomSafety, updateBoardModules],
  );

  const renameActiveBoard = useCallback(
    (title: string) => {
      const current = boardRef.current;
      if (!current) {
        return;
      }
      const nextTitle = title.trim() || "Math whiteboard";
      if (nextTitle === current.title) {
        return;
      }
      editGenerationRef.current += 1;
      dirtyRef.current = true;
      persistBoard({
        ...current,
        scene: latestSceneRef.current ?? current.scene,
        title: nextTitle,
        updatedAt: new Date().toISOString(),
      });
    },
    [persistBoard],
  );

  const sourceText = Object.fromEntries((activeBoard?.modules ?? []).map((module) => {
    const lesson = [context.selectedLesson, ...(context.library?.lessons ?? []), ...(context.lessons ?? [])].find((item) => item.id === module.lessonId);
    return [module.id, lesson ? `${lesson.title}\n${whiteboardPlainText(lesson.content)}` : ""];
  }));
  const studyTools = activeBoard ? <div className="grid gap-2">
    <div className="grid grid-cols-2 gap-2">
      <Button size="sm" variant="outline" aria-label="Undo module change" disabled={!canUndoModules} onClick={undoModuleChange}>Undo card</Button>
      <Button size="sm" variant="outline" aria-label="Redo module change" disabled={!canRedoModules} onClick={redoModuleChange}>Redo card</Button>
    </div>
    <WhiteboardStudyTools
    key={activeBoard.id}
    board={activeBoard}
    getActions={() => canvasActionsBoardIdRef.current === activeBoard.id ? canvasActionsRef.current : null}
    viewport={viewportTransform}
    sourceText={sourceText}
    onViewport={(next) => { requestViewportTransformRef.current?.(next); handleViewportChange(next); }}
    onStickyNote={() => {
      const now = new Date().toISOString();
      const camera = viewportTransformRef.current;
      updateBoardModules((modules) => [...modules, {
        id: `sticky-${crypto.randomUUID()}`, type: "bindernotes-module", moduleId: "private-notes",
        title: "Sticky note", noteTitle: "Sticky note", noteContent: emptyNoteDoc(), sourceConfirmed: true,
        x: camera.viewportWidth / (2 * camera.zoom) - camera.scrollX - 180,
        y: camera.viewportHeight / (2 * camera.zoom) - camera.scrollY - 130,
        width: 360, height: 300, zIndex: Math.max(0, ...modules.map((module) => module.zIndex)) + 1,
        mode: "live", anchorMode: "board-fixed-size", createdAt: now, updatedAt: now,
      }]);
    }}
    onArrange={() => {
      const camera = viewportTransformRef.current;
      updateBoardModules((modules) => {
        let x = -camera.scrollX + 80 / camera.zoom, y = -camera.scrollY + 100 / camera.zoom, rowHeight = 0;
        const left = x;
        return modules.map((module) => {
          if (getWhiteboardModuleAnchorMode(module) === "viewport") return module;
          const frame = getWhiteboardModuleExportFrame(module, camera);
          if (x > left && x - left + frame.width > (camera.viewportWidth - 160) / camera.zoom) { x = left; y += rowHeight + 32 / camera.zoom; rowHeight = 0; }
          const next = { ...module, x, y, updatedAt: new Date().toISOString() };
          x += frame.width + 32 / camera.zoom;
          rowHeight = Math.max(rowHeight, frame.height);
          return next;
        });
      });
    }}
  /></div> : null;

  if (!scope) {
    return (
      <WorkspacePanel description="Sign in is required for whiteboard drafts" title="Math Whiteboard">
        <EmptyState
          description="Whiteboards are tied to your BinderNotes account and lesson. Sign in with Supabase before creating one."
          title="Whiteboard unavailable"
        />
      </WorkspacePanel>
    );
  }

  if (labMode) {
    return (
      <div
        className="bindernotes-whiteboard-lab fixed inset-0 z-[999] h-screen w-screen overflow-hidden bg-[#10131a] text-foreground"
        data-testid="whiteboard-lab-page"
      >
        {activeBoard ? (
          <>
            {exitWhiteboardFocus ? (
              <div
                className="whiteboard-focus-return pointer-events-none fixed"
                data-testid="whiteboard-focus-return"
                data-whiteboard-focus-return="true"
              >
                <Button
                  className="whiteboard-focus-exit pointer-events-auto"
                  data-testid="whiteboard-focus-exit"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    exitWhiteboardFocus();
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Home className="size-4" />
                  Back to workspace
                </Button>
              </div>
            ) : null}
            {showFocusExitHint ? (
              <div
                className="whiteboard-focus-exit-hint whiteboard-focus-exit-hint--fullscreen pointer-events-none fixed left-1/2 z-[160] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border px-4 py-3 text-center text-sm font-semibold shadow-xl"
                data-testid="whiteboard-focus-exit-hint"
                role="status"
              >
                Whiteboard focus is on. Use Back to workspace or Esc to return to your menus.
              </div>
            ) : null}
            <WhiteboardCanvas
              key={activeBoard.id}
              onActionsReady={handleActiveCanvasActions}
              board={activeBoard}
              fullscreen
              onSceneChange={handleActiveSceneChange}
              onViewportChange={handleViewportChange}
              onViewportRequestReady={handleViewportRequestReady}
            />
            <WhiteboardPinnedObjectLayer
              context={context}
              fixed
              getViewportTransform={getLatestViewportTransform}
              layerRef={pinnedObjectLayerRef}
              modules={activeBoard.modules}
              onAddLinkedModule={addLinkedModule}
              onChangeModule={(moduleElement) =>
                updateBoardModules((modules) =>
                  modules.map((candidate) => (candidate.id === moduleElement.id ? moduleElement : candidate)),
                )
              }
              onRemoveModule={(moduleId) =>
                updateBoardModules((modules) => modules.filter((moduleElement) => moduleElement.id !== moduleId))
              }
              onRouteSelectionToNotes={routeSelectionToPrivateNotes}
              renderModule={renderModule}
              viewportTransform={viewportTransform}
            />

            <WhiteboardFloatingUiLayer
              activeBoard={activeBoard}
              browserFullscreen={browserFullscreen}
              boards={boards}
              drawerOpen={drawerOpen}
              moduleContextKind={moduleContextKind}
              onAddModule={addModule}
              onArchiveBoard={archiveBoardById}
              onBack={exitWhiteboardFocus}
              onCreateBoard={createBlankBoard}
              onDrawerOpenChange={setDrawerOpen}
              onSaveNow={saveLatestBoard}
              onRenameBoard={renameActiveBoard}
              onSelectBoard={selectBoard}
              onToggleFullscreen={toggleBrowserFullscreen}
              saveMessage={saveMessage}
              saveStatus={saveStatus}
              warning={warning}
              studyTools={studyTools}
              templates={<details><summary className="cursor-pointer p-2 font-semibold">Start from a template</summary><WhiteboardTemplatePicker compact onCreateFromTemplate={createBoardFromTemplate} /></details>}
            />
            {pendingNotesInsertion ? (
              <div
                className="pointer-events-auto fixed left-1/2 top-24 z-[90] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-xl"
                data-testid="whiteboard-no-private-notes-prompt"
              >
                <p className="text-sm font-semibold">
                  {pendingNotesInsertion.candidates?.length
                    ? "Choose Private Notes destination"
                    : "No Private Notes module is open"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {pendingNotesInsertion.candidates?.length
                    ? "Pick where this note should go."
                    : "Open a Private Notes module and add this there?"}
                </p>
                {pendingNotesInsertion.candidates?.length ? (
                  <div className="mt-3 grid gap-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Choose destination
                    </p>
                    {pendingNotesInsertion.candidates.slice(0, 4).map((candidate) => (
                      <button
                        className="rounded-md border border-border bg-card px-3 py-2 text-left text-xs font-semibold hover:bg-secondary"
                        key={candidate.moduleId}
                        onClick={() => {
                          appendTextToPrivateNotesModule(
                            candidate.moduleId,
                            `${pendingNotesInsertion.prefix}: ${pendingNotesInsertion.text}`,
                          );
                          setPendingNotesInsertion(null);
                        }}
                        type="button"
                      >
                        {candidate.title}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    onClick={() => setPendingNotesInsertion(null)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                  {!pendingNotesInsertion.candidates?.length ? (
                    <Button
                      onClick={() => createPrivateNotesModuleWithText(pendingNotesInsertion)}
                      size="sm"
                      type="button"
                    >
                      Yes, open Private Notes
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {pendingZoomAction ? (
              <div
                className="pointer-events-auto fixed left-1/2 top-24 z-[95] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-xl"
                data-testid="whiteboard-zoom-safety-prompt"
              >
                <p className="text-sm font-semibold">{pendingZoomAction.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{pendingZoomAction.body}</p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button onClick={cancelPendingZoomAction} size="sm" type="button" variant="ghost">
                    Cancel
                  </Button>
                  <Button onClick={confirmPendingZoomAction} size="sm" type="button">
                    Zoom to 100% and open
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid h-full w-full place-items-center bg-[#10131a] p-6">
            <div className="whiteboard-control-panel grid w-[min(28rem,calc(100vw-2rem))] gap-4 rounded-lg border p-4 text-sm" data-testid="whiteboard-start-panel">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Whiteboard Lab</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Start a whiteboard</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Create a Supabase-saved board, or reopen one you already made.
                </p>
              </div>
              <Button
                className="whiteboard-action-button justify-start"
                data-testid="whiteboard-new-board"
                onClick={createBlankBoard}
                type="button"
              >
                New Whiteboard
              </Button>
              <WhiteboardBoardList
                activeBoardId={null}
                boards={boards}
                onArchiveBoard={archiveBoardById}
                onSelectBoard={selectBoard}
              />
              <div
                className="whiteboard-save-status rounded-md border px-2.5 py-2 text-xs font-semibold"
                data-status={saveStatus}
                data-testid="whiteboard-save-confirmation"
              >
                {saveMessage}
              </div>
              {warning ? (
                <span className="whiteboard-save-status inline-flex items-start gap-1 rounded-md border px-2 py-1.5" data-status={saveStatus}>
                  <TriangleAlert className="size-3.5" />
                  {warning}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <WorkspacePanel
      className="whiteboard-workspace-panel whiteboard-workspace-panel--module h-full min-h-0"
      description="Local review draft with graph-paper drawing and live BinderNotes modules"
      title="Math Whiteboard"
    >
      <div
        className={`whiteboard-module-layout grid h-full min-h-0 gap-3 ${sidebarCollapsed ? "whiteboard-module-layout--sidebar-collapsed" : ""}`}
        data-compact-whiteboard-tools={compactWhiteboardTools ? "true" : "false"}
        data-whiteboard-performance-shell="true"
        data-whiteboard-sidebar-resizable="true"
        data-whiteboard-sidebar={sidebarCollapsed ? "collapsed" : "expanded"}
        ref={layoutRef}
        style={layoutStyle}
      >
        {sidebarCollapsed ? (
          <aside
            className="whiteboard-module-sidebar-rail flex min-h-0 flex-col items-center gap-2 rounded-xl border border-border/70 bg-background/70 p-2"
            data-testid="whiteboard-sidebar-rail"
          >
            {exitWhiteboardFocus ? (
              <Button
                aria-label="Back to workspace"
                className="whiteboard-focus-exit"
                data-testid="whiteboard-focus-exit"
                onClick={exitWhiteboardFocus}
                size="icon"
                type="button"
                variant="secondary"
              >
                <Home className="size-4" />
              </Button>
            ) : null}
            {!exitWhiteboardFocus && enterWhiteboardFocus ? (
              <Button
                aria-label="Open full board"
                data-testid="whiteboard-enter-focus"
                onClick={enterWhiteboardFocus}
                size="icon"
                type="button"
                variant="outline"
              >
                <Maximize2 className="size-4" />
              </Button>
            ) : null}
            <Button
              aria-label="Expand toolbox"
              data-testid="whiteboard-sidebar-expand"
              onClick={() => setSidebarCollapsed(false)}
              size={compactWhiteboardTools ? "sm" : "icon"}
              type="button"
              variant="ghost"
            >
              <PanelLeftOpen className="size-4" />
              {compactWhiteboardTools ? <span className="sr-only sm:not-sr-only">Expand toolbox</span> : null}
            </Button>
            <span className="writing-mode-vertical text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Modules
            </span>
            <div className="mt-1 grid gap-1">
              {getSidebarRailModuleIds(moduleContextKind).map((moduleId) => {
                const definition = getWhiteboardModuleDefinition(moduleId);
                if (!definition) {
                  return null;
                }
                const Icon = sidebarRailIcons[moduleId] ?? BookOpen;
                return (
                  <Button
                    aria-label={`Open ${definition.label}`}
                    data-testid={`whiteboard-sidebar-rail-${moduleId}`}
                    key={moduleId}
                    onClick={() => addModuleById(moduleId)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Icon className="size-4" />
                  </Button>
                );
              })}
            </div>
          </aside>
        ) : (
        <aside
          className={`whiteboard-module-sidebar min-h-0 rounded-xl border border-border/70 bg-background/60 ${compactWhiteboardTools ? "whiteboard-module-sidebar--compact" : ""}`}
          data-testid="whiteboard-sidebar"
        >
          <div className="whiteboard-sidebar-header">
            <div className="whiteboard-sidebar-header__actions">
              <Button
                aria-label="Shrink whiteboard sidebar"
                className="whiteboard-sidebar-shrink"
                data-testid="whiteboard-sidebar-collapse"
                onClick={() => setSidebarCollapsed(true)}
                size="sm"
                type="button"
                variant="secondary"
              >
                <PanelLeftClose className="size-4" />
                Shrink
              </Button>
              {!exitWhiteboardFocus && enterWhiteboardFocus ? (
                <Button
                  aria-label="Open full board"
                  data-testid="whiteboard-enter-focus"
                  onClick={enterWhiteboardFocus}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Maximize2 className="size-4" />
                  Full board
                </Button>
              ) : null}
              {exitWhiteboardFocus ? (
                <Button
                  aria-label="Back to workspace"
                  className="whiteboard-focus-exit"
                  data-testid="whiteboard-focus-exit"
                  onClick={exitWhiteboardFocus}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Home className="size-4" />
                  Back
                </Button>
              ) : null}
            </div>
            <div className="whiteboard-sidebar-header__meta">
              <Badge variant="secondary">{context.binder.subject ?? "Workspace"}</Badge>
              <span>{activeBoard ? `${activeBoard.objectCount} ${activeBoard.objectCount === 1 ? "object" : "objects"}` : "No board selected"}</span>
            </div>
            <p>
              {compactWhiteboardTools
                ? "Board first. Keep this rail small until you need boards, templates, or live modules."
                : "Keep the board beside your lesson, notes, and live tools while you work."}
            </p>
          </div>
          <div className="whiteboard-sidebar-scroll" data-testid="whiteboard-sidebar-scroll">
            {studyTools}
            <WhiteboardBoardList
              activeBoardId={activeBoard?.id ?? null}
              archiveActionsVisible={!compactWhiteboardTools}
              boards={boards}
              compact={compactWhiteboardTools}
              onArchiveBoard={archiveBoardById}
              onCreateBlankBoard={createBlankBoard}
              onCreateScratchBoard={compactWhiteboardTools ? () => activateScratchBoard(mathWhiteboardTemplates[0]) : undefined}
              onSelectBoard={selectBoard}
              showLimitStatus={saveStatus === "limit" || (compactWhiteboardTools && templatesOpen && boards.length >= MAX_WHITEBOARDS_PER_USER)}
            />
            <WhiteboardTemplatePicker
              compact={compactWhiteboardTools}
              onCreateFromTemplate={createBoardFromTemplate}
              onOpenChange={setTemplatesOpen}
              open={templatesOpen}
              templates={templatesOpen ? mathWhiteboardTemplates : []}
            />
            <section className="whiteboard-sidebar-modules rounded-xl border border-border/70 bg-card/45 p-3" aria-label="Whiteboard modules">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Modules</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Open notes, source, graph, calculator, or history tools without leaving the board.
                  </p>
                </div>
              </div>
              <WhiteboardModuleLauncher
                compact={compactWhiteboardTools}
                contextKind={moduleContextKind}
                defaultOpen={!compactWhiteboardTools}
                onAddModule={addModule}
                placement="panel"
              />
            </section>
          </div>
        </aside>
        )}

        {!sidebarCollapsed ? (
          <div
            aria-label="Resize whiteboard sidebar"
            aria-orientation="vertical"
            className="whiteboard-sidebar-resizer"
            data-testid="whiteboard-sidebar-resizer"
            onKeyDown={handleSidebarResizeKeyDown}
            onPointerDown={handleSidebarResizePointerDown}
            role="separator"
            tabIndex={0}
            title="Drag to resize the whiteboard sidebar"
          >
            <GripVertical className="size-3.5" />
          </div>
        ) : null}

        <div className="whiteboard-module-surface relative h-full min-h-0 overflow-hidden rounded-xl border border-border/70 bg-[#10131a]">
          {showFocusExitHint ? (
            <div
              className="whiteboard-focus-exit-hint whiteboard-focus-exit-hint--embedded pointer-events-none absolute left-1/2 z-[160] w-[min(24rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-lg border px-3 py-2 text-center text-xs font-semibold shadow-xl"
              data-testid="whiteboard-focus-exit-hint"
              role="status"
            >
              Whiteboard focus is on. Use Back to workspace or Esc to return to your menus.
            </div>
          ) : null}
          {activeBoard ? (
            <div className="whiteboard-module-board relative h-full min-h-0 min-w-0 overflow-hidden">
              <WhiteboardCanvas
                key={activeBoard.id}
                onActionsReady={handleActiveCanvasActions}
                board={activeBoard}
                onSceneChange={handleActiveSceneChange}
                onViewportChange={handleViewportChange}
                onViewportRequestReady={handleViewportRequestReady}
              />
              <WhiteboardPinnedObjectLayer
                context={context}
                getViewportTransform={getLatestViewportTransform}
                layerRef={pinnedObjectLayerRef}
                modules={activeBoard.modules}
                onAddLinkedModule={addLinkedModule}
                onChangeModule={(moduleElement) =>
                  updateBoardModules((modules) =>
                    modules.map((candidate) => (candidate.id === moduleElement.id ? moduleElement : candidate)),
                  )
                }
                onRemoveModule={(moduleId) =>
                  updateBoardModules((modules) => modules.filter((moduleElement) => moduleElement.id !== moduleId))
                }
                onRouteSelectionToNotes={routeSelectionToPrivateNotes}
                renderModule={renderModule}
                viewportTransform={viewportTransform}
              />
              <WhiteboardToolbar
                objectCount={activeBoard.objectCount}
                onSaveNow={saveLatestBoard}
                saveStatus={saveStatus}
                storageLabel={saveMessage}
                title={activeBoard.title}
                warning={warning}
              />
              <WhiteboardModuleLauncher compact={compactWhiteboardTools} contextKind={moduleContextKind} onAddModule={addModule} />
            </div>
          ) : (
            <div className="grid h-full min-h-[24rem] place-items-center p-6">
              <EmptyState
                description="Create a board from a template to start drawing."
                title="No whiteboard selected"
              />
            </div>
          )}
        </div>
      </div>
      {warning ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-amber-200">
          <TriangleAlert className="size-3.5" />
          {warning}
        </p>
      ) : null}
    </WorkspacePanel>
  );
}
