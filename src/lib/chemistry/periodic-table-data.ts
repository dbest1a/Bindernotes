import { rawPeriodicElementRecords, type RawPeriodicElementRecord } from "@/lib/chemistry/periodic-table-source";

export type ElementCategory =
  | "alkali-metal"
  | "alkaline-earth-metal"
  | "transition-metal"
  | "post-transition-metal"
  | "metalloid"
  | "reactive-nonmetal"
  | "halogen"
  | "noble-gas"
  | "lanthanide"
  | "actinide";

export type ElementBlock = "s" | "p" | "d" | "f";
export type ElementState = "solid" | "liquid" | "gas" | "unknown";

export type TrendMode =
  | "category"
  | "state"
  | "atomic-radius"
  | "electronegativity"
  | "ionization-energy"
  | "electron-affinity"
  | "atomic-mass"
  | "density"
  | "melting-point"
  | "boiling-point"
  | "metallic-character"
  | "block"
  | "valence-electrons"
  | "oxidation-state"
  | "discovery-year"
  | "abundance";

export type PeriodicTableElement = {
  atomicNumber: number;
  symbol: string;
  name: string;
  atomicMass: number;
  atomicWeightDisplay: string;
  category: ElementCategory;
  group: number;
  groupDisplay: string;
  period: number;
  block: ElementBlock;
  series: "main" | "lanthanide" | "actinide";
  tableColumn: number;
  tableRow: number;
  phase: ElementState;
  stateAtRoomTemperature: ElementState;
  electronConfiguration: string;
  shells: number[];
  valenceElectrons: number | "varies" | "unknown";
  commonOxidationStates: number[];
  commonIonCharges: number[];
  commonIons: string[];
  electronegativity: number | null;
  atomicRadiusPm: number | null;
  firstIonizationEnergyEv: number | null;
  electronAffinityEv: number | null;
  densityGPerCm3: number | null;
  meltingPointK: number | null;
  boilingPointK: number | null;
  discoveryYear: number | null;
  discoveryDisplay: string;
  radioactive: boolean;
  abundanceCrustMgPerKg: number | null;
  commonUses: string;
  use: string;
  safetyNote: string;
  chem101Note: string;
  studyTip: string;
  apChemistryNote: string;
  bondingBehavior: string;
  commonMisconception: string;
  quickCheck: string;
  relatedLessons: string[];
  dataSources: string[];
  dataQualityNotes: string[];
};

export type AtomBuildModel = {
  element: PeriodicTableElement | null;
  protons: number;
  neutrons: number;
  electrons: number;
  massNumber: number;
  charge: number;
  chargeLabel: string;
  particleClass: "neutral atom" | "cation" | "anion" | "invalid";
  isotopeNotation: string;
  shells: number[];
  electronConfiguration: string;
  valenceElectrons: number | "varies" | "unknown";
  warnings: string[];
  whatChanged: string[];
};

export const elementCategories: Record<ElementCategory, string> = {
  "alkali-metal": "Alkali metal",
  "alkaline-earth-metal": "Alkaline earth metal",
  "transition-metal": "Transition metal",
  "post-transition-metal": "Post-transition metal",
  metalloid: "Metalloid",
  "reactive-nonmetal": "Reactive nonmetal",
  halogen: "Halogen",
  "noble-gas": "Noble gas",
  lanthanide: "Lanthanide",
  actinide: "Actinide",
};

export const trendModeLabels: Record<
  TrendMode,
  { label: string; unit: string; explanation: string; apReasoning: string; outlierNote: string }
