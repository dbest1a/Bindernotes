// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardBoardList } from "@/components/whiteboard/whiteboard-board-list";
import { WhiteboardModuleLauncher } from "@/components/whiteboard/whiteboard-module-launcher";
import { WhiteboardTemplatePicker } from "@/components/whiteboard/whiteboard-template-picker";
import type { BinderWhiteboard } from "@/lib/whiteboards/whiteboard-types";

const board: BinderWhiteboard = {
  archivedAt: null,
  assetSizeBytes: 0,
  binderId: "binder-jacob-math-notes",
  createdAt: new Date(0).toISOString(),
  id: "board-1",
  lessonId: "lesson-1",
  moduleContext: "lesson",
  modules: [],
  objectCount: 12,
  ownerId: "user-1",
  scene: { elements: [] },
  sceneSizeBytes: 0,
  storageMode: "local-draft",
  subject: "Mathematics",
  title: "Geometry Diagram",
  updatedAt: new Date(0).toISOString(),
};

afterEach(() => {
  cleanup();
});

describe("compact whiteboard toolbox beta surfaces", () => {
  it("keeps templates unmounted until the student opens Templates", () => {
    render(
      <WhiteboardTemplatePicker
        compact
        onCreateFromTemplate={vi.fn()}
        open={false}
        templates={[
          {
            description: "A clean graph-paper style space.",
            id: "blank",
            name: "Blank Board",
            subject: "math",
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /templates/i })).toBeTruthy();
    expect(screen.queryByText("Blank Board")).toBeNull();
  });

  it("opens the compact template panel only when requested", () => {
    render(
      <WhiteboardTemplatePicker
        compact
        onCreateFromTemplate={vi.fn()}
        open
        templates={[
          {
            description: "A clean graph-paper style space.",
            id: "blank",
            name: "Blank Board",
            subject: "math",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("whiteboard-templates-panel")).toBeTruthy();
    expect(screen.getByText("Blank Board")).toBeTruthy();
  });

  it("puts New blank board beside recent boards in compact mode without always showing the limit badge", () => {
    const onCreateBlankBoard = vi.fn();

    render(
      <WhiteboardBoardList
        activeBoardId="board-1"
        boards={[board]}
        compact
        onCreateBlankBoard={onCreateBlankBoard}
        onSelectBoard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new blank board/i }));

    expect(onCreateBlankBoard).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("whiteboard-board-count")).toBeNull();
  });

  it("shows the whiteboard limit only when compact mode says the limit matters", () => {
    render(
      <WhiteboardBoardList
        activeBoardId="board-1"
        boards={[board, { ...board, id: "board-2" }, { ...board, id: "board-3" }]}
        compact
        onSelectBoard={vi.fn()}
        showLimitStatus
      />,
    );

    expect(screen.getByTestId("whiteboard-board-count").textContent).toContain("3 / 3");
  });

  it("uses compact module search instead of long categories", () => {
    render(<WhiteboardModuleLauncher compact contextKind="math" onAddModule={vi.fn()} placement="panel" />);

    fireEvent.click(screen.getByRole("button", { name: /add module/i }));
    fireEvent.change(screen.getByTestId("whiteboard-module-search"), { target: { value: "graph" } });

    expect(screen.getByText("Desmos Graph")).toBeTruthy();
    expect(screen.queryByText("Formula Sheet")).toBeNull();
    expect(screen.queryByText("Core")).toBeNull();
    expect(screen.queryByText("Math")).toBeNull();
  });
});
