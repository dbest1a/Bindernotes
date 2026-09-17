import { finite, nonnegative, positive } from "@/lib/chemistry/calculation-validation";

// Ideal, fully dissociated monovalent acid/base at 25 C. Activities are not modeled.
// Kw reference: https://openstax.org/books/chemistry-2e/pages/14-1-bronsted-lowry-acids-and-bases
const waterIonProduct = 1e-14;

export function calculateStrongAcidBase(input: { kind: "acid" | "base"; concentrationM: number }) {
  const concentration = nonnegative(input.concentrationM, "Concentration");
  if (input.kind !== "acid" && input.kind !== "base")
    throw new RangeError("Choose a strong acid or strong base.");
  // Solve H - OH = C and H * OH = Kw (swap H/OH for base).
  // hypot and separate halves avoid overflowing C*C or C+sqrt(...).
  const majority = concentration / 2 + Math.hypot(concentration / 2, Math.sqrt(waterIonProduct));
  const minority = positive(waterIonProduct / majority, "Calculated minority-ion concentration");
  const hydronium = input.kind === "acid" ? majority : minority;
  const hydroxide = input.kind === "acid" ? minority : majority;
  return { ph: -Math.log10(hydronium), poh: -Math.log10(hydroxide), hydronium, hydroxide };
}

export function calculateHendersonHasselbalch(input: {
  pKa: number;
  conjugateBaseM: number;
  weakAcidM: number;
}) {
  finite(input.pKa, "pKa");
  positive(input.conjugateBaseM, "Conjugate-base concentration");
  positive(input.weakAcidM, "Weak-acid concentration");
  return finite(input.pKa + Math.log10(input.conjugateBaseM) - Math.log10(input.weakAcidM), "Calculated pH");
}

export function getPhScaleLabel(ph: number) {
  finite(ph, "pH");
  if (ph < 3) return "strongly acidic";
  if (ph < 7) return "acidic";
  if (ph === 7) return "neutral";
  if (ph < 11) return "basic";
  return "strongly basic";
}