> = {
  category: {
    label: "Category / family",
    unit: "family",
    explanation: "Families group elements that often show similar valence behavior.",
    apReasoning: "Start with valence shell structure, then explain why a family tends to gain, lose, or share electrons.",
    outlierNote: "Hydrogen is shown as a reactive nonmetal even though it sits above group 1.",
  },
  state: {
    label: "State at 25 C",
    unit: "state",
    explanation: "Room-temperature state connects bonding and intermolecular forces to observable matter.",
    apReasoning: "Use particle attractions and kinetic energy to justify why some elements are gases or liquids at room temperature.",
    outlierNote: "Some synthetic elements have limited state data and are marked unknown when the record is not reliable.",
  },
  "atomic-radius": {
    label: "Atomic radius",
    unit: "pm",
    explanation: "Atomic radius estimates the size of a neutral atom.",
    apReasoning: "Radius generally decreases across a period as effective nuclear charge pulls the same shell closer.",
    outlierNote: "Transition metals and f-block elements show smaller changes because d and f electrons shield imperfectly.",
  },
  electronegativity: {
    label: "Electronegativity",
    unit: "Pauling",
    explanation: "Electronegativity estimates how strongly an atom attracts bonding electrons.",
    apReasoning: "Compare effective nuclear charge and shielding; fluorine is high because bonding electrons feel a strong pull in a compact shell.",
    outlierNote: "Noble gases and many synthetic elements have unknown or nonstandard values.",
  },
  "ionization-energy": {
    label: "First ionization energy",
    unit: "eV",
    explanation: "First ionization energy is the energy needed to remove one electron from a neutral atom.",
    apReasoning: "It generally increases across a period because valence electrons are held more tightly by higher effective nuclear charge.",
    outlierNote: "Subshell stability creates common AP exceptions such as Be/B and N/O comparisons.",
  },
  "electron-affinity": {
    label: "Electron affinity",
    unit: "eV",
    explanation: "Electron affinity tracks energy change when an atom gains an electron.",
    apReasoning: "Use attraction to the nucleus, electron-electron repulsion, and shell filling to explain sign and magnitude.",
    outlierNote: "Some values are small, negative, or source-dependent; unknown values are not replaced with zero.",
  },
  "atomic-mass": {
    label: "Atomic mass",
    unit: "u",
    explanation: "Atomic mass is the weighted average of naturally occurring isotopes when applicable.",
    apReasoning: "Separate mass number for one atom from average atomic mass on the periodic table.",
    outlierNote: "Synthetic elements are commonly displayed with a mass number rather than a stable natural average.",
  },
  density: {
    label: "Density",
    unit: "g/cm3",
    explanation: "Density connects atomic mass, packing, and metallic structure to a macroscopic property.",
    apReasoning: "Higher mass alone is not enough; packing and bonding structure matter too.",
    outlierNote: "Several densities depend on allotrope, temperature, or limited measurements.",
  },
  "melting-point": {
    label: "Melting point",
    unit: "K",
    explanation: "Melting point reflects how much energy is needed to disrupt the solid structure.",
    apReasoning: "Relate high melting points to network covalent structures, metallic bonding, or strong particle attractions.",
    outlierNote: "Carbon is source-sensitive because allotropes and sublimation behavior complicate a single value.",
  },
  "boiling-point": {
    label: "Boiling point",
    unit: "K",
    explanation: "Boiling point reflects the energy needed for particles to separate into a gas at standard pressure.",
    apReasoning: "Use particle attractions and structure to compare elements rather than memorizing the whole table.",
    outlierNote: "Some transuranic elements have unknown or modeled values.",
  },
  "metallic-character": {
    label: "Metallic character",
    unit: "relative",
    explanation: "Metallic character describes how strongly an element behaves like a metal.",
    apReasoning: "Metallic character increases down a group as valence electrons are farther from the nucleus and easier to remove.",
    outlierNote: "Metalloids sit on the boundary and should be explained as mixed behavior, not a hard switch.",
  },
  block: {
    label: "Orbital block",
    unit: "block",
    explanation: "The block shows the subshell being filled in the ground-state configuration.",
    apReasoning: "Connect block to electron configuration and where the differentiating electron is placed.",
    outlierNote: "Some transition and f-block configurations are exceptions to a naive Aufbau fill order.",
  },
  "valence-electrons": {
    label: "Valence electrons",
    unit: "e-",
    explanation: "Valence electrons are the outer electrons most involved in bonding and ion formation.",
    apReasoning: "For main-group elements, group number predicts valence; transition metals often require case-by-case reasoning.",
    outlierNote: "Transition metal valence is marked varies instead of forcing a fake single count.",
  },
  "oxidation-state": {
    label: "Common oxidation state",
    unit: "charge",
    explanation: "Oxidation states keep track of electron accounting in compounds and redox.",
    apReasoning: "Use periodic position, electronegativity, and compound context to justify likely oxidation states.",
    outlierNote: "Transition metals can have many states; common classroom ions are highlighted separately.",
  },
  "discovery-year": {
    label: "Discovery year",
    unit: "year",
    explanation: "Discovery timing shows how tools and nuclear chemistry expanded the table.",
    apReasoning: "Use this mode for context, not as a periodic trend caused by electron structure.",
    outlierNote: "Ancient elements are labeled ancient when a single discovery year is not meaningful.",
  },
  abundance: {
    label: "Crust abundance",
    unit: "mg/kg",
    explanation: "Abundance shows how common an element is in Earth's crust.",
    apReasoning: "Use abundance as real-world context; it is not controlled by periodic electron trends alone.",
    outlierNote: "Synthetic and extremely rare elements may have no meaningful crust abundance.",
  },
};

export const periodicTableDataLedger = [
  {
    source: "lmmentel/mendeleev-data",
    url: "https://github.com/lmmentel/mendeleev-data",
    license: "MIT",
    lastChecked: "2026-05-10",
    fieldsUsed:
      "atomic number, symbol, name, atomic weight, group, period, block, electron configuration, Pauling electronegativity, atomic radius, electron affinity, density, abundance, radioactivity flag, discovery year, oxidation states, first ionization energy, and phase transition temperatures",
    directTextCopied:
      "No. Descriptions, name origins, and uses text from source data were not imported. BinderNotes learning explanations are original.",
    notes:
      "Some physical properties vary by allotrope, temperature, pressure, isotope, or source convention; missing values are displayed as unknown rather than zero.",
  },
] as const;

const gasesAtRoomTemperature = new Set(["H", "He", "N", "O", "F", "Ne", "Cl", "Ar", "Kr", "Xe", "Rn"]);
const liquidsAtRoomTemperature = new Set(["Br", "Hg"]);

const nobleShells: Record<string, number[]> = {
  He: [2],
  Ne: [2, 8],
  Ar: [2, 8, 8],
  Kr: [2, 8, 18, 8],
  Xe: [2, 8, 18, 18, 8],
  Rn: [2, 8, 18, 32, 18, 8],
  Og: [2, 8, 18, 32, 32, 18, 8],
};

const categoryBySeriesId: Record<number, ElementCategory> = {
  1: "reactive-nonmetal",
  2: "noble-gas",
  3: "alkali-metal",
  4: "alkaline-earth-metal",
  5: "metalloid",
  6: "halogen",
  7: "post-transition-metal",
  8: "transition-metal",
  9: "lanthanide",
  10: "actinide",
};

const specificCopy: Record<
  string,
  Partial<
    Pick<
      PeriodicTableElement,
      | "commonUses"
      | "chem101Note"
      | "apChemistryNote"
      | "bondingBehavior"
      | "commonMisconception"
      | "quickCheck"
      | "relatedLessons"
    >
  >
