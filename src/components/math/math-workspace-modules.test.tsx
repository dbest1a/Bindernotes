// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ScientificCalculatorModule,
  type MathWorkspaceModuleBindings,
} from "@/components/math/math-workspace-modules";
import type { MathWorkspaceController } from "@/hooks/use-math-workspace";

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

  it("fills the whiteboard card instead of using the oversized workspace calculator height", () => {
    render(<ScientificCalculatorModule bindings={bindings()} surface="whiteboard" />);

    expect(screen.getByTestId("desmos-scientific-calculator").getAttribute("data-height")).toBe("100%");
  });
});
