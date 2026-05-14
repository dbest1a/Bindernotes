import type { JSONContent } from "@tiptap/react";
import type { Binder, BinderLesson, Folder, FolderBinderLink, MathBlock, WorkspaceModuleId, WorkspacePresetId } from "@/types";
import { slugify } from "@/lib/utils";

export const CHEMISTRY_SHOWCASE_FOLDER_ID = "folder-chemistry";
export const CHEMISTRY_SHOWCASE_BINDER_ID = "binder-chemistry-101-ap-chemistry";
export const CHEMISTRY_COURSE_FOLDER_ID = CHEMISTRY_SHOWCASE_FOLDER_ID;
export const CHEMISTRY_COURSE_BINDER_ID = CHEMISTRY_SHOWCASE_BINDER_ID;

const now = new Date("2026-05-10T00:00:00.000Z").toISOString();
const ownerId = "system-chemistry-course";
const studentFacingTransparencyNote =
  "This binder teaches standard chemistry concepts using original lessons and study tools. It is designed as a study support workspace, not a copied replacement for any textbook. Content should be reviewed for accuracy.";
const humanReviewStatus =
  "Human review status: original BinderNotes course seed drafted for study support; content should be reviewed by a qualified chemistry instructor before high-stakes classroom, grading, or exam-prep use.";
const sourceLedgerSummary =
  "Source Ledger: uploaded chemistry references were used only to inventory standard topics and cross-check correctness. The ledger stores source titles, topic coverage, license/copyright risk notes, and reuse restrictions; it does not store copied excerpts.";
const copyrightHygieneChecklist =
  "Copyright Hygiene Check: original explanations, original examples, original practice questions, original diagram prompts, and original lab/data tasks are used. No copied textbook phrasing, copied problems, official AP question text, copied figures, copied tables, or copied labs are intentionally included.";

type FormulaTopic =
  | "measurement"
  | "moles"
  | "atomic"
  | "bonding"
  | "gases"
  | "solutions"
  | "stoichiometry"
  | "kinetics"
  | "thermochemistry"
  | "equilibrium"
  | "acid-base"
  | "electrochemistry"
  | "data-analysis";

type LessonCategory =
  | "measurement"
  | "atomic"
  | "bonding"
  | "imf-gases-solutions"
  | "reactions"
  | "stoichiometry"
  | "kinetics"
  | "thermochemistry"
  | "equilibrium"
  | "acid-base"
  | "electrochemistry"
  | "ap-review";

type ChemistryUnitSpec = {
  id: string;
  title: string;
  apAlignment: string;
  chem101Alignment: string;
  chem102Bridge: string | null;
  lessons: string[];
};

type ChemistryLessonSpec = {
  id: string;
  unitId: string;
  unitTitle: string;
  title: string;
  order: number;
  unitOrder: number;
  category: LessonCategory;
  presetId: WorkspacePresetId;
  formulaTopics: FormulaTopic[];
  vocabTerms: string[];
  moduleIds: WorkspaceModuleId[];
  conceptTags: string[];
  alignmentTags: string[];
  relatedConcepts: string[];
  difficulty: "intro" | "core" | "challenge";
};

export type ChemistryShowcaseLessonMetadata = {
  lessonId: string;
  unitId: string;
  unitTitle: string;
  unitOrder: number;
  presetId: WorkspacePresetId;
  difficulty: "intro" | "core" | "challenge";
  conceptTags: string[];
  alignmentTags: string[];
  moduleIds: WorkspaceModuleId[];
  relatedConcepts: string[];
};

type FormulaEntry = {
  name: string;
  latex: string;
  variables: string;
  units: string;
  use: string;
  trap: string;
};

type VocabEntry = {
  definition: string;
  precision: string;
  example: string;
};

export const chemistryCourseSourceLedger = [
  {
    title: "Chemistry 2e",
    fileName: "chemistry-2e_-_WEB.pdf",
    sourceType: "OpenStax open educational resource, metadata title Chemistry 2e",
    topicsChecked: "introductory chemistry sequence, measurement, atoms, bonding, reactions, gases, solutions, kinetics, thermodynamics, equilibrium, acid-base, electrochemistry",
    reuse: "No direct prose, diagrams, tables, worked problems, captions, or answer keys were reused.",
  },
  {
    title: "General Chemistry 101",
    fileName: "General Chemistry 101.pdf",
    sourceType: "course reference PDF, license not confirmed",
    topicsChecked: "first-semester general chemistry pacing and common student-skill sequence",
    reuse: "Used only for factual orientation and topic coverage checks.",
  },
  {
    title: "CHM 102",
    fileName: "474_CHM 102.pdf",
    sourceType: "course slides/reference PDF, license not confirmed",
    topicsChecked: "second-semester bridge topics for equilibrium, acids and bases, thermodynamics, and electrochemistry",
    reuse: "Used only for factual orientation and advanced bridge placement.",
  },
  {
    title: "Chem 201: General Chemistry I OER",
    fileName: "Full.pdf",
    sourceType: "OER PDF by metadata title, exact license not revalidated inside product seed",
    topicsChecked: "general chemistry I scope and skill order",
    reuse: "No source expression was copied or adapted.",
  },
  {
    title: "Chemistry 2e (OpenStax)",
    fileName: "Full (2).pdf",
    sourceType: "OpenStax open educational resource, duplicate/reference edition",
    topicsChecked: "cross-check of standard chemistry facts and equation conventions",
    reuse: "No direct reuse; this only helped verify standard facts.",
  },
  {
    title: "Chemistry (OpenStax)",
    fileName: "Full (1).pdf",
    sourceType: "OpenStax open educational resource, earlier/reference edition",
    topicsChecked: "cross-check of standard chemistry sequence and terminology",
    reuse: "No direct reuse; this only helped verify standard facts.",
  },
  {
    title: "General chemistry textbook/reference, title metadata unavailable",
    fileName: "A9R1be0kd0_1le5jy6_5mw.pdf",
    sourceType: "unknown license",
    topicsChecked: "broad general chemistry table-of-contents orientation only",
    reuse: "Direct reuse treated as forbidden because license status is unknown.",
  },
] as const;

