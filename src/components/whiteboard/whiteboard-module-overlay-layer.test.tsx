// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
        modules={[moduleElement()]}
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
    const module = moduleElement({ anchorMode: "board", x: 100, y: 120, width: 420, height: 320 });
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

  it("does not mount heavy live content when low zoom forces preview mode", () => {
    const renderModule = vi.fn(() => <div>Live graph</div>);

    render(
      <WhiteboardModuleOverlayLayer
        context={context}
        modules={[moduleElement()]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={{ ...viewport, zoom: 0.45 }}
      />,
    );

    expect(renderModule).not.toHaveBeenCalled();
    expect(screen.getByTestId("whiteboard-module-card-module-1").getAttribute("data-whiteboard-module-presentation")).toBe("preview");
  });

  it("does not mount heavy live content when the board card is offscreen", () => {
    const renderModule = vi.fn(() => <div>Live graph</div>);

    render(
      <WhiteboardModuleOverlayLayer
        context={context}
        modules={[moduleElement({ x: 6000, y: 6000 })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={renderModule}
        viewportTransform={viewport}
      />,
    );

    expect(renderModule).not.toHaveBeenCalled();
    expect(screen.getByTestId("whiteboard-module-card-module-1").getAttribute("data-whiteboard-module-presentation")).toBe("preview");
  });

  it("keeps the card anchored to board coordinates when zoomed far out", () => {
    const renderModule = vi.fn(() => <div>Live graph</div>);

    render(
      <WhiteboardModuleOverlayLayer
        context={context}
        modules={[moduleElement()]}
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
        modules={[moduleElement()]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Live graph</div>}
        viewportTransform={{ ...viewport, offsetLeft: 12, offsetTop: 20 }}
      />,
    );

    const layer = screen.getByTestId("whiteboard-pinned-object-layer");
    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(layer.className).toContain("fixed");
    expect(card.getAttribute("style")).toContain("transform: translate3d(252px, 200px, 0) scale(2)");
  });

  it("keeps floating cards in screen space while pinned cards move with board pan", () => {
    render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[
          moduleElement({ id: "pinned", anchorMode: "board", pinned: true, x: 100, y: 100 }),
          moduleElement({ id: "floating", anchorMode: "viewport", pinned: false, x: 100, y: 100, width: 420, height: 320 }),
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

  it("keeps board-fixed-size cards in the board overlay while preserving CSS size", () => {
    render(
      <WhiteboardPinnedObjectLayer
        context={context}
        modules={[moduleElement({ anchorMode: "board-fixed-size", x: 100, y: 120, width: 420, height: 320 })]}
        onChangeModule={vi.fn()}
        onRemoveModule={vi.fn()}
        renderModule={() => <div>Fixed graph</div>}
        viewportTransform={viewport}
      />,
    );

    const boardOverlay = screen.getByTestId("whiteboard-board-object-overlay");
    const viewportOverlay = screen.getByTestId("whiteboard-viewport-tool-overlay");
    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(boardOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeTruthy();
    expect(viewportOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeNull();
    expect(card.getAttribute("style")).toContain("left: 240px");
    expect(card.getAttribute("style")).toContain("top: 180px");
    expect(card.getAttribute("style")).toContain("width: 420px");
    expect(card.getAttribute("style")).toContain("height: 320px");
    expect(card.getAttribute("data-card-render-layer")).toBe("board");
  });

  it("keeps a card visible at the same screen spot when pinning it from screen to board-fixed-size", () => {
    const onChangeModule = vi.fn();
    const viewportCard = moduleElement({
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
    expect(boardOverlay.querySelector('[data-whiteboard-module="desmos-graph"]')).toBeTruthy();
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
});
