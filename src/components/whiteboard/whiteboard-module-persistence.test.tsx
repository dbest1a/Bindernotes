// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardModule } from "@/components/whiteboard/whiteboard-module";
import type { WhiteboardCanvasActions } from "@/components/whiteboard/whiteboard-canvas";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { BinderWhiteboard, WhiteboardListResult, WhiteboardSaveResult, WhiteboardSceneData } from "@/lib/whiteboards/whiteboard-types";
import { clearWhiteboardRecoveryDraft, readWhiteboardRecoveryDraft } from "@/lib/whiteboards/whiteboard-recovery";
import * as whiteboardStorage from "@/lib/whiteboards/whiteboard-storage";
import type { WorkspaceModuleId } from "@/types";

const storageMocks = vi.hoisted(() => ({
  deferLoads: false,
  pendingLoads: [] as Array<{ boardId: string; resolve: (result: WhiteboardListResult) => void }>,
  canvasChanges: new Map<string, (scene: WhiteboardSceneData) => void>(),
  canvasScenes: new Map<string, WhiteboardSceneData>(),
  canvasActionsReady: new Map<string, (actions: WhiteboardCanvasActions | null) => void>(),
  pendingSaves: [] as Array<{
    board: BinderWhiteboard;
    resolve: (result: WhiteboardSaveResult) => void;
  }>,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseProjectRef: null,
}));

vi.mock("@/components/whiteboard/whiteboard-canvas", () => ({
  WhiteboardCanvas: ({ board, onSceneChange, onActionsReady }: {
    board: BinderWhiteboard;
    onSceneChange: (scene: WhiteboardSceneData) => void;
    onActionsReady?: (actions: WhiteboardCanvasActions | null) => void;
  }) => {
    storageMocks.canvasChanges.set(board.id, onSceneChange);
    if (onActionsReady) storageMocks.canvasActionsReady.set(board.id, onActionsReady);
    if (!storageMocks.canvasScenes.has(board.id)) storageMocks.canvasScenes.set(board.id, board.scene);
    useEffect(() => {
      onActionsReady?.({ getScene: () => storageMocks.canvasScenes.get(board.id)!, fitAll: () => {}, exportSvg: async () => {} });
      return () => onActionsReady?.(null);
    }, [board.id, onActionsReady]);
    return <div data-testid="whiteboard-excalidraw-host" data-board-id={board.id} data-board-elements={JSON.stringify(board.scene.elements)} />;
  },
}));

vi.mock("@/lib/whiteboards/whiteboard-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/whiteboards/whiteboard-storage")>();
  return {
    ...actual,
    loadWhiteboard: vi.fn((scope, boardId: string) => storageMocks.deferLoads
      ? new Promise<WhiteboardListResult>((resolve) => storageMocks.pendingLoads.push({ boardId, resolve }))
      : actual.loadWhiteboard(scope, boardId)),
    saveWhiteboard: vi.fn((board: BinderWhiteboard) =>
      new Promise<WhiteboardSaveResult>((resolve) => {
        storageMocks.pendingSaves.push({ board, resolve });
      }),
    ),
  };
});

function board(modules: BinderWhiteboard["modules"]): BinderWhiteboard {
  return {
    id: "board-workspace",
    ownerId: "user-1",
    binderId: "binder-1",
    lessonId: "lesson-1",
    title: "Lesson whiteboard",
    subject: "Math",
    moduleContext: "lesson",
    scene: { elements: [], appState: { viewBackgroundColor: "#11131a" }, files: {} },
    modules,
    objectCount: 0,
    sceneSizeBytes: 0,
    assetSizeBytes: 0,
    storageMode: "local-draft",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    archivedAt: null,
  };
}

function moduleElement(
  id: string,
  moduleId: WorkspaceModuleId,
  zIndex: number,
): BinderWhiteboard["modules"][number] {
  return {
    id,
    type: "bindernotes-module",
    moduleId,
    x: id === "lower" ? 100 : 640,
    y: 120,
    width: 420,
    height: 320,
    zIndex,
    mode: "live",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    anchorMode: "board-fixed-size",
    pinned: true,
  };
}

function seedBoard() {
  window.localStorage.setItem(
    "bindernotes:whiteboards:user-1:binder-1:lesson-1",
    JSON.stringify([
      board([
        moduleElement("lower", "desmos-graph", 1),
        moduleElement("upper", "formula-sheet", 12),
      ]),
    ]),
  );
}

function seedMultipleBoards() {
  const boards = [board([]), { ...board([]), id: "board-second", title: "Second board" }, { ...board([]), id: "board-third", title: "Third board" }];
  window.localStorage.setItem("bindernotes:whiteboards:user-1:binder-1:lesson-1", JSON.stringify(boards));
  return boards;
}

