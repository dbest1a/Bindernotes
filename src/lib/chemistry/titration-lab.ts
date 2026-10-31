import type {
  TitrationAcidKind,
  TitrationAction,
  TitrationMeasurement,
  TitrationNotebook,
  TitrationState,
} from "@/lib/chemistry/chemistry-types";
import {
  generateExactTitrationCurve,
  titrationAtVolume,
  titrationMilestones,
  type TitrationExperiment,
} from "@/lib/chemistry/exact-titration";

function nowIso() {
  return new Date().toISOString();
}

function emptyNotebook(): TitrationNotebook {
  return {
    hypothesis: "",
    procedure: "",
    dataTable: "",
    calculations: "",
    observations: "",
    errorAnalysis: "",
    conclusion: "",
  };
}

const MIN_GRAPH_MAX_ML = 50;
const DEFAULT_PKA: Record<Exclude<TitrationAcidKind, "strong">, number[]> = {
  "weak-monoprotic": [4.76],
  "weak-diprotic": [3.4, 7.85],
};

function clampVolume(value: number, maxMl: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(maxMl, value));
}

/** Keeps one finite pKa between 0 and 14 per proton, falling back to the defaults for the acid type. */
export function sanitizePka(acidKind: TitrationAcidKind, pKa: number[] = []) {
  if (acidKind === "strong") {
    return [];
  }
  return DEFAULT_PKA[acidKind].map((fallback, index) => {
    const value = pKa[index];
    return Number.isFinite(value) ? Math.max(0, Math.min(14, value)) : fallback;
  });
}

function acidFormulaFor(acidKind: TitrationAcidKind): TitrationState["acidFormula"] {
  return acidKind === "strong" ? "HCl" : acidKind === "weak-monoprotic" ? "HA" : "H2A";
}

export function describeTitrationAcid(state: Pick<TitrationState, "acidKind" | "acidMolarity" | "acidVolumeMl" | "pKa">) {
  const amount = `${state.acidVolumeMl.toFixed(2)} mL of ${state.acidMolarity.toFixed(3)} M`;
  if (state.acidKind === "strong") {
    return `${amount} HCl`;
  }
  const pKaText = state.pKa.map((value) => value.toFixed(2)).join(" and ");
  return `${amount} ${state.acidKind === "weak-monoprotic" ? "weak acid HA" : "diprotic acid H2A"} (pKa ${pKaText})`;
}

/** Exact model: full charge balance with water, the acid's pKa values and the sodium from the titrant. Volumes in m³, concentrations in mol/m³. */
function buildExperiment(state: TitrationState): TitrationExperiment {
  const concentration = state.acidMolarity * 1000;
  const names = state.acidKind === "weak-diprotic" ? ["H2A", "HA−", "A2−"] : ["HA", "A−"];
  return {
    analyte:
      state.acidKind === "strong"
        ? { spectators: [{ id: "Cl-", charge: -1, concentration }] }
        : { families: [{ id: "acid", concentration, pKa: state.pKa, protonatedCharge: 0, species: names }] },
    initialVolume: state.acidVolumeMl * 1e-6,
    titrantConcentration: state.baseMolarity * 1000,
    titrant: "base",
  };
}

export function calculateTitrationPh(state: TitrationState, titrantMl: number) {
  return titrationAtVolume(buildExperiment(state), titrantMl * 1e-6).pH;
}

export type TitrationMarkers = { equivalenceMl: number[]; halfEquivalenceMl: number[] };

/** Equivalence and half-equivalence volumes in mL, computed from the same exact model as the curve. */
export function getTitrationMarkers(state: TitrationState): TitrationMarkers {
  const { equivalenceVolumes, halfEquivalenceVolumes } = titrationMilestones(buildExperiment(state));
  return {
    equivalenceMl: equivalenceVolumes.map((volume) => volume * 1e6),
    halfEquivalenceMl: halfEquivalenceVolumes.map((volume) => volume * 1e6),
  };
}

/** The graph always reaches past the last equivalence point so overshoot is visible. */
export function getTitrationGraphMaxMl(state: TitrationState) {
  const last = getTitrationMarkers(state).equivalenceMl.at(-1) ?? 0;
  return Math.max(MIN_GRAPH_MAX_ML, Math.ceil((last * 1.3) / 5) * 5);
}

