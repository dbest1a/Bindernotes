// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhiteboardStudyTools } from "./whiteboard-study-tools";
import type { WhiteboardCanvasActions } from "./whiteboard-canvas";
import type { BinderWhiteboard, WhiteboardSceneData } from "@/lib/whiteboards/whiteboard-types";
import type { WhiteboardViewportTransform } from "@/lib/whiteboards/whiteboard-coordinate-utils";

const { download } = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/lib/whiteboards/whiteboard-export", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/whiteboards/whiteboard-export")>(),
  downloadWhiteboardFile: download,
}));

const viewport: WhiteboardViewportTransform = { scrollX: 10, scrollY: 20, zoom: 2, viewportWidth: 1000, viewportHeight: 800 };
const board: BinderWhiteboard = {
  id: "board-a", ownerId: "owner-a", binderId: "binder-a", lessonId: null, title: "Exam practice", subject: "math", moduleContext: "math-lab",
  scene: { elements: [] }, modules: [], objectCount: 0, sceneSizeBytes: 0, assetSizeBytes: 0, storageMode: "local-draft",
  createdAt: "2026-09-24T00:00:00Z", updatedAt: "2026-09-24T00:00:00Z", archivedAt: null,
};
const bookmarkKey = (candidate: BinderWhiteboard) => `bindernotes:whiteboard-bookmarks:${candidate.ownerId}:${candidate.id}`;

function propsFor(candidate = board) {
  const actions: WhiteboardCanvasActions = { fitAll: vi.fn(), getScene: vi.fn(() => candidate.scene), exportSvg: vi.fn().mockResolvedValue(undefined) };
  return { board: candidate, getActions: () => actions, viewport, onViewport: vi.fn(), sourceText: {}, onStickyNote: vi.fn(), onArrange: vi.fn() };
}

function openTools() {
  fireEvent.click(screen.getByText("Navigate, organize & export"));
}

