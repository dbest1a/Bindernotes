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

  it("keeps auth bootstrap isolated from binder/dashboard/workspace services", () => {
    const authHook = readSource("src/hooks/use-auth.tsx");
    const authProfileService = readSource("src/services/auth-profile.ts");

    expect(authHook).toContain("@/services/auth-profile");
    expect(authHook).not.toContain("@/services/binder-service");
    expect(authProfileService).not.toContain("binder-service");
    expect(authProfileService).not.toMatch(/demo|seed|workspace|preset|admin|editor/i);
  });

  it("keeps optional studio settings and editor bundles behind lazy import boundaries", () => {
    const reader = readSource("src/pages/binder-reader-page.tsx");
    const studyModules = readSource("src/components/workspace/study-core-modules.tsx");
    const simpleShell = readSource("src/components/workspace/simple-presentation-shell.tsx");
    const personalNotes = readSource("src/pages/personal-notes-page.tsx");

    expect(reader).not.toMatch(/import\s+\{\s*WorkspaceSettings\s*\}\s+from\s+["']@\/components\/workspace\/workspace-settings["']/);
    expect(reader).toContain("lazy(() =>");
    expect(reader).toContain("@/components/workspace/workspace-settings");

    for (const source of [studyModules, simpleShell, personalNotes]) {
      expect(source).not.toMatch(/from\s+["']@\/components\/editor\/rich-text-editor["']/);
      expect(source).toContain("@/components/editor/lazy-rich-text-editor");
    }
  });

  it("keeps signed-in app chrome and background services behind lazy boundaries", () => {
    const app = readSource("src/App.tsx");

    expect(app).not.toMatch(/import\s+\{\s*AppShell\s*\}\s+from\s+["']@\/components\/layout\/app-shell["']/);
    expect(app).not.toMatch(/import\s+\{\s*TutorialPromptHost\s*\}\s+from\s+["']@\/components\/tutorials\/tutorial-prompt["']/);
    expect(app).not.toMatch(/import\s+\{\s*UserAppearanceSync\s*\}\s+from\s+["']@\/components\/theme\/user-appearance-sync["']/);
    expect(app).not.toContain("@/lib/sync-recovery");
    expect(app).toContain("@/components/layout/app-shell");
    expect(app).toContain("@/components/tutorials/tutorial-prompt");
    expect(app).toContain("@/components/theme/user-appearance-sync");
    expect(app).toContain("@/components/system/sync-recovery-bridge");
  });

  it("keeps heavy route-only tools out of common entry imports", () => {
    const main = readSource("src/main.tsx");
    const app = readSource("src/App.tsx");
    const reader = readSource("src/pages/binder-reader-page.tsx");
    const workspaceModules = readSource("src/components/workspace/workspace-modules.tsx");

    for (const source of [main, app, reader]) {
      expect(source).not.toContain("@excalidraw/excalidraw");
      expect(source).not.toMatch(/from\s+["'].*mermaid/);
    }

    expect(workspaceModules).toContain("LazyWhiteboardModule");
    expect(workspaceModules).toContain("import(\"@/components/whiteboard/whiteboard-module\")");
  });

  it("keeps release bundle scanning wired into package scripts", () => {
    const packageJson = readSource("package.json");
    const viteConfig = readSource("vite.config.ts");

    expect(packageJson).toContain("\"scan:build\"");
    expect(readSource("scripts/scan-build-assets.mjs")).toContain("main entry");
    expect(viteConfig).not.toContain("onlyExplicitManualChunks: true");
  });

  it("does not stringify full lesson documents during search or remount workspaces for every preference timestamp", () => {
    const reader = readSource("src/pages/binder-reader-page.tsx");

    expect(reader).not.toContain("JSON.stringify(lesson.content)");
    expect(reader).not.toMatch(/resetKey=\{`[^`]*active\.updatedAt/);
  });
});
