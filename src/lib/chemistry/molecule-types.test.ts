import { describe, expect, it } from "vitest";
import {
  MAX_CAPTION_LENGTH,
  MAX_HIGHLIGHT_ATOMS,
  MAX_NAME_LENGTH,
  MAX_SMILES_LENGTH,
  createMolecule,
  moleculeDocumentsEqual,
  sanitizeMoleculeDocument,
} from "./molecule-types";

describe("sanitizeMoleculeDocument", () => {
  it("keeps a well-formed document unchanged", () => {
    const document = {
      version: 1,
      kind: "molecule",
      smiles: "CCO",
      name: "Ethanol",
      caption: "Solvent",
      showAtomNumbers: true,
      showHydrogens: false,
      highlightAtoms: [1, 3],
    } as const;
    expect(sanitizeMoleculeDocument(document)).toEqual(document);
  });

  it("drops unknown keys and prototype-style keys", () => {
    const result = sanitizeMoleculeDocument(JSON.parse('{"smiles":"C","evil":1,"__proto__":{"x":1},"constructor":"y"}'));
    expect(result).toEqual({ version: 1, kind: "molecule", smiles: "C" });
    expect(Object.keys(result ?? {})).toEqual(["version", "kind", "smiles"]);
  });

  it("returns undefined for garbage", () => {
    for (const raw of [undefined, null, 0, 1, "CCO", true, [], [{ smiles: "C" }], {}, { smiles: "" }, { smiles: "   " }, { smiles: 5 }, { smiles: ["C"] }, { version: 2, smiles: "C" }]) {
      expect(sanitizeMoleculeDocument(raw), JSON.stringify(raw)).toBeUndefined();
    }
  });

  it("rejects, rather than truncates, SMILES over the limit", () => {
    expect(sanitizeMoleculeDocument({ smiles: "C".repeat(MAX_SMILES_LENGTH) })?.smiles).toHaveLength(MAX_SMILES_LENGTH);
    expect(sanitizeMoleculeDocument({ smiles: "C".repeat(MAX_SMILES_LENGTH + 1) })).toBeUndefined();
    expect(sanitizeMoleculeDocument({ smiles: "C".repeat(5_000_000) })).toBeUndefined();
  });

  it("lets the SMILES decide molecule versus reaction", () => {
    expect(sanitizeMoleculeDocument({ kind: "molecule", smiles: "C=CC=C.C=C>>C1CCC=CC1" })?.kind).toBe("reaction");
    expect(sanitizeMoleculeDocument({ kind: "reaction", smiles: "CCO" })?.kind).toBe("molecule");
    expect(sanitizeMoleculeDocument({ kind: "bogus", smiles: "CCO" })?.kind).toBe("molecule");
  });

  it("cleans text fields and limits their length", () => {
    const result = sanitizeMoleculeDocument({
      smiles: "C\u0000C\nO",
      name: `  ${"n".repeat(MAX_NAME_LENGTH + 20)}  `,
      caption: "c".repeat(MAX_CAPTION_LENGTH + 20),
    });
    expect(result?.smiles).toBe("C C O");
    expect(result?.name).toHaveLength(MAX_NAME_LENGTH);
    expect(result?.caption).toHaveLength(MAX_CAPTION_LENGTH);
    expect(sanitizeMoleculeDocument({ smiles: "C", name: "   ", caption: 4 })).toEqual({ version: 1, kind: "molecule", smiles: "C" });
  });

  it("only accepts booleans for the display flags", () => {
    const result = sanitizeMoleculeDocument({ smiles: "C", showAtomNumbers: "yes", showHydrogens: 1 });
    expect(result).toEqual({ version: 1, kind: "molecule", smiles: "C" });
  });

  it("keeps up to 200 distinct positive integer highlights", () => {
    const many = Array.from({ length: 500 }, (_, index) => index + 1);
    expect(sanitizeMoleculeDocument({ smiles: "C", highlightAtoms: many })?.highlightAtoms).toHaveLength(MAX_HIGHLIGHT_ATOMS);
    expect(sanitizeMoleculeDocument({ smiles: "C", highlightAtoms: [3, 3, 0, -1, 1.5, "2", null, NaN, Infinity, 2, 5000] })?.highlightAtoms).toEqual([3, 2]);
    expect(sanitizeMoleculeDocument({ smiles: "C", highlightAtoms: [0, "x"] })).toEqual({ version: 1, kind: "molecule", smiles: "C" });
    expect(sanitizeMoleculeDocument({ smiles: "C", highlightAtoms: "1,2" })).toEqual({ version: 1, kind: "molecule", smiles: "C" });
  });

  it("is idempotent and does not mutate its input", () => {
    const raw = { smiles: " CCO ", name: "Ethanol", highlightAtoms: [2, 2, 1], extra: true };
    const snapshot = JSON.stringify(raw);
    const once = sanitizeMoleculeDocument(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
    expect(sanitizeMoleculeDocument(once)).toEqual(once);
  });

  it("stays fast on large board payloads", () => {
    const raw = { smiles: "C".repeat(MAX_SMILES_LENGTH), name: "x".repeat(10_000), caption: "y".repeat(10_000), highlightAtoms: Array.from({ length: 100_000 }, (_, index) => index) };
    const started = performance.now();
    for (let index = 0; index < 200; index += 1) sanitizeMoleculeDocument(raw);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("createMolecule", () => {
  it("builds a molecule or reaction document", () => {
    expect(createMolecule("CCO", "Ethanol")).toEqual({ version: 1, kind: "molecule", smiles: "CCO", name: "Ethanol" });
    expect(createMolecule(" C=C.Br>>CCBr ")).toEqual({ version: 1, kind: "reaction", smiles: "C=C.Br>>CCBr" });
    expect(createMolecule("CCO", "   ")).not.toHaveProperty("name");
  });
});

describe("moleculeDocumentsEqual", () => {
  it("compares content, treating absent flags as false", () => {
    expect(moleculeDocumentsEqual(createMolecule("CCO"), createMolecule("CCO"))).toBe(true);
    expect(moleculeDocumentsEqual({ ...createMolecule("CCO"), showHydrogens: false }, createMolecule("CCO"))).toBe(true);
    expect(moleculeDocumentsEqual(createMolecule("CCO"), createMolecule("CCN"))).toBe(false);
    expect(moleculeDocumentsEqual({ ...createMolecule("CCO"), highlightAtoms: [1] }, createMolecule("CCO"))).toBe(false);
    expect(moleculeDocumentsEqual(undefined, createMolecule("CCO"))).toBe(false);
    expect(moleculeDocumentsEqual(undefined, undefined)).toBe(true);
  });
});
