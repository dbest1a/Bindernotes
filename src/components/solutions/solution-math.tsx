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

const LEADING_SPACE = /^(?:\s|\\[;,:! ]|\\q?quad\b|~)+/;
const TRAILING_SPACE = /(?:\s|\\[;,:! ]|\\q?quad|~)+$/;

/** The space that follows a piece: a quad between results, a word space after a comma, a relation's thick space. */
export type MathPieceGap = "wide" | "narrow" | "relation";

const RELATION_COMMANDS = new Set([
  "approx", "equiv", "sim", "simeq", "cong", "propto", "le", "leq", "ge", "geq", "ne", "neq",
  "to", "Rightarrow", "Leftrightarrow", "implies", "iff",
]);
const RELATION_CHARS = new Set(["=", "<", ">", ":"]);

/**
 * Splits display LaTeX where TeX would let a long line break: after top-level relations (=, ≈, ≤,
 * ⇒ …), after ";" and ",", and at \quad or \qquad (dropped). The pieces sit side by side and wrap
 * only when the card is too narrow, so a line that fits looks unchanged. Never splits inside
 * braces, brackets, \left…\right pairs or environments.
 */
export function splitDisplayMath(latex: string): Array<{ latex: string; gap: MathPieceGap }> {
  const pieces: Array<{ latex: string; gap: MathPieceGap }> = [];
  const push = (part: string, gap: MathPieceGap) => {
    const trimmed = part.replace(LEADING_SPACE, "").replace(TRAILING_SPACE, "");
    if (trimmed) pieces.push({ latex: trimmed, gap });
  };
  // A relation directly followed by another (":=", "<=") is one symbol, so it does not split.
  const joinsNext = (from: number) => /^\s*(?:[=<>:]|\\(?:approx|equiv|le|leq|ge|geq|ne|neq)\b)/.test(latex.slice(from));
  let depth = 0;
  let start = 0;
  let index = 0;
  while (index < latex.length) {
    const char = latex[index];
    if (char === "\\") {
      const command = /^\\(?:[a-zA-Z]+|.)/.exec(latex.slice(index))?.[0] ?? "\\";
      const name = command.slice(1);
      const end = index + command.length;
      if (name === "left" || name === "begin" || name === "{" || name === "langle") {
        depth += 1;
      } else if (name === "right" || name === "end" || name === "}" || name === "rangle") {
        depth -= 1;
      } else if (depth === 0 && (name === "quad" || name === "qquad")) {
        push(latex.slice(start, index), "wide");
        start = end;
      } else if (depth === 0 && RELATION_COMMANDS.has(name) && !joinsNext(end)) {
        push(latex.slice(start, end), "relation");
        start = end;
      }
      index = end;
      continue;
    }
    if (char === "{" || char === "(" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === ")" || char === "]") {
      depth -= 1;
    } else if (depth === 0 && (char === ";" || char === ",")) {
      push(latex.slice(start, index + 1), char === ";" ? "wide" : "narrow");
      start = index + 1;
    } else if (depth === 0 && RELATION_CHARS.has(char) && !joinsNext(index + 1)) {
      push(latex.slice(start, index + 1), "relation");
      start = index + 1;
    }
    index += 1;
  }
  push(latex.slice(start), "wide");
  return pieces.length > 0 ? pieces : [{ latex, gap: "wide" }];
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
  const pieces = useMemo(
    () =>
      (display ? splitDisplayMath(latex) : [{ latex, gap: "wide" as const }]).map((piece) => ({
        html: renderLatex(piece.latex, display),
        gap: piece.gap,
      })),
    [latex, display],
  );
  if (pieces.length > 1) {
    return (
      <span aria-label={ariaLabel ?? latex} className={cn("solution-math solution-math--display solution-math--parts", className)} role="math">
        {pieces.map((piece, index) => (
          <span className="solution-math__part" dangerouslySetInnerHTML={{ __html: piece.html }} data-gap={piece.gap} key={index} />
        ))}
      </span>
    );
  }
  return (
    <span
      aria-label={ariaLabel ?? latex}
      className={cn("solution-math", display ? "solution-math--display" : "solution-math--inline", className)}
      dangerouslySetInnerHTML={{ __html: pieces[0].html }}
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
