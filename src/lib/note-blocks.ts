import type { JSONContent } from "@tiptap/react";
import type { MathBlock } from "@/types";
import { emptyDoc } from "@/lib/utils";

export type NoteInsertRequest =
  | { id: string; kind: "paragraph"; text: string }
  | { id: string; kind: "linked-excerpt"; excerpt: string; sourceLabel: string }
  | { id: string; kind: "quote-response"; excerpt: string; sourceLabel: string }
  | { id: string; kind: "sticky-note"; body: string; anchorText?: string | null; sourceLabel: string }
  | { id: string; kind: "callout"; title?: string; body?: string }
  | { id: string; kind: "checklist"; items?: string[] }
  | { id: string; kind: "worked-example"; title?: string; steps?: string[]; takeaway?: string }
  | { id: string; kind: "definition"; term?: string; meaning?: string; whyItMatters?: string }
  | { id: string; kind: "theorem"; title?: string; statement?: string; conditions?: string }
  | { id: string; kind: "proof"; claim?: string; strategy?: string; steps?: string[]; conclusion?: string }
  | { id: string; kind: "formula-reference"; title?: string; formula?: string; useCase?: string }
  | { id: string; kind: "graph-note"; title?: string; focus?: string; observation?: string };

export type NoteInsertDraft = NoteInsertRequest extends infer Request
  ? Request extends { id: string }
    ? Omit<Request, "id">
    : never
  : never;

export function appendParagraphBlock(content: JSONContent, text: string) {
  return appendNodes(content, buildInsertNodes({ id: crypto.randomUUID(), kind: "paragraph", text }));
}

export function appendLinkedExcerptBlock(
  content: JSONContent,
  excerpt: string,
  sourceLabel: string,
) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "linked-excerpt",
      excerpt,
      sourceLabel,
    }),
  );
}

export function appendQuoteAndResponseBlock(
  content: JSONContent,
  excerpt: string,
  sourceLabel: string,
) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "quote-response",
      excerpt,
      sourceLabel,
    }),
  );
}

export function appendCalloutBlock(
  content: JSONContent,
  title = "Callout",
  body = "Capture the key idea here.",
) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "callout",
      title,
      body,
    }),
  );
}

export function appendChecklistBlock(content: JSONContent, items: string[] = ["Review", "Explain", "Test yourself"]) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "checklist",
      items,
    }),
  );
}

export function appendWorkedExampleBlock(
  content: JSONContent,
  title = "Worked example",
  steps = ["State what the problem is asking.", "Work one step at a time.", "Write the final takeaway."],
  takeaway = "What pattern should you remember from this example?",
) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "worked-example",
      title,
      steps,
      takeaway,
    }),
  );
}

export function appendDefinitionBlock(
  content: JSONContent,
  term = "Definition",
  meaning = "Write the idea in your own words.",
  whyItMatters = "Why does this matter in the lesson?",
) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "definition",
      term,
      meaning,
      whyItMatters,
    }),
  );
}

export function appendTheoremBlock(
  content: JSONContent,
  title = "Theorem",
  statement = "State the theorem clearly.",
  conditions = "When can you use it?",
) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "theorem",
      title,
      statement,
      conditions,
    }),
  );
}

export function appendProofBlock(
  content: JSONContent,
  claim = "Claim",
  strategy = "What is the main proof idea?",
  steps = ["State what you know.", "Write the argument one move at a time.", "Justify the key transition."],
  conclusion = "Finish with the exact claim proved.",
) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "proof",
      claim,
      strategy,
      steps,
      conclusion,
    }),
  );
}

export function appendFormulaReferenceBlock(
  content: JSONContent,
  title = "Formula reference",
  formula = "Write the formula here.",
  useCase = "When should you reach for this formula?",
) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "formula-reference",
      title,
      formula,
      useCase,
    }),
  );
}

export function appendGraphNoteBlock(
  content: JSONContent,
  title = "Graph note",
  focus = "What relationship or shape should you watch for?",
  observation = "What does the graph show you?",
) {
  return appendNodes(
    content,
    buildInsertNodes({
      id: crypto.randomUUID(),
      kind: "graph-note",
      title,
      focus,
      observation,
    }),
  );
}

export function appendMathBlock(blocks: MathBlock[], latex = "\\int_0^1 x^2 dx"): MathBlock[] {
  return [
    ...blocks,
    {
      id: crypto.randomUUID(),
      type: "latex",
      label: "Worked formula",
      latex,
    },
  ];
}

