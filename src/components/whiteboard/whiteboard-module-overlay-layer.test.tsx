// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardModuleOverlayLayer } from "@/components/whiteboard/whiteboard-module-overlay-layer";
import { WhiteboardPinnedObjectLayer } from "@/components/whiteboard/whiteboard-pinned-object-layer";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";
import type { WhiteboardViewportTransform } from "@/lib/whiteboards/whiteboard-coordinate-utils";

const context = {} as WorkspaceModuleContext;

function moduleElement(overrides: Partial<WhiteboardModuleElement> = {}): WhiteboardModuleElement {
  return {
    id: "module-1",
    type: "bindernotes-module",
    moduleId: "desmos-graph",
    x: 100,
    y: 120,
    width: 420,
    height: 320,
    zIndex: 4,
    mode: "live",
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    anchorMode: "board",
    pinned: true,
    ...overrides,
  };
}

const viewport: WhiteboardViewportTransform = {
  scrollX: 20,
  scrollY: -30,
  zoom: 2,
  viewportWidth: 1280,
  viewportHeight: 720,
};

describe("WhiteboardModuleOverlayLayer", () => {
  afterEach(() => cleanup());

  it("renders module cards in board coordinates transformed by Excalidraw pan and zoom", () => {
    render(
      <WhiteboardModuleOverlayLayer
        context={context}
        modules={[moduleElement({ moduleId: "saved-graphs" })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Live graph</div>}
        viewportTransform={viewport}
      />,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    const boardOverlay = screen.getByTestId("whiteboard-board-object-overlay");
    const viewportOverlay = screen.getByTestId("whiteboard-viewport-tool-overlay");
    expect(boardOverlay.querySelector('[data-card-anchor="board"]')).toBeTruthy();
    expect(viewportOverlay.querySelector('[data-card-anchor="board"]')).toBeNull();
    expect(card.getAttribute("data-whiteboard-module-presentation")).toBe("live");
    expect(card.getAttribute("data-card-anchor")).toBe("board");
    expect(card.getAttribute("data-card-render-layer")).toBe("board");
    expect(card.getAttribute("data-card-scene-x")).toBe("100");
    expect(card.getAttribute("data-card-scene-y")).toBe("120");
    expect(card.getAttribute("data-card-scene-width")).toBe("420");
    expect(card.getAttribute("data-card-scene-height")).toBe("320");
    expect(card.getAttribute("data-card-render-x")).toBe("240");
    expect(card.getAttribute("data-card-render-y")).toBe("180");
    expect(card.getAttribute("data-card-render-zoom")).toBe("2");
    expect(card.getAttribute("style")).toContain("left: 0px");
    expect(card.getAttribute("style")).toContain("top: 0px");
    expect(card.getAttribute("style")).toContain("width: 420px");
    expect(card.getAttribute("style")).toContain("height: 320px");
    expect(card.getAttribute("style")).toContain("transform: translate3d(240px, 180px, 0) scale(2)");
    expect(screen.getByText("Live graph")).toBeTruthy();
  });

  it("camera changes do not convert or save board-pinned module coordinates", () => {
    const module = moduleElement({ moduleId: "scientific-calculator", anchorMode: "board", x: 100, y: 120, width: 420, height: 320 });
    const onChangeModule = vi.fn();
    const { rerender } = render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[module]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Live graph</div>}
        viewportTransform={viewport}
      />,
    );

    rerender(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[module]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Live graph</div>}
        viewportTransform={{
          scrollX: 50,
          scrollY: -10,
          zoom: 0.5,
          viewportWidth: 1280,
          viewportHeight: 720,
        }}
      />,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(onChangeModule).not.toHaveBeenCalled();
    expect(card.getAttribute("data-card-anchor")).toBe("board");
    expect(card.getAttribute("data-card-render-layer")).toBe("board");
    expect(card.getAttribute("data-card-scene-x")).toBe("100");
    expect(card.getAttribute("data-card-scene-y")).toBe("120");
    expect(card.getAttribute("data-card-render-x")).toBe("75");
    expect(card.getAttribute("data-card-render-y")).toBe("55");
    expect(card.getAttribute("data-card-render-zoom")).toBe("0.5");
    expect(card.getAttribute("style")).toContain("transform: translate3d(75px, 55px, 0) scale(0.5)");
  });

  it("does not mount regular live content when low zoom forces preview mode", () => {
    const renderModule = vi.fn(() => <div>Live graph</div>);

    render(
      <WhiteboardModuleOverlayLayer
        context={context}
        modules={[moduleElement({ moduleId: "saved-graphs" })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={{ ...viewport, zoom: 0.45 }}
      />,
    );

    expect(renderModule).not.toHaveBeenCalled();
    expect(screen.getByTestId("whiteboard-module-card-module-1").getAttribute("data-whiteboard-module-presentation")).toBe("preview");
  });

  it("does not mount regular live content when the board card is offscreen", () => {
    const renderModule = vi.fn(() => <div>Live graph</div>);

    render(
      <WhiteboardModuleOverlayLayer
        context={context}
        modules={[moduleElement({ moduleId: "saved-graphs", x: 6000, y: 6000 })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    expect(renderModule).not.toHaveBeenCalled();
    expect(screen.getByTestId("whiteboard-module-card-module-1").getAttribute("data-whiteboard-module-presentation")).toBe("preview");
  });

  it("keeps board-pinned scientific calculator live through preview-scale zoom", () => {
    const renderModule = vi.fn(() => <div>Live calculator</div>);

    render(
      <WhiteboardModuleOverlayLayer
        context={context}
        modules={[moduleElement({ moduleId: "scientific-calculator" })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={{ ...viewport, zoom: 0.2 }}
      />,
    );

    expect(renderModule).toHaveBeenCalledWith("scientific-calculator", expect.any(Object));
    expect(screen.getByTestId("whiteboard-module-card-module-1").getAttribute("data-whiteboard-module-presentation")).toBe("live");
    expect(screen.queryByText(/zoom in or enlarge this card/i)).toBeNull();
    expect(screen.getByText("Live calculator")).toBeTruthy();
  });

  it("keeps the card anchored to board coordinates when zoomed far out", () => {
    const renderModule = vi.fn(() => <div>Live graph</div>);

    render(
      <WhiteboardModuleOverlayLayer
        context={context}
        modules={[moduleElement({ moduleId: "saved-graphs" })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={{
          scrollX: 40,
          scrollY: 20,
          zoom: 0.25,
          viewportWidth: 1280,
          viewportHeight: 720,
        }}
      />,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(card.getAttribute("data-whiteboard-module-presentation")).toBe("chip");
    expect(card.getAttribute("style")).toContain("width: 420px");
    expect(card.getAttribute("style")).toContain("height: 320px");
    expect(card.getAttribute("style")).toContain("transform: translate3d(35px, 35px, 0) scale(0.25)");
    expect(renderModule).not.toHaveBeenCalled();
  });

  it("can render as a fixed board-pinned layer for full-screen lab mode", () => {
    render(
      <WhiteboardPinnedObjectLayer
        context={context}
        fixed
        modules={[moduleElement({ moduleId: "scientific-calculator" })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Live graph</div>}
        viewportTransform={{ ...viewport, offsetLeft: 12, offsetTop: 20 }}
      />,
    );

    const layer = screen.getByTestId("whiteboard-pinned-object-layer");
    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(layer.className).toContain("fixed");
    expect(layer.className).toContain("z-[55]");
    expect(card.getAttribute("style")).toContain("transform: translate3d(252px, 200px, 0) scale(2)");
  });

  it("keeps floating cards in screen space while pinned cards move with board pan", () => {
    render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[
          moduleElement({ id: "pinned", moduleId: "scientific-calculator", anchorMode: "board", pinned: true, x: 100, y: 100 }),
          moduleElement({ id: "floating", moduleId: "scientific-calculator", anchorMode: "viewport", pinned: false, x: 100, y: 100, width: 420, height: 320 }),
        ]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Live graph</div>}
        viewportTransform={viewport}
      />,
    );

    expect(screen.getByTestId("whiteboard-module-card-pinned").getAttribute("style")).toContain(
      "transform: translate3d(240px, 140px, 0) scale(2)",
    );
    expect(screen.getByTestId("whiteboard-module-card-floating").getAttribute("style")).toContain("left: 100px");
    expect(screen.getByTestId("whiteboard-module-card-floating").getAttribute("data-whiteboard-module-anchor")).toBe("viewport");
  });

  it("renders viewport anchored Desmos in the viewport tool overlay without camera scaling", () => {
    render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[moduleElement({ anchorMode: "viewport", pinned: false, x: 120, y: 140, width: 720, height: 560 })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Live graph</div>}
        viewportTransform={viewport}
      />,
    );

    const boardOverlay = screen.getByTestId("whiteboard-board-object-overlay");
    const viewportOverlay = screen.getByTestId("whiteboard-viewport-tool-overlay");
    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(boardOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeNull();
    expect(viewportOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeTruthy();
    expect(card.getAttribute("style")).toContain("left: 120px");
    expect(card.getAttribute("style")).toContain("top: 140px");
    expect(card.getAttribute("style")).toContain("width: 720px");
    expect(card.getAttribute("style")).toContain("height: 560px");
    expect(card.getAttribute("data-card-render-layer")).toBe("viewport");
    expect(card.getAttribute("style")).not.toContain("scale(");
  });

  it("does not remount viewport Desmos content when Excalidraw pans or zooms", () => {
    const mounted: string[] = [];
    function LiveGraph() {
      mounted.push("render");
      return <div>Live graph</div>;
    }
    const modules = [moduleElement({ anchorMode: "viewport", pinned: false, x: 120, y: 140, width: 720, height: 560 })];
    const renderModule = vi.fn(() => <LiveGraph />);
    const onChangeModule = vi.fn();
    const onRemoveModule = vi.fn();
    const { rerender } = render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={modules}
        onChangeModule={onChangeModule}
        onRemoveModule={onRemoveModule}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    rerender(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={modules}
        onChangeModule={onChangeModule}
        onRemoveModule={onRemoveModule}
        renderModule={renderModule}
        viewportTransform={{ ...viewport, scrollX: 700, scrollY: 350, zoom: 0.4 }}
      />,
    );

    expect(renderModule).toHaveBeenCalledTimes(1);
    expect(mounted).toHaveLength(1);
  });

  it("does not remount board-pinned Desmos content when Excalidraw pans or zooms", () => {
    let mounts = 0;
    let unmounts = 0;
    function LiveGraph() {
      useEffect(() => {
        mounts += 1;
        return () => {
          unmounts += 1;
        };
      }, []);
      return <div>Live graph</div>;
    }
    const modules = [
      moduleElement({
        anchorMode: "board-fixed-size",
        pinned: true,
        x: 1000,
        y: 600,
        width: 720,
        height: 560,
      }),
    ];
    const renderModule = vi.fn(() => <LiveGraph />);
    const { rerender } = render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={modules}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={{ ...viewport, scrollX: 0, scrollY: 0, zoom: 0.4 }}
      />,
    );

    rerender(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={modules}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={{ ...viewport, scrollX: 300, scrollY: -100, zoom: 0.2 }}
      />,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(card.getAttribute("data-card-anchor")).toBe("board-fixed-size");
    expect(card.getAttribute("data-card-render-layer")).toBe("board");
    expect(card.getAttribute("style")).not.toContain("scale(");
    expect(screen.getByText("Live graph")).toBeTruthy();
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
  });

  it("keeps normal board-pinned Desmos live as a scaled whiteboard object", () => {
    const onChangeModule = vi.fn();
    const boardPinnedDesmos = moduleElement({
      anchorMode: "board",
      pinned: true,
      x: 1000,
      y: 600,
      width: 420,
      height: 320,
    });
    const { rerender } = render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[boardPinnedDesmos]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div data-testid="live-desmos-graph">Live graph</div>}
        viewportTransform={{ ...viewport, scrollX: 0, scrollY: 0, zoom: 0.2 }}
      />,
    );

    const boardOverlay = screen.getByTestId("whiteboard-board-object-overlay");
    const floatingBoardOverlay = screen.getByTestId("whiteboard-floating-board-tool-overlay");
    const viewportOverlay = screen.getByTestId("whiteboard-viewport-tool-overlay");
    const card = screen.getByTestId("whiteboard-module-card-module-1");

    expect(boardOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeTruthy();
    expect(floatingBoardOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeNull();
    expect(viewportOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeNull();
    expect(card.getAttribute("data-whiteboard-module-presentation")).toBe("live");
    expect(card.getAttribute("data-card-anchor")).toBe("board");
    expect(card.getAttribute("data-card-render-layer")).toBe("board");
    expect(card.getAttribute("data-whiteboard-floating-tool")).toBeNull();
    expect(card.getAttribute("data-whiteboard-module-pinned")).toBe("true");
    expect(card.getAttribute("data-card-scene-x")).toBe("1000");
    expect(card.getAttribute("data-card-scene-y")).toBe("600");
    expect(card.getAttribute("style")).toContain("left: 0px");
    expect(card.getAttribute("style")).toContain("top: 0px");
    expect(card.getAttribute("style")).toContain("transform: translate3d(200px, 120px, 0) scale(0.2)");
    expect(screen.getByTestId("live-desmos-graph")).toBeTruthy();
    expect(screen.queryByText(/zoom in or enlarge this card/i)).toBeNull();
    expect(onChangeModule).not.toHaveBeenCalled();

    const normalizedDesmos = {
      ...boardPinnedDesmos,
      anchorMode: "board" as const,
      pinned: true,
    };
    rerender(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[normalizedDesmos]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div data-testid="live-desmos-graph">Live graph</div>}
        viewportTransform={{ ...viewport, scrollX: 200, scrollY: 0, zoom: 0.2 }}
      />,
    );

    const movedCard = screen.getByTestId("whiteboard-module-card-module-1");
    expect(movedCard.getAttribute("style")).toContain("left: 0px");
    expect(movedCard.getAttribute("style")).toContain("top: 0px");
    expect(movedCard.getAttribute("style")).toContain("translate3d(240px, 120px, 0)");
    expect(movedCard.getAttribute("style")).toContain("scale(0.2)");
    expect(movedCard.getAttribute("style")).toContain("width: 420px");
    expect(movedCard.getAttribute("style")).toContain("height: 320px");
  });

  it("keeps fixed-size board-pinned Desmos live at the same CSS size across zoom changes", () => {
    const fixedSizeDesmos = moduleElement({
      anchorMode: "board-fixed-size",
      pinned: true,
      x: 1000,
      y: 600,
      width: 420,
      height: 320,
    });
    const { rerender } = render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[fixedSizeDesmos]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={() => <div data-testid="live-desmos-graph">Live graph</div>}
        viewportTransform={{ ...viewport, scrollX: 0, scrollY: 0, zoom: 0.2 }}
      />,
    );

    const lowZoomCard = screen.getByTestId("whiteboard-module-card-module-1");
    expect(lowZoomCard.getAttribute("data-card-anchor")).toBe("board-fixed-size");
    expect(lowZoomCard.getAttribute("style")).toContain("left: 200px");
    expect(lowZoomCard.getAttribute("style")).toContain("top: 120px");
    expect(lowZoomCard.getAttribute("style")).toContain("width: 420px");
    expect(lowZoomCard.getAttribute("style")).toContain("height: 320px");
    expect(lowZoomCard.getAttribute("style")).not.toContain("scale(");
    expect(screen.getByTestId("live-desmos-graph")).toBeTruthy();

    rerender(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[fixedSizeDesmos]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={() => <div data-testid="live-desmos-graph">Live graph</div>}
        viewportTransform={{ ...viewport, scrollX: 200, scrollY: 0, zoom: 3 }}
      />,
    );

    const highZoomCard = screen.getByTestId("whiteboard-module-card-module-1");
    expect(highZoomCard.getAttribute("data-card-anchor")).toBe("board-fixed-size");
    expect(highZoomCard.getAttribute("style")).toContain("width: 420px");
    expect(highZoomCard.getAttribute("style")).toContain("height: 320px");
    expect(highZoomCard.getAttribute("style")).not.toContain("scale(");
  });

  it("keeps screen-pinned Desmos in the viewport overlay and clamps it below the toolbar", () => {
    const onChangeModule = vi.fn();
    render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[
          moduleElement({
            anchorMode: "viewport",
            pinned: false,
            x: -200,
            y: -50,
            width: 720,
            height: 560,
          }),
        ]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div data-testid="live-desmos-graph">Live graph</div>}
        viewportTransform={viewport}
      />,
    );

    const boardOverlay = screen.getByTestId("whiteboard-board-object-overlay");
    const viewportOverlay = screen.getByTestId("whiteboard-viewport-tool-overlay");
    const card = screen.getByTestId("whiteboard-module-card-module-1");

    expect(boardOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeNull();
    expect(viewportOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeTruthy();
    expect(card.getAttribute("data-card-anchor")).toBe("viewport");
    expect(card.getAttribute("data-card-render-layer")).toBe("viewport");
    expect(card.getAttribute("data-whiteboard-floating-tool")).toBe("desmos-graph");
    expect(card.getAttribute("style")).toContain("left: 8px");
    expect(card.getAttribute("style")).toContain("top: 104px");
    expect(card.getAttribute("style")).toContain("width: 720px");
    expect(card.getAttribute("style")).toContain("height: 560px");
    expect(card.getAttribute("style")).not.toContain("scale(");
    expect(screen.getByTestId("whiteboard-card-reset-position")).toBeTruthy();
    expect(screen.getByTestId("live-desmos-graph")).toBeTruthy();
    expect(screen.queryByText(/zoom in or enlarge this card/i)).toBeNull();
    expect(onChangeModule).toHaveBeenCalledWith(
      expect.objectContaining({
        anchorMode: "viewport",
        pinned: false,
        x: 8,
        y: 104,
        width: 720,
        height: 560,
      }),
    );
  });

  it("keeps Private Notes live and mounted while the board pans and zooms", () => {
    let mounts = 0;
    let unmounts = 0;
    function LiveNotes() {
      const [value, setValue] = useState("first draft");
      useEffect(() => {
        mounts += 1;
        return () => {
          unmounts += 1;
        };
      }, []);
      return (
        <textarea
          aria-label="Private note editor"
          onChange={(event) => setValue(event.currentTarget.value)}
          value={value}
        />
      );
    }
    const notesModule = moduleElement({
      moduleId: "private-notes",
      binderId: "binder-math",
      lessonId: "lesson-limits",
      anchorMode: "board",
      pinned: true,
      width: 560,
      height: 440,
    });
    const renderModule = vi.fn(() => <LiveNotes />);
    const { rerender } = render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[notesModule]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={{ ...viewport, zoom: 0.2 }}
      />,
    );

    const editor = screen.getByLabelText("Private note editor") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "survives pan and zoom" } });

    rerender(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[notesModule]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={{ ...viewport, scrollX: 3000, scrollY: -1200, zoom: 0.1 }}
      />,
    );

    expect((screen.getByLabelText("Private note editor") as HTMLTextAreaElement).value).toBe("survives pan and zoom");
    expect(screen.queryByText(/zoom in or enlarge this card/i)).toBeNull();
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
  });

  it("keeps board-fixed-size non-floating cards in the board overlay while preserving CSS size", () => {
    render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[moduleElement({ moduleId: "scientific-calculator", anchorMode: "board-fixed-size", x: 100, y: 120, width: 420, height: 320 })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Fixed graph</div>}
        viewportTransform={viewport}
      />,
    );

    const boardOverlay = screen.getByTestId("whiteboard-board-object-overlay");
    const viewportOverlay = screen.getByTestId("whiteboard-viewport-tool-overlay");
    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(boardOverlay.querySelector('[data-whiteboard-module="scientific-calculator"]')).toBeTruthy();
    expect(viewportOverlay.querySelector('[data-whiteboard-module="scientific-calculator"]')).toBeNull();
    expect(card.getAttribute("style")).toContain("left: 240px");
    expect(card.getAttribute("style")).toContain("top: 180px");
    expect(card.getAttribute("style")).toContain("width: 420px");
    expect(card.getAttribute("style")).toContain("height: 320px");
    expect(card.getAttribute("data-card-render-layer")).toBe("board");
  });

  it("keeps a card visible at the same screen spot when pinning it from screen to board-fixed-size", () => {
    const onChangeModule = vi.fn();
    const viewportCard = moduleElement({
      moduleId: "scientific-calculator",
      anchorMode: "viewport",
      pinned: false,
      x: 240,
      y: 120,
      width: 720,
      height: 560,
    });
    const { rerender } = render(
      <WhiteboardPinnedObjectLayer
        context={context}
        getViewportTransform={() => viewport}
        modules={[viewportCard]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Live graph</div>}
        viewportTransform={viewport}
      />,
    );

    const before = screen.getByTestId("whiteboard-module-card-module-1");
    expect(before.getAttribute("style")).toContain("left: 240px");
    expect(before.getAttribute("style")).toContain("top: 120px");

    fireEvent.click(screen.getByTestId("whiteboard-card-pin-button"));
    fireEvent.click(screen.getByTestId("whiteboard-card-anchor-board-fixed"));
    const pinnedCard = onChangeModule.mock.calls.at(-1)?.[0] as WhiteboardModuleElement;

    rerender(
      <WhiteboardPinnedObjectLayer
        context={context}
        getViewportTransform={() => viewport}
        modules={[pinnedCard]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Live graph</div>}
        viewportTransform={viewport}
      />,
    );

    const boardOverlay = screen.getByTestId("whiteboard-board-object-overlay");
    const after = screen.getByTestId("whiteboard-module-card-module-1");
    expect(boardOverlay.querySelector('[data-whiteboard-module="scientific-calculator"]')).toBeTruthy();
    expect(pinnedCard).toMatchObject({
      anchorMode: "board-fixed-size",
      pinned: true,
      x: 100,
      y: 90,
      width: 720,
      height: 560,
    });
    expect(after.getAttribute("style")).toContain("left: 240px");
    expect(after.getAttribute("style")).toContain("top: 120px");
    expect(after.getAttribute("style")).toContain("width: 720px");
    expect(after.getAttribute("style")).toContain("height: 560px");
  });

  it("lets source lesson cards confirm a folder, binder, and lesson before applying it", () => {
    const onChangeModule = vi.fn();
    const renderModule = vi.fn((_moduleId, embeddedContext: WorkspaceModuleContext) => (
      <div>
        Loaded {embeddedContext.binder.title}: {embeddedContext.selectedLesson.title}
      </div>
    ));
    const sourceCard = moduleElement({
      moduleId: "lesson",
      binderId: "math-lab",
      lessonId: "math-lab-whiteboard",
      anchorMode: "board-fixed-size",
      sourceConfirmed: false,
    } as Partial<WhiteboardModuleElement> & { sourceConfirmed: boolean });
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" },
      lessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      filteredLessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      library: {
        folders: [
          { id: "folder-history", name: "History" },
          { id: "folder-math", name: "Math" },
        ],
        folderBinders: [
          { id: "history-russian", folder_id: "folder-history", binder_id: "binder-russian-revolution" },
          { id: "history-rome", folder_id: "folder-history", binder_id: "binder-rise-of-rome" },
          { id: "math-lab", folder_id: "folder-math", binder_id: "math-lab" },
        ],
        binders: [
          { id: "binder-russian-revolution", title: "The Russian Revolution" },
          { id: "binder-rise-of-rome", title: "Rise of Rome" },
          { id: "math-lab", title: "Math Lab" },
        ],
        lessons: [
          { id: "lesson-russian-overview", binder_id: "binder-russian-revolution", title: "Overview" },
          { id: "lesson-russian-timeline", binder_id: "binder-russian-revolution", title: "Timeline" },
          { id: "lesson-rome-kings", binder_id: "binder-rise-of-rome", title: "Mythic Origins" },
          { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" },
        ],
        loading: false,
        error: null,
      },
    } as unknown as WorkspaceModuleContext;

    render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[sourceCard]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("Math")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: "The Russian Revolution" }));
    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));

    expect(onChangeModule).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /use this lesson/i }));

    expect(onChangeModule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        binderId: "binder-russian-revolution",
        lessonId: "lesson-russian-timeline",
        title: "Timeline",
        sourceConfirmed: true,
      }),
    );
  });

  it("does not treat the synthetic Math Lab source as a confirmed real source", () => {
    const renderModule = vi.fn((_moduleId, embeddedContext: WorkspaceModuleContext) => (
      <div>
        Loaded {embeddedContext.binder.title}: {embeddedContext.selectedLesson.title}
      </div>
    ));
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" },
      lessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      filteredLessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      library: {
        folders: [{ id: "folder-math", name: "Math" }],
        folderBinders: [{ id: "math-jacob", folder_id: "folder-math", binder_id: "binder-jacob-math-notes" }],
        binders: [{ id: "binder-jacob-math-notes", title: "Jacob Math Notes" }],
        lessons: [{ id: "lesson-calculus", binder_id: "binder-jacob-math-notes", title: "Calculus Limits" }],
        loading: false,
        error: null,
      },
    } as unknown as WorkspaceModuleContext;

    render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[
          moduleElement({
            moduleId: "lesson",
            binderId: "math-lab",
            lessonId: "math-lab-whiteboard",
            anchorMode: "board-fixed-size",
          }),
        ]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    expect(screen.getByTestId("whiteboard-source-lesson-picker")).toBeTruthy();
    expect(screen.queryByTestId("whiteboard-source-summary")).toBeNull();
    expect(renderModule).not.toHaveBeenCalled();
  });

  it("hides the source picker after confirmation and leaves only a compact source summary", () => {
    const renderModule = vi.fn((_moduleId, embeddedContext: WorkspaceModuleContext) => (
      <div>Lesson body for {embeddedContext.selectedLesson.title}</div>
    ));
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab", math_blocks: [] },
      lessons: [],
      filteredLessons: [],
      library: {
        folders: [{ id: "folder-history", name: "History" }],
        folderBinders: [{ id: "history-russian", folder_id: "folder-history", binder_id: "binder-russian-revolution" }],
        binders: [{ id: "binder-russian-revolution", title: "The Russian Revolution" }],
        lessons: [{ id: "lesson-russian-timeline", binder_id: "binder-russian-revolution", title: "Timeline", math_blocks: [] }],
        loading: false,
        error: null,
      },
    } as unknown as WorkspaceModuleContext;

    render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[
          moduleElement({
            moduleId: "lesson",
            binderId: "binder-russian-revolution",
            lessonId: "lesson-russian-timeline",
            anchorMode: "board-fixed-size",
            sourceConfirmed: true,
          } as Partial<WhiteboardModuleElement> & { sourceConfirmed: boolean }),
        ]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    expect(screen.queryByTestId("whiteboard-source-lesson-picker")).toBeNull();
    expect(screen.getByTestId("whiteboard-source-summary").textContent).toContain("The Russian Revolution");
    expect(screen.getByText("Lesson body for Timeline")).toBeTruthy();
  });

  it("opens a real card options menu that can edit or reset a confirmed source", () => {
    const onChangeModule = vi.fn();
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab", math_blocks: [] },
      lessons: [],
      filteredLessons: [],
      library: {
        folders: [{ id: "folder-history", name: "History" }],
        folderBinders: [{ id: "history-russian", folder_id: "folder-history", binder_id: "binder-russian-revolution" }],
        binders: [{ id: "binder-russian-revolution", title: "The Russian Revolution" }],
        lessons: [{ id: "lesson-russian-timeline", binder_id: "binder-russian-revolution", title: "Timeline", math_blocks: [] }],
        loading: false,
        error: null,
      },
    } as unknown as WorkspaceModuleContext;

    const confirmedSource = moduleElement({
      moduleId: "lesson",
      binderId: "binder-russian-revolution",
      lessonId: "lesson-russian-timeline",
      anchorMode: "board-fixed-size",
      sourceConfirmed: true,
      cardDensity: "compact",
      textSize: "normal",
    } as Partial<WhiteboardModuleElement> & {
      sourceConfirmed: boolean;
      cardDensity: "compact";
      textSize: "normal";
    });

    const { rerender } = render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[confirmedSource]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Lesson body</div>}
        viewportTransform={viewport}
      />,
    );

    fireEvent.click(screen.getByTestId("whiteboard-card-options-button"));
    expect(screen.getByTestId("whiteboard-card-options-menu")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /edit source/i }));

    const editSource = onChangeModule.mock.calls.at(-1)?.[0] as WhiteboardModuleElement & { sourceConfirmed?: boolean };
    expect(editSource.sourceConfirmed).toBe(false);
    expect(editSource.x).toBe(confirmedSource.x);
    expect(editSource.anchorMode).toBe("board-fixed-size");

    rerender(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[{ ...confirmedSource, sourceConfirmed: false } as WhiteboardModuleElement]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Lesson body</div>}
        viewportTransform={viewport}
      />,
    );
    expect(screen.getByTestId("whiteboard-source-lesson-picker")).toBeTruthy();

    fireEvent.click(screen.getByTestId("whiteboard-card-options-button"));
    fireEvent.click(screen.getByRole("button", { name: /reset source/i }));
    expect(onChangeModule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        binderId: undefined,
        lessonId: undefined,
        sourceConfirmed: false,
        x: confirmedSource.x,
        y: confirmedSource.y,
      }),
    );
  });

  it("stores density and text-size choices without moving or repinning the card", () => {
    const onChangeModule = vi.fn();
    const sourceCard = moduleElement({
      moduleId: "lesson",
      anchorMode: "board",
      sourceConfirmed: true,
      cardDensity: "comfortable",
      textSize: "normal",
    } as Partial<WhiteboardModuleElement> & {
      sourceConfirmed: boolean;
      cardDensity: "comfortable";
      textSize: "normal";
    });

    render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[sourceCard]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Lesson body</div>}
        viewportTransform={viewport}
      />,
    );

    fireEvent.click(screen.getByTestId("whiteboard-card-options-button"));
    fireEvent.click(screen.getByRole("button", { name: /compact density/i }));
    expect(onChangeModule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cardDensity: "compact",
        x: sourceCard.x,
        y: sourceCard.y,
        anchorMode: "board",
      }),
    );

    fireEvent.click(screen.getByTestId("whiteboard-card-options-button"));
    fireEvent.click(screen.getByRole("button", { name: /large text/i }));
    expect(onChangeModule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        textSize: "large",
        x: sourceCard.x,
        y: sourceCard.y,
        anchorMode: "board",
      }),
    );
  });

  it("shows compact formula sheet access instead of full inline math blocks in confirmed whiteboard source lessons", () => {
    const onAddLinkedModule = vi.fn();
    const renderModule = vi.fn((_moduleId, embeddedContext: WorkspaceModuleContext) => (
      <div>Lesson body with {embeddedContext.selectedLesson.math_blocks.length} math blocks</div>
    ));
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab", math_blocks: [] },
      lessons: [],
      filteredLessons: [],
      library: {
        folders: [{ id: "folder-math", name: "Math" }],
        folderBinders: [{ id: "math-geometry", folder_id: "folder-math", binder_id: "binder-geometry" }],
        binders: [{ id: "binder-geometry", title: "Geometry" }],
        lessons: [
          {
            id: "lesson-geometry",
            binder_id: "binder-geometry",
            title: "Rigid Motions",
            math_blocks: [{ id: "rotation", type: "latex", label: "Rotation rule", latex: "(x,y) -> (-y,x)" }],
          },
        ],
        loading: false,
        error: null,
      },
    } as unknown as WorkspaceModuleContext;

    render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[
          moduleElement({
            moduleId: "lesson",
            binderId: "binder-geometry",
            lessonId: "lesson-geometry",
            anchorMode: "board-fixed-size",
            sourceConfirmed: true,
          } as Partial<WhiteboardModuleElement> & { sourceConfirmed: boolean }),
        ]}
        onAddLinkedModule={onAddLinkedModule}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    expect(screen.queryByText("Lesson math and study blocks")).toBeNull();
    expect(screen.getByRole("button", { name: /formula sheet/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /formula sheet/i }));
    expect(onAddLinkedModule).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: "formula-sheet",
        binderId: "binder-geometry",
        lessonId: "lesson-geometry",
      }),
    );
  });

  it("renders selected source lesson cards with the chosen binder and lesson context", () => {
    const renderModule = vi.fn((_moduleId, embeddedContext: WorkspaceModuleContext) => (
      <div>
        Loaded {embeddedContext.binder.title}: {embeddedContext.selectedLesson.title}
      </div>
    ));
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" },
      lessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      filteredLessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      library: {
        folders: [{ id: "folder-history", name: "History" }],
        folderBinders: [{ id: "history-russian", folder_id: "folder-history", binder_id: "binder-russian-revolution" }],
        binders: [{ id: "binder-russian-revolution", title: "The Russian Revolution" }],
        lessons: [
          { id: "lesson-russian-overview", binder_id: "binder-russian-revolution", title: "Overview" },
          { id: "lesson-russian-timeline", binder_id: "binder-russian-revolution", title: "Timeline" },
        ],
        loading: false,
        error: null,
      },
    } as WorkspaceModuleContext;

    render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[
          moduleElement({
            moduleId: "lesson",
            binderId: "binder-russian-revolution",
            lessonId: "lesson-russian-timeline",
            anchorMode: "board-fixed-size",
          }),
        ]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    expect(screen.getByText("Loaded The Russian Revolution: Timeline")).toBeTruthy();
  });

  it("persists source lesson highlight annotations on the selected whiteboard card", () => {
    const onChangeModule = vi.fn();
    const renderModule = vi.fn((_moduleId, embeddedContext: WorkspaceModuleContext) => (
      <button
        onClick={() =>
          embeddedContext.onAddHighlight(
            {
              text: "limits",
              startOffset: 4,
              endOffset: 10,
            },
            "green",
          )
        }
        type="button"
      >
        Highlight source text
      </button>
    ));
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" },
      lessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      filteredLessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      highlights: [],
      onAddHighlight: vi.fn(),
      library: {
        folders: [{ id: "folder-math", name: "Math" }],
        folderBinders: [{ id: "math-jacob", folder_id: "folder-math", binder_id: "binder-jacob-math-notes" }],
        binders: [{ id: "binder-jacob-math-notes", title: "Jacob Math Notes" }],
        lessons: [{ id: "lesson-calculus", binder_id: "binder-jacob-math-notes", title: "Calculus Limits" }],
        loading: false,
        error: null,
      },
    } as unknown as WorkspaceModuleContext;

    render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[
          moduleElement({
            moduleId: "lesson",
            binderId: "binder-jacob-math-notes",
            lessonId: "lesson-calculus",
            anchorMode: "board-fixed-size",
            sourceConfirmed: true,
          } as Partial<WhiteboardModuleElement> & { sourceConfirmed: boolean }),
        ]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /highlight source text/i }));

    expect(onChangeModule).toHaveBeenCalledWith(
      expect.objectContaining({
        whiteboardHighlights: [
          expect.objectContaining({
            anchor_text: "limits",
            binder_id: "binder-jacob-math-notes",
            lesson_id: "lesson-calculus",
            color: "green",
          }),
        ],
      }),
    );
  });

  it("lets multiple source lesson cards stay pointed at different note sets", () => {
    const renderModule = vi.fn((_moduleId, embeddedContext: WorkspaceModuleContext) => (
      <div>
        Loaded {embeddedContext.binder.title}: {embeddedContext.selectedLesson.title}
      </div>
    ));
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" },
      lessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      filteredLessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      library: {
        folders: [{ id: "folder-history", name: "History" }],
        folderBinders: [
          { id: "history-russian", folder_id: "folder-history", binder_id: "binder-russian-revolution" },
          { id: "history-rome", folder_id: "folder-history", binder_id: "binder-rise-of-rome" },
        ],
        binders: [
          { id: "binder-russian-revolution", title: "The Russian Revolution" },
          { id: "binder-rise-of-rome", title: "Rise of Rome" },
        ],
        lessons: [
          { id: "lesson-russian-timeline", binder_id: "binder-russian-revolution", title: "Timeline" },
          { id: "lesson-rome-kings", binder_id: "binder-rise-of-rome", title: "Mythic Origins" },
        ],
        loading: false,
        error: null,
      },
    } as WorkspaceModuleContext;

    render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[
          moduleElement({
            id: "russian-source",
            moduleId: "lesson",
            binderId: "binder-russian-revolution",
            lessonId: "lesson-russian-timeline",
            anchorMode: "board-fixed-size",
          }),
          moduleElement({
            id: "rome-source",
            moduleId: "lesson",
            binderId: "binder-rise-of-rome",
            lessonId: "lesson-rome-kings",
            anchorMode: "board-fixed-size",
          }),
        ]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    expect(screen.getByText("Loaded The Russian Revolution: Timeline")).toBeTruthy();
    expect(screen.getByText("Loaded Rise of Rome: Mythic Origins")).toBeTruthy();
  });

  it("routes source quote actions through the whiteboard Private Notes resolver", () => {
    const onRouteSelectionToNotes = vi.fn();
    const renderModule = vi.fn((_moduleId, embeddedContext: WorkspaceModuleContext) => (
      <button onClick={() => embeddedContext.onSendSelectionToNotes("quoted passage")} type="button">
        Send source quote
      </button>
    ));
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" },
      lessons: [],
      filteredLessons: [],
      library: {
        folders: [{ id: "folder-math", name: "Math" }],
        folderBinders: [{ id: "math-jacob", folder_id: "folder-math", binder_id: "binder-jacob-math-notes" }],
        binders: [{ id: "binder-jacob-math-notes", title: "Jacob Math Notes" }],
        lessons: [{ id: "lesson-calculus", binder_id: "binder-jacob-math-notes", title: "Calculus Limits", math_blocks: [] }],
        loading: false,
        error: null,
      },
    } as unknown as WorkspaceModuleContext;

    render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[
          moduleElement({
            id: "source-card",
            moduleId: "lesson",
            binderId: "binder-jacob-math-notes",
            lessonId: "lesson-calculus",
            anchorMode: "board-fixed-size",
            sourceConfirmed: true,
          } as Partial<WhiteboardModuleElement> & { sourceConfirmed: boolean }),
        ]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        onRouteSelectionToNotes={onRouteSelectionToNotes}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /send source quote/i }));

    expect(onRouteSelectionToNotes).toHaveBeenCalledWith({
      anchorText: "quoted passage",
      prefix: "Source quote",
      sourceModuleId: "source-card",
    });
  });

  it("lets annotation cards choose the binder and lesson they are attached to", () => {
    const onChangeModule = vi.fn();
    const renderModule = vi.fn((_moduleId, embeddedContext: WorkspaceModuleContext) => (
      <div>
        Annotations for {embeddedContext.binder.title}: {embeddedContext.selectedLesson.title}
      </div>
    ));
    const libraryContext = {
      ...context,
      binder: { id: "math-lab", title: "Math Lab" },
      selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" },
      lessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      filteredLessons: [{ id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Whiteboard Lab" }],
      library: {
        folders: [{ id: "folder-history", name: "History" }],
        folderBinders: [{ id: "history-russian", folder_id: "folder-history", binder_id: "binder-russian-revolution" }],
        binders: [{ id: "binder-russian-revolution", title: "The Russian Revolution" }],
        lessons: [
          { id: "lesson-russian-overview", binder_id: "binder-russian-revolution", title: "Overview" },
          { id: "lesson-russian-timeline", binder_id: "binder-russian-revolution", title: "Timeline" },
        ],
        loading: false,
        error: null,
      },
    } as WorkspaceModuleContext;

    render(
      <WhiteboardPinnedObjectLayer
        context={libraryContext}
        modules={[
          moduleElement({
            moduleId: "comments",
            binderId: "math-lab",
            lessonId: "math-lab-whiteboard",
            anchorMode: "board-fixed-size",
            sourceConfirmed: false,
          } as Partial<WhiteboardModuleElement> & { sourceConfirmed: boolean }),
        ]}
        onChangeModule={onChangeModule}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    expect(screen.getAllByText("Annotations").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: "The Russian Revolution" }));
    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    fireEvent.click(screen.getByRole("button", { name: /use this lesson/i }));

    expect(onChangeModule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        binderId: "binder-russian-revolution",
        lessonId: "lesson-russian-timeline",
        title: "Timeline",
      }),
    );
  });
});
