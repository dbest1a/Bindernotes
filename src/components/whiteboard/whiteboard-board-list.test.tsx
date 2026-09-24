// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardBoardList } from "./whiteboard-board-list";
import type { BinderWhiteboard } from "@/lib/whiteboards/whiteboard-types";

function board(id: string, title: string, subject: string, objectCount = 1): BinderWhiteboard {
  return { id, title, subject, objectCount, ownerId: "owner", binderId: "binder", lessonId: null, moduleContext: "math-lab", scene: { elements: [] }, modules: [], sceneSizeBytes: 0, assetSizeBytes: 0, storageMode: "local-draft", createdAt: "2026-09-24T00:00:00Z", updatedAt: "2026-09-24T00:00:00Z", archivedAt: null };
}
const boards = [board("one", "Exam preparation", "Mathematics"), board("two", "Project notes", "Physics", 2)];

describe("WhiteboardBoardList", () => {
  afterEach(cleanup);

  it("searches title and subject without changing the account-wide saved count", () => {
    const select = vi.fn();
    render(<WhiteboardBoardList boards={boards} activeBoardId="one" onSelectBoard={select} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search whiteboards" }), { target: { value: " PHYSICS " } });
    expect(screen.queryByTestId("whiteboard-open-one")).toBeNull();
    expect(screen.getByTestId("whiteboard-board-count").textContent).toContain("2 / 3 saved");
    fireEvent.click(screen.getByTestId("whiteboard-open-two"));
    expect(select).toHaveBeenCalledWith("two");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "exam" } });
    expect(screen.getByTestId("whiteboard-open-one").getAttribute("aria-current")).toBe("true");
    expect(screen.getByTestId("whiteboard-open-one").textContent).toContain("1 object");
    expect(screen.getByTestId("whiteboard-open-one").textContent).not.toContain("1 objects");
  });

  it("lets users clear a search after an archive reduces the list to one board", () => {
    const props = { boards, activeBoardId: "one", onSelectBoard: vi.fn() };
    const { rerender } = render(<WhiteboardBoardList {...props} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Project" } });
    rerender(<WhiteboardBoardList {...props} boards={[boards[0]]} />);
    expect(screen.getByRole("status").textContent).toBe("No matching boards.");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(screen.getByTestId("whiteboard-open-one")).toBeTruthy();
  });

  it("archives the requested board without opening it", () => {
    const select = vi.fn(), archive = vi.fn();
    render(<WhiteboardBoardList boards={boards} activeBoardId="one" onSelectBoard={select} onArchiveBoard={archive} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive Project notes" }));
    expect(archive).toHaveBeenCalledWith("two");
    expect(select).not.toHaveBeenCalled();
  });
});
