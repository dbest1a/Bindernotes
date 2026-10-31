import { createMolecule, type MoleculeDocument, type MoleculeKind } from "./molecule-types";

export type MoleculeLibraryEntry = {
  id: string;
  name: string;
  kind: MoleculeKind;
  /** Molecule SMILES, or reaction SMILES ("A.B>>C") for kind "reaction". */
  smiles: string;
  aliases?: string[];
  /**
   * CIP labels RDKit must report, one list per component (reactants, agents, products; a molecule is one component),
   * atom labels in SMILES atom order followed by double-bond labels. Written from the name, checked by tests.
   */
  expectedStereo: string[][];
  /** Expected Hill formula per component, checked by tests. */
  expectedFormula: string[];
};

export const moleculeLibrary: readonly MoleculeLibraryEntry[] = [
  { id: "water", name: "Water", kind: "molecule", smiles: "O", aliases: ["h2o"], expectedStereo: [[]], expectedFormula: ["H2O"] },
  { id: "ammonia", name: "Ammonia", kind: "molecule", smiles: "N", aliases: ["nh3"], expectedStereo: [[]], expectedFormula: ["H3N"] },
  { id: "methane", name: "Methane", kind: "molecule", smiles: "C", aliases: ["ch4"], expectedStereo: [[]], expectedFormula: ["CH4"] },
  { id: "carbon-dioxide", name: "Carbon dioxide", kind: "molecule", smiles: "O=C=O", aliases: ["co2"], expectedStereo: [[]], expectedFormula: ["CO2"] },
  { id: "ethanol", name: "Ethanol", kind: "molecule", smiles: "CCO", aliases: ["ethyl alcohol", "etoh"], expectedStereo: [[]], expectedFormula: ["C2H6O"] },
  { id: "acetic-acid", name: "Acetic acid", kind: "molecule", smiles: "CC(=O)O", aliases: ["ethanoic acid", "ch3cooh"], expectedStereo: [[]], expectedFormula: ["C2H4O2"] },
  { id: "acetone", name: "Acetone", kind: "molecule", smiles: "CC(=O)C", aliases: ["propanone", "propan-2-one"], expectedStereo: [[]], expectedFormula: ["C3H6O"] },
  { id: "benzene", name: "Benzene", kind: "molecule", smiles: "c1ccccc1", aliases: ["c6h6"], expectedStereo: [[]], expectedFormula: ["C6H6"] },
  { id: "phenol", name: "Phenol", kind: "molecule", smiles: "Oc1ccccc1", aliases: ["hydroxybenzene"], expectedStereo: [[]], expectedFormula: ["C6H6O"] },
  { id: "cyclohexene", name: "Cyclohexene", kind: "molecule", smiles: "C1=CCCCC1", expectedStereo: [[]], expectedFormula: ["C6H10"] },
  { id: "1-3-butadiene", name: "1,3-Butadiene", kind: "molecule", smiles: "C=CC=C", aliases: ["butadiene"], expectedStereo: [[]], expectedFormula: ["C4H6"] },
  { id: "maleic-anhydride", name: "Maleic anhydride", kind: "molecule", smiles: "O=C1C=CC(=O)O1", expectedStereo: [[]], expectedFormula: ["C4H2O3"] },
  { id: "ethylene", name: "Ethylene", kind: "molecule", smiles: "C=C", aliases: ["ethene"], expectedStereo: [[]], expectedFormula: ["C2H4"] },
  { id: "cis-2-butene", name: "cis-2-Butene", kind: "molecule", smiles: "C/C=C\\C", aliases: ["(Z)-2-butene", "z-2-butene"], expectedStereo: [["Z"]], expectedFormula: ["C4H8"] },
  { id: "trans-2-butene", name: "trans-2-Butene", kind: "molecule", smiles: "C/C=C/C", aliases: ["(E)-2-butene", "e-2-butene"], expectedStereo: [["E"]], expectedFormula: ["C4H8"] },
  { id: "2-bromo-2-methylbutane", name: "2-Bromo-2-methylbutane", kind: "molecule", smiles: "CCC(C)(C)Br", aliases: ["tert-amyl bromide"], expectedStereo: [[]], expectedFormula: ["C5H11Br"] },
  {
    id: "2r-3s-2-bromo-3-methylpentane",
    name: "(2R,3S)-2-Bromo-3-methylpentane",
    kind: "molecule",
    smiles: "C[C@@H](Br)[C@@H](C)CC",
    // Atom 2 carries Br and is R; atom 4 (C3 of the chain) is S.
    expectedStereo: [["R", "S"]],
    expectedFormula: ["C6H13Br"],
  },
  { id: "ethyl-acetate", name: "Ethyl acetate", kind: "molecule", smiles: "CC(=O)OCC", aliases: ["ethyl ethanoate"], expectedStereo: [[]], expectedFormula: ["C4H8O2"] },
  { id: "aspirin", name: "Aspirin", kind: "molecule", smiles: "CC(=O)Oc1ccccc1C(=O)O", aliases: ["acetylsalicylic acid"], expectedStereo: [[]], expectedFormula: ["C9H8O4"] },
  { id: "caffeine", name: "Caffeine", kind: "molecule", smiles: "Cn1cnc2c1c(=O)n(C)c(=O)n2C", expectedStereo: [[]], expectedFormula: ["C8H10N4O2"] },
  {
    id: "beta-d-glucose",
    name: "Glucose (β-D-glucopyranose)",
    kind: "molecule",
    smiles: "C([C@@H]1[C@H]([C@@H]([C@H]([C@@H](O1)O)O)O)O)O",
    aliases: ["glucose", "d-glucose", "beta-d-glucose", "dextrose"],
    // Ring carbons C5, C4, C3, C2, C1 of glucose: (2R,3R,4S,5S,6R)-6-(hydroxymethyl)oxane-2,3,4,5-tetrol.
    expectedStereo: [["R", "S", "S", "R", "R"]],
    expectedFormula: ["C6H12O6"],
  },
  { id: "cyclohexane", name: "Cyclohexane", kind: "molecule", smiles: "C1CCCCC1", expectedStereo: [[]], expectedFormula: ["C6H12"] },
  { id: "toluene", name: "Toluene", kind: "molecule", smiles: "Cc1ccccc1", aliases: ["methylbenzene"], expectedStereo: [[]], expectedFormula: ["C7H8"] },
  { id: "s-lactic-acid", name: "(S)-Lactic acid", kind: "molecule", smiles: "C[C@H](O)C(=O)O", aliases: ["l-lactic acid", "lactic acid"], expectedStereo: [["S"]], expectedFormula: ["C3H6O3"] },
  {
    id: "diels-alder",
    name: "Diels–Alder: 1,3-butadiene + maleic anhydride",
    kind: "reaction",
    smiles: "C=CC=C.O=C1C=CC(=O)O1>>O=C1OC(=O)[C@H]2CC=CC[C@@H]12",
    aliases: ["diels alder", "diels-alder reaction", "cycloaddition"],
    // The cis (meso) adduct: the two new stereocentres have opposite labels.
    expectedStereo: [[], [], ["S", "R"]],
    expectedFormula: ["C4H6", "C4H2O3", "C8H8O3"],
  },
  {
    id: "e2-anti-elimination",
    name: "E2: (2R,3S)-2-bromo-3-methylpentane + ethoxide → (Z)-3-methylpent-2-ene",
    kind: "reaction",
    smiles: "C[C@@H](Br)[C@@H](C)CC.CC[O-]>>C/C=C(/C)CC.CCO.[Br-]",
    aliases: ["e2", "e2 elimination", "anti elimination", "dehydrohalogenation"],
    // Anti-periplanar loss of H and Br from the (2R,3S) substrate places CH3 (C2) and ethyl cis: the Z alkene.
    expectedStereo: [["R", "S"], [], ["Z"], [], []],
    expectedFormula: ["C6H13Br", "C2H5O", "C6H12", "C2H6O", "Br"],
  },
];

