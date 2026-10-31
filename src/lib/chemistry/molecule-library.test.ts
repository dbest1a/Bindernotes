// @vitest-environment node

import { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  defaultMoleculeExample,
  defaultReactionExample,
  findLibraryEntry,
  getLibraryEntry,
  moleculeLibrary,
  resolveMoleculeInput,
  searchLibrary,
} from "./molecule-library";
import { analyzeMoleculeDocument, ELEMENT_SYMBOL_COUNT, renderMoleculeSvg, withAtomNumberNotes } from "./molecule-render";
import { createMolecule } from "./molecule-types";
import type { RDKitModule } from "./rdkit-loader";

// RDKit's emscripten build runs in Node when pointed at the wasm on disk. The browser path (lazy import + ?url) is
// covered by the chunk check; this loads the same binary so every library entry is parsed by the real engine.
let rdkit: RDKitModule;

beforeAll(async () => {
  const distDir = path.resolve(process.cwd(), "node_modules/@rdkit/rdkit/dist");
  const require = createRequire(import.meta.url);
  const factory = require(path.join(distDir, "RDKit_minimal.js")) as (options: Record<string, unknown>) => Promise<RDKitModule>;
  rdkit = await factory({ locateFile: (file: string) => path.join(distDir, file), print: () => undefined, printErr: () => undefined });
}, 60_000);

function labelsOf(component: { stereo: { kind: string; label: string }[] }) {
  return [...component.stereo.filter((item) => item.kind === "atom"), ...component.stereo.filter((item) => item.kind === "bond")].map(
    (item) => item.label,
  );
}

