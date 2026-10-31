import { describe, expect, it } from "vitest";
import { computedFormalCharge, drawnValenceElectrons, expectedValenceElectrons, lewisStructures, octetReport } from "./lewis-structures";

describe("lewisStructures", () => {
  it.each(lewisStructures.map((structure) => [structure.label, structure] as const))(
    "%s draws exactly its valence electrons, completes every octet and shows the right formal charges",
    (_label, structure) => {
      expect(drawnValenceElectrons(structure)).toBe(expectedValenceElectrons(structure));
      expect(octetReport(structure).every((entry) => entry.complete)).toBe(true);
      structure.atoms.forEach((atom, index) => expect(computedFormalCharge(structure, index)).toBe(atom.formalCharge ?? 0));
      const totalCharge = structure.atoms.reduce((sum, atom) => sum + (atom.formalCharge ?? 0), 0);
      expect(totalCharge).toBe(structure.charge);
    },
  );

  it("matches the textbook counts", () => {
    const valence = Object.fromEntries(lewisStructures.map((structure) => [structure.id, expectedValenceElectrons(structure)]));
    expect(valence).toEqual({ H2O: 8, CO2: 16, NH3: 8, CH4: 8, "NO3-": 24 });
  });
});
