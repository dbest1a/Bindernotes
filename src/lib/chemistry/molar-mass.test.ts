import { describe, expect, it } from "vitest";
import { calculateMolarMass } from "@/lib/chemistry/molar-mass";

describe("chemistry molar mass calculator", () => {
  it("computes molar masses from parsed atom inventories", () => {
    expect(calculateMolarMass("H2O")).toMatchObject({ ok: true, gramsPerMole: expect.closeTo(18.015, 3) });
    expect(calculateMolarMass("Ca(OH)2")).toMatchObject({ ok: true, gramsPerMole: expect.closeTo(74.092, 3) });
    expect(calculateMolarMass("Al2(SO4)3")).toMatchObject({ ok: true, gramsPerMole: expect.closeTo(342.131, 3) });
  });

  it("passes parser errors through without guessing", () => {
    expect(calculateMolarMass("Q2")).toMatchObject({ ok: false, code: "UNKNOWN_ELEMENT" });
  });
});
