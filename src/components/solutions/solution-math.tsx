import { memo, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

const KATEX_OPTIONS = {
  throwOnError: false,
  strict: "ignore" as const,
  trust: false,
  maxSize: 40,
  maxExpand: 500,
};

export function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex.trim() || "\\;", { ...KATEX_OPTIONS, displayMode });
  } catch {
    return "";
  }
}

/** Renders one LaTeX expression with KaTeX. Memoised so scrubbing never re-typesets untouched rows. */
export const SolutionMath = memo(function SolutionMath({
  latex,
  display = true,
  className,
  ariaLabel,
}: {
  latex: string;
  display?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const html = useMemo(() => renderLatex(latex, display), [latex, display]);
  return (
    <span
      aria-label={ariaLabel ?? latex}
      className={cn("solution-math", display ? "solution-math--display" : "solution-math--inline", className)}
      dangerouslySetInnerHTML={{ __html: html }}
      role="math"
    />
  );
});

const INLINE_MATH_PATTERN = /\$([^$]+)\$/g;

/** Renders text with inline $…$ math, as used by the problem statement. */
export const SolutionRichText = memo(function SolutionRichText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const segments: Array<{ kind: "text" | "math"; value: string }> = [];
    let lastIndex = 0;
    for (const match of text.matchAll(INLINE_MATH_PATTERN)) {
      const index = match.index ?? 0;
      if (index > lastIndex) {
        segments.push({ kind: "text", value: text.slice(lastIndex, index) });
      }
      segments.push({ kind: "math", value: match[1] });
      lastIndex = index + match[0].length;
    }
    if (lastIndex < text.length) {
      segments.push({ kind: "text", value: text.slice(lastIndex) });
    }
    return segments;
  }, [text]);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.kind === "math" ? <SolutionMath display={false} key={index} latex={part.value} /> : <span key={index}>{part.value}</span>,
      )}
    </span>
  );
});
