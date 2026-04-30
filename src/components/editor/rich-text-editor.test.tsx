// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import type { JSONContent } from "@tiptap/react";

const value: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "A small note" }],
    },
  ],
};

describe("RichTextEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not register duplicate underline extensions", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<RichTextEditor value={value} />);

    await waitFor(() => {
      expect(document.querySelector(".ProseMirror")).not.toBeNull();
    });

    expect(
      warnSpy.mock.calls.some((call) =>
        call.some(
          (value) =>
            typeof value === "string" &&
            value.includes("Duplicate extension names found") &&
            value.includes("underline"),
        ),
      ),
    ).toBe(false);
  });

  it("can hide the fixed editor toolbar while keeping the writing surface", async () => {
    render(<RichTextEditor showToolbar={false} value={value} />);

    await waitFor(() => {
      expect(document.querySelector(".ProseMirror")).not.toBeNull();
    });

    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Highlight" })).toBeNull();
    expect(document.querySelector(".ProseMirror")).not.toBeNull();
  });
});
