export const roleVerificationQaIssues = ["BN-QA-001", "BN-QA-002"] as const;

export const revampBetaQaIssueMap = {
  "BN-QA-003": {
    area: "Split Study",
    gate: "Revamp Beta",
    summary: "Split Study should become a true side-by-side source and notes workspace.",
  },
  "BN-QA-004": {
    area: "Study Panels",
    gate: "Revamp Beta",
    summary: "Study Panel tabs must activate reliably and reflect the visible panel.",
  },
  "BN-QA-005": {
    area: "Math Tools",
    gate: "Revamp Beta",
    summary: "Desmos graph and calculator need normal visible inputs students can use.",
  },
  "BN-QA-006": {
    area: "Whiteboard",
    gate: "Revamp Beta",
    summary: "New blank board needs a safe path when the account is at the 3/3 board limit.",
  },
  "BN-QA-007": {
    area: "Performance",
    gate: "Revamp Beta",
    summary: "Heavy mode and preset switches should avoid slow loading states.",
  },
  "BN-QA-008": {
    area: "Settings Search",
    gate: "Revamp Beta",
    summary: "Settings search should rank exact labels and common study terms first.",
  },
  "BN-QA-009": {
    area: "Private Notes",
    gate: "Revamp Beta",
    summary: "Note title and body should stay visually and accessibly separated.",
  },
  "BN-QA-010": {
    area: "Autosave",
    gate: "Revamp Beta",
    summary: "Save/autosave states should make it clear whether work is safe.",
  },
  "BN-QA-011": {
    area: "Binder Cards",
    gate: "Revamp Beta",
    summary: "Binder cards should avoid showing long private note text inline.",
  },
  "BN-QA-012": {
    area: "Simple Mode",
    gate: "Revamp Beta",
    summary: "Simple mode should not duplicate Settings and Focus controls.",
  },
  "BN-QA-013": {
    area: "Dashboard Search",
    gate: "Revamp Beta",
    summary: "Dashboard no-results should explain scope and give a reset path.",
  },
  "BN-QA-014": {
    area: "Desmos Accessibility",
    gate: "Revamp Beta",
    summary: "Desmos keypad should not dominate accessibility or performance by default.",
  },
  "BN-QA-015": {
    area: "Whiteboard Context",
    gate: "Revamp Beta",
    summary: "Math lessons should not open on unrelated saved boards by default.",
  },
  "BN-QA-016": {
    area: "History Studio",
    gate: "Revamp Beta",
    summary: "History Full Studio should reduce density and close settings after mode changes.",
  },
  "BN-QA-017": {
    area: "Tools / Extras",
    gate: "Revamp Beta",
    summary: "Tools Extra should either be renamed or become a true tool launcher.",
  },
  "BN-QA-018": {
    area: "Console Noise",
    gate: "Revamp Beta",
    summary: "Heavy math warnings should be filtered, reduced, or traced to app-origin issues.",
  },
  "BN-QA-019": {
    area: "Formula Sheet",
    gate: "Revamp Beta",
    summary: "Formula copy needs stronger feedback after a successful copy.",
  },
  "BN-QA-020": {
    area: "Saved Graphs",
    gate: "Revamp Beta",
    summary: "Saved graphs empty state should offer a next-step path.",
  },
} as const;
