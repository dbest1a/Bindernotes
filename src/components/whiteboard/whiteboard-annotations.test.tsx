// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardAnnotations } from "./whiteboard-pinned-object-layer";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

describe("whiteboard annotations", () => {
  afterEach(cleanup);
  it("creates editable stickies in the linked lesson, persists them with the card and routes manager actions", () => {
    const rootCreate = vi.fn();
    const context = { ownerId: "user", binder: { id: "source-binder" }, selectedLesson: { id: "source-lesson", title: "Geometry" }, onCreateLooseSticky: rootCreate } as unknown as WorkspaceModuleContext;
    const original: WhiteboardModuleElement = { id: "annotations", type: "bindernotes-module", moduleId: "comments", binderId: "source-binder", lessonId: "source-lesson", x: 0, y: 0, width: 400, height: 300, zIndex: 1, mode: "live", createdAt: "2026-10-02", updatedAt: "2026-10-02" };
    const onChange = vi.fn();
    const route = vi.fn();
    const { rerender, unmount } = render(<WhiteboardAnnotations context={context} moduleElement={original} onChangeModule={onChange} onRouteSelectionToNotes={route} />);
    fireEvent.click(screen.getByText("New sticky"));
    const created = onChange.mock.calls.at(-1)![0] as WhiteboardModuleElement;
    expect(created.whiteboardComments![0]).toMatchObject({ binder_id: "source-binder", lesson_id: "source-lesson", owner_id: "user" });
    expect(rootCreate).not.toHaveBeenCalled();
    rerender(<WhiteboardAnnotations context={context} moduleElement={created} onChangeModule={onChange} onRouteSelectionToNotes={route} />);
    fireEvent.change(screen.getByLabelText("Sticky note"), { target: { value: "Remember the triangle proof" } });
    const saved = JSON.parse(JSON.stringify(onChange.mock.calls.at(-1)![0])) as WhiteboardModuleElement;
    unmount();
    render(<WhiteboardAnnotations context={context} moduleElement={saved} onChangeModule={onChange} onRouteSelectionToNotes={route} />);
    expect((screen.getByLabelText("Sticky note") as HTMLTextAreaElement).value).toBe("Remember the triangle proof");
    fireEvent.click(screen.getByText("Hide manager"));
    expect(screen.queryByLabelText("Sticky note")).toBeNull();
    fireEvent.click(screen.getByText("Show manager"));
    fireEvent.click(screen.getByText("Send to notes"));
    expect(route).toHaveBeenCalledWith({ sourceModuleId: "annotations", prefix: "Sticky note", anchorText: "Remember the triangle proof" });
    fireEvent.click(screen.getByText("Dismiss"));
    expect(onChange.mock.calls.at(-1)![0].whiteboardComments).toEqual([]);
  });
});