const chemistryUnits: ChemistryUnitSpec[] = [
  {
    id: "u0",
    title: "Unit 0 - Chemistry Toolkit / Foundations",
    apAlignment: "science practices, quantitative reasoning, models, measurement",
    chem101Alignment: "course readiness, lab math, units, graphing, naming basics",
    chem102Bridge: "data quality habits used again in equilibrium, kinetics, and electrochemistry",
    lessons: [
      "What Chemistry Studies: Matter, Models, and Measurement",
      "Units, Dimensional Analysis, and Unit Conversions",
      "Significant Figures, Scientific Notation, and Uncertainty",
      "Density, Percent Composition, and Basic Lab Math",
      "Chemical Symbols, Formulas, Ions, and Naming Basics",
      "Lab Safety, Measurements, and Data Quality",
      "Graphing Data, Slopes, Linearization, and Error",
    ],
  },
  {
    id: "u1",
    title: "Unit 1 - Atomic Structure and Periodic Properties",
    apAlignment: "atomic structure, evidence for shells, periodic reasoning",
    chem101Alignment: "atoms, isotopes, electrons, atomic mass, periodic trends",
    chem102Bridge: null,
    lessons: [
      "Atoms, Isotopes, Atomic Mass, and the Mole Bridge",
      "Electrons, Light, and Quantized Energy",
      "Electron Configurations and Orbital Diagrams",
      "Periodic Trends: Atomic Radius, Ionization Energy, Electronegativity",
      "Photoelectron Spectroscopy and Evidence for Shells",
      "AP Mixed Practice: Atomic Evidence and Periodic Reasoning",
    ],
  },
  {
    id: "u2",
    title: "Unit 2 - Chemical Bonding and Compound Structure",
    apAlignment: "compound structure, models, polarity, Coulombic attractions",
    chem101Alignment: "ionic and covalent bonding, Lewis structures, molecular geometry",
    chem102Bridge: null,
    lessons: [
      "Ionic vs Covalent Bonding",
      "Lewis Structures and Formal Charge",
      "Resonance and Bond Order",
      "VSEPR Geometry and Molecular Polarity",
      "Hybridization and Sigma/Pi Bonds",
      "Ionic Lattices, Coulomb's Law, and Bond Energy",
      "AP Mixed Practice: Structure, Polarity, and Properties",
    ],
  },
  {
    id: "u3",
    title: "Unit 3 - Intermolecular Forces, Gases, Solutions, and Mixtures",
    apAlignment: "substances, mixtures, particulate models, gases, solutions",
    chem101Alignment: "IMFs, phases, gases, molarity, dilution, mixture analysis",
    chem102Bridge: "solution and solubility reasoning that supports later Ksp and acid-base systems",
    lessons: [
      "Intermolecular Forces: LDF, Dipole, Hydrogen Bonding, Ion-Dipole",
      "Properties of Solids, Liquids, and Phase Changes",
      "Gas Laws and Kinetic Molecular Theory",
      "Ideal Gas Law and Stoichiometry",
      "Solutions, Concentration, Dilution, and Molarity",
      "Separation, Chromatography, and Mixture Analysis",
      "Solubility and Particle-Level Representations",
      "AP Mixed Practice: IMF, Gases, and Solutions",
    ],
  },
  {
    id: "u4",
    title: "Unit 4 - Chemical Reactions and Stoichiometry",
    apAlignment: "chemical reactions, net ionic equations, quantitative reasoning",
    chem101Alignment: "balancing, mole ratios, limiting reactants, aqueous reactions, titration basics",
    chem102Bridge: "reaction evidence and net ionic thinking used later in equilibrium and electrochemistry",
    lessons: [
      "Writing and Balancing Chemical Equations",
      "Mole Concept and Reaction Stoichiometry",
      "Limiting Reactants and Percent Yield",
      "Aqueous Reactions and Net Ionic Equations",
      "Acid-Base, Precipitation, and Redox Reaction Types",
      "Titration Basics and Reaction Evidence",
      "AP Mixed Practice: Reactions and Quantitative Reasoning",
    ],
  },
  {
    id: "u5",
    title: "Unit 5 - Kinetics",
    apAlignment: "rates, rate laws, mechanisms, graph interpretation",
    chem101Alignment: "reaction rates, data tables, orders, catalysts, activation energy",
    chem102Bridge: "rate law and mechanism reasoning often taught in second-semester general chemistry",
    lessons: [
      "Reaction Rates and Collision Theory",
      "Rate Laws and Reaction Order",
      "Integrated Rate Laws and Half-Life",
      "Mechanisms, Elementary Steps, and Rate-Determining Step",
      "Catalysts and Activation Energy",
      "Kinetics Data Lab: Determine Rate Law from Data",
      "AP Mixed Practice: Kinetics Graphs and Mechanisms",
    ],
  },
  {
    id: "u6",
    title: "Unit 6 - Thermochemistry",
    apAlignment: "energy transfer, calorimetry, enthalpy, particle-energy models",
    chem101Alignment: "heat, work, calorimetry, Hess's Law, bond enthalpy, phase energy",
    chem102Bridge: "energy accounting that supports spontaneity and electrochemistry",
    lessons: [
      "Energy, Heat, Work, and Conservation of Energy",
      "Calorimetry and Heat Capacity",
      "Enthalpy and Hess's Law",
      "Bond Enthalpies and Reaction Energy",
      "Heating Curves and Phase Change Energy",
      "AP Mixed Practice: Thermochemical Models and Calculations",
    ],
  },
  {
    id: "u7",
    title: "Unit 7 - Equilibrium",
    apAlignment: "dynamic equilibrium, Q and K, ICE calculations, disturbances",
    chem101Alignment: "equilibrium constants, reaction quotient, Le Chatelier reasoning, Ksp",
    chem102Bridge: "core Chem 102 equilibrium sequence",
    lessons: [
      "Dynamic Equilibrium and the Equilibrium Constant",
      "Reaction Quotient Q and Predicting Direction",
      "ICE Tables and Equilibrium Calculations",
      "Le Chatelier's Principle",
      "Solubility Equilibria and Ksp",
      "Coupled Equilibria and Common Ion Effects",
      "AP Mixed Practice: Equilibrium Reasoning",
    ],
  },
  {
    id: "u8",
    title: "Unit 8 - Acids and Bases",
    apAlignment: "acid-base equilibrium, buffers, titration curves, particle reasoning",
    chem101Alignment: "pH, strong and weak acids/bases, buffers, titrations",
    chem102Bridge: "core Chem 102 acid-base equilibrium sequence",
    lessons: [
      "Acid-Base Definitions and Strong vs Weak Acids/Bases",
      "pH, pOH, Kw, and Log Calculations",
      "Weak Acid/Base Equilibria",
      "Buffers and Henderson-Hasselbalch Reasoning",
      "Titration Curves and Indicators",
      "Polyprotic Acids and Acid-Base Systems",
      "AP Mixed Practice: Acid-Base Equilibrium and Titrations",
    ],
  },
  {
    id: "u9",
    title: "Unit 9 - Thermodynamics and Electrochemistry",
    apAlignment: "entropy, Gibbs free energy, redox, cells, electrolysis",
    chem101Alignment: "redox foundations with advanced free energy and electrochemistry bridge",
    chem102Bridge: "core Chem 102 thermodynamics and electrochemistry sequence",
    lessons: [
      "Entropy and Spontaneity",
      "Gibbs Free Energy",
      "Free Energy and Equilibrium",
      "Oxidation-Reduction and Balancing Redox",
      "Galvanic Cells and Cell Potential",
      "Electrolysis and Faraday's Law",
      "AP Mixed Practice: Thermodynamics and Electrochemistry",
    ],
  },
  {
    id: "u10",
    title: "Unit 10 - AP Chemistry Exam Skills and Final Review",
    apAlignment: "integrated science practices and exam-style reasoning",
    chem101Alignment: "cumulative final review with AP-ready explanations",
    chem102Bridge: "pulls Chem 102 equilibrium, acid-base, thermo, and electrochemistry into review",
    lessons: [
      "AP Chemistry Science Practices Overview",
      "Particle-Level Diagrams and Representations",
      "Experimental Design and Error Analysis",
      "FRQ Strategy: Justify, Calculate, Explain",
      "MCQ Strategy: Fast Reasoning Without Guessing Blindly",
      "Full AP-Style Mixed Review Set 1",
      "Full AP-Style Mixed Review Set 2",
      "Final Formula, Vocab, and Misconception Review",
    ],
  },
];

