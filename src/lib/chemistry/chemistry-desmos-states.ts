// Live Desmos graphs for the chemistry graph modules. Each state is a plain Desmos graph state:
// sliders for the quantities a student should vary, hidden helper functions (a visible one-variable
// definition would be plotted as a stray curve), and fixed axes (squareAxes off keeps the viewport).

export type ChemistryGraphKind = "titration" | "kinetics" | "concentration";

type Expression = Record<string, unknown> & { id: string; type: "expression" | "text" };

// In a saved Desmos state a slider's range lives under "slider" (setExpression calls it sliderBounds).
const slider = (id: string, latex: string, min: string, max: string, step: string): Expression => ({
  type: "expression",
  id,
  latex,
  slider: { hardMin: true, hardMax: true, min, max, step },
});

function graphState(
  viewport: { xmin: number; xmax: number; ymin: number; ymax: number },
  axes: { x: string; y: string },
  list: Expression[],
) {
  return {
    version: 11,
    graph: { viewport, squareAxes: false, xAxisLabel: axes.x, yAxisLabel: axes.y },
    expressions: { list },
  };
}

/**
 * 25.00 mL of a monoprotic acid titrated with NaOH, from the exact charge balance
 * [Na⁺] + [H⁺] = [OH⁻] + [A⁻], solved for the base volume at each pH. A low pKa behaves like a
 * strong acid.
 */
function titrationState() {
  return graphState({ xmin: -2, xmax: 52, ymin: -0.5, ymax: 14.5 }, { x: "NaOH added (mL)", y: "pH" }, [
    { type: "text", id: "about", text: "25.00 mL of acid titrated with NaOH, solved exactly. Drag the sliders; a pKa below about 1 behaves like a strong acid." },
    slider("acid", "C_{a}=0.1", "0.01", "0.5", "0.01"),
    slider("base", "C_{b}=0.1", "0.01", "0.5", "0.01"),
    slider("pka", "p_{K}=4.76", "-2", "12", "0.01"),
    { type: "expression", id: "volume", latex: "V_{a}=25" },
    { type: "expression", id: "fraction", hidden: true, latex: String.raw`\nu(h)=\frac{10^{-p_{K}}}{h+10^{-p_{K}}}` },
    {
      type: "expression",
      id: "base-volume",
      hidden: true,
      latex: String.raw`V(h)=V_{a}\frac{C_{a}\nu(h)-\left(h-\frac{10^{-14}}{h}\right)}{C_{b}+h-\frac{10^{-14}}{h}}`,
    },
    {
      type: "expression",
      id: "curve",
      latex: String.raw`\left(V\left(10^{-t}\right),t\right)\left\{0\le V\left(10^{-t}\right)\le50\right\}`,
      color: "#2d70b3",
      lineWidth: "3",
      parametricDomain: { min: "0", max: "14" },
    },
    { type: "expression", id: "equivalence", latex: String.raw`x=\frac{C_{a}V_{a}}{C_{b}}`, color: "#6b7280", lineStyle: "DASHED" },
    {
      type: "expression",
      id: "half-equivalence",
      latex: String.raw`\left(\frac{C_{a}V_{a}}{2C_{b}},\left\{p_{K}>1.5:p_{K}\right\}\right)`,
      color: "#c74440",
      showLabel: true,
      label: "half-equivalence: pH ≈ pKa",
      labelOrientation: "right",
    },
  ]);
}

/** One reactant, the same [A]₀ and k for zero, first and second order; linearized forms are in the list. */
function kineticsState() {
  return graphState({ xmin: -5, xmax: 150, ymin: -0.05, ymax: 1.15 }, { x: "time (s)", y: "[A] (M)" }, [
    { type: "text", id: "about", text: "Same [A]₀ and k for each order (k's units differ by order). Turn on the linearized lines below to compare." },
    slider("a0", "A_{0}=1", "0.1", "1", "0.05"),
    slider("k", "k=0.02", "0.001", "0.1", "0.001"),
    { type: "expression", id: "zero", latex: String.raw`y=\max\left(A_{0}-kx,0\right)\left\{x\ge0\right\}`, color: "#388c46", lineStyle: "DOTTED", lineWidth: "3" },
    { type: "expression", id: "first", latex: String.raw`y=A_{0}e^{-kx}\left\{x\ge0\right\}`, color: "#2d70b3", lineWidth: "3" },
    { type: "expression", id: "second", latex: String.raw`y=\frac{A_{0}}{1+kA_{0}x}\left\{x\ge0\right\}`, color: "#c74440", lineStyle: "DASHED", lineWidth: "3" },
    { type: "expression", id: "zero-label", latex: String.raw`\left(\frac{A_{0}}{2k},\frac{A_{0}}{2}\right)`, color: "#388c46", showLabel: true, label: "zero order", labelOrientation: "left" },
    { type: "expression", id: "half-life", latex: String.raw`\left(\frac{\ln2}{k},\frac{A_{0}}{2}\right)`, color: "#2d70b3", showLabel: true, label: "first order: t½ = ln 2 / k", labelOrientation: "above" },
    { type: "expression", id: "second-label", latex: String.raw`\left(\frac{1}{kA_{0}},\frac{A_{0}}{2}\right)`, color: "#c74440", showLabel: true, label: "second order", labelOrientation: "right" },
    { type: "expression", id: "linear-first", hidden: true, latex: String.raw`y=\ln A_{0}-kx\left\{x\ge0\right\}`, color: "#2d70b3" },
    { type: "expression", id: "linear-second", hidden: true, latex: String.raw`y=\frac{1}{A_{0}}+kx\left\{x\ge0\right\}`, color: "#c74440" },
  ]);
}

/** Dilution keeps the moles fixed: C₁V₁ = C₂V₂. Dragging the point changes the final volume. */
function concentrationState() {
  return graphState({ xmin: -10, xmax: 260, ymin: -0.05, ymax: 1.15 }, { x: "final volume V₂ (mL)", y: "concentration C₂ (M)" }, [
    { type: "text", id: "about", text: "Dilution keeps the moles fixed: C₁V₁ = C₂V₂. Drag the point or the sliders." },
    slider("c1", "C_{1}=1", "0.1", "1", "0.05"),
    slider("v1", "V_{1}=25", "5", "100", "1"),
    slider("v2", "V_{2}=100", "5", "250", "1"),
    { type: "expression", id: "curve", latex: String.raw`y=\frac{C_{1}V_{1}}{x}\left\{x\ge V_{1}\right\}`, color: "#2d70b3", lineWidth: "3" },
    { type: "expression", id: "start", latex: String.raw`\left(V_{1},C_{1}\right)`, color: "#6b7280", showLabel: true, label: "stock", labelOrientation: "right" },
    {
      type: "expression",
      id: "diluted",
      latex: String.raw`\left(V_{2},\frac{C_{1}V_{1}}{V_{2}}\right)`,
      color: "#c74440",
      showLabel: true,
      label: "C₂ = C₁V₁ / V₂",
      labelOrientation: "above",
    },
  ]);
}

export function chemistryDesmosState(kind: ChemistryGraphKind) {
  return kind === "kinetics" ? kineticsState() : kind === "concentration" ? concentrationState() : titrationState();
}
