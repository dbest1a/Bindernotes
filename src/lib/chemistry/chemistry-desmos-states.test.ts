import { describe, expect, it } from "vitest";
import { chemistryDesmosState, type ChemistryGraphKind } from "./chemistry-desmos-states";

const kinds: ChemistryGraphKind[] = ["titration", "kinetics", "concentration"];

describe("chemistryDesmosState", () => {
  it.each(kinds)("%s keeps its viewport, hides helper functions and bounds every slider", (kind) => {
    const state = chemistryDesmosState(kind);
    expect(state.graph.squareAxes).toBe(false);
    expect(state.graph.viewport.xmax).toBeGreaterThan(state.graph.viewport.xmin);
    const list = state.expressions.list;
    expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    for (const item of list) {
      const latex = typeof item.latex === "string" ? item.latex : "";
      // A one-variable function definition would be drawn as a stray curve unless hidden.
      if (/^\\?[a-zA-Z]+\([a-z]\)=/.test(latex)) expect(item.hidden).toBe(true);
      if (item.slider) {
        expect(latex).toMatch(/^[A-Za-z](_\{[A-Za-z0-9]+\})?=-?[\d.]+$/);
        expect(item.slider).toMatchObject({ hardMin: true, hardMax: true });
      }
    }
    expect(list.some((item) => item.slider)).toBe(true);
  });

  it("solves the titration curve from the charge balance", () => {
    const latex = chemistryDesmosState("titration").expressions.list.map((item) => item.latex).join("\n");
    expect(latex).toContain(String.raw`V(h)=V_{a}\frac{C_{a}\nu(h)-\left(h-\frac{10^{-14}}{h}\right)}{C_{b}+h-\frac{10^{-14}}{h}}`);
    expect(latex).toContain(String.raw`x=\frac{C_{a}V_{a}}{C_{b}}`);
  });
});
