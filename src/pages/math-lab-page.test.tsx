// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MathLabPage } from "@/pages/math-lab-page";

const mocks = vi.hoisted(() => ({
  setGraphExpanded: vi.fn(),
  setGraphVisible: vi.fn(),
  setGraphMode: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: {
      id: "user-1",
      email: "learner@example.com",
      full_name: "Learner",
      role: "learner",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
  }),
}));

vi.mock("@/hooks/use-math-workspace", () => ({
  useMathWorkspace: () => ({
    state: {
      graphVisible: true,
      graphExpanded: false,
      graphMode: "2d",
      calculatorExpression: "x^2",
      calculatorResult: null,
      calculatorError: null,
      angleMode: "rad",
      history: [],
      savedGraphs: [],
      savedFunctions: [],
      currentGraphState: null,
    },
    setGraphExpanded: mocks.setGraphExpanded,
    setGraphVisible: mocks.setGraphVisible,
    setGraphMode: mocks.setGraphMode,
    savedFunctionMap: {},
    clearCurrentGraph: vi.fn(),
    setCurrentGraphState: vi.fn(),
    setExpression: vi.fn(),
    appendToken: vi.fn(),
    backspace: vi.fn(),
    clearExpression: vi.fn(),
    clearHistory: vi.fn(),
    deleteHistoryItem: vi.fn(),
    evaluate: vi.fn(),
    reuseHistoryExpression: vi.fn(),
    reuseSavedFunction: vi.fn(),
    setAngleMode: vi.fn(),
    deleteSavedFunction: vi.fn(),
    deleteGraphSnapshot: vi.fn(),
    loadGraphSnapshot: vi.fn(),
    saveGraphSnapshot: vi.fn(),
  }),
}));

vi.mock("@/components/math/math-workspace-modules", () => ({
  DesmosGraphModule: ({ title = "Desmos graph" }: { title?: string }) => (
    <section>{title}</section>
  ),
  ScientificCalculatorModule: () => <section>Scientific calculator</section>,
  SavedGraphsModule: () => <section>Saved graphs</section>,
}));

function renderMathLab() {
  return render(
    <MemoryRouter>
      <MathLabPage />
    </MemoryRouter>,
  );
}

describe("MathLabPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the fuller math lab with graph, calculator, and saved graph areas", () => {
    renderMathLab();

    expect(screen.getByText("Live graph area")).toBeTruthy();
    expect(screen.getAllByText("Scientific calculator").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saved graphs").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /hide graph/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /expand graph/i })).toBeTruthy();
  });

  it("links to the dedicated Whiteboard Lab page instead of embedding the board in MathLab", () => {
    renderMathLab();

    const whiteboardLink = screen.getByRole("link", { name: /open whiteboard lab/i });

    expect(whiteboardLink.getAttribute("href")).toBe("/math/lab/whiteboard");
    expect(screen.queryByText("Full-screen whiteboard lab")).toBeNull();
  });
});
