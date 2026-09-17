import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { parseFiniteDecimal } from "@/lib/finite-number";

const finite = z.number().finite();
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
export const chemistryNotebookSchema = z.object({
  hypothesis: z.string().max(20000), procedure: z.string().max(20000), dataTable: z.string().max(20000),
  calculations: z.string().max(20000), observations: z.string().max(20000),
  errorAnalysis: z.string().max(20000), conclusion: z.string().max(20000),
});
export const chemistryActivitySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("stoichiometry"), version: z.literal(1),
    template: z.literal("template-water-from-hydrogen"),
    givenQuantity: z.string().max(200).refine((value) => (parseFiniteDecimal(value) ?? 0) > 0),
    result: z.object({
      balancedEquation: z.string().min(1).max(500),
      finalAnswer: z.object({ value: finite.positive(), unit: z.literal("g"), formula: z.literal("H2O") }),
      steps: z.array(z.object({
        kind: z.enum(["balance_equation", "given_to_moles", "mole_ratio", "moles_to_target"]),
        label: z.string().max(2000), value: finite, unit: z.string().max(100),
      })).max(12),
      conceptTags: z.array(z.string().max(100)).max(30),
    }),
  }),
  z.object({
    kind: z.literal("titration"), version: z.literal(1),
    state: z.object({
      labTemplateId: z.literal("acid-base-titration-strong-acid-base"),
      acidFormula: z.literal("HCl"), baseFormula: z.literal("NaOH"),
      // This activity currently supports this one built-in experiment only.
      acidMolarity: z.literal(0.1), acidVolumeMl: z.literal(25), baseMolarity: z.literal(0.1),
      titrantAddedMl: finite.min(0).max(50), ph: finite.min(0).max(14),
      measurements: z.array(z.object({
        titrantVolumeMl: finite.min(0).max(50), ph: finite.min(0).max(14), equivalenceProgress: finite.min(0).max(2),
      })).max(1000),
      notebook: chemistryNotebookSchema, updatedAt: timestamp,
    }),
  }),
  z.object({ kind: z.literal("notebook"), version: z.literal(1), notebook: chemistryNotebookSchema }),
]);
export type ChemistryActivity = z.infer<typeof chemistryActivitySchema>;
export type ChemistryActivityKind = ChemistryActivity["kind"];
export type SavedChemistryActivity = { id: string; ownerId: string; createdAt: string; snapshot: ChemistryActivity };
const tables = { stoichiometry: "user_chem_attempts", titration: "user_lab_runs", notebook: "user_lab_reports" } as const;
const rowSchema = z.object({ id: z.string().uuid(), user_id: z.string().uuid(), created_at: timestamp }).passthrough();
const pageSize = 20;

function parseRecord(value: unknown, ownerId: string, kind: ChemistryActivityKind): SavedChemistryActivity {
  const row = rowSchema.safeParse(value);
  if (!row.success) throw new Error("This saved chemistry activity has invalid data.");
  if (row.data.user_id !== ownerId) throw new Error("This chemistry activity is unavailable for this account.");
  const raw = kind === "stoichiometry" ? row.data.metadata : kind === "titration" ? row.data.checkpoint : row.data.final_result;
  const snapshot = chemistryActivitySchema.safeParse(raw);
  if (!snapshot.success || snapshot.data.kind !== kind) throw new Error("This saved activity uses an unsupported or invalid format. Your current work has been kept.");
  return { id: row.data.id, ownerId, createdAt: row.data.created_at, snapshot: snapshot.data };
}

export async function saveChemistryActivity(input: {
  id: string; ownerId: string; snapshot: ChemistryActivity; signal?: AbortSignal;
}): Promise<SavedChemistryActivity> {
  if (!z.string().uuid().safeParse(input.ownerId).success || !z.string().uuid().safeParse(input.id).success) throw new Error("A signed-in account and valid save ID are required.");
  const parsed = chemistryActivitySchema.safeParse(input.snapshot);
  if (!parsed.success) throw new Error("Check the chemistry inputs before saving. No work was saved.");
  if (!supabase) throw new Error("Account storage is unavailable. Keep this page open and try saving again.");
  input.signal?.throwIfAborted();
  const snapshot = parsed.data;
  // Built-in practice templates are not database foreign keys. Keep provenance in the snapshot.
  const common = { id: input.id, user_id: input.ownerId, binder_id: null, lesson_id: null };
  const payload = snapshot.kind === "stoichiometry"
    ? { ...common, problem_template_id: null, final_answer: snapshot.result.finalAnswer, step_summaries: snapshot.result.steps,
        mistake_tags: [], concept_tags: snapshot.result.conceptTags, metadata: snapshot }
    : snapshot.kind === "titration"
      ? { ...common, lab_template_id: null, status: "checkpoint", checkpoint: snapshot }
      : { ...common, lab_template_id: null, lab_run_id: null, hypothesis: snapshot.notebook.hypothesis,
          procedure: snapshot.notebook.procedure, calculations: snapshot.notebook.calculations, observations: snapshot.notebook.observations,
          error_analysis: snapshot.notebook.errorAnalysis, conclusion: snapshot.notebook.conclusion, final_result: snapshot };
  const query = supabase.from(tables[snapshot.kind]).upsert(payload, { onConflict: "id" }).select("*");
  if (input.signal) query.abortSignal(input.signal);
  const { data, error } = await query.single();
  input.signal?.throwIfAborted();
  if (error) throw new Error("Chemistry could not be saved. Your work is still here; try again.");
  const saved = parseRecord(data, input.ownerId, snapshot.kind);
  if (saved.id !== input.id) throw new Error("The chemistry save could not be confirmed. Please retry.");
  return saved;
}

export async function listChemistryActivities(input: {
  ownerId: string; kind: ChemistryActivityKind; page?: number; signal?: AbortSignal;
}): Promise<{ records: SavedChemistryActivity[]; hasMore: boolean; unsupportedCount: number }> {
  if (!z.string().uuid().safeParse(input.ownerId).success) throw new Error("Sign in to load saved chemistry work.");
  const page = input.page ?? 0;
  if (!Number.isSafeInteger(page) || page < 0) throw new Error("Invalid chemistry history page.");
  if (!supabase) throw new Error("Account storage is unavailable. Saved chemistry work could not be loaded.");
  input.signal?.throwIfAborted();
  const query = supabase.from(tables[input.kind]).select("*").eq("user_id", input.ownerId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * pageSize, page * pageSize + pageSize);
  if (input.signal) query.abortSignal(input.signal);
  const { data, error } = await query;
  input.signal?.throwIfAborted();
  if (error || !Array.isArray(data)) throw new Error("Saved chemistry work could not be loaded. Please retry.");
  const records: SavedChemistryActivity[] = [];
  let unsupportedCount = 0;
  for (const row of data.slice(0, pageSize)) {
    // Fail closed on owner mismatches; skip legacy formats visibly without destroying them.
    if (!row || row.user_id !== input.ownerId) throw new Error("Saved chemistry work is unavailable for this account.");
    try { records.push(parseRecord(row, input.ownerId, input.kind)); } catch { unsupportedCount += 1; }
  }
  return { records, hasMore: data.length > pageSize, unsupportedCount };
}
