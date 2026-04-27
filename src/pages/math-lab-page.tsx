import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Cuboid,
  FunctionSquare,
  ListChecks,
  Maximize2,
  Minimize2,
  PenTool,
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
import { useAuth } from "@/hooks/use-auth";
import {
  useMathWorkspace,
} from "@/hooks/use-math-workspace";
import { prepareExpressionForGraph } from "@/lib/scientific-calculator";
import { cn } from "@/lib/utils";
import type {
  MathBlock,
} from "@/types";

const calculusModuleCards = [
  {
    title: "Derivative as Slope",
    description: "A 2D Desmos module for tangent lines, secants, and f'(a).",
    href: "/math/modules/derivative-as-slope",
    badge: "2D Desmos",
    icon: FunctionSquare,
  },
  {
    title: "Taylor Polynomial Explorer",
    description: "Compare sin(x) with first, third, and fifth degree Taylor approximations.",
    href: "/math/modules/taylor-polynomial-explorer",
    badge: "2D Desmos",
    icon: FunctionSquare,
  },
  {
    title: "Surface and Tangent Plane",
    description: "A 3D Desmos module for z=x^2+y^2, partials, and tangent planes.",
    href: "/math/modules/surface-and-tangent-plane-explorer",
    badge: "3D Desmos",
    icon: Cuboid,
  },
  {
    title: "Jacob Multivariable Surfaces",
    description: "The Jacob flagship 3D module for surfaces, partials, and tangent planes.",
    href: "/math/modules/jacob-multivariable-surfaces",
    badge: "3D Jacob",
    icon: Cuboid,
  },
];

export function MathLabPage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const {
    state,
    setGraphExpanded,
    setGraphMode,
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

  if (searchParams.get("lab") === "whiteboard") {
    return <Navigate replace to="/math/lab/whiteboard" />;
  }

  const pushExpressionToGraph = (expression?: string) => {
    const latex = prepareExpressionForGraph(expression ?? state.calculatorExpression, savedFunctionMap);
    if (!latex) {
      return;
    }

    setGraphVisible(true);
    setGraphMode("2d");
    setPendingGraphLoad(null);
    setPendingExpression({
      id: crypto.randomUUID(),
      latex,
    });
  };
  const bindings = {
    controller: { state, setGraphExpanded, setGraphMode, setGraphVisible, savedFunctionMap, ...mathWorkspace },
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

      <section className="page-shell flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            MathLab
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Math tools</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="default">
            <FunctionSquare data-icon="inline-start" />
            Math tools
          </Button>
          <Button asChild variant="outline">
            <Link to="/math/lab/whiteboard">
              <PenTool data-icon="inline-start" />
              Whiteboard Lab
            </Link>
          </Button>
        </div>
      </section>

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
            <Button asChild>
              <Link to="/math">
                <ListChecks data-icon="inline-start" />
                Open math modules
              </Link>
            </Button>
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

      <section className="page-shell grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <Badge variant="outline">New math feature</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Math Whiteboard lives inside the lesson workspace.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Open a math lesson, choose Math Practice Mode or Full Math Canvas, and use Whiteboard as a graph-paper board
            with templates plus live lesson, notes, formula, graph, and calculator cards.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/math/lab/whiteboard">
            <PenTool data-icon="inline-start" />
            Open Whiteboard Lab
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="page-shell p-5">
          <Badge variant="outline">Module launcher</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            The guided 2D and 3D Desmos modules live here too.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Use this free lab for scratch work, or jump into the production math modules for
            graph-linked lessons, saved graph states, and practice questions.
          </p>
          <Button asChild className="mt-5" variant="outline">
            <Link to="/math/questions">
              Open question bank
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {calculusModuleCards.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                className="group rounded-lg border border-border/70 bg-card/85 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card"
                key={module.href}
                to={module.href}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <Badge variant="secondary">{module.badge}</Badge>
                </div>
                <h3 className="mt-4 font-semibold tracking-tight">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Open module
                  <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
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