const formulaBank: Record<FormulaTopic, FormulaEntry[]> = {
  measurement: [
    {
      name: "Density",
      latex: "\\rho=\\frac{m}{V}",
      variables: "rho is density, m is mass, V is volume.",
      units: "g/mL, g/cm^3, or kg/m^3 depending on the measurement.",
      use: "Use when mass and volume describe the same substance sample.",
      trap: "Do not mix mL and L unless the units are converted first.",
    },
    {
      name: "Percent error",
      latex: "\\%\\,error=\\left|\\frac{measured-accepted}{accepted}\\right|\\times100\\%",
      variables: "measured is your value; accepted is the reference value.",
      units: "percent.",
      use: "Use when evaluating accuracy against a known value.",
      trap: "A small percent error does not prove precision; it only compares to the reference.",
    },
  ],
  moles: [
    {
      name: "Mass to moles",
      latex: "n=\\frac{m}{M}",
      variables: "n is moles, m is mass, M is molar mass.",
      units: "mol, g, g/mol.",
      use: "Use as the bridge between a measured mass and particle amount.",
      trap: "Molar mass belongs to one formula unit, not to a balanced equation coefficient by itself.",
    },
    {
      name: "Particles to moles",
      latex: "N=nN_A",
      variables: "N is particles, n is moles, N_A is Avogadro's constant.",
      units: "particles and mol.",
      use: "Use when the problem moves between counting particles and moles.",
      trap: "Atoms, molecules, and ions are different particle types; name which one you counted.",
    },
  ],
  atomic: [
    {
      name: "Weighted atomic mass",
      latex: "\\bar{m}=\\sum (fractional\\ abundance)(isotope\\ mass)",
      variables: "fractional abundance uses decimals; isotope mass is the mass of each isotope.",
      units: "amu.",
      use: "Use when isotope abundance data explain the periodic-table average.",
      trap: "Percent abundance must be divided by 100 before multiplying.",
    },
    {
      name: "Photon energy",
      latex: "E=h\\nu=\\frac{hc}{\\lambda}",
      variables: "E is energy, h is Planck's constant, nu is frequency, c is light speed, lambda is wavelength.",
      units: "J per photon, Hz, m.",
      use: "Use when light evidence connects wavelength to electron energy changes.",
      trap: "Convert nm to m before using c/lambda.",
    },
  ],
  bonding: [
    {
      name: "Formal charge",
      latex: "FC=valence-nonbonding-\\frac{bonding}{2}",
      variables: "valence is neutral-atom valence electrons; nonbonding are lone-pair electrons.",
      units: "charge units.",
      use: "Use to compare valid Lewis structures and resonance contributors.",
      trap: "Formal charge is electron bookkeeping, not measured partial charge.",
    },
    {
      name: "Coulombic attraction model",
      latex: "E\\propto\\frac{q_1q_2}{r}",
      variables: "q values are charges; r is distance between centers.",
      units: "relative energy or force trend.",
      use: "Use for ionic lattices, ionization energy, and bond-energy reasoning.",
      trap: "A larger charge or shorter distance strengthens attraction; do not treat size alone as the whole story.",
    },
  ],
  gases: [
    {
      name: "Ideal gas law",
      latex: "PV=nRT",
      variables: "P is pressure, V is volume, n is moles, R is the gas constant, T is kelvin temperature.",
      units: "atm, L, mol, L atm mol^-1 K^-1, K.",
      use: "Use for gas amount, pressure, volume, or temperature when gas behavior is close to ideal.",
      trap: "Temperature must be in kelvin.",
    },
    {
      name: "Combined gas law",
      latex: "\\frac{P_1V_1}{T_1}=\\frac{P_2V_2}{T_2}",
      variables: "Subscripts mark before and after states for the same gas amount.",
      units: "consistent pressure and volume units; kelvin temperature.",
      use: "Use when moles are constant and conditions change.",
      trap: "Do not use Celsius in the denominator.",
    },
  ],
  solutions: [
    {
      name: "Molarity",
      latex: "M=\\frac{n_{solute}}{V_{solution}}",
      variables: "M is molarity, n is moles of solute, V is total solution volume.",
      units: "mol/L.",
      use: "Use to connect solution concentration, amount, and volume.",
      trap: "Use final solution volume, not just solvent volume.",
    },
    {
      name: "Dilution",
      latex: "M_1V_1=M_2V_2",
      variables: "1 marks stock solution; 2 marks diluted solution.",
      units: "any matching volume unit with molarity.",
      use: "Use when dilution changes volume but conserves solute moles.",
      trap: "This does not apply when a reaction consumes solute.",
    },
  ],
  stoichiometry: [
    {
      name: "Mole ratio",
      latex: "mol\\ target=mol\\ given\\times\\frac{coefficient\\ target}{coefficient\\ given}",
      variables: "Coefficients come from the balanced equation.",
      units: "mol.",
      use: "Use after converting the given amount to moles.",
      trap: "The ratio must come from coefficients, not subscripts.",
    },
    {
      name: "Percent yield",
      latex: "\\%\\,yield=\\frac{actual\\ yield}{theoretical\\ yield}\\times100\\%",
      variables: "Actual yield is measured; theoretical yield is calculated from stoichiometry.",
      units: "percent.",
      use: "Use to evaluate reaction recovery or efficiency.",
      trap: "Percent yield above 100 usually signals wet product, impurity, or calculation error.",
    },
  ],
  kinetics: [
    {
      name: "Rate law",
      latex: "rate=k[A]^m[B]^n",
      variables: "k is rate constant; m and n are experimentally determined orders.",
      units: "rate units depend on total order.",
      use: "Use to relate concentration data to reaction rate.",
      trap: "Orders are not taken from balanced coefficients unless the step is known to be elementary.",
    },
    {
      name: "First-order half-life",
      latex: "t_{1/2}=\\frac{0.693}{k}",
      variables: "t1/2 is half-life; k is first-order rate constant.",
      units: "time.",
      use: "Use only for first-order processes.",
      trap: "Zero-order and second-order half-lives depend on concentration.",
    },
  ],
  thermochemistry: [
    {
      name: "Heat transfer",
      latex: "q=mc\\Delta T",
      variables: "q is heat, m is mass, c is specific heat, delta T is temperature change.",
      units: "J, g, J g^-1 C^-1, C.",
      use: "Use for a substance changing temperature without changing phase.",
      trap: "The sign of q depends on the system you choose.",
    },
    {
      name: "Hess's Law",
      latex: "\\Delta H_{rxn}=\\sum \\Delta H_{steps}",
      variables: "Each step enthalpy is scaled with the reaction step.",
      units: "kJ or kJ/mol reaction.",
      use: "Use when a target reaction can be built from known reactions.",
      trap: "Reverse a reaction, reverse the sign; multiply a reaction, multiply delta H.",
    },
  ],
  equilibrium: [
    {
      name: "Equilibrium expression",
      latex: "K=\\frac{[products]^{coefficients}}{[reactants]^{coefficients}}",
      variables: "Only aqueous and gas species appear in the expression.",
      units: "often treated as unitless in introductory work.",
      use: "Use for a system at equilibrium.",
      trap: "Pure solids and liquids are omitted.",
    },
    {
      name: "Reaction quotient",
      latex: "Q=\\frac{[products]^{coefficients}}{[reactants]^{coefficients}}",
      variables: "Same expression form as K, but for current concentrations.",
      units: "same convention as K.",
      use: "Use before equilibrium to predict shift direction.",
      trap: "Q less than K means products must increase as equilibrium is approached.",
    },
  ],
  "acid-base": [
    {
      name: "pH",
      latex: "pH=-\\log[H_3O^+]",
      variables: "Hydronium concentration is in molarity.",
      units: "pH is dimensionless.",
      use: "Use when hydronium concentration is known or can be found.",
      trap: "pH is logarithmic; a one-unit change means a tenfold concentration change.",
    },
    {
      name: "Henderson-Hasselbalch",
      latex: "pH=pK_a+\\log\\frac{[base]}{[acid]}",
      variables: "base is conjugate base; acid is weak acid.",
      units: "molarity ratio inside the log.",
      use: "Use for buffer systems after stoichiometric neutralization is handled.",
      trap: "Do not use it before strong acid/base reaction moles are updated.",
    },
  ],
  electrochemistry: [
    {
      name: "Cell potential",
      latex: "E^\\circ_{cell}=E^\\circ_{cathode}-E^\\circ_{anode}",
      variables: "Cathode is reduction; anode is oxidation.",
      units: "V.",
      use: "Use to predict voltage for a standard galvanic cell.",
      trap: "Do not multiply electrode potentials by coefficients.",
    },
    {
      name: "Free energy and cell voltage",
      latex: "\\Delta G^\\circ=-nFE^\\circ_{cell}",
      variables: "n is moles electrons; F is Faraday's constant.",
      units: "J/mol reaction.",
      use: "Use to connect spontaneity to electrical work.",
      trap: "Use joules if F is 96485 C/mol e-.",
    },
  ],
  "data-analysis": [
    {
      name: "Slope",
      latex: "slope=\\frac{\\Delta y}{\\Delta x}",
      variables: "Delta y is vertical change; delta x is horizontal change.",
      units: "y-unit per x-unit.",
      use: "Use to interpret linear graphs and rate plots.",
      trap: "Slope carries units and a sign.",
    },
    {
      name: "Percent composition",
      latex: "\\%\\ mass=\\frac{mass\\ part}{mass\\ whole}\\times100\\%",
      variables: "part and whole must describe the same sample.",
      units: "percent.",
      use: "Use for formula composition, mixture analysis, or lab recovery.",
      trap: "Mass percent is not mole percent unless masses and molar masses are considered.",
    },
  ],
};

const vocabDictionary: Record<string, VocabEntry> = {
  model: {
    definition: "a simplified representation that helps explain or predict chemical behavior",
    precision: "A model is useful when it connects to evidence and limits are stated.",
    example: "Particle drawings model gas pressure; a decorative sketch that ignores particles is not a chemistry model.",
  },
  measurement: {
    definition: "a quantity recorded with a number and a unit",
    precision: "The unit and measuring tool set the meaning of the number.",
    example: "25.0 mL is a measurement; 25 without units is incomplete.",
  },
  "dimensional analysis": {
    definition: "a unit-cancellation method for converting from one quantity to another",
    precision: "Every conversion factor must equal one relationship written as a ratio.",
    example: "1000 mL/1 L converts liters to milliliters; multiplying by an unrelated number is not dimensional analysis.",
  },
  uncertainty: {
    definition: "the expected range of doubt in a measured value",
    precision: "Uncertainty is not a mistake; it is part of honest measurement.",
    example: "A buret reading has limited precision; guessing extra digits hides uncertainty.",
  },
  density: {
    definition: "mass per unit volume",
    precision: "Density is an intensive property when temperature and composition are controlled.",
    example: "Aluminum density helps identify a metal; total mass alone does not.",
  },
  ion: {
    definition: "an atom or group of atoms with a net charge",
    precision: "Charge changes electron count, not proton count.",
    example: "Na+ has lost an electron; changing protons would make a different element.",
  },
  isotope: {
    definition: "atoms of the same element with different neutron counts",
    precision: "Isotopes share proton count but can have different mass and stability.",
    example: "Carbon-12 and carbon-14 are isotopes; carbon and nitrogen are not.",
  },
  "effective nuclear charge": {
    definition: "the net positive attraction felt by valence electrons",
    precision: "It depends on nuclear charge and shielding, not just atomic number.",
    example: "Across a period, stronger attraction helps shrink atomic radius.",
  },
  orbital: {
    definition: "a region of high probability for finding an electron",
    precision: "An orbital is a quantum model, not a fixed circular path.",
    example: "A 2p orbital describes probability shape; a tiny planet orbit picture is limited.",
  },
  "formal charge": {
    definition: "electron-bookkeeping charge assigned in a Lewis structure",
    precision: "It helps compare structures but is not the same as measured partial charge.",
    example: "Nitrate resonance structures place formal charge consistently across contributors.",
  },
  resonance: {
    definition: "a set of Lewis structures that together represent delocalized electrons",
    precision: "The molecule does not flip between drawings; the real structure is a hybrid.",
    example: "Ozone has resonance; two unrelated isomers are not resonance forms.",
  },
  polarity: {
    definition: "uneven electron distribution that creates a molecular dipole",
    precision: "Bond polarity and molecular shape both matter.",
    example: "Water is polar; linear carbon dioxide has polar bonds but no net dipole.",
  },
  "intermolecular force": {
    definition: "an attraction between particles rather than within a covalent bond",
    precision: "IMFs explain many physical properties without changing chemical identity.",
    example: "Hydrogen bonding raises water's boiling point; breaking O-H bonds would be a chemical change.",
  },
  molarity: {
    definition: "moles of solute per liter of solution",
    precision: "The volume is final solution volume, not solvent volume alone.",
    example: "0.250 M NaCl means 0.250 mol NaCl in each liter of solution.",
  },
  stoichiometry: {
    definition: "quantitative use of a balanced equation",
    precision: "The mole ratio comes from coefficients after the equation is balanced.",
    example: "2 mol H2 reacts with 1 mol O2; grams require molar mass conversions.",
  },
  "limiting reactant": {
    definition: "the reactant that runs out first and caps product amount",
    precision: "It is found by comparing possible product amounts, not by choosing the smaller mass.",
    example: "A small mass of a heavy reactant may still be excess.",
  },
  "net ionic equation": {
    definition: "an equation that shows only species that chemically change",
    precision: "Spectator ions are removed after soluble strong electrolytes are dissociated.",
    example: "Ag+ + Cl- -> AgCl(s) is net ionic for silver chloride precipitation.",
  },
  rate: {
    definition: "change in concentration over time",
    precision: "Rate can be positive for products and negative for reactants depending on convention.",
    example: "Disappearance of reactant A can be measured as -delta[A]/delta t.",
  },
  catalyst: {
    definition: "a substance that speeds a reaction by providing a lower-energy pathway",
    precision: "A catalyst is regenerated and does not change the equilibrium constant.",
    example: "MnO2 catalyzes peroxide decomposition; adding more reactant is not catalysis.",
  },
  enthalpy: {
    definition: "heat transfer at constant pressure for a chemical process",
    precision: "The sign depends on whether the system absorbs or releases heat.",
    example: "Combustion has negative delta H because the reaction releases heat.",
  },
  equilibrium: {
    definition: "a dynamic state where forward and reverse rates are equal",
    precision: "Equal rates do not require equal concentrations.",
    example: "A saturated solution can keep dissolving and crystallizing at equal rates.",
  },
  "reaction quotient": {
    definition: "a concentration ratio that predicts how a system will shift",
    precision: "Q has the same form as K but uses current conditions.",
    example: "If Q is less than K, product formation is favored as equilibrium is approached.",
  },
  buffer: {
    definition: "a solution that resists pH change through a weak acid/conjugate base pair",
    precision: "Buffers have capacity limits and work best near pKa.",
    example: "Acetic acid with acetate is a buffer; pure strong acid is not.",
  },
  entropy: {
    definition: "a thermodynamic measure related to energy dispersal and accessible microstates",
    precision: "Entropy is not simply messiness; particle count, phase, and temperature matter.",
    example: "Vaporization usually increases entropy because gas particles have more accessible arrangements.",
  },
  redox: {
    definition: "electron-transfer chemistry involving oxidation and reduction",
    precision: "Oxidation increases oxidation number; reduction decreases it.",
    example: "Zn becomes Zn2+ when it is oxidized in a galvanic cell.",
  },
  "galvanic cell": {
    definition: "an electrochemical cell that uses a spontaneous redox reaction to produce electrical work",
    precision: "Electrons flow through the wire from anode to cathode.",
    example: "A zinc-copper cell is galvanic when zinc is oxidized and copper ions are reduced.",
  },
};

