import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const forbiddenText = [
  "Supabase configuration required",
  "Auth setup required",
  "Demo mode",
  "Learner demo",
  "Admin demo",
];

const requiredLiveText = [
  "Open Binder Notes",
  "Login",
  "Signup",
  "Email",
  "Password",
  "Continue with Google",
];

const args = parseArgs(process.argv.slice(2));

if (!args.url) {
  args.url = "https://www.bindernotes.com/auth";
}

await verifyLiveAuthPage(args.url);

function parseArgs(argv) {
  const parsed = {
    url: process.env.AUTH_VERIFY_URL || "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--url") {
      parsed.url = argv[index + 1] ?? "";
      index += 1;
    }
  }

  return parsed;
}

async function verifyLiveAuthPage(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Auth verification failed: ${url} returned HTTP ${response.status}`);
  }

  const browserPath = findBrowser();
  if (!browserPath) {
    throw new Error("Auth verification failed: no headless Chrome or Edge browser was found.");
  }

  const dom = renderDomWithBrowser(browserPath, url);
  const normalizedDom = dom.replace(/\s+/g, " ");
  const blocked = forbiddenText.filter((text) => normalizedDom.includes(text));
  if (blocked.length > 0) {
    throw new Error(`Auth verification failed: live page contains blocked text: ${blocked.join(", ")}`);
  }

  const missing = requiredLiveText.filter((text) => !normalizedDom.includes(text));
  if (missing.length > 0) {
    throw new Error(`Auth verification failed: live page is missing expected auth text: ${missing.join(", ")}`);
  }

  console.log(`Auth live verification passed for ${url}.`);
}

function findBrowser() {
  const candidates = [
    process.env.AUTH_VERIFY_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "google-chrome",
    "chrome",
    "msedge",
    "chromium",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes("\\") && !existsSync(candidate)) {
      continue;
    }

    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) {
      return candidate;
    }
  }

  return null;
}

function renderDomWithBrowser(browserPath, url) {
  const userDataDir = mkdtempSync(join(tmpdir(), "bindernotes-auth-verify-"));
  try {
    const result = spawnSync(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${userDataDir}`,
        "--virtual-time-budget=8000",
        "--dump-dom",
        url,
      ],
      {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    if (result.status !== 0) {
      throw new Error(
        `Headless browser failed with exit ${result.status}: ${(result.stderr || result.stdout).slice(0, 800)}`,
      );
    }

    return result.stdout;
  } finally {
    rmSync(userDataDir, { recursive: true, force: true });
  }
}
