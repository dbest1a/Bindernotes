import { describe, expect, it } from "vitest";
import { parseFormula } from "@/lib/chemistry/formula-parser";

describe("chemistry formula parser", () => {
  it.each([
    "H0",
    "(H2O)0",
    "()",
    "Fe^0+",
    "Fe0+",
    "H9007199254740992",
    "(H9007199254740991)2",
    `H${"9".repeat(400)}`,
  ])("rejects empty, zero, or unrepresentable atom counts and charges in %s", (formula) => {
    expect(parseFormula(formula)).toMatchObject({ ok: false, code: "INVALID_TOKEN" });
  });
  it("parses plain formulas and nested groups into atom inventories", () => {
    expect(parseFormula("H2O")).toMatchObject({
      ok: true,
      atoms: { H: 2, O: 1 },
      charge: 0,
    });
    expect(parseFormula("Ca(OH)2")).toMatchObject({
      ok: true,
      atoms: { Ca: 1, O: 2, H: 2 },
      charge: 0,
    });
    expect(parseFormula("Al2(SO4)3")).toMatchObject({
      ok: true,
      atoms: { Al: 2, S: 3, O: 12 },
      charge: 0,
    });
  });

  it("parses common ionic charge notation deterministically", () => {
    expect(parseFormula("NH4+")).toMatchObject({
      ok: true,
      atoms: { N: 1, H: 4 },
      charge: 1,
    });
    expect(parseFormula("SO4^2-")).toMatchObject({
      ok: true,
      atoms: { S: 1, O: 4 },
      charge: -2,
    });
    expect(parseFormula("Fe3+")).toMatchObject({
      ok: true,
      atoms: { Fe: 1 },
      charge: 3,
    });
  });

  it("returns clear deterministic errors for invalid formulas", () => {
    expect(parseFormula("")).toMatchObject({ ok: false, code: "EMPTY_FORMULA" });
    expect(parseFormula("Xx2")).toMatchObject({ ok: false, code: "UNKNOWN_ELEMENT" });
    expect(parseFormula("Ca(OH2")).toMatchObject({ ok: false, code: "UNBALANCED_PARENTHESIS" });
  });
});
