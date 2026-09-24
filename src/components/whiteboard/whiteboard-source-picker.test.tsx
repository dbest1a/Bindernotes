// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardPinnedObjectLayer } from "@/components/whiteboard/whiteboard-pinned-object-layer";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

const context = {
  binder: { id: "math-lab", title: "Math Lab" },
  selectedLesson: { id: "math-lab-whiteboard", binder_id: "math-lab", title: "Math Lab" },
  library: {
    folders: [{ id: "folder-math", name: "Math" }, { id: "folder-empty", name: "Empty folder" }],
    folderBinders: [{ folder_id: "folder-math", binder_id: "binder-math" }],
    binders: [
      { id: "binder-math", title: "Mathematics" },
      { id: "binder-unfiled", title: "Personal science" },
      { id: "binder-empty", title: "Empty binder" },
    ],
    lessons: [
      { id: "lesson-limits", binder_id: "binder-math", title: "Limits", order_index: 0, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Approach a value from either side." }] }] }, math_blocks: [] },
      { id: "lesson-atoms", binder_id: "binder-unfiled", title: "Atoms", order_index: 0, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Electrons occupy shells around the nucleus." }] }] }, math_blocks: [] },
    ],
    loading: false,
    error: null,
  },
} as unknown as WorkspaceModuleContext;

const moduleElement: WhiteboardModuleElement = {
  id: "lesson-card", type: "bindernotes-module", moduleId: "lesson", x: 0, y: 0, width: 420, height: 320,
  zIndex: 1, mode: "live", anchorMode: "board", pinned: true, sourceConfirmed: false,
  createdAt: "2026-09-24T00:00:00Z", updatedAt: "2026-09-24T00:00:00Z",
};

function renderPicker() {
  const onChange = vi.fn();
  render(<WhiteboardPinnedObjectLayer context={context} modules={[moduleElement]} onChangeModule={onChange} onRemoveModule={vi.fn()} renderModule={() => null} />);
  return { onChange, picker: screen.getByTestId("whiteboard-source-lesson-picker") };
}

describe("whiteboard source selection", () => {
  afterEach(cleanup);

  it("shows unfiled binders even when the library already contains folders", () => {
    const { onChange, picker } = renderPicker();
    fireEvent.click(within(picker).getByRole("button", { name: "Personal science" }));
    expect(within(picker).getByLabelText("Lesson preview").textContent).toContain("Electrons occupy shells");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(picker).getByRole("button", { name: "Use this lesson" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ binderId: "binder-unfiled", lessonId: "lesson-atoms", sourceConfirmed: true }));
  });

  it("searches lesson titles across folders and previews the matching lesson before insertion", () => {
    const { onChange, picker } = renderPicker();
    fireEvent.click(within(picker).getByRole("button", { name: "Math" }));
    fireEvent.change(within(picker).getByRole("searchbox", { name: "Search lessons and binders" }), { target: { value: " aToMs " } });
    expect(within(picker).queryByRole("button", { name: "Mathematics" })).toBeNull();
    expect(within(picker).getByRole("button", { name: "Atoms" })).toBeTruthy();
    expect(within(picker).getByLabelText("Lesson preview").textContent).toContain("Electrons occupy shells");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(picker).getByRole("button", { name: "Use this lesson" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ binderId: "binder-unfiled", lessonId: "lesson-atoms" }));
  });

  it("cannot insert a stale lesson after switching to an empty folder", () => {
    const { onChange, picker } = renderPicker();
    fireEvent.click(within(picker).getByRole("button", { name: "Mathematics" }));
    fireEvent.click(within(picker).getByRole("button", { name: "Empty folder" }));
    const confirm = within(picker).getByRole("button", { name: "Use this lesson" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(within(picker).queryByLabelText("Lesson preview")).toBeNull();
    fireEvent.click(confirm);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("requires a real lesson before confirming an empty binder or unmatched search", () => {
    const { onChange, picker } = renderPicker();
    fireEvent.click(within(picker).getByRole("button", { name: "Empty binder" }));
    expect((within(picker).getByRole("button", { name: "Use this lesson" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(picker).getByRole("searchbox"), { target: { value: "no match" } });
    expect(within(picker).getByText("No lessons or binders match your search.")).toBeTruthy();
    expect((within(picker).getByRole("button", { name: "Use this lesson" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
