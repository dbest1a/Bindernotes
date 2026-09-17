// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { saveQueue } from "@/lib/save-queue";
import { reviewOwnerA, reviewOwnerB } from "@/test/review-cloud-fixture";
import { createFormulaTheoremCard, createProblemLogEntry, saveStudyGraphLink, mathStudyProblemLogsStorageKey } from "./math-study-loop-service";
import { mathLocalArchiveSchema, mergeLocalMathArchive, readLocalMathArchive } from "./math-local-portability";
beforeEach(() => { window.localStorage.clear(); saveQueue.setAccount(reviewOwnerA); });
afterEach(() => saveQueue.setAccount(null));
function seed() {
  const graph = saveStudyGraphLink({ betaEnabled: true, ownerId: reviewOwnerA, mode: "2d", title: "Parabola", reflection: "Positive curvature", desmosState: { expressions: { list: [{ id: "a", latex: "y=x^2" }] }, graph: { viewport: { xmin: -5, xmax: 5 } } }, expressions: [{ latex: "y=x^2" }], noteId: "note-1" });
  const formula = createFormulaTheoremCard({ betaEnabled: true, ownerId: reviewOwnerA, kind: "formula", title: "Power rule", statement: "nx^(n-1)", plainEnglishMeaning: "Multiply by exponent", exampleProblem: "x^2", commonMistake: "Forget coefficient", proofIdea: "Limit", graphLinkId: graph.id, reviewItemId: "cloud-card-1" });
  createProblemLogEntry({ betaEnabled: true, ownerId: reviewOwnerA, problemTitle: "Derivative", source: "Section2", attempt: "x", finalAnswer: "2x", mistakeType: "formula_misuse", confidence: 2, conceptTags: ["derivatives"], formulaCardIds: [formula.id], graphLinkId: graph.id });
  return readLocalMathArchive(reviewOwnerA);
}
it("round-trips complete Math source work and references onto an empty device", () => {
  const archive = seed(); window.localStorage.clear();
  expect(mergeLocalMathArchive(reviewOwnerA, archive)).toEqual({ added: 3, unchanged: 0, conflicts: [] });
  expect(readLocalMathArchive(reviewOwnerA)).toEqual(archive);
  expect(mergeLocalMathArchive(reviewOwnerA, archive)).toEqual({ added: 0, unchanged: 3, conflicts: [] });
});
it("refuses mismatched owners, duplicates, malformed JSON, nonfinite graph numbers and unsafe/deep data", () => {
  const archive = seed();
  expect(() => mergeLocalMathArchive(reviewOwnerB, archive)).toThrow(/owns/);
  expect(mathLocalArchiveSchema.safeParse({ ...archive, ownerId: reviewOwnerB }).success).toBe(false);
  expect(mathLocalArchiveSchema.safeParse({ ...archive, problemLogs: [...archive.problemLogs, ...archive.problemLogs] }).success).toBe(false);
  for (const state of [{ x: Infinity }, JSON.parse('{"__proto__":{"polluted":true}}'), { x: () => 1 }]) {
    expect(mathLocalArchiveSchema.safeParse({ ...archive, graphLinks: [{ ...archive.graphLinks[0], desmos_state: state }] }).success).toBe(false);
  }
  let deep: unknown = {}; for (let i = 0; i < 32; i++) deep = { nested: deep };
  expect(mathLocalArchiveSchema.safeParse({ ...archive, graphLinks: [{ ...archive.graphLinks[0], desmos_state: deep }] }).success).toBe(false);
  window.localStorage.setItem(mathStudyProblemLogsStorageKey(reviewOwnerA), "{broken");
  expect(() => readLocalMathArchive(reviewOwnerA)).toThrow(/invalid/);
  expect(window.localStorage.getItem(mathStudyProblemLogsStorageKey(reviewOwnerA))).toBe("{broken");
});
it("reports same-ID conflicts before writing any group", () => {
  const archive = seed(), before = { ...window.localStorage };
  const incoming = { ...archive, problemLogs: [{ ...archive.problemLogs[0], attempt: "Different device answer" }] };
  expect(mergeLocalMathArchive(reviewOwnerA, incoming)).toMatchObject({ added: 0, conflicts: [{ kind: "problemLogs", id: archive.problemLogs[0].id }] });
  expect({ ...window.localStorage }).toEqual(before);
});
it("rolls back a partial storage failure and does not report successful import", () => {
  const archive = seed(); window.localStorage.clear(); let writes = 0;
  const storage = { getItem: window.localStorage.getItem.bind(window.localStorage), removeItem: window.localStorage.removeItem.bind(window.localStorage), setItem(key: string, value: string) { if (++writes === 3) throw new Error("Quota full"); window.localStorage.setItem(key, value); } };
  expect(() => mergeLocalMathArchive(reviewOwnerA, archive, storage)).toThrow(/could not finish/);
  expect(readLocalMathArchive(reviewOwnerA)).toEqual({ schemaVersion: 1, ownerId: reviewOwnerA, problemLogs: [], formulaCards: [], graphLinks: [] });
});
