import { describe, expect, it } from "vitest";
import {
  buildChemAttemptPayload,
  buildLabRunPayload,
  estimateChemistryPayloadBytes,
} from "@/services/chemistry-service";
import { createTitrationInitialState, titrationReducer } from "@/lib/chemistry/titration-lab";

describe("chemistry service payload guards", () => {
  it("stores small chemistry attempt summaries without private scratch text", () => {
    const payload = buildChemAttemptPayload({
      userId: "00000000-0000-0000-0000-000000000001",
      binderId: "binder-chemistry",
      lessonId: "lesson-stoich",
      problemTemplateId: "template-water",
      finalAnswer: { value: 36.03, unit: "g", formula: "H2O" },
      conceptTags: ["stoichiometry"],
      mistakeTags: ["skipped_mole_bridge"],
      stepSummaries: [
        { kind: "given_to_moles", label: "Convert grams H2 to moles.", value: 2, unit: "mol" },
      ],
      privateScratchText: "This text should never be saved.",
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("This text should never be saved.");
    expect(estimateChemistryPayloadBytes(payload)).toBeLessThan(2500);
  });

  it("stores lab checkpoints and final reports without per-frame simulation logs", () => {
    const state = titrationReducer(createTitrationInitialState(), { type: "add_titrant", volumeMl: 5 });
    const payload = buildLabRunPayload({
      userId: "00000000-0000-0000-0000-000000000001",
      binderId: "binder-chemistry",
      lessonId: "lesson-titration",
      labTemplateId: "acid-base-titration-strong-acid-base",
      state,
      status: "checkpoint",
    });

    expect(payload.checkpoint.measurements).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toMatch(/frame|pointer|mousemove/i);
    expect(estimateChemistryPayloadBytes(payload)).toBeLessThan(5000);
  });
});
