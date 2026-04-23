import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  buildSystemSeedPayload,
  getSystemSeedCounts,
  resolveSystemSeedProfile,
  seedSystemSuitesWithClient,
} from "../src/services/system-seed-service";

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

function resolveProjectRef(url: string) {
  try {
    return new URL(url).hostname.split(".")[0] ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function main() {
  const projectRoot = process.cwd();
  loadEnvFile(path.join(projectRoot, ".env"));
  loadEnvFile(path.join(projectRoot, ".env.local"));

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const preferredProfileId =
    process.env.SUPABASE_SYSTEM_OWNER_ID ?? process.env.SUPABASE_ADMIN_PROFILE_ID ?? null;

  if (!supabaseUrl) {
    throw new Error(
      "Missing SUPABASE_URL. You can also provide VITE_SUPABASE_URL locally, but the seed script must use a server-side SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Export it in your terminal or server-side env before running npm run seed:system.",
    );
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const profile = await resolveSystemSeedProfile(client, preferredProfileId);
  const payload = buildSystemSeedPayload(profile);
  const result = await seedSystemSuitesWithClient(client, payload);
  const counts = await getSystemSeedCounts(client);

  console.log("");
  console.log(`Binder Notes system seed complete for project ${resolveProjectRef(supabaseUrl)}.`);
  console.log(`Admin owner: ${profile.email} (${profile.id})`);
  console.log("");
  console.table({
    suite_templates: counts.suiteTemplates,
    seed_versions: counts.seedVersions,
    workspace_presets: counts.workspacePresets,
    system_folders: counts.folders,
    folder_binders: counts.folderBinders,
    binders: counts.binders,
    binder_lessons: counts.lessons,
  });
  console.log("");
  console.log(
    `Seeded ${result.suiteCount} suites, ${result.folderCount} folders, ${result.binderCount} binders, ${result.lessonCount} lessons, and ${result.presetCount} preset layouts.`,
  );
  console.log(
    `History templates: ${result.templateCounts.events} events, ${result.templateCounts.sources} sources, ${result.templateCounts.mythChecks} myth checks.`,
  );
}

main().catch((error) => {
  console.error("");
  console.error("Binder Notes system seed failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