function textNode(text: string): JSONContent {
  return { type: "text", text };
}

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: [textNode(text)] };
}

function heading(text: string, level = 2): JSONContent {
  return { type: "heading", attrs: { level }, content: [textNode(text)] };
}

function bulletList(items: string[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })),
  };
}

function orderedList(items: string[]): JSONContent {
  return {
    type: "orderedList",
    content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })),
  };
}

function lessonDoc(spec: ChemistryLessonSpec): JSONContent {
  const examples = buildWorkedExamples(spec);
  const formulas = getFormulaEntries(spec.formulaTopics);
  const dataPrompt = buildDataPrompt(spec);

  return {
    type: "doc",
    content: [
      heading(spec.title, 1),
      heading("Study Workspace Transparency"),
      paragraph(studentFacingTransparencyNote),
      heading("Human Review Status"),
      paragraph(humanReviewStatus),
      heading("Source Ledger"),
      paragraph(sourceLedgerSummary),
      heading("Why this matters"),
      paragraph(buildWhyThisMatters(spec)),
      heading("Learning objectives"),
      bulletList(buildLearningObjectives(spec)),
      heading("Prerequisites"),
      bulletList(buildPrerequisites(spec)),
      heading("Source Lesson"),
      ...buildSourceLessonParagraphs(spec).map(paragraph),
      heading("Quick Check"),
      bulletList(buildQuickChecks(spec)),
      heading("Worked Example Module"),
      orderedList(examples),
      heading("Practice Set"),
      orderedList(buildPracticeSet(spec)),
      heading("AP Extension"),
      paragraph(buildApExtension(spec)),
      bulletList(buildApTasks(spec)),
      heading("Vocab Sheet"),
      bulletList(buildVocabEntries(spec)),
      heading("Formula Sheet"),
      bulletList(formulas.map(formatFormulaEntry)),
      heading("Private Notes Prompts"),
      bulletList([
        `Explain ${spec.title.toLowerCase()} in your own words without copying the lesson phrasing.`,
        `Mistake I might make: name the exact step where confusion could enter for ${spec.relatedConcepts[0]}.`,
        "One question I still have: write it as a question that could be answered by data, a particle model, or a calculation.",
        `AP reasoning note: connect ${spec.conceptTags[0]} to evidence, units, or a particle-level representation.`,
      ]),
      heading("Whiteboard / Canvas Prompt"),
      paragraph(buildWhiteboardPrompt(spec)),
      heading("Data / Lab Notebook Prompt"),
      paragraph(dataPrompt.prompt),
      bulletList(dataPrompt.tasks),
      heading("Misconceptions"),
      bulletList(buildMisconceptions(spec)),
      heading("Spaced Review Cards"),
      bulletList(buildReviewCards(spec)),
      heading("Related Concept Links"),
      bulletList(spec.relatedConcepts.map((concept) => `${concept} - revisit this when ${buildRelatedConceptReason(spec, concept)}.`)),
      heading("Mastery Checklist"),
      bulletList(buildMasteryChecklist(spec)),
      heading("Copyright Hygiene Check"),
      paragraph(copyrightHygieneChecklist),
    ],
  };
}

function buildLessonSpecs() {
  let order = 1;
  return chemistryUnits.flatMap((unit) =>
    unit.lessons.map((title, index) => {
      const category = inferCategory(unit.id, title);
      const presetId = inferPreset(unit.id, title, category);
      const formulaTopics = inferFormulaTopics(title, category);
      const vocabTerms = inferVocabTerms(title, category);
      const moduleIds = moduleIdsForPreset(presetId);
      const id = `lesson-chem-${unit.id}-${slugify(title)}`;
      const conceptTags = buildConceptTags(unit.id, title, category);
      const spec: ChemistryLessonSpec = {
        id,
        unitId: unit.id,
        unitTitle: unit.title,
        title,
        order: order,
        unitOrder: index + 1,
        category,
        presetId,
        formulaTopics,
        vocabTerms,
        moduleIds,
        conceptTags,
        alignmentTags: [
          `Chem 101: ${unit.chem101Alignment}`,
          `AP Chemistry: ${unit.apAlignment}`,
          ...(unit.chem102Bridge ? [`Chem 102 bridge: ${unit.chem102Bridge}`] : []),
        ],
        relatedConcepts: buildRelatedConcepts(unit, title, category),
        difficulty: inferDifficulty(unit.id, title),
      };
      order += 1;
      return spec;
    }),
  );
}

const lessonSpecs = buildLessonSpecs();

export const CHEMISTRY_SHOWCASE_LESSON_IDS = lessonSpecs.map((lesson) => lesson.id);
export const CHEMISTRY_COURSE_LESSON_IDS = CHEMISTRY_SHOWCASE_LESSON_IDS;

export const chemistryShowcaseFolder: Folder = {
  id: CHEMISTRY_SHOWCASE_FOLDER_ID,
  owner_id: ownerId,
  name: "Chemistry",
  color: "emerald",
  source: "system",
  suite_template_id: null,
  sort_order: 40,
  created_at: now,
  updated_at: now,
};

export const chemistryShowcaseBinder: Binder = {
  id: CHEMISTRY_SHOWCASE_BINDER_ID,
  owner_id: ownerId,
  suite_template_id: null,
  title: "Chemistry 101 + AP Chemistry",
  slug: "chemistry-101-ap-chemistry",
  description:
    "An interactive study binder workspace for Chemistry 101, AP Chemistry, and Chem 102 bridge review, with original lessons, formulas, vocab, practice, lab/data prompts, AP reasoning, chemistry workspace modules, source-ledger transparency, and human-review status.",
  subject: "Chemistry",
  level: "Chem 101 Core + AP Chemistry + Chem 102 bridges",
  status: "published",
  price_cents: 0,
  cover_url: null,
  pinned: true,
  dashboard_sort_order: 40,
  created_at: now,
  updated_at: now,
};

export const chemistryShowcaseFolderLink: FolderBinderLink = {
  id: "folder-link-chemistry-101-ap-chemistry",
  owner_id: ownerId,
  folder_id: chemistryShowcaseFolder.id,
  binder_id: chemistryShowcaseBinder.id,
  sort_order: 1,
  created_at: now,
  updated_at: now,
};

export const chemistryShowcaseLessons: BinderLesson[] = lessonSpecs.map((lesson) => ({
  id: lesson.id,
  binder_id: chemistryShowcaseBinder.id,
  title: lesson.title,
  order_index: lesson.order,
  is_preview: lesson.order <= 7,
  content: lessonDoc(lesson),
  math_blocks: buildMathBlocks(lesson),
  created_at: now,
  updated_at: now,
}));

export const chemistryShowcaseLessonMetadata: ChemistryShowcaseLessonMetadata[] = lessonSpecs.map((lesson) => ({
  lessonId: lesson.id,
  unitId: lesson.unitId,
  unitTitle: lesson.unitTitle,
  unitOrder: lesson.unitOrder,
  presetId: lesson.presetId,
  difficulty: lesson.difficulty,
  conceptTags: lesson.conceptTags,
  alignmentTags: lesson.alignmentTags,
  moduleIds: lesson.moduleIds,
  relatedConcepts: lesson.relatedConcepts,
}));

export const chemistryCourseFolder = chemistryShowcaseFolder;
export const chemistryCourseBinder = chemistryShowcaseBinder;
export const chemistryCourseFolderLink = chemistryShowcaseFolderLink;
export const chemistryCourseLessons = chemistryShowcaseLessons;
export const chemistryCourseLessonMetadata = chemistryShowcaseLessonMetadata;

export function getChemistryShowcasePresetForLesson(lessonId: string): WorkspacePresetId {
  return chemistryShowcaseLessonMetadata.find((metadata) => metadata.lessonId === lessonId)?.presetId ?? "chem-guided-study";
}

