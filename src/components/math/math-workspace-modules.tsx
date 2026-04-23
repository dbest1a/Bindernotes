import { FunctionSquare } from "lucide-react";
import { DesmosGraph } from "@/components/math/desmos-graph";
import { GraphStateList } from "@/components/math/graph-state-list";
import { DesmosScientificCalculator } from "@/components/math/desmos-scientific-calculator";
import { ScientificCalculator } from "@/components/math/scientific-calculator";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import type { MathWorkspaceController } from "@/hooks/use-math-workspace";
import type { MathBlock } from "@/types";

export type GraphExpressionRequest = {
  id: string;
  latex: string;
};

export type GraphLoadRequest = {
  id: string;
  expressions: string[];
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
  title = "Desmos graph",
}: {
  bindings: MathWorkspaceModuleBindings;
  description?: string;
  title?: string;
}) {
  const { controller, onExpressionApplied, onGraphLoadApplied, pendingExpression, pendingGraphLoad = null } = bindings;
  const height = controller.state.graphExpanded
    ? "clamp(620px, 78vh, 860px)"
    : "clamp(540px, 70vh, 760px)";

  return (
    <WorkspacePanel
      actions={
        controller.state.graphVisible ? (
          <>
            <Button onClick={() => controller.setGraphVisible(false)} size="sm" type="button" variant="outline">
              Hide
            </Button>
            <Button onClick={controller.clearCurrentGraph} size="sm" type="button" variant="ghost">
              Reset
            </Button>
          </>
        ) : (
          <Button onClick={() => controller.setGraphVisible(true)} size="sm" type="button" variant="outline">
            <FunctionSquare data-icon="inline-start" />
            Mount graph
          </Button>
        )
      }
      className="min-h-[520px]"
      description={description}
      title={title}
    >
      {controller.state.graphVisible ? (
        <DesmosGraph
          height={height}
          loadRequest={pendingGraphLoad}
          onLoadApplied={onGraphLoadApplied}
          onExpressionApplied={onExpressionApplied}
          onStateChange={controller.setCurrentGraphState}
          pendingExpression={pendingExpression}
          state={controller.state.currentGraphState}
        />
      ) : (
        <EmptyState
          description="The graph engine is unmounted while hidden so the workspace stays lighter."
          title="Graph hidden"
        />
      )}
    </WorkspacePanel>
  );
}

export function ScientificCalculatorModule({
  bindings,
  description = "Numeric work, graphable expressions, and reusable functions",
  title = "Scientific calculator",
}: {
  bindings: MathWorkspaceModuleBindings;
  description?: string;
  title?: string;
}) {
  const { controller, pushExpressionToGraph } = bindings;
  const fallback = (
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
    <WorkspacePanel description={description} title={title}>
      <DesmosScientificCalculator fallback={fallback} />
    </WorkspacePanel>
  );
}

export function SavedGraphsModule({
  bindings,
  description = "Lesson graph references plus your own named Desmos snapshots",
  title = "Saved graphs",
}: {
  bindings: MathWorkspaceModuleBindings;
  description?: string;
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
    <WorkspacePanel description={description} title={title}>
      <GraphStateList
        canSave={Boolean(controller.state.currentGraphState)}
        embedded
        lessonGraphs={lessonGraphs}
        onDelete={controller.deleteGraphSnapshot}
        onJumpToSource={jumpToGraphSource}
        onLoad={controller.loadGraphSnapshot}
        onLoadLessonGraph={(graph) => loadLessonGraph?.(graph)}
        onNameChange={setSnapshotName}
        onSave={() => {
          if (controller.saveGraphSnapshot(snapshotName)) {
            setSnapshotName("");
          }
        }}
        savedGraphs={controller.state.savedGraphs}
        snapshotName={snapshotName}
      />
    </WorkspacePanel>
  );
}
