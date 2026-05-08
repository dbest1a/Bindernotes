function safeLog10(value: number) {
  return Math.log10(Math.max(value, 1e-14));
}

export function calculateStrongAcidBase(input: {
  kind: "acid" | "base";
  concentrationM: number;
}) {
  const concentration = Math.max(input.concentrationM, 1e-14);
  if (input.kind === "acid") {
    const ph = -safeLog10(concentration);
    return { ph, poh: 14 - ph, hydronium: concentration, hydroxide: 1e-14 / concentration };
  }

  const poh = -safeLog10(concentration);
  const ph = 14 - poh;
  return { ph, poh, hydronium: 1e-14 / concentration, hydroxide: concentration };
}

export function calculateHendersonHasselbalch(input: {
  pKa: number;
  conjugateBaseM: number;
  weakAcidM: number;
}) {
  return input.pKa + safeLog10(input.conjugateBaseM / Math.max(input.weakAcidM, 1e-14));
}

export function getPhScaleLabel(ph: number) {
  if (ph < 3) return "strongly acidic";
  if (ph < 7) return "acidic";
  if (Math.abs(ph - 7) < 0.05) return "neutral";
  if (ph < 11) return "basic";
  return "strongly basic";
}