export const getChemistryCoursePresetForLesson = getChemistryShowcasePresetForLesson;

function inferCategory(unitId: string, title: string): LessonCategory {
  const lower = title.toLowerCase();
  if (unitId === "u10") return "ap-review";
  if (unitId === "u0") return "measurement";
  if (unitId === "u1") return "atomic";
  if (unitId === "u2") return "bonding";
  if (unitId === "u3") return "imf-gases-solutions";
  if (unitId === "u4") return lower.includes("stoichiometry") || lower.includes("limiting") ? "stoichiometry" : "reactions";
  if (unitId === "u5") return "kinetics";
  if (unitId === "u6") return "thermochemistry";
  if (unitId === "u7") return "equilibrium";
  if (unitId === "u8") return "acid-base";
  if (unitId === "u9") return lower.includes("redox") || lower.includes("cell") || lower.includes("electro") ? "electrochemistry" : "thermochemistry";
  return "measurement";
}

function inferPreset(unitId: string, title: string, category: LessonCategory): WorkspacePresetId {
  const lower = title.toLowerCase();
  if (lower.includes("lab safety") || lower.includes("data lab") || lower.includes("experimental design")) return "chemistry-lab";
  if (category === "atomic") return "chem-element-explorer";
  if (category === "bonding") return "chem-bonding-studio";
  if (category === "reactions") return lower.includes("titration") ? "chem-acid-base-titration-lab" : "chem-reaction-studio";
  if (category === "stoichiometry") return "chem-stoichiometry-lab";
  if (category === "kinetics") return "chem-kinetics-graph-lab";
  if (category === "thermochemistry") return "chem-thermochemistry-studio";
  if (category === "acid-base") return "chem-acid-base-titration-lab";
  if (category === "equilibrium" || category === "electrochemistry") return "chem-full-studio";
  if (category === "imf-gases-solutions") {
    return lower.includes("solution") || lower.includes("solubility") || lower.includes("separation")
      ? "chem-solutions-molarity-lab"
      : "chem-guided-study";
  }
  if (unitId === "u10") return lower.includes("review set") || lower.includes("final") ? "chem-full-studio" : "chem-guided-study";
  return "chem-guided-study";
}

function inferFormulaTopics(title: string, category: LessonCategory): FormulaTopic[] {
  const lower = title.toLowerCase();
  const topics = new Set<FormulaTopic>();

  if (category === "measurement") topics.add("measurement").add("data-analysis");
  if (category === "atomic") topics.add("atomic").add("moles");
  if (category === "bonding") topics.add("bonding");
  if (category === "imf-gases-solutions") {
    if (lower.includes("gas")) topics.add("gases").add("stoichiometry");
    if (lower.includes("solution") || lower.includes("molarity") || lower.includes("dilution") || lower.includes("solubility")) topics.add("solutions");
    topics.add("data-analysis");
  }
  if (category === "reactions") topics.add("stoichiometry").add("solutions");
  if (category === "stoichiometry") topics.add("stoichiometry").add("moles");
  if (category === "kinetics") topics.add("kinetics").add("data-analysis");
  if (category === "thermochemistry") topics.add("thermochemistry").add("data-analysis");
  if (category === "equilibrium") topics.add("equilibrium").add("solutions");
  if (category === "acid-base") topics.add("acid-base").add("equilibrium");
  if (category === "electrochemistry") topics.add("electrochemistry").add("thermochemistry");
  if (category === "ap-review") topics.add("data-analysis").add("stoichiometry").add("equilibrium");

  return [...topics].slice(0, 3);
}

function inferVocabTerms(title: string, category: LessonCategory): string[] {
  const base: Record<LessonCategory, string[]> = {
    measurement: ["model", "measurement", "dimensional analysis", "uncertainty", "density"],
    atomic: ["isotope", "ion", "orbital", "effective nuclear charge", "measurement"],
    bonding: ["formal charge", "resonance", "polarity", "ion", "model"],
    "imf-gases-solutions": ["intermolecular force", "molarity", "measurement", "model", "density"],
    reactions: ["net ionic equation", "ion", "stoichiometry", "model", "measurement"],
    stoichiometry: ["stoichiometry", "limiting reactant", "molarity", "measurement", "dimensional analysis"],
    kinetics: ["rate", "catalyst", "measurement", "model", "uncertainty"],
    thermochemistry: ["enthalpy", "measurement", "model", "uncertainty", "density"],
    equilibrium: ["equilibrium", "reaction quotient", "molarity", "model", "uncertainty"],
    "acid-base": ["buffer", "molarity", "equilibrium", "reaction quotient", "measurement"],
    electrochemistry: ["redox", "galvanic cell", "entropy", "measurement", "model"],
    "ap-review": ["model", "measurement", "uncertainty", "stoichiometry", "equilibrium"],
  };
  const titleTerms = title
    .split(/[^A-Za-z0-9+-]+/)
    .filter((term) => term.length > 4)
    .slice(0, 2)
    .map((term) => term.toLowerCase());

  return unique([...base[category], ...titleTerms]).slice(0, 7);
}

function moduleIdsForPreset(presetId: WorkspacePresetId): WorkspaceModuleId[] {
  const base: WorkspaceModuleId[] = ["lesson", "private-notes", "formula-sheet", "flashcards", "whiteboard", "related-concepts"];
  const extras: Partial<Record<WorkspacePresetId, WorkspaceModuleId[]>> = {
    "chem-guided-study": ["chem-concept-cards", "chem-quick-tools", "scientific-calculator"],
    "chem-element-explorer": ["chem-periodic-table", "chem-element-builder", "chem-electron-config-builder", "chem-periodic-trends-graph"],
    "chem-bonding-studio": ["chem-molecule-builder", "chem-geometry-viewer", "chem-concept-cards"],
    "chem-reaction-studio": ["chem-reaction-balancer", "chem-tri-reaction-view", "chem-stoichiometry-coach"],
    "chem-stoichiometry-lab": ["chem-stoichiometry-coach", "chem-molar-mass-calculator", "chem-reaction-balancer", "scientific-calculator"],
    "chem-solutions-molarity-lab": ["chem-solution-mixer", "chem-molarity-calculator", "chem-desmos-concentration-graph", "chem-lab-notebook"],
    "chem-acid-base-titration-lab": ["chem-titration-lab", "chem-ph-calculator", "chem-desmos-titration-curve", "chem-lab-notebook"],
    "chem-kinetics-graph-lab": ["chem-kinetics-simulator", "chem-desmos-kinetics-plot", "chem-data-table"],
    "chem-thermochemistry-studio": ["chem-calorimetry-lab", "chem-energy-diagram", "chem-calculation-sheet", "chem-lab-notebook"],
    "chem-full-studio": ["chem-periodic-table", "chem-reaction-balancer", "chem-stoichiometry-coach", "chem-lab-notebook", "chem-review-queue"],
    "chemistry-lab": ["chem-titration-lab", "chem-lab-notebook", "chem-reference-safety", "chem-stoichiometry-coach"],
  };

  return unique([...base, ...(extras[presetId] ?? [])]);
}

function buildConceptTags(unitId: string, title: string, category: LessonCategory): string[] {
  return unique([
    `chem-${unitId}`,
    category,
    ...title
      .toLowerCase()
      .replace(/ap mixed practice|ap chemistry|frq|mcq/g, "")
      .split(/[^a-z0-9]+/)
      .filter((part) => part.length > 3)
      .slice(0, 4),
  ]).slice(0, 6);
}

function buildRelatedConcepts(unit: ChemistryUnitSpec, title: string, category: LessonCategory): string[] {
  const common = ["units and evidence", "particle-level models", "claim-evidence-reasoning"];
  const byCategory: Record<LessonCategory, string[]> = {
    measurement: ["significant figures", "graphing data", "lab safety"],
    atomic: ["periodic trends", "electron configuration", "mole concept"],
    bonding: ["Lewis structures", "Coulombic attraction", "molecular polarity"],
    "imf-gases-solutions": ["intermolecular forces", "gas laws", "solution concentration"],
    reactions: ["balancing equations", "net ionic equations", "reaction evidence"],
    stoichiometry: ["mole ratios", "limiting reactants", "percent yield"],
    kinetics: ["rate laws", "linearized graphs", "mechanisms"],
    thermochemistry: ["calorimetry", "enthalpy", "energy diagrams"],
    equilibrium: ["Q versus K", "ICE tables", "Le Chatelier reasoning"],
    "acid-base": ["pH", "weak acid equilibrium", "titration curves"],
    electrochemistry: ["redox", "cell potential", "free energy"],
    "ap-review": ["AP justification", "mixed representation", "error analysis"],
  };

  return unique([unit.title.replace(/^Unit \d+ - /, ""), title, ...byCategory[category], ...common]).slice(0, 8);
}

function inferDifficulty(unitId: string, title: string): ChemistryLessonSpec["difficulty"] {
  if (title.includes("AP Mixed") || title.includes("Full AP") || title.includes("FRQ") || title.includes("MCQ")) return "challenge";
  if (unitId === "u0" || title.includes("Basics") || title.includes("Overview")) return "intro";
  return "core";
}

function buildWhyThisMatters(spec: ChemistryLessonSpec): string {
  return `${spec.title} matters because chemistry rewards students who can move among evidence, particles, symbols, and numbers without treating them as separate courses. In this lesson, the Chem 101 path builds the core idea clearly, while the AP layer asks you to justify the idea with data, a model, or a calculation. The Chem 102 bridge appears when the topic becomes a foundation for equilibrium, kinetics, thermodynamics, or electrochemistry.`;
}

