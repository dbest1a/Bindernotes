import { withMol, type RDKitMol, type RDKitModule } from "./rdkit-loader";
import { isReactionSmiles, type MoleculeDocument } from "./molecule-types";

// Atomic number 1..118.
const ELEMENT_SYMBOLS =
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(
    " ",
  );

export const ELEMENT_SYMBOL_COUNT = ELEMENT_SYMBOLS.length;

export function elementSymbol(atomicNumber: number): string {
  return ELEMENT_SYMBOLS[atomicNumber - 1] ?? "*";
}

export type ElementCounts = Record<string, number>;

export function hillFormula(counts: ElementCounts): string {
  const symbols = Object.keys(counts).filter((symbol) => counts[symbol] > 0);
  const hasCarbon = symbols.includes("C");
  symbols.sort((a, b) => {
    if (hasCarbon) {
      if (a === "C") return -1;
      if (b === "C") return 1;
      if (a === "H") return -1;
      if (b === "H") return 1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return symbols.map((symbol) => (counts[symbol] === 1 ? symbol : `${symbol}${counts[symbol]}`)).join("");
}

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** "C2H6O" -> "C₂H₆O" */
export function formatFormulaUnicode(formula: string) {
  return formula.replace(/\d/g, (digit) => SUBSCRIPTS[Number(digit)]);
}

/** 2 -> "²⁺", -1 -> "⁻", 0 -> "" */
export function formatChargeUnicode(charge: number) {
  if (!charge) return "";
  const magnitude = Math.abs(charge);
  const digits = magnitude === 1 ? "" : String(magnitude).replace(/\d/g, (digit) => SUPERSCRIPTS[Number(digit)]);
  return `${digits}${charge > 0 ? "⁺" : "⁻"}`;
}

export type StereoLabel = {
  kind: "atom" | "bond";
  /** 1-based atom numbers: one for a stereocentre, two for a double bond. */
  atoms: number[];
  label: string;
};

export type ComponentRole = "molecule" | "reactant" | "agent" | "product";

export type ComponentInfo = {
  role: ComponentRole;
  smiles: string;
  counts: ElementCounts;
  charge: number;
  /** Hill formula without charge, e.g. "C2H6O". */
  formula: string;
  /** Unicode display formula with charge, e.g. "C₂H₅O⁻". */
  formulaDisplay: string;
  /** Average molecular weight, g/mol. */
  mw: number;
  exactMass: number;
  heavyAtoms: number;
  stereo: StereoLabel[];
};

export type MoleculeAnalysis =
  | {
      ok: true;
      kind: "molecule" | "reaction";
      components: ComponentInfo[];
      /** Reaction only: whether reactants and products contain the same atoms and net charge. */
      balanced: boolean | null;
    }
  | { ok: false; reason: "empty" | "invalid"; message: string };

export const SMILES_ERROR_MESSAGE = "Couldn't read that SMILES — check ring numbers and brackets.";
export const REACTION_ERROR_MESSAGE =
  "Couldn't read that reaction — write reactants>>products (for example C=CC=C.C=C>>C1CCC=CC1).";

type RDKitJsonAtom = { z?: number; impHs?: number; chg?: number };

function describeMol(rdkit: RDKitModule, smiles: string, role: ComponentRole): ComponentInfo | null {
  return withMol(rdkit, smiles, (mol) => {
    const json = JSON.parse(mol.get_json()) as {
      defaults?: { atom?: RDKitJsonAtom };
      molecules?: { atoms?: RDKitJsonAtom[] }[];
    };
    const defaults = json.defaults?.atom ?? {};
    const counts: ElementCounts = {};
    let charge = 0;
    for (const molecule of json.molecules ?? []) {
      for (const atom of molecule.atoms ?? []) {
        const symbol = elementSymbol(atom.z ?? defaults.z ?? 6);
        counts[symbol] = (counts[symbol] ?? 0) + 1;
        const hydrogens = atom.impHs ?? defaults.impHs ?? 0;
        if (hydrogens) counts.H = (counts.H ?? 0) + hydrogens;
        charge += atom.chg ?? defaults.chg ?? 0;
      }
    }

    const descriptors = JSON.parse(mol.get_descriptors()) as { amw?: number; exactmw?: number };
    const tags = JSON.parse(mol.get_stereo_tags()) as {
      CIP_atoms?: [number, string][];
      CIP_bonds?: [number, number, string][];
    };
    const stereo: StereoLabel[] = [
      ...(tags.CIP_atoms ?? []).map(([atom, label]): StereoLabel => ({ kind: "atom", atoms: [atom + 1], label: label.replace(/[()]/g, "") })),
      ...(tags.CIP_bonds ?? []).map(
        ([from, to, label]): StereoLabel => ({ kind: "bond", atoms: [from + 1, to + 1], label: label.replace(/[()]/g, "") }),
      ),
    ];

    const formula = hillFormula(counts);
    return {
      role,
      smiles,
      counts,
      charge,
      formula,
      formulaDisplay: `${formatFormulaUnicode(formula)}${formatChargeUnicode(charge)}`,
      mw: descriptors.amw ?? 0,
      exactMass: descriptors.exactmw ?? 0,
      heavyAtoms: mol.get_num_atoms(true),
      stereo,
    };
  });
}

/** Removes a trailing CXSMILES extension (" |...|") from a reaction SMILES. */
function stripExtension(smiles: string) {
  const space = smiles.search(/\s/);
  return space === -1 ? smiles : smiles.slice(0, space);
}

export function splitReactionSmiles(smiles: string): { reactants: string[]; agents: string[]; products: string[] } | null {
  const parts = stripExtension(smiles).split(">");
  if (parts.length !== 3) return null;
  const toComponents = (part: string) => part.split(".").filter((component) => component.length > 0);
  const [reactants, agents, products] = parts.map(toComponents);
  if (!reactants.length || !products.length) return null;
  return { reactants, agents, products };
}

export function analyzeMoleculeDocument(rdkit: RDKitModule, doc: MoleculeDocument): MoleculeAnalysis {
  const smiles = doc.smiles.trim();
  if (!smiles) return { ok: false, reason: "empty", message: "Type a molecule name or paste a SMILES to draw it." };

  if (doc.kind !== "reaction" && !isReactionSmiles(smiles)) {
    const component = describeMol(rdkit, smiles, "molecule");
    if (!component) return { ok: false, reason: "invalid", message: SMILES_ERROR_MESSAGE };
    return { ok: true, kind: "molecule", components: [component], balanced: null };
  }

  const parts = splitReactionSmiles(smiles);
  if (!parts) return { ok: false, reason: "invalid", message: REACTION_ERROR_MESSAGE };
  const components: ComponentInfo[] = [];
  const roles: [string[], ComponentRole][] = [
    [parts.reactants, "reactant"],
    [parts.agents, "agent"],
    [parts.products, "product"],
  ];
  for (const [list, role] of roles) {
    for (const component of list) {
      const info = describeMol(rdkit, component, role);
      if (!info) return { ok: false, reason: "invalid", message: SMILES_ERROR_MESSAGE };
      components.push(info);
    }
  }
  return { ok: true, kind: "reaction", components, balanced: reactionIsBalanced(components) };
}

function sumSide(components: ComponentInfo[]) {
  const counts: ElementCounts = {};
  let charge = 0;
  for (const component of components) {
    for (const [symbol, count] of Object.entries(component.counts)) counts[symbol] = (counts[symbol] ?? 0) + count;
    charge += component.charge;
  }
  return { counts, charge };
}

function reactionIsBalanced(components: ComponentInfo[]) {
  const left = sumSide(components.filter((component) => component.role === "reactant"));
  const right = sumSide(components.filter((component) => component.role === "product"));
  if (left.charge !== right.charge) return false;
  const symbols = new Set([...Object.keys(left.counts), ...Object.keys(right.counts)]);
  for (const symbol of symbols) if ((left.counts[symbol] ?? 0) !== (right.counts[symbol] ?? 0)) return false;
  return true;
}

export function describeForScreenReader(doc: MoleculeDocument, analysis: MoleculeAnalysis | null) {
  const label = doc.name?.trim();
  if (!analysis || !analysis.ok) return label ? `Structure of ${label}` : "Chemical structure";
  if (analysis.kind === "reaction") {
    const left = analysis.components.filter((component) => component.role === "reactant").map((component) => component.formulaDisplay);
    const right = analysis.components.filter((component) => component.role === "product").map((component) => component.formulaDisplay);
    return `${label ? `${label}: ` : "Reaction scheme: "}${left.join(" + ")} gives ${right.join(" + ")}`;
  }
  const formula = analysis.components[0]?.formulaDisplay;
  if (label && formula) return `Structure of ${label}, ${formula}`;
  return formula ? `Structure of ${formula}` : "Chemical structure";
}

// ---------------------------------------------------------------------------------------------------------------------
// Drawing
//
// Every component (a single molecule, or each species of a reaction) is drawn by RDKit at one shared bond length, so
// small species stay small next to large ones. We measure each molecule's 2D layout first, pick one scale that fits
// the card, then draw each component into a canvas of exactly its own size.

const INK = [0.12, 0.14, 0.2];
const INK_CSS = "#1f2433";
const ATOM_PALETTE: Record<number, number[]> = {
  1: [0.3, 0.34, 0.42],
  5: [0.75, 0.22, 0.48],
  6: INK,
  7: [0.14, 0.27, 0.84],
  8: [0.84, 0.17, 0.17],
  9: [0.1, 0.55, 0.28],
  14: [0.5, 0.4, 0.2],
  15: [0.85, 0.42, 0.05],
  16: [0.66, 0.46, 0.02],
  17: [0.1, 0.55, 0.28],
  35: [0.6, 0.27, 0.12],
  53: [0.47, 0.2, 0.68],
};

/** Reference bond length (px) used while measuring; the final bond length is this times the layout scale. */
const REFERENCE_BOND = 40;
const MAX_SCALE = 1.6;
const MIN_COMPONENT_EDGE = 1;
const PLUS_GAP = 40;
const ARROW_MIN = 96;
const AGENT_SCALE = 0.75;

export type DrawOptions = {
  width: number;
  height: number;
  showAtomNumbers?: boolean;
  showHydrogens?: boolean;
  /** 1-based atom numbers; molecules only. */
  highlightAtoms?: number[];
};

export function drawOptionsKey(doc: MoleculeDocument, size: { width: number; height: number }) {
  const reaction = doc.kind === "reaction" || isReactionSmiles(doc.smiles);
  const hydrogens = doc.showHydrogens ? "h" : "-";
  const flags = reaction ? `r${hydrogens}` : `${doc.showAtomNumbers ? "n" : "-"}${hydrogens}:${(doc.highlightAtoms ?? []).join(",")}`;
  return `${reaction ? "rxn" : "mol"}|${doc.smiles}|${flags}|${size.width}x${size.height}`;
}

function baseDetails(bondPx: number) {
  return {
    padding: 0.02,
    fixedBondLength: bondPx,
    bondLineWidth: Math.min(3.4, Math.max(1.6, bondPx / 18)),
    addStereoAnnotation: true,
    clearBackground: false,
    backgroundColour: [1, 1, 1, 0],
    atomColourPalette: ATOM_PALETTE,
    annotationFontScale: 0.75,
    annotationColour: [0.2, 0.23, 0.3, 1],
    baseFontSize: 0.55,
    highlightColour: [0.2, 0.78, 0.72, 0.55],
    fillHighlights: true,
    multipleBondOffset: 0.17,
  };
}

/** Adds 1-based atom-number notes as CXSMILES atom properties; leaves SMILES that already carry notes alone. */
export function withAtomNumberNotes(smiles: string, atomCount: number) {
  if (atomCount < 1 || smiles.includes("atomNote")) return smiles;
  const notes = Array.from({ length: atomCount }, (_, index) => `${index}.atomNote.${index + 1}`).join(":");
  const space = smiles.search(/\s/);
  if (space === -1) return `${smiles} |atomProp:${notes}|`;
  const base = smiles.slice(0, space);
  const extension = smiles.slice(space).trim();
  if (extension.startsWith("|") && extension.endsWith("|") && extension.length > 1) {
    return `${base} ${extension.slice(0, -1)},atomProp:${notes}|`;
  }
  return smiles;
}

type Prepared = {
  mol: RDKitMol;
  atomCount: number;
  /** Size in px at REFERENCE_BOND, including room for labels, stereo notes and atom numbers. */
  width: number;
  height: number;
};

/** Reads atom positions and bonds from a V2000 molblock and returns the layout's extent in px at `bondPx`. */
export function measureMolblock(molblock: string, bondPx: number): { width: number; height: number } | null {
  const lines = molblock.split("\n");
  const atomTotal = Number.parseInt(lines[3]?.slice(0, 3) ?? "", 10);
  const bondTotal = Number.parseInt(lines[3]?.slice(3, 6) ?? "", 10);
  if (!Number.isFinite(atomTotal) || !Number.isFinite(bondTotal) || atomTotal < 1) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < atomTotal; index += 1) {
    const line = lines[4 + index] ?? "";
    const x = Number.parseFloat(line.slice(0, 10));
    const y = Number.parseFloat(line.slice(10, 20));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    xs.push(x);
    ys.push(y);
  }

  let lengthSum = 0;
  let lengthCount = 0;
  for (let index = 0; index < bondTotal; index += 1) {
    const line = lines[4 + atomTotal + index] ?? "";
    const from = Number.parseInt(line.slice(0, 3), 10) - 1;
    const to = Number.parseInt(line.slice(3, 6), 10) - 1;
    if (xs[from] === undefined || xs[to] === undefined) continue;
    lengthSum += Math.hypot(xs[from] - xs[to], ys[from] - ys[to]);
    lengthCount += 1;
  }
  const bondLength = lengthCount && lengthSum > 0 ? lengthSum / lengthCount : 1.5;
  const pxPerUnit = bondPx / bondLength;
  const extentX = (Math.max(...xs) - Math.min(...xs)) * pxPerUnit;
  const extentY = (Math.max(...ys) - Math.min(...ys)) * pxPerUnit;
  // Heteroatom labels, wedge tips, stereo notes and atom numbers sit outside the bond skeleton.
  return { width: Math.max(MIN_COMPONENT_EDGE, extentX) + bondPx * 2, height: Math.max(MIN_COMPONENT_EDGE, extentY) + bondPx * 1.7 };
}

function prepare(rdkit: RDKitModule, smiles: string, options: { numbers?: boolean; hydrogens?: boolean }): Prepared | null {
  let atomCount = 0;
  const heavyAtoms = withMol(rdkit, smiles, (mol) => mol.get_num_atoms(true));
  if (heavyAtoms === null) return null;
  atomCount = heavyAtoms;

  let mol: RDKitMol | null = null;
  try {
    mol = rdkit.get_mol(options.numbers ? withAtomNumberNotes(smiles, atomCount) : smiles);
  } catch {
    mol = null;
  }
  if (!mol) return null;
  try {
    // Hydrogens first so they receive coordinates; then one CoordGen layout that we measure and draw unchanged.
    if (options.hydrogens) mol.add_hs_in_place();
    mol.set_new_coords(true);
    const size = measureMolblock(mol.get_molblock(), REFERENCE_BOND);
    if (!size) {
      mol.delete();
      return null;
    }
    return { mol, atomCount, ...size };
  } catch {
    mol.delete();
    return null;
  }
}

function drawPrepared(item: Prepared, scale: number, highlightAtoms?: number[]) {
  const width = Math.ceil(item.width * scale);
  const height = Math.ceil(item.height * scale);
  const details: Record<string, unknown> = { ...baseDetails(REFERENCE_BOND * scale), width, height };
  const highlights = (highlightAtoms ?? []).map((atom) => atom - 1).filter((atom) => atom >= 0 && atom < item.atomCount);
  if (highlights.length) details.atoms = highlights;
  // RDKit draws E/Z bond labels in a fixed pale periwinkle that is too faint on paper; match the R/S labels instead.
  const svg = item.mol.get_svg_with_highlights(JSON.stringify(details)).replace(/#7F7FFF/gi, "#33394d");
  return { svg, width, height };
}

function innerSvg(svg: string): { inner: string; viewBox: string } | null {
  const body = /<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/.exec(svg);
  if (!body) return null;
  const viewBox = /viewBox=['"]([^'"]+)['"]/.exec(svg)?.[1];
  return viewBox ? { inner: body[1].replace(/<!--[\s\S]*?-->/g, ""), viewBox } : null;
}

export type RenderResult = { ok: true; svg: string } | { ok: false; message: string };

const FAILED_DRAWING: RenderResult = { ok: false, message: "The structure drawing could not be displayed." };

function renderMoleculeOnly(rdkit: RDKitModule, doc: MoleculeDocument, options: DrawOptions): RenderResult {
  const item = prepare(rdkit, doc.smiles, { numbers: options.showAtomNumbers, hydrogens: options.showHydrogens });
  if (!item) return { ok: false, message: SMILES_ERROR_MESSAGE };
  try {
    const scale = Math.min(options.width / item.width, options.height / item.height, MAX_SCALE);
    const drawn = drawPrepared(item, scale, options.highlightAtoms);
    const clean = sanitizeSvg(drawn.svg, drawn.width, drawn.height);
    return clean ? { ok: true, svg: clean } : FAILED_DRAWING;
  } finally {
    item.mol.delete();
  }
}

type RowItem =
  | { kind: "molecule"; item: Prepared; width: number; height: number }
  | { kind: "plus"; width: number; height: number }
  | { kind: "arrow"; agents: Prepared[]; width: number; height: number };

function plusPath(centerX: number, centerY: number, half: number, strokeWidth: number) {
  return `<path d="M${centerX - half} ${centerY}H${centerX + half}M${centerX} ${centerY - half}V${centerY + half}" fill="none" stroke="${INK_CSS}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
}

function arrowPath(startX: number, endX: number, centerY: number, scale: number) {
  const head = 11 * scale;
  const stroke = Math.max(1.8, 2.2 * scale);
  return (
    `<path d="M${startX} ${centerY}H${endX - head * 0.6}" fill="none" stroke="${INK_CSS}" stroke-width="${stroke}" stroke-linecap="round"/>` +
    `<path d="M${endX} ${centerY}L${endX - head} ${centerY - head * 0.45}L${endX - head} ${centerY + head * 0.45}Z" fill="${INK_CSS}"/>`
  );
}

function renderReactionOnly(rdkit: RDKitModule, doc: MoleculeDocument, options: DrawOptions): RenderResult {
  const parts = splitReactionSmiles(doc.smiles);
  if (!parts) return { ok: false, message: REACTION_ERROR_MESSAGE };

  const prepared: Prepared[] = [];
  try {
    const make = (smiles: string) => {
      const item = prepare(rdkit, smiles, { hydrogens: options.showHydrogens });
      if (item) prepared.push(item);
      return item;
    };
    const reactants = parts.reactants.map(make);
    const agents = parts.agents.map(make);
    const products = parts.products.map(make);
    if ([...reactants, ...agents, ...products].some((item) => !item)) return { ok: false, message: SMILES_ERROR_MESSAGE };

    const molecules = (items: (Prepared | null)[]): RowItem[] =>
      items.flatMap((item, index): RowItem[] => {
        const entry: RowItem = { kind: "molecule", item: item as Prepared, width: (item as Prepared).width, height: (item as Prepared).height };
        return index === 0 ? [entry] : [{ kind: "plus", width: PLUS_GAP, height: 0 }, entry];
      });

    const agentItems = agents as Prepared[];
    const agentWidth = agentItems.length ? Math.max(...agentItems.map((item) => item.width)) * AGENT_SCALE : 0;
    const agentStack = agentItems.reduce((sum, item) => sum + item.height * AGENT_SCALE, 0);
    const arrow: RowItem = { kind: "arrow", agents: agentItems, width: Math.max(ARROW_MIN, agentWidth + 24), height: agentStack * 2 + 24 };
    const row: RowItem[] = [...molecules(reactants), arrow, ...molecules(products)];

    const naturalWidth = row.reduce((sum, item) => sum + item.width, 0);
    const naturalHeight = Math.max(...row.map((item) => item.height), 1);
    const scale = Math.min(options.width / naturalWidth, options.height / naturalHeight, MAX_SCALE);
    const totalWidth = Math.ceil(naturalWidth * scale);
    const totalHeight = Math.ceil(naturalHeight * scale);
    const middle = totalHeight / 2;

    const nested = (svg: string, x: number, y: number, width: number, height: number) => {
      const content = innerSvg(svg);
      return content ? `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${content.viewBox}">${content.inner}</svg>` : "";
    };

    let cursor = 0;
    let body = "";
    for (const entry of row) {
      const slot = entry.width * scale;
      if (entry.kind === "molecule") {
        const drawn = drawPrepared(entry.item, scale);
        body += nested(drawn.svg, cursor, (totalHeight - drawn.height) / 2, drawn.width, drawn.height);
      } else if (entry.kind === "plus") {
        body += plusPath(cursor + slot / 2, middle, 7 * scale, Math.max(1.8, 2.2 * scale));
      } else {
        body += arrowPath(cursor + 6 * scale, cursor + slot - 6 * scale, middle, scale);
        let bottom = middle - 8 * scale;
        for (const agent of [...entry.agents].reverse()) {
          const drawn = drawPrepared(agent, scale * AGENT_SCALE);
          bottom -= drawn.height;
          body += nested(drawn.svg, cursor + (slot - drawn.width) / 2, bottom, drawn.width, drawn.height);
        }
      }
      cursor += slot;
    }

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:rdkit="http://www.rdkit.org/xml" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">${body}</svg>`;
    const clean = sanitizeSvg(svg, totalWidth, totalHeight);
    return clean ? { ok: true, svg: clean } : FAILED_DRAWING;
  } finally {
    for (const item of prepared) item.mol.delete();
  }
}

export function renderMoleculeSvg(rdkit: RDKitModule, doc: MoleculeDocument, options: DrawOptions): RenderResult {
  const smiles = doc.smiles.trim();
  if (!smiles) return { ok: false, message: "Type a molecule name or paste a SMILES to draw it." };
  const reaction = doc.kind === "reaction" || isReactionSmiles(smiles);
  try {
    return reaction ? renderReactionOnly(rdkit, { ...doc, smiles }, options) : renderMoleculeOnly(rdkit, { ...doc, smiles }, options);
  } catch {
    return { ok: false, message: reaction ? REACTION_ERROR_MESSAGE : SMILES_ERROR_MESSAGE };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// SVG sanitising

const BLOCKED_TAGS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "style",
  "link",
  "a",
  "use",
  "image",
  "animate",
  "set",
  "animatemotion",
  "animatetransform",
  "audio",
  "video",
]);

const UNSAFE_VALUE = /javascript:|data:text\/html|vbscript:|url\s*\(|expression\s*\(/i;

const BLOCKED_PATTERN = [...BLOCKED_TAGS].join("|");
const BLOCKED_PAIR = new RegExp(`<(${BLOCKED_PATTERN})\\b[\\s\\S]*?</\\1\\s*>`, "gi");
const BLOCKED_SINGLE = new RegExp(`</?(${BLOCKED_PATTERN})\\b[^>]*>`, "gi");

/** Used only where there is no DOM parser (tests, workers). Cruder than the DOM path but removes the same things. */
function sanitizeWithRegex(svg: string): string | null {
  const body = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(BLOCKED_PAIR, "")
    .replace(BLOCKED_SINGLE, "")
    .replace(/\s(?:on[\w-]+|href|[\w-]+:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*')/g, (attribute) => (UNSAFE_VALUE.test(attribute) ? "" : attribute));
  return /^\s*<svg[\s>]/i.test(body) ? body.trim() : null;
}

/**
 * Strips scripts, event handlers, links and external references from SVG markup and pins its pixel size.
 * Returns null if the markup is not a usable SVG.
 */
export function sanitizeSvg(svg: string, width?: number, height?: number): string | null {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return sanitizeWithRegex(svg);
  let parsed: Document;
  try {
    parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  } catch {
    return null;
  }
  const root = parsed.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || parsed.getElementsByTagName("parsererror").length) return null;

  const elements = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const element of elements) {
    if (element !== root && BLOCKED_TAGS.has((element.localName || element.nodeName).toLowerCase())) {
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "href" || name.endsWith(":href") || UNSAFE_VALUE.test(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  if (width && height) {
    root.setAttribute("width", String(width));
    root.setAttribute("height", String(height));
    if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("focusable", "false");
  return new XMLSerializer().serializeToString(root);
}