export function generateTitrationCurve(state: TitrationState) {
  return generateExactTitrationCurve(buildExperiment(state), getTitrationGraphMaxMl(state) * 1e-6).map((point) => ({
    volumeMl: point.volume * 1e6,
    ph: point.pH,
  }));
}

export type TitrationZone = "start" | "acidic" | "half-equivalence" | "endpoint" | "between" | "past";

export function classifyTitrationVolume(markers: TitrationMarkers, volumeMl: number): TitrationZone {
  const near = (target: number) => Math.abs(volumeMl - target) <= 0.04 * target;
  if (markers.equivalenceMl.some(near)) return "endpoint";
  if (markers.halfEquivalenceMl.some(near)) return "half-equivalence";
  if (volumeMl <= 0) return "start";
  const [first = Infinity] = markers.equivalenceMl;
  const last = markers.equivalenceMl.at(-1) ?? Infinity;
  if (volumeMl < first) return "acidic";
  return volumeMl > last ? "past" : "between";
}

function safeNegativeLog10(concentration: number) {
  return -Math.log10(Math.max(concentration, 1e-14));
}

export function calculateStrongAcidStrongBasePh(input: {
  acidMolarity: number;
  acidVolumeMl: number;
  baseMolarity: number;
  baseVolumeMl: number;
}) {
  const acidMoles = input.acidMolarity * (input.acidVolumeMl / 1000);
  const baseMoles = input.baseMolarity * (input.baseVolumeMl / 1000);
  const totalLiters = Math.max((input.acidVolumeMl + input.baseVolumeMl) / 1000, 0.000001);
  const difference = acidMoles - baseMoles;

  if (Math.abs(difference) < 1e-10) {
    return 7;
  }

  if (difference > 0) {
    return safeNegativeLog10(difference / totalLiters);
  }

  const poh = safeNegativeLog10(Math.abs(difference) / totalLiters);
  return 14 - poh;
}

function buildMeasurement(state: TitrationState): TitrationMeasurement {
  const equivalenceVolume = getTitrationMarkers(state).equivalenceMl.at(-1) ?? 1;
  const ph = calculateTitrationPh(state, state.titrantAddedMl);

  return {
    titrantVolumeMl: Number(state.titrantAddedMl.toFixed(2)),
    ph: Number(ph.toFixed(2)),
    equivalenceProgress: Number((state.titrantAddedMl / equivalenceVolume).toFixed(3)),
  };
}

export function createTitrationInitialState(): TitrationState {
  const baseState = {
    labTemplateId: "acid-base-titration-strong-acid-base" as const,
    acidKind: "strong" as const,
    pKa: [] as number[],
    acidFormula: "HCl" as const,
    baseFormula: "NaOH" as const,
    acidMolarity: 0.1,
    acidVolumeMl: 25,
    baseMolarity: 0.1,
    titrantAddedMl: 0,
  };
  const empty = { measurements: [], notebook: emptyNotebook(), updatedAt: nowIso() };

  return { ...baseState, ...empty, ph: Number(calculateTitrationPh({ ...baseState, ...empty, ph: 0 }, 0).toFixed(2)) };
}

export function titrationReducer(state: TitrationState, action: TitrationAction): TitrationState {
  if (action.type === "reset") {
    return createTitrationInitialState();
  }

  if (action.type === "update_notebook") {
    return {
      ...state,
      notebook: {
        ...state.notebook,
        [action.section]: action.value,
      },
      updatedAt: nowIso(),
    };
  }

  if (action.type === "configure_acid") {
    const configured = {
      ...state,
      acidKind: action.acidKind,
      acidFormula: acidFormulaFor(action.acidKind),
      pKa: sanitizePka(action.acidKind, action.pKa ?? (action.acidKind === state.acidKind ? state.pKa : undefined)),
      titrantAddedMl: 0,
      measurements: [],
      updatedAt: nowIso(),
    };
    return { ...configured, ph: Number(calculateTitrationPh(configured, 0).toFixed(2)) };
  }

  const nextAdded = clampVolume(state.titrantAddedMl + action.volumeMl, getTitrationGraphMaxMl(state));
  const measurement = buildMeasurement({ ...state, titrantAddedMl: nextAdded });

  return {
    ...state,
    titrantAddedMl: nextAdded,
    ph: measurement.ph,
    measurements: [...state.measurements, measurement],
    updatedAt: nowIso(),
  };
}
