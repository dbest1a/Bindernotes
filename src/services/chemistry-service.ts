import { supabase } from "@/lib/supabase";
import type {
  ChemistryConceptTag,
  ChemistryMistakeTag,
  StoichiometryStepSummary,
  TitrationState,
} from "@/lib/chemistry/chemistry-types";

type SupabaseResult = {
  ok: boolean;
  error?: string;
};

export type ChemAttemptPayload = {
  user_id: string;
  binder_id: string | null;
  lesson_id: string | null;
  problem_template_id: string | null;
  final_answer: {
    value: number;
    unit: string;
    formula: string;
  };
  step_summaries: StoichiometryStepSummary[];
  mistake_tags: ChemistryMistakeTag[];
  concept_tags: ChemistryConceptTag[] | string[];
  metadata: Record<string, unknown>;
};

export type LabRunPayload = {
  user_id: string;
  binder_id: string | null;
  lesson_id: string | null;
  lab_template_id: string;
  status: "checkpoint" | "submitted";
  checkpoint: {
    titrantAddedMl: number;
    ph: number;
    measurements: TitrationState["measurements"];
    notebook: TitrationState["notebook"];
    updatedAt: string;
  };
};

function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message)
    : "Chemistry save failed.";
}

function compactSteps(steps: StoichiometryStepSummary[]) {
  return steps.slice(0, 12).map((step) => ({
    kind: step.kind,
    label: step.label.slice(0, 180),
    value: Number(step.value.toPrecision(8)),
    unit: step.unit.slice(0, 48),
  }));
}

export function buildChemAttemptPayload(input: {
  binderId?: string | null;
  conceptTags: ChemistryConceptTag[] | string[];
  finalAnswer: { value: number; unit: string; formula: string };
  lessonId?: string | null;
  mistakeTags: ChemistryMistakeTag[];
  privateScratchText?: string;
  problemTemplateId?: string | null;
  stepSummaries: StoichiometryStepSummary[];
  userId: string;
}): ChemAttemptPayload {
  return {
    user_id: input.userId,
    binder_id: input.binderId ?? null,
    lesson_id: input.lessonId ?? null,
    problem_template_id: input.problemTemplateId ?? null,
    final_answer: input.finalAnswer,
    step_summaries: compactSteps(input.stepSummaries),
    mistake_tags: input.mistakeTags,
    concept_tags: input.conceptTags,
    metadata: {
      schema: "chem_attempt_v1",
      savedAt: new Date().toISOString(),
    },
  };
}

export function buildLabRunPayload(input: {
  binderId?: string | null;
  labTemplateId: string;
  lessonId?: string | null;
  state: TitrationState;
  status: "checkpoint" | "submitted";
  userId: string;
}): LabRunPayload {
  return {
    user_id: input.userId,
    binder_id: input.binderId ?? null,
    lesson_id: input.lessonId ?? null,
    lab_template_id: input.labTemplateId,
    status: input.status,
    checkpoint: {
      titrantAddedMl: input.state.titrantAddedMl,
      ph: input.state.ph,
      measurements: input.state.measurements.slice(-80),
      notebook: input.state.notebook,
      updatedAt: input.state.updatedAt,
    },
  };
}

export function estimateChemistryPayloadBytes(payload: unknown) {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

export async function saveChemAttempt(payload: ChemAttemptPayload): Promise<SupabaseResult> {
  if (!supabase) {
    return { ok: false, error: "Supabase chemistry storage is not configured." };
  }

  const { error } = await supabase.from("user_chem_attempts").insert(payload);
  return error ? { ok: false, error: errorMessage(error) } : { ok: true };
}

export async function saveLabRun(payload: LabRunPayload): Promise<SupabaseResult> {
  if (!supabase) {
    return { ok: false, error: "Supabase chemistry storage is not configured." };
  }

  const { error } = await supabase.from("user_lab_runs").insert(payload);
  return error ? { ok: false, error: errorMessage(error) } : { ok: true };
}