function buildLearningObjectives(spec: ChemistryLessonSpec): string[] {
  return [
    `Explain the central idea of ${spec.title} using precise chemistry vocabulary.`,
    `Use units, particle-level reasoning, or a model to support a claim about ${spec.relatedConcepts[1]}.`,
    `Choose and apply the relevant formula or relationship from the lesson Formula Sheet.`,
    `Interpret one original data pattern or lab observation connected to ${spec.relatedConcepts[2]}.`,
    `Answer an AP-style reasoning prompt with a clear claim, evidence, and chemistry explanation.`,
  ];
}

function buildPrerequisites(spec: ChemistryLessonSpec): string[] {
  const shared = ["Comfort converting units and checking that units cancel.", "Willingness to draw particles before jumping into algebra."];
  const categorySpecific: Record<LessonCategory, string[]> = {
    measurement: ["Basic calculator notation and percent calculations."],
    atomic: ["Protons define element identity; electrons define charge and many properties."],
    bonding: ["Valence electrons and simple ion charges."],
    "imf-gases-solutions": ["Balanced formulas, moles, and particle spacing ideas."],
    reactions: ["Chemical formulas, common ions, and conservation of atoms."],
    stoichiometry: ["Balanced equations, molar mass, and dimensional analysis."],
    kinetics: ["Graph slope, concentration units, and collision model language."],
    thermochemistry: ["Temperature change, system versus surroundings, and unit conversions."],
    equilibrium: ["Balanced equations, molarity, and reversible reaction notation."],
    "acid-base": ["Equilibrium language, logarithms, and strong electrolyte behavior."],
    electrochemistry: ["Oxidation numbers, redox half-reactions, and energy sign conventions."],
    "ap-review": ["Core Chem 101 vocabulary and comfort explaining calculations in words."],
  };

  return [...shared, ...categorySpecific[spec.category]];
}

function buildSourceLessonParagraphs(spec: ChemistryLessonSpec): string[] {
  const intro = `Start ${spec.title} by naming the system, the scale, and the evidence. The system is the part of the chemical world you are explaining. The scale might be macroscopic observations, particle-level motion, symbolic equations, or mathematical relationships. Evidence is what keeps the explanation honest: measurements, graphs, consistent particle counts, charge balance, or a repeatable observation.`;
  const categoryParagraphs: Record<LessonCategory, string[]> = {
    measurement: [
      "Chemistry measurements are not just numbers. A unit tells what was measured, a tool tells how carefully it was measured, and significant figures communicate how much precision is justified. A strong setup writes the given quantity, the target quantity, and each conversion factor before arithmetic begins.",
      "At the particle level, measurement connects invisible particles to observable amounts. Mass, volume, density, and percent composition help students infer identity, purity, or composition without pretending the instrument is perfect.",
    ],
    atomic: [
      "Atomic structure begins with identity. Protons name the element, neutrons distinguish isotopes, and electrons determine charge and many chemical patterns. The periodic table is therefore not a decoration; it is a compressed argument about structure.",
      "Evidence for atoms and shells comes from measurements such as mass spectra, emission lines, and photoelectron patterns. AP Chemistry questions often ask why a pattern is reasonable, so the answer should mention attraction, shielding, energy level, or electron count.",
    ],
    bonding: [
      "Bonding models explain why atoms stay together and why compounds have specific shapes and properties. Ionic bonding emphasizes attraction between charged particles, while covalent bonding emphasizes shared electron density. Real substances can sit between those extremes.",
      "Lewis structures are not art projects. They conserve valence electrons, show connectivity, and set up predictions about formal charge, resonance, molecular geometry, and polarity. The drawing is useful only when it explains an observable property.",
    ],
    "imf-gases-solutions": [
      "Matter properties come from particle attractions and motion. Intermolecular forces explain why substances boil, melt, dissolve, or separate differently. Gas behavior emphasizes particle spacing and collisions, while solutions emphasize particles dispersed through a solvent.",
      "For AP work, move between a graph, a particle drawing, and a formula. A pressure-volume graph, dilution calculation, or solubility observation should all tell the same story about particles and energy.",
    ],
    reactions: [
      "A chemical reaction rearranges atoms and electrons. Balanced equations protect atom conservation, net ionic equations focus on the species that change, and reaction evidence ties the symbolic equation back to observation.",
      "Strong reaction reasoning keeps coefficients and subscripts separate. Coefficients count particles in the reaction ratio. Subscripts define the identity of each formula unit and cannot be changed to make the equation balance.",
    ],
    stoichiometry: [
      "Stoichiometry is dimensional analysis with a balanced equation in the middle. The safest path is given amount to moles, moles through the coefficient ratio, then moles to the requested amount.",
      "The particle story is simple but powerful: a balanced equation says how many particles react together. Moles scale that particle ratio to lab-sized amounts without changing the ratio.",
    ],
    kinetics: [
      "Kinetics asks how fast reactions happen and what pathway particles follow. Rate data are experimental; students infer orders and mechanisms from evidence instead of reading them directly from the balanced equation.",
      "Graphs matter because concentration changes are not always linear. A transformed plot that becomes linear can reveal order, rate constant, or half-life behavior. AP reasoning should state why the graph form supports the claim.",
    ],
    thermochemistry: [
      "Thermochemistry tracks energy transfer. The system is the reaction or process being studied, while surroundings include the water, calorimeter, or room that exchanges energy with the system.",
      "Calculations such as q = mc delta T are strongest when paired with a sign convention and particle explanation. Energy is conserved, but it can move between thermal motion, bond potential energy, and surroundings.",
    ],
    equilibrium: [
      "Equilibrium is dynamic, not frozen. Forward and reverse reactions continue at equal rates, so concentrations stay constant even though particle-level events continue.",
      "Q and K are comparison tools. Q describes current conditions, K describes equilibrium conditions, and the comparison predicts which direction the system must proceed to reach equilibrium.",
    ],
    "acid-base": [
      "Acid-base chemistry combines particle transfer with equilibrium. Strong acids and bases ionize essentially completely in water, while weak acids and bases require equilibrium reasoning.",
      "pH is a logarithmic concentration scale. Students should connect every pH calculation to particle counts: hydronium or hydroxide concentration changes by powers of ten, not by simple addition.",
    ],
    electrochemistry: [
      "Electrochemistry tracks electron transfer and energy. Oxidation loses electrons at the anode, reduction gains electrons at the cathode, and a galvanic cell separates those half-reactions so electron flow can do work.",
      "Thermodynamics and electrochemistry meet through free energy. A positive cell voltage corresponds to a spontaneous galvanic reaction under the stated conditions, while electrolysis uses outside energy to drive a nonspontaneous process.",
    ],
    "ap-review": [
      "AP review is not memorizing a longer list. It is practicing fast movement among representation, calculation, and justification. A strong answer names the chemical principle, uses evidence, and then explains the consequence.",
      "For mixed review, read the command first. Calculate means show the numeric setup; justify means explain why evidence supports a claim; explain means connect a model or principle to the observed result.",
    ],
  };
  const bridge = spec.alignmentTags.some((tag) => tag.includes("Chem 102 bridge"))
    ? "This lesson also builds a Chem 102 bridge: later topics will reuse the same logic with deeper equilibrium, thermodynamic, or electrochemical systems."
    : "The AP layer extends the Chem 101 idea by asking for a clearer model, stronger evidence, or a more careful calculation.";

  return [intro, ...categoryParagraphs[spec.category], bridge];
}

function buildQuickChecks(spec: ChemistryLessonSpec): string[] {
  return [
    `Conceptual: What is the main chemical claim in ${spec.title}, and what evidence would support it?`,
    `Conceptual: Which particle-level feature matters most here: charge, spacing, attraction, energy, or collisions? Explain briefly.`,
    `Conceptual: Name one condition where the simple model for ${spec.relatedConcepts[1]} would need a limit or correction.`,
    `Calculation/representation: Choose one Formula Sheet relationship and identify the knowns, unknown, and units before solving.`,
    `Calculation/representation: Sketch or describe a particle diagram that would make the lesson claim visible.`,
  ];
}

