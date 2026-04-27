import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("production safety source guards", () => {
  it("keeps demo auth controls and profile fallback out of production auth paths", () => {
    const authSources = [
      "src/hooks/use-auth.tsx",
      "src/pages/auth-page.tsx",
    ]
      .map(readSource)
      .join("\n");

    expect(authSources).not.toContain("Demo mode");
    expect(authSources).not.toContain("Learner demo");
    expect(authSources).not.toContain("Admin demo");
    expect(authSources).not.toContain("enterDemo");
    expect(authSources).not.toContain("demoAdmin");
    expect(authSources).not.toContain("demoProfile");
    expect(authSources).not.toContain("binder-notes:demo-profile");
  });

  it("does not stringify full lesson documents during search or remount workspaces for every preference timestamp", () => {
    const reader = readSource("src/pages/binder-reader-page.tsx");

    expect(reader).not.toContain("JSON.stringify(lesson.content)");
    expect(reader).not.toMatch(/resetKey=\{`[^`]*active\.updatedAt/);
  });
});
