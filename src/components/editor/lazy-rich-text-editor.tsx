import { lazy, Suspense } from "react";
import type { RichTextEditorProps } from "@/components/editor/rich-text-editor";

const RichTextEditorChunk = lazy(() =>
  import("@/components/editor/rich-text-editor").then((module) => ({
    default: module.RichTextEditor,
  })),
);

export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense
      fallback={
        <div
          aria-live="polite"
          className={`rich-text-editor-loading ${props.className ?? ""}`}
          role="status"
        >
          Loading editor...
        </div>
      }
    >
      <RichTextEditorChunk {...props} />
    </Suspense>
  );
}
