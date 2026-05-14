import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { EditorContent, JSONContent, Mark, mergeAttributes, type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import {
  Bold,
  Code2,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Quote,
  UnderlineIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildInsertNodes, type NoteInsertRequest } from "@/lib/note-blocks";
import { cn } from "@/lib/utils";

const CommentAnnotation = Mark.create({
  name: "commentAnnotation",
  inclusive: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => (attributes.id ? { "data-comment-id": attributes.id } : {}),
      },
      body: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-comment-body") ?? "",
        renderHTML: (attributes) => (attributes.body ? { "data-comment-body": attributes.body } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-annotation]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-comment-annotation": "true",
        class: "bn-comment-annotation",
      }),
      0,
    ];
  },
});

const SelectionTagAnnotation = Mark.create({
  name: "selectionTagAnnotation",
  inclusive: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tag-id"),
        renderHTML: (attributes) => (attributes.id ? { "data-tag-id": attributes.id } : {}),
      },
      tag: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-selection-tag") ?? "",
        renderHTML: (attributes) => (attributes.tag ? { "data-selection-tag": attributes.tag } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-selection-tag]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-selection-tag-annotation": "true",
        class: "bn-selection-tag",
      }),
      0,
    ];
  },
});

const SourceMarkerAnnotation = Mark.create({
  name: "sourceMarker",
  inclusive: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-source-id"),
        renderHTML: (attributes) => (attributes.id ? { "data-source-id": attributes.id } : {}),
      },
      binderId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-source-binder-id"),
        renderHTML: (attributes) => (attributes.binderId ? { "data-source-binder-id": attributes.binderId } : {}),
      },
      binderTitle: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source-binder-title") ?? "",
        renderHTML: (attributes) =>
          attributes.binderTitle ? { "data-source-binder-title": attributes.binderTitle } : {},
      },
      lessonId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-source-lesson-id"),
        renderHTML: (attributes) => (attributes.lessonId ? { "data-source-lesson-id": attributes.lessonId } : {}),
      },
      lessonTitle: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source-lesson-title") ?? "",
        renderHTML: (attributes) =>
          attributes.lessonTitle ? { "data-source-lesson-title": attributes.lessonTitle } : {},
      },
      sectionLabel: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source-section-label") ?? "",
        renderHTML: (attributes) =>
          attributes.sectionLabel ? { "data-source-section-label": attributes.sectionLabel } : {},
      },
      pageLabel: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source-page-label") ?? "",
        renderHTML: (attributes) =>
          attributes.pageLabel ? { "data-source-page-label": attributes.pageLabel } : {},
      },
      excerpt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source-excerpt") ?? "",
        renderHTML: (attributes) =>
          attributes.excerpt ? { "data-source-excerpt": attributes.excerpt } : {},
      },
      sourceUrl: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source-url") ?? "",
        renderHTML: (attributes) =>
          attributes.sourceUrl ? { "data-source-url": attributes.sourceUrl } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-source-marker]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-source-marker": "true",
        class: "bn-source-marker",
      }),
      0,
    ];
  },
});

export type RichTextEditorProps = {
  value: JSONContent;
  onChange?: (value: JSONContent) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  surface?: "editor" | "lesson";
  insertRequest?: NoteInsertRequest | null;
  onInsertApplied?: (id: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
  showToolbar?: boolean;
  ariaLabel?: string;
};

export function RichTextEditor({
  ariaLabel,
  value,
  onChange,
  editable = true,
  placeholder = "Write notes...",
  className,
  surface = "editor",
  insertRequest,
  onInsertApplied,
  onEditorReady,
  showToolbar = true,
}: RichTextEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        link: {
          autolink: true,
          linkOnPaste: true,
          openOnClick: false,
          HTMLAttributes: {
            class: "note-editor-link",
            rel: "noopener noreferrer nofollow",
            target: "_blank",
          },
        },
      }),
      Highlight.configure({ multicolor: true }),
      CommentAnnotation,
      SelectionTagAnnotation,
      SourceMarkerAnnotation,
      Typography,
      Placeholder.configure({ placeholder }),
    ],
    [placeholder],
  );
  const appliedInsertIdRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  const editorSnapshotRef = useRef(JSON.stringify(value));
  const valueSnapshot = useMemo(() => JSON.stringify(value), [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions,
    content: value,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none",
        tabindex: editable ? "0" : "-1",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        "aria-multiline": "true",
        "aria-readonly": editable ? "false" : "true",
      },
    },
    onUpdate: ({ editor: instance }) => {
      if (!instance.isFocused) {
        return;
      }

      const next = instance.getJSON();
      editorSnapshotRef.current = JSON.stringify(next);
      onChangeRef.current?.(next);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(editable);
    if (!editable && editor.isFocused) {
      editor.commands.blur();
    }
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor || !insertRequest) {
      return;
    }

    if (appliedInsertIdRef.current === insertRequest.id) {
      return;
    }

    appliedInsertIdRef.current = insertRequest.id;
    editor.chain().focus().insertContent(buildInsertNodes(insertRequest)).run();
    onInsertApplied?.(insertRequest.id);
  }, [editor, insertRequest, onInsertApplied]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (editorSnapshotRef.current === valueSnapshot) {
      return;
    }

    const editorSnapshot = JSON.stringify(editor.getJSON());
    editorSnapshotRef.current = editorSnapshot;
    if (editorSnapshot === valueSnapshot) {
      return;
    }

    if (!editor.isDestroyed) {
      editor.commands.setContent(value, { emitUpdate: false });
      editorSnapshotRef.current = valueSnapshot;
    }
  }, [editor, value, valueSnapshot]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-3", surface === "lesson" && "lesson-surface", className)}>
      {editable && showToolbar ? (
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/75 bg-card/94 p-1.5 shadow-sm backdrop-blur">
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            label="Heading"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 data-icon="inline-start" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bold")}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold data-icon="inline-start" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic data-icon="inline-start" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("underline")}
            label="Underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon data-icon="inline-start" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            label="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List data-icon="inline-start" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            label="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered data-icon="inline-start" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("blockquote")}
            label="Quote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote data-icon="inline-start" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("codeBlock")}
            label="Code"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Code2 data-icon="inline-start" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("highlight")}
            label="Highlight"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            <Highlighter data-icon="inline-start" />
          </ToolbarButton>
        </div>
      ) : null}
      <div className={cn(surface === "editor" && "editor-surface")}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className={cn("rounded-md", active && "bg-secondary text-foreground shadow-sm")}
      onClick={onClick}
      size="icon"
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}
