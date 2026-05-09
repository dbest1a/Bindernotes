import type { JSONContent } from "@tiptap/react";
import { extractPlainText } from "@/lib/math-detection";

export type AccidentalNotePrefixDetection = {
  prefix: string;
  reason: "accidental-prefix";
};

const ACCIDENTAL_PREFIX_PATTERN =
  /^([;:'"`.,/\\|~!?()[\]{}_\-\s\u2018\u2019\u201C\u201D]{3,}[a-z]{0,3}\s+)/i;
const ACCIDENTAL_PUNCTUATION_PATTERN = /[;:'"`.,/\\|~!?()[\]{}_\-\u2018\u2019\u201C\u201D]/;

export function detectAccidentalNotePrefix(content: JSONContent): AccidentalNotePrefixDetection | null {
  const plainText = extractPlainText(content);
  const match = ACCIDENTAL_PREFIX_PATTERN.exec(plainText);

  if (!match?.[1]) {
    return null;
  }

  const prefix = match[1];
  const punctuationCount = [...prefix].filter((character) => ACCIDENTAL_PUNCTUATION_PATTERN.test(character)).length;
  if (punctuationCount < 3) {
    return null;
  }

  return {
    prefix,
    reason: "accidental-prefix",
  };
}

export function cleanAccidentalNotePrefix(content: JSONContent, prefix: string): JSONContent {
  if (!prefix) {
    return content;
  }

  let remaining = prefix.length;

  const cleanNode = (node: JSONContent): JSONContent => {
    if (remaining <= 0) {
      return node;
    }

    if (typeof node.text === "string") {
      const nextText = node.text.slice(Math.min(remaining, node.text.length));
      remaining = Math.max(0, remaining - node.text.length);
      return nextText ? { ...node, text: nextText } : { ...node, text: "" };
    }

    if (!node.content) {
      return node;
    }

    return {
      ...node,
      content: node.content
        .map((child) => cleanNode(child))
        .filter((child) => child.type !== "text" || Boolean(child.text)),
    };
  };

  return cleanNode(content);
}
