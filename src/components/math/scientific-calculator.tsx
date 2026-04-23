import { Calculator, Delete, Eraser, FunctionSquare, History, RotateCcw } from "lucide-react";
import { Braces, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CalculatorHistoryItem, SavedMathFunction } from "@/hooks/use-math-workspace";
import type { AngleMode } from "@/lib/scientific-calculator";
import { cn } from "@/lib/utils";

const keypadRows = [
  ["sin(", "cos(", "tan(", "(", ")"],
  ["asin(", "acos(", "atan(", "sqrt(", "root("],
  ["log(", "ln(", "pi", "e", "^"],
  ["7", "8", "9", "/", "x"],
  ["4", "5", "6", "*", "C"],
  ["1", "2", "3", "-", "DEL"],
  ["0", ".", ",", "+", "Ans"],
  ["="],
];

export function ScientificCalculator({
  angleMode,
  embedded = false,
  error,
  expression,
  graphEnabled,
  history,
  lastAnswer,
  onAngleModeChange,
  onAppendToken,
  onBackspace,
  onClearExpression,
  onClearHistory,
  onDeleteHistoryItem,
  onEvaluate,
  onExpressionChange,
  onReuseExpression,
  onReuseFunction,
  onSendToGraph,
  onSendFunctionToGraph,
  onDeleteFunction,
  result,
  savedFunctions,
}: {
  angleMode: AngleMode;
  embedded?: boolean;
  error: string | null;
  expression: string;
  graphEnabled: boolean;
  history: CalculatorHistoryItem[];
  lastAnswer?: number;
  onAngleModeChange: (mode: AngleMode) => void;
  onAppendToken: (token: string) => void;
  onBackspace: () => void;
  onClearExpression: () => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
  onEvaluate: () => void;
  onExpressionChange: (expression: string) => void;
  onReuseExpression: (expression: string) => void;
  onReuseFunction: (id: string) => void;
  onSendToGraph: () => void;
  onSendFunctionToGraph: (expression: string) => void;
  onDeleteFunction: (id: string) => void;
  result: string | null;
  savedFunctions: SavedMathFunction[];
}) {
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Scientific calculator
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Fast numeric work</h2>
        </div>
        <div className="flex items-center gap-2">
          <Toggle active={angleMode === "rad"} label="Rad" onClick={() => onAngleModeChange("rad")} />
          <Toggle active={angleMode === "deg"} label="Deg" onClick={() => onAngleModeChange("deg")} />
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-border/75 bg-background/90 p-4">
        <Input
          className="h-12 border-0 bg-transparent px-0 text-lg font-medium shadow-none focus-visible:ring-0"
          onChange={(event) => onExpressionChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onEvaluate();
            }
          }}
          placeholder="Try x^2+1, sin(pi/4), root(3,27), or f(x)=x^3-2x"
          value={expression}
        />
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Function notation is supported for graphing and saved reusable functions like <code>f(x)=x^2+1</code>.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Result
            </p>
            <p className={cn("mt-1 text-2xl font-semibold tracking-tight", error && "text-destructive")}>
              {error ?? result ?? "Ready"}
            </p>
            {typeof lastAnswer === "number" ? (
              <p className="mt-1 text-xs text-muted-foreground">Ans = {lastAnswer}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onBackspace} type="button" variant="outline">
              <Delete data-icon="inline-start" />
              Delete
            </Button>
            <Button onClick={onClearExpression} type="button" variant="ghost">
              <Eraser data-icon="inline-start" />
              Clear
            </Button>
            <Button onClick={onEvaluate} type="button">
              <Calculator data-icon="inline-start" />
              Evaluate
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-5">
        {keypadRows.flatMap((row, rowIndex) =>
          row.map((label) => (
            <Button
              className={row.length === 1 ? "sm:col-span-5" : undefined}
              key={`${rowIndex}-${label}`}
              onClick={() => handleKey(label, { onAppendToken, onBackspace, onClearExpression, onEvaluate })}
              type="button"
              variant={label === "=" ? "default" : "outline"}
            >
              {label}
            </Button>
          )),
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FunctionSquare className="size-4 text-primary" />
          Send the current expression into the graphing workspace.
        </div>
        <Button onClick={onSendToGraph} type="button" variant={graphEnabled ? "default" : "secondary"}>
          <FunctionSquare data-icon="inline-start" />
          {graphEnabled ? "Add to graph" : "Show graph and add"}
        </Button>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Braces className="size-4 text-primary" />
            Saved functions
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {savedFunctions.map((item) => (
            <div className="rounded-lg border border-border/75 bg-background/80 p-4" key={item.id}>
              <p className="text-sm font-medium">{item.name}(x)</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.expression}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => onReuseFunction(item.id)} size="sm" type="button" variant="outline">
                  Reuse
                </Button>
                <Button
                  onClick={() => onSendFunctionToGraph(`${item.name}(x)=${item.expression}`)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <FunctionSquare data-icon="inline-start" />
                  Graph
                </Button>
                <Button onClick={() => onDeleteFunction(item.id)} size="sm" type="button" variant="ghost">
                  <Trash2 data-icon="inline-start" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {savedFunctions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
              Save reusable functions by evaluating entries like <code>f(x)=x^2+1</code> or <code>g(x)=sin(x)</code>.
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <History className="size-4 text-primary" />
            Expression history
          </div>
          <Button onClick={onClearHistory} type="button" variant="ghost">
            <RotateCcw data-icon="inline-start" />
            Clear history
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {history.map((item) => (
            <div className="rounded-lg border border-border/75 bg-background/80 p-4" key={item.id}>
              <button
                className="w-full text-left"
                onClick={() => onReuseExpression(item.expression)}
                type="button"
              >
                <p className="text-sm font-medium">{item.expression}</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">{item.result}</p>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => onReuseExpression(item.expression)} size="sm" type="button" variant="outline">
                  Reuse
                </Button>
                {item.kind === "value" ? (
                  <Button onClick={() => onSendFunctionToGraph(item.expression)} size="sm" type="button" variant="outline">
                    <FunctionSquare data-icon="inline-start" />
                    Graph
                  </Button>
                ) : null}
                <Button onClick={() => onDeleteHistoryItem(item.id)} size="sm" type="button" variant="ghost">
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
              Your recent calculations will appear here so you can reuse or graph them without retyping.
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <section className="page-shell p-5">
      {content}
    </section>
  );
}

function handleKey(
  value: string,
  controls: {
    onAppendToken: (token: string) => void;
    onBackspace: () => void;
    onClearExpression: () => void;
    onEvaluate: () => void;
  },
) {
  if (value === "DEL") {
    controls.onBackspace();
    return;
  }

  if (value === "C") {
    controls.onClearExpression();
    return;
  }

  if (value === "=") {
    controls.onEvaluate();
    return;
  }

  if (value === "Ans") {
    controls.onAppendToken("ans");
    return;
  }

  controls.onAppendToken(value);
}

function Toggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition",
        active ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-muted-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