function draw(boardId: string, elementId: string) {
  const scene = {
    elements: [{ id: elementId, type: "rectangle" }],
    appState: { viewBackgroundColor: "#11131a" }, files: {},
  };
  storageMocks.canvasScenes.set(boardId, scene);
  act(() => storageMocks.canvasChanges.get(boardId)?.(scene));
}

function renderWhiteboard(options: Partial<React.ComponentProps<typeof WhiteboardModule>> = {}) {
  const context = {
    ownerId: "user-1",
    binder: {
      id: "binder-1",
      title: "Jacob Math Notes",
      subject: "Math",
    },
    selectedLesson: {
      id: "lesson-1",
      title: "Geometry Language",
    },
    lessons: [{ id: "lesson-1", title: "Geometry Language" }],
    filteredLessons: [{ id: "lesson-1", title: "Geometry Language" }],
    library: {
      binders: [],
      folders: [],
      folderBinders: [],
      lessons: [],
      loading: false,
      error: null,
    },
    history: { enabled: false },
    noteSaveLabel: "Saved",
  } as unknown as WorkspaceModuleContext;

  return render(
    <WhiteboardModule
      context={context}
      renderModule={(moduleId) => <section>{moduleId} module</section>}
      {...options}
    />,
  );
}

function resolveSave(index: number) {
  const pending = storageMocks.pendingSaves[index];
  if (!pending) {
    throw new Error(`No pending save at index ${index}`);
  }

  pending.resolve({
    board: {
      ...pending.board,
      storageMode: "local-draft",
      updatedAt: new Date(index + 1).toISOString(),
    },
    backend: "local",
    status: "local-draft",
    message: "Saved locally",
    savedAt: new Date(index + 1).toISOString(),
  });
}

