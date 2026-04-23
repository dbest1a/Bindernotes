// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
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
});
