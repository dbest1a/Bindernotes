// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useMathWorkspace } from "@/hooks/use-math-workspace";

describe("useMathWorkspace graph modes", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps independent 2D and 3D graph states while switching modes", () => {
    const { result } = renderHook(() => useMathWorkspace("user-1", "lesson-1"));
    const state2d = { expressions: { list: [{ id: "a", latex: "y=x^2" }] } } as DesmosState;
    const state3d = { expressions: { list: [{ id: "s", latex: "z=x^2+y^2" }] } } as DesmosState;

    act(() => {
      result.current.setCurrentGraphState(state2d);
    });
    expect(result.current.state.graphMode).toBe("2d");
    expect(result.current.state.currentGraphState).toBe(state2d);

    act(() => {
      result.current.setGraphMode("3d");
      result.current.setCurrentGraphState(state3d);
    });
    expect(result.current.state.graphMode).toBe("3d");
    expect(result.current.state.currentGraphState).toBe(state3d);

    act(() => {
      result.current.setGraphMode("2d");
    });
    expect(result.current.state.currentGraphState).toBe(state2d);
  });

  it("saves and reloads graph snapshots with their calculator mode", () => {
    const { result } = renderHook(() => useMathWorkspace("user-1", "lesson-2"));
    const state3d = { expressions: { list: [{ id: "s", latex: "z=x^2+y^2" }] } } as DesmosState;

    act(() => {
      result.current.setGraphMode("3d");
      result.current.setCurrentGraphState(state3d);
    });
    act(() => {
      expect(result.current.saveGraphSnapshot("Surface lab")).toBe(true);
    });

    const saved = result.current.state.savedGraphs[0];
    expect(saved.calculatorMode).toBe("3d");

    act(() => {
      result.current.setGraphMode("2d");
      result.current.loadGraphSnapshot(saved.id);
    });

    expect(result.current.state.graphMode).toBe("3d");
    expect(result.current.state.currentGraphState).toBe(state3d);
  });
});