function buildWorkedExamples(spec: ChemistryLessonSpec): string[] {
  switch (spec.category) {
    case "atomic":
      return [
        "Isotope average. Setup: an element is 75.0% isotope A at 34.97 amu and 25.0% isotope B at 36.97 amu. Convert percents to decimals: 0.750 and 0.250. Calculation: (0.750)(34.97) + (0.250)(36.97) = 35.47 amu. Final answer: average atomic mass is 35.47 amu. Common mistake: using 75 and 25 instead of 0.750 and 0.250.",
        "Light energy. Setup: a photon has wavelength 486 nm. Convert to meters: 486 nm = 4.86 x 10^-7 m. Use E = hc/lambda. Calculation: E = (6.626 x 10^-34 J s)(3.00 x 10^8 m/s)/(4.86 x 10^-7 m) = 4.09 x 10^-19 J. Final answer: 4.09 x 10^-19 J per photon. Common mistake: leaving wavelength in nm.",
      ];
    case "bonding":
      return [
        "Formal charge. Setup: oxygen in hydroxide has 6 valence electrons, 6 nonbonding electrons, and 2 bonding electrons. Calculation: FC = 6 - 6 - 2/2 = -1. Final answer: oxygen has formal charge -1. Common mistake: subtracting both bonding electrons instead of half.",
        "Polarity reasoning. Setup: CO2 has two polar C=O bonds arranged linear and opposite. The bond dipoles cancel because the molecule is symmetric. Final answer: CO2 is nonpolar even though each C=O bond is polar. Common mistake: deciding polarity from bond polarity alone without shape.",
      ];
    case "imf-gases-solutions":
      return [
        "Ideal gas law. Setup: a gas sample has P = 1.04 atm, V = 2.50 L, and T = 298 K. Use PV = nRT with R = 0.08206 L atm mol^-1 K^-1. Calculation: n = (1.04)(2.50)/((0.08206)(298)) = 0.106 mol. Final answer: 0.106 mol gas. Common mistake: using Celsius instead of kelvin.",
        "Dilution. Setup: prepare 250.0 mL of 0.120 M solution from 1.50 M stock. Use M1V1 = M2V2. Calculation: V1 = (0.120 M)(250.0 mL)/(1.50 M) = 20.0 mL. Final answer: measure 20.0 mL stock and dilute to 250.0 mL. Common mistake: adding 250.0 mL water instead of diluting to a final volume.",
      ];
    case "reactions":
    case "stoichiometry":
      return [
        "Mole bridge. Setup: 5.40 g Al reacts by 2Al + 3Cl2 -> 2AlCl3. Convert Al to moles: 5.40 g / 26.98 g/mol = 0.200 mol Al. Mole ratio AlCl3 to Al is 2:2, so product is 0.200 mol AlCl3. Mass: 0.200 mol x 133.34 g/mol = 26.7 g. Final answer: 26.7 g AlCl3. Common mistake: using a 3:2 ratio from chlorine instead of the Al to AlCl3 ratio.",
        "Limiting reactant. Setup: 0.50 mol H2 reacts with 0.40 mol Cl2 in H2 + Cl2 -> 2HCl. The ratio is 1:1, so 0.40 mol Cl2 runs out first. Product: 0.40 mol Cl2 x 2 mol HCl / 1 mol Cl2 = 0.80 mol HCl. Final answer: Cl2 limits and 0.80 mol HCl can form. Common mistake: picking the smaller-looking number without comparing ratios.",
      ];
    case "kinetics":
      return [
        "Rate law calculation. Setup: rate = k[A]^2, k = 0.120 M^-1 s^-1, [A] = 0.300 M. Calculation: rate = (0.120)(0.300)^2 = 0.0108 M/s. Final answer: 1.08 x 10^-2 M/s. Common mistake: dropping the squared concentration unit.",
        "Half-life. Setup: a first-order reaction has k = 0.0230 s^-1. Use t1/2 = 0.693/k. Calculation: 0.693/0.0230 = 30.1 s. Final answer: half-life is 30.1 s. Common mistake: using this formula for a zero-order or second-order reaction.",
      ];
    case "thermochemistry":
      return [
        "Calorimetry. Setup: 50.0 g water warms from 22.0 C to 28.3 C. Use q = mc delta T with c = 4.184 J g^-1 C^-1. Calculation: q = (50.0)(4.184)(6.3) = 1.32 x 10^3 J. Final answer: water gained 1.32 kJ. Common mistake: assigning the same sign to the reacting system without deciding what the system is.",
        "Hess reasoning. Setup: if step 1 releases 92 kJ and step 2 absorbs 35 kJ after both are scaled correctly, delta Hrxn = -92 kJ + 35 kJ = -57 kJ. Final answer: the target reaction is exothermic by 57 kJ. Common mistake: forgetting to change the sign when reversing a step.",
      ];
    case "equilibrium":
      return [
        "Equilibrium constant. Setup: N2O4(g) <=> 2NO2(g), [NO2] = 0.040 M and [N2O4] = 0.020 M at equilibrium. Kc = [NO2]^2/[N2O4]. Calculation: (0.040)^2/0.020 = 0.080. Final answer: Kc = 0.080. Common mistake: forgetting the exponent from the coefficient 2.",
        "Q versus K. Setup: for a reaction, Q = 0.20 and K = 5.0. Since Q is less than K, the mixture has too little product relative to equilibrium. Final answer: reaction proceeds forward to form more products. Common mistake: saying low Q means reactants are favored instead of comparing to K.",
      ];
    case "acid-base":
      return [
        "Strong acid pH. Setup: 0.0025 M HCl ionizes completely, so [H3O+] = 0.0025 M. Calculation: pH = -log(0.0025) = 2.60. Final answer: pH = 2.60. Common mistake: treating a strong acid as concentrated just because it ionizes completely.",
        "Buffer pH. Setup: a buffer has pKa = 4.74, [base] = 0.150 M, and [acid] = 0.100 M. Calculation: pH = 4.74 + log(0.150/0.100) = 4.92. Final answer: pH = 4.92. Common mistake: using Henderson-Hasselbalch before neutralization stoichiometry when strong acid or base was added.",
      ];
    case "electrochemistry":
      return [
        "Cell voltage. Setup: Cu2+/Cu has E = +0.34 V and Zn2+/Zn has E = -0.76 V. Zinc is oxidized at the anode and copper is reduced at the cathode. Calculation: Ecell = 0.34 - (-0.76) = 1.10 V. Final answer: 1.10 V. Common mistake: multiplying voltages by coefficients.",
        "Free energy. Setup: n = 2 mol e-, F = 96485 C/mol e-, and Ecell = 1.10 V. Calculation: delta G = -nFE = -(2)(96485)(1.10) = -2.12 x 10^5 J. Final answer: delta G = -212 kJ per reaction as written. Common mistake: mixing joules and kilojoules.",
      ];
    case "ap-review":
      return [
        "Justification structure. Setup: a prompt asks why a lower temperature changes gas pressure in a rigid container. Claim: pressure decreases. Evidence: particle kinetic energy decreases when kelvin temperature decreases. Reasoning: slower particles collide with the walls less forcefully, so pressure falls. Common mistake: saying particles shrink or disappear.",
        "Mixed calculation. Setup: 25.00 mL of 0.100 M NaOH neutralizes 20.00 mL acid. Moles base = (0.100)(0.02500) = 0.00250 mol. For monoprotic acid, moles acid = 0.00250 mol. Acid molarity = 0.00250/0.02000 = 0.125 M. Common mistake: using mL directly without converting to L or relying on matching mL units without understanding moles.",
      ];
    case "measurement":
    default:
      return [
        "Density. Setup: a metal piece has mass 18.60 g and volume 6.20 mL. Use density = mass/volume. Calculation: 18.60 g / 6.20 mL = 3.00 g/mL. Final answer: density is 3.00 g/mL. Common mistake: reporting 3 g/mL when the measured values justify three significant figures.",
        "Percent error. Setup: measured density is 3.00 g/mL and accepted density is 2.95 g/mL. Calculation: |3.00 - 2.95| / 2.95 x 100% = 1.69%. Final answer: percent error is 1.69%. Common mistake: using percent error to claim precision without checking repeated trials.",
      ];
  }
}

function buildPracticeSet(spec: ChemistryLessonSpec): string[] {
  return [
    `Easy concept: Define ${spec.vocabTerms[0]} in one sentence, then give one non-example. Answer: a correct response uses the precision note from the Vocab Sheet and avoids vague everyday wording.`,
    `Easy model: Identify whether ${spec.title} is mainly about particles, energy, charge, collisions, or measurement. Answer: ${categoryModelAnswer(spec.category)}.`,
    `Medium calculation: Pick the first Formula Sheet relationship and write a unit-canceling setup for a new value of your choice. Answer: the setup is correct only if every unwanted unit cancels before arithmetic.`,
    `Medium representation: Draw three particles or symbols that show the before-and-after state for this topic. Answer: the drawing should conserve atoms, charge, or particle identity according to the lesson model.`,
    `Medium misconception: A student says the formula gives the answer, so no explanation is needed. Answer: disagree; AP and Chem 101 reasoning require the formula to be tied to the particle model or measured evidence.`,
    `Data task: Use the Data / Lab Notebook Prompt table and describe the trend in one claim. Answer: the claim should include direction, units, and one chemistry reason rather than only copying numbers.`,
    `Hard transfer: Connect ${spec.relatedConcepts[1]} to ${spec.relatedConcepts[2]} in two steps. Answer: a strong response names the shared variable, particle behavior, or conservation rule.`,
    `Hard error analysis: Name one instrument or assumption that could shift the result in this lesson. Answer: acceptable errors change the measured or inferred quantity and explain the direction of the effect.`,
    `AP-style reasoning: Write a claim-evidence-reasoning paragraph using ${spec.conceptTags[1]}. Answer: one point for a clear claim, one for relevant evidence, and one for reasoning that uses chemistry rather than restating the claim.`,
    `Cumulative review: Link this lesson back to dimensional analysis. Answer: even qualitative topics rely on units, ratios, or conserved counts when evidence becomes quantitative.`,
  ];
}

function categoryModelAnswer(category: LessonCategory) {
  const answers: Record<LessonCategory, string> = {
    measurement: "measurement and uncertainty are central, with particles used to interpret what the measurement means",
    atomic: "charge, electron energy, and evidence for shells are central",
    bonding: "charge attraction, valence electrons, and molecular shape are central",
    "imf-gases-solutions": "particle spacing, attractions, and concentration are central",
    reactions: "atom conservation and species change are central",
    stoichiometry: "conserved particle ratios scaled by moles are central",
    kinetics: "collisions, concentration, and pathway evidence are central",
    thermochemistry: "energy transfer between system and surroundings is central",
    equilibrium: "forward and reverse processes plus concentration ratios are central",
    "acid-base": "proton transfer, water equilibrium, and conjugate pairs are central",
    electrochemistry: "electron transfer and electrical work are central",
    "ap-review": "representation choice and justification are central",
  };

  return answers[category];
}