describe("WhiteboardStudyTools", () => {
  beforeEach(() => { localStorage.clear(); download.mockReset(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("searches live drawing text and linked lesson text, and navigates to fixed-size cards in board coordinates", () => {
    const candidate: BinderWhiteboard = { ...board, modules: [{
      id: "lesson", type: "bindernotes-module", moduleId: "lesson", title: "Triangle lesson", x: 500, y: 200, width: 400, height: 300,
      zIndex: 1, mode: "live", anchorMode: "board-fixed-size", createdAt: board.createdAt, updatedAt: board.updatedAt,
    }] };
    const props = propsFor(candidate);
    props.sourceText = { lesson: "Pythagoras connects the sides of a triangle." };
    vi.mocked(props.getActions().getScene).mockReturnValue({ elements: [
      { id: "ink", type: "text", text: "Pythagoras drawing", x: 0, y: 0, width: 100, height: 40 },
      { id: "deleted", type: "text", text: "Pythagoras deleted", x: 10, y: 10, width: 100, height: 40, isDeleted: true },
    ] });
    render(<WhiteboardStudyTools {...props} />);
    openTools();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find text or a card" }), { target: { value: "PYTHAGORAS" } });
    const results = screen.getByLabelText("Board search results");
    expect(within(results).getByRole("button", { name: "Pythagoras drawing" })).toBeTruthy();
    expect(within(results).queryByRole("button", { name: "Pythagoras deleted" })).toBeNull();
    fireEvent.click(within(results).getByRole("button", { name: "Triangle lesson" }));
    const next = props.onViewport.mock.calls[0][0] as WhiteboardViewportTransform;
    expect((600 + next.scrollX) * next.zoom).toBeCloseTo(500);
    expect((275 + next.scrollY) * next.zoom).toBeCloseTo(400);
    const minimap = screen.getByRole("img", { name: "Board overview" });
    expect(minimap.querySelectorAll("rect")).toHaveLength(3);
    expect(minimap.querySelector('rect[x="500"]')?.getAttribute("width")).toBe("200");
  });

  it("scopes saved views to the current board and account when the panel is reused", () => {
    localStorage.setItem(bookmarkKey(board), JSON.stringify([{ name: "My old view", viewport }]));
    const props = propsFor();
    const { rerender } = render(<WhiteboardStudyTools {...props} />);
    openTools();
    fireEvent.click(screen.getByRole("button", { name: "My old view" }));
    expect(props.onViewport).toHaveBeenCalledWith(viewport);
    const nextBoard = { ...board, id: "board-b", ownerId: "owner-b" };
    rerender(<WhiteboardStudyTools {...props} board={nextBoard} />);
    expect(screen.queryByRole("button", { name: "My old view" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Bookmark this view" }), { target: { value: " New view " } });
    fireEvent.click(screen.getByRole("button", { name: "Save view on this device" }));
    expect(JSON.parse(localStorage.getItem(bookmarkKey(nextBoard))!)[0].name).toBe("New view");
    expect(JSON.parse(localStorage.getItem(bookmarkKey(board))!)[0].name).toBe("My old view");
    fireEvent.click(screen.getByRole("button", { name: "Remove bookmark New view" }));
    expect(JSON.parse(localStorage.getItem(bookmarkKey(nextBoard))!)).toEqual([]);
  });

  it("allows replacing an existing view at the 20-view limit", () => {
    localStorage.setItem(bookmarkKey(board), JSON.stringify(Array.from({ length: 20 }, (_, index) => ({ name: `View ${index}`, viewport: { ...viewport, zoom: 0.5 } }))));
    render(<WhiteboardStudyTools {...propsFor()} />);
    openTools();
    const name = screen.getByRole("textbox", { name: "Bookmark this view" });
    fireEvent.change(name, { target: { value: "New name" } });
    expect((screen.getByRole("button", { name: "Save view on this device" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(name, { target: { value: "View 0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save view on this device" }));
    const saved = JSON.parse(localStorage.getItem(bookmarkKey(board))!);
    expect(saved).toHaveLength(20);
    expect(saved.find((item: { name: string }) => item.name === "View 0").viewport.zoom).toBe(2);
  });

  it("ignores malformed saved views and reports storage failures without claiming a save", () => {
    localStorage.setItem(bookmarkKey(board), JSON.stringify([null, { name: "Valid", viewport }, { name: "Broken", viewport: { zoom: -1 } }]));
    render(<WhiteboardStudyTools {...propsFor()} />);
    openTools();
    expect(screen.getByRole("button", { name: "Valid" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Broken" })).toBeNull();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota reached"); });
    fireEvent.change(screen.getByRole("textbox", { name: "Bookmark this view" }), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Save view on this device" }));
    expect(screen.getByRole("status").textContent).toContain("could not save");
    expect(screen.queryByRole("button", { name: "Unsaved" })).toBeNull();
  });

  it("discloses static export scope and supports retry after an SVG failure", async () => {
    const props = propsFor();
    vi.mocked(props.getActions().exportSvg).mockRejectedValueOnce(new Error("An image could not be loaded."));
    render(<WhiteboardStudyTools {...props} />);
    openTools();
    expect(screen.getByText(/SVG includes drawings and static study-card text/).textContent).toContain("canvas Image menu exports drawings only");
    fireEvent.click(screen.getByRole("button", { name: "Export board SVG" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("An image could not be loaded."));
    fireEvent.click(screen.getByRole("button", { name: "Export board SVG" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Board SVG downloaded."));
    expect(props.getActions().exportSvg).toHaveBeenCalledTimes(2);
  });

  it("backs up the latest scene at click time and reports download failures", () => {
    let scene: WhiteboardSceneData = { elements: [] };
    const props = propsFor();
    vi.mocked(props.getActions().getScene).mockImplementation(() => scene);
    render(<WhiteboardStudyTools {...props} />);
    openTools();
    scene = { elements: [{ id: "new-drawing", type: "rectangle", x: 10, y: 20, width: 30, height: 40 }] };
    fireEvent.click(screen.getByRole("button", { name: "Download JSON backup" }));
    const backup = JSON.parse(download.mock.calls[0][2]);
    expect(backup.board.scene.elements[0].id).toBe("new-drawing");
    expect(backup.board.ownerId).toBeUndefined();
    download.mockImplementationOnce(() => { throw new Error("Download blocked"); });
    fireEvent.click(screen.getByRole("button", { name: "Download JSON backup" }));
    expect(screen.getByRole("status").textContent).toBe("Could not export backup. Try again.");
  });

  it("keeps module actions usable in an embedded sidebar and isolates keyboard editing", () => {
    const props = propsFor();
    const shortcut = vi.fn();
    render(<aside onKeyDown={shortcut} onKeyUp={shortcut}><WhiteboardStudyTools {...props} /></aside>);
    openTools();
    fireEvent.click(screen.getByRole("button", { name: "Fit all content" }));
    fireEvent.click(screen.getByRole("button", { name: "Add sticky note" }));
    fireEvent.click(screen.getByRole("button", { name: "100% zoom" }));
    expect(props.getActions().fitAll).toHaveBeenCalledOnce();
    expect(props.onStickyNote).toHaveBeenCalledOnce();
    expect(props.onViewport).toHaveBeenCalledWith({ ...viewport, zoom: 1 });
    expect((screen.getByRole("button", { name: "Arrange cards" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "z", ctrlKey: true });
    fireEvent.keyUp(screen.getByRole("searchbox"), { key: "z", ctrlKey: true });
    expect(shortcut).not.toHaveBeenCalled();
  });
});
