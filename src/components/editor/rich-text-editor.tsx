import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { EditorContent, JSONContent, type Editor, useEditor } from "@tiptap/react";
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

type RichTextEditorProps = {
  value: JSONContent;
  onChange?: (value: JSONContent) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  surface?: "editor" | "lesson";
  insertRequest?: NoteInsertRequest | null;
  onInsertApplied?: (id: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
};

export function RichTextEditor({
  value,
  onChange,
  editable = true,
  placeholder = "Write notes...",
  className,
  surface = "editor",
  insertRequest,
  onInsertApplied,
  onEditorReady,
}: RichTextEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Typography,
      Placeholder.configure({ placeholder }),
    ],
    [placeholder],
  );
  const appliedInsertIdRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions,
    content: value,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none",
        tabindex: editable ? "0" : "-1",
        "aria-readonly": editable ? "false" : "true",
      },
    },
    onUpdate: ({ editor: instance }) => {
      if (!instance.isFocused) {
        return;
      }

      const next = instance.getJSON();
      onChange?.(next);
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

    const editorSnapshot = JSON.stringify(editor.getJSON());
    const valueSnapshot = JSON.stringify(value);
    if (editorSnapshot === valueSnapshot) {
      return;
    }

    if (!editor.isDestroyed) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-3", surface === "lesson" && "lesson-surface", className)}>
      {editable ? (
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
