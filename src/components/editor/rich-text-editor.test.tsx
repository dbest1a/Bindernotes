// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import type { Editor, JSONContent } from "@tiptap/react";

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

  it("renders highlight, underline, and link marks from editor commands", async () => {
    const editorRef: { current: Editor | null } = { current: null };

    render(<RichTextEditor onEditorReady={(instance) => { editorRef.current = instance; }} showToolbar={false} value={value} />);

    await waitFor(() => {
      expect(editorRef.current).not.toBeNull();
    });
    const editor = editorRef.current;
    if (!editor) {
      throw new Error("Editor did not mount");
    }

    act(() => {
      editor.chain().focus().setTextSelection({ from: 1, to: 2 }).toggleHighlight({ color: "#fde68a" }).run();
      editor.chain().focus().setTextSelection({ from: 3, to: 8 }).toggleUnderline().run();
      editor.chain().focus().setTextSelection({ from: 9, to: 13 }).setLink({ href: "https://example.com/study" }).run();
    });

    expect(document.querySelector("mark")?.textContent).toBe("A");
    expect(document.querySelector("u")?.textContent).toBe("small");
    const link = document.querySelector("a.note-editor-link") as HTMLAnchorElement | null;
    expect(link?.textContent).toBe("note");
    expect(link?.href).toBe("https://example.com/study");
  });

  it("serializes Personal Notes annotation marks for comments, tags, and source citations", async () => {
    const editorRef: { current: Editor | null } = { current: null };

    render(<RichTextEditor onEditorReady={(instance) => { editorRef.current = instance; }} showToolbar={false} value={value} />);

    await waitFor(() => {
      expect(editorRef.current).not.toBeNull();
    });
    const editor = editorRef.current;
    if (!editor) {
      throw new Error("Editor did not mount");
    }

    act(() => {
      editor.chain().focus().setTextSelection({ from: 1, to: 2 }).setMark("commentAnnotation", {
        body: "Remember this",
        id: "comment-1",
      }).run();
      editor.chain().focus().setTextSelection({ from: 3, to: 8 }).setMark("selectionTagAnnotation", {
        id: "tag-1",
        tag: "definition",
      }).run();
      editor.chain().focus().setTextSelection({ from: 9, to: 13 }).setMark("sourceMarker", {
        excerpt: "A source excerpt survives edits.",
        id: "source-1",
        lessonTitle: "Lesson A",
        pageLabel: "p. 4",
        sectionLabel: "Section 2",
        sourceUrl: "/binders/binder-1/documents/lesson-a#section-2",
      }).run();
    });

    expect(document.querySelector(".bn-comment-annotation")?.textContent).toBe("A");
    expect(document.querySelector(".bn-selection-tag")?.textContent).toBe("small");
    expect(document.querySelector(".bn-source-marker")?.textContent).toBe("note");

    const marks = editor.getJSON().content?.[0]?.content?.flatMap((node) => node.marks ?? []) ?? [];
    expect(marks.map((mark) => mark.type)).toEqual(
      expect.arrayContaining(["commentAnnotation", "selectionTagAnnotation", "sourceMarker"]),
    );
    const sourceMarker = marks.find((mark) => mark.type === "sourceMarker");
    expect(sourceMarker?.attrs).toMatchObject({
      excerpt: "A source excerpt survives edits.",
      pageLabel: "p. 4",
      sectionLabel: "Section 2",
      sourceUrl: "/binders/binder-1/documents/lesson-a#section-2",
    });
  });

  it.each([
    ["commentAnnotation", { id: "comment", body: "Retain this comment" }],
    ["selectionTagAnnotation", { id: "tag", tag: "definition" }],
    ["link", { href: "https://example.com/source" }],
  ])("propagates an unfocused %s command to the parent and does not echo hydration", async (mark, attrs) => {
    let editor: Editor | null = null;
    const onChange = vi.fn();
    const { rerender } = render(<RichTextEditor onChange={onChange} onEditorReady={(value) => { editor = value; }} value={value} />);
    await waitFor(() => expect(editor).not.toBeNull());
    act(() => { editor!.chain().setTextSelection({ from: 1, to: 8 }).setMark(mark as string, attrs as Record<string, unknown>).run(); });
    expect(editor!.isFocused).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(editor!.getJSON());
    const saved = onChange.mock.calls.at(-1)![0];
    expect(saved.content[0].content[0].marks).toEqual(expect.arrayContaining([expect.objectContaining({ type: mark })]));
    onChange.mockClear();
    rerender(<RichTextEditor onChange={onChange} value={{ type: "doc", content: [{ type: "paragraph" }] }} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