function buildApExtension(spec: ChemistryLessonSpec): string {
  return `AP extension: use ${spec.title.toLowerCase()} as a reasoning layer, not just a fact list. The AP version of this lesson asks you to choose a representation, defend the choice with evidence, and explain why the chemistry model predicts the observation. Use original practice prompts here; do not rely on memorized exam wording.`;
}

function buildApTasks(spec: ChemistryLessonSpec): string[] {
  return [
    `Particle task: create a before/after particulate model for ${spec.relatedConcepts[1]} and label the conserved quantity.`,
    `Data task: decide whether a graph, table, or calculation would best justify a claim about ${spec.relatedConcepts[2]}.`,
    `Justification task: write two sentences that use the word because and include a chemistry principle, not just a result.`,
  ];
}

function buildVocabEntries(spec: ChemistryLessonSpec): string[] {
  return spec.vocabTerms.map((term) => {
    const entry = vocabDictionary[term] ?? {
      definition: `a lesson-specific term used to reason about ${spec.title.toLowerCase()}`,
      precision: "Use it only when the evidence or particle model supports the claim.",
      example: `Example: use ${term} when explaining ${spec.relatedConcepts[0]}; non-example: using it as a vague label without evidence.`,
    };

    return `${term} - ${entry.definition}. Precision note: ${entry.precision} Example/non-example: ${entry.example}`;
  });
}

function getFormulaEntries(topics: FormulaTopic[]): FormulaEntry[] {
  return uniqueBy(
    topics.flatMap((topic) => formulaBank[topic]),
    (formula) => formula.name,
  ).slice(0, 5);
}

function formatFormulaEntry(formula: FormulaEntry): string {
  return `${formula.name}: ${formula.latex}. Variables: ${formula.variables} Units: ${formula.units} When to use: ${formula.use} Common trap: ${formula.trap}`;
}

function buildWhiteboardPrompt(spec: ChemistryLessonSpec): string {
  const prompts: Record<LessonCategory, string> = {
    measurement: "Create a three-column board: measured quantity, unit path, and uncertainty note. Add arrows showing how raw data becomes a defensible claim.",
    atomic: "Draw a nucleus, electron energy levels, and one evidence arrow from spectrum or PES data to the shell model.",
    bonding: "Build a Lewis structure map: electron count, skeleton, lone pairs, formal charge, geometry, and polarity.",
    "imf-gases-solutions": "Sketch particles before and after a phase, gas, or solution change. Label attractions, spacing, and motion.",
    reactions: "Draw a tri-representation panel: balanced symbolic equation, particle diagram, and lab observation.",
    stoichiometry: "Draw the mole bridge as a unit ladder from given amount to target amount, with each conversion factor labeled.",
    kinetics: "Draw an energy diagram and a concentration-time graph beside each other. Label what a catalyst changes and what it does not change.",
    thermochemistry: "Sketch system and surroundings with arrows for heat flow, then pair it with an energy diagram.",
    equilibrium: "Draw a reversible-reaction balance with Q and K comparison arrows, then show how a disturbance changes direction.",
    "acid-base": "Sketch conjugate acid-base pairs and a titration curve; mark buffer region, equivalence point, and indicator range when relevant.",
    electrochemistry: "Draw an electrochemical cell with anode, cathode, electron flow, ion flow, and voltage sign.",
    "ap-review": "Create a representation triangle: particle diagram, equation/calculation, and written justification. Add one arrow showing how each supports the next.",
  };

  return `${prompts[spec.category]} Keep the diagram original and focused on ${spec.title}.`;
}

function buildDataPrompt(spec: ChemistryLessonSpec): { prompt: string; tasks: string[] } {
  const data: Record<LessonCategory, string> = {
    measurement: "Original data: Trial 1 mass 12.42 g, volume 4.18 mL; Trial 2 mass 12.39 g, volume 4.15 mL; Trial 3 mass 12.45 g, volume 4.20 mL.",
    atomic: "Original data: Element X has isotope masses 68.93 amu and 70.92 amu with abundances 60.1% and 39.9%.",
    bonding: "Original data: Molecule A has polar bonds arranged linear; Molecule B has similar bond polarity arranged bent.",
    "imf-gases-solutions": "Original data: at 298 K, gas pressure readings are 0.82 atm at 3.00 L, 1.22 atm at 2.00 L, and 2.42 atm at 1.00 L.",
    reactions: "Original data: mixing solution A and solution B produces 0.842 g precipitate after filtering and drying.",
    stoichiometry: "Original data: 1.25 g reactant A and 2.40 g reactant B form 1.91 g product after drying.",
    kinetics: "Original data: time 0, 20, 40, 60 s; [A] 0.800, 0.566, 0.400, 0.283 M.",
    thermochemistry: "Original data: 48.0 g water changes from 21.4 C to 29.8 C in a foam-cup calorimeter.",
    equilibrium: "Original data: initial [A] = 0.500 M and equilibrium [B] = 0.160 M for A <=> 2B in a sealed vessel.",
    "acid-base": "Original data: titration pH values at 0.00, 12.50, 24.50, 25.00, 25.50 mL are 2.10, 2.45, 3.30, 7.00, 10.70.",
    electrochemistry: "Original data: a cell runs at 0.250 A for 965 s and deposits a metal from M2+ solution.",
    "ap-review": "Original data: a student records a table, a particle drawing, and a calculation that appear to disagree by one unit conversion.",
  };

  return {
    prompt: `${data[spec.category]} Use the lab notebook to turn these values into a claim, evidence, and reasoning paragraph for ${spec.title}.`,
    tasks: [
      "Graph or organize the data with labeled units.",
      "State one trend or calculated result with appropriate significant figures.",
      "Name one likely source of random error and one likely source of systematic error.",
      "Write a claim-evidence-reasoning conclusion that does not overstate the data.",
    ],
  };
}

function buildMisconceptions(spec: ChemistryLessonSpec): string[] {
  const common: Record<LessonCategory, string[]> = {
    measurement: ["More digits do not automatically mean better data.", "Accuracy and precision answer different questions."],
    atomic: ["Changing electron count changes charge; changing proton count changes element identity.", "Orbitals are probability models, not tiny planetary tracks."],
    bonding: ["Formal charge is not the same as partial charge.", "A polar bond does not guarantee a polar molecule."],
    "imf-gases-solutions": ["Boiling or dissolving usually changes attractions between particles, not the formula identity.", "Strong intermolecular forces are not covalent bonds."],
    reactions: ["Subscripts cannot be changed to balance a reaction.", "Spectator ions are present but do not drive the net ionic change."],
    stoichiometry: ["The limiting reactant is not always the reactant with the smaller mass.", "Mole ratios come from balanced coefficients, not molar masses."],
    kinetics: ["Rate-law exponents are determined from data, not taken from the balanced equation.", "A catalyst changes pathway, not reaction enthalpy or K."],
    thermochemistry: ["Temperature and heat are related but not identical.", "Exothermic for the system means heat leaves the system."],
    equilibrium: ["Equilibrium does not mean equal reactant and product concentrations.", "Adding a pure solid does not appear in K expressions."],
    "acid-base": ["Strong means complete ionization, not high concentration.", "A buffer is not immune to pH change; it has capacity limits."],
    electrochemistry: ["Electrons do not travel through the salt bridge.", "Cell potentials are not multiplied by stoichiometric coefficients."],
    "ap-review": ["AP explanations need chemistry reasoning, not just the answer choice.", "A correct number without units and justification can still be incomplete."],
  };

  return [...common[spec.category], `For ${spec.title}, check the model and the units before deciding the final claim.`];
}

function buildReviewCards(spec: ChemistryLessonSpec): string[] {
  return [
    `Front: What is the one-sentence idea of ${spec.title}? Back: Connect ${spec.relatedConcepts[1]} to evidence and units.`,
    `Front: Which formula or relationship belongs here? Back: ${getFormulaEntries(spec.formulaTopics)[0]?.name ?? "Use the data relationship"} and its common trap.`,
    `Front: What particle-level feature explains this lesson? Back: ${categoryModelAnswer(spec.category)}.`,
    `Front: What mistake should I catch on a second pass? Back: ${buildMisconceptions(spec)[0]}`,
  ];
}

function buildMasteryChecklist(spec: ChemistryLessonSpec): string[] {
  return [
    "I can explain the idea without looking at the lesson text.",
    "I can use the Formula Sheet entry with correct units and a stated assumption.",
    "I can answer at least eight Practice Set questions and correct my mistakes.",
    "I can draw the Whiteboard prompt from memory and label the important chemistry features.",
    `I can connect ${spec.title} to an AP-style data, graph, particle, or justification task.`,
  ];
}

function buildRelatedConceptReason(spec: ChemistryLessonSpec, concept: string) {
  if (concept === spec.title) return "you need the full lesson thread";
  if (concept.toLowerCase().includes("unit")) return "the calculation or model needs a measured quantity";
  return `working on ${spec.title.toLowerCase()}`;
}

function buildMathBlocks(spec: ChemistryLessonSpec): MathBlock[] {
  return getFormulaEntries(spec.formulaTopics).slice(0, 3).map((formula, index) => ({
    id: `${spec.id}-formula-${index + 1}`,
    type: "latex",
    latex: formula.latex,
    label: formula.name,
    description: `${formula.use} Common trap: ${formula.trap}`,
    sourceHeading: "Formula Sheet",
    sourceAnchorId: `${spec.id}-formula-sheet`,
    topic: spec.unitTitle,
  }));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