describe("WhiteboardModule persistence ordering", () => {
  afterEach(() => {
    cleanup();
    storageMocks.pendingSaves = [];
    storageMocks.pendingLoads = [];
    storageMocks.canvasChanges.clear();
    storageMocks.canvasScenes.clear();
    storageMocks.canvasActionsReady.clear();
    storageMocks.deferLoads = false;
    for (const id of ["board-workspace", "board-second", "board-third"]) clearWhiteboardRecoveryDraft("user-1", id);
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("initializes a scoped notebook from its chosen template without opening unrelated account boards and reopens it on reload", async () => {
    const foreign = { ...board([]), id: "foreign-board", binderId: "another-binder", lessonId: "another-lesson", title: "Unrelated board" };
    vi.spyOn(whiteboardStorage, "listWhiteboards").mockResolvedValueOnce({ boards: [foreign], backend: "supabase", status: "loaded", message: "Loaded" });
    const template = { id: "notebook-grid", name: "Geometry notebook", description: "Grid", subject: "math" as const, starterElements: [{ id: "template-prompt", type: "text", x: 0, y: 0, width: 240, height: 24, text: "Explore a geometric proof" }] };
    const first = renderWhiteboard({ scopeOnly: true, initialTemplate: template });
    await waitFor(() => expect(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-elements")).toContain("Explore a geometric proof"));
    expect(screen.queryByText("Unrelated board")).toBeNull();
    const saved = whiteboardStorage.listLocalWhiteboards({ ownerId: "user-1", binderId: "binder-1", lessonId: "lesson-1" });
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe("Geometry notebook");
    first.unmount();
    renderWhiteboard({ scopeOnly: true, initialTemplate: template });
    await waitFor(() => expect(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-id")).toBe(saved[0].id));
    expect(whiteboardStorage.listLocalWhiteboards({ ownerId: "user-1", binderId: "binder-1", lessonId: "lesson-1" })).toHaveLength(1);
  });

  it("ignores stale save completions after a module has been removed", async () => {
    seedBoard();
    renderWhiteboard();

    await waitFor(() => expect(screen.getByTestId("whiteboard-module-card-lower")).toBeTruthy());

    const lowerCard = screen.getByTestId("whiteboard-module-card-lower");
    const chrome = lowerCard.querySelector(".whiteboard-module-card__chrome");
    if (!chrome) {
      throw new Error("Expected lower card chrome");
    }
    Object.assign(chrome, {
      setPointerCapture: vi.fn(),
    });

    fireEvent.pointerDown(chrome, { clientX: 200, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(chrome, { clientX: 210, clientY: 190, pointerId: 1 });

    await waitFor(() => expect(storageMocks.pendingSaves.length).toBeGreaterThan(0));

    const removeButton = lowerCard.querySelector<HTMLButtonElement>('button[aria-label="Remove module"]');
    if (!removeButton) {
      throw new Error("Expected lower card remove button");
    }

    fireEvent.click(removeButton);
    await waitFor(() => expect(screen.queryByTestId("whiteboard-module-card-lower")).toBeNull());

    await act(async () => {
      resolveSave(0);
    });

    expect(screen.queryByTestId("whiteboard-module-card-lower")).toBeNull();
    expect(screen.getByTestId("whiteboard-module-card-upper")).toBeTruthy();
  });

  it("flushes a pending drawing before switching and ignores the old board's save acknowledgement", async () => {
    seedMultipleBoards();
    renderWhiteboard();
    await waitFor(() => expect(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-id")).toBe("board-workspace"));
    draw("board-workspace", "unsaved-rectangle");
    expect(storageMocks.pendingSaves).toHaveLength(0);
    expect(readWhiteboardRecoveryDraft({ ownerId: "user-1" }, "board-workspace")?.scene.elements).toMatchObject([{ id: "unsaved-rectangle" }]);

    fireEvent.click(screen.getByTestId("whiteboard-open-board-second"));
    await waitFor(() => expect(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-id")).toBe("board-second"));
    expect(storageMocks.pendingSaves[0].board.id).toBe("board-workspace");
    expect(storageMocks.pendingSaves[0].board.scene.elements).toMatchObject([{ id: "unsaved-rectangle" }]);
    await act(async () => resolveSave(0));
    expect(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-id")).toBe("board-second");
  });

  it("does not let a delayed board load or unmounted canvas callback change the newly selected board", async () => {
    const boards = seedMultipleBoards();
    storageMocks.deferLoads = true;
    renderWhiteboard();
    await waitFor(() => expect(storageMocks.canvasChanges.has("board-workspace")).toBe(true));
    const oldCanvasChange = storageMocks.canvasChanges.get("board-workspace")!;
    fireEvent.click(screen.getByTestId("whiteboard-open-board-second"));
    fireEvent.click(screen.getByTestId("whiteboard-open-board-third"));
    const savesBeforeLateCallbacks = storageMocks.pendingSaves.length;
    expect(storageMocks.pendingLoads.map((request) => request.boardId)).toEqual(["board-second", "board-third"]);
    await act(async () => storageMocks.pendingLoads[0].resolve({
      boards: [boards[1]], backend: "supabase", status: "loaded", message: "Board loaded",
    }));
    act(() => oldCanvasChange({ elements: [{ id: "late-old-canvas" }] }));
    expect(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-id")).toBe("board-third");
    expect(readWhiteboardRecoveryDraft({ ownerId: "user-1" }, "board-third")).toBeNull();
    expect(storageMocks.pendingSaves).toHaveLength(savesBeforeLateCallbacks);
  });

  it("retains newer strokes when an earlier save completes during the debounce", async () => {
    seedMultipleBoards();
    renderWhiteboard();
    await waitFor(() => expect(storageMocks.canvasChanges.has("board-workspace")).toBe(true));
    draw("board-workspace", "first-stroke");
    fireEvent.click(screen.getByRole("button", { name: "Save whiteboard now" }));
    draw("board-workspace", "newer-stroke");
    await act(async () => resolveSave(0));
    fireEvent.click(screen.getByTestId("whiteboard-open-board-second"));
    expect(storageMocks.pendingSaves[1].board.scene.elements).toMatchObject([{ id: "newer-stroke" }]);
  });

  it("keeps and flushes the last edit when the whiteboard is unmounted before debounce", async () => {
    seedMultipleBoards();
    const rendered = renderWhiteboard();
    await waitFor(() => expect(storageMocks.canvasChanges.has("board-workspace")).toBe(true));
    draw("board-workspace", "before-navigation");
    rendered.unmount();
    expect(storageMocks.pendingSaves[0].board.scene.elements).toMatchObject([{ id: "before-navigation" }]);
    expect(readWhiteboardRecoveryDraft({ ownerId: "user-1" }, "board-workspace")?.scene.elements).toMatchObject([{ id: "before-navigation" }]);
  });

  it("captures an in-progress canvas stroke on pagehide even before the canvas emits its throttled change", async () => {
    seedMultipleBoards();
    renderWhiteboard();
    await waitFor(() => expect(storageMocks.canvasChanges.has("board-workspace")).toBe(true));
    storageMocks.canvasScenes.set("board-workspace", { elements: [{ id: "in-progress-stroke" }] });
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(storageMocks.pendingSaves[0].board.scene.elements).toMatchObject([{ id: "in-progress-stroke" }]);
    expect(readWhiteboardRecoveryDraft({ ownerId: "user-1" }, "board-workspace")?.scene.elements).toMatchObject([{ id: "in-progress-stroke" }]);
  });

  it("captures unflushed drawing edits when a module change starts a save", async () => {
    seedBoard();
    renderWhiteboard();
    await waitFor(() => expect(screen.getByTestId("whiteboard-module-card-lower")).toBeTruthy());
    storageMocks.canvasScenes.set("board-workspace", { elements: [{ id: "unflushed-drawing" }] });
    fireEvent.click(screen.getByTestId("whiteboard-module-card-lower").querySelector<HTMLButtonElement>('button[aria-label="Remove module"]')!);
    expect(storageMocks.pendingSaves.at(-1)?.board.scene.elements).toMatchObject([{ id: "unflushed-drawing" }]);
    expect(readWhiteboardRecoveryDraft({ ownerId: "user-1" }, "board-workspace")?.scene.elements).toMatchObject([{ id: "unflushed-drawing" }]);
  });

  it("undoes and redoes module removal while keeping drawing content and pending saves intact", async () => {
    seedBoard();
    renderWhiteboard();
    await waitFor(() => expect(screen.getByTestId("whiteboard-module-card-lower")).toBeTruthy());
    draw("board-workspace", "drawing-kept");
    const lowerCard = screen.getByTestId("whiteboard-module-card-lower");
    fireEvent.click(lowerCard.querySelector<HTMLButtonElement>('button[aria-label="Remove module"]')!);
    expect(screen.queryByTestId("whiteboard-module-card-lower")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo module change" }));
    expect(screen.getByTestId("whiteboard-module-card-lower")).toBeTruthy();
    expect(storageMocks.pendingSaves.at(-1)?.board.scene.elements).toMatchObject([{ id: "drawing-kept" }]);
    fireEvent.click(screen.getByRole("button", { name: "Redo module change" }));
    expect(screen.queryByTestId("whiteboard-module-card-lower")).toBeNull();
    expect(storageMocks.pendingSaves.at(-1)?.board.modules.map((module) => module.id)).toEqual(["upper"]);
  });

  it("resets module history when changing boards so undo cannot import another board's cards", async () => {
    seedBoard();
    const key = "bindernotes:whiteboards:user-1:binder-1:lesson-1";
    window.localStorage.setItem(key, JSON.stringify([
      ...JSON.parse(window.localStorage.getItem(key)!), { ...board([]), id: "board-second", title: "Second board" },
    ]));
    renderWhiteboard();
    await waitFor(() => expect(screen.getByTestId("whiteboard-module-card-lower")).toBeTruthy());
    fireEvent.click(screen.getByTestId("whiteboard-module-card-lower").querySelector<HTMLButtonElement>('button[aria-label="Remove module"]')!);
    expect((screen.getByRole("button", { name: "Undo module change" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId("whiteboard-open-board-second"));
    await waitFor(() => expect(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-id")).toBe("board-second"));
    expect((screen.getByRole("button", { name: "Undo module change" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Redo module change" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("whiteboard-module-card-lower")).toBeNull();
  });

  it("ignores late action registration and cleanup from a canvas belonging to the previous board", async () => {
    seedMultipleBoards();
    renderWhiteboard();
    await waitFor(() => expect(storageMocks.canvasActionsReady.has("board-workspace")).toBe(true));
    const previousActionsReady = storageMocks.canvasActionsReady.get("board-workspace")!;
    fireEvent.click(screen.getByTestId("whiteboard-open-board-second"));
    await waitFor(() => expect(storageMocks.canvasActionsReady.has("board-second")).toBe(true));
    act(() => {
      previousActionsReady({ getScene: () => ({ elements: [{ id: "wrong-board-stroke" }] }), fitAll: () => {}, exportSvg: async () => {} });
      previousActionsReady(null);
    });
    storageMocks.canvasScenes.set("board-second", { elements: [{ id: "correct-board-stroke" }] });
    fireEvent.click(screen.getByRole("button", { name: "Save whiteboard now" }));
    expect(storageMocks.pendingSaves.at(-1)?.board.id).toBe("board-second");
    expect(storageMocks.pendingSaves.at(-1)?.board.scene.elements).toMatchObject([{ id: "correct-board-stroke" }]);
  });

  it("retains the latest in-memory edit across A to B to A when cloud and browser storage fail", async () => {
    seedMultipleBoards();
    renderWhiteboard();
    await waitFor(() => expect(storageMocks.canvasChanges.has("board-workspace")).toBe(true));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    draw("board-workspace", "memory-only-stroke");
    fireEvent.click(screen.getByTestId("whiteboard-open-board-second"));
    await act(async () => storageMocks.pendingSaves[0].resolve({
      board: storageMocks.pendingSaves[0].board, backend: "local", status: "error",
      message: "Cloud and device storage failed. Keep this tab open.", savedAt: new Date().toISOString(),
    }));
    fireEvent.click(screen.getByTestId("whiteboard-open-board-workspace"));
    await waitFor(() => expect(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-id")).toBe("board-workspace"));
    expect(JSON.parse(screen.getByTestId("whiteboard-excalidraw-host").getAttribute("data-board-elements")!)).toMatchObject([{ id: "memory-only-stroke" }]);
    expect(screen.getAllByText(/Unsynced changes recovered in this tab/i).length).toBeGreaterThan(0);
  });
});
