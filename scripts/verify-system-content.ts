import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { buildSystemVerificationReport } from "../src/lib/system-content-verification";
import { SYSTEM_BINDER_IDS, systemSuiteTemplates } from "../src/lib/history-suite-seeds";
import type {
  Binder,
  BinderLesson,
  Folder,
  FolderBinderLink,
  Highlight,
  LearnerNote,
} from "../src/types";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

type CountQueryResult = {
  count: number | null;
  error: { code?: string | null; message: string; details?: string | null; hint?: string | null } | null;
};

async function countQuery(
  label: string,
  query: PromiseLike<CountQueryResult>,
) {
  const { count, error } = await query;
  if (error) {
    if (error.code === "PGRST205" || error.message.toLowerCase().includes("could not find the table")) {
      throw new Error(`${label} is missing from the Supabase schema. Push migrations before verifying.`);
    }
    throw new Error(`${label} check failed: ${error.message}`);
  }

  return count ?? 0;
}

async function main() {
  const projectRoot = process.cwd();
  loadEnvFile(path.join(projectRoot, ".env"));
  loadEnvFile(path.join(projectRoot, ".env.local"));

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL. You can also provide VITE_SUPABASE_URL locally.");
  }

  const suiteIds = systemSuiteTemplates.map((suite) => suite.id);
  const binderIds = Object.values(SYSTEM_BINDER_IDS);

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const [
    suiteTemplates,
    seedVersionsCount,
    workspacePresets,
    folders,
    folderBindersCount,
    bindersCount,
    lessonsCount,
    bindersResult,
    lessonsResult,
    foldersResult,
    folderBindersResult,
    notesResult,
    highlightsResult,
    commentsResult,
    seedVersionsResult,
  ] = await Promise.all([
    countQuery(
      "suite_templates",
      client.from("suite_templates").select("id", { count: "exact", head: true }).in("id", suiteIds),
    ),
    countQuery(
      "seed_versions",
      client
        .from("seed_versions")
        .select("id", { count: "exact", head: true })
        .in("suite_template_id", suiteIds),
    ),
    countQuery(
      "workspace_presets",
      client
        .from("workspace_presets")
        .select("id", { count: "exact", head: true })
        .in("suite_template_id", suiteIds),
    ),
    countQuery(
      "system_folders",
      client
        .from("folders")
        .select("id", { count: "exact", head: true })
        .eq("source", "system")
        .in("suite_template_id", suiteIds),
    ),
    countQuery(
      "folder_binders",
      client.from("folder_binders").select("id", { count: "exact", head: true }).in("binder_id", binderIds),
    ),
    countQuery(
      "binders",
      client.from("binders").select("id", { count: "exact", head: true }).in("id", binderIds),
    ),
    countQuery(
      "binder_lessons",
      client.from("binder_lessons").select("id", { count: "exact", head: true }).in("binder_id", binderIds),
    ),
    client.from("binders").select("*"),
    client.from("binder_lessons").select("*"),
    client.from("folders").select("*"),
    client.from("folder_binders").select("*"),
    client.from("learner_notes").select("*"),
    client
      .from("highlights")
      .select(
        "id,owner_id,binder_id,lesson_id,document_id,source_version_id,anchor_text,selected_text,prefix_text,suffix_text,selector_json,color,note_id,start_offset,end_offset,status,reanchor_confidence,created_at,updated_at",
      ),
    client.from("comments").select("id,owner_id,binder_id,lesson_id"),
    client.from("seed_versions").select("suite_template_id,version,status").in("suite_template_id", suiteIds),
  ]);

  const fetchError =
    bindersResult.error ||
    lessonsResult.error ||
    foldersResult.error ||
    folderBindersResult.error ||
    notesResult.error ||
    highlightsResult.error ||
    commentsResult.error ||
    seedVersionsResult.error;
  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const report = buildSystemVerificationReport({
    counts: {
      suiteTemplates,
      seedVersions: seedVersionsCount,
      workspacePresets,
      folders,
      folderBinders: folderBindersCount,
      binders: bindersCount,
      lessons: lessonsCount,
    },
    seedVersions: (seedVersionsResult.data ?? []) as Array<{
      suite_template_id: string;
      version: string;
      status: string;
    }>,
    binders: (bindersResult.data ?? []) as Binder[],
    dataset: {
      binders: (bindersResult.data ?? []) as Binder[],
      lessons: (lessonsResult.data ?? []) as BinderLesson[],
      folders: (foldersResult.data ?? []) as Folder[],
      folderBinders: (folderBindersResult.data ?? []) as FolderBinderLink[],
      notes: (notesResult.data ?? []) as LearnerNote[],
      highlights: (highlightsResult.data ?? []) as Highlight[],
      comments: (commentsResult.data ?? []) as Array<{
        id: string;
        owner_id?: string;
        binder_id: string;
        lesson_id: string;
      }>,
    },
  });

  console.log("");
  console.log("Binder Notes system content verification");
  console.log("");
  console.table({
    suite_templates: suiteTemplates,
    seed_versions: seedVersionsCount,
    workspace_presets: workspacePresets,
    binders: bindersCount,
    binder_lessons: lessonsCount,
    system_folders: folders,
    folder_binders: folderBindersCount,
  });
  console.log("");
  console.table(report.summary);

  if (!report.ok) {
    console.log("");
    report.issues.forEach((issue) => console.error(`- ${issue}`));
    throw new Error("System content verification failed.");
  }

  console.log("");
  console.log("Binder Notes system content verification passed.");
}

main().catch((error) => {
  console.error("");
  console.error("Binder Notes system content verification failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