> = {
  H: {
    commonUses: "Fuel cells, acid-base chemistry, hydrogen bonding models, and stars.",
    chem101Note: "Hydrogen is the simplest atom, so it is the cleanest way to separate proton count, electron count, and charge.",
    apChemistryNote: "Hydrogen is a good exception-checker: it can be H+ in acids, H- in metal hydrides, or share one pair in covalent bonds.",
    bondingBehavior: "Usually forms one bond and follows a duet rather than an octet.",
    commonMisconception: "Hydrogen sits over group 1, but it is not an alkali metal in ordinary chemistry.",
    quickCheck: "Why can hydrogen form H+ in acids but also share electrons in H2?",
    relatedLessons: ["atomic structure", "acid-base chemistry", "bonding"],
  },
  C: {
    commonUses: "Organic molecules, graphite, diamond, carbon dioxide, fuels, polymers, and carbon dating.",
    chem101Note: "Carbon has four valence electrons, which lets it build chains, rings, and network structures.",
    apChemistryNote: "Use carbon to connect hybridization, bond polarity, formal charge, and molecular structure.",
    bondingBehavior: "Often forms four covalent bonds; it can make single, double, or triple bonds depending on the structure.",
    commonMisconception: "Carbon usually shares electrons instead of becoming a simple C4+ or C4- ion in first-year chemistry.",
    quickCheck: "Carbon-14 is radioactive, but why is it still carbon?",
    relatedLessons: ["electron configuration", "bonding", "stoichiometry"],
  },
  N: {
    commonUses: "Air, proteins, fertilizers, explosives, and nitrogen-containing biomolecules.",
    chem101Note: "Nitrogen's five valence electrons often lead to three bonds plus one lone pair.",
    apChemistryNote: "Nitrogen is useful for formal charge, molecular geometry, acid-base behavior, and oxidation-state reasoning.",
    bondingBehavior: "Often forms three bonds in neutral molecules and N3- in simple ionic compounds.",
    commonMisconception: "A lone pair is not unused; it shapes geometry and can accept a proton.",
    quickCheck: "Why is NH3 trigonal pyramidal instead of flat?",
    relatedLessons: ["VSEPR", "bonding", "acid-base chemistry"],
  },
  O: {
    commonUses: "Respiration, combustion, oxides, water, acids, bases, and redox reactions.",
    chem101Note: "Oxygen's six valence electrons explain why it commonly forms two bonds or O2-.",
    apChemistryNote: "Oxygen is a high-electronegativity anchor for bond polarity, oxidation states, and redox balancing.",
    bondingBehavior: "Often forms two bonds and carries two lone pairs in neutral molecules.",
    commonMisconception: "Oxygen is not always neutral in a formula; oxide, peroxide, and covalent oxygen have different electron accounting.",
    quickCheck: "Why does oxygen usually form O2- in ionic compounds?",
    relatedLessons: ["redox", "bonding", "molecular polarity"],
  },
  F: {
    commonUses: "Fluorides, polymers, refrigerant chemistry, and etching compounds.",
    chem101Note: "Fluorine is the strongest electronegativity reference in most classroom comparisons.",
    apChemistryNote: "F vs Cl is a classic radius/electronegativity comparison: fluorine has less shielding and a smaller valence shell.",
    bondingBehavior: "Usually gains one electron or forms one single covalent bond.",
    commonMisconception: "Being more electronegative does not mean fluorine is larger; it is smaller than chlorine.",
    quickCheck: "Why is F more electronegative than Cl even though both are halogens?",
    relatedLessons: ["periodic trends", "bond polarity", "Coulomb's law"],
  },
  Na: {
    commonUses: "Table salt, electrolytes, sodium compounds, and flame tests.",
    chem101Note: "Sodium is the model example of a metal losing one valence electron to form Na+.",
    apChemistryNote: "Na, Mg, Al comparisons show increasing effective nuclear charge across period 3.",
    bondingBehavior: "Usually loses one electron to reach a neon-like electron configuration.",
    commonMisconception: "Na+ is smaller than neutral Na because it has lost the outer 3s electron.",
    quickCheck: "Why does sodium form Na+ instead of Na2+ in common ionic compounds?",
    relatedLessons: ["ions", "periodic trends", "ionic bonding"],
  },
  Mg: {
    commonUses: "Light alloys, fireworks, antacids, and biological ions.",
    chem101Note: "Magnesium shows the group 2 pattern: two valence electrons and a common +2 ion.",
    apChemistryNote: "Compare Mg to Na and Al to reason about ionization energy and metallic character across period 3.",
    bondingBehavior: "Usually forms Mg2+ in ionic compounds.",
    quickCheck: "Why does Mg form Mg2+ while Na usually forms Na+?",
  },
  Al: {
    commonUses: "Cans, foil, aircraft alloys, and aluminum oxide coatings.",
    chem101Note: "Aluminum connects metal behavior with the formation of a protective oxide layer.",
    apChemistryNote: "Aluminum is useful for amphoteric oxide examples and period 3 ionization comparisons.",
    bondingBehavior: "Often forms Al3+ in ionic compounds but can show covalent character in some contexts.",
    quickCheck: "Why does Al3+ have the same electron count as neon?",
  },
  Si: {
    commonUses: "Semiconductors, glass, ceramics, and solar cells.",
    chem101Note: "Silicon sits below carbon and helps students see how a group trend can preserve valence while changing size.",
    apChemistryNote: "C vs Si comparisons connect larger radius, lower electronegativity, and network covalent materials.",
    bondingBehavior: "Often forms four covalent bonds in network or molecular structures.",
    quickCheck: "Why does silicon have similar valence behavior to carbon but a larger atomic radius?",
  },
  Cl: {
    commonUses: "Chloride salts, water treatment chemistry, acids, and oxidizing agents.",
    chem101Note: "Chlorine is the everyday halogen example: seven valence electrons and a common -1 ion.",
    apChemistryNote: "Chlorine supports trend explanations, redox half-reactions, and acid/base naming.",
    bondingBehavior: "Usually gains one electron as chloride or forms one covalent bond.",
    commonMisconception: "Chlorine atoms and chloride ions have different properties; one is not just a label for the other.",
    quickCheck: "Why is Cl- larger than neutral Cl?",
    relatedLessons: ["ionic bonding", "redox", "periodic trends"],
  },
  Fe: {
    commonUses: "Steel, construction, hemoglobin, magnets, and redox chemistry.",
    chem101Note: "Iron introduces transition metals with more than one common charge.",
    apChemistryNote: "Fe2+/Fe3+ is a useful redox pair because electron removal from transition metals is context-dependent.",
    bondingBehavior: "Commonly forms Fe2+ and Fe3+; ligand and redox conditions matter.",
    commonMisconception: "Transition metals do not always have one predictable charge from the group number.",
    quickCheck: "Why do Fe2+ and Fe3+ both appear in chemistry problems?",
    relatedLessons: ["redox", "transition metals", "coordination chemistry"],
  },
  Br: {
    commonUses: "Bromide salts, organic synthesis, and flame-retardant chemistry.",
    chem101Note: "Bromine is the room-temperature liquid halogen, which makes state trends memorable.",
    quickCheck: "Why is Br2 liquid while Cl2 is gas at room temperature?",
  },
  U: {
    commonUses: "Nuclear fuel, radiometric dating context, and nuclear chemistry examples.",
    chem101Note: "Uranium is useful mainly as a radioactivity and isotope discussion point in general chemistry.",
    apChemistryNote: "Use uranium to distinguish nuclear change from ordinary chemical bonding changes.",
    bondingBehavior: "Can form multiple oxidation states; nuclear identity still depends on proton count.",
    commonMisconception: "Radioactivity is a nuclear property, not a sign that ordinary chemical bonds are radioactive.",
    quickCheck: "What changes in a nuclear reaction that does not change in an ordinary chemical reaction?",
    relatedLessons: ["nuclear chemistry", "redox"],
  },
};

