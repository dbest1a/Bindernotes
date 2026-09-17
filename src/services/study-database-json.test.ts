import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: () => {
  let value: unknown;
  const query = {
    upsert: (row: unknown) => { mocks.write(row); value = row; return query; },
    insert: (row: unknown) => { mocks.write(row); value = row; return query; },
    select: () => query,
    single: async () => ({ data: value, error: null }),
    then: (resolve: (result: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: value, error: null }).then(resolve),
  };
  return query;
} } }));
import { saveGraphState, saveQuestion, type QuestionInput } from "./math-learning-service";
import { buildChemAttemptPayload, buildLabRunPayload, saveChemAttempt, saveLabRun } from "./chemistry-service";
import { createTitrationInitialState } from "@/lib/chemistry/titration-lab";
beforeEach(() => mocks.write.mockClear());
describe("typed study writes validate JSON before transport", () => {
  it("preserves valid graph JSON and supports expressions without an optional ID", async () => {
    const desmosState = { version: 11, expressions: { list: [{ id: "one", latex: "y=x^2" }] }, graph: { viewport: { xmin: -2, xmax: 2 } } };
    await saveGraphState({ userId: "learner", title: "Quadratic", calculatorMode: "2d", desmosState, expressions: [{ id: undefined, latex: "y=x^2" }] });
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ desmos_state: desmosState, expressions: [{ latex: "y=x^2" }] }));
  });
  it.each([NaN, Infinity, () => 1])("refuses invalid graph data before writing: %s", async (invalid) => {
    await expect(saveGraphState({ userId: "learner", title: "Invalid", calculatorMode: "2d", desmosState: { invalid } })).rejects.toThrow();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("rejects a non-finite answer key before altering a question or its choices", async () => {
    const input: QuestionInput = { userId: "learner", type: "numeric", promptMarkdown: "Invalid key", answerJson: { expected: Infinity }, difficulty: "foundational", calculatorAllowed: false, status: "draft" };
    await expect(saveQuestion(input)).rejects.toThrow();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("preserves chemistry summaries and rejects non-JSON metadata", async () => {
    const payload = buildChemAttemptPayload({ userId: "learner", conceptTags: ["stoichiometry"], finalAnswer: { value: 36.03, unit: "g", formula: "H2O" }, mistakeTags: [], stepSummaries: [] });
    expect(await saveChemAttempt(payload)).toEqual({ ok: true });
    expect(mocks.write).toHaveBeenCalledWith(payload);
    mocks.write.mockClear();
    await expect(saveChemAttempt({ ...payload, metadata: { invalid: Infinity } })).rejects.toThrow();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("does not serialize a non-finite chemistry checkpoint into null", async () => {
    const payload = buildLabRunPayload({ userId: "learner", labTemplateId: "titration", state: createTitrationInitialState(), status: "checkpoint" });
    payload.checkpoint.ph = NaN;
    await expect(saveLabRun(payload)).rejects.toThrow();
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
