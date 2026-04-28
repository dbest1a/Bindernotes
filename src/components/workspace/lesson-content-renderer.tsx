import type { JSONContent } from "@tiptap/react";
import { Fragment, memo, useMemo, type JSX, type ReactNode } from "react";
import { buildHighlightSegments, extractRenderablePlainText, type HighlightSegment } from "@/lib/highlights";
import { buildLessonSectionAnchorId, normalizeReferenceText } from "@/lib/study-references";
import type { Highlight, HighlightColor } from "@/types";

export function buildLessonContentSelector(lessonId?: string, whiteboardModuleId?: string) {
  const selector = lessonId
    ? `[data-lesson-content="true"][data-lesson-id="${escapeSelectorAttribute(lessonId)}"]`
    : `[data-lesson-content="true"]`;

  return whiteboardModuleId
    ? `${selector}[data-whiteboard-module-id="${escapeSelectorAttribute(whiteboardModuleId)}"]`
    : selector;
}

export const LessonContentRenderer = memo(function LessonContentRenderer({
  content,
  highlights,
  lessonId,
  whiteboardAnnotationKind,
  whiteboardModuleId,
  whiteboardModuleType,
}: {
  content: JSONContent;
  highlights: Highlight[];
  lessonId?: string;
  whiteboardAnnotationKind?: string;
  whiteboardModuleId?: string;
  whiteboardModuleType?: string;
}) {
  const plainText = useMemo(() => extractRenderablePlainText(content), [content]);
  const segments = useMemo(() => buildHighlightSegments(highlights, plainText), [highlights, plainText]);
  const cursor = { value: 0 };
  const headingOccurrences = new Map<string, number>();

  return (
    <div
      className="source-reading-flow"
      data-lesson-content="true"
      data-lesson-id={lessonId}
      data-whiteboard-annotation-kind={whiteboardAnnotationKind}
      data-whiteboard-annotation-surface={whiteboardModuleId ? "true" : undefined}
      data-whiteboard-module-id={whiteboardModuleId}
      data-whiteboard-module-type={whiteboardModuleType}
    >
      {renderNode(content, segments, cursor, lessonId, headingOccurrences)}
    </div>
  );
});

function escapeSelectorAttribute(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function renderNode(
  node: JSONContent,
  segments: HighlightSegment[],
  cursor: { value: number },
  lessonId?: string,
  headingOccurrences?: Map<string, number>,
): ReactNode {
  if (node.type === "doc") {
    return (
      <>
        {(node.content ?? []).map((child, index) => (
          <Fragment key={buildNodeKey(child, cursor.value, index)}>
            {renderNode(child, segments, cursor, lessonId, headingOccurrences)}
          </Fragment>
        ))}
      </>
    );
  }

  if (node.type === "text") {
    return renderTextNode(node, segments, cursor);
  }

  if (node.type === "hardBreak") {
    return <br />;
  }

  const children = (node.content ?? []).map((child, index) => (
    <Fragment key={buildNodeKey(child, cursor.value, index)}>
      {renderNode(child, segments, cursor, lessonId, headingOccurrences)}
    </Fragment>
  ));

  switch (node.type) {
    case "paragraph":
      return <p>{children}</p>;
    case "heading": {
      const level = clampHeadingLevel(node.attrs?.level);
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      const headingText = extractRenderablePlainText(node).trim();
      const normalizedHeading = normalizeReferenceText(headingText);
      const occurrence = headingOccurrences && headingText
        ? (headingOccurrences.get(normalizedHeading) ?? 0)
        : 0;
      if (headingOccurrences && headingText) {
        headingOccurrences.set(normalizedHeading, occurrence + 1);
      }
      const anchorId =
        lessonId && headingText
          ? buildLessonSectionAnchorId(lessonId, headingText, occurrence)
          : undefined;

      return (
        <Tag
          data-lesson-anchor={anchorId}
          data-lesson-heading={headingText || undefined}
          id={anchorId}
          style={{ scrollMarginTop: "110px" }}
        >
          {children}
        </Tag>
      );
    }
    case "bulletList":
      return <ul>{children}</ul>;
    case "orderedList":
      return <ol>{children}</ol>;
    case "listItem":
      return <li>{children}</li>;
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre>
          <code>{children}</code>
        </pre>
      );
    default:
      return <>{children}</>;
  }
}

function renderTextNode(
  node: JSONContent,
  segments: HighlightSegment[],
  cursor: { value: number },
) {
  const text = node.text ?? "";
  if (!text) {
    return null;
  }

  const textStart = cursor.value;
  const textEnd = textStart + text.length;
  cursor.value = textEnd;

  const overlaps = segments.filter((segment) => segment.end > textStart && segment.start < textEnd);
  if (overlaps.length === 0) {
    return applyMarks(text, node.marks);
  }

  const pieces: ReactNode[] = [];
  let localCursor = 0;

  overlaps.forEach((segment, index) => {
    const localStart = Math.max(0, segment.start - textStart);
    const localEnd = Math.min(text.length, segment.end - textStart);

    if (localStart > localCursor) {
      pieces.push(
        <Fragment key={`${segment.id}-plain-${index}`}>
          {applyMarks(text.slice(localCursor, localStart), node.marks)}
        </Fragment>,
      );
    }

    if (localEnd > localStart) {
      pieces.push(
        <span
          className={`lesson-highlight lesson-highlight--${segment.color}`}
          data-highlight-color={segment.color}
          data-highlight-id={segment.id}
          key={`${segment.id}-mark-${index}`}
        >
          {applyMarks(text.slice(localStart, localEnd), node.marks)}
        </span>,
      );
    }

    localCursor = Math.max(localCursor, localEnd);
  });

  if (localCursor < text.length) {
    pieces.push(
      <Fragment key={`${textStart}-tail`}>
        {applyMarks(text.slice(localCursor), node.marks)}
      </Fragment>,
    );
  }

  return pieces;
}

function applyMarks(text: string, marks?: JSONContent["marks"]) {
  if (!text) {
    return null;
  }

  return (marks ?? []).reduceRight<ReactNode>((current, mark, index) => {
    switch (mark.type) {
      case "bold":
        return <strong key={`mark-${mark.type}-${index}`}>{current}</strong>;
      case "italic":
        return <em key={`mark-${mark.type}-${index}`}>{current}</em>;
      case "underline":
        return <u key={`mark-${mark.type}-${index}`}>{current}</u>;
      case "strike":
        return <s key={`mark-${mark.type}-${index}`}>{current}</s>;
      case "code":
        return <code key={`mark-${mark.type}-${index}`}>{current}</code>;
      case "highlight": {
        const color = normalizeMarkColor(mark.attrs?.color);
        return (
          <span
            className={`lesson-highlight lesson-highlight--${color}`}
            data-highlight-color={color}
            key={`mark-${mark.type}-${index}`}
          >
            {current}
          </span>
        );
      }
      default:
        return current;
    }
  }, text);
}

function normalizeMarkColor(color?: string): HighlightColor {
  switch (color) {
    case "#93c5fd":
      return "blue";
    case "#86efac":
      return "green";
    case "#f9a8d4":
      return "pink";
    case "#fdba74":
      return "orange";
    case "#fde68a":
    default:
      return "yellow";
  }
}

function clampHeadingLevel(level?: number) {
  if (!level || level < 1 || level > 6) {
    return 2;
  }

  return level;
}

function buildNodeKey(node: JSONContent, offset: number, index: number) {
  return `${node.type ?? "node"}:${offset}:${index}`;
}
