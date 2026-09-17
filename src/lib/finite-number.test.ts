import { describe, expect, it } from "vitest";
import { parseFiniteDecimal, requireFiniteDecimal, withinDecimalTolerance } from "@/lib/finite-number";

describe("finite decimal input", () => {
  it.each(["", " \t", "Infinity", "NaN", "0x10", "0b10", "1,234", "1_000", "2 kg", "1e", "1e309", "1e-999", {}, null, undefined, true, NaN, Infinity])(
    "rejects %j without substituting a value", (value) => {
      expect(parseFiniteDecimal(value)).toBeNull();
      expect(() => requireFiniteDecimal(value, "Quantity")).toThrow(/Quantity must be a finite number/);
    },
  );
  it.each([[".5", 0.5], [" -2.5e-3 ", -0.0025], ["1.", 1], ["0e9999", 0], ["0.000e-9999", 0]])(
    "parses %s explicitly", (value, expected) => expect(parseFiniteDecimal(value)).toBe(expected),
  );
  it("handles positive, negative, tiny and large decimal tolerance bounds", () => {
    expect(withinDecimalTolerance(-0.4, -0.3, 0.1)).toBe(true);
    expect(withinDecimalTolerance(2e-300, 1e-300, 1e-300)).toBe(true);
    expect(withinDecimalTolerance(3e-300, 1e-300, 1e-300)).toBe(false);
    expect(withinDecimalTolerance(1e308, -1e308, 1e308)).toBe(false);
    expect(withinDecimalTolerance(0, 0, NaN)).toBe(false);
  });
});
