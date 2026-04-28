import { useEffect } from "react";
import { FunctionSquare } from "lucide-react";
import { Desmos3DGraph, DesmosGraph } from "@/components/math/desmos-graph";
import { GraphStateList } from "@/components/math/graph-state-list";
import { DesmosScientificCalculator } from "@/components/math/desmos-scientific-calculator";
import { ScientificCalculator } from "@/components/math/scientific-calculator";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
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
  surface = "workspace",
  title = "Desmos graph",
}: {
  bindings: MathWorkspaceModuleBindings;
  description?: string;
  surface?: "workspace" | "whiteboard";
  title?: string;
}) {
  const { controller, onExpressionApplied, onGraphLoadApplied, pendingExpression, pendingGraphLoad = null } = bindings;
  useEffect(() => {
    if (pendingGraphLoad?.graphMode) {
      controller.setGraphMode(pendingGraphLoad.graphMode);
    }
  }, [controller.setGraphMode, pendingGraphLoad?.graphMode, pendingGraphLoad?.id]);

  const height =
    surface === "whiteboard"
      ? "100%"
      : controller.state.graphExpanded
        ? "clamp(620px, 78vh, 860px)"
        : "clamp(540px, 70vh, 760px)";
  const activeModeLabel = controller.state.graphMode === "3d" ? "3D Graph" : "2D Graph";

  return (
    <WorkspacePanel
      actions={
        controller.state.graphVisible ? (
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
          </>
        ) : (
          <Button onClick={() => controller.setGraphVisible(true)} size="sm" type="button" variant="outline">
            <FunctionSquare data-icon="inline-start" />
            Mount graph
          </Button>
        )
      }
      className={surface === "whiteboard" ? "h-full min-h-0" : "min-h-[520px]"}
      description={`${description} Current mode: ${activeModeLabel}.`}
      title={title}
    >
      {controller.state.graphVisible ? (
        controller.state.graphMode === "3d" ? (
          <Desmos3DGraph
            height={height}
            loadRequest={pendingGraphLoad}
            onLoadApplied={onGraphLoadApplied}
            onExpressionApplied={onExpressionApplied}
            onStateChange={controller.setCurrentGraphState}
            pendingExpression={pendingExpression}
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
            state={controller.state.currentGraphState}
          />
        )
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
  surface = "workspace",
  title = "Scientific calculator",
}: {
  bindings: MathWorkspaceModuleBindings;
  description?: string;
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
        {surface === "whiteboard" ? (
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
  surface = "workspace",
  title = "Saved graphs",
}: {
  bindings: MathWorkspaceModuleBindings;
  description?: string;
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
