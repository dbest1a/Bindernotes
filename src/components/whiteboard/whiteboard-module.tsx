import { WhiteboardVersionHistory } from "@/components/whiteboard/whiteboard-version-history";
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
import { WhiteboardCanvas } from "@/components/whiteboard/whiteboard-canvas";
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
} from "@/lib/whiteboards/whiteboard-storage";
import { clearWhiteboardRecoverySelection, createWhiteboardDraftCopy, getWhiteboardDraft, listWhiteboardBackups, mergeWhiteboardDrafts, restoreWhiteboardBackup, whiteboardDraftSnapshot } from "@/lib/whiteboards/whiteboard-drafts";
import { saveQueue } from "@/lib/save-queue";
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

function mapSaveResultStatus(status: "saved" | "local-draft" | "error" | "limit" | "storage-limit" | "conflict" | "unavailable"): WhiteboardSaveStatus {
  if (status === "conflict") return "conflict";
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
    return compactWhiteboardTools ? "Loaded from your account" : "Loaded from Supabase";
  }

  return "Local draft";
}

function getWhiteboardSavedMessage(
  status: "saved" | "local-draft" | "error" | "limit" | "storage-limit" | "conflict" | "unavailable",
  message: string,
  compactWhiteboardTools: boolean,
) {
  if (status === "saved") {
    return compactWhiteboardTools ? "Saved to your account" : "Saved";
  }

  return message;
}

export function WhiteboardModule({ context, onBack, renderModule, variant = "module" }: WhiteboardModuleProps) {
  return <WhiteboardModuleContent key={`${context.ownerId}:${context.binder.id}:${context.selectedLesson.id}`} context={context} onBack={onBack} renderModule={renderModule} variant={variant} />;
}

