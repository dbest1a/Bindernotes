import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  applySystemRepairPlan,
  planSystemContentRepair,
  type SystemRepairDataset,
} from "../src/lib/system-content-repair";
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

async function loadRepairDataset(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ client: ReturnType<typeof createClient>; dataset: SystemRepairDataset }> {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const [bindersResult, lessonsResult, foldersResult, folderLinksResult, notesResult, highlightsResult, commentsResult] =
    await Promise.all([
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
    ]);

  const error =
    bindersResult.error ||
    lessonsResult.error ||
    foldersResult.error ||
    folderLinksResult.error ||
    notesResult.error ||
    highlightsResult.error ||
    commentsResult.error;

  if (error) {
    throw error;
  }

  return {
    client,
    dataset: {
      binders: (bindersResult.data ?? []) as Binder[],
      lessons: (lessonsResult.data ?? []) as BinderLesson[],
      folders: (foldersResult.data ?? []) as Folder[],
      folderBinders: (folderLinksResult.data ?? []) as FolderBinderLink[],
      notes: (notesResult.data ?? []) as LearnerNote[],
      highlights: (highlightsResult.data ?? []) as Highlight[],
      comments: (commentsResult.data ?? []) as Array<{
        id: string;
        owner_id?: string;
        binder_id: string;
        lesson_id: string;
      }>,
    },
  };
}

async function main() {
  const projectRoot = process.cwd();
  loadEnvFile(path.join(projectRoot, ".env"));
  loadEnvFile(path.join(projectRoot, ".env.local"));

  const apply = process.argv.includes("--apply");
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL. You can also provide VITE_SUPABASE_URL locally.");
  }

  const { client, dataset } = await loadRepairDataset(supabaseUrl, serviceRoleKey);
  const plan = planSystemContentRepair(dataset);

  console.log("");
  console.log(apply ? "Applying safe system placeholder repair" : "System placeholder repair dry run");
  console.log("");
  console.table(
    plan.actions.map((action) => ({
      action: action.type,
      id: action.id,
      ownerId: action.ownerId,
      nextTitle: action.type === "rename-binder" ? action.nextTitle : "",
      reason: action.reason,
    })),
  );
  console.log("");
  console.table(plan.summary);

  const result = await applySystemRepairPlan(client, plan, { apply });

  console.log("");
  console.log(
    apply
      ? `Applied ${result.actionCount} safe system repair action(s).`
      : `Dry run found ${result.actionCount} safe system repair action(s).`,
  );
}

main().catch((error) => {
  console.error("");
  console.error("Binder Notes system repair failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
