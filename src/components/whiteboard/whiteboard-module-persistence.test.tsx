// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardModule } from "@/components/whiteboard/whiteboard-module";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { BinderWhiteboard, WhiteboardSaveResult } from "@/lib/whiteboards/whiteboard-types";
import type { WorkspaceModuleId } from "@/types";

const storageMocks = vi.hoisted(() => ({
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
  WhiteboardCanvas: () => <div data-testid="whiteboard-excalidraw-host" />,
}));

vi.mock("@/lib/whiteboards/whiteboard-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/whiteboards/whiteboard-storage")>();
  return {
    ...actual,
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
    window.localStorage.clear();
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
});