function WhiteboardModuleContent({ context, onBack, renderModule, variant = "module" }: WhiteboardModuleProps) {
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
  const [recoveryKey, setRecoveryKey] = useState(0);
  const [storedSaveStatus, setSaveStatus] = useState<WhiteboardSaveStatus>("offline-draft");
  const [storedSaveMessage, setSaveMessage] = useState("Local draft");
  const [storedWarning, setWarning] = useState<string | null>(null);
  const [pendingZoomAction, setPendingZoomAction] = useState<PendingZoomAction | null>(null);
  const [pendingNotesInsertion, setPendingNotesInsertion] = useState<PendingNotesInsertion | null>(null);
  const latestSceneRef = useRef<WhiteboardSceneData | null>(null);
  const boardRef = useRef<BinderWhiteboard | null>(null);
  const viewportTransformRef = useRef<WhiteboardViewportTransform>(defaultWhiteboardViewportTransform);
  const boardPinnedGeometrySnapshotRef = useRef("");
  const lastCountUpdateRef = useRef(0);
  const selectionRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const flushCanvasRef = useRef<(() => void) | null>(null);
  const registerCanvasFlush = useCallback((flush: (() => void) | null) => { flushCanvasRef.current = flush; }, []);
  const lastUsedPrivateNotesModuleRef = useRef<string | null>(null);
  const requestViewportTransformRef = useRef<((transform: WhiteboardViewportTransform) => void) | null>(null);
  const pendingViewportTransformRef = useRef<WhiteboardViewportTransform | null>(null);
  const viewportUpdateRafRef = useRef<number | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const pinnedObjectLayerRef = useRef<HTMLDivElement | null>(null);
  const [viewportTransform, setViewportTransform] = useState<WhiteboardViewportTransform>(
    defaultWhiteboardViewportTransform,
  );
  const boardLifetimeId = `${activeBoard?.id}:${recoveryKey}`;
  const boardLifetimeRef = useRef({ id: boardLifetimeId, active: true, preserveOnRetire: true });
  if (boardLifetimeRef.current.id !== boardLifetimeId) {
    boardLifetimeRef.current.active = false;
    boardLifetimeRef.current = { id: boardLifetimeId, active: true, preserveOnRetire: true };
  }
  const boardLifetime = boardLifetimeRef.current;
  useEffect(() => {
    boardLifetime.active = true;
    return () => { boardLifetime.active = false; };
  }, [boardLifetime]);

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

  const applyWhiteboardListResult = useCallback(
    (boards: BinderWhiteboard[], nextActiveId?: string) => {
      const repairedBoards = (scope ? mergeWhiteboardDrafts(boards, scope) : boards).map(repairBoardModules);
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
      const nextActive =
        requestedBoard ??
        (compactWhiteboardTools ? documentBoard ?? currentScratchBoard : repairedBoards[0]) ??
        null;
      if (!nextActive && compactWhiteboardTools && scope && repairedBoards.length >= MAX_WHITEBOARDS_PER_USER) {
        activateScratchBoard();
        return;
      }
      setActiveBoard(nextActive);
      boardRef.current = nextActive;
      rememberBoardPinnedGeometry(nextActive?.modules ?? []);
      if (nextActive) {
        latestSceneRef.current = nextActive.scene;
        handleViewportChange(extractWhiteboardViewportTransform(nextActive.scene.appState));
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

      const selection = selectionRequestRef.current;
      void listWhiteboards(scope).then((result) => {
        if (!mountedRef.current || selection !== selectionRequestRef.current) return;
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
          setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
          setSaveMessage(getWhiteboardLoadedMessage(result.backend, compactWhiteboardTools));
        }
        setWarning(result.error ? result.message : null);
      });
    },
    [applyWhiteboardListResult, compactWhiteboardTools, scope],
  );

  useEffect(() => {
    if (!scope) {
      return;
    }

    const localBoards = mergeWhiteboardDrafts(listLocalWhiteboards(scope), scope).map(repairBoardModules);
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
          setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
          setSaveMessage(getWhiteboardLoadedMessage(result.backend, compactWhiteboardTools));
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
          setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
          setSaveMessage(getWhiteboardLoadedMessage(result.backend, compactWhiteboardTools));
        }
      }
      if (result.error && result.backend === "local") {
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
    () => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        selectionRequestRef.current += 1;
        if (viewportUpdateRafRef.current !== null) window.cancelAnimationFrame(viewportUpdateRafRef.current);
      };
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
    (board: BinderWhiteboard, immediate = true) => {
      try {
        if (!mountedRef.current || boardRef.current?.id !== board.id) return null;
        const draft = getWhiteboardDraft(board);
        draft.edit(() => ({ ...board, updatedAt: new Date().toISOString() }), !isScratchWhiteboard(board));
        const saved = whiteboardDraftSnapshot(board);
        setActiveBoard(saved);
        boardRef.current = saved;
        rememberBoardPinnedGeometry(saved.modules);
        if (immediate && !isScratchWhiteboard(board)) void draft.flush();
        return saved;
      } catch (error) {
        setSaveStatus("error");
        const message = error instanceof Error ? error.message : "Could not save this board.";
        setSaveMessage("Remote save failed");
        setWarning(message);
        return null;
      }
    },
    [rememberBoardPinnedGeometry],
  );

  const activeDraft = useMemo(() => activeBoard ? getWhiteboardDraft(activeBoard) : null, [activeBoard?.id, recoveryKey]);
  const preserveRetiringScene = useCallback((scene: WhiteboardSceneData) => {
    if (!activeDraft || !boardLifetime.preserveOnRetire) return;
    const current = activeDraft.getSnapshot().snapshot;
    if (saveQueue.getAccount() !== current.ownerId || !hasPersistentWhiteboardSceneChange(current.scene, scene)) return;
    try {
      activeDraft.edit((board) => ({ ...board, scene, objectCount: countWhiteboardObjects({ scene, modules: board.modules }), updatedAt: new Date().toISOString() }), !isScratchWhiteboard(current));
    } catch { /* Account retirement invalidates the old canvas together with its controller. */ }
  }, [activeDraft, boardLifetime]);
  useEffect(() => {
    if (!activeDraft) return;
    const sync = () => {
      const state = activeDraft.getSnapshot();
      if (!mountedRef.current || boardRef.current?.id !== state.snapshot.id) return;
      const revision = activeDraft.getServerRevision();
      const snapshot = { ...state.snapshot, revision, ...(revision > 0 ? { storageMode: "supabase" as const } : {}) };
      boardRef.current = snapshot;
      latestSceneRef.current = snapshot.scene;
      setActiveBoard(snapshot);
      setBoards((current) => [snapshot, ...current.filter((board) => board.id !== snapshot.id)]);
      const scratch = isScratchWhiteboard(snapshot);
      setSaveStatus(scratch ? "offline-draft" : state.state === "saved" ? revision > 0 ? "saved" : "offline-draft" : state.state === "conflict" ? "conflict" : state.state === "error" ? "error" : state.state === "offline" ? "offline-draft" : "saving");
      setSaveMessage(scratch ? "Scratch board - not saved yet" : state.state === "saved" ? revision > 0 ? "Saved" : "Local draft" : state.state === "conflict" ? "Choose which version to keep" : state.state === "error" ? "Save needs attention" : state.state === "offline" ? "Offline draft" : "Saving...");
      setWarning(state.error ?? validateWhiteboardForStorage(snapshot).warnings[0] ?? null);
    };
    sync();
    return activeDraft.subscribe(sync);
  }, [activeDraft]);

  const saveLatestBoard = useCallback(() => {
    flushCanvasRef.current?.();
    const current = boardRef.current;
    if (!current) {
      return;
    }

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
  }, [persistBoard]);

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
    (scene: WhiteboardSceneData) => {
      const current = boardRef.current;
      if (!current || !mountedRef.current || !boardLifetime.active || boardLifetime !== boardLifetimeRef.current || current.id !== activeBoard?.id) {
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
      persistBoard({ ...current, scene, objectCount }, false);
    },
    [activeBoard?.id, boardLifetime, persistBoard],
  );

  const updateBoardModules = useCallback(
    (updater: (modules: WhiteboardModuleElement[]) => WhiteboardModuleElement[]) => {
      const current = boardRef.current;
      if (!current || !boardLifetime.active || boardLifetime !== boardLifetimeRef.current) {
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
      };
      setActiveBoard(nextBoard);
      boardRef.current = nextBoard;
      latestSceneRef.current = nextScene;
      rememberBoardPinnedGeometry(nextBoard.modules);
      persistBoard(nextBoard);
    },
    [boardLifetime, persistBoard, rememberBoardPinnedGeometry],
  );

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

      setSaveStatus("saving");
      setSaveMessage("Saving...");
      const selection = ++selectionRequestRef.current;
      void createWhiteboard(scope, {
        title: template.id === "blank-board" ? `${context.selectedLesson.title} whiteboard` : template.name,
        subject: context.binder.subject,
        template,
      }).then((result) => {
        if (!mountedRef.current || selection !== selectionRequestRef.current) return;
        if (result.status === "limit") {
          setSaveStatus("limit");
          setSaveMessage(result.message);
          setWarning(result.message);
          return;
        }

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
      });
    },
    [
      boards.length,
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
      flushCanvasRef.current?.();
      const selection = ++selectionRequestRef.current;
      const cached = boards.find((board) => board.id === boardId);
      if (cached) {
        const repaired = repairBoardModules(whiteboardDraftSnapshot(cached));
        latestSceneRef.current = repaired.scene;
        handleViewportChange(extractWhiteboardViewportTransform(repaired.scene.appState));
        setActiveBoard(repaired);
        boardRef.current = repaired;
        rememberBoardPinnedGeometry(repaired.modules);
        setSaveStatus(repaired.storageMode === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(getWhiteboardLoadedMessage(repaired.storageMode === "supabase" ? "supabase" : "local", compactWhiteboardTools));
      }
      void loadWhiteboard(scope, boardId).then((result) => {
        if (!mountedRef.current || selection !== selectionRequestRef.current) return;
        const remoteLoaded = result.boards[0];
        if (!remoteLoaded) {
          return;
        }
        const nextBoard = repairBoardModules(whiteboardDraftSnapshot(remoteLoaded));
        latestSceneRef.current = nextBoard.scene;
        handleViewportChange(extractWhiteboardViewportTransform(nextBoard.scene.appState));
        setActiveBoard(nextBoard);
        boardRef.current = nextBoard;
        rememberBoardPinnedGeometry(nextBoard.modules);
        setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(getWhiteboardLoadedMessage(result.backend, compactWhiteboardTools));
      });
    },
    [boards, compactWhiteboardTools, handleViewportChange, rememberBoardPinnedGeometry, repairBoardModules, scope],
  );

  const archiveBoardById = useCallback(
    (boardId: string) => {
      if (!scope) {
        return;
      }

      setSaveStatus("saving");
      setSaveMessage("Archiving...");
      void (async () => {
        const board = boards.find((item) => item.id === boardId);
        if (board) {
          const draft = getWhiteboardDraft(board);
          await draft.flush();
          if (draft.getSnapshot().dirty) {
            if (mountedRef.current) setWarning("Save this draft or choose a conflict version before archiving. Your work is preserved.");
            return;
          }
        }
        const result = await archiveWhiteboard(scope, boardId);
        if (!mountedRef.current) return;
        if (result.status === "error") {
          setSaveStatus("error");
          setSaveMessage(result.message);
          setWarning(result.error ?? result.message);
          return;
        }

        const remaining = boards.filter((board) => board.id !== boardId);
        setBoards(remaining);
        const nextActive = activeBoard?.id === boardId ? remaining[0] ?? null : activeBoard;
        setActiveBoard(nextActive);
        boardRef.current = nextActive;
        rememberBoardPinnedGeometry(nextActive?.modules ?? []);
        if (nextActive) {
          latestSceneRef.current = nextActive.scene;
          handleViewportChange(extractWhiteboardViewportTransform(nextActive.scene.appState));
        }
        setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(result.message);
        setWarning(null);
        refreshBoards(nextActive?.id);
      })();
    },
    [activeBoard, boards, handleViewportChange, refreshBoards, rememberBoardPinnedGeometry, scope],
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
      persistBoard({
        ...current,
        title: nextTitle,
        updatedAt: new Date().toISOString(),
      });
    },
    [persistBoard],
  );

  const loadSavedVersion = async () => {
    if (!scope || !activeDraft) return;
    const draft = activeDraft;
    const boardId = draft.getSnapshot().snapshot.id;
    try {
      const result = await loadWhiteboard(scope, boardId);
      const remote = result.boards.find((board) => board.id === boardId && board.ownerId === scope.ownerId);
      if (result.backend !== "supabase" || !remote) throw new Error("The saved version could not be loaded. Your draft is still preserved.");
      if (!mountedRef.current || boardRef.current?.id !== boardId) return;
      boardLifetimeRef.current.preserveOnRetire = false;
      draft.useRemote(remote, remote.revision ?? 0);
      clearWhiteboardRecoverySelection(remote);
      setRecoveryKey((key) => key + 1);
      handleViewportChange(extractWhiteboardViewportTransform(remote.scene.appState));
    } catch (error) {
      if (mountedRef.current && boardRef.current?.id === boardId) setWarning(error instanceof Error ? error.message : "Could not load the saved version.");
    }
  };

  const preserveDraftCopy = () => {
    if (!activeDraft) return;
    flushCanvasRef.current?.();
    const draft = createWhiteboardDraftCopy(activeDraft.getSnapshot().snapshot);
    const copy = draft.getSnapshot().snapshot;
    selectionRequestRef.current += 1;
    boardRef.current = copy;
    latestSceneRef.current = copy.scene;
    setActiveBoard(copy);
    setBoards((current) => [copy, ...current]);
    void draft.flush();
  };

  const exportDraft = () => {
    if (!activeDraft) return;
    const board = activeDraft.getSnapshot().snapshot;
    const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `whiteboard-${board.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  // Background lists may update their load status, but cannot hide a dirty draft or conflict.
  const draftState = activeDraft?.getSnapshot();
  const useDraftStatus = draftState?.dirty && (storedSaveStatus !== "limit" || draftState.state === "conflict");
  const saveStatus: WhiteboardSaveStatus = useDraftStatus
    ? draftState.state === "conflict" ? "conflict" : draftState.state === "error" ? "error" : draftState.state === "offline" || isScratchWhiteboard(draftState.snapshot) ? "offline-draft" : "saving"
    : storedSaveStatus;
  const saveMessage = useDraftStatus
    ? draftState.state === "conflict" ? "Choose which version to keep" : draftState.state === "error" ? "Save needs attention" : draftState.state === "offline" ? "Offline draft" : isScratchWhiteboard(draftState.snapshot) ? "Scratch board - not saved yet" : "Saving..."
    : storedSaveMessage;
  const warning = draftState?.error ?? storedWarning;
  const versionHistory = activeBoard && activeDraft && !isScratchWhiteboard(activeBoard) ? (
    <div className={labMode ? "pointer-events-auto fixed bottom-4 left-4 z-[1200]" : "flex justify-end"}>
      <WhiteboardVersionHistory key={activeBoard.id} board={activeBoard} expectedRevision={activeDraft.getServerRevision()}
        disabled={Boolean(draftState?.dirty) || saveStatus === "saving"} onRestored={loadSavedVersion} />
    </div>
  ) : null;
  const recoveryControls = activeDraft && (saveStatus === "conflict" || saveStatus === "error" || saveStatus === "offline-draft") ? (
    <div className={labMode ? "pointer-events-auto fixed bottom-20 left-4 right-4 z-[1200] flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3 shadow-lg" : "flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3"} role="status" data-testid="whiteboard-recovery-controls">
      {saveStatus === "conflict" ? <span>This board changed elsewhere. Your draft is preserved.</span> : null}
      {saveStatus === "conflict" || isScratchWhiteboard(activeDraft.getSnapshot().snapshot) ? <Button size="sm" variant="secondary" onClick={preserveDraftCopy}>Save draft as a copy</Button> : null}
      {saveStatus === "conflict" ? <Button size="sm" variant="outline" onClick={() => void loadSavedVersion()}>Load saved version</Button> : null}
      {saveStatus !== "conflict" && !isScratchWhiteboard(activeDraft.getSnapshot().snapshot) ? <Button size="sm" variant="outline" onClick={() => void activeDraft.flush()}>Retry save</Button> : null}
      <Button size="sm" variant="outline" onClick={exportDraft}>Download draft backup</Button>
    </div>
  ) : null;
  const backups = activeBoard ? listWhiteboardBackups(activeBoard) : [];
  const backupChoices = activeBoard && backups.length > 0 ? (
    <details className={labMode ? "fixed bottom-4 right-4 z-[1200] max-h-48 max-w-sm overflow-auto rounded-lg border bg-background p-2" : "rounded-lg border bg-background p-2"}>
      <summary className="cursor-pointer text-sm">Device draft backups ({backups.length})</summary>
      {backups.map((backup, index) => <Button key={backup.key} size="sm" variant="outline" disabled={saveStatus === "saving"} onClick={() => {
        const restored = restoreWhiteboardBackup(activeBoard, backup.key);
        const snapshot = restored.getSnapshot().snapshot;
        boardRef.current = snapshot;
        latestSceneRef.current = snapshot.scene;
        setActiveBoard(snapshot);
        setRecoveryKey((key) => key + 1);
      }}>Recover backup {index + 1}: {backup.draft.snapshot.title}</Button>)}
    </details>
  ) : null;

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
        {recoveryControls}
        {backupChoices}
        {versionHistory}
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
              key={`${activeBoard.id}:${recoveryKey}`}
              board={activeBoard}
              fullscreen
              onSceneChange={handleSceneChange}
              onRetireScene={preserveRetiringScene}
              onFlushReady={registerCanvasFlush}
              onViewportChange={handleViewportChange}
              onViewportRequestReady={(requestViewport) => {
                requestViewportTransformRef.current = requestViewport;
              }}
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
      {recoveryControls}
      {backupChoices}
      {versionHistory}
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
              <span>{activeBoard ? `${activeBoard.objectCount} objects` : "No board selected"}</span>
            </div>
            <p>
              {compactWhiteboardTools
                ? "Board first. Keep this rail small until you need boards, templates, or live modules."
                : "Keep the board beside your lesson, notes, and live tools while you work."}
            </p>
          </div>
          <div className="whiteboard-sidebar-scroll" data-testid="whiteboard-sidebar-scroll">
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
                key={`${activeBoard.id}:${recoveryKey}`}
                board={activeBoard}
                onSceneChange={handleSceneChange}
                onRetireScene={preserveRetiringScene}
                onFlushReady={registerCanvasFlush}
                onViewportChange={handleViewportChange}
                onViewportRequestReady={(requestViewport) => {
                  requestViewportTransformRef.current = requestViewport;
                }}
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
