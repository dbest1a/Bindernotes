import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_CLIENT_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

const BUNDLE_EXTENSIONS = new Set([".css", ".html", ".js", ".mjs"]);

export function parseDotEnv(text) {
  const values = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();
    if (!key) continue;

    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(" #");
      if (commentIndex >= 0) value = value.slice(0, commentIndex).trim();
    }

    values[key] = value;
  }

  return values;
}

export function getClientEnvFileOrder(mode = "production") {
  return [
    ".env",
    ".env.local",
    `.env.${mode}`,
    `.env.${mode}.local`,
    join(".vercel", `.env.${mode}.local`),
  ];
}

export function loadClientEnvFiles({ cwd = process.cwd(), env = process.env, mode = "production" } = {}) {
  const protectedKeys = new Set(Object.keys(env).filter((key) => env[key]));
  const loadedFiles = [];

  for (const envFile of getClientEnvFileOrder(mode)) {
    const fullPath = join(cwd, envFile);
    if (!existsSync(fullPath)) continue;

    const parsed = parseDotEnv(readFileSync(fullPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (protectedKeys.has(key)) continue;
      if (!String(value ?? "").trim()) continue;
      env[key] = value;
    }
    loadedFiles.push(envFile);
  }

  return loadedFiles;
}

export function assertRequiredClientEnv(env = process.env) {
  const missing = REQUIRED_CLIENT_ENV.filter((key) => !String(env[key] ?? "").trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required Vite client env: ${missing.join(
        ", ",
      )}. Set these before building so Supabase auth can run in the deployed client.`,
    );
  }
}

export function validateBuiltClientOutput({ cwd = process.cwd(), env = process.env, outDir = "dist" } = {}) {
  assertRequiredClientEnv(env);

  const outputPath = join(cwd, outDir);
  if (!existsSync(outputPath)) {
    throw new Error(`Client output directory does not exist: ${outDir}`);
  }

  const files = listBundleFiles(outputPath);
  const hasSupabaseUrl = containsText(files, env.VITE_SUPABASE_URL);
  const hasSupabaseAnonKey = containsText(files, env.VITE_SUPABASE_ANON_KEY);

  if (!hasSupabaseUrl) {
    throw new Error(`Supabase URL was not embedded in ${relative(cwd, outputPath)}. Refusing to ship broken auth.`);
  }

  if (!hasSupabaseAnonKey) {
    throw new Error(`Supabase anon key was not embedded in ${relative(cwd, outputPath)}. Refusing to ship broken auth.`);
  }
}

function listBundleFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listBundleFiles(fullPath));
      continue;
    }

    const extension = entry.includes(".") ? entry.slice(entry.lastIndexOf(".")) : "";
    if (BUNDLE_EXTENSIONS.has(extension)) files.push(fullPath);
  }

  return files;
}

function containsText(files, needle) {
  if (!needle) return false;
  return files.some((file) => readFileSync(file, "utf8").includes(needle));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const mode = readArg("--mode") ?? process.env.MODE ?? "production";
  const checkOutput = readArg("--check-output");

  loadClientEnvFiles({ mode });
  assertRequiredClientEnv();
  if (checkOutput) validateBuiltClientOutput({ outDir: checkOutput });
  console.log("Client env guard passed: required Vite Supabase env is present.");
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
