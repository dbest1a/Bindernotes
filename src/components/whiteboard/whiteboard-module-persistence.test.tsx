// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveQueue } from "@/lib/save-queue";
import { WhiteboardModule } from "@/components/whiteboard/whiteboard-module";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { BinderWhiteboard, WhiteboardListResult, WhiteboardSaveResult, WhiteboardSceneData } from "@/lib/whiteboards/whiteboard-types";
import { getWhiteboardDraft } from "@/lib/whiteboards/whiteboard-drafts";
import type { WorkspaceModuleId } from "@/types";

beforeEach(() => saveQueue.setAccount("user-1"));
afterEach(() => saveQueue.setAccount(null));

const storageMocks = vi.hoisted(() => ({
  canvas: null as { board: BinderWhiteboard; onSceneChange: (scene: WhiteboardSceneData) => void; onRetireScene: (scene: WhiteboardSceneData) => void } | null,
  deferLoads: false,
  pendingLoads: [] as Array<{ boardId: string; resolve: (result: WhiteboardListResult) => void }>,
  pendingSaves: [] as Array<{
    board: BinderWhiteboard;
    expectedRevision: number;
    resolve: (result: WhiteboardSaveResult) => void;
  }>,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseProjectRef: null,
}));

vi.mock("@/components/whiteboard/whiteboard-canvas", () => ({
  WhiteboardCanvas: (props: NonNullable<typeof storageMocks.canvas>) => {
    storageMocks.canvas = props;
    return <div data-testid="whiteboard-excalidraw-host" data-board-id={props.board.id} />;
  },
}));

vi.mock("@/lib/whiteboards/whiteboard-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/whiteboards/whiteboard-storage")>();
  return {
    ...actual,
    loadWhiteboard: vi.fn((scope, boardId: string) => storageMocks.deferLoads ? new Promise<WhiteboardListResult>((resolve) => storageMocks.pendingLoads.push({ boardId, resolve })) : actual.loadWhiteboard(scope, boardId)),
    saveWhiteboard: vi.fn((board: BinderWhiteboard, options?: { expectedRevision?: number }) =>
      new Promise<WhiteboardSaveResult>((resolve) => {
        storageMocks.pendingSaves.push({ board, expectedRevision: options?.expectedRevision ?? 0, resolve });
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

function renderWhiteboard() {
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
      storageMode: "supabase",
      revision: pending.expectedRevision + 1,
      updatedAt: new Date(index + 1).toISOString(),
    },
    backend: "supabase",
    status: "saved",
    message: "Saved",
    savedAt: new Date(index + 1).toISOString(),
  });
}

describe("WhiteboardModule persistence ordering", () => {
  afterEach(() => {
    cleanup();
    storageMocks.pendingSaves = [];
    storageMocks.pendingLoads = [];
    storageMocks.deferLoads = false;
    storageMocks.canvas = null;
    window.localStorage.clear();
    vi.useRealTimers();
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

  it("keeps a pending A scene when selecting B and unmounting before autosave", async () => {
    const a = board([]); const b = { ...board([]), id: "board-b", title: "Board B" };
    localStorage.setItem("bindernotes:whiteboards:user-1:binder-1:lesson-1", JSON.stringify([a, b]));
    const view = renderWhiteboard();
    await act(async () => {});
    vi.useFakeTimers();
    const callbackA = storageMocks.canvas!.onSceneChange;
    act(() => callbackA({ elements: [{ id: "stroke-a", version: 1 }] }));
    fireEvent.click(screen.getByTestId("whiteboard-open-board-b"));
    await act(async () => {});
    expect(storageMocks.canvas!.board.id).toBe("board-b");
    act(() => callbackA({ elements: [{ id: "late-a", version: 1 }] }));
    expect(storageMocks.canvas!.board.scene.elements).toEqual([]);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(storageMocks.pendingSaves).toHaveLength(1);
    expect(storageMocks.pendingSaves[0].board).toMatchObject({ id: a.id, scene: { elements: [{ id: "stroke-a" }] } });
    expect(Object.keys(localStorage).some((key) => key.startsWith("bindernotes:whiteboard-draft:v1:"))).toBe(true);
  });

  it("persists a retiring canvas scene to A while B remains selected", async () => {
    const a = board([]); const b = { ...board([]), id: "board-b" };
    localStorage.setItem("bindernotes:whiteboards:user-1:binder-1:lesson-1", JSON.stringify([a, b]));
    renderWhiteboard(); await act(async () => {});
    const retireA = storageMocks.canvas!.onRetireScene;
    fireEvent.click(screen.getByTestId("whiteboard-open-board-b")); await act(async () => {});
    act(() => retireA({ elements: [{ id: "last-stroke-a", version: 1 }] }));
    expect(storageMocks.canvas!.board.id).toBe("board-b");
    expect(storageMocks.canvas!.board.scene.elements).toEqual([]);
    expect(getWhiteboardDraft(a).getSnapshot().snapshot.scene.elements).toEqual([{ id: "last-stroke-a", version: 1 }]);
  });

  it("rejects late board loads after a newer selection", async () => {
    const a = board([]); const b = { ...board([]), id: "board-b" };
    localStorage.setItem("bindernotes:whiteboards:user-1:binder-1:lesson-1", JSON.stringify([a, b]));
    renderWhiteboard(); await act(async () => {});
    storageMocks.deferLoads = true;
    fireEvent.click(screen.getByTestId(`whiteboard-open-${a.id}`));
    fireEvent.click(screen.getByTestId("whiteboard-open-board-b"));
    await act(async () => {
      storageMocks.pendingLoads[1].resolve({ boards: [b], backend: "supabase", status: "loaded", message: "Loaded" });
      storageMocks.pendingLoads[0].resolve({ boards: [a], backend: "supabase", status: "loaded", message: "Loaded" });
    });
    expect(storageMocks.canvas!.board.id).toBe("board-b");
  });

  it("offers an explicit remote choice after conflict and remounts the canvas", async () => {
    const a = board([]); localStorage.setItem("bindernotes:whiteboards:user-1:binder-1:lesson-1", JSON.stringify([a]));
    renderWhiteboard(); await act(async () => {});
    act(() => storageMocks.canvas!.onSceneChange({ elements: [{ id: "my-draft", version: 1 }] }));
    fireEvent.click(screen.getByRole("button", { name: "Save whiteboard now" }));
    await act(async () => storageMocks.pendingSaves[0].resolve({ board: a, backend: "supabase", status: "conflict", message: "Conflict", savedAt: "now" }));
    expect(screen.getByRole("button", { name: "Save draft as a copy" })).toBeTruthy();
    storageMocks.deferLoads = true;
    const oldCanvas = screen.getByTestId("whiteboard-excalidraw-host");
    fireEvent.click(screen.getByRole("button", { name: "Load saved version" }));
    await act(async () => storageMocks.pendingLoads[0].resolve({ boards: [{ ...a, revision: 5, scene: { elements: [{ id: "remote", version: 1 }] } }], backend: "supabase", status: "loaded", message: "Loaded" }));
    expect(storageMocks.canvas!.board.scene.elements).toEqual([{ id: "remote", version: 1 }]);
    expect(oldCanvas.isConnected).toBe(false);
    expect(screen.queryByRole("button", { name: "Load saved version" })).toBeNull();
  });
});
