import { describe, expect, it } from "vitest";
import { balanceEquation } from "@/lib/chemistry/equation-balancer";
import { checkEquationConservation } from "@/lib/chemistry/conservation";

describe("chemistry equation balancer", () => {
  it("balances common reactions with integer coefficients", () => {
    expect(balanceEquation("H2 + O2 -> H2O")).toMatchObject({
      ok: true,
      coefficients: [2, 1, 2],
      balancedEquation: "2 H2 + O2 -> 2 H2O",
    });
    expect(balanceEquation("Fe + O2 -> Fe2O3")).toMatchObject({
      ok: true,
      coefficients: [4, 3, 2],
      balancedEquation: "4 Fe + 3 O2 -> 2 Fe2O3",
    });
    expect(balanceEquation("C3H8 + O2 -> CO2 + H2O")).toMatchObject({
      ok: true,
      coefficients: [1, 5, 3, 4],
      balancedEquation: "C3H8 + 5 O2 -> 3 CO2 + 4 H2O",
    });
  });

  it("reports balanced equations as atom and charge conserved", () => {
    const balanced = balanceEquation("Al + HCl -> AlCl3 + H2");
    expect(balanced).toMatchObject({ ok: true, coefficients: [2, 6, 2, 3] });

    if (balanced.ok) {
      expect(checkEquationConservation(balanced)).toMatchObject({
        ok: true,
        atomsConserved: true,
        chargeConserved: true,
      });
    }
  });
});
