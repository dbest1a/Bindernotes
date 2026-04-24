import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mathSeedChoices,
  mathSeedCourses,
  mathSeedModules,
  mathSeedQuestions,
  mathSeedTopics,
} from "@/lib/math-learning-seeds";

export type MathSeedCounts = {
  courses: number;
  topics: number;
  modules: number;
  questions: number;
  choices: number;
};

export type MathSeedResult = MathSeedCounts;

type SeedTable =
  | "math_courses"
  | "math_topics"
  | "math_modules"
  | "question_bank"
  | "question_choices";

export async function seedMathLearningWithClient(
  client: SupabaseClient,
): Promise<MathSeedResult> {
  await upsertRows(client, "math_courses", mathSeedCourses, "id");
  await upsertRows(client, "math_topics", mathSeedTopics, "id");
  await upsertRows(client, "math_modules", mathSeedModules, "id");
  await upsertRows(client, "question_bank", mathSeedQuestions, "id");
  await upsertRows(client, "question_choices", mathSeedChoices, "id");

  return {
    courses: mathSeedCourses.length,
    topics: mathSeedTopics.length,
    modules: mathSeedModules.length,
    questions: mathSeedQuestions.length,
    choices: mathSeedChoices.length,
  };
}

export async function getMathSeedCounts(client: SupabaseClient): Promise<MathSeedCounts> {
  const [courses, topics, modules, questions, choices] = await Promise.all([
    countRows(client, "math_courses"),
    countRows(client, "math_topics"),
    countRows(client, "math_modules"),
    countRows(client, "question_bank"),
    countRows(client, "question_choices"),
  ]);

  return {
    courses,
    topics,
    modules,
    questions,
    choices,
  };
}

async function upsertRows(
  client: SupabaseClient,
  table: SeedTable,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).upsert(rows, {
    onConflict,
  });

  if (error) {
    throw new Error(`Failed to seed ${table}: ${error.message}`);
  }
}

async function countRows(client: SupabaseClient, table: SeedTable) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}
