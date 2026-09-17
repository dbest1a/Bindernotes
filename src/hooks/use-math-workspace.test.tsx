// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMathWorkspace } from "@/hooks/use-math-workspace";

describe("useMathWorkspace graph modes", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("rejects delayed graph callbacks from a retired lesson, including a later return to that lesson", () => {
    const { result, rerender } = renderHook(({ scope }) => useMathWorkspace("user-1", scope), {
      initialProps: { scope: "lesson-A" },
    });
    const retiredCallback = result.current.setCurrentGraphState;
    const oldGraph = { expressions: { list: [{ id: "private-A", latex: "y=17" }] } } as DesmosState;
    rerender({ scope: "lesson-B" });
    expect(result.current.setCurrentGraphState).not.toBe(retiredCallback);
    act(() => retiredCallback(oldGraph));
    expect(result.current.state.currentGraphState).toBeNull();
    expect(window.localStorage.getItem("binder-notes:math-lab:v3:user-1:lesson-B")).not.toContain(
      "private-A",
    );
    rerender({ scope: "lesson-A" });
    act(() => retiredCallback(oldGraph));
    expect(result.current.state.currentGraphState).toBeNull();
    act(() => result.current.setCurrentGraphState(oldGraph));
    expect(result.current.state.currentGraphState).toEqual(oldGraph);
  });

  it.each([
    { user: "user-2", scope: "lesson-1" },
    { user: "user-1", scope: "lesson-2" },
  ])("never writes previous private state into $user/$scope", (nextScope) => {
    const nextKey = `binder-notes:math-lab:v3:${nextScope.user}:${nextScope.scope}`;
    window.localStorage.setItem(nextKey, JSON.stringify({ calculatorExpression: "B existing" }));
    const { result, rerender } = renderHook(({ user, scope }) => useMathWorkspace(user, scope), {
      initialProps: { user: "user-1", scope: "lesson-1" },
    });
    act(() => result.current.setExpression("A private expression"));
    const writes = vi.spyOn(Storage.prototype, "setItem");
    rerender(nextScope);
    expect(result.current.state.calculatorExpression).toBe("B existing");
    const newScopeWrites = writes.mock.calls.filter(([key]) => key === nextKey);
    expect(newScopeWrites.length).toBeGreaterThan(0);
    expect(newScopeWrites.every(([, value]) => !value.includes("A private expression"))).toBe(true);
    expect(window.localStorage.getItem("binder-notes:math-lab:v3:user-1:lesson-1")).toContain(
      "A private expression",
    );
    writes.mockRestore();
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
