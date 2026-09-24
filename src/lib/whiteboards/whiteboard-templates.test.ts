import { describe, expect, it } from "vitest";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { mathWhiteboardTemplates } from "@/lib/whiteboards/whiteboard-templates";
import { createLocalWhiteboard } from "@/lib/whiteboards/whiteboard-storage";

describe("whiteboard starter templates", () => {
  it("creates editable labeled work areas for every named workflow while leaving Blank Board empty", () => {
    expect(mathWhiteboardTemplates[0].starterElements).toEqual([]);
    for (const template of mathWhiteboardTemplates.slice(1)) {
      const board = createLocalWhiteboard({ ownerId: "learner", binderId: "math", lessonId: null }, { template });
      const elements = board.scene.elements as ExcalidrawElement[];
      expect(elements.length, template.name).toBeGreaterThanOrEqual(13);
      expect(elements.filter((element) => element.type === "rectangle")).toHaveLength(4);
      expect(elements.some((element) => element.type === "text" && element.text === template.name)).toBe(true);
      expect(board.objectCount).toBe(elements.length);
      expect(new Set(elements.map((element) => element.id)).size).toBe(elements.length);
      for (const element of elements) {
        expect(element.locked).toBe(false);
        expect(element.isDeleted).toBe(false);
        expect(Number.isFinite(element.width) && Number.isFinite(element.height)).toBe(true);
        expect(element.strokeColor).toBeTruthy();
        expect(element.version).toBe(1);
        if (element.type === "text") expect(element.text.trim()).not.toBe("");
      }
    }
  });

  it("provides mathematical diagrams and specific prompts rather than repeating empty frames", () => {
    const circle = mathWhiteboardTemplates.find((template) => template.id === "unit-circle")!.starterElements as ExcalidrawElement[];
    expect(circle.some((element) => element.type === "ellipse" && element.width === element.height)).toBe(true);
    expect(circle.filter((element) => element.type === "line")).toHaveLength(2);
    expect(circle.some((element) => element.type === "text" && element.text.includes("cos θ ≠ 0"))).toBe(true);
    const proof = mathWhiteboardTemplates.find((template) => template.id === "proof-builder")!.starterElements as ExcalidrawElement[];
    expect(proof.some((element) => element.type === "text" && element.text === "Reasons / theorems")).toBe(true);
  });

  it("does not share mutable starter shapes across new boards", () => {
    const template = mathWhiteboardTemplates.find((candidate) => candidate.id === "equation-solving")!;
    const first = template.starterElements as Array<{ x: number }>;
    first[0].x = 9000;
    const second = template.starterElements as Array<{ x: number }>;
    expect(second[0].x).toBe(64);
    expect(second[0]).not.toBe(first[0]);
  });
});
