import type { JSONContent } from "@tiptap/react";
import type { MathBlock } from "@/types";

export type MathSuggestion = {
  key: string;
  kind: "graph" | "latex";
  source: string;
  label: string;
  helper: string;
};

const graphPattern =
  /\b(?:y\s*=|f\s*\(\s*x\s*\)\s*=|sin\s*\(\s*x\s*\)|cos\s*\(\s*x\s*\)|tan\s*\(\s*x\s*\)|x\s*\^|\bsqrt\s*\(\s*x)/i;
const latexPattern =
  /(\\(?:frac|sqrt|int|sum|lim|theta|pi|alpha|beta)|\b(?:int|lim|sum|theta|pi)\b|[_^]\{)/i;

export function detectMathSuggestions(
  content: JSONContent,
  existingBlocks: MathBlock[] = [],
): MathSuggestion[] {
  const text = extractPlainText(content);
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const existingGraphSources = new Set(
    existingBlocks
      .filter((block): block is Extract<MathBlock, { type: "graph" }> => block.type === "graph")
      .flatMap((block) => block.expressions.map((expression) => normalizeKey(expression))),
  );
  const existingLatexSources = new Set(
    existingBlocks
      .filter((block): block is Extract<MathBlock, { type: "latex" }> => block.type === "latex")
      .map((block) => normalizeKey(block.latex)),
  );

  const suggestions: MathSuggestion[] = [];

  lines.forEach((line) => {
    const latexExpression = extractLatexExpression(line);
    const graphExpression = extractGraphExpression(line);
    const normalized = normalizeKey(latexExpression ?? graphExpression ?? line);
    if (!normalized || suggestions.some((suggestion) => suggestion.key === normalized)) {
      return;
    }

    if (latexExpression && !existingLatexSources.has(normalized)) {
      suggestions.push({
        key: normalized,
        kind: "latex",
        source: latexExpression,
        label: "Create math block",
        helper: "Save this as a reusable formatted equation.",
      });
      return;
    }

    if (graphExpression && !existingGraphSources.has(normalized)) {
      suggestions.push({
        key: normalized,
        kind: "graph",
        source: graphExpression,
        label: "Graph in Desmos",
        helper: "Open this expression in the live graph module.",
      });
    }
  });

  return suggestions.slice(0, 4);
}

export function extractPlainText(node: JSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  const pieces = (node.content ?? []).map((child) => extractPlainText(child)).filter(Boolean);
  const separator =
    node.type === "paragraph" ||
    node.type === "heading" ||
    node.type === "blockquote" ||
    node.type === "listItem"
      ? "\n"
      : " ";

  return pieces.join(separator);
}

function normalizeKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractGraphExpression(line: string) {
  const explicitEquation = line.match(/(?:y\s*=|f\s*\(\s*x\s*\)\s*=)[^,.;]+/i)?.[0];
  if (explicitEquation) {
    return explicitEquation
      .split(/\s+(?:and|for|in|with|when|then|because)\b/i)[0]
      .trim();
  }

  if (graphPattern.test(line)) {
    return line.trim();
  }

  return null;
}

function extractLatexExpression(line: string) {
  if (!latexPattern.test(line)) {
    return null;
  }

  const commandMatch = line.match(/(\\(?:frac|sqrt|int|sum|lim|theta|pi|alpha|beta)[^,.;]*)/i);
  if (commandMatch) {
    return commandMatch[1].trim();
  }

  return line.trim();
}
