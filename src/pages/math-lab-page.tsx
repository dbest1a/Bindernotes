import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  FunctionSquare,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DesmosGraphModule,
  SavedGraphsModule,
  ScientificCalculatorModule,
  type GraphExpressionRequest,
  type GraphLoadRequest,
} from "@/components/math/math-workspace-modules";
import type { MathBlock } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import {
  useMathWorkspace,
} from "@/hooks/use-math-workspace";
import { prepareExpressionForGraph } from "@/lib/scientific-calculator";
import { cn } from "@/lib/utils";

export function MathLabPage() {
  const { profile } = useAuth();
  const {
    state,
    setGraphExpanded,
    setGraphVisible,
    savedFunctionMap,
    ...mathWorkspace
  } = useMathWorkspace(profile?.id, "math-lab");
  const [snapshotName, setSnapshotName] = useState("");
  const [pendingExpression, setPendingExpression] = useState<GraphExpressionRequest | null>(null);
  const [pendingGraphLoad, setPendingGraphLoad] = useState<GraphLoadRequest | null>(null);

  const headerControls = useMemo(
    () => ({
      graphLabel: state.graphVisible ? "Hide graph" : "Show graph",
      expandLabel: state.graphExpanded ? "Collapse graph" : "Expand graph",
    }),
    [state.graphExpanded, state.graphVisible],
  );

  if (!profile) {
    return <Navigate replace to="/auth" />;
  }

  const pushExpressionToGraph = (expression?: string) => {
    const latex = prepareExpressionForGraph(expression ?? state.calculatorExpression, savedFunctionMap);
    if (!latex) {
      return;
    }

    setGraphVisible(true);
    setPendingGraphLoad(null);
    setPendingExpression({
      id: crypto.randomUUID(),
      latex,
    });
  };
  const bindings = {
    controller: { state, setGraphExpanded, setGraphVisible, savedFunctionMap, ...mathWorkspace },
    lessonGraphs: [] as Extract<MathBlock, { type: "graph" }>[],
    pendingGraphLoad,
    pendingExpression,
    snapshotName,
    jumpToGraphSource: () => {},
    loadLessonGraph: () => {},
    setSnapshotName,
    pushExpressionToGraph,
    onExpressionApplied: (id: string) => {
      setPendingExpression((current) => (current?.id === id ? null : current));
    },
    onGraphLoadApplied: (id: string) => {
      setPendingGraphLoad((current) => (current?.id === id ? null : current));
    },
  };

  return (
    <main className="app-page max-w-[1540px]">
      <Breadcrumbs items={[{ label: "Workspace", to: "/dashboard" }, { label: "Math lab" }]} />

      <section className="hero-grid">
        <div className="page-shell p-6 sm:p-8">
          <Badge variant="outline">Math workspace</Badge>
          <h1 className="mt-4 page-heading max-w-4xl text-4xl sm:text-5xl">
            Desmos graphing with a fast scientific calculator, inside Binder Notes.
          </h1>
          <p className="mt-4 max-w-2xl page-copy">
            Work numerically, graph instantly, keep reusable graph states, and only mount the graphing
            engine when you actually need it.
          </p>
        </div>

        <aside className="hero-aside">
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Toggle the graph on or off to keep the workspace focused.</p>
            <p>Save multiple graph states without leaving the app.</p>
            <p>Send expressions from the calculator straight into Desmos.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => setGraphVisible(!state.graphVisible)} type="button" variant="outline">
              <FunctionSquare data-icon="inline-start" />
              {headerControls.graphLabel}
            </Button>
            <Button
              disabled={!state.graphVisible}
              onClick={() => setGraphExpanded(!state.graphExpanded)}
              type="button"
              variant="ghost"
            >
              {state.graphExpanded ? <Minimize2 data-icon="inline-start" /> : <Maximize2 data-icon="inline-start" />}
              {headerControls.expandLabel}
            </Button>
          </div>
        </aside>
      </section>

      {state.graphVisible ? (
        <section
          className={cn(
            "grid gap-4",
            state.graphExpanded ? "xl:grid-cols-[minmax(0,1.55fr)_380px]" : "xl:grid-cols-[minmax(0,1.2fr)_390px]",
          )}
        >
          <div className="grid gap-4">
            <DesmosGraphModule bindings={bindings} description="Live Desmos graphing calculator" title="Live graph area" />
          </div>

          <div className="grid gap-4">
            <ScientificCalculatorModule bindings={bindings} />
            <SavedGraphsModule bindings={bindings} />
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ScientificCalculatorModule bindings={bindings} />
          <div className="grid gap-4">
            <section className="page-shell p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Graph paused
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">Bring it back when you need it</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The Desmos calculator is fully unmounted while hidden, so the math workspace stays lighter and
                the rest of the app does not carry the graphing engine unnecessarily.
              </p>
              <Button className="mt-5" onClick={() => setGraphVisible(true)} type="button">
                <FunctionSquare data-icon="inline-start" />
                Reopen graph
              </Button>
            </section>
            <SavedGraphsModule bindings={bindings} />
          </div>
        </section>
      )}
    </main>
  );
}
