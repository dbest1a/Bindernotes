import { useEffect, useState } from "react";
import { FunctionSquare } from "lucide-react";
import { Desmos3DGraph, DesmosGraph } from "@/components/math/desmos-graph";
import { GraphStateList } from "@/components/math/graph-state-list";
import { DesmosScientificCalculator } from "@/components/math/desmos-scientific-calculator";
import { ScientificCalculator } from "@/components/math/scientific-calculator";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { hasDesmosApiKey } from "@/lib/desmos-loader";
import type { GraphMode, MathWorkspaceController } from "@/hooks/use-math-workspace";
import type { MathBlock } from "@/types";

export type GraphExpressionRequest = {
  id: string;
  latex: string;
};

export type GraphLoadRequest = {
  id: string;
  expressions: string[];
  graphMode?: GraphMode;
  viewport?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
};

export type MathWorkspaceModuleBindings = {
  controller: MathWorkspaceController;
  lessonGraphs?: Extract<MathBlock, { type: "graph" }>[];
  pendingGraphLoad?: GraphLoadRequest | null;
  pendingExpression: GraphExpressionRequest | null;
  snapshotName: string;
  jumpToGraphSource?: (block: Extract<MathBlock, { type: "graph" }>) => void;
  loadLessonGraph?: (block: Extract<MathBlock, { type: "graph" }>) => void;
  setSnapshotName: (value: string) => void;
  pushExpressionToGraph: (expression?: string) => void;
  onExpressionApplied: (id: string) => void;
  onGraphLoadApplied?: (id: string) => void;
};

