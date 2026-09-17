// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WhiteboardToolbar } from "@/components/whiteboard/whiteboard-toolbar";

describe("WhiteboardToolbar", () => {
  it("renders as a compact dock instead of a full-width board overlay", () => {
    render(
      <WhiteboardToolbar
        objectCount={0}
        onSaveNow={vi.fn()}
        saveStatus="saved"
        storageLabel="Loaded from Supabase"
        title="Vectors, Matrices Continued, Probability, Growth, Series, and Precalculus Limits whiteboard"
        warning={null}
      />,
    );

    const toolbar = screen.getByTestId("whiteboard-toolbar");
    expect(toolbar.className).toContain("right-3");
    expect(toolbar.className).toContain("bottom-3");
    expect(toolbar.className).toContain("max-w-[min(20rem,calc(100%-1.5rem))]");
    expect(toolbar.className).not.toContain("left-4");
    expect(toolbar.className).not.toContain("right-4");
    expect(screen.getByRole("button", { name: "Save whiteboard now" })).toBeTruthy();
    expect(screen.getByText("0 objects")).toBeTruthy();
  });
});
