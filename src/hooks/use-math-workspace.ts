import { useCallback, useEffect, useMemo, useState } from "react";
import {
  evaluateScientificExpression,
  parseFunctionDefinition,
  type AngleMode,
} from "@/lib/scientific-calculator";

export type CalculatorHistoryItem = {
  id: string;
  expression: string;
  result: string;
  numericResult: number | null;
  kind: "value" | "function";
  createdAt: string;
};

export type SavedGraphState = {
  id: string;
  kind: "snapshot";
  lessonId?: string;
  name: string;
  state: DesmosState;
  createdAt: string;
  updatedAt: string;
};

export type SavedMathFunction = {
  id: string;
  name: string;
  expression: string;
  createdAt: string;
  updatedAt: string;
};

export type MathWorkspaceState = {
  version: 1;
  graphVisible: boolean;
  graphExpanded: boolean;
  angleMode: AngleMode;
  calculatorExpression: string;
  calculatorResult: string | null;
  calculatorError: string | null;
  history: CalculatorHistoryItem[];
  currentGraphState: DesmosState | null;
  savedGraphs: SavedGraphState[];
  savedFunctions: SavedMathFunction[];
};

const MAX_HISTORY = 24;
const MAX_SAVED_GRAPHS = 12;
const MAX_SAVED_FUNCTIONS = 8;

function storageKey(userId?: string, scopeId = "math-lab") {
  return `binder-notes:math-lab:v3:${userId ?? "guest"}:${scopeId}`;
}

function createDefaultState(): MathWorkspaceState {
  return {
    version: 1,
    graphVisible: true,
    graphExpanded: false,
    angleMode: "rad",
    calculatorExpression: "",
    calculatorResult: null,
    calculatorError: null,
    history: [],
    currentGraphState: null,
    savedGraphs: [],
    savedFunctions: [],
  };
}

function loadState(userId?: string, scopeId = "math-lab") {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userId, scopeId));
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw) as Partial<MathWorkspaceState>;
    return {
      ...createDefaultState(),
      ...parsed,
      version: 1 as const,
      history: parsed.history ?? [],
      savedGraphs: (parsed.savedGraphs ?? []).map((graph) => ({
        ...graph,
        kind: "snapshot" as const,
      })),
      savedFunctions: parsed.savedFunctions ?? [],
    };
  } catch {
    return createDefaultState();
  }
}