export function DesmosGraphModule({
  bindings,
  description = "Live Desmos graphing calculator",
  mathPerformanceLazyLoading = false,
  showKeypad = true,
  surface = "workspace",
  title = "Desmos graph",
}: {
  bindings: MathWorkspaceModuleBindings;
  description?: string;
  mathPerformanceLazyLoading?: boolean;
  showKeypad?: boolean;
  surface?: "workspace" | "whiteboard";
  title?: string;
}) {
  const { controller, onExpressionApplied, onGraphLoadApplied, pendingExpression, pendingGraphLoad = null } = bindings;
  const [graphActivated, setGraphActivated] = useState(
    () => !mathPerformanceLazyLoading || Boolean(pendingExpression || pendingGraphLoad || controller.state.currentGraphState),
  );
  const [keypadOpen, setKeypadOpen] = useState(() => !mathPerformanceLazyLoading && showKeypad);
  const [graphExpression, setGraphExpression] = useState("y=x^2");
  const [queuedExpression, setQueuedExpression] = useState<string | null>(null);

  useEffect(() => {
    if (pendingGraphLoad?.graphMode) {
      controller.setGraphMode(pendingGraphLoad.graphMode);
    }
  }, [controller.setGraphMode, pendingGraphLoad?.graphMode, pendingGraphLoad?.id]);

  useEffect(() => {
    if (pendingExpression || pendingGraphLoad) {
      setGraphActivated(true);
    }
  }, [pendingExpression, pendingGraphLoad]);

  const height =
    surface === "whiteboard"
      ? "100%"
      : controller.state.graphExpanded
        ? "clamp(620px, 78vh, 860px)"
        : "clamp(540px, 70vh, 760px)";
  const activeModeLabel = controller.state.graphMode === "3d" ? "3D Graph" : "2D Graph";
  const graphRuntimeVisible = controller.state.graphVisible && (!mathPerformanceLazyLoading || graphActivated);
  const effectiveShowKeypad = showKeypad && (!mathPerformanceLazyLoading || keypadOpen);
  const canUseDesmos = hasDesmosApiKey();
  const activateGraph = () => {
    setGraphActivated(true);
    controller.setGraphVisible(true);
  };
  const plotGraphExpression = () => {
    const expression = graphExpression.trim();
    if (!expression) {
      return;
    }

    setQueuedExpression(expression);
    bindings.pushExpressionToGraph(expression);
    if (canUseDesmos) {
      setGraphActivated(true);
    }
  };
  const graphInputControl = mathPerformanceLazyLoading ? (
    <form
      className="mb-3 rounded-lg border border-border/70 bg-background/78 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        plotGraphExpression();
      }}
    >
      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground" htmlFor="binder-notes-graph-expression">
        Graph expression
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Input
          aria-label="Graph expression"
          className="min-w-[220px] flex-1"
          id="binder-notes-graph-expression"
          onChange={(event) => setGraphExpression(event.target.value)}
          placeholder="Try y=x, y=2x+3, y=x^2, y=sin(x), x=3"
          value={graphExpression}
        />
        <Button type="submit">
          <FunctionSquare data-icon="inline-start" />
          Plot expression
        </Button>
        <Button
          onClick={() => {
            setGraphExpression("y=x^2-4");
            setQueuedExpression("y=x^2-4");
            bindings.pushExpressionToGraph("y=x^2-4");
            if (canUseDesmos) {
              setGraphActivated(true);
            }
          }}
          type="button"
          variant="outline"
        >
          Try y=x^2-4
        </Button>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground" role="status">
        {!canUseDesmos
          ? `Desmos is unavailable here. ${queuedExpression ? `Queued expression: ${queuedExpression}` : "You can still stage an expression from this field."}`
          : queuedExpression
            ? `Queued expression: ${queuedExpression}`
            : "Use the BinderNotes input first; the Desmos keypad stays collapsed until you open it."}
      </p>
    </form>
  ) : null;

  return (
    <WorkspacePanel
      actions={
        graphRuntimeVisible ? (
          <>
            <div className="flex items-center gap-1 rounded-md border border-border/70 bg-background/70 p-1">
              <Button
                onClick={() => controller.setGraphMode("2d")}
                size="sm"
                type="button"
                variant={controller.state.graphMode === "2d" ? "default" : "ghost"}
              >
                2D
              </Button>
              <Button
                onClick={() => controller.setGraphMode("3d")}
                size="sm"
                type="button"
                variant={controller.state.graphMode === "3d" ? "default" : "ghost"}
              >
                3D
              </Button>
            </div>
            <Button onClick={() => controller.setGraphVisible(false)} size="sm" type="button" variant="outline">
              Hide
            </Button>
            <Button onClick={controller.clearCurrentGraph} size="sm" type="button" variant="ghost">
              Reset
            </Button>
            {mathPerformanceLazyLoading && showKeypad && !keypadOpen ? (
              <Button onClick={() => setKeypadOpen(true)} size="sm" type="button" variant="outline">
                Show keypad
              </Button>
            ) : null}
          </>
        ) : (
          <Button onClick={activateGraph} size="sm" type="button" variant="outline">
            <FunctionSquare data-icon="inline-start" />
            Prepare graph
          </Button>
        )
      }
      className={surface === "whiteboard" ? "h-full min-h-0" : "min-h-[520px]"}
      description={`${description} Current mode: ${activeModeLabel}.`}
      title={title}
    >
      {graphInputControl}
      {mathPerformanceLazyLoading && !canUseDesmos ? (
        <CompactDesmosFallback />
      ) : graphRuntimeVisible ? (
        controller.state.graphMode === "3d" ? (
          <Desmos3DGraph
            height={height}
            loadRequest={pendingGraphLoad}
            onLoadApplied={onGraphLoadApplied}
            onExpressionApplied={onExpressionApplied}
            onStateChange={controller.setCurrentGraphState}
            pendingExpression={pendingExpression}
            showKeypad={effectiveShowKeypad}
            state={controller.state.currentGraphState}
          />
        ) : (
          <DesmosGraph
            height={height}
            loadRequest={pendingGraphLoad}
            onLoadApplied={onGraphLoadApplied}
            onExpressionApplied={onExpressionApplied}
            onStateChange={controller.setCurrentGraphState}
            pendingExpression={pendingExpression}
            showKeypad={effectiveShowKeypad}
            state={controller.state.currentGraphState}
          />
        )
      ) : (
        <GraphPreview onOpen={activateGraph} />
      )}
    </WorkspacePanel>
  );
}

function GraphPreview({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="math-graph-preview" data-math-lazy-preview="desmos">
      <div className="math-graph-preview__plot" aria-hidden="true">
        <svg viewBox="0 0 320 160" role="img">
          <path d="M24 132H300" />
          <path d="M48 18V142" />
          <path d="M46 126C90 96 118 88 154 92C195 96 218 54 286 34" />
        </svg>
      </div>
      <div>
        <h4>Graph ready when you need it</h4>
        <p>Desmos stays unmounted until you open it, keeping the study surface lighter.</p>
        <Button onClick={onOpen} size="sm" type="button">
          <FunctionSquare data-icon="inline-start" />
          Open graph
        </Button>
      </div>
    </div>
  );
}