export const periodicTableElements: PeriodicTableElement[] = rawPeriodicElementRecords.map(buildElement);

export const periodicTableElementsByAtomicNumber = new Map(
  periodicTableElements.map((element) => [element.atomicNumber, element]),
);

export const periodicTableElementsBySymbol = new Map(periodicTableElements.map((element) => [element.symbol, element]));

export function findElement(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    periodicTableElements.find((element) => element.symbol.toLowerCase() === normalized) ??
    periodicTableElements.find((element) => element.name.toLowerCase() === normalized) ??
    periodicTableElements.find((element) => String(element.atomicNumber) === normalized) ??
    periodicTableElements.find((element) => element.name.toLowerCase().includes(normalized)) ??
    null
  );
}

export function searchElements(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return periodicTableElements;
  }

  const chargeMatch = normalized.match(/(?:forms?|ion|charge)\s*(\d+[+-]|[+-]?\d+|[+-])/);
  const charge = chargeMatch ? parseChargeSearch(chargeMatch[1]) : null;
  const chargeOnlySearch = Boolean(chargeMatch && normalized.replace(chargeMatch[0], "").trim() === "");
  const groupMatch = normalized.match(/group\s*(\d{1,2})/);
  const periodMatch = normalized.match(/period\s*(\d)/);

  return periodicTableElements.filter((element) => {
    const haystack = [
      element.symbol,
      element.name,
      String(element.atomicNumber),
      elementCategories[element.category],
      `group ${element.group}`,
      `period ${element.period}`,
      `${element.block} block`,
      element.electronConfiguration,
      element.commonUses,
      element.chem101Note,
      element.apChemistryNote,
      element.bondingBehavior,
      ...element.relatedLessons,
      ...element.commonIons,
    ]
      .join(" ")
      .toLowerCase();

    if (charge !== null && !element.commonIonCharges.includes(charge)) {
      return false;
    }
    if (groupMatch && element.group !== Number(groupMatch[1])) {
      return false;
    }
    if (periodMatch && element.period !== Number(periodMatch[1])) {
      return false;
    }
    if (chargeOnlySearch) {
      return true;
    }
    if (normalized === element.symbol.toLowerCase()) {
      return true;
    }

    return haystack.includes(normalized);
  });
}

export function getTrendNumericValue(element: PeriodicTableElement, trend: TrendMode): number | null {
  switch (trend) {
    case "atomic-radius":
      return element.atomicRadiusPm;
    case "electronegativity":
      return element.electronegativity;
    case "ionization-energy":
      return element.firstIonizationEnergyEv;
    case "electron-affinity":
      return element.electronAffinityEv;
    case "atomic-mass":
      return element.atomicMass;
    case "density":
      return element.densityGPerCm3;
    case "melting-point":
      return element.meltingPointK;
    case "boiling-point":
      return element.boilingPointK;
    case "metallic-character":
      return getMetallicCharacter(element);
    case "valence-electrons":
      return typeof element.valenceElectrons === "number" ? element.valenceElectrons : null;
    case "oxidation-state":
      return element.commonOxidationStates.length
        ? Math.max(...element.commonOxidationStates.map((state) => Math.abs(state)))
        : null;
    case "discovery-year":
      return element.discoveryYear;
    case "abundance":
      return element.abundanceCrustMgPerKg;
    default:
      return null;
  }
}

