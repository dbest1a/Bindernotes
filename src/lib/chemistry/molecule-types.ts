export const MAX_SMILES_LENGTH = 1000;
export const MAX_HIGHLIGHT_ATOMS = 200;
export const MAX_NAME_LENGTH = 120;
export const MAX_CAPTION_LENGTH = 500;

export type MoleculeKind = "molecule" | "reaction";

/**
 * A chemistry board object.
 * - `smiles` is a molecule SMILES, or a reaction SMILES such as "A.B>>C" when `kind` is "reaction".
 * - `highlightAtoms` are 1-based atom numbers in SMILES order, the same numbers `showAtomNumbers` draws.
 *   Highlights and atom numbers apply to single molecules only.
 */
export type MoleculeDocument = {
  version: 1;
  kind: MoleculeKind;
  smiles: string;
  name?: string;
  caption?: string;
  showAtomNumbers?: boolean;
  showHydrogens?: boolean;
  highlightAtoms?: number[];
};

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function isReactionSmiles(smiles: string) {
  return smiles.includes(">");
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(CONTROL_CHARS, " ").trim().slice(0, maxLength).trim();
  return cleaned || undefined;
}

function cleanSmiles(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > MAX_SMILES_LENGTH * 2) return undefined;
  const cleaned = value.replace(CONTROL_CHARS, " ").trim();
  // A truncated SMILES is a different molecule, so over-long input is rejected rather than cut.
  if (!cleaned || cleaned.length > MAX_SMILES_LENGTH) return undefined;
  return cleaned;
}

function cleanHighlights(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<number>();
  for (let index = 0; index < value.length && seen.size < MAX_HIGHLIGHT_ATOMS; index += 1) {
    const atom = value[index];
    if (typeof atom === "number" && Number.isInteger(atom) && atom >= 1 && atom <= MAX_SMILES_LENGTH) seen.add(atom);
  }
  return seen.size ? [...seen] : undefined;
}

/** Strict, pure, allocation-light normaliser used on every board save/load. Unknown keys are dropped. */
export function sanitizeMoleculeDocument(raw: unknown): MoleculeDocument | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  if (source.version !== undefined && source.version !== 1) return undefined;

  const smiles = cleanSmiles(source.smiles);
  if (!smiles) return undefined;

  // The SMILES decides the kind: ">" only appears in reaction SMILES.
  const document: MoleculeDocument = { version: 1, kind: isReactionSmiles(smiles) ? "reaction" : "molecule", smiles };

  const name = cleanText(source.name, MAX_NAME_LENGTH);
  if (name) document.name = name;
  const caption = cleanText(source.caption, MAX_CAPTION_LENGTH);
  if (caption) document.caption = caption;
  if (typeof source.showAtomNumbers === "boolean") document.showAtomNumbers = source.showAtomNumbers;
  if (typeof source.showHydrogens === "boolean") document.showHydrogens = source.showHydrogens;
  const highlightAtoms = cleanHighlights(source.highlightAtoms);
  if (highlightAtoms) document.highlightAtoms = highlightAtoms;
  return document;
}

export function createMolecule(smiles: string, name?: string): MoleculeDocument {
  const cleaned = smiles.replace(CONTROL_CHARS, " ").trim().slice(0, MAX_SMILES_LENGTH);
  const document: MoleculeDocument = {
    version: 1,
    kind: isReactionSmiles(cleaned) ? "reaction" : "molecule",
    smiles: cleaned,
  };
  const cleanName = cleanText(name, MAX_NAME_LENGTH);
  if (cleanName) document.name = cleanName;
  return document;
}

export function moleculeDocumentsEqual(a: MoleculeDocument | undefined, b: MoleculeDocument | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.kind === b.kind &&
    a.smiles === b.smiles &&
    a.name === b.name &&
    a.caption === b.caption &&
    Boolean(a.showAtomNumbers) === Boolean(b.showAtomNumbers) &&
    Boolean(a.showHydrogens) === Boolean(b.showHydrogens) &&
    (a.highlightAtoms ?? []).join(",") === (b.highlightAtoms ?? []).join(",")
  );
}
