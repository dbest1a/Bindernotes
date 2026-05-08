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

export type PeriodicTableElement = {
  atomicNumber: number;
  symbol: string;
  name: string;
  atomicMass: number;
  group: number;
  period: number;
  category: ElementCategory;
  electronConfiguration: string;
  commonIons: string[];
  electronegativity: number | null;
  atomicRadiusPm: number | null;
  phase: "solid" | "liquid" | "gas";
  use: string;
  studyTip: string;
};

export const elementCategories: Record<ElementCategory, string> = {
  "alkali-metal": "Alkali metal",
  "alkaline-earth-metal": "Alkaline earth",
  "transition-metal": "Transition metal",
  "post-transition-metal": "Post-transition metal",
  metalloid: "Metalloid",
  "reactive-nonmetal": "Reactive nonmetal",
  halogen: "Halogen",
  "noble-gas": "Noble gas",
  lanthanide: "Lanthanide",
  actinide: "Actinide",
};

export const periodicTableElements: PeriodicTableElement[] = [
  { atomicNumber: 1, symbol: "H", name: "Hydrogen", atomicMass: 1.008, group: 1, period: 1, category: "reactive-nonmetal", electronConfiguration: "1s1", commonIons: ["H+", "H-"], electronegativity: 2.2, atomicRadiusPm: 53, phase: "gas", use: "Fuel cells and acid-base chemistry.", studyTip: "Hydrogen sits over group 1 but behaves like a nonmetal in most AP problems." },
  { atomicNumber: 2, symbol: "He", name: "Helium", atomicMass: 4.0026, group: 18, period: 1, category: "noble-gas", electronConfiguration: "1s2", commonIons: [], electronegativity: null, atomicRadiusPm: 31, phase: "gas", use: "Cryogenics and balloons.", studyTip: "A filled 1s shell explains helium's low reactivity." },
  { atomicNumber: 3, symbol: "Li", name: "Lithium", atomicMass: 6.94, group: 1, period: 2, category: "alkali-metal", electronConfiguration: "[He] 2s1", commonIons: ["Li+"], electronegativity: 0.98, atomicRadiusPm: 167, phase: "solid", use: "Rechargeable batteries.", studyTip: "Group 1 metals usually lose one electron." },
  { atomicNumber: 4, symbol: "Be", name: "Beryllium", atomicMass: 9.0122, group: 2, period: 2, category: "alkaline-earth-metal", electronConfiguration: "[He] 2s2", commonIons: ["Be2+"], electronegativity: 1.57, atomicRadiusPm: 112, phase: "solid", use: "Lightweight alloys.", studyTip: "Group 2 metals usually form +2 ions." },
  { atomicNumber: 5, symbol: "B", name: "Boron", atomicMass: 10.81, group: 13, period: 2, category: "metalloid", electronConfiguration: "[He] 2s2 2p1", commonIons: ["B3+"], electronegativity: 2.04, atomicRadiusPm: 87, phase: "solid", use: "Borosilicate glass.", studyTip: "Boron is electron deficient and often breaks simple octet expectations." },
  { atomicNumber: 6, symbol: "C", name: "Carbon", atomicMass: 12.011, group: 14, period: 2, category: "reactive-nonmetal", electronConfiguration: "[He] 2s2 2p2", commonIons: ["C4-", "C4+"], electronegativity: 2.55, atomicRadiusPm: 67, phase: "solid", use: "Organic molecules and graphite.", studyTip: "Four valence electrons make carbon the backbone of bonding questions." },
  { atomicNumber: 7, symbol: "N", name: "Nitrogen", atomicMass: 14.007, group: 15, period: 2, category: "reactive-nonmetal", electronConfiguration: "[He] 2s2 2p3", commonIons: ["N3-"], electronegativity: 3.04, atomicRadiusPm: 56, phase: "gas", use: "Fertilizers and proteins.", studyTip: "Nitrogen commonly has three bonds and one lone pair in neutral molecules." },
  { atomicNumber: 8, symbol: "O", name: "Oxygen", atomicMass: 15.999, group: 16, period: 2, category: "reactive-nonmetal", electronConfiguration: "[He] 2s2 2p4", commonIons: ["O2-"], electronegativity: 3.44, atomicRadiusPm: 48, phase: "gas", use: "Respiration and combustion.", studyTip: "Oxygen is highly electronegative and usually carries two lone pairs." },
  { atomicNumber: 9, symbol: "F", name: "Fluorine", atomicMass: 18.998, group: 17, period: 2, category: "halogen", electronConfiguration: "[He] 2s2 2p5", commonIons: ["F-"], electronegativity: 3.98, atomicRadiusPm: 42, phase: "gas", use: "Fluorides and polymers.", studyTip: "Fluorine is the most electronegative element." },
  { atomicNumber: 10, symbol: "Ne", name: "Neon", atomicMass: 20.18, group: 18, period: 2, category: "noble-gas", electronConfiguration: "[He] 2s2 2p6", commonIons: [], electronegativity: null, atomicRadiusPm: 38, phase: "gas", use: "Lighting signs.", studyTip: "A complete octet makes neon a noble-gas reference point." },
  { atomicNumber: 11, symbol: "Na", name: "Sodium", atomicMass: 22.99, group: 1, period: 3, category: "alkali-metal", electronConfiguration: "[Ne] 3s1", commonIons: ["Na+"], electronegativity: 0.93, atomicRadiusPm: 190, phase: "solid", use: "Table salt and electrolytes.", studyTip: "Sodium loses one electron to reach neon configuration." },
  { atomicNumber: 12, symbol: "Mg", name: "Magnesium", atomicMass: 24.305, group: 2, period: 3, category: "alkaline-earth-metal", electronConfiguration: "[Ne] 3s2", commonIons: ["Mg2+"], electronegativity: 1.31, atomicRadiusPm: 145, phase: "solid", use: "Light alloys and fireworks.", studyTip: "Magnesium forms a stable +2 cation." },
  { atomicNumber: 13, symbol: "Al", name: "Aluminum", atomicMass: 26.982, group: 13, period: 3, category: "post-transition-metal", electronConfiguration: "[Ne] 3s2 3p1", commonIons: ["Al3+"], electronegativity: 1.61, atomicRadiusPm: 118, phase: "solid", use: "Cans, foil, and aircraft alloys.", studyTip: "Aluminum oxide explains why aluminum resists corrosion." },
  { atomicNumber: 14, symbol: "Si", name: "Silicon", atomicMass: 28.085, group: 14, period: 3, category: "metalloid", electronConfiguration: "[Ne] 3s2 3p2", commonIons: ["Si4+"], electronegativity: 1.9, atomicRadiusPm: 111, phase: "solid", use: "Semiconductors and glass.", studyTip: "Silicon bridges metallic and nonmetallic behavior." },
  { atomicNumber: 15, symbol: "P", name: "Phosphorus", atomicMass: 30.974, group: 15, period: 3, category: "reactive-nonmetal", electronConfiguration: "[Ne] 3s2 3p3", commonIons: ["P3-"], electronegativity: 2.19, atomicRadiusPm: 98, phase: "solid", use: "DNA, ATP, and fertilizers.", studyTip: "Phosphate shows why polyatomic ions matter." },
  { atomicNumber: 16, symbol: "S", name: "Sulfur", atomicMass: 32.06, group: 16, period: 3, category: "reactive-nonmetal", electronConfiguration: "[Ne] 3s2 3p4", commonIons: ["S2-"], electronegativity: 2.58, atomicRadiusPm: 88, phase: "solid", use: "Vulcanized rubber and sulfates.", studyTip: "Oxygen and sulfur trends are a strong comparison pair." },
  { atomicNumber: 17, symbol: "Cl", name: "Chlorine", atomicMass: 35.45, group: 17, period: 3, category: "halogen", electronConfiguration: "[Ne] 3s2 3p5", commonIons: ["Cl-"], electronegativity: 3.16, atomicRadiusPm: 79, phase: "gas", use: "Water treatment and chloride salts.", studyTip: "Halogens gain one electron to complete an octet." },
  { atomicNumber: 18, symbol: "Ar", name: "Argon", atomicMass: 39.948, group: 18, period: 3, category: "noble-gas", electronConfiguration: "[Ne] 3s2 3p6", commonIons: [], electronegativity: null, atomicRadiusPm: 71, phase: "gas", use: "Inert welding atmosphere.", studyTip: "Argon marks the end of period 3." },
  { atomicNumber: 19, symbol: "K", name: "Potassium", atomicMass: 39.098, group: 1, period: 4, category: "alkali-metal", electronConfiguration: "[Ar] 4s1", commonIons: ["K+"], electronegativity: 0.82, atomicRadiusPm: 243, phase: "solid", use: "Electrolytes and fertilizers.", studyTip: "Atomic radius jumps when a new shell begins." },
  { atomicNumber: 20, symbol: "Ca", name: "Calcium", atomicMass: 40.078, group: 2, period: 4, category: "alkaline-earth-metal", electronConfiguration: "[Ar] 4s2", commonIons: ["Ca2+"], electronegativity: 1, atomicRadiusPm: 194, phase: "solid", use: "Bones, limestone, and cement.", studyTip: "Calcium connects ionic compounds and solubility rules." },
  { atomicNumber: 24, symbol: "Cr", name: "Chromium", atomicMass: 51.996, group: 6, period: 4, category: "transition-metal", electronConfiguration: "[Ar] 3d5 4s1", commonIons: ["Cr3+", "Cr6+"], electronegativity: 1.66, atomicRadiusPm: 166, phase: "solid", use: "Stainless steel plating.", studyTip: "Chromium is a classic electron configuration exception." },
  { atomicNumber: 26, symbol: "Fe", name: "Iron", atomicMass: 55.845, group: 8, period: 4, category: "transition-metal", electronConfiguration: "[Ar] 3d6 4s2", commonIons: ["Fe2+", "Fe3+"], electronegativity: 1.83, atomicRadiusPm: 156, phase: "solid", use: "Steel and hemoglobin.", studyTip: "Transition metals can have multiple common charges." },
  { atomicNumber: 29, symbol: "Cu", name: "Copper", atomicMass: 63.546, group: 11, period: 4, category: "transition-metal", electronConfiguration: "[Ar] 3d10 4s1", commonIons: ["Cu+", "Cu2+"], electronegativity: 1.9, atomicRadiusPm: 145, phase: "solid", use: "Electrical wiring.", studyTip: "Copper is another electron configuration exception." },
  { atomicNumber: 30, symbol: "Zn", name: "Zinc", atomicMass: 65.38, group: 12, period: 4, category: "transition-metal", electronConfiguration: "[Ar] 3d10 4s2", commonIons: ["Zn2+"], electronegativity: 1.65, atomicRadiusPm: 142, phase: "solid", use: "Galvanized steel.", studyTip: "Zinc usually behaves as a +2 metal in Gen Chem." },
  { atomicNumber: 35, symbol: "Br", name: "Bromine", atomicMass: 79.904, group: 17, period: 4, category: "halogen", electronConfiguration: "[Ar] 3d10 4s2 4p5", commonIons: ["Br-"], electronegativity: 2.96, atomicRadiusPm: 94, phase: "liquid", use: "Flame retardants and bromide salts.", studyTip: "Bromine is the room-temperature liquid halogen." },
  { atomicNumber: 47, symbol: "Ag", name: "Silver", atomicMass: 107.8682, group: 11, period: 5, category: "transition-metal", electronConfiguration: "[Kr] 4d10 5s1", commonIons: ["Ag+"], electronegativity: 1.93, atomicRadiusPm: 165, phase: "solid", use: "Mirrors and precipitation reactions.", studyTip: "AgCl is a useful solubility-rule anchor." },
  { atomicNumber: 53, symbol: "I", name: "Iodine", atomicMass: 126.904, group: 17, period: 5, category: "halogen", electronConfiguration: "[Kr] 4d10 5s2 5p5", commonIons: ["I-"], electronegativity: 2.66, atomicRadiusPm: 115, phase: "solid", use: "Antiseptics and thyroid chemistry.", studyTip: "Halogen reactivity decreases down the group." },
  { atomicNumber: 56, symbol: "Ba", name: "Barium", atomicMass: 137.327, group: 2, period: 6, category: "alkaline-earth-metal", electronConfiguration: "[Xe] 6s2", commonIons: ["Ba2+"], electronegativity: 0.89, atomicRadiusPm: 253, phase: "solid", use: "Medical imaging contrast.", studyTip: "Barium sulfate is famously insoluble." },
  { atomicNumber: 57, symbol: "La", name: "Lanthanum", atomicMass: 138.905, group: 3, period: 6, category: "lanthanide", electronConfiguration: "[Xe] 5d1 6s2", commonIons: ["La3+"], electronegativity: 1.1, atomicRadiusPm: 195, phase: "solid", use: "Camera lenses and catalysts.", studyTip: "Lanthanides commonly form +3 ions." },
  { atomicNumber: 82, symbol: "Pb", name: "Lead", atomicMass: 207.2, group: 14, period: 6, category: "post-transition-metal", electronConfiguration: "[Xe] 4f14 5d10 6s2 6p2", commonIons: ["Pb2+", "Pb4+"], electronegativity: 2.33, atomicRadiusPm: 180, phase: "solid", use: "Batteries and shielding.", studyTip: "Heavy metals are a safety and environmental context." },
  { atomicNumber: 89, symbol: "Ac", name: "Actinium", atomicMass: 227, group: 3, period: 7, category: "actinide", electronConfiguration: "[Rn] 6d1 7s2", commonIons: ["Ac3+"], electronegativity: 1.1, atomicRadiusPm: 195, phase: "solid", use: "Radiochemistry research.", studyTip: "Actinides introduce nuclear stability and radioactivity context." },
];

export type TrendMode = "atomic-radius" | "electronegativity" | "ionization-energy" | "metallic-character";

export function findElement(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return (
    periodicTableElements.find(
      (element) =>
        element.symbol.toLowerCase() === normalized ||
        element.name.toLowerCase().includes(normalized) ||
        String(element.atomicNumber) === normalized,
    ) ?? null
  );
}

export function getTrendScore(element: PeriodicTableElement, trend: TrendMode) {
  if (trend === "electronegativity") {
    return element.electronegativity ?? 0;
  }
  if (trend === "atomic-radius") {
    return element.atomicRadiusPm ?? 0;
  }
  if (trend === "metallic-character") {
    return element.category.includes("metal") || element.category === "lanthanide" || element.category === "actinide"
      ? 1
      : 0.25;
  }
  return Math.max(0, 4 - element.group / 5 + (4 - element.period) * 0.25);
}
