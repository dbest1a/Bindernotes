import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogSeedClient } from "@/services/system-seed-service";
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

type SeedTable = "math_courses" | "math_topics" | "math_modules" | "question_bank" | "question_choices";

export async function seedMathLearningWithClient(client: CatalogSeedClient): Promise<MathSeedResult> {
  const { error } = await client.rpc("apply_catalog_seed", {
    p_payload: {
      math_courses: mathSeedCourses,
      math_topics: mathSeedTopics,
      math_modules: mathSeedModules,
      question_bank: mathSeedQuestions,
      question_choices: mathSeedChoices,
    },
  });
  if (error) throw new Error(`Transactional math seed failed: ${error.message}`);

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

async function countRows(client: SupabaseClient, table: SeedTable) {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}