export const defaultMoleculeExample = "ethanol";
export const defaultReactionExample = "diels-alder";

export function normalizeLibraryKey(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9αβ]+/g, "")
    .replace(/α/g, "alpha")
    .replace(/β/g, "beta");
}

type IndexedEntry = { entry: MoleculeLibraryEntry; keys: string[] };

const indexedEntries: IndexedEntry[] = moleculeLibrary.map((entry) => ({
  entry,
  keys: [entry.name, entry.id, ...(entry.aliases ?? [])].map(normalizeLibraryKey).filter(Boolean),
}));

export function getLibraryEntry(id: string): MoleculeLibraryEntry | undefined {
  return moleculeLibrary.find((entry) => entry.id === id);
}

/** Exact (normalised) name, id or alias match. */
export function findLibraryEntry(query: string): MoleculeLibraryEntry | undefined {
  const key = normalizeLibraryKey(query);
  if (!key) return undefined;
  return indexedEntries.find((item) => item.keys.includes(key))?.entry;
}

/** Autocomplete: entries whose name, id or alias starts with / contains the query, best matches first. */
export function searchLibrary(query: string, limit = 6, kind?: MoleculeKind): MoleculeLibraryEntry[] {
  const key = normalizeLibraryKey(query);
  const pool = indexedEntries.filter((item) => !kind || item.entry.kind === kind);
  if (!key) return pool.slice(0, limit).map((item) => item.entry);
  const starts: MoleculeLibraryEntry[] = [];
  const contains: MoleculeLibraryEntry[] = [];
  for (const item of pool) {
    if (item.keys.some((candidate) => candidate.startsWith(key))) starts.push(item.entry);
    else if (item.keys.some((candidate) => candidate.includes(key))) contains.push(item.entry);
  }
  return [...starts, ...contains].slice(0, limit);
}

export function moleculeFromLibraryEntry(entry: MoleculeLibraryEntry): MoleculeDocument {
  return createMolecule(entry.smiles, entry.name);
}

/** Turns what a student typed (a known name or a SMILES) into a document. Returns undefined for blank input. */
export function resolveMoleculeInput(text: string): MoleculeDocument | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const entry = findLibraryEntry(trimmed);
  if (entry) return moleculeFromLibraryEntry(entry);
  return createMolecule(trimmed);
}
