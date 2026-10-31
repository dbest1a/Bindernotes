import { describe, expect, it } from "vitest";
import { splitDisplayMath } from "./solution-math";

const texts = (latex: string) => splitDisplayMath(latex).map((piece) => piece.latex);

describe("splitDisplayMath", () => {
  it("breaks after top-level relations, semicolons, commas and quads, like TeX", () => {
    expect(splitDisplayMath(String.raw`E^\circ = 0.2231\ \mathrm{V};\quad \Delta G = -475`)).toEqual([
      { latex: "E^\\circ =", gap: "relation" },
      { latex: "0.2231\\ \\mathrm{V};", gap: "wide" },
      { latex: "\\Delta G =", gap: "relation" },
      { latex: "-475", gap: "wide" },
    ]);
    expect(texts(String.raw`x = 2 \quad\text{or}\quad x = 3`)).toEqual(["x =", "2", String.raw`\text{or}`, "x =", "3"]);
    expect(splitDisplayMath(String.raw`\mathrm{pH}\ 2.26,\ 3.41`)).toEqual([
      { latex: String.raw`\mathrm{pH}\ 2.26,`, gap: "narrow" },
      { latex: "3.41", gap: "wide" },
    ]);
    expect(texts(String.raw`a \approx 1.5 \Rightarrow b \le 2`)).toEqual([String.raw`a \approx`, String.raw`1.5 \Rightarrow`, String.raw`b \le`, "2"]);
  });

  it("keeps compound relations whole", () => {
    expect(texts("a := b")).toEqual(["a :=", "b"]);
    expect(texts("x <= 1")).toEqual(["x <=", "1"]);
  });

  it("never splits inside braces, brackets, delimiters or environments", () => {
    const grouped = String.raw`\left(a = b; c \quad d\right) + \text{p; q = r} + \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`;
    expect(texts(grouped)).toEqual([grouped]);
    expect(texts(String.raw`f\{x;y\} + g(x, y) + [0, 1) + a_{i,j} + \mathrm{CH{=}CH}`)).toEqual([
      String.raw`f\{x;y\} + g(x, y) + [0, 1) + a_{i,j} + \mathrm{CH{=}CH}`,
    ]);
    expect(texts(String.raw`\lim_{x \to 0} \frac{\sin x}{x}`)).toEqual([String.raw`\lim_{x \to 0} \frac{\sin x}{x}`]);
  });

  it("keeps a single expression and thin spaces whole", () => {
    expect(texts(String.raw`\int_0^1 x^2\,dx`)).toEqual([String.raw`\int_0^1 x^2\,dx`]);
    expect(texts("  ")).toEqual(["  "]);
  });
});
