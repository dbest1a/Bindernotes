// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { WhiteboardModuleCard } from "@/components/whiteboard/whiteboard-module-card";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";
import type { WhiteboardViewportTransform } from "@/lib/whiteboards/whiteboard-coordinate-utils";

const viewportTransform: WhiteboardViewportTransform = {
  scrollX: 0,
  scrollY: 0,
  zoom: 2,
  viewportWidth: 1200,
  viewportHeight: 800,
};

function moduleElement(overrides: Partial<WhiteboardModuleElement> = {}): WhiteboardModuleElement {
  return {
    id: "module-1",
    type: "bindernotes-module",
    moduleId: "lesson",
    x: 100,
    y: 120,
    width: 420,
    height: 320,
    zIndex: 1,
    mode: "live",
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    anchorMode: "board",
    pinned: true,
    ...overrides,
  };
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("WhiteboardModuleCard", () => {
  afterEach(() => cleanup());

  it("dragging at zoom 2 moves board position by half the screen delta", () => {
    const onChange = vi.fn();
    render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement()}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Live lesson
      </WhiteboardModuleCard>,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    const header = card.firstElementChild as HTMLElement;
    fireEvent.pointerDown(header, { clientX: 200, clientY: 240, pointerId: 1 });
    fireEvent.pointerMove(header, { clientX: 260, clientY: 280, pointerId: 1 });
    fireEvent.pointerUp(header, { clientX: 260, clientY: 280, pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 130,
        y: 140,
      }),
    );
  });

  it("resizing at zoom 2 grows board size by half the screen delta", () => {
    const onChange = vi.fn();
    render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement()}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Live lesson
      </WhiteboardModuleCard>,
    );

    const resizeHandle = screen.getByTitle("Resize module");
    fireEvent.pointerDown(resizeHandle, { clientX: 520, clientY: 440, pointerId: 1 });
    fireEvent.pointerMove(resizeHandle, { clientX: 620, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(resizeHandle, { clientX: 620, clientY: 500, pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 470,
        height: 350,
      }),
    );
  });

  it("renders board-pinned cards as scene-sized board objects with camera scale", () => {
    render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ width: 720, height: 560 })}
        onBringToFront={vi.fn()}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={{
          scrollX: -40,
          scrollY: 20,
          zoom: 0.5,
          viewportWidth: 1200,
          viewportHeight: 800,
        }}
      >
        Live graph
      </WhiteboardModuleCard>,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(card.getAttribute("data-card-anchor")).toBe("board");
    expect(card.getAttribute("data-card-scene-x")).toBe("100");
    expect(card.getAttribute("data-card-scene-y")).toBe("120");
    expect(card.getAttribute("data-card-scene-width")).toBe("720");
    expect(card.getAttribute("data-card-scene-height")).toBe("560");
    expect(card.getAttribute("data-card-viewport-x")).toBe("30");
    expect(card.getAttribute("data-card-viewport-y")).toBe("70");
    expect(card.getAttribute("data-card-render-x")).toBe("30");
    expect(card.getAttribute("data-card-render-y")).toBe("70");
    expect(card.getAttribute("data-card-render-zoom")).toBe("0.5");
    expect(card.getAttribute("data-card-render-layer")).toBe("board");
    expect(card.getAttribute("style")).toContain("left: 0px");
    expect(card.getAttribute("style")).toContain("top: 0px");
    expect(card.getAttribute("style")).toContain("width: 720px");
    expect(card.getAttribute("style")).toContain("height: 560px");
    expect(card.getAttribute("style")).toContain("transform: translate3d(30px, 70px, 0) scale(0.5)");
  });

  it("camera updates only change board render transform and never mutate scene coordinates", () => {
    const onChange = vi.fn();
    const boardCard = moduleElement({ anchorMode: "board", x: 100, y: 120, width: 420, height: 320 });
    const { rerender } = render(
      <WhiteboardModuleCard
        live
        moduleElement={boardCard}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Live lesson
      </WhiteboardModuleCard>,
    );

    const before = screen.getByTestId("whiteboard-module-card-module-1");
    expect(before.getAttribute("data-card-anchor")).toBe("board");
    expect(before.getAttribute("data-card-scene-x")).toBe("100");
    expect(before.getAttribute("data-card-scene-y")).toBe("120");
    expect(before.getAttribute("style")).toContain("transform: translate3d(200px, 240px, 0) scale(2)");

    rerender(
      <WhiteboardModuleCard
        live
        moduleElement={boardCard}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={{
          scrollX: 50,
          scrollY: -10,
          zoom: 0.5,
          viewportWidth: 1200,
          viewportHeight: 800,
        }}
      >
        Live lesson
      </WhiteboardModuleCard>,
    );

    const after = screen.getByTestId("whiteboard-module-card-module-1");
    expect(onChange).not.toHaveBeenCalled();
    expect(after.getAttribute("data-card-anchor")).toBe("board");
    expect(after.getAttribute("data-card-scene-x")).toBe("100");
    expect(after.getAttribute("data-card-scene-y")).toBe("120");
    expect(after.getAttribute("data-card-scene-width")).toBe("420");
    expect(after.getAttribute("data-card-scene-height")).toBe("320");
    expect(after.getAttribute("data-card-render-x")).toBe("75");
    expect(after.getAttribute("data-card-render-y")).toBe("55");
    expect(after.getAttribute("data-card-render-zoom")).toBe("0.5");
    expect(after.getAttribute("style")).toContain("left: 0px");
    expect(after.getAttribute("style")).toContain("top: 0px");
    expect(after.getAttribute("style")).toContain("width: 420px");
    expect(after.getAttribute("style")).toContain("height: 320px");
    expect(after.getAttribute("style")).toContain("transform: translate3d(75px, 55px, 0) scale(0.5)");
  });

  it("uses board-native card state attributes and selection chrome instead of detached app-window chrome", () => {
    render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ anchorMode: "board-fixed-size" })}
        onBringToFront={vi.fn()}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Live lesson
      </WhiteboardModuleCard>,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(card.getAttribute("data-whiteboard-card")).toBe("true");
    expect(card.getAttribute("data-card-anchor")).toBe("board-fixed-size");
    expect(card.getAttribute("data-card-mode")).toBe("live");
    expect(card.getAttribute("data-card-selected")).toBe("false");
    expect(card.className).toContain("whiteboard-module-card");
    expect(card.textContent?.toLowerCase()).not.toContain("overlay");

    fireEvent.pointerDown(card, { pointerId: 1 });
    expect(card.getAttribute("data-card-selected")).toBe("true");
  });

  it("renders floating modules in screen coordinates so pan and zoom do not move helper UI", () => {
    const { rerender } = render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ anchorMode: "viewport", pinned: false, x: 120, y: 140, width: 360, height: 240 })}
        onBringToFront={vi.fn()}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Floating calculator
      </WhiteboardModuleCard>,
    );

    rerender(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ anchorMode: "viewport", pinned: false, x: 120, y: 140, width: 360, height: 240 })}
        onBringToFront={vi.fn()}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={{ ...viewportTransform, scrollX: 500, zoom: 0.25 }}
      >
        Floating calculator
      </WhiteboardModuleCard>,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(card.getAttribute("data-whiteboard-module-anchor")).toBe("viewport");
    expect(card.getAttribute("style")).toContain("left: 120px");
    expect(card.getAttribute("style")).toContain("top: 140px");
    expect(card.getAttribute("style")).toContain("width: 360px");
    expect(card.getAttribute("style")).toContain("height: 240px");
  });

  it("keeps board-fixed-size cards attached to board position while preserving CSS pixel size", () => {
    const { rerender } = render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ anchorMode: "board-fixed-size", x: 100, y: 120, width: 420, height: 320 })}
        onBringToFront={vi.fn()}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Fixed graph
      </WhiteboardModuleCard>,
    );

    rerender(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ anchorMode: "board-fixed-size", x: 100, y: 120, width: 420, height: 320 })}
        onBringToFront={vi.fn()}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={{ ...viewportTransform, scrollX: 50, scrollY: -10, zoom: 0.5 }}
      >
        Fixed graph
      </WhiteboardModuleCard>,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(card.getAttribute("data-whiteboard-module-anchor")).toBe("board-fixed-size");
    expect(card.getAttribute("style")).toContain("left: 75px");
    expect(card.getAttribute("style")).toContain("top: 55px");
    expect(card.getAttribute("style")).toContain("width: 420px");
    expect(card.getAttribute("style")).toContain("height: 320px");
    expect(card.getAttribute("style")).not.toContain("scale(");
    expect(card.getAttribute("data-card-render-zoom")).toBe("1");
  });

  it("selecting Pin to board stores the board anchor and renders with board-object scale", () => {
    const onChange = vi.fn();
    const transform = { ...viewportTransform, scrollX: 100, scrollY: -80, zoom: 2 };
    const initial = moduleElement({ anchorMode: "viewport", pinned: false, x: 240, y: 120, width: 720, height: 560 });
    const { rerender } = render(
      <WhiteboardModuleCard
        live
        moduleElement={initial}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={transform}
      >
        Live lesson
      </WhiteboardModuleCard>,
    );

    fireEvent.click(screen.getByTestId("whiteboard-card-pin-button"));
    fireEvent.click(screen.getByTestId("whiteboard-card-anchor-board"));
    const boardCard = onChange.mock.calls.at(-1)?.[0] as WhiteboardModuleElement;
    expect(boardCard).toMatchObject({
      anchorMode: "board",
      pinned: true,
      x: 20,
      y: 140,
      width: 360,
      height: 280,
    });

    rerender(
      <WhiteboardModuleCard
        live
        moduleElement={boardCard}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={transform}
      >
        Live lesson
      </WhiteboardModuleCard>,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    expect(card.getAttribute("data-card-anchor")).toBe("board");
    expect(card.getAttribute("style")).toContain("width: 360px");
    expect(card.getAttribute("style")).toContain("height: 280px");
    expect(card.getAttribute("style")).toContain("transform: translate3d(240px, 120px, 0) scale(2)");
  });

  it("converts a board card to fixed-size board mode from the pin menu", () => {
    const onChange = vi.fn();
    render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement()}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Live lesson
      </WhiteboardModuleCard>,
    );

    fireEvent.click(screen.getByTestId("whiteboard-card-pin-button"));
    fireEvent.click(screen.getByTestId("whiteboard-card-anchor-board-fixed"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        anchorMode: "board-fixed-size",
        pinned: true,
        x: 100,
        y: 120,
        width: 840,
        height: 640,
      }),
    );
  });

  it("renders a visible pin menu with the current anchor mode", () => {
    render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ anchorMode: "board-fixed-size" })}
        onBringToFront={vi.fn()}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Live lesson
      </WhiteboardModuleCard>,
    );

    const pinButton = screen.getByTestId("whiteboard-card-pin-button");
    expect(pinButton.getAttribute("aria-label")).toContain("Pin to board, keep size");
    fireEvent.click(pinButton);

    const menu = screen.getByTestId("whiteboard-card-anchor-menu");
    expect(menu.textContent).toContain("Pin to board, keep size");
    expect(screen.getByTestId("whiteboard-card-anchor-board-fixed").getAttribute("aria-pressed")).toBe("true");
  });

  it("selecting pin menu options changes anchor modes without resetting zIndex or mode", () => {
    const onChange = vi.fn();
    const initial = moduleElement({ anchorMode: "viewport", pinned: false, x: 240, y: 120, width: 720, height: 560, zIndex: 9 });
    const transform = { ...viewportTransform, scrollX: 100, scrollY: -80, zoom: 2 };
    const { rerender } = render(
      <WhiteboardModuleCard
        live
        moduleElement={initial}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={transform}
      >
        Live graph
      </WhiteboardModuleCard>,
    );

    fireEvent.click(screen.getByTestId("whiteboard-card-pin-button"));
    fireEvent.click(screen.getByTestId("whiteboard-card-anchor-board-fixed"));
    const fixedCard = onChange.mock.calls.at(-1)?.[0] as WhiteboardModuleElement;
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        anchorMode: "board-fixed-size",
        pinned: true,
        x: 20,
        y: 140,
        width: 720,
        height: 560,
        zIndex: 9,
        mode: "live",
      }),
    );

    rerender(
      <WhiteboardModuleCard
        live
        moduleElement={fixedCard}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={transform}
      >
        Live graph
      </WhiteboardModuleCard>,
    );
    fireEvent.click(screen.getByTestId("whiteboard-card-pin-button"));
    fireEvent.click(screen.getByTestId("whiteboard-card-anchor-board"));
    const boardCard = onChange.mock.calls.at(-1)?.[0] as WhiteboardModuleElement;
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        anchorMode: "board",
        pinned: true,
        x: 20,
        y: 140,
        width: 360,
        height: 280,
        zIndex: 9,
        mode: "live",
      }),
    );

    rerender(
      <WhiteboardModuleCard
        live
        moduleElement={boardCard}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={transform}
      >
        Live graph
      </WhiteboardModuleCard>,
    );
    fireEvent.click(screen.getByTestId("whiteboard-card-pin-button"));
    fireEvent.click(screen.getByTestId("whiteboard-card-anchor-viewport"));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        anchorMode: "viewport",
        pinned: false,
        x: 240,
        y: 120,
        width: 720,
        height: 560,
        zIndex: 9,
        mode: "live",
      }),
    );
  });

  it("dragging a floating card updates screen coordinates directly", () => {
    const onChange = vi.fn();
    render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ anchorMode: "viewport", pinned: false, x: 120, y: 140, width: 360, height: 240 })}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Floating calculator
      </WhiteboardModuleCard>,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    const header = card.firstElementChild as HTMLElement;
    fireEvent.pointerDown(header, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(header, { clientX: 140, clientY: 160, pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        anchorMode: "viewport",
        pinned: false,
        x: 160,
        y: 200,
      }),
    );
  });

  it("resizing viewport cards uses pixel delta instead of zoom-adjusted board delta", () => {
    const onChange = vi.fn();
    render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ anchorMode: "viewport", pinned: false, x: 120, y: 140, width: 360, height: 240 })}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Floating calculator
      </WhiteboardModuleCard>,
    );

    const resizeHandle = screen.getByTitle("Resize module");
    fireEvent.pointerDown(resizeHandle, { clientX: 400, clientY: 380, pointerId: 1 });
    fireEvent.pointerUp(resizeHandle, { clientX: 500, clientY: 440, pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        anchorMode: "viewport",
        width: 460,
        height: 300,
      }),
    );
  });

  it("resizing board-fixed-size cards uses pixel delta while drag still uses board delta", () => {
    const onChange = vi.fn();
    render(
      <WhiteboardModuleCard
        live
        moduleElement={moduleElement({ anchorMode: "board-fixed-size", x: 100, y: 120, width: 420, height: 320 })}
        onBringToFront={vi.fn()}
        onChange={onChange}
        onRemove={vi.fn()}
        presentation="live"
        viewportTransform={viewportTransform}
      >
        Fixed graph
      </WhiteboardModuleCard>,
    );

    const card = screen.getByTestId("whiteboard-module-card-module-1");
    const header = card.firstElementChild as HTMLElement;
    fireEvent.pointerDown(header, { clientX: 200, clientY: 240, pointerId: 1 });
    fireEvent.pointerUp(header, { clientX: 260, clientY: 280, pointerId: 1 });

    const resizeHandle = screen.getByTitle("Resize module");
    fireEvent.pointerDown(resizeHandle, { clientX: 520, clientY: 440, pointerId: 2 });
    fireEvent.pointerUp(resizeHandle, { clientX: 620, clientY: 500, pointerId: 2 });

    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        anchorMode: "board-fixed-size",
        x: 130,
        y: 140,
      }),
    );
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        anchorMode: "board-fixed-size",
        width: 520,
        height: 380,
      }),
    );
  });
});