export function getTrendRange(trend: TrendMode) {
  const values = periodicTableElements
    .map((element) => getTrendNumericValue(element, trend))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (values.length === 0) {
    return null;
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function getTrendScore(element: PeriodicTableElement, trend: TrendMode) {
  const value = getTrendNumericValue(element, trend);
  if (value === null) {
    if (trend === "category") {
      return categoryIndex(element.category) / 10;
    }
    if (trend === "state") {
      return stateIndex(element.phase) / 4;
    }
    if (trend === "block") {
      return blockIndex(element.block) / 4;
    }
    return 0;
  }

  const range = getTrendRange(trend);
  if (!range || range.max === range.min) {
    return value;
  }

  return (value - range.min) / (range.max - range.min);
}

export function getTrendDisplay(element: PeriodicTableElement, trend: TrendMode) {
  if (trend === "category") {
    return elementCategories[element.category];
  }
  if (trend === "state") {
    return element.phase;
  }
  if (trend === "block") {
    return `${element.block}-block`;
  }
  if (trend === "valence-electrons" && typeof element.valenceElectrons !== "number") {
    return element.valenceElectrons;
  }
  if (trend === "oxidation-state") {
    return element.commonOxidationStates.length ? element.commonOxidationStates.map(formatSignedNumber).join(", ") : "unknown";
  }

  const value = getTrendNumericValue(element, trend);
  if (value === null) {
    return "unknown";
  }

  if (trend === "discovery-year") {
    return element.discoveryDisplay;
  }
  if (trend === "atomic-mass") {
    return element.atomicWeightDisplay;
  }

  return formatNumber(value);
}

export function buildAtomModel(protons: number, neutrons: number, electrons: number): AtomBuildModel {
  const cleanProtons = clampInteger(protons, 0, 118);
  const cleanNeutrons = clampInteger(neutrons, 0, 220);
  const cleanElectrons = clampInteger(electrons, 0, 200);
  const element = periodicTableElementsByAtomicNumber.get(cleanProtons) ?? null;
  const charge = cleanProtons - cleanElectrons;
  const massNumber = cleanProtons + cleanNeutrons;
  const shells = getAufbauShellDistribution(cleanElectrons);
  const warnings: string[] = [];
  const whatChanged: string[] = [];

  if (!element) {
    warnings.push("Choose 1-118 protons to build a known element.");
  } else if (element.radioactive) {
    warnings.push(`${element.name} has no stable isotope in the data set; treat it as nuclear chemistry context.`);
  }
  if (cleanNeutrons === 0 && cleanProtons > 1) {
    warnings.push("Most atoms beyond hydrogen need neutrons for a physically meaningful nucleus.");
  }
  if (cleanElectrons > cleanProtons + 4) {
    warnings.push("Very high negative charge is unusual for isolated atoms in Chemistry 101.");
  }
  if (cleanElectrons < Math.max(0, cleanProtons - 6)) {
    warnings.push("Very high positive charge is unusual outside advanced or plasma contexts.");
  }

  if (element) {
    whatChanged.push(`${cleanProtons} protons identifies the atom as ${element.name}.`);
    whatChanged.push(`${cleanNeutrons} neutrons makes the mass number ${massNumber}.`);
    whatChanged.push(
      charge === 0
        ? `${cleanElectrons} electrons balances the protons, so the atom is neutral.`
        : `${cleanElectrons} electrons gives a net ${formatCharge(charge)} charge.`,
    );
  }

  return {
    element,
    protons: cleanProtons,
    neutrons: cleanNeutrons,
    electrons: cleanElectrons,
    massNumber,
    charge,
    chargeLabel: charge === 0 ? "neutral" : formatCharge(charge),
    particleClass: cleanProtons === 0 ? "invalid" : charge > 0 ? "cation" : charge < 0 ? "anion" : "neutral atom",
    isotopeNotation: element ? `${element.name}-${massNumber}${charge === 0 ? "" : ` ${formatCharge(charge)}`}` : "unknown atom",
    shells,
    electronConfiguration:
      element && cleanElectrons === cleanProtons
        ? element.electronConfiguration
        : getElectronConfigurationForElectronCount(cleanElectrons),
    valenceElectrons: element ? estimateValenceFromShells(shells, element.block) : "unknown",
    warnings,
    whatChanged,
  };
}

export function formatCharge(charge: number) {
  if (charge === 0) {
    return "0";
  }
  const magnitude = Math.abs(charge);
  return `${magnitude === 1 ? "" : magnitude}${charge > 0 ? "+" : "-"}`;
}

export function formatSignedNumber(value: number) {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

export function formatNumber(value: number) {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (Math.abs(value) >= 100) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  if (Math.abs(value) >= 10) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function buildElement(record: RawPeriodicElementRecord): PeriodicTableElement {
  const category = getCategory(record);
  const electronConfiguration = normalizeElectronConfiguration(record.electronConfiguration, record.atomicNumber);
  const shells = getShellDistribution(electronConfiguration);
  const valenceElectrons = getValenceElectrons(record, shells);
  const phase = getRoomTemperatureState(record);
  const commonOxidationStates = record.mainOxidationStates.length ? record.mainOxidationStates : record.oxidationStates;
  const commonIonCharges = getCommonIonCharges(record, category, commonOxidationStates);
  const copy = specificCopy[record.symbol] ?? {};

  const commonUses = copy.commonUses ?? getGenericUse(record, category);
  const chem101Note = copy.chem101Note ?? getGenericChem101Note(record, category, valenceElectrons);
  const apChemistryNote = copy.apChemistryNote ?? getGenericApNote(record, category);
  const bondingBehavior = copy.bondingBehavior ?? getGenericBondingBehavior(record, category, commonIonCharges);
  const commonMisconception = copy.commonMisconception ?? getGenericMisconception(record, category);
  const quickCheck = copy.quickCheck ?? getGenericQuickCheck(record, category);
  const relatedLessons = copy.relatedLessons ?? getRelatedLessons(record, category);

  const elementBase = {
    atomicNumber: record.atomicNumber,
    symbol: record.symbol,
    name: record.name,
    atomicMass: record.atomicMass ?? Number.NaN,
    atomicWeightDisplay: record.atomicMassDisplay,
    category,
    group: record.group ?? 3,
    groupDisplay: getGroupDisplay(record),
    period: record.period,
    block: record.block as ElementBlock,
    series: getSeries(record.atomicNumber),
    tableColumn: getTableColumn(record),
    tableRow: getTableRow(record),
    phase,
    stateAtRoomTemperature: phase,
    electronConfiguration,
    shells,
    valenceElectrons,
    commonOxidationStates,
    commonIonCharges,
    commonIons: commonIonCharges.map((charge) => `${record.symbol}${formatCharge(charge)}`),
    electronegativity: record.electronegativity,
    atomicRadiusPm: record.atomicRadiusPm,
    firstIonizationEnergyEv: record.firstIonizationEnergyEv,
    electronAffinityEv: record.electronAffinityEv,
    densityGPerCm3: record.densityGPerCm3,
    meltingPointK: record.meltingPointK,
    boilingPointK: record.boilingPointK,
    discoveryYear: record.discoveryYear,
    discoveryDisplay: record.discoveryYear ? String(record.discoveryYear) : "ancient or uncertain",
    radioactive: record.radioactive,
    abundanceCrustMgPerKg: record.abundanceCrustMgPerKg,
    commonUses,
    use: commonUses,
    safetyNote: getSafetyNote(record, category),
    chem101Note,
    studyTip: chem101Note,
    apChemistryNote,
    bondingBehavior,
    commonMisconception,
    quickCheck,
    relatedLessons,
    dataSources: ["mendeleev-data elements", "mendeleev-data oxidationstates", "mendeleev-data ionizationenergies", "mendeleev-data phasetransitions"],
    dataQualityNotes: getDataQualityNotes(record),
  };

  return elementBase;
}

function getCategory(record: RawPeriodicElementRecord): ElementCategory {
  if (record.atomicNumber >= 57 && record.atomicNumber <= 71) {
    return "lanthanide";
  }
  if (record.atomicNumber >= 89 && record.atomicNumber <= 103) {
    return "actinide";
  }
  if (record.symbol === "H") {
    return "reactive-nonmetal";
  }
  return categoryBySeriesId[record.seriesId] ?? "reactive-nonmetal";
}

function getSeries(atomicNumber: number): PeriodicTableElement["series"] {
  if (atomicNumber >= 57 && atomicNumber <= 71) {
    return "lanthanide";
  }
  if (atomicNumber >= 89 && atomicNumber <= 103) {
    return "actinide";
  }
  return "main";
}

function getGroupDisplay(record: RawPeriodicElementRecord) {
  if (record.atomicNumber >= 57 && record.atomicNumber <= 71) {
    return "lanthanide row";
  }
  if (record.atomicNumber >= 89 && record.atomicNumber <= 103) {
    return "actinide row";
  }
  return String(record.group ?? "unknown");
}

function getTableColumn(record: RawPeriodicElementRecord) {
  if (record.atomicNumber >= 57 && record.atomicNumber <= 71) {
    return record.atomicNumber - 57 + 4;
  }
  if (record.atomicNumber >= 89 && record.atomicNumber <= 103) {
    return record.atomicNumber - 89 + 4;
  }
  return record.group ?? 3;
}

function getTableRow(record: RawPeriodicElementRecord) {
  if (record.atomicNumber >= 57 && record.atomicNumber <= 71) {
    return 9;
  }
  if (record.atomicNumber >= 89 && record.atomicNumber <= 103) {
    return 10;
  }
  return record.period + 1;
}

function normalizeElectronConfiguration(configuration: string, atomicNumber: number) {
  if (atomicNumber === 1) {
    return "1s1";
  }
  return configuration.replace(/(\d[spdfg])(?=\s|$)/g, "$11");
}

function getShellDistribution(configuration: string) {
  const shellCounts = Array(7).fill(0) as number[];
  const core = configuration.match(/^\[([A-Z][a-z]?)\]/)?.[1];
  if (core && nobleShells[core]) {
    nobleShells[core].forEach((count, index) => {
      shellCounts[index] += count;
    });
  }

  const withoutCore = configuration.replace(/^\[[^\]]+\]\s*/, "");
  for (const match of withoutCore.matchAll(/(\d)([spdfg])(\d+)/g)) {
    const shell = Number(match[1]);
    const count = Number(match[3]);
    shellCounts[shell - 1] += count;
  }

  while (shellCounts.length > 1 && shellCounts.at(-1) === 0) {
    shellCounts.pop();
  }

  return shellCounts;
}

function getValenceElectrons(record: RawPeriodicElementRecord, shells: number[]): PeriodicTableElement["valenceElectrons"] {
  if (record.group === 1) {
    return 1;
  }
  if (record.group === 2) {
    return 2;
  }
  if (record.group && record.group >= 13 && record.group <= 18) {
    return record.group - 10;
  }
  if (record.block === "d" || record.block === "f") {
    return "varies";
  }
  return estimateValenceFromShells(shells, record.block as ElementBlock);
}

function estimateValenceFromShells(shells: number[], block: ElementBlock): PeriodicTableElement["valenceElectrons"] {
  if (shells.length === 0) {
    return "unknown";
  }
  if (block === "d" || block === "f") {
    return "varies";
  }
  return shells.at(-1) ?? "unknown";
}

function getRoomTemperatureState(record: RawPeriodicElementRecord): ElementState {
  if (gasesAtRoomTemperature.has(record.symbol)) {
    return "gas";
  }
  if (liquidsAtRoomTemperature.has(record.symbol)) {
    return "liquid";
  }
  if (record.atomicNumber >= 104 && record.meltingPointK === null) {
    return "unknown";
  }
  return "solid";
}

function getCommonIonCharges(record: RawPeriodicElementRecord, category: ElementCategory, oxidationStates: number[]) {
  const nonZero = oxidationStates.filter((state) => state !== 0);
  if (record.symbol === "H") {
    return [1, -1];
  }
  if (category === "noble-gas") {
    return [];
  }
  if (record.group === 1) {
    return [1];
  }
  if (record.group === 2) {
    return [2];
  }
  if (record.group === 13 && category !== "metalloid") {
    return [3];
  }
  if (record.group === 15 && category === "reactive-nonmetal") {
    return [-3];
  }
  if (record.group === 16 && category === "reactive-nonmetal") {
    return [-2];
  }
  if (record.group === 17) {
    return [-1];
  }
  if (category === "transition-metal" || category === "lanthanide" || category === "actinide") {
    return nonZero.filter((state) => state > 0).slice(0, 3);
  }
  return nonZero.slice(0, 3);
}

function getMetallicCharacter(element: PeriodicTableElement) {
  if (element.category.includes("metal") || element.category === "lanthanide" || element.category === "actinide") {
    return Math.min(1, 0.7 + element.period * 0.035);
  }
  if (element.category === "metalloid") {
    return 0.45;
  }
  return Math.max(0.05, 0.35 - element.group * 0.01 + element.period * 0.02);
}

function getGenericUse(record: RawPeriodicElementRecord, category: ElementCategory) {
  if (record.radioactive && record.atomicNumber >= 93) {
    return "Nuclear chemistry research; no routine classroom or household use.";
  }
  if (category === "noble-gas") {
    return "Inert atmospheres, lighting, cryogenics, or specialty research depending on the element.";
  }
  if (category === "lanthanide") {
    return "Magnets, optics, catalysts, electronics, or materials research depending on the element.";
  }
  if (category === "actinide") {
    return "Nuclear chemistry, radioactivity studies, or specialized research contexts.";
  }
  if (category === "transition-metal") {
    return "Alloys, catalysts, pigments, electronics, or redox chemistry contexts.";
  }
  if (category === "halogen") {
    return "Halide salts, oxidation reactions, disinfection chemistry, or organic synthesis contexts.";
  }
  if (category === "metalloid") {
    return "Semiconductors, glasses, alloys, or materials chemistry contexts.";
  }
  return "Chemical compounds, materials, biology, industry, or classroom trend comparisons.";
}

function getSafetyNote(record: RawPeriodicElementRecord, category: ElementCategory) {
  if (record.radioactive) {
    return "Radioactive element: use only as a study model unless handled by trained professionals under approved controls.";
  }
  if (category === "halogen") {
    return "Halogens and many halogen compounds can be reactive or hazardous; classroom work needs supervision.";
  }
  if (["Pb", "Hg", "Cd", "As"].includes(record.symbol)) {
    return "Toxicity matters here; connect chemistry usefulness with environmental and health risk.";
  }
  if (category.includes("metal")) {
    return "Metal samples and salts can have different hazards, so formula and oxidation state matter.";
  }
  return "Use as a learning reference; real lab handling depends on the specific substance, not just the element name.";
}

function getGenericChem101Note(
  record: RawPeriodicElementRecord,
  category: ElementCategory,
  valenceElectrons: PeriodicTableElement["valenceElectrons"],
) {
  const valenceText = typeof valenceElectrons === "number" ? `${valenceElectrons} valence electron${valenceElectrons === 1 ? "" : "s"}` : "variable valence behavior";
  return `${record.name} is a ${elementCategories[category].toLowerCase()} in period ${record.period}. For Chemistry 101, use its position to predict ${valenceText}, likely ions, and bonding patterns.`;
}

function getGenericApNote(record: RawPeriodicElementRecord, category: ElementCategory) {
  if (category === "transition-metal" || category === "lanthanide" || category === "actinide") {
    return `${record.name} is best handled with electron configuration and oxidation-state context rather than a single main-group shortcut.`;
  }
  return `For AP reasoning, compare ${record.name}'s shell, shielding, and effective nuclear charge before naming a trend.`;
}

function getGenericBondingBehavior(record: RawPeriodicElementRecord, category: ElementCategory, charges: number[]) {
  if (category === "noble-gas") {
    return "Usually resists bonding because the valence shell is filled.";
  }
  if (charges.length) {
    return `Common classroom ion pattern: ${charges.map(formatCharge).join(", ")}. Explain this from valence electrons and shell stability.`;
  }
  if (category.includes("metal")) {
    return "Often participates in metallic bonding and can form positive ions in compounds.";
  }
  return "Often shares electrons covalently or gains electrons to complete a valence shell.";
}

function getGenericMisconception(record: RawPeriodicElementRecord, category: ElementCategory) {
  if (category === "transition-metal") {
    return "Do not force transition metals into one fixed charge just because main-group patterns are simpler.";
  }
  if (category === "noble-gas") {
    return "Low reactivity does not mean impossible chemistry; it means ordinary first-year reactions are uncommon.";
  }
  if (record.radioactive) {
    return "Radioactive behavior comes from the nucleus, not from ordinary valence electrons.";
  }
  return "A periodic trend is a reasoning pattern, not a rule that ignores shell changes, shielding, or exceptions.";
}

function getGenericQuickCheck(record: RawPeriodicElementRecord, category: ElementCategory) {
  if (category === "noble-gas") {
    return `Why does ${record.symbol} resist ordinary bonding compared with the element just before it?`;
  }
  if (record.group === 1 || record.group === 2) {
    return `Why is ${record.symbol} expected to form a positive ion in many ionic compounds?`;
  }
  if (record.group === 17) {
    return `Why does ${record.symbol} often form a -1 ion or one covalent bond?`;
  }
  return `Use period, group, and electron configuration to predict one property of ${record.symbol}.`;
}

function getRelatedLessons(record: RawPeriodicElementRecord, category: ElementCategory) {
  const lessons = ["atomic structure", "periodic trends", "electron configuration"];
  if (category === "halogen" || category === "alkali-metal" || category === "alkaline-earth-metal") {
    lessons.push("ionic bonding");
  }
  if (category === "reactive-nonmetal" || category === "metalloid") {
    lessons.push("covalent bonding");
  }
  if (category === "transition-metal" || category === "actinide") {
    lessons.push("redox");
  }
  if (record.radioactive) {
    lessons.push("nuclear chemistry");
  }
  return lessons;
}

function getDataQualityNotes(record: RawPeriodicElementRecord) {
  const notes: string[] = [];
  if (record.atomicRadiusPm === null) {
    notes.push("Atomic radius unknown in the source table.");
  }
  if (record.electronegativity === null) {
    notes.push("Pauling electronegativity unavailable or not standard for this element.");
  }
  if (record.meltingPointK === null || record.boilingPointK === null) {
    notes.push("Phase transition value missing or source-sensitive.");
  }
  if (record.phaseNote) {
    notes.push(`Phase transition note: ${record.phaseNote}.`);
  }
  if (record.radioactive) {
    notes.push("Radioactive element; isotope and stability context matters.");
  }
  return notes.length ? notes : ["Core periodic table values available from source data."];
}

function parseChargeSearch(value: string) {
  if (value === "+") {
    return 1;
  }
  if (value === "-") {
    return -1;
  }
  if (value.endsWith("+")) {
    return Number(value.slice(0, -1));
  }
  if (value.endsWith("-")) {
    return -Number(value.slice(0, -1));
  }
  return Number(value);
}

function categoryIndex(category: ElementCategory) {
  return Object.keys(elementCategories).indexOf(category);
}

function stateIndex(state: ElementState) {
  return ["unknown", "gas", "liquid", "solid"].indexOf(state);
}

function blockIndex(block: ElementBlock) {
  return ["s", "p", "d", "f"].indexOf(block) + 1;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

const aufbauOrbitals = [
  ["1s", 2],
  ["2s", 2],
  ["2p", 6],
  ["3s", 2],
  ["3p", 6],
  ["4s", 2],
  ["3d", 10],
  ["4p", 6],
  ["5s", 2],
  ["4d", 10],
  ["5p", 6],
  ["6s", 2],
  ["4f", 14],
  ["5d", 10],
  ["6p", 6],
  ["7s", 2],
  ["5f", 14],
  ["6d", 10],
  ["7p", 6],
] as const;

function getAufbauShellDistribution(electronCount: number) {
  const shellCounts = Array(7).fill(0) as number[];
  let remaining = clampInteger(electronCount, 0, 200);

  for (const [orbital, capacity] of aufbauOrbitals) {
    if (remaining <= 0) {
      break;
    }
    const fill = Math.min(capacity, remaining);
    shellCounts[Number(orbital[0]) - 1] += fill;
    remaining -= fill;
  }

  while (shellCounts.length > 1 && shellCounts.at(-1) === 0) {
    shellCounts.pop();
  }

  return shellCounts;
}

function getAufbauTokensForElectronCount(electronCount: number) {
  let remaining = clampInteger(electronCount, 0, 200);
  const tokens: string[] = [];

  for (const [orbital, capacity] of aufbauOrbitals) {
    if (remaining <= 0) {
      break;
    }
    const fill = Math.min(capacity, remaining);
    tokens.push(`${orbital}${fill}`);
    remaining -= fill;
  }

  return tokens;
}

function getElectronConfigurationForElectronCount(electronCount: number): string {
  const tokens = getAufbauTokensForElectronCount(electronCount);
  const full = tokens.join(" ");
  const noble = Object.entries(nobleShells)
    .map(([symbol, shells]) => ({ symbol, electrons: shells.reduce((sum, count) => sum + count, 0) }))
    .filter((entry) => entry.electrons <= electronCount)
    .sort((left, right) => right.electrons - left.electrons)[0];

  if (!noble || noble.electrons === 0 || noble.electrons === electronCount) {
    return noble && noble.electrons === electronCount ? `[${noble.symbol}]` : full || "no electrons";
  }

  const coreTokenCount = getAufbauTokensForElectronCount(noble.electrons).length;
  return `[${noble.symbol}] ${tokens.slice(coreTokenCount).join(" ")}`.trim();
}
