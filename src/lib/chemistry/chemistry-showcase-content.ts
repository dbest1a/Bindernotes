import type { JSONContent } from "@tiptap/react";
import type { Binder, BinderLesson, Folder, FolderBinderLink, WorkspacePresetId } from "@/types";

export const CHEMISTRY_SHOWCASE_FOLDER_ID = "folder-chemistry";
export const CHEMISTRY_SHOWCASE_BINDER_ID = "binder-chemistry-101-showcase";

export const CHEMISTRY_SHOWCASE_LESSON_IDS = [
  "lesson-chem-welcome",
  "lesson-chem-periodic-table",
  "lesson-chem-periodic-trends",
  "lesson-chem-bonding",
  "lesson-chem-reactions",
  "lesson-chem-stoichiometry",
  "lesson-chem-solutions",
  "lesson-chem-acid-base",
  "lesson-chem-titration-lab",
  "lesson-chem-kinetics",
  "lesson-chem-thermochemistry",
  "lesson-chem-final-studio",
] as const;

export type ChemistryShowcaseLessonMetadata = {
  lessonId: (typeof CHEMISTRY_SHOWCASE_LESSON_IDS)[number];
  presetId: WorkspacePresetId;
  difficulty: "intro" | "core" | "challenge";
  conceptTags: string[];
  alignmentTags: string[];
};

const now = new Date("2026-05-07T12:00:00.000Z").toISOString();
const ownerId = "system-chemistry-showcase";

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

function lessonDoc(input: {
  title: string;
  body: string;
  keyTerms: string[];
  examples: string[];
  practice: string[];
  modules: string[];
}): JSONContent {
  return {
    type: "doc",
    content: [
      heading(input.title, 1),
      paragraph(input.body),
      heading("Key terms"),
      bulletList(input.keyTerms),
      heading("Worked examples"),
      bulletList(input.examples),
      heading("Practice prompts"),
      bulletList(input.practice),
      heading("Workspace modules to try"),
      bulletList(input.modules),
    ],
  };
}

