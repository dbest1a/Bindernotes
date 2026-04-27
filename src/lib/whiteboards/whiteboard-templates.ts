import type { WhiteboardTemplate } from "@/lib/whiteboards/whiteboard-types";

export const mathWhiteboardTemplates: WhiteboardTemplate[] = [
  {
    id: "blank-board",
    name: "Blank Board",
    description: "A clean graph-paper style space for any math scratch work.",
    subject: "math",
  },
  {
    id: "equation-solving",
    name: "Equation Solving",
    description: "Set up givens, steps, checks, and final answer frames.",
    subject: "math",
  },
  {
    id: "function-transformations",
    name: "Function Transformations",
    description: "Map parent functions, shifts, stretches, reflections, and examples.",
    subject: "math",
  },
  {
    id: "graph-annotation",
    name: "Graph Annotation",
    description: "Explain intercepts, asymptotes, intervals, and behavior around a graph.",
    subject: "math",
  },
  {
    id: "geometry-diagram",
    name: "Geometry Diagram",
    description: "Sketch diagrams, mark givens, and connect proof steps to the figure.",
    subject: "math",
  },
  {
    id: "proof-builder",
    name: "Proof Builder",
    description: "Separate claim, reason, theorem, and contradiction paths.",
    subject: "math",
  },
  {
    id: "unit-circle",
    name: "Unit Circle",
    description: "Organize angles, coordinates, trig values, and symmetry notes.",
    subject: "math",
  },
  {
    id: "test-review",
    name: "Test Review",
    description: "Group mistakes, formulas, examples, and retry prompts before a quiz.",
    subject: "math",
  },
  {
    id: "error-correction",
    name: "Error Correction",
    description: "Compare the wrong path, the fix, and the rule that prevents the mistake next time.",
    subject: "math",
  },
];
