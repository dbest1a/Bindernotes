import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { SYSTEM_BINDER_IDS, systemSuiteTemplates } from "../src/lib/history-suite-seeds";

type CountResult = {
  label: string;
  count: number;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const suiteIds = systemSuiteTemplates.map((suite) => suite.id);
  const binderIds = Object.values(SYSTEM_BINDER_IDS);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const countQuery = async (
    label: string,
    query: PromiseLike<{
      count: number | null;
      error: { code?: string | null; message: string; details?: string | null; hint?: string | null } | null;
    }>,
  ): Promise<CountResult> => {
    const { count, error } = await query;
    if (error) {
      if (error.code === "PGRST205" || error.message.toLowerCase().includes("could not find the table")) {
        throw new Error(`${label} is missing from the Supabase schema. Push migrations before seeding.`);
      }
      throw new Error(`${label} check failed: ${error.message}`);
    }
    return { label, count: count ?? 0 };
  };

  const counts = await Promise.all([
    countQuery(
      "suite_templates",
      supabase.from("suite_templates").select("id", { count: "exact", head: true }).in("id", suiteIds),
    ),
    countQuery(
      "seed_versions",
      supabase
        .from("seed_versions")
        .select("id", { count: "exact", head: true })
        .eq("status", "current")
        .in("suite_template_id", suiteIds),
    ),
    countQuery(
      "workspace_presets",
      supabase
        .from("workspace_presets")
        .select("id", { count: "exact", head: true })
        .in("suite_template_id", suiteIds),
    ),
    countQuery(
      "binders",
      supabase.from("binders").select("id", { count: "exact", head: true }).in("id", binderIds),
    ),
    countQuery(
      "binder_lessons",
      supabase.from("binder_lessons").select("id", { count: "exact", head: true }).in("binder_id", binderIds),
    ),
    countQuery(
      "system_folders",
      supabase
        .from("folders")
        .select("id", { count: "exact", head: true })
        .eq("source", "system")
        .in("suite_template_id", suiteIds),
    ),
    countQuery(
      "folder_binders",
      supabase
        .from("folder_binders")
        .select("id", { count: "exact", head: true })
        .in("binder_id", binderIds),
    ),
  ]);

  const zeroCount = counts.find((entry) => entry.count === 0);
  if (zeroCount) {
    throw new Error(`${zeroCount.label} is still zero after the seed step.`);
  }

  console.log("");
  console.log("Binder Notes backend-native seed verification passed.");
  console.table(
    Object.fromEntries(counts.map((entry) => [entry.label, entry.count])),
  );
}

main().catch((error) => {
  console.error("");
  console.error("Binder Notes backend-native seed verification failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
