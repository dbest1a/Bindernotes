// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DesmosGraphModule,
  SavedGraphsModule,
  ScientificCalculatorModule,
  type MathWorkspaceModuleBindings,
} from "@/components/math/math-workspace-modules";
import type { MathWorkspaceController } from "@/hooks/use-math-workspace";

let mockDesmosApiKeyAvailable = true;

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
    hasDesmosApiKey: () => mockDesmosApiKeyAvailable,
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
  afterEach(() => {
    cleanup();
    mockDesmosApiKeyAvailable = true;
  });

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

  it("Revamp Beta gives the calculator a first-class visible input and does not mount Desmos until needed", () => {
    const testBindings = bindings();
    render(<ScientificCalculatorModule bindings={testBindings} mathPerformanceLazyLoading />);

    const input = screen.getByRole("textbox", { name: /calculator expression/i });
    fireEvent.change(input, { target: { value: "17.5*24" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(testBindings.controller.setExpression).toHaveBeenCalledWith("17.5*24");
    expect(testBindings.controller.evaluate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status", { name: /calculator result/i })).toBeTruthy();
    expect(screen.queryByTestId("desmos-scientific-calculator")).toBeNull();
  });
});

describe("DesmosGraphModule", () => {
  afterEach(() => {
    cleanup();
    mockDesmosApiKeyAvailable = true;
  });

  it("Revamp Beta shows an accessible graph expression input before Desmos is opened", () => {
    const testBindings = bindings();
    render(<DesmosGraphModule bindings={testBindings} mathPerformanceLazyLoading />);

    const input = screen.getByRole("textbox", { name: /graph expression/i });
    fireEvent.change(input, { target: { value: "y=x^2" } });
    fireEvent.click(screen.getByRole("button", { name: /plot expression/i }));

    expect(testBindings.pushExpressionToGraph).toHaveBeenCalledWith("y=x^2");
    expect(screen.getByText(/queued expression: y=x\^2/i)).toBeTruthy();
  });

  it("Revamp Beta keeps the missing Desmos key fallback compact and near the graph input", () => {
    mockDesmosApiKeyAvailable = false;

    render(<DesmosGraphModule bindings={bindings()} mathPerformanceLazyLoading />);

    expect(screen.getByRole("textbox", { name: /graph expression/i })).toBeTruthy();
    expect(screen.getAllByText(/desmos is unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("desmos-compact-fallback")).toBeTruthy();
    expect(screen.queryByTestId("desmos-graph")).toBeNull();
  });

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

describe("SavedGraphsModule", () => {
  afterEach(() => cleanup());

  it("Revamp Beta saved graphs empty state gives a concrete next step", () => {
    render(<SavedGraphsModule bindings={bindings()} mathPerformanceLazyLoading />);

    expect(screen.getByText(/try y=x\^2-4/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /graph an expression/i })).toBeTruthy();
  });
});