export function appendGraphBlock(blocks: MathBlock[], expression = "y=x^2"): MathBlock[] {
  return [
    ...blocks,
    {
      id: crypto.randomUUID(),
      type: "graph",
      label: "Graph reference",
      expressions: [expression],
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
    },
  ];
}

export function buildInsertNodes(request: NoteInsertRequest): JSONContent[] {
  switch (request.kind) {
    case "paragraph":
      return [paragraph(request.text)];
    case "linked-excerpt":
      return [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Linked excerpt" }],
        },
        {
          type: "blockquote",
          content: [paragraph(request.excerpt)],
        },
        paragraph(`Source: ${request.sourceLabel}`),
      ];
    case "quote-response":
      return [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Linked excerpt" }],
        },
        {
          type: "blockquote",
          content: [paragraph(request.excerpt)],
        },
        paragraph(`Source: ${request.sourceLabel}`),
        paragraph("My takeaway: "),
      ];
    case "callout":
      return [
        {
          type: "blockquote",
          content: [
            paragraph(request.title ?? "Callout", true),
            paragraph(request.body ?? "Capture the key idea here."),
          ],
        },
      ];
    case "sticky-note":
      return [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Sticky note" }],
        },
        ...(request.anchorText
          ? [
              {
                type: "blockquote",
                content: [paragraph(request.anchorText)],
              } satisfies JSONContent,
              paragraph(`Source: ${request.sourceLabel}`),
            ]
          : []),
        paragraph(request.body || "Follow up on this idea."),
      ];
    case "checklist":
      return [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Checklist" }],
        },
        {
          type: "bulletList",
          content: (request.items ?? ["Review", "Explain", "Test yourself"]).map((item) => ({
            type: "listItem",
            content: [paragraph(`[ ] ${item}`)],
          })),
        },
      ];
    case "worked-example":
      return [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: request.title ?? "Worked example" }],
        },
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: (
            request.steps ?? [
              "State what the problem is asking.",
              "Work one step at a time.",
              "Write the final takeaway.",
            ]
          ).map((step) => ({
            type: "listItem",
            content: [paragraph(step)],
          })),
        },
        paragraph(`Takeaway: ${request.takeaway ?? "What pattern should you remember from this example?"}`),
      ];
    case "definition":
      return [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: request.term ?? "Definition" }],
        },
        paragraph(request.meaning ?? "Write the idea in your own words."),
        paragraph(`Why it matters: ${request.whyItMatters ?? "Why does this matter in the lesson?"}`),
      ];
    case "theorem":
      return [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: request.title ?? "Theorem" }],
        },
        paragraph(`Statement: ${request.statement ?? "State the theorem clearly."}`),
        paragraph(`Use it when: ${request.conditions ?? "When can you use it?"}`),
      ];
    case "proof":
      return [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: request.claim ?? "Claim" }],
        },
        paragraph(`Strategy: ${request.strategy ?? "What is the main proof idea?"}`),
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: (
            request.steps ?? [
              "State what you know.",
              "Write the argument one move at a time.",
              "Justify the key transition.",
            ]
          ).map((step) => ({
            type: "listItem",
            content: [paragraph(step)],
          })),
        },
        paragraph(`Conclusion: ${request.conclusion ?? "Finish with the exact claim proved."}`),
      ];
    case "formula-reference":
      return [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: request.title ?? "Formula reference" }],
        },
        paragraph(`Formula: ${request.formula ?? "Write the formula here."}`),
        paragraph(`Use it for: ${request.useCase ?? "When should you reach for this formula?"}`),
      ];
    case "graph-note":
      return [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: request.title ?? "Graph note" }],
        },
        paragraph(`Graph focus: ${request.focus ?? "What relationship or shape should you watch for?"}`),
        paragraph(`Observation: ${request.observation ?? "What does the graph show you?"}`),
      ];
  }
}

function appendNodes(content: JSONContent, nodes: JSONContent[]) {
  const base = ensureDoc(content);
  return {
    ...base,
    content: [...(base.content ?? []), ...nodes],
  } satisfies JSONContent;
}

function ensureDoc(content: JSONContent) {
  if (content.type === "doc") {
    return content;
  }

  return emptyDoc();
}

function paragraph(text: string, bold = false): JSONContent {
  return {
    type: "paragraph",
    content: text
      ? [
          {
            type: "text",
            text,
            marks: bold ? [{ type: "bold" }] : undefined,
          },
        ]
      : undefined,
  };
}
