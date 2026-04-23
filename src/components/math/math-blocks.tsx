import katex from "katex";
import { ArrowUpRight, FunctionSquare, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { inferMathBlockLabel } from "@/lib/study-references";
import type { MathBlock } from "@/types";

type GraphMathBlock = Extract<MathBlock, { type: "graph" }>;

export function MathBlocks({
  blocks,
  editable = false,
  onChange,
  onJumpToSource,
  onOpenGraphBlock,
  onSendToGraph,
}: {
  blocks: MathBlock[];
  editable?: boolean;
  onChange?: (blocks: MathBlock[]) => void;
  onJumpToSource?: (block: MathBlock) => void;
  onOpenGraphBlock?: (block: GraphMathBlock) => void;
  onSendToGraph?: (expression: string) => void;
}) {
  const updateBlock = (id: string, patch: Partial<MathBlock>) => {
    onChange?.(
      blocks.map((block) => (block.id === id ? ({ ...block, ...patch } as MathBlock) : block)),
    );
  };

  const removeBlock = (id: string) => {
    onChange?.(blocks.filter((block) => block.id !== id));
  };

  const addLatex = () => {
    onChange?.([
      ...blocks,
      {
        id: crypto.randomUUID(),
        type: "latex",
        label: "Formula reference",
        latex: "x^2+1",
      },
    ]);
  };

  const addGraph = () => {
    onChange?.([
      ...blocks,
      {
        id: crypto.randomUUID(),
        type: "graph",
        label: "Graph reference",
        expressions: ["y=x^2"],
        xMin: -5,
        xMax: 5,
        yMin: -5,
        yMax: 10,
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block) => (
        <div className="math-card" key={block.id}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <BlockHeader
                block={block}
                editable={editable}
                onJumpToSource={onJumpToSource}
                onUpdate={updateBlock}
              />
            </div>
            {editable ? (
              <Button
                aria-label="Remove math block"
                onClick={() => removeBlock(block.id)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 data-icon="inline-start" />
              </Button>
            ) : null}
          </div>

          {block.type === "latex" ? (
            <LatexBlock block={block} editable={editable} onChange={updateBlock} />
          ) : (
            <GraphBlock
              block={block}
              editable={editable}
              onChange={updateBlock}
              onOpenGraphBlock={onOpenGraphBlock}
              onSendToGraph={onSendToGraph}
            />
          )}
        </div>
      ))}

      {editable ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={addLatex} type="button" variant="outline">
            <Plus data-icon="inline-start" />
            Formula
          </Button>
          <Button onClick={addGraph} type="button" variant="outline">
            <Plus data-icon="inline-start" />
            Graph
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BlockHeader({
  block,
  editable,
  onJumpToSource,
  onUpdate,
}: {
  block: MathBlock;
  editable: boolean;
  onJumpToSource?: (block: MathBlock) => void;
  onUpdate: (id: string, patch: Partial<MathBlock>) => void;
}) {
  const label = inferMathBlockLabel(block);

  if (editable) {
    return (
      <div className="flex flex-col gap-2">
        <Input
          onChange={(event) => onUpdate(block.id, { label: event.target.value } as Partial<MathBlock>)}
          placeholder={label}
          value={block.label ?? ""}
        />
        <Input
          onChange={(event) =>
            onUpdate(
              block.id,
              { sourceHeading: event.target.value || null } as Partial<MathBlock>,
            )
          }
          placeholder="Linked lesson heading"
          value={block.sourceHeading ?? ""}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {block.sourceHeading && onJumpToSource ? (
        <button
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-left text-sm font-semibold tracking-tight transition hover:border-primary/35 hover:bg-accent/55"
          onClick={() => onJumpToSource(block)}
          type="button"
        >
          <Link2 className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      ) : (
        <p className="text-sm font-semibold tracking-tight">{label}</p>
      )}
      <span className="rounded-full border border-border/70 bg-secondary/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {block.type === "latex" ? "Formula" : "Graph"}
      </span>
      {block.sourceHeading ? (
        <span className="rounded-full border border-border/60 bg-background/75 px-2.5 py-1 text-xs text-muted-foreground">
          {block.sourceHeading}
        </span>
      ) : null}
    </div>
  );
}

function LatexBlock({
  block,
  editable,
  onChange,
}: {
  block: Extract<MathBlock, { type: "latex" }>;
  editable: boolean;
  onChange: (id: string, patch: Partial<MathBlock>) => void;
}) {
  const html = katex.renderToString(block.latex, {
    throwOnError: false,
    displayMode: true,
  });

  return (
    <div className="flex flex-col gap-3">
      {editable ? (
        <Input
          onChange={(event) => onChange(block.id, { latex: event.target.value } as Partial<MathBlock>)}
          placeholder="\\int_0^1 x^2 dx"
          value={block.latex}
        />
      ) : null}
      {block.description ? (
        <p className="text-sm leading-6 text-muted-foreground">{block.description}</p>
      ) : null}
      <div
        className="overflow-x-auto rounded-xl bg-background p-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function GraphBlock({
  block,
  editable,
  onChange,
  onOpenGraphBlock,
  onSendToGraph,
}: {
  block: GraphMathBlock;
  editable: boolean;
  onChange: (id: string, patch: Partial<MathBlock>) => void;
  onOpenGraphBlock?: (block: GraphMathBlock) => void;
  onSendToGraph?: (expression: string) => void;
}) {
  const openGraph = () => {
    if (onOpenGraphBlock) {
      onOpenGraphBlock(block);
      return;
    }

    if (onSendToGraph) {
      onSendToGraph(block.expressions.join("\n"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {editable ? (
        <>
          <Textarea
            onChange={(event) =>
              onChange(block.id, {
                expressions: event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              } as Partial<MathBlock>)
            }
            placeholder={"y=x^2\ny=sin(x)\ny=2x+1"}
            value={block.expressions.join("\n")}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              onChange={(event) =>
                onChange(block.id, { description: event.target.value || null } as Partial<MathBlock>)
              }
              placeholder="What this graph set is for"
              value={block.description ?? ""}
            />
            <Input
              onChange={(event) =>
                onChange(block.id, { topic: event.target.value || null } as Partial<MathBlock>)
              }
              placeholder="Topic or category"
              value={block.topic ?? ""}
            />
          </div>
        </>
      ) : null}
      <div className="rounded-xl border border-border/70 bg-background/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-tight">Lesson graph reference</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {block.description ??
                "This graph set can reopen inside the live Desmos graph so you can explore the exact lesson setup."}
            </p>
          </div>
          {(onOpenGraphBlock || onSendToGraph) && block.expressions[0] ? (
            <Button onClick={openGraph} size="sm" type="button" variant="outline">
              <FunctionSquare data-icon="inline-start" />
              Open in Desmos
            </Button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {block.expressions.map((expression) => (
            <span
              className="rounded-full border border-border/70 bg-secondary/80 px-3 py-1 text-xs font-medium text-foreground"
              key={expression}
            >
              {expression}
            </span>
          ))}
        </div>
        {block.topic ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowUpRight className="size-3.5" />
            {block.topic}
          </div>
        ) : null}
      </div>
    </div>
  );
}
