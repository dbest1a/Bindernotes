import { describe, expect, it } from "vitest";
import {
  evaluateScientificExpression,
  parseFunctionDefinition,
  prepareExpressionForGraph,
} from "@/lib/scientific-calculator";

describe("scientific calculator", () => {
  it("evaluates arithmetic and exponents", () => {
    const result = evaluateScientificExpression("2 + 3 * 4 ^ 2", {
      angleMode: "rad",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(50);
    }
  });

  it("supports trig functions in degree mode", () => {
    const result = evaluateScientificExpression("sin(30)", {
      angleMode: "deg",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(0.5, 6);
    }
  });

  it("supports inverse trig and roots", () => {
    const inverse = evaluateScientificExpression("asin(1)", {
      angleMode: "deg",
    });
    const root = evaluateScientificExpression("root(3, 27)", {
      angleMode: "rad",
    });

    expect(inverse.ok).toBe(true);
    expect(root.ok).toBe(true);
    if (inverse.ok && root.ok) {
      expect(inverse.value).toBeCloseTo(90, 6);
      expect(root.value).toBeCloseTo(3, 6);
    }
  });

  it("supports saved single-variable functions for evaluation", () => {
    const result = evaluateScientificExpression("f(3)", {
      angleMode: "rad",
      functions: { f: "x^2+1" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(10);
    }
  });

  it("parses calculator function definitions", () => {
    expect(parseFunctionDefinition("f(x)=x^2+1")).toEqual({
      name: "f",
      expression: "x^2+1",
    });
  });

  it("prepares expressions for graphing", () => {
    expect(prepareExpressionForGraph("x^2+1")).toBe("y=x^2+1");
    expect(prepareExpressionForGraph("x=2")).toBe("x=2");
    expect(prepareExpressionForGraph("f(x)=x^2+1")).toBe("y=x^2+1");
  });
});
