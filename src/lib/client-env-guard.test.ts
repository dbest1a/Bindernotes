import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertRequiredClientEnv,
  loadClientEnvFiles,
  validateBuiltClientOutput,
} from "../../scripts/client-env-guard.mjs";

describe("client env guard", () => {
  it("fails before build when Supabase client env is missing", () => {
    expect(() =>
      assertRequiredClientEnv({
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_ANON_KEY: "",
      }),
    ).toThrow(/VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY/);
  });

  it("loads production env files before Vite builds the client bundle", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bindernotes-env-"));
    try {
      mkdirSync(join(cwd, ".vercel"));
      writeFileSync(
        join(cwd, ".env.local"),
        "VITE_SUPABASE_URL=https://local.supabase.co\nVITE_SUPABASE_ANON_KEY=local-anon-key\n",
      );
      writeFileSync(
        join(cwd, ".vercel", ".env.production.local"),
        'VITE_SUPABASE_URL=""\nVITE_SUPABASE_ANON_KEY=""\n',
      );

      const env: NodeJS.ProcessEnv = {};
      loadClientEnvFiles({ cwd, env, mode: "production" });

      expect(env.VITE_SUPABASE_URL).toBe("https://local.supabase.co");
      expect(env.VITE_SUPABASE_ANON_KEY).toBe("local-anon-key");
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("fails after build if the configured Supabase URL was not embedded", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bindernotes-output-"));
    try {
      mkdirSync(join(cwd, "dist"), { recursive: true });
      writeFileSync(join(cwd, "dist", "index.js"), "console.log('no client config here')");

      expect(() =>
        validateBuiltClientOutput({
          cwd,
          env: {
            VITE_SUPABASE_URL: "https://example.supabase.co",
            VITE_SUPABASE_ANON_KEY: "test-anon-key",
          },
          outDir: "dist",
        }),
      ).toThrow(/Supabase URL was not embedded/);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });
});