const lessonSpecs: Array<{
  id: (typeof CHEMISTRY_SHOWCASE_LESSON_IDS)[number];
  title: string;
  order: number;
  presetId: WorkspacePresetId;
  difficulty: ChemistryShowcaseLessonMetadata["difficulty"];
  conceptTags: string[];
  alignmentTags: string[];
  body: string;
  keyTerms: string[];
  examples: string[];
  practice: string[];
  modules: string[];
}> = [
  {
    id: "lesson-chem-welcome",
    title: "Welcome to the Chemistry Workspace",
    order: 1,
    presetId: "chem-guided-study",
    difficulty: "intro",
    conceptTags: ["chemistry-workflow", "measurement", "concept-cards"],
    alignmentTags: ["AP Chemistry: scientific practices", "Gen Chem 101: course skills"],
    body: "Chemistry in BinderNotes is built around reading, writing, calculating, modeling, and lab thinking. This first lesson shows how a student can keep the source lesson readable while the chemistry tools stay nearby instead of crowding the page.",
    keyTerms: ["model", "measurement", "evidence", "unit", "checkpoint"],
    examples: ["Use Concept Cards to preview the unit.", "Use Quick Tools to calculate molar mass without leaving notes.", "Use Private Notes to summarize one idea in your own words."],
    practice: ["Write one question you have about atoms.", "Open Quick Tools and find the pH scale card.", "Switch to Maximize Module Space and compare reading room."],
    modules: ["Chem Guided Study", "Chemistry Concept Cards", "Chemistry Quick Tools", "Private Notes"],
  },
  {
    id: "lesson-chem-periodic-table",
    title: "Atomic Structure and the Periodic Table",
    order: 2,
    presetId: "chem-element-explorer",
    difficulty: "intro",
    conceptTags: ["atomic-structure", "isotopes", "ions", "periodic-table"],
    alignmentTags: ["AP SAP-1", "Gen Chem 101: atoms and isotopes"],
    body: "An element's identity comes from its protons. Neutrons change the isotope, electrons change the charge, and the periodic table organizes those patterns into a map students can actually use.",
    keyTerms: ["proton", "neutron", "electron", "isotope", "ion"],
    examples: ["Carbon-14 has 6 protons and 8 neutrons.", "Na+ has 11 protons and 10 electrons.", "Cl- has 17 protons and 18 electrons."],
    practice: ["Build Carbon-14.", "Build Na+.", "Search for atomic number 26 and explain why iron has multiple common ions."],
    modules: ["Interactive Periodic Table", "Element Builder", "Electron Configuration Builder"],
  },
  {
    id: "lesson-chem-periodic-trends",
    title: "Periodic Trends and Electron Configuration",
    order: 3,
    presetId: "chem-element-explorer",
    difficulty: "core",
    conceptTags: ["periodic-trends", "effective-nuclear-charge", "electron-configuration"],
    alignmentTags: ["AP SAP-2", "Gen Chem 101: periodicity"],
    body: "Periodic trends come from attraction between the nucleus and valence electrons. Atomic radius, ionization energy, electronegativity, and metallic character all become easier when students connect the trend to shells and effective nuclear charge.",
    keyTerms: ["atomic radius", "ionization energy", "electronegativity", "valence electron"],
    examples: ["Atomic radius decreases across period 2.", "Electronegativity increases toward fluorine.", "Oxygen and sulfur show how a group trend works."],
    practice: ["Compare oxygen and sulfur.", "Toggle an electronegativity overlay.", "Explain why potassium is larger than sodium."],
    modules: ["Periodic Trends Graph", "Interactive Periodic Table", "Element Comparison"],
  },
  {
    id: "lesson-chem-bonding",
    title: "Molecules, Bonds, and Lewis Structures",
    order: 4,
    presetId: "chem-bonding-studio",
    difficulty: "core",
    conceptTags: ["lewis-structures", "formal-charge", "vsepr", "polarity"],
    alignmentTags: ["AP SAP-4", "Gen Chem 101: bonding"],
    body: "Lewis structures are bookkeeping for valence electrons. Good structures conserve electrons, satisfy octets when possible, and help predict shape through VSEPR.",
    keyTerms: ["valence electron", "lone pair", "formal charge", "VSEPR"],
    examples: ["CO2 is linear with two double bonds.", "NH3 is trigonal pyramidal.", "H2O is bent because oxygen has two lone pairs."],
    practice: ["Build water.", "Check formal charge on nitrate.", "Predict whether CO2 is polar."],
    modules: ["Molecule / Lewis Builder", "Geometry Viewer", "Formal Charge Checker"],
  },
  {
    id: "lesson-chem-reactions",
    title: "Chemical Reactions and Balancing",
    order: 5,
    presetId: "chem-reaction-studio",
    difficulty: "core",
    conceptTags: ["equation-balancing", "conservation", "reaction-types"],
    alignmentTags: ["AP TRA-1", "Gen Chem 101: reactions"],
    body: "Balanced equations protect the core rule of chemical reactions: atoms are rearranged, not created or destroyed. Coefficients change molecule counts; subscripts change chemical identity.",
    keyTerms: ["coefficient", "subscript", "reactant", "product", "precipitate"],
    examples: ["2H2 + O2 -> 2H2O.", "AgNO3 and NaCl form AgCl precipitate.", "Combustion of methane forms CO2 and H2O."],
    practice: ["Balance H2 + O2 -> H2O.", "Identify the reaction type for HCl + NaOH.", "Explain why subscripts are locked."],
    modules: ["Reaction Balancer", "Tri-Representation Reaction View", "Conservation Checker"],
  },
  {
    id: "lesson-chem-stoichiometry",
    title: "Stoichiometry and the Mole Bridge",
    order: 6,
    presetId: "chem-stoichiometry-lab",
    difficulty: "core",
    conceptTags: ["stoichiometry", "molar-mass", "mole-ratio"],
    alignmentTags: ["AP SPQ-1", "Gen Chem 101: stoichiometry"],
    body: "Stoichiometry is a unit conversion story. Students start with a measured quantity, cross the mole bridge, use the balanced equation ratio, and convert to the target quantity.",
    keyTerms: ["molar mass", "mole ratio", "limiting reactant", "percent yield"],
    examples: ["Convert grams H2 to moles H2.", "Use 2 mol H2 : 2 mol H2O.", "Convert moles H2O to grams H2O."],
    practice: ["Solve a grams-to-grams problem.", "Flip a mole ratio and identify the mistake.", "Name the bridge step."],
    modules: ["Stoichiometry Ladder", "Molar Mass Calculator", "Unit Cancellation"],
  },
  {
    id: "lesson-chem-solutions",
    title: "Solutions, Molarity, and Dilution",
    order: 7,
    presetId: "chem-solutions-molarity-lab",
    difficulty: "core",
    conceptTags: ["solutions", "molarity", "dilution"],
    alignmentTags: ["AP SPQ-3", "Gen Chem 101: solutions"],
    body: "Molarity connects amount of solute to solution volume. Dilution keeps moles of solute constant while volume changes, which is why M1V1 = M2V2 works.",
    keyTerms: ["solute", "solvent", "molarity", "dilution"],
    examples: ["0.500 M means 0.500 mol per liter.", "Diluting 10 mL of stock to 100 mL lowers concentration by 10x."],
    practice: ["Mix a 0.100 M target solution.", "Explain what stays constant during dilution.", "Record a safety reminder."],
    modules: ["Solution Mixer", "Molarity Calculator", "Concentration Graph"],
  },
  {
    id: "lesson-chem-acid-base",
    title: "Acid-Base Chemistry and pH",
    order: 8,
    presetId: "chem-acid-base-titration-lab",
    difficulty: "core",
    conceptTags: ["acid-base", "ph", "buffers"],
    alignmentTags: ["AP SAP-9", "Gen Chem 101: acids and bases"],
    body: "pH compresses hydronium concentration into a readable scale. Strong acids and bases ionize completely, while weak acids require equilibrium thinking.",
    keyTerms: ["pH", "pOH", "hydronium", "strong acid", "buffer"],
    examples: ["0.010 M HCl has pH 2.00.", "0.0010 M NaOH has pOH 3.00 and pH 11.00.", "A buffer resists pH changes."],
    practice: ["Calculate pH for a strong acid.", "Explain strong vs concentrated.", "Preview a buffer with Henderson-Hasselbalch."],
    modules: ["pH Calculator", "Acid/Base Reference", "pH Scale"],
  },
  {
    id: "lesson-chem-titration-lab",
    title: "Titration Lab: Find the Unknown Acid",
    order: 9,
    presetId: "chem-acid-base-titration-lab",
    difficulty: "challenge",
    conceptTags: ["titration", "equivalence-point", "lab-notebook"],
    alignmentTags: ["AP Chemistry lab practice", "Gen Chem 101: titration"],
    body: "A titration uses a known concentration to determine an unknown concentration. The curve, endpoint, equivalence point, and lab notebook should tell the same evidence story.",
    keyTerms: ["titrant", "analyte", "equivalence point", "indicator"],
    examples: ["At equivalence, moles acid equals moles base for monoprotic strong acid/base.", "A steep pH jump marks the endpoint region."],
    practice: ["Add titrant slowly near equivalence.", "Record three pH checkpoints.", "Write a claim/evidence/reasoning conclusion."],
    modules: ["Titration Lab Bench", "Desmos Titration Curve or Fallback Chart", "Lab Notebook"],
  },
  {
    id: "lesson-chem-kinetics",
    title: "Kinetics and Reaction Rate Graphs",
    order: 10,
    presetId: "chem-kinetics-graph-lab",
    difficulty: "core",
    conceptTags: ["kinetics", "rate-law", "graphs"],
    alignmentTags: ["AP TRA-3", "Gen Chem 101: kinetics"],
    body: "Kinetics asks how fast a reaction proceeds and how concentration changes with time. Graph shapes and linearized plots help students infer reaction order.",
    keyTerms: ["rate", "rate constant", "reaction order", "half-life"],
    examples: ["First-order reactions linearize as ln[A] vs time.", "Zero-order reactions have a constant slope in [A] vs time."],
    practice: ["Adjust the rate constant.", "Compare first-order and second-order curves.", "Record what graph became linear."],
    modules: ["Kinetics Simulator", "Desmos Rate Plot or Fallback Chart", "Data Table"],
  },
  {
    id: "lesson-chem-thermochemistry",
    title: "Thermochemistry and Energy Changes",
    order: 11,
    presetId: "chem-thermochemistry-studio",
    difficulty: "core",
    conceptTags: ["thermochemistry", "calorimetry", "enthalpy"],
    alignmentTags: ["AP ENE-2", "Gen Chem 101: thermochemistry"],
    body: "Thermochemistry tracks energy as heat moves between a system and surroundings. Calorimetry uses q = mc delta T to connect temperature change with energy transfer.",
    keyTerms: ["system", "surroundings", "enthalpy", "calorimetry"],
    examples: ["Positive q for water means water absorbed heat.", "An exothermic reaction releases heat to surroundings."],
    practice: ["Calculate q for water warming by 8 C.", "Label a reaction endothermic or exothermic.", "Sketch an energy diagram."],
    modules: ["Calorimetry Lab", "Energy Diagram", "Calculation Sheet"],
  },
  {
    id: "lesson-chem-final-studio",
    title: "Final Chemistry Studio Challenge",
    order: 12,
    presetId: "chem-full-studio",
    difficulty: "challenge",
    conceptTags: ["review", "chemistry-studio", "challenge"],
    alignmentTags: ["AP Chemistry integrated practice", "Gen Chem 101 cumulative review"],
    body: "The final studio challenge combines atomic structure, bonding, reactions, stoichiometry, solution chemistry, lab evidence, and graph interpretation into one review flow.",
    keyTerms: ["claim", "evidence", "reasoning", "model", "calculation"],
    examples: ["Build an ion, balance a reaction, solve a stoichiometry ladder, and interpret a titration curve."],
    practice: ["Complete one challenge card from each topic.", "Explain one mistake tag.", "Save a final lab notebook summary."],
    modules: ["Full Chemistry Studio", "Review Queue", "Interactive Tools"],
  },
];

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
  title: "Chemistry 101 Showcase: Atoms, Reactions, and Acid-Base Labs",
  slug: "chemistry-101-showcase-atoms-reactions-acid-base-labs",
  description: "A demo of the future Bindernotes Chemistry workspace.",
  subject: "Chemistry",
  level: "Unit 1 - From Elements to Reactions",
  status: "published",
  price_cents: 0,
  cover_url: null,
  pinned: true,
  dashboard_sort_order: 40,
  created_at: now,
  updated_at: now,
};

export const chemistryShowcaseFolderLink: FolderBinderLink = {
  id: "folder-link-chemistry-101-showcase",
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
  is_preview: lesson.order <= 3,
  content: lessonDoc(lesson),
  math_blocks: [],
  created_at: now,
  updated_at: now,
}));

export const chemistryShowcaseLessonMetadata: ChemistryShowcaseLessonMetadata[] = lessonSpecs.map((lesson) => ({
  lessonId: lesson.id,
  presetId: lesson.presetId,
  difficulty: lesson.difficulty,
  conceptTags: lesson.conceptTags,
  alignmentTags: lesson.alignmentTags,
}));

export function getChemistryShowcasePresetForLesson(lessonId: string): WorkspacePresetId {
  return chemistryShowcaseLessonMetadata.find((metadata) => metadata.lessonId === lessonId)?.presetId ?? "chem-guided-study";
}
