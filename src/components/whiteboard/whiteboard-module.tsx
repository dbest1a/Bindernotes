import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import { WhiteboardBoardList } from "@/components/whiteboard/whiteboard-board-list";
import { WhiteboardCanvas } from "@/components/whiteboard/whiteboard-canvas";
import { WhiteboardFloatingUiLayer } from "@/components/whiteboard/whiteboard-floating-ui-layer";
import { WhiteboardModuleLauncher } from "@/components/whiteboard/whiteboard-module-launcher";
import { WhiteboardPinnedObjectLayer } from "@/components/whiteboard/whiteboard-pinned-object-layer";
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
} from "@/lib/whiteboards/whiteboard-limits";
import {
  WHITEBOARD_LIMIT_MESSAGE,
  archiveWhiteboard,
  createWhiteboard,
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

export function WhiteboardModule({ context, onBack, renderModule, variant = "module" }: WhiteboardModuleProps) {
  const ownerId = context.ownerId;
  const labMode = variant === "lab";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
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
  const lastUsedPrivateNotesModuleRef = useRef<string | null>(null);
  const requestViewportTransformRef = useRef<((transform: WhiteboardViewportTransform) => void) | null>(null);
  const [viewportTransform, setViewportTransform] = useState<WhiteboardViewportTransform>(
    defaultWhiteboardViewportTransform,
  );

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
    setViewportTransform(transform);
  }, []);
  const getLatestViewportTransform = useCallback(() => viewportTransformRef.current, []);

  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  const applyWhiteboardListResult = useCallback(
    (boards: BinderWhiteboard[], nextActiveId?: string) => {
      const repairedBoards = boards.map(repairBoardModules);
      setBoards(repairedBoards);
      const nextActive =
        (nextActiveId ? repairedBoards.find((board) => board.id === nextActiveId) : null) ??
        repairedBoards[0] ??
        null;
      setActiveBoard(nextActive);
      boardRef.current = nextActive;
      rememberBoardPinnedGeometry(nextActive?.modules ?? []);
      if (nextActive) {
        latestSceneRef.current = nextActive.scene;
        handleViewportChange(extractWhiteboardViewportTransform(nextActive.scene.appState));
      }
    },
    [handleViewportChange, rememberBoardPinnedGeometry, repairBoardModules],
  );

  const refreshBoards = useCallback(
    (nextActiveId?: string) => {
      if (!scope) {
        return;
      }

      void listWhiteboards(scope).then((result) => {
        const currentBoard = boardRef.current;
        if (result.boards.length > 0 || !currentBoard) {
          applyWhiteboardListResult(result.boards, nextActiveId ?? currentBoard?.id);
        } else {
          setBoards((currentBoards) => {
            const withoutCurrent = currentBoards.filter((candidate) => candidate.id !== currentBoard.id);
            return [currentBoard, ...withoutCurrent].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
          });
        }
        setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(result.message);
        setWarning(result.error ? result.message : null);
      });
    },
    [applyWhiteboardListResult, scope],
  );

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
        setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(result.message);
      } else if (!currentBoard) {
        applyWhiteboardListResult([], undefined);
        setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(result.backend === "supabase" ? "Supabase ready" : result.message);
      } else {
        setBoards((currentBoards) => {
          const withoutCurrent = currentBoards.filter((candidate) => candidate.id !== currentBoard.id);
          return [currentBoard, ...withoutCurrent].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        });
        setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(result.message);
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
  }, [applyWhiteboardListResult, scope]);

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    },
    [],
  );

  const persistBoard = useCallback(
    (board: BinderWhiteboard) => {
      try {
        const saved = board;
        setActiveBoard(saved);
        boardRef.current = saved;
        rememberBoardPinnedGeometry(saved.modules);
        setSaveStatus("saving");
        setSaveMessage("Saving...");
        const validation = validateWhiteboardForStorage(saved);
        setWarning(validation.warnings[0] ?? null);
        void saveWhiteboard(saved, { backend: "supabase", createVersion: saveStatusRef.current !== "saving" }).then(
          (result) => {
            const nextBoard = repairBoardModules(result.board);
            setActiveBoard(nextBoard);
            boardRef.current = nextBoard;
            rememberBoardPinnedGeometry(nextBoard.modules);
            setSaveStatus(mapSaveResultStatus(result.status));
            setSaveMessage(result.message);
            if (result.status !== "saved") {
              setWarning(result.message);
            } else {
              setWarning(validateWhiteboardForStorage(nextBoard).warnings[0] ?? null);
            }
            setBoards((currentBoards) => {
              const withoutSaved = currentBoards.filter((candidate) => candidate.id !== nextBoard.id);
              return [nextBoard, ...withoutSaved].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
            });
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
    [rememberBoardPinnedGeometry, repairBoardModules],
  );

  const saveLatestBoard = useCallback(() => {
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
      if (!current) {
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
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const updateBoardModules = useCallback(
    (updater: (modules: WhiteboardModuleElement[]) => WhiteboardModuleElement[]) => {
      const current = boardRef.current;
      if (!current) {
        return;
      }

      const nextBoard = {
        ...current,
        scene: latestSceneRef.current ?? current.scene,
        modules: updater(current.modules),
      };
      setActiveBoard(nextBoard);
      boardRef.current = nextBoard;
      rememberBoardPinnedGeometry(nextBoard.modules);
      persistBoard(nextBoard);
    },
    [persistBoard, rememberBoardPinnedGeometry],
  );

  const createBoardFromTemplate = useCallback(
    (template: WhiteboardTemplate) => {
      if (!scope) {
        return;
      }

      if (boards.length >= 3) {
        setSaveStatus("limit");
        setSaveMessage(WHITEBOARD_LIMIT_MESSAGE);
        setWarning(WHITEBOARD_LIMIT_MESSAGE);
        return;
      }

      setSaveStatus("saving");
      setSaveMessage("Saving...");
      void createWhiteboard(scope, {
        title: template.id === "blank-board" ? `${context.selectedLesson.title} whiteboard` : template.name,
        subject: context.binder.subject,
        template,
      }).then((result) => {
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
        setSaveMessage(result.message);
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
      const cached = boards.find((board) => board.id === boardId);
      if (cached) {
        const repaired = repairBoardModules(cached);
        latestSceneRef.current = repaired.scene;
        handleViewportChange(extractWhiteboardViewportTransform(repaired.scene.appState));
        setActiveBoard(repaired);
        boardRef.current = repaired;
        rememberBoardPinnedGeometry(repaired.modules);
        setSaveStatus(repaired.storageMode === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(repaired.storageMode === "supabase" ? "Saved to Supabase" : "Local draft");
      }
      void loadWhiteboard(scope, boardId).then((result) => {
        const remoteLoaded = result.boards[0];
        if (!remoteLoaded) {
          return;
        }
        const nextBoard = repairBoardModules(remoteLoaded);
        latestSceneRef.current = nextBoard.scene;
        handleViewportChange(extractWhiteboardViewportTransform(nextBoard.scene.appState));
        setActiveBoard(nextBoard);
        boardRef.current = nextBoard;
        rememberBoardPinnedGeometry(nextBoard.modules);
        setSaveStatus(result.backend === "supabase" ? "saved" : "offline-draft");
        setSaveMessage(result.message);
      });
    },
    [boards, handleViewportChange, rememberBoardPinnedGeometry, repairBoardModules, scope],
  );

  const archiveBoardById = useCallback(
    (boardId: string) => {
      if (!scope) {
        return;
      }

      setSaveStatus("saving");
      setSaveMessage("Archiving...");
      void archiveWhiteboard(scope, boardId).then((result) => {
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
      });
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
    ) => {
      const transform = viewportTransformRef.current;
      if (!isUnsafeModuleCreationZoom(transform.zoom)) {
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

      runWithModuleCreationZoomSafety(frame, () => updateBoardModules((modules) => [...modules, moduleElement]));
    },
    [context.binder.id, context.selectedLesson.id, labMode, runWithModuleCreationZoomSafety, updateBoardModules],
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
      runWithModuleCreationZoomSafety(frame, () => updateBoardModules((modules) => [...modules, moduleElement]));
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
            <WhiteboardCanvas
              board={activeBoard}
              fullscreen
              onSceneChange={handleSceneChange}
              onViewportChange={handleViewportChange}
              onViewportRequestReady={(requestViewport) => {
                requestViewportTransformRef.current = requestViewport;
              }}
            />
            <WhiteboardPinnedObjectLayer
              context={context}
              fixed
              getViewportTransform={getLatestViewportTransform}
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
              onAddModule={addModule}
              onArchiveBoard={archiveBoardById}
              onBack={onBack}
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
      className={labMode ? "whiteboard-workspace-panel whiteboard-workspace-panel--lab min-h-[calc(100svh-13rem)]" : "whiteboard-workspace-panel min-h-[720px]"}
      description={
        labMode
          ? "Full-screen local review lab with graph-paper drawing, templates, and live BinderNotes modules"
          : "Local review draft with graph-paper drawing and live BinderNotes modules"
      }
      title={labMode ? "Whiteboard Lab" : "Math Whiteboard"}
    >
      <div className={labMode ? "grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]" : "grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"}>
        <aside className="grid content-start gap-4 rounded-xl border border-border/70 bg-background/60 p-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline">Local draft</Badge>
              <Badge variant="secondary">Math</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Draw, organize math work, and open live BinderNotes modules on top of the board. Remote Supabase storage is prepared for a later approved migration.
            </p>
          </div>
          <WhiteboardBoardList
            activeBoardId={activeBoard?.id ?? null}
            boards={boards}
            onArchiveBoard={archiveBoardById}
            onSelectBoard={selectBoard}
          />
          <WhiteboardTemplatePicker onCreateFromTemplate={createBoardFromTemplate} />
          {labMode ? <WhiteboardModuleLauncher onAddModule={addModule} placement="panel" /> : null}
        </aside>

        <div className={labMode ? "relative min-h-[calc(100svh-18rem)] overflow-auto rounded-xl border border-border/70 bg-[#10131a]" : "relative min-h-[680px] overflow-auto rounded-xl border border-border/70 bg-[#10131a]"}>
          {activeBoard ? (
            <div className={labMode ? "relative min-h-[2200px] min-w-[2200px]" : "relative min-h-[1800px] min-w-[1800px]"}>
              <WhiteboardCanvas
                board={activeBoard}
                onSceneChange={handleSceneChange}
                onViewportChange={handleViewportChange}
                onViewportRequestReady={(requestViewport) => {
                  requestViewportTransformRef.current = requestViewport;
                }}
              />
              <WhiteboardPinnedObjectLayer
                context={context}
                getViewportTransform={getLatestViewportTransform}
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
              {!labMode ? <WhiteboardModuleLauncher onAddModule={addModule} /> : null}
            </div>
          ) : (
            <div className="grid min-h-[680px] place-items-center p-6">
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
