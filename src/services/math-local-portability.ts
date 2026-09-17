import { z } from "zod";
import { saveQueue } from "@/lib/save-queue";
import {
  mathStudyFormulaCardsStorageKey,
  mathStudyGraphLinksStorageKey,
  mathStudyProblemLogsStorageKey,
} from "./math-study-loop-service";

const id = z.string().min(1).max(2000),
  text = z.string().max(100000),
  timestamp = z.string().datetime({ offset: true });
const base = { id, owner_id: z.string().uuid(), created_at: timestamp, updated_at: timestamp };
export const mathProblemLogArchiveSchema = z
  .object({
    ...base,
    problem_title: text,
    source: text,
    binder_id: id.nullable(),
    binder_title: text.nullable(),
    course_id: id.nullable(),
    course_title: text.nullable(),
    concept_tags: z.array(z.string().max(500)).max(200),
    attempt: text,
    final_answer: text,
    mistake_type: z.enum([
      "algebra_error",
      "setup_error",
      "concept_misunderstanding",
      "graph_interpretation",
      "formula_misuse",
      "arithmetic",
      "proof_gap",
      "notation",
      "other",
    ]),
    graph_link_id: id.nullable(),
    formula_card_ids: z.array(id).max(10000),
    review_due_at: timestamp.nullable(),
    confidence: z.number().int().min(1).max(5),
    linked_review_item_id: id.nullable(),
  })
  .strict();
export const mathFormulaCardArchiveSchema = z
  .object({
    ...base,
    kind: z.enum(["formula", "theorem"]),
    title: text,
    statement: text,
    plain_english_meaning: text,
    example_problem: text,
    common_mistake: text,
    proof_idea: text.nullable(),
    graph_link_id: id.nullable(),
    linked_review_item_id: id.nullable(),
  })
  .strict();

// Opaque calculator JSON is retained without executing or interpreting expressions.
// Bound depth, size, keys and finite numbers before it can reach a restore/export path.
function validCalculatorState(value: unknown): boolean {
  let nodes = 0;
  const ancestors = new Set<object>();
  function visit(current: unknown, depth: number): boolean {
    if (++nodes > 100000 || depth > 30) return false;
    if (current === null || typeof current === "boolean") return true;
    if (typeof current === "number") return Number.isFinite(current);
    if (typeof current === "string") return current.length <= 1000000;
    if (typeof current !== "object" || ancestors.has(current)) return false;
    ancestors.add(current);
    const valid = Array.isArray(current)
      ? current.every((child) => visit(child, depth + 1))
      : Object.getPrototypeOf(current) === Object.prototype &&
        Object.entries(current).every(
          ([key, child]) =>
            !["__proto__", "constructor", "prototype"].includes(key) && visit(child, depth + 1),
        );
    ancestors.delete(current);
    return valid;
  }
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    visit(value, 0) &&
    JSON.stringify(value).length <= 2000000
  );
}
export const mathGraphLinkArchiveSchema = z
  .object({
    ...base,
    graph_state_id: id,
    title: text,
    mode: z.enum(["2d", "3d"]),
    desmos_state: z.unknown().refine(validCalculatorState, "Invalid or oversized calculator state"),
    expressions: z.array(z.object({ id: id.optional(), latex: text }).strict()).max(10000),
    reflection: text,
    problem_log_id: id.nullable(),
    formula_card_id: id.nullable(),
    note_id: id.nullable(),
  })
  .strict();
export const mathLocalArchiveSchema = z
  .object({
    schemaVersion: z.literal(1),
    ownerId: z.string().uuid(),
    problemLogs: z.array(mathProblemLogArchiveSchema).max(10000),
    formulaCards: z.array(mathFormulaCardArchiveSchema).max(10000),
    graphLinks: z.array(mathGraphLinkArchiveSchema).max(10000),
  })
  .strict()
  .superRefine((archive, context) => {
    for (const group of [archive.problemLogs, archive.formulaCards, archive.graphLinks]) {
      const seen = new Set<string>();
      for (const item of group) {
        if (item.owner_id !== archive.ownerId || seen.has(item.id))
          context.addIssue({ code: "custom", message: "Math archive owner or duplicate identity mismatch" });
        seen.add(item.id);
      }
    }
  });
