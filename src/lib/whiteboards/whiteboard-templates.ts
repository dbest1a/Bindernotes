import type { WhiteboardTemplate } from "@/lib/whiteboards/whiteboard-types";
import type { ExcalidrawElement, ExcalidrawLinearElement, ExcalidrawRectangleElement, ExcalidrawTextElement } from "@excalidraw/excalidraw/element/types";

// Native editable shapes keep the heavy Excalidraw runtime lazy-loaded.
export function createStarterElements(templateId: string, title: string, areas: Array<[string, string]>, diagram?: "graph" | "triangle" | "circle"): ExcalidrawElement[] {
  let sequence = 0;
  const elements: ExcalidrawElement[] = [];
  function base(x: number, y: number, width: number, height: number): Omit<ExcalidrawRectangleElement, "type"> {
    const index = ++sequence;
    return {
      id: `${templateId}-${index}`, x, y, width, height, angle: 0 as ExcalidrawElement["angle"],
      strokeColor: "#1e293b", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 2,
      strokeStyle: "solid", roundness: null, roughness: 0, opacity: 100,
      seed: index * 137, version: 1, versionNonce: index * 173, index: null,
      isDeleted: false, groupIds: [], frameId: null, boundElements: null, updated: 1, link: null, locked: false,
    };
  }
  function text(value: string, x: number, y: number, width = 430, fontSize = 18) {
    const element: ExcalidrawTextElement = {
      ...base(x, y, width, value.split("\n").length * fontSize * 1.25), type: "text",
      text: value, originalText: value, fontSize, fontFamily: 2, textAlign: "left", verticalAlign: "top",
      containerId: null, autoResize: false, lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
    };
    elements.push(element);
  }
  function line(x: number, y: number, points: Array<[number, number]>) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    elements.push({
      ...base(x, y, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
      type: "line", points: points.map((point) => point as ExcalidrawLinearElement["points"][number]),
      lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null,
    });
  }
  text(title, 64, 40, 1000, 30);
  for (const [index, [heading, prompt]] of areas.entries()) {
    const x = 64 + (index % 2) * 512;
    const y = 112 + Math.floor(index / 2) * 272;
    elements.push({ ...base(x, y, 480, 240), type: "rectangle", backgroundColor: "#f8fafc" });
    text(heading, x + 20, y + 18, 440, 22);
    text(prompt, x + 20, y + 56, 440, 16);
  }
  if (diagram) {
    // A separate large diagram area leaves room to work below the guided prompts.
    text(diagram === "circle" ? "Unit circle: (x, y) = (cos θ, sin θ)" : "Sketch & annotate", 84, 700, 900, 22);
    if (diagram === "triangle") {
      line(244, 1040, [[0, 0], [200, -240], [400, 0], [0, 0]]);
      text("A", 222, 1052, 24); text("B", 434, 766, 24); text("C", 650, 1052, 24);
    } else {
      line(244, 950, [[0, 0], [400, 0]]);
      line(444, 750, [[0, 0], [0, 400]]);
      text("x", 660, 940, 24); text("y", 454, 730, 24);
      if (diagram === "circle") {
        elements.push({ ...base(284, 790, 320, 320), type: "ellipse" });
        text("(1, 0)", 608, 966, 80, 16); text("(0, 1)", 454, 766, 80, 16);
        text("(-1, 0)", 214, 966, 80, 16); text("(0, -1)", 454, 1118, 80, 16);
      }
    }
  }
  return elements;
}

const templateContent: Record<string, { areas: Array<[string, string]>; diagram?: "graph" | "triangle" | "circle" }> = {
  "equation-solving": { areas: [
    ["1. Problem & givens", "Write the equation and any restrictions."],
    ["2. Solve step by step", "Show the operation on both sides."],
    ["3. Check", "Substitute into the original equation."],
    ["4. Final answer", "State the solution, units, and restrictions."],
  ] },
  "function-transformations": { areas: [
    ["Parent function", "f(x) =\nMark key points before transforming."],
    ["Transformation rule", "g(x) = a f(b(x - h)) + k\nTrack a, b, h, and k."],
    ["Predict the change", "Shifts • stretches • reflections\nHow does each key point move?"],
    ["Verify & explain", "Compare domain, range, and intercepts.\nUse a sketch or add a live graph."],
  ] },
  "graph-annotation": { diagram: "graph", areas: [
    ["Function & scale", "Write the function. Label the axes below."],
    ["Intercepts & asymptotes", "x-intercepts:\ny-intercept:\nAsymptotes:"],
    ["Intervals", "Increasing / decreasing:\nPositive / negative:"],
    ["Behavior", "Domain / range:\nEnd behavior:"],
  ] },
  "geometry-diagram": { diagram: "triangle", areas: [
    ["Given", "Mark equal lengths, angles, and parallel lines."],
    ["Find / prove", "What must the diagram help establish?"],
    ["Relationships", "Record useful angle and length relationships."],
    ["Reasoning", "Link each step to a fact in the diagram."],
  ] },
  "proof-builder": { areas: [
    ["Claim & assumptions", "Given:\nProve:"],
    ["Plan", "Choose a direct proof, contradiction,\nor another suitable method."],
    ["Statements", "1.\n\n2.\n\n3."],
    ["Reasons / theorems", "Justify each corresponding statement.\nExplain why the conclusion proves the claim."],
  ] },
  "unit-circle": { diagram: "circle", areas: [
    ["Angle", "θ in degrees:\nθ in radians:\nReference angle:"],
    ["Coordinates & trig values", "cos θ =\nsin θ =\ntan θ = sin θ / cos θ (when cos θ ≠ 0)"],
    ["Symmetry", "Reflect your point into the other quadrants."],
    ["Check", "Radius = 1\nVerify cos² θ + sin² θ = 1."],
  ] },
  "test-review": { areas: [
    ["Key ideas & formulas", "Recall these without looking at your notes."],
    ["Worked example", "Explain why each step is valid."],
    ["Mistakes to watch for", "Record the error and its warning sign."],
    ["Retry from memory", "Set a similar problem.\nCheck your answer, then mark confidence."],
  ] },
  "error-correction": { areas: [
    ["Original attempt", "Copy the work and circle the first error."],
    ["Corrected solution", "Rewrite the solution from that point."],
    ["Why it went wrong", "Name the assumption, rule, or calculation."],
    ["Prevention & retry", "Write a quick check for next time.\nTry a new example independently."],
  ] },
};

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
].map((template) => ({
  ...template,
  subject: "math" as const,
  // Fresh objects prevent edits in one board from changing future templates.
  get starterElements() {
    const content = templateContent[template.id];
    return content ? createStarterElements(template.id, template.name, content.areas, content.diagram) : [];
  },
}));