describe("molecule library", () => {
  it("has unique ids and names, and defaults that exist", () => {
    const ids = moleculeLibrary.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(moleculeLibrary.map((entry) => entry.name.toLowerCase())).size).toBe(ids.length);
    expect(getLibraryEntry(defaultMoleculeExample)?.kind).toBe("molecule");
    expect(getLibraryEntry(defaultReactionExample)?.kind).toBe("reaction");
  });

  it("covers the required teaching molecules and both reactions", () => {
    const required = [
      "water", "ammonia", "methane", "carbon dioxide", "ethanol", "acetic acid", "acetone", "benzene", "phenol", "cyclohexene",
      "1,3-butadiene", "maleic anhydride", "ethylene", "cis-2-butene", "trans-2-butene", "2-bromo-2-methylbutane",
      "(2R,3S)-2-bromo-3-methylpentane", "ethyl acetate", "aspirin", "caffeine", "glucose",
    ];
    for (const name of required) expect(findLibraryEntry(name), name).toBeDefined();
    expect(moleculeLibrary.filter((entry) => entry.kind === "reaction").map((entry) => entry.id)).toEqual(["diels-alder", "e2-anti-elimination"]);
  });

  it("has the 118 element symbols the formula code relies on", () => {
    expect(ELEMENT_SYMBOL_COUNT).toBe(118);
  });

  for (const entry of moleculeLibrary) {
    it(`parses ${entry.name} with the expected formula and stereo`, () => {
      const analysis = analyzeMoleculeDocument(rdkit, createMolecule(entry.smiles, entry.name));
      expect(analysis.ok, entry.smiles).toBe(true);
      if (!analysis.ok) return;
      expect(analysis.kind).toBe(entry.kind);
      expect(analysis.components.map((component) => component.formula)).toEqual(entry.expectedFormula);
      expect(analysis.components.map(labelsOf)).toEqual(entry.expectedStereo);
      for (const component of analysis.components) expect(component.mw).toBeGreaterThan(0);
      // Reactions teach conservation of atoms: both library examples must be balanced.
      if (entry.kind === "reaction") expect(analysis.balanced).toBe(true);
    });

    it(`draws ${entry.name} as an SVG`, () => {
      const result = renderMoleculeSvg(rdkit, createMolecule(entry.smiles, entry.name), { width: 320, height: 240 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.svg.startsWith("<svg")).toBe(true);
        expect(result.svg).not.toMatch(/<script|onload|onclick|javascript:/i);
      }
    });
  }

  it("reports the (2R,3S) stereocentres on the right atoms", () => {
    const analysis = analyzeMoleculeDocument(rdkit, createMolecule(findLibraryEntry("(2R,3S)-2-bromo-3-methylpentane")!.smiles));
    if (!analysis.ok) throw new Error("expected a valid molecule");
    expect(analysis.components[0].stereo.map((item) => [item.atoms, item.label])).toEqual([
      [[2], "R"],
      [[4], "S"],
    ]);
  });

  it("keeps the E2 example stereospecific (R,S substrate gives the Z alkene) and cis butene Z / trans butene E", () => {
    const e2 = analyzeMoleculeDocument(rdkit, createMolecule(findLibraryEntry("e2")!.smiles));
    if (!e2.ok) throw new Error("expected a valid reaction");
    expect(e2.components.find((component) => component.role === "product" && component.stereo.length)?.stereo[0].label).toBe("Z");
    const cis = analyzeMoleculeDocument(rdkit, createMolecule("C/C=C\\C"));
    const trans = analyzeMoleculeDocument(rdkit, createMolecule("C/C=C/C"));
    if (!cis.ok || !trans.ok) throw new Error("expected valid molecules");
    expect(labelsOf(cis.components[0])).toEqual(["Z"]);
    expect(labelsOf(trans.components[0])).toEqual(["E"]);
  });

  it("flags the cis-fused Diels–Alder adduct as meso and rejects the trans-fused one as different", () => {
    const cis = analyzeMoleculeDocument(rdkit, createMolecule("O=C1OC(=O)[C@H]2CC=CC[C@@H]12"));
    const trans = analyzeMoleculeDocument(rdkit, createMolecule("O=C1OC(=O)[C@@H]2CC=CC[C@@H]12"));
    if (!cis.ok || !trans.ok) throw new Error("expected valid molecules");
    expect(new Set(labelsOf(cis.components[0])).size).toBe(2);
    expect(new Set(labelsOf(trans.components[0])).size).toBe(1);
  });

  it("flags an unbalanced reaction", () => {
    const analysis = analyzeMoleculeDocument(rdkit, createMolecule("C=C.O>>CCO.O"));
    expect(analysis.ok && analysis.balanced).toBe(false);
  });

  it("gives plain-language errors for unreadable input", () => {
    const bad = analyzeMoleculeDocument(rdkit, createMolecule("C1CC"));
    expect(bad).toMatchObject({ ok: false, reason: "invalid" });
    expect(bad.ok ? "" : bad.message).toMatch(/Couldn't read that SMILES/);
    expect(analyzeMoleculeDocument(rdkit, createMolecule("CC>>"))).toMatchObject({ ok: false, reason: "invalid" });
    expect(analyzeMoleculeDocument(rdkit, createMolecule("   "))).toMatchObject({ ok: false, reason: "empty" });
    expect(renderMoleculeSvg(rdkit, createMolecule("C1CC"), { width: 300, height: 240 })).toMatchObject({ ok: false });
  });

  it("numbers atoms from 1 and highlights by those numbers", () => {
    expect(withAtomNumberNotes("CCO", 3)).toBe("CCO |atomProp:0.atomNote.1:1.atomNote.2:2.atomNote.3|");
    expect(withAtomNumberNotes("CCO |$;;$|", 3)).toBe("CCO |$;;$,atomProp:0.atomNote.1:1.atomNote.2:2.atomNote.3|");
    const plain = renderMoleculeSvg(rdkit, createMolecule("CCO"), { width: 300, height: 240 });
    const numbered = renderMoleculeSvg(rdkit, createMolecule("CCO"), { width: 300, height: 240, showAtomNumbers: true });
    const highlighted = renderMoleculeSvg(rdkit, createMolecule("CCO"), { width: 300, height: 240, highlightAtoms: [3, 99] });
    const withHydrogens = renderMoleculeSvg(rdkit, createMolecule("CCO"), { width: 300, height: 240, showHydrogens: true });
    for (const result of [plain, numbered, highlighted, withHydrogens]) expect(result.ok).toBe(true);
    if (plain.ok && numbered.ok && highlighted.ok && withHydrogens.ok) {
      expect((numbered.svg.match(/class=['"]note['"]/g) ?? []).length).toBe(3);
      expect(plain.svg).not.toMatch(/class=['"]note['"]/);
      expect(highlighted.svg).not.toBe(plain.svg);
      expect(withHydrogens.svg.length).toBeGreaterThan(plain.svg.length);
    }
  });

  it("autocompletes and resolves names, aliases and raw SMILES", () => {
    expect(searchLibrary("eth").map((entry) => entry.id)).toEqual(expect.arrayContaining(["ethanol", "ethylene", "ethyl-acetate"]));
    expect(searchLibrary("diels").map((entry) => entry.id)).toEqual(["diels-alder"]);
    expect(searchLibrary("e2", 6, "reaction").map((entry) => entry.id)).toContain("e2-anti-elimination");
    expect(findLibraryEntry("H2O")?.id).toBe("water");
    expect(findLibraryEntry("  Acetylsalicylic Acid ")?.id).toBe("aspirin");
    expect(findLibraryEntry("D-glucose")?.id).toBe("beta-d-glucose");
    expect(resolveMoleculeInput("ethanol")).toMatchObject({ kind: "molecule", smiles: "CCO", name: "Ethanol" });
    expect(resolveMoleculeInput("CC(C)O")).toEqual({ version: 1, kind: "molecule", smiles: "CC(C)O" });
    expect(resolveMoleculeInput("C=C.Br>>CCBr")).toMatchObject({ kind: "reaction" });
    expect(resolveMoleculeInput("  ")).toBeUndefined();
  });
});