export type MathLocalArchive = z.infer<typeof mathLocalArchiveSchema>;
type MathStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const keys = (ownerId: string) => ({
  problemLogs: mathStudyProblemLogsStorageKey(ownerId),
  formulaCards: mathStudyFormulaCardsStorageKey(ownerId),
  graphLinks: mathStudyGraphLinksStorageKey(ownerId),
});
function active(ownerId: string) {
  if (saveQueue.getAccount() !== ownerId) throw new Error("Sign in to the account that owns this Math work.");
}
function readArray(storage: MathStorage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  if (raw.length > 20000000) throw new Error("Math device data is oversized. Its original has been kept.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Math device data is invalid. Its original has been kept.");
  }
}
/** Nonreview Math data is still device-local. This is portable backup support, not cloud sync. */
export function readLocalMathArchive(
  ownerId: string,
  storage: MathStorage = window.localStorage,
): MathLocalArchive {
  active(ownerId);
  const names = keys(ownerId);
  return mathLocalArchiveSchema.parse({
    schemaVersion: 1,
    ownerId,
    problemLogs: readArray(storage, names.problemLogs),
    formulaCards: readArray(storage, names.formulaCards),
    graphLinks: readArray(storage, names.graphLinks),
  });
}
/** Validate all groups before writing; never replace a differing record with the same ID. */
export function mergeLocalMathArchive(
  ownerId: string,
  raw: unknown,
  storage: MathStorage = window.localStorage,
) {
  active(ownerId);
  const incoming = mathLocalArchiveSchema.parse(raw);
  if (incoming.ownerId !== ownerId)
    throw new Error("Math archive owner mismatch. Remap the archive explicitly before importing.");
  const current = readLocalMathArchive(ownerId, storage),
    names = keys(ownerId);
  const report = { added: 0, unchanged: 0, conflicts: [] as Array<{ kind: keyof typeof names; id: string }> };
  const writes: Array<{ key: string; before: string | null; after: string }> = [];
  for (const kind of ["problemLogs", "formulaCards", "graphLinks"] as const) {
    const existing = new Map(current[kind].map((item) => [item.id, item]));
    const additions: unknown[] = [];
    for (const item of incoming[kind]) {
      const prior = existing.get(item.id);
      if (!prior) {
        additions.push(item);
        report.added += 1;
      } else if (JSON.stringify(prior) === JSON.stringify(item)) report.unchanged += 1;
      else report.conflicts.push({ kind, id: item.id });
    }
    const after = JSON.stringify([...current[kind], ...additions]);
    if (after.length > 20000000) throw new Error("Combined Math device data exceeds the import limit.");
    writes.push({ key: names[kind], before: storage.getItem(names[kind]), after });
  }
  if (report.conflicts.length) return { ...report, added: 0 };
  const journalKey = `bindernotes:math-local-import-backup:v1:${ownerId}`;
  const backup = JSON.stringify(writes.map(({ key, before }) => ({ key, before })));
  if (storage.getItem(journalKey) !== null)
    throw new Error("An interrupted Math import has a device backup. Recover it before importing again.");
  storage.setItem(journalKey, backup);
  try {
    active(ownerId);
    for (const write of writes) storage.setItem(write.key, write.after);
    storage.removeItem(journalKey);
  } catch {
    try {
      for (const write of writes) {
        if (write.before === null) storage.removeItem(write.key);
        else storage.setItem(write.key, write.before);
      }
      storage.removeItem(journalKey);
    } catch {
      /* The backup remains for explicit recovery. */
    }
    throw new Error(
      "Math import could not finish. Check the retained device backup before retrying; the original archive is unchanged.",
    );
  }
  return report;
}
