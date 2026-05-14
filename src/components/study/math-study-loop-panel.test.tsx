// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listStudyItems } from "@/services/study-items-service";
import { listProblemLogEntries, saveStudyGraphLink } from "@/services/math-study-loop-service";
import { GraphStudyCard, MathStudyLoopPanel } from "@/components/study/math-study-loop-panel";
import * as desmosLoader from "@/lib/desmos-loader";

vi.mock("@/lib/desmos-loader", () => ({
  hasDesmosApiKey: vi.fn(),
}));

vi.mock("@/components/math/desmos-graph", () => ({
  DesmosGraph: () => <div data-testid="heavy-desmos-graph">Heavy graph</div>,
  Desmos3DGraph: () => <div data-testid="heavy-desmos-3d-graph">Heavy 3D graph</div>,
}));

const formulas = [
  {
    explanation: "Derivative rules turn local change into a reusable shortcut.",
    id: "formula-power-rule",
    label: "Power rule",
    latex: "d/dx x^n = n x^{n-1}",
  },
];

const questions = [
  {
    id: "question-1",
    title: "Differentiate x^4",
    prompt_markdown: "Find the derivative of x^4.",
    explanation_markdown: "Use the power rule.",
  },
];

describe("MathStudyLoopPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(desmosLoader.hasDesmosApiKey).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("hides the Math Study Loop surface while the beta flag is off", () => {
    renderPanel({ betaEnabled: false });

    expect(screen.queryByText("Math Study Loop")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create problem log" })).toBeNull();
  });

  it("shows Math Problem Log creation and saves structured fields", () => {
    const graphLink = saveStudyGraphLink({
      betaEnabled: true,
      desmosState: { expressions: { list: [] } },
      expressions: [{ latex: "y=(2x^2+1)^4" }],
      graphStateId: "graph-state-chain",
      mode: "2d",
      ownerId: "user-1",
      reflection: "The chain rule composition gets steep quickly.",
      title: "Chain rule graph",
    });
    renderPanel({ graphLinks: [graphLink] });

    expect(screen.getByTestId("math-study-loop-panel").getAttribute("data-beta-revamp-math-study-loop")).toBe("true");
    fireEvent.change(screen.getByLabelText("Problem title"), { target: { value: "Chain rule warmup" } });
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "Jacob Math Notes" } });
    fireEvent.change(screen.getByLabelText("Concept tags"), { target: { value: "chain rule, derivatives" } });
    fireEvent.change(screen.getByLabelText("Graph link"), { target: { value: graphLink.id } });
    fireEvent.click(screen.getByLabelText("Link formula Power rule"));
    fireEvent.change(screen.getByLabelText("Attempt"), { target: { value: "I differentiated the outside but missed the inside." } });
    fireEvent.change(screen.getByLabelText("Final answer"), { target: { value: "8x(2x^2+1)^3" } });
    fireEvent.change(screen.getByLabelText("Mistake type"), { target: { value: "formula_misuse" } });
    fireEvent.change(screen.getByLabelText("Confidence"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Create problem log" }));

    expect(listProblemLogEntries("user-1")[0]).toMatchObject({
      concept_tags: ["chain rule", "derivatives"],
      confidence: 2,
      final_answer: "8x(2x^2+1)^3",
      formula_card_ids: ["formula-power-rule"],
      graph_link_id: graphLink.id,
      mistake_type: "formula_misuse",
      problem_title: "Chain rule warmup",
      source: "Jacob Math Notes",
    });
    expect(screen.getByText("Chain rule warmup")).toBeTruthy();
  });

  it("renders formula and theorem cards with example, common mistake, graph context, and review action", () => {
    const graphLink = saveStudyGraphLink({
      betaEnabled: true,
      desmosState: { expressions: { list: [] } },
      expressions: [{ latex: "y=x^4" }],
      graphStateId: "graph-state-1",
      mode: "2d",
      ownerId: "user-1",
      reflection: "Power functions get steeper away from zero.",
      title: "Power graph",
    });

    renderPanel({ graphLinks: [graphLink], reviewQueueBetaEnabled: true });

    const card = within(screen.getByTestId("math-formula-card-formula-power-rule"));
    expect(card.getByText("Power rule")).toBeTruthy();
    expect(card.getByText(/Plain-English meaning/i)).toBeTruthy();
    expect(card.getByText(/Example problem/i)).toBeTruthy();
    expect(card.getByText(/Common mistake/i)).toBeTruthy();
    expect(card.getByText(/Proof idea/i)).toBeTruthy();
    expect(card.getByText("Power graph")).toBeTruthy();

    fireEvent.click(card.getByRole("button", { name: "Add to Review" }));

    expect(listStudyItems("user-1")[0]).toMatchObject({
      source_kind: "formula",
      source_id: "formula-power-rule",
      type: "formula_card",
    });
  });

  it("restores saved graph states and keeps Desmos compact when the key is missing", () => {
    vi.mocked(desmosLoader.hasDesmosApiKey).mockReturnValue(false);
    const onRestore = vi.fn();

    render(
      <GraphStudyCard
        graphLink={{
          created_at: "2026-05-14T12:00:00.000Z",
          desmos_state: { expressions: { list: [{ latex: "y=x^2" }] } },
          expressions: [{ latex: "y=x^2" }],
          graph_state_id: "graph-state-1",
          id: "graph-link-1",
          mode: "2d",
          note_id: null,
          owner_id: "user-1",
          problem_log_id: "problem-1",
          formula_card_id: null,
          reflection: "This graph shows positive curvature.",
          title: "Quadratic curvature",
          updated_at: "2026-05-14T12:00:00.000Z",
        }}
        onRestoreGraphState={onRestore}
      />,
    );

    expect(screen.getByText("Compact graph preview")).toBeTruthy();
    expect(screen.getByText(/Desmos key is missing/i)).toBeTruthy();
    expect(screen.queryByTestId("heavy-desmos-graph")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Restore graph" }));
    expect(onRestore).toHaveBeenCalledWith({ expressions: { list: [{ latex: "y=x^2" }] } });
  });

  it("does not mount heavy graph tools while a saved graph card is collapsed", () => {
    renderPanel();

    expect(screen.getByText("Current module graph")).toBeTruthy();
    expect(screen.queryByTestId("heavy-desmos-graph")).toBeNull();
  });

  it("shows narrow AI placeholders only when gated and keeps them source-grounded", () => {
    renderPanel({ narrowAiBetaEnabled: false });
    expect(screen.queryByText("Source-grounded AI study helpers")).toBeNull();
    cleanup();

    renderPanel({ narrowAiBetaEnabled: true });
    expect(screen.getByText("Source-grounded AI study helpers")).toBeTruthy();
    expect(screen.getByText("Generate 5 recall questions from selected notes or sources")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/solve my homework|AI tutor for everything|uncited/i);
  });

  it("does not expose demo auth or demo binder controls in the math loop panel", () => {
    renderPanel();

    expect(document.body.textContent).not.toMatch(/try demo|demo auth|demo binder|learner demo|admin demo/i);
    expect(screen.queryByRole("button", { name: /demo/i })).toBeNull();
  });
});

function renderPanel(
  overrides: Partial<ComponentProps<typeof MathStudyLoopPanel>> = {},
) {
  return render(
    <MathStudyLoopPanel
      activeExpressions={[{ latex: "y=x^2" }]}
      activeGraphMode="2d"
      activeGraphState={{ expressions: { list: [{ latex: "y=x^2" }] } }}
      betaEnabled
      courseId="course-calc"
      courseTitle="Calculus"
      formulaCards={formulas}
      graphLinks={[]}
      graphStates={[]}
      moduleId="module-derivative"
      moduleTitle="Derivative as slope"
      narrowAiBetaEnabled={false}
      onRestoreGraphState={vi.fn()}
      ownerId="user-1"
      questions={questions}
      reviewQueueBetaEnabled={false}
      {...overrides}
    />,
  );
}
