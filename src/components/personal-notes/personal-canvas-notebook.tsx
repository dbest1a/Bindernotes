import { lazy, Suspense, useMemo } from "react";
import { createStarterElements } from "@/lib/whiteboards/whiteboard-templates";
import type { WhiteboardTemplate } from "@/lib/whiteboards/whiteboard-types";
import { readPersonalCanvasDescription } from "@/lib/personal-canvas";
import type { PersonalNoteBinder } from "@/types";

const CanvasWorkspace = lazy(() => import("@/pages/math-whiteboard-lab-page").then(module => ({ default: module.MathWhiteboardLabPage })));
const areas: Record<string, Array<[string, string]>> = {
  study: [["Source", "Add a lesson card or collect key passages."], ["My notes", "Explain the idea in your own words."], ["Key ideas", "Connect definitions, examples, and diagrams."], ["Questions", "What would you like to understand next?"]],
  math: [["Problem", "Write the question and the givens."], ["Working", "Show each step and explain your reasoning."], ["Graph or diagram", "Add a graph card or sketch the relationship."], ["Check", "Verify your result and record the units."]],
  history: [["Timeline", "Place the events in order."], ["Sources", "Record evidence and who created it."], ["Connections", "Compare causes, consequences, and perspectives."], ["Argument", "Support a claim with the evidence."]],
  planning: [["Goal", "What will you learn or finish?"], ["Next actions", "Break the work into small steps."], ["Resources", "Keep the material you need nearby."], ["Review", "Track progress and unanswered questions."]],
};

export function personalCanvasTemplate(layout: string, title: string): WhiteboardTemplate {
  return {
    id: `personal-canvas-${layout}`,
    name: title,
    description: "Your private canvas notebook.",
    subject: "general",
    starterElements: areas[layout] ? createStarterElements(`personal-canvas-${layout}`, title, areas[layout], layout === "math" ? "graph" : undefined) : [],
  };
}

export function PersonalCanvasNotebook({ binder, ownerId, layout, onBack }: {
  binder: PersonalNoteBinder;
  ownerId: string;
  layout: string;
  onBack: () => void;
}) {
  const template = useMemo(() => personalCanvasTemplate(layout, binder.title), [layout, binder.title]);
  if (binder.owner_id !== ownerId) return <p role="alert">This notebook belongs to a different account.</p>;
  return <section className="personal-canvas-notebook" aria-label={`${binder.title} canvas notebook`} style={{ minHeight: "38rem", height: "calc(100dvh - 8rem)" }}>
    <Suspense fallback={<p role="status">Opening your canvas…</p>}>
      <CanvasWorkspace key={binder.id} notebook={{ id: binder.id, title: binder.title, description: readPersonalCanvasDescription(binder.description)?.description ?? "" }} initialTemplate={template} onBack={onBack} />
    </Suspense>
  </section>;
}
