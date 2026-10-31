// Lewis structures for the guided builder: atoms, bonds (order 1–3), lone pairs and formal charges,
// laid out in a 200 × 120 drawing. Electron counts and octet checks are computed from the drawing
// itself, so what a student sees and what the card reports can never disagree.

export type LewisAtom = {
  symbol: string;
  x: number;
  y: number;
  /** Directions (degrees, 0 = right, 90 = down) of this atom's lone pairs. */
  lonePairs: number[];
  formalCharge?: number;
  /** Direction (degrees) of the formal-charge label, in a gap between bonds and lone pairs. Default 318 (upper right). */
  chargeAngle?: number;
};

export type LewisBond = { from: number; to: number; order: 1 | 2 | 3 };

export type LewisStructure = {
  id: string;
  /** Formula as students write it, with Unicode subscripts and charge. */
  label: string;
  charge: number;
  geometry: string;
  note: string;
  central: number;
  atoms: LewisAtom[];
  bonds: LewisBond[];
};

const VALENCE: Record<string, number> = { H: 1, C: 4, N: 5, O: 6 };

export const lewisStructures: LewisStructure[] = [
  {
    id: "H2O",
    label: "H₂O",
    charge: 0,
    geometry: "bent",
    note: "Two O–H bonds and two lone pairs on oxygen bend the molecule (about 104.5°).",
    central: 0,
    atoms: [
      { symbol: "O", x: 100, y: 52, lonePairs: [235, 305] },
      { symbol: "H", x: 58, y: 88, lonePairs: [] },
      { symbol: "H", x: 142, y: 88, lonePairs: [] },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
    ],
  },
  {
    id: "CO2",
    label: "CO₂",
    charge: 0,
    geometry: "linear",
    note: "Two C=O double bonds give carbon an octet and no lone pairs, so the molecule is linear.",
    central: 1,
    atoms: [
      { symbol: "O", x: 44, y: 60, lonePairs: [135, 225] },
      { symbol: "C", x: 100, y: 60, lonePairs: [] },
      { symbol: "O", x: 156, y: 60, lonePairs: [45, 315] },
    ],
    bonds: [
      { from: 0, to: 1, order: 2 },
      { from: 1, to: 2, order: 2 },
    ],
  },
  {
    id: "NH3",
    label: "NH₃",
    charge: 0,
    geometry: "trigonal pyramidal",
    note: "Three N–H bonds and one lone pair on nitrogen push the hydrogens into a pyramid.",
    central: 0,
    atoms: [
      { symbol: "N", x: 100, y: 52, lonePairs: [270] },
      { symbol: "H", x: 56, y: 82, lonePairs: [] },
      { symbol: "H", x: 100, y: 98, lonePairs: [] },
      { symbol: "H", x: 144, y: 82, lonePairs: [] },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
    ],
  },
  {
    id: "CH4",
    label: "CH₄",
    charge: 0,
    geometry: "tetrahedral",
    note: "Four C–H bonds and no lone pairs spread out as a tetrahedron (109.5°).",
    central: 0,
    atoms: [
      { symbol: "C", x: 100, y: 60, lonePairs: [] },
      { symbol: "H", x: 100, y: 20, lonePairs: [] },
      { symbol: "H", x: 56, y: 60, lonePairs: [] },
      { symbol: "H", x: 144, y: 60, lonePairs: [] },
      { symbol: "H", x: 100, y: 100, lonePairs: [] },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 },
    ],
  },
  {
    id: "NO3-",
    label: "NO₃⁻",
    charge: -1,
    geometry: "trigonal planar",
    note: "One of three equivalent resonance structures: the double bond, and the negative charges, are shared by all three oxygens.",
    central: 0,
    atoms: [
      { symbol: "N", x: 100, y: 64, lonePairs: [], formalCharge: 1 },
      { symbol: "O", x: 100, y: 22, lonePairs: [210, 330] },
      { symbol: "O", x: 62, y: 88, lonePairs: [58, 148, 238], formalCharge: -1, chargeAngle: 283 },
      { symbol: "O", x: 138, y: 88, lonePairs: [32, 122, 302], formalCharge: -1, chargeAngle: 257 },
    ],
    bonds: [
      { from: 0, to: 1, order: 2 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
    ],
  },
];

/** Electrons shown in the drawing: two per bond order, two per lone pair. */
export function drawnValenceElectrons(structure: LewisStructure): number {
  const bonding = structure.bonds.reduce((sum, bond) => sum + 2 * bond.order, 0);
  const lone = structure.atoms.reduce((sum, atom) => sum + 2 * atom.lonePairs.length, 0);
  return bonding + lone;
}

/** Valence electrons the formula requires: group electrons minus the overall charge. */
export function expectedValenceElectrons(structure: LewisStructure): number {
  return structure.atoms.reduce((sum, atom) => sum + (VALENCE[atom.symbol] ?? 0), 0) - structure.charge;
}

/** Electrons around each atom (bonds count fully toward both ends); H needs 2, the rest 8. */
export function octetReport(structure: LewisStructure): Array<{ atom: number; electrons: number; complete: boolean }> {
  return structure.atoms.map((atom, index) => {
    const bonded = structure.bonds.filter((bond) => bond.from === index || bond.to === index).reduce((sum, bond) => sum + 2 * bond.order, 0);
    const electrons = bonded + 2 * atom.lonePairs.length;
    return { atom: index, electrons, complete: electrons === (atom.symbol === "H" ? 2 : 8) };
  });
}

/** Formal charge = valence − lone-pair electrons − bonds. */
export function computedFormalCharge(structure: LewisStructure, index: number): number {
  const atom = structure.atoms[index];
  const bonds = structure.bonds.filter((bond) => bond.from === index || bond.to === index).reduce((sum, bond) => sum + bond.order, 0);
  return (VALENCE[atom.symbol] ?? 0) - 2 * atom.lonePairs.length - bonds;
}