function CompactDesmosFallback() {
  return (
    <div
      className="math-graph-preview math-graph-preview--fallback"
      data-desmos-compact-fallback="true"
      data-testid="desmos-compact-fallback"
    >
      <div className="math-graph-preview__plot" aria-hidden="true">
        <svg viewBox="0 0 320 160" role="img">
          <path d="M24 132H300" />
          <path d="M48 18V142" />
          <path d="M44 120C82 94 112 74 150 78C194 82 220 118 286 44" />
        </svg>
      </div>
      <div>
        <h4>Graph preview</h4>
        <p>Desmos is unavailable in this environment. The graph slot stays compact instead of loading a broken tool.</p>
      </div>
    </div>
  );
}

export function ScientificCalculatorModule({
  bindings,
  description = "Numeric work, graphable expressions, and reusable functions",
  mathPerformanceLazyLoading = false,
  surface = "workspace",
  title = "Scientific calculator",
}: {
  bindings: MathWorkspaceModuleBindings;
  description?: string;
  mathPerformanceLazyLoading?: boolean;
  surface?: "workspace" | "whiteboard";
  title?: string;
}) {
  const { controller, pushExpressionToGraph } = bindings;
  const calculatorHeight = surface === "whiteboard" ? "100%" : "clamp(520px, 68vh, 720px)";
  const localCalculator = (
    <ScientificCalculator
      angleMode={controller.state.angleMode}
      embedded
      error={controller.state.calculatorError}
      expression={controller.state.calculatorExpression}
      graphEnabled={controller.state.graphVisible}
      history={controller.state.history}
      lastAnswer={controller.lastAnswer ?? undefined}
      onAngleModeChange={controller.setAngleMode}
      onAppendToken={controller.appendToken}
      onBackspace={controller.backspace}
      onClearExpression={controller.clearExpression}
      onClearHistory={controller.clearHistory}
      onDeleteFunction={controller.deleteSavedFunction}
      onDeleteHistoryItem={controller.deleteHistoryItem}
      onEvaluate={controller.evaluate}
      onExpressionChange={controller.setExpression}
      onReuseExpression={controller.reuseHistoryExpression}
      onReuseFunction={controller.reuseSavedFunction}
      onSendFunctionToGraph={pushExpressionToGraph}
      onSendToGraph={() => pushExpressionToGraph()}
      result={controller.state.calculatorResult}
      savedFunctions={controller.state.savedFunctions}
    />
  );

  return (
    <WorkspacePanel className={surface === "whiteboard" ? "h-full min-h-0" : "min-h-[520px]"} description={description} title={title}>
      <div className={surface === "whiteboard" ? "h-full min-h-0" : "min-h-[460px]"}>
        {surface === "whiteboard" || mathPerformanceLazyLoading ? (
          localCalculator
        ) : (
          <DesmosScientificCalculator fallback={localCalculator} height={calculatorHeight} />
        )}
      </div>
    </WorkspacePanel>
  );
}

export function SavedGraphsModule({
  bindings,
  description = "Lesson graph references plus your own named Desmos snapshots",
  mathPerformanceLazyLoading = false,
  surface = "workspace",
  title = "Saved graphs",
}: {
  bindings: MathWorkspaceModuleBindings;
  description?: string;
  mathPerformanceLazyLoading?: boolean;
  surface?: "workspace" | "whiteboard";
  title?: string;
}) {
  const {
    controller,
    jumpToGraphSource,
    lessonGraphs = [],
    loadLessonGraph,
    setSnapshotName,
    snapshotName,
  } = bindings;

  return (
    <WorkspacePanel className={surface === "whiteboard" ? "h-full min-h-0" : undefined} description={description} title={title}>
      <GraphStateList
        canSave={Boolean(controller.state.currentGraphState)}
        embedded
        lessonGraphs={lessonGraphs}
        onDelete={controller.deleteGraphSnapshot}
        onJumpToSource={jumpToGraphSource}
        onLoad={controller.loadGraphSnapshot}
        onLoadLessonGraph={(graph) => loadLessonGraph?.(graph)}
        onNameChange={setSnapshotName}
        onGraphExpression={mathPerformanceLazyLoading ? bindings.pushExpressionToGraph : undefined}
        onSave={() => {
          if (controller.saveGraphSnapshot(snapshotName)) {
            setSnapshotName("");
          }
        }}
        revampBetaActive={mathPerformanceLazyLoading}
        savedGraphs={controller.state.savedGraphs}
        snapshotName={snapshotName}
      />
    </WorkspacePanel>
  );
}
