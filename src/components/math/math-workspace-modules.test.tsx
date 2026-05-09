// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DesmosGraphModule,
  ScientificCalculatorModule,
  type MathWorkspaceModuleBindings,
} from "@/components/math/math-workspace-modules";
import type { MathWorkspaceController } from "@/hooks/use-math-workspace";

vi.mock("@/components/math/desmos-graph", () => ({
  Desmos3DGraph: ({ showKeypad }: { showKeypad?: boolean }) => (
    <div data-testid="desmos-3d-graph" data-show-keypad={String(showKeypad)} />
  ),
  DesmosGraph: ({ showKeypad }: { showKeypad?: boolean }) => (
    <div data-testid="desmos-graph" data-show-keypad={String(showKeypad)} />
  ),
}));

vi.mock("@/lib/desmos-loader", async () => {
  const actual = await vi.importActual<typeof import("@/lib/desmos-loader")>("@/lib/desmos-loader");
  return {
    ...actual,
    hasDesmosApiKey: () => true,
  };
});

vi.mock("@/components/math/desmos-scientific-calculator", () => ({
  DesmosScientificCalculator: ({
    fallback,
    height,
  }: {
    fallback?: React.ReactNode;
    height?: string;
  }) => (
    <div data-testid="desmos-scientific-calculator" data-height={height ?? ""}>
      {fallback}
    </div>
  ),
}));

function bindings(): MathWorkspaceModuleBindings {
  return {
    controller: {
      state: {
        angleMode: "rad",
        calculatorError: null,
        calculatorExpression: "",
        calculatorResult: null,
        currentGraphState: null,
        graphExpanded: false,
        graphMode: "2d",
        graphVisible: true,
        history: [],
        savedFunctions: [],
        savedGraphs: [],
      },
      appendToken: vi.fn(),
      backspace: vi.fn(),
      clearCurrentGraph: vi.fn(),
      clearExpression: vi.fn(),
      clearHistory: vi.fn(),
      deleteGraphSnapshot: vi.fn(),
      deleteHistoryItem: vi.fn(),
      deleteSavedFunction: vi.fn(),
      evaluate: vi.fn(),
      lastAnswer: null,
      loadGraphSnapshot: vi.fn(),
      reuseHistoryExpression: vi.fn(),
      reuseSavedFunction: vi.fn(),
      saveGraphSnapshot: vi.fn(),
      savedFunctionMap: {},
      setAngleMode: vi.fn(),
      setCurrentGraphState: vi.fn(),
      setExpression: vi.fn(),
      setGraphExpanded: vi.fn(),
      setGraphMode: vi.fn(),
      setGraphVisible: vi.fn(),
    } as unknown as MathWorkspaceController,
    onExpressionApplied: vi.fn(),
    pendingExpression: null,
    pushExpressionToGraph: vi.fn(),
    setSnapshotName: vi.fn(),
    snapshotName: "",
  };
}

describe("ScientificCalculatorModule", () => {
  afterEach(() => cleanup());

  it("uses the local calculator directly on whiteboards instead of waiting on the Desmos embed", () => {
    render(<ScientificCalculatorModule bindings={bindings()} surface="whiteboard" />);

    expect(screen.queryByTestId("desmos-scientific-calculator")).toBeNull();
    expect(screen.getByPlaceholderText(/try x\^2\+1/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /evaluate/i })).toBeTruthy();
  });

  it("keeps the Desmos scientific surface available in the full workspace", () => {
    render(<ScientificCalculatorModule bindings={bindings()} />);

    expect(screen.getByTestId("desmos-scientific-calculator").getAttribute("data-height")).toBe("clamp(520px, 68vh, 720px)");
  });
});

describe("DesmosGraphModule", () => {
  afterEach(() => cleanup());

  it("keeps Desmos unmounted until the student opens the graph in math performance mode", () => {
    render(<DesmosGraphModule bindings={bindings()} mathPerformanceLazyLoading />);

    expect(screen.queryByTestId("desmos-graph")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Open graph/i }));

    expect(screen.getByTestId("desmos-graph").getAttribute("data-show-keypad")).toBe("false");
  });

  it("keeps the Desmos keypad unmounted until explicitly opened in math performance mode", () => {
    render(<DesmosGraphModule bindings={bindings()} mathPerformanceLazyLoading />);

    fireEvent.click(screen.getByRole("button", { name: /Open graph/i }));
    expect(screen.getByTestId("desmos-graph").getAttribute("data-show-keypad")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: /Show keypad/i }));
    expect(screen.getByTestId("desmos-graph").getAttribute("data-show-keypad")).toBe("true");
  });
});