export function useMathWorkspace(userId?: string, scopeId = "math-lab") {
  const [state, setState] = useState<MathWorkspaceState>(() => loadState(userId, scopeId));

  useEffect(() => {
    setState(loadState(userId, scopeId));
  }, [scopeId, userId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey(userId, scopeId), JSON.stringify(state));
  }, [scopeId, state, userId]);

  const lastAnswer = useMemo(
    () => state.history.find((item) => Number.isFinite(item.numericResult))?.numericResult,
    [state.history],
  );
  const savedFunctionMap = useMemo(
    () =>
      Object.fromEntries(state.savedFunctions.map((item) => [item.name, item.expression])),
    [state.savedFunctions],
  );

  const setExpression = useCallback((expression: string) => {
    setState((current) => ({
      ...current,
      calculatorExpression: expression,
      calculatorError: null,
    }));
  }, []);

  const appendToken = useCallback((token: string) => {
    setState((current) => ({
      ...current,
      calculatorExpression: `${current.calculatorExpression}${token}`,
      calculatorError: null,
    }));
  }, []);

  const clearExpression = useCallback(() => {
    setState((current) => ({
      ...current,
      calculatorExpression: "",
      calculatorResult: null,
      calculatorError: null,
    }));
  }, []);

  const backspace = useCallback(() => {
    setState((current) => ({
      ...current,
      calculatorExpression: current.calculatorExpression.slice(0, -1),
      calculatorError: null,
    }));
  }, []);

  const evaluate = useCallback(() => {
    setState((current) => {
      const expression = current.calculatorExpression.trim();
      if (!expression) {
        return current;
      }
      const definition = parseFunctionDefinition(expression);
      if (definition) {
        const timestamp = new Date().toISOString();
        const nextDefinition: SavedMathFunction = {
          id:
            current.savedFunctions.find((item) => item.name === definition.name)?.id ??
            crypto.randomUUID(),
          name: definition.name,
          expression: definition.expression,
          createdAt:
            current.savedFunctions.find((item) => item.name === definition.name)?.createdAt ??
            timestamp,
          updatedAt: timestamp,
        };
        const entry: CalculatorHistoryItem = {
          id: crypto.randomUUID(),
          expression: `${definition.name}(x)=${definition.expression}`,
          result: `Saved ${definition.name}(x)`,
          numericResult: null,
          kind: "function",
          createdAt: timestamp,
        };

        return {
          ...current,
          calculatorExpression: `${definition.name}(x)=${definition.expression}`,
          calculatorResult: `Saved ${definition.name}(x)`,
          calculatorError: null,
          history: [entry, ...current.history].slice(0, MAX_HISTORY),
          savedFunctions: [
            nextDefinition,
            ...current.savedFunctions.filter((item) => item.name !== definition.name),
          ].slice(0, MAX_SAVED_FUNCTIONS),
        };
      }

      const result = evaluateScientificExpression(expression, {
        angleMode: current.angleMode,
        ans:
          current.history.find((item) => Number.isFinite(item.numericResult))?.numericResult ??
          undefined,
        functions: Object.fromEntries(
          current.savedFunctions.map((item) => [item.name, item.expression]),
        ),
      });

      if (!result.ok) {
        return {
          ...current,
          calculatorError: result.error,
          calculatorResult: null,
        };
      }

      const entry: CalculatorHistoryItem = {
        id: crypto.randomUUID(),
        expression,
        result: result.formatted,
        numericResult: result.value,
        kind: "value",
        createdAt: new Date().toISOString(),
      };

      return {
        ...current,
        calculatorExpression: result.formatted,
        calculatorResult: result.formatted,
        calculatorError: null,
        history: [entry, ...current.history].slice(0, MAX_HISTORY),
      };
    });
  }, []);

  const setAngleMode = useCallback((angleMode: AngleMode) => {
    setState((current) => ({ ...current, angleMode }));
  }, []);

  const reuseHistoryExpression = useCallback((expression: string) => {
    setState((current) => ({
      ...current,
      calculatorExpression: expression,
      calculatorError: null,
    }));
  }, []);

  const deleteHistoryItem = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      history: current.history.filter((item) => item.id !== id),
    }));
  }, []);

  const clearHistory = useCallback(() => {
    setState((current) => ({ ...current, history: [] }));
  }, []);

  const setGraphVisible = useCallback((graphVisible: boolean) => {
    setState((current) => ({ ...current, graphVisible }));
  }, []);

  const setGraphExpanded = useCallback((graphExpanded: boolean) => {
    setState((current) => ({ ...current, graphExpanded }));
  }, []);

  const setCurrentGraphState = useCallback((graphState: DesmosState | null) => {
    setState((current) => ({ ...current, currentGraphState: graphState }));
  }, []);

  const saveGraphSnapshot = useCallback((name: string) => {
    const trimmed = name.trim();
    let saved = false;

    setState((current) => {
      if (!current.currentGraphState) {
        return current;
      }

      saved = true;
      const timestamp = new Date().toISOString();
      const existingByName = trimmed
        ? current.savedGraphs.find((item) => item.name.toLowerCase() === trimmed.toLowerCase())
        : null;
      const snapshot: SavedGraphState = {
        id: existingByName?.id ?? crypto.randomUUID(),
        kind: "snapshot",
        lessonId: scopeId,
        name: trimmed || existingByName?.name || `Graph ${current.savedGraphs.length + 1}`,
        state: current.currentGraphState,
        createdAt: existingByName?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      return {
        ...current,
        savedGraphs: [
          snapshot,
          ...current.savedGraphs.filter((item) => item.id !== snapshot.id),
        ].slice(0, MAX_SAVED_GRAPHS),
      };
    });

    return saved;
  }, []);

  const loadGraphSnapshot = useCallback((snapshotId: string) => {
    setState((current) => {
      const snapshot = current.savedGraphs.find((item) => item.id === snapshotId);
      if (!snapshot) {
        return current;
      }

      return {
        ...current,
        currentGraphState: snapshot.state,
        graphVisible: true,
      };
    });
  }, []);

  const deleteGraphSnapshot = useCallback((snapshotId: string) => {
    setState((current) => ({
      ...current,
      savedGraphs: current.savedGraphs.filter((item) => item.id !== snapshotId),
    }));
  }, []);

  const deleteSavedFunction = useCallback((functionId: string) => {
    setState((current) => ({
      ...current,
      savedFunctions: current.savedFunctions.filter((item) => item.id !== functionId),
    }));
  }, []);

  const reuseSavedFunction = useCallback((functionId: string) => {
    setState((current) => {
      const definition = current.savedFunctions.find((item) => item.id === functionId);
      if (!definition) {
        return current;
      }

      return {
        ...current,
        calculatorExpression: `${definition.name}(x)=${definition.expression}`,
        calculatorError: null,
      };
    });
  }, []);

  const clearCurrentGraph = useCallback(() => {
    setState((current) => ({
      ...current,
      currentGraphState: null,
    }));
  }, []);

  return {
    state,
    lastAnswer,
    setExpression,
    appendToken,
    clearExpression,
    backspace,
    evaluate,
    setAngleMode,
    reuseHistoryExpression,
    deleteHistoryItem,
    clearHistory,
    setGraphVisible,
    setGraphExpanded,
    setCurrentGraphState,
    saveGraphSnapshot,
    loadGraphSnapshot,
    deleteGraphSnapshot,
    deleteSavedFunction,
    clearCurrentGraph,
    reuseSavedFunction,
    savedFunctionMap,
  };
}

export type MathWorkspaceController = ReturnType<typeof useMathWorkspace>;
