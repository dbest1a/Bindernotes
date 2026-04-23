import type { JSONContent } from "@tiptap/react";
import type {
  Binder,
  BinderLesson,
  Folder,
  HistoryEventTemplate,
  HistoryMythCheckTemplate,
  HistorySourceTemplate,
  SuiteTemplate,
  WorkspacePresetDefinition,
} from "@/types";

const now = new Date().toISOString();
const systemOwnerId = "system-seed-admin";

function textNode(text: string): JSONContent {
  return { type: "text", text };
}

function paragraph(text: string): JSONContent {
  return {
    type: "paragraph",
    content: [textNode(text)],
  };
}

function heading(text: string, level = 2): JSONContent {
  return {
    type: "heading",
    attrs: { level },
    content: [textNode(text)],
  };
}

function bulletList(items: string[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

function lessonDoc(...content: JSONContent[]): JSONContent {
  return {
    type: "doc",
    content,
  };
}

export const SYSTEM_SUITE_IDS = {
  algebra: "suite-algebra-foundations",
  riseOfRome: "suite-rise-of-rome",
  historyDemo: "suite-history-demo",
} as const;

export const SYSTEM_BINDER_IDS = {
  algebra: "binder-algebra-foundations",
  riseOfRome: "binder-rise-of-rome",
  frenchRevolution: "binder-french-revolution-history-suite",
} as const;

export const SYSTEM_SEED_VERSION = "2026.04.22-history-suite-foundation";

export const systemSuiteTemplates: SuiteTemplate[] = [
  {
    id: SYSTEM_SUITE_IDS.algebra,
    slug: "algebra-1-foundations",
    title: "Algebra 1 Foundations",
    subject: "Mathematics",
    description: "A backend-native Algebra 1 demo suite for expression, function, and graph study.",
    folder_title: "Math Suite Demo",
    history_mode: false,
    default_preset_id: "split-study",
    status: "published",
    created_at: now,
    updated_at: now,
  },
  {
    id: SYSTEM_SUITE_IDS.riseOfRome,
    slug: "rise-of-rome",
    title: "Rise of Rome",
    subject: "History",
    description: "A backend-native Rome demo suite with timeline, evidence, and argument surfaces.",
    folder_title: "Rise of Rome Demo",
    history_mode: true,
    default_preset_id: "history-guided",
    status: "published",
    created_at: now,
    updated_at: now,
  },
  {
    id: SYSTEM_SUITE_IDS.historyDemo,
    slug: "history-suite-demo",
    title: "History Suite Demo",
    subject: "History",
    description: "A French Revolution showcase for timeline, evidence, argument, and myth-versus-history study.",
    folder_title: "History Suite Demo",
    history_mode: true,
    default_preset_id: "history-guided",
    status: "published",
    created_at: now,
    updated_at: now,
  },
];

export function buildSystemFolderFromSuite(suite: SuiteTemplate): Folder {
  return {
    id: `folder-${suite.id}`,
    owner_id: systemOwnerId,
    name: suite.folder_title,
    color: suite.history_mode ? "amber" : "rose",
    source: "system",
    suite_template_id: suite.id,
    created_at: now,
    updated_at: now,
  };
}

export const frenchRevolutionBinder: Binder = {
  id: SYSTEM_BINDER_IDS.frenchRevolution,
  owner_id: systemOwnerId,
  suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
  title: "French Revolution: Timeline, Evidence, and Argument",
  slug: "french-revolution-timeline-evidence-argument",
  description:
    "A demo-ready history binder built to show how BinderNotes handles chronology, source work, argument chains, and myth checking.",
  subject: "History",
  level: "Modern Europe",
  status: "published",
  price_cents: 0,
  cover_url:
    "https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&w=1400&q=82",
  pinned: true,
  created_at: now,
  updated_at: now,
};

export const frenchRevolutionLessons: BinderLesson[] = [
  {
    id: "lesson-french-revolution-overview",
    binder_id: frenchRevolutionBinder.id,
    title: "Timeline and Turning Points",
    order_index: 1,
    is_preview: true,
    content: lessonDoc(
      heading("Why this binder starts with chronology"),
      paragraph(
        "The French Revolution becomes easier to understand when students can see how financial crisis, representative politics, crowd action, and war stack on top of one another over time.",
      ),
      heading("Anchor questions"),
      bulletList([
        "Why does the Estates-General meeting become a constitutional crisis?",
        "Why does the Bastille matter more symbolically than militarily?",
        "How does revolutionary momentum turn into state violence?",
        "Why does Napoleon's rise look like both an ending and a continuation?",
      ]),
    ),
    math_blocks: [],
    created_at: now,
    updated_at: now,
  },
  {
    id: "lesson-french-revolution-evidence",
    binder_id: frenchRevolutionBinder.id,
    title: "Source Evidence and Competing Claims",
    order_index: 2,
    is_preview: false,
    content: lessonDoc(
      heading("How to read source evidence here"),
      paragraph(
        "Treat each source as a claim made by someone in a specific context. Ask what audience it addresses, what it tries to persuade, and what kind of evidence it can reasonably support.",
      ),
      heading("What strong evidence work looks like"),
      bulletList([
        "Quote or paraphrase the source accurately.",
        "Name the author or institution behind it.",
        "Explain which claim the source supports or weakens.",
        "Add a reliability note instead of assuming every source works the same way.",
      ]),
    ),
    math_blocks: [],
    created_at: now,
    updated_at: now,
  },
  {
    id: "lesson-french-revolution-argument",
    binder_id: frenchRevolutionBinder.id,
    title: "Cause and Effect Argument Builder",
    order_index: 3,
    is_preview: false,
    content: lessonDoc(
      heading("From events to arguments"),
      paragraph(
        "A strong history argument connects events instead of listing them. This binder helps students move from chronology to causation by building editable chains with evidence attached.",
      ),
      heading("Prompt"),
      paragraph("What were the most important causes of the French Revolution?"),
    ),
    math_blocks: [],
    created_at: now,
    updated_at: now,
  },
  {
    id: "lesson-french-revolution-myth-history",
    binder_id: frenchRevolutionBinder.id,
    title: "Myth, Oversimplification, and Evidence",
    order_index: 4,
    is_preview: false,
    content: lessonDoc(
      heading("Why myth checks matter"),
      paragraph(
        "History students often inherit clean one-line stories. This panel helps separate catchy claims from evidence-supported explanations without pretending every historical question has one perfect answer.",
      ),
      heading("Status guide"),
      bulletList([
        "Myth: the claim is plainly wrong.",
        "Oversimplification: the claim captures one part but hides the larger picture.",
        "Contested: historians disagree on the best interpretation.",
        "Evidence-supported history: the claim is well grounded in available evidence.",
      ]),
    ),
    math_blocks: [],
    created_at: now,
    updated_at: now,
  },
];

export const frenchRevolutionEventTemplates: HistoryEventTemplate[] = [
  {
    id: "event-estates-general-1789",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-overview",
    title: "Estates-General convenes",
    summary: "Louis XVI calls the Estates-General in response to fiscal collapse and political deadlock.",
    significance: "The monarchy opens a representative process it cannot fully control.",
    location_label: "Versailles, France",
    location_lat: 48.8049,
    location_lng: 2.1204,
    date_label: "1789",
    sort_year: 1789,
    sort_month: 5,
    sort_day: 5,
    era: "ce",
    precision: "day",
    approximate: false,
    themes: ["finance", "representation", "monarchy"],
    created_at: now,
    updated_at: now,
  },
  {
    id: "event-tennis-court-oath-1789",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-overview",
    title: "Tennis Court Oath",
    summary: "Representatives of the Third Estate swear not to disperse until France has a constitution.",
    significance: "Political legitimacy starts moving away from the king and toward the nation.",
    location_label: "Versailles, France",
    location_lat: 48.8049,
    location_lng: 2.1204,
    date_label: "1789",
    sort_year: 1789,
    sort_month: 6,
    sort_day: 20,
    era: "ce",
    precision: "day",
    approximate: false,
    themes: ["constitution", "representation"],
    created_at: now,
    updated_at: now,
  },
  {
    id: "event-bastille-1789",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-overview",
    title: "Storming of the Bastille",
    summary: "Paris crowds seize the Bastille amid fear, rumor, and armed confrontation.",
    significance: "The revolution becomes visibly popular, urban, and difficult for the crown to contain.",
    location_label: "Paris, France",
    location_lat: 48.8566,
    location_lng: 2.3522,
    date_label: "1789",
    sort_year: 1789,
    sort_month: 7,
    sort_day: 14,
    era: "ce",
    precision: "day",
    approximate: false,
    themes: ["crowd action", "violence", "symbolism"],
    created_at: now,
    updated_at: now,
  },
  {
    id: "event-rights-of-man-1789",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-evidence",
    title: "Declaration of the Rights of Man and Citizen",
    summary: "The National Assembly articulates universal political principles and rights claims.",
    significance: "Revolutionary politics now has a language of citizenship and legitimacy that travels beyond one crisis.",
    location_label: "Paris, France",
    location_lat: 48.8566,
    location_lng: 2.3522,
    date_label: "1789",
    sort_year: 1789,
    sort_month: 8,
    sort_day: 26,
    era: "ce",
    precision: "day",
    approximate: false,
    themes: ["rights", "citizenship", "political ideas"],
    created_at: now,
    updated_at: now,
  },
  {
    id: "event-reign-of-terror-1793",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-argument",
    title: "Reign of Terror",
    summary: "The revolutionary state uses extraordinary violence to defend itself against enemies and instability.",
    significance: "Revolutionary ideals and coercive state power become tightly entangled.",
    location_label: "Paris, France",
    location_lat: 48.8566,
    location_lng: 2.3522,
    date_label: "1793-1794",
    sort_year: 1793,
    sort_month: 9,
    sort_day: 5,
    era: "ce",
    precision: "approximate",
    approximate: true,
    themes: ["war", "violence", "state power"],
    created_at: now,
    updated_at: now,
  },
  {
    id: "event-napoleon-1799",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-myth-history",
    title: "Napoleon seizes power",
    summary: "Napoleon Bonaparte uses the coup of 18 Brumaire to end the Directory and create a new executive order.",
    significance: "The revolution does not simply end; it is reorganized through military and administrative power.",
    location_label: "Paris, France",
    location_lat: 48.8566,
    location_lng: 2.3522,
    date_label: "1799",
    sort_year: 1799,
    sort_month: 11,
    sort_day: 9,
    era: "ce",
    precision: "day",
    approximate: false,
    themes: ["executive power", "military", "continuity"],
    created_at: now,
    updated_at: now,
  },
];

export const frenchRevolutionSourceTemplates: HistorySourceTemplate[] = [
  {
    id: "source-sieyes-third-estate",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-evidence",
    title: "What Is the Third Estate?",
    source_type: "primary",
    author: "Emmanuel-Joseph Sieyes",
    date_label: "1789",
    audience: "French political readers",
    purpose: "To argue that the Third Estate represents the nation and deserves political authority.",
    point_of_view: "Reform-minded clerical and political critic of privilege.",
    context_note: "Published during the political crisis before the Estates-General became revolutionary.",
    reliability_note: "Strong evidence for revolutionary political argument, weaker for neutral social description.",
    citation_url: null,
    quote_text: "What is the Third Estate? Everything. What has it been hitherto in the political order? Nothing.",
    claim_supports: "Political representation and social inequality were central causes of the revolution.",
    claim_challenges: "The revolution can be reduced to food shortages alone.",
    created_at: now,
    updated_at: now,
  },
  {
    id: "source-rights-of-man",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-evidence",
    title: "Declaration of the Rights of Man and Citizen",
    source_type: "primary",
    author: "National Assembly",
    date_label: "1789",
    audience: "French citizens and political observers",
    purpose: "To state revolutionary principles of liberty, equality, and sovereignty.",
    point_of_view: "Assembly-driven constitutional revolutionary perspective.",
    context_note: "Written after the early revolutionary crisis had already broken royal monopoly on political legitimacy.",
    reliability_note: "Excellent for the ideals revolutionaries claimed to endorse; not proof that all citizens received those rights equally.",
    citation_url: null,
    quote_text: "Men are born and remain free and equal in rights.",
    claim_supports: "Enlightenment political ideas shaped revolutionary goals and language.",
    claim_challenges: "The revolution was only a fight over taxes and bread.",
    created_at: now,
    updated_at: now,
  },
  {
    id: "source-robespierre-terror",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-argument",
    title: "Robespierre on political virtue and terror",
    source_type: "primary",
    author: "Maximilien Robespierre",
    date_label: "1794",
    audience: "National Convention and revolutionary political community",
    purpose: "To justify extraordinary coercion in defense of the revolution.",
    point_of_view: "Radical republican state-defense perspective under wartime pressure.",
    context_note: "Produced when the revolutionary government linked virtue, emergency, and punishment.",
    reliability_note: "Strong for understanding revolutionary self-justification; not a neutral description of necessity.",
    citation_url: null,
    quote_text: "Terror is nothing other than justice, prompt, severe, inflexible.",
    claim_supports: "War and internal enemies helped radicalize the revolution into state violence.",
    claim_challenges: "The revolution moved in a straight line toward liberty.",
    created_at: now,
    updated_at: now,
  },
  {
    id: "source-napoleon-brumaire",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-myth-history",
    title: "Napoleon after 18 Brumaire",
    source_type: "secondary",
    author: "Modern historical synthesis",
    date_label: "Later interpretation",
    audience: "History students",
    purpose: "To explain how Napoleon both ended and preserved parts of the revolution.",
    point_of_view: "Interpretive, retrospective historical analysis.",
    context_note: "Useful for showing continuity between revolutionary instability and Napoleonic consolidation.",
    reliability_note: "Good for synthesis, but should be paired with primary evidence for close claims.",
    citation_url: null,
    quote_text: "Napoleon closed one phase of the revolution by stabilizing many of its institutional changes under new authority.",
    claim_supports: "Napoleon represented both a break with revolutionary pluralism and a continuation of revolutionary state building.",
    claim_challenges: "Napoleon simply restored the old regime.",
    created_at: now,
    updated_at: now,
  },
];

export const frenchRevolutionMythCheckTemplates: HistoryMythCheckTemplate[] = [
  {
    id: "myth-bread-prices-only",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-myth-history",
    myth_text: "The French Revolution was only caused by bread prices.",
    corrected_claim:
      "Bread prices mattered, but the revolution also grew out of fiscal crisis, social inequality, political representation disputes, and Enlightenment ideas.",
    status: "oversimplification",
    explanation:
      "Food scarcity heightened anger and urgency, but it worked alongside institutional collapse and political conflict rather than replacing them.",
    created_at: now,
    updated_at: now,
  },
  {
    id: "myth-napoleon-short",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-myth-history",
    myth_text: "Napoleon was extremely short.",
    corrected_claim:
      "Napoleon was likely around average height for his era; the myth grew from caricature and translation differences.",
    status: "myth",
    explanation:
      "British propaganda and confusion between French and English measurement systems helped create a much more exaggerated image than the evidence supports.",
    created_at: now,
    updated_at: now,
  },
  {
    id: "myth-flat-earth-middle-ages",
    suite_template_id: SYSTEM_SUITE_IDS.historyDemo,
    binder_id: frenchRevolutionBinder.id,
    lesson_id: "lesson-french-revolution-myth-history",
    myth_text: "People in the Middle Ages believed the Earth was flat.",
    corrected_claim:
      "Educated medieval Europeans generally knew the Earth was spherical; the flat-earth story became popular much later.",
    status: "evidence_supported",
    explanation:
      "The claim survives because it is memorable, not because it matches the mainstream learned tradition of medieval Europe.",
    created_at: now,
    updated_at: now,
  },
];

export const historyPresetDefinitions: WorkspacePresetDefinition[] = [
  {
    id: "history-guided",
    suiteTemplateId: SYSTEM_SUITE_IDS.historyDemo,
    title: "History Guided",
    description: "A calm four-panel history study layout with chronology in front and evidence close behind.",
    style: "guided",
    lockMode: "locked",
    requiredPanels: ["history-timeline", "history-evidence", "history-argument", "history-myth-checks"],
    breakpoints: {
      desktop: {
        columns: 12,
        rowHeight: 84,
        gap: 16,
        items: [
          { panelId: "history-timeline", panelType: "history-timeline", x: 0, y: 0, w: 7, h: 8, minW: 4, minH: 4 },
          { panelId: "history-evidence", panelType: "history-evidence", x: 7, y: 0, w: 5, h: 5, minW: 3, minH: 3 },
          { panelId: "history-argument", panelType: "history-argument", x: 0, y: 8, w: 8, h: 6, minW: 4, minH: 4 },
          { panelId: "history-myth-checks", panelType: "history-myth-checks", x: 8, y: 8, w: 4, h: 6, minW: 3, minH: 3 },
        ],
      },
      tablet: {
        columns: 8,
        rowHeight: 88,
        gap: 14,
        items: [
          { panelId: "history-timeline", panelType: "history-timeline", x: 0, y: 0, w: 8, h: 6, minW: 4, minH: 4 },
          { panelId: "history-evidence", panelType: "history-evidence", x: 0, y: 6, w: 8, h: 5, minW: 4, minH: 3 },
          { panelId: "history-argument", panelType: "history-argument", x: 0, y: 11, w: 8, h: 5, minW: 4, minH: 4 },
          { panelId: "history-myth-checks", panelType: "history-myth-checks", x: 0, y: 16, w: 8, h: 4, minW: 4, minH: 3 },
        ],
      },
      mobile: {
        columns: 4,
        rowHeight: 104,
        gap: 12,
        items: [
          { panelId: "history-timeline", panelType: "history-timeline", x: 0, y: 0, w: 4, h: 5, minW: 4, minH: 3 },
          { panelId: "history-evidence", panelType: "history-evidence", x: 0, y: 5, w: 4, h: 4, minW: 4, minH: 3 },
          { panelId: "history-argument", panelType: "history-argument", x: 0, y: 9, w: 4, h: 5, minW: 4, minH: 4 },
          { panelId: "history-myth-checks", panelType: "history-myth-checks", x: 0, y: 14, w: 4, h: 4, minW: 4, minH: 3 },
        ],
      },
    },
  },
  {
    id: "history-timeline-focus",
    suiteTemplateId: SYSTEM_SUITE_IDS.historyDemo,
    title: "History Timeline Focus",
    description: "A chronology-first preset with evidence and argument nearby.",
    style: "flexible",
    lockMode: "locked",
    requiredPanels: ["history-timeline", "history-evidence", "history-argument"],
    breakpoints: {
      desktop: {
        columns: 12,
        rowHeight: 84,
        gap: 16,
        items: [
          { panelId: "history-timeline", panelType: "history-timeline", x: 0, y: 0, w: 8, h: 10, minW: 5, minH: 5 },
          { panelId: "history-evidence", panelType: "history-evidence", x: 8, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
          { panelId: "history-argument", panelType: "history-argument", x: 8, y: 5, w: 4, h: 5, minW: 3, minH: 4 },
        ],
      },
    },
  },
  {
    id: "history-source-evidence",
    suiteTemplateId: SYSTEM_SUITE_IDS.historyDemo,
    title: "History Source Evidence",
    description: "Source-first preset for close reading, evidence storage, and claim testing.",
    style: "flexible",
    lockMode: "locked",
    requiredPanels: ["history-evidence", "history-argument", "lesson"],
    breakpoints: {
      desktop: {
        columns: 12,
        rowHeight: 84,
        gap: 16,
        items: [
          { panelId: "lesson", panelType: "lesson", x: 0, y: 0, w: 4, h: 9, minW: 4, minH: 5 },
          { panelId: "history-evidence", panelType: "history-evidence", x: 4, y: 0, w: 4, h: 9, minW: 4, minH: 5 },
          { panelId: "history-argument", panelType: "history-argument", x: 8, y: 0, w: 4, h: 9, minW: 3, minH: 5 },
        ],
      },
    },
  },
  {
    id: "history-argument-builder",
    suiteTemplateId: SYSTEM_SUITE_IDS.historyDemo,
    title: "History Argument Builder",
    description: "A writing-heavy layout with evidence and chronology still reachable.",
    style: "flexible",
    lockMode: "locked",
    requiredPanels: ["history-argument", "history-evidence", "history-timeline"],
    breakpoints: {
      desktop: {
        columns: 12,
        rowHeight: 84,
        gap: 16,
        items: [
          { panelId: "history-argument", panelType: "history-argument", x: 0, y: 0, w: 7, h: 10, minW: 5, minH: 5 },
          { panelId: "history-evidence", panelType: "history-evidence", x: 7, y: 0, w: 5, h: 5, minW: 4, minH: 4 },
          { panelId: "history-timeline", panelType: "history-timeline", x: 7, y: 5, w: 5, h: 5, minW: 4, minH: 4 },
        ],
      },
    },
  },
  {
    id: "history-full-studio",
    suiteTemplateId: SYSTEM_SUITE_IDS.historyDemo,
    title: "History Full Studio",
    description: "The most expansive history preset, balancing source, timeline, argument, and myth evaluation.",
    style: "full-studio",
    lockMode: "locked",
    requiredPanels: ["lesson", "history-timeline", "history-evidence", "history-argument", "history-myth-checks"],
    breakpoints: {
      desktop: {
        columns: 12,
        rowHeight: 84,
        gap: 16,
        items: [
          { panelId: "lesson", panelType: "lesson", x: 0, y: 0, w: 3, h: 6, minW: 3, minH: 4 },
          { panelId: "history-timeline", panelType: "history-timeline", x: 3, y: 0, w: 5, h: 6, minW: 4, minH: 4 },
          { panelId: "history-evidence", panelType: "history-evidence", x: 8, y: 0, w: 4, h: 6, minW: 3, minH: 4 },
          { panelId: "history-argument", panelType: "history-argument", x: 0, y: 6, w: 8, h: 6, minW: 5, minH: 5 },
          { panelId: "history-myth-checks", panelType: "history-myth-checks", x: 8, y: 6, w: 4, h: 6, minW: 3, minH: 4 },
        ],
      },
    },
  },
];

export const knownSystemBinderIds = new Set<string>(Object.values(SYSTEM_BINDER_IDS));
export const knownSystemSuiteIds = new Set<string>(Object.values(SYSTEM_SUITE_IDS));
